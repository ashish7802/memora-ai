import os
from functools import lru_cache
from typing import Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "Memora Engine"
    API_V1_STR: str = "/v1"
    DATABASE_URL: str = Field(
        default="postgresql://memora:memora_secret@localhost:5432/memora_db",
        description="Asyncpg compatible connection string",
    )
    EMBEDDING_PROVIDER: Literal["gemini", "ollama"] = Field(
        default="ollama",
        description="Vector embedding provider backend",
    )
    EMBEDDING_MODEL: str = Field(
        default="nomic-embed-text",
        description="Model name for vector embeddings",
    )
    EMBEDDING_DIM: int = Field(
        default=768,
        description="Dimension size of embeddings matching database vector column",
    )
    GEMINI_API_KEY: str | None = None
    OLLAMA_ENDPOINT: str = "http://localhost:11434"
    DB_POOL_MIN_SIZE: int = 5
    DB_POOL_MAX_SIZE: int = 20


@lru_cache()
def get_settings() -> Settings:
    return Settings()


def load_config() -> Settings:
    """Explicit loader utility reading configuration from environment or .env file."""
    return get_settings()
