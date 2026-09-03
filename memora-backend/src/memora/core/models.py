import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class MemoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    text: str
    embedding: Optional[List[float]] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
    decay_score: float = Field(
        default=1.0,
        description="Static field — automatic time-based decay computation NOT yet implemented, planned for a later phase.",
    )


class SearchResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    text: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    score: float = Field(..., description="Cosine similarity score (0.0 to 1.0)")
    created_at: Optional[datetime] = None
    decay_score: Optional[float] = Field(
        default=1.0,
        description="Static field — automatic time-based decay computation NOT yet implemented, planned for a later phase.",
    )


class MemoryCreate(BaseModel):
    text: str = Field(..., min_length=1, description="Text content of the memory")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Arbitrary JSON metadata")
    embedding: Optional[List[float]] = Field(default=None, description="Pre-computed vector embedding (optional)")
    id: Optional[uuid.UUID] = Field(default=None, description="Optional custom UUID")


class MemoryUpdate(BaseModel):
    text: Optional[str] = Field(default=None, min_length=1, description="Updated text content")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Updated metadata dictionary")
    embedding: Optional[List[float]] = Field(default=None, description="Updated embedding vector")
    decay_score: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Updated decay score (static field — automatic time-based decay computation NOT yet implemented, planned for a later phase)",
    )


class MemoryPruneRequest(BaseModel):
    threshold: float = Field(
        default=0.2,
        ge=0.0,
        le=1.0,
        description="Threshold score under which memories are pruned",
    )


class MemoryPruneResponse(BaseModel):
    status: str = "success"
    pruned_count: int
    threshold: float


class GraphNode(BaseModel):
    id: str
    text: str
    category: str = "General"
    source: str = "MemoraStore"
    timestamp: Optional[str] = None
    degree: int = 0


class GraphLink(BaseModel):
    source: str
    target: str
    similarity: float
    distance: float


class GraphResponse(BaseModel):
    nodes: List[GraphNode] = Field(default_factory=list)
    links: List[GraphLink] = Field(default_factory=list)
    categories: List[str] = Field(default_factory=list)
