import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pgvector.sqlalchemy import Vector
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class MemoryType(str, Enum):
    OBSERVATION = "observation"
    FACT = "fact"
    RULE = "rule"
    PREFERENCE = "preference"
    GOAL = "goal"
    CONTEXT = "context"
    SKILL_REFERENCE = "skill_reference"


class MemoryStatus(str, Enum):
    ACTIVE = "active"
    DEPRECATED = "deprecated"
    CONFLICTING = "conflicting"
    FORGOTTEN = "forgotten"
    ARCHIVED = "archived"


class SourceType(str, Enum):
    USER_PROMPT = "user_prompt"
    TOOL_OUTPUT = "tool_output"
    SYSTEM = "system"
    CONSOLIDATION = "consolidation"


class MemoryRecord(Base):
    __tablename__ = "memories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(Text, nullable=False)
    session_id = Column(String(128), nullable=False, index=True, default="default")
    user_id = Column(String(128), nullable=True, index=True)
    agent_id = Column(String(128), nullable=True, index=True)
    cluster = Column(String(64), nullable=False, default="general", index=True)
    memory_type = Column(String(32), nullable=False, default=MemoryType.CONTEXT.value, index=True)
    status = Column(String(32), nullable=False, default=MemoryStatus.ACTIVE.value, index=True)

    # Weights & Quality
    importance = Column(Float, nullable=False, default=1.0)
    confidence = Column(Float, nullable=False, default=0.9)
    access_count = Column(Float, nullable=False, default=0.0)
    recall_count = Column(Integer, nullable=False, default=0)

    # Provenance
    source_type = Column(String(64), nullable=False, default=SourceType.USER_PROMPT.value)
    source_id = Column(String(128), nullable=True)
    document_id = Column(String(128), nullable=True)
    message_id = Column(String(128), nullable=True)

    # Temporal Validity
    valid_from = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    valid_until = Column(DateTime(timezone=True), nullable=True)
    last_recalled_at = Column(DateTime(timezone=True), nullable=True)
    last_accessed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Compliance & Consent
    legal_basis = Column(String(64), nullable=True)
    retention_policy = Column(String(64), nullable=True)
    forget_requested_at = Column(DateTime(timezone=True), nullable=True)
    forgotten_at = Column(DateTime(timezone=True), nullable=True)

    # Immutable Audit Actors
    created_by = Column(String(128), nullable=True)
    updated_by = Column(String(128), nullable=True)

    # Embedding Provenance
    embedding_provider = Column(String(64), nullable=False, default="gemini")
    embedding_model = Column(String(64), nullable=False, default="text-embedding-004")
    embedding_dim = Column(Integer, nullable=False, default=768)

    # Storage
    metadata_ = Column("metadata", JSONB, nullable=False, default=dict)
    embedding = Column(Vector(768), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index(
            "ix_memories_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
        Index("ix_memories_tenant_session", "tenant_id", "session_id"),
        Index("ix_memories_tenant_status", "tenant_id", "status"),
        Index("ix_memories_tenant_cluster", "tenant_id", "cluster"),
    )


class AuditLogRecord(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    target_type = Column(String(64), nullable=False)  # memory, skill, rule, policy
    target_id = Column(String(128), nullable=False, index=True)
    action = Column(String(64), nullable=False, index=True)  # created, recalled, updated, deprecated, forgotten, purged, conflict_detected
    actor_type = Column(String(32), nullable=False, default="user")  # user, agent, system, admin
    actor_id = Column(String(128), nullable=True)
    reason = Column(Text, nullable=True)
    metadata_ = Column("metadata", JSONB, nullable=False, default=dict)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    __table_args__ = (
        Index("ix_audit_logs_tenant_timestamp", "tenant_id", "timestamp"),
        Index("ix_audit_logs_tenant_target", "tenant_id", "target_type", "target_id"),
    )


# --- Pydantic Schemas ---

class ProvenanceInput(BaseModel):
    source_type: str = Field(default=SourceType.USER_PROMPT.value, description="Origin source type")
    source_id: Optional[str] = Field(default=None, description="Identifier of source")
    document_id: Optional[str] = Field(default=None, description="Document reference ID")
    message_id: Optional[str] = Field(default=None, description="Message reference ID")


class RankingBreakdown(BaseModel):
    vector_similarity: float = Field(..., description="Cosine similarity score (0-1)")
    recency_score: float = Field(..., description="Normalized recency weight (0-1)")
    importance_score: float = Field(..., description="Normalized importance score (0-1)")
    frequency_score: float = Field(..., description="Normalized recall frequency score (0-1)")
    combined_score: float = Field(..., description="Final weighted ranking score (0-1)")


class MemoryCreate(BaseModel):
    text: str = Field(..., min_length=1, description="Memory text content")
    session_id: str = Field(default="default", description="Session / conversation partition")
    user_id: Optional[str] = Field(default=None, description="User identifier")
    agent_id: Optional[str] = Field(default=None, description="Originating agent identifier")
    cluster: str = Field(default="general", description="Semantic category / domain cluster")
    memory_type: str = Field(default=MemoryType.CONTEXT.value, description="Type classification of memory")
    importance: float = Field(default=1.0, ge=0.0, le=5.0, description="Memory priority weight")
    confidence: float = Field(default=0.9, ge=0.0, le=1.0, description="Confidence in accuracy/relevance")
    provenance: Optional[ProvenanceInput] = Field(default=None, description="Provenance tracking")
    valid_from: Optional[datetime] = Field(default=None, description="Temporal validity start")
    valid_until: Optional[datetime] = Field(default=None, description="Temporal expiration timestamp")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Custom structured metadata")
    legal_basis: Optional[str] = Field(default=None, description="Compliance legal basis")
    retention_policy: Optional[str] = Field(default=None, description="Compliance retention policy")


class MemoryUpdate(BaseModel):
    id: uuid.UUID = Field(..., description="Unique memory ID")
    text: Optional[str] = Field(default=None, min_length=1, description="Updated text content")
    cluster: Optional[str] = Field(default=None, description="Updated semantic cluster")
    memory_type: Optional[str] = Field(default=None, description="Updated memory type")
    status: Optional[str] = Field(default=None, description="Updated status")
    importance: Optional[float] = Field(default=None, ge=0.0, le=5.0, description="Updated importance weight")
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Updated confidence score")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Updated metadata dictionary")
    valid_until: Optional[datetime] = Field(default=None, description="Updated expiration")


class MemoryDelete(BaseModel):
    id: uuid.UUID = Field(..., description="Memory ID to delete")


class MemorySearchQuery(BaseModel):
    query: str = Field(..., min_length=1, description="Semantic search query")
    session_id: Optional[str] = Field(default=None, description="Filter by session ID")
    cluster: Optional[str] = Field(default=None, description="Filter by semantic cluster")
    user_id: Optional[str] = Field(default=None, description="Filter by user ID")
    memory_type: Optional[str] = Field(default=None, description="Filter by memory type")
    status: Optional[str] = Field(default=MemoryStatus.ACTIVE.value, description="Filter by status (default: active)")
    top_k: int = Field(default=5, ge=1, le=100, description="Maximum number of results to return")
    threshold: Optional[float] = Field(default=None, ge=0.0, le=2.0, description="Max cosine distance threshold")
    as_of: Optional[datetime] = Field(default=None, description="Temporal query: memories valid at this timestamp")
    include_explanation: bool = Field(default=True, description="Whether to include explainable score breakdown")


class MemoryForgetRequest(BaseModel):
    mode: str = Field(default="soft", description="Forgetting mode: 'soft' (tombstone) or 'hard' (permanent purge)")
    reason: Optional[str] = Field(default="user_command", description="Reason for forget request")


class MemoryForgetResponse(BaseModel):
    status: str = "success"
    memory_id: uuid.UUID
    mode: str
    audit_log_id: uuid.UUID
    deletion_proof: Optional[str] = Field(default=None, description="SHA-256 cryptographic proof of deletion for hard purge")
    message: str


class MemoryPruneRequest(BaseModel):
    session_id: Optional[str] = Field(default=None, description="Target session to prune")
    older_than_days: Optional[int] = Field(default=None, ge=1, description="Prune memories older than N days")
    max_importance: Optional[float] = Field(default=1.0, ge=0.0, le=5.0, description="Prune if importance <= threshold")
    max_access_count: Optional[float] = Field(default=0.0, ge=0.0, description="Prune if accessed <= count")


class MemoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    text: str
    session_id: str
    user_id: Optional[str] = None
    agent_id: Optional[str] = None
    cluster: str
    memory_type: str
    status: str
    importance: float
    confidence: float
    access_count: float
    recall_count: int
    source_type: str
    source_id: Optional[str] = None
    document_id: Optional[str] = None
    message_id: Optional[str] = None
    valid_from: datetime
    valid_until: Optional[datetime] = None
    last_recalled_at: Optional[datetime] = None
    forgotten_at: Optional[datetime] = None
    metadata: Dict[str, Any] = Field(alias="metadata_")
    created_at: datetime
    updated_at: datetime
    last_accessed_at: datetime
    embedding_provider: str
    embedding_model: str

    # Recall enrichment
    similarity_score: Optional[float] = None
    cosine_distance: Optional[float] = None
    ranking_breakdown: Optional[RankingBreakdown] = None
    conflict_warning: Optional[str] = None


class SearchExplanation(BaseModel):
    query: str
    top_k: int
    threshold: float
    embedding_provider: str
    embedding_model: str
    embedding_dimension: int
    total_candidates_examined: int
    total_matches_returned: int
    rejected_count: int
    filter_summary: Dict[str, Any]


class ExplainableSearchResponse(BaseModel):
    status: str = "success"
    count: int
    data: List[MemoryResponse]
    explanation: SearchExplanation


class MemoryDeleteResponse(BaseModel):
    status: str = "success"
    deleted_id: uuid.UUID
    message: str


class MemoryPruneResponse(BaseModel):
    status: str = "success"
    pruned_count: int
    message: str


class MemoryBatchResponse(BaseModel):
    status: str = "success"
    count: int
    data: List[MemoryResponse]


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    target_type: str
    target_id: str
    action: str
    actor_type: str
    actor_id: Optional[str] = None
    reason: Optional[str] = None
    metadata: Dict[str, Any] = Field(alias="metadata_")
    timestamp: datetime


class AuditLogBatchResponse(BaseModel):
    status: str = "success"
    count: int
    data: List[AuditLogResponse]
