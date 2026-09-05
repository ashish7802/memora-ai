import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class RankingBreakdown(BaseModel):
    vector_similarity: float
    recency_score: float
    importance_score: float
    frequency_score: float
    combined_score: float


class Memory(BaseModel):
    """Represents a single cognitive memory unit in Memora with full auditability."""
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: uuid.UUID
    tenant_id: Optional[uuid.UUID] = None
    text: str
    session_id: str = "default"
    user_id: Optional[str] = None
    agent_id: Optional[str] = None
    cluster: str = "general"
    memory_type: str = "context"
    status: str = "active"
    importance: float = 1.0
    confidence: float = 0.9
    access_count: float = 0.0
    recall_count: int = 0
    source_type: str = "user_prompt"
    source_id: Optional[str] = None
    document_id: Optional[str] = None
    message_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict, alias="metadata_")
    similarity_score: Optional[float] = None
    cosine_distance: Optional[float] = None
    ranking_breakdown: Optional[RankingBreakdown] = None
    conflict_warning: Optional[str] = None
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    last_recalled_at: Optional[datetime] = None
    forgotten_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    last_accessed_at: Optional[datetime] = None
    embedding_provider: Optional[str] = None
    embedding_model: Optional[str] = None


class MemoryCreate(BaseModel):
    text: str = Field(..., min_length=1, description="Memory text content")
    session_id: str = Field(default="default", description="Session or conversation scope")
    user_id: Optional[str] = Field(default=None, description="User scope")
    agent_id: Optional[str] = Field(default=None, description="Agent identifier")
    cluster: str = Field(default="general", description="Semantic category cluster")
    memory_type: str = Field(default="context", description="Memory type classification")
    importance: float = Field(default=1.0, ge=0.0, le=5.0, description="Memory priority weight")
    confidence: float = Field(default=0.9, ge=0.0, le=1.0, description="Confidence score")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Custom metadata attributes")
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    legal_basis: Optional[str] = None
    retention_policy: Optional[str] = None


class MemoryUpdate(BaseModel):
    id: uuid.UUID = Field(..., description="ID of memory to update")
    text: Optional[str] = Field(default=None, min_length=1, description="Updated text")
    cluster: Optional[str] = Field(default=None, description="Updated semantic cluster")
    memory_type: Optional[str] = Field(default=None, description="Updated memory type")
    status: Optional[str] = Field(default=None, description="Updated status")
    importance: Optional[float] = Field(default=None, ge=0.0, le=5.0, description="Updated importance weight")
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Updated confidence score")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Updated metadata dictionary")
    valid_until: Optional[datetime] = None


class MemorySearchQuery(BaseModel):
    query: str = Field(..., min_length=1, description="Semantic text query")
    session_id: Optional[str] = Field(default=None, description="Filter by session ID")
    cluster: Optional[str] = Field(default=None, description="Filter by cluster")
    user_id: Optional[str] = Field(default=None, description="Filter by user ID")
    memory_type: Optional[str] = Field(default=None, description="Filter by memory type")
    status: Optional[str] = Field(default="active", description="Filter by status")
    top_k: int = Field(default=5, ge=1, le=100, description="Max results")
    threshold: Optional[float] = Field(default=None, ge=0.0, le=2.0, description="Max distance threshold")
    as_of: Optional[datetime] = None
    include_explanation: bool = True


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


class MemorySearchResult(BaseModel):
    status: str
    count: int
    data: List[Memory]
    explanation: Optional[SearchExplanation] = None


class MemoryForgetResult(BaseModel):
    status: str
    memory_id: uuid.UUID
    mode: str
    audit_log_id: uuid.UUID
    deletion_proof: Optional[str] = None
    message: str


class MemoryDeleteResult(BaseModel):
    status: str
    deleted_id: uuid.UUID
    message: str


class MemoryPruneResult(BaseModel):
    status: str
    pruned_count: int
    message: str


class AuditLogEntry(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    target_type: str
    target_id: str
    action: str
    actor_type: str
    actor_id: Optional[str] = None
    reason: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict, alias="metadata_")
    timestamp: datetime
