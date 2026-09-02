from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Memora Vector Memory Engine"
    API_V1_STR: str = "/v1"
    ENVIRONMENT: str = "development"

    # Database & Vector DB
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://memora:memora_secret@localhost:5432/memora_db",
        description="Async PostgreSQL connection string with pgvector"
    )
    DATABASE_SYNC_URL: str = Field(
        default="postgresql://memora:memora_secret@localhost:5432/memora_db",
        description="Sync PostgreSQL connection string for Alembic migrations"
    )
    EMBEDDING_DIMENSION: int = 768
    DEFAULT_DISTANCE_THRESHOLD: float = 0.75

    # Embedding Provider
    GEMINI_API_KEY: Optional[str] = None
    EMBEDDING_MODEL: str = "models/text-embedding-004"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
