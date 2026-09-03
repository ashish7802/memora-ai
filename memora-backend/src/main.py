import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
import asyncpg
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pgvector.asyncpg import register_vector

# Robust multi-environment sys.path setup for direct, src/, or root container execution
CURRENT_FILE = Path(__file__).resolve()
SRC_DIR = CURRENT_FILE.parent                      # .../memora-backend/src
BACKEND_DIR = SRC_DIR.parent                      # .../memora-backend
ROOT_DIR = BACKEND_DIR.parent                     # .../ (project root for app.monitoring)

for p in [str(SRC_DIR), str(BACKEND_DIR), str(ROOT_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from memora.api.routes import router as memory_router
from memora.core.config import get_settings
from memora.memory.vector_store import PgVectorStore

try:
    from app.monitoring.middleware import MetricsMiddleware
    from app.monitoring.logger import setup_logging
    setup_logging()
    HAS_MONITORING = True
except ImportError:
    HAS_MONITORING = False

settings = get_settings()


async def init_connection(conn: asyncpg.Connection):
    """Initializes asyncpg connection with pgvector type support."""
    await register_vector(conn)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize asyncpg connection pool
    app.state.db_pool = await asyncpg.create_pool(
        dsn=settings.DATABASE_URL,
        min_size=settings.DB_POOL_MIN_SIZE,
        max_size=settings.DB_POOL_MAX_SIZE,
        init=init_connection,
    )
    yield
    # Graceful shutdown of database pool
    if hasattr(app.state, "db_pool") and app.state.db_pool:
        await app.state.db_pool.close()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Observability Middleware if present
if HAS_MONITORING:
    app.add_middleware(MetricsMiddleware)

# Include Memory Router
app.include_router(memory_router)


@app.get("/healthz", tags=["Health"])
async def health_check():
    db_status = "unconnected"
    if hasattr(app.state, "db_pool") and app.state.db_pool:
        db_status = "connected"
    return {
        "status": "healthy",
        "service": "Memora Sovereign Vector Engine",
        "database": db_status,
        "embedding_provider": settings.EMBEDDING_PROVIDER,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
