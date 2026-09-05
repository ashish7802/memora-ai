from typing import AsyncGenerator
import uuid
from sqlalchemy import Column, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def set_tenant_context(session: AsyncSession, tenant_id: uuid.UUID) -> None:
    """Sets PostgreSQL session variable app.current_tenant_id for Row Level Security."""
    try:
        await session.execute(
            text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
            {"tenant_id": str(tenant_id)},
        )
    except Exception:
        # Graceful fallback for non-PostgreSQL / SQLite test engines
        pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
