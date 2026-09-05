from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.memory import router as memory_router
from app.api.routes.learning import router as learning_router
from app.api.routes.auth import router as auth_router
from app.auth.dependencies import require_api_key
from app.auth.middleware import APIKeyAuthMiddleware
from app.core.config import settings
from app.core.database import engine, get_db
from app.core.exceptions import register_exception_handlers
from app.memory.service import MemoryService
from app.middleware.rate_limit import RateLimitMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure database connections
    yield
    # Shutdown: dispose db engine
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url=f"{settings.API_V1_STR}/docs",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# Register global consistent error handlers
register_exception_handlers(app)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate Limiting Middleware (100 req/min)
app.add_middleware(RateLimitMiddleware, requests_per_minute=100, window_seconds=60)

# Global API Key Authentication & Tenant Isolation Middleware
app.add_middleware(APIKeyAuthMiddleware)

# Register routes with /v1 prefix
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(memory_router, prefix=settings.API_V1_STR)
app.include_router(learning_router, prefix=settings.API_V1_STR)


@app.get(f"{settings.API_V1_STR}/stats", tags=["System & Metrics"])
async def get_tenant_stats(
    api_key=Depends(require_api_key),
    db=Depends(get_db),
):
    service = MemoryService(db)
    return await service.get_stats(tenant_id=api_key.tenant_id)


@app.get("/healthz", tags=["System"])
async def health_check():
    return {
        "status": "healthy",
        "engine": "Memora Sovereign Vector Memory",
        "version": "1.0.0",
        "auth": "API Key & Multi-Tenant Enabled",
    }
