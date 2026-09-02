import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pgvector.sqlalchemy import Vector
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class MemoryRecord(Base):
    __tablename__ = "memories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)
    text = Column(Text, nullable=False)
    session_id = Column(String(128), nullable=False, index=True, default="default")
    user_id = Column(String(128), nullable=True, index=True)
    agent_id = Column(String(128), nullable=True, index=True)
    cluster = Column(String(64), nullable=False, default="general", index=True)
    importance = Column(Float, nullable=False, default=1.0)
    access_count = Column(Float, nullable=False, default=0.0)
    metadata_ = Column("metadata", JSONB, nullable=False, default=dict)
    embedding = Column(Vector(768), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    last_accessed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index(
            "ix_memories_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
        Index("ix_memories_tenant_session", "tenant_id", "session_id"),
    )


# --- Pydantic Schemas ---

class MemoryCreate(BaseModel):
    text: str = Field(..., min_length=1, description="Memory text content")
    session_id: str = Field(default="default", description="Session / conversation partition")
    user_id: Optional[str] = Field(default=None, description="User identifier")
    agent_id: Optional[str] = Field(default=None, description="Originating agent identifier")
    cluster: str = Field(default="general", description="Semantic category / domain cluster")
    importance: float = Field(default=1.0, ge=0.0, le=5.0, description="Memory priority weight")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Custom structured metadata")


class MemoryUpdate(BaseModel):
    id: uuid.UUID = Field(..., description="Unique memory ID")
    text: Optional[str] = Field(default=None, min_length=1, description="Updated text content (triggers re-embedding)")
    cluster: Optional[str] = Field(default=None, description="Updated semantic cluster")
    importance: Optional[float] = Field(default=None, ge=0.0, le=5.0, description="Updated importance weight")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Updated metadata dictionary")


class MemoryDelete(BaseModel):
    id: uuid.UUID = Field(..., description="Memory ID to delete")


class MemorySearchQuery(BaseModel):
    query: str = Field(..., min_length=1, description="Semantic search query")
    session_id: Optional[str] = Field(default=None, description="Filter by session ID")
    cluster: Optional[str] = Field(default=None, description="Filter by semantic cluster")
    user_id: Optional[str] = Field(default=None, description="Filter by user ID")
    top_k: int = Field(default=5, ge=1, le=100, description="Maximum number of results to return")
    threshold: Optional[float] = Field(default=None, ge=0.0, le=2.0, description="Max cosine distance threshold")


class MemoryPruneRequest(BaseModel):
    session_id: Optional[str] = Field(default=None, description="Target session to prune")
    older_than_days: Optional[int] = Field(default=None, ge=1, description="Prune memories older than N days")
    max_importance: Optional[float] = Field(default=1.0, ge=0.0, le=5.0, description="Prune if importance <= threshold")
    max_access_count: Optional[float] = Field(default=0.0, ge=0.0, description="Prune if accessed <= count")


class MemoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: Optional[uuid.UUID] = None
    text: str
    session_id: str
    user_id: Optional[str] = None
    agent_id: Optional[str] = None
    cluster: str
    importance: float
    access_count: float
    metadata: Dict[str, Any] = Field(alias="metadata_")
    similarity_score: Optional[float] = None
    cosine_distance: Optional[float] = None
    created_at: datetime
    updated_at: datetime
    last_accessed_at: datetime


class MemoryBatchResponse(BaseModel):
    inserted_count: int
    memory_ids: List[uuid.UUID]
