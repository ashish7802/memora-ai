from fastapi import Depends, HTTPException, Request, status
import asyncpg

from memora.core.config import Settings, get_settings
from memora.memory.memory_api import MemoryClient
from memora.memory.vector_store import PgVectorStore, VectorStore


def get_db_pool(request: Request) -> asyncpg.Pool:
    """Retrieves the global asyncpg connection pool from FastAPI app state."""
    pool = getattr(request.app.state, "db_pool", None)
    if pool is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection pool is not initialized.",
        )
    return pool


def get_vector_store(pool: asyncpg.Pool = Depends(get_db_pool)) -> VectorStore:
    """Dependency that instantiates a PgVectorStore with the active connection pool."""
    return PgVectorStore(pool=pool)


def get_memory_client(
    store: VectorStore = Depends(get_vector_store),
    settings: Settings = Depends(get_settings),
) -> MemoryClient:
    """Dependency providing a configured MemoryClient instance."""
    return MemoryClient(vector_store=store, settings=settings)
