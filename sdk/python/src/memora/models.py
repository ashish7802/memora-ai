import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class Memory(BaseModel):
    """Represents a single cognitive memory unit in Memora."""
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: uuid.UUID
    text: str
    session_id: str = "default"
    user_id: Optional[str] = None
    agent_id: Optional[str] = None
    cluster: str = "general"
    importance: float = 1.0
    access_count: float = 0.0
    metadata: Dict[str, Any] = Field(default_factory=dict, alias="metadata_")
    similarity_score: Optional[float] = None
    cosine_distance: Optional[float] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    last_accessed_at: Optional[datetime] = None


class MemoryCreate(BaseModel):
    text: str = Field(..., min_length=1, description="Memory text content")
    session_id: str = Field(default="default", description="Session or conversation scope")
    user_id: Optional[str] = Field(default=None, description="User scope")
    agent_id: Optional[str] = Field(default=None, description="Agent identifier")
    cluster: str = Field(default="general", description="Semantic category cluster")
    importance: float = Field(default=1.0, ge=0.0, le=5.0, description="Memory priority weight")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Custom metadata attributes")


class MemoryUpdate(BaseModel):
    id: uuid.UUID = Field(..., description="ID of memory to update")
    text: Optional[str] = Field(default=None, min_length=1, description="Updated text (triggers re-embedding)")
    cluster: Optional[str] = Field(default=None, description="Updated semantic cluster")
    importance: Optional[float] = Field(default=None, ge=0.0, le=5.0, description="Updated importance weight")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Updated metadata dictionary")


class MemorySearchQuery(BaseModel):
    query: str = Field(..., min_length=1, description="Semantic text query")
    session_id: Optional[str] = Field(default=None, description="Filter by session ID")
    cluster: Optional[str] = Field(default=None, description="Filter by cluster")
    user_id: Optional[str] = Field(default=None, description="Filter by user ID")
    top_k: int = Field(default=5, ge=1, le=100, description="Max results")
    threshold: Optional[float] = Field(default=None, ge=0.0, le=2.0, description="Max distance threshold")


class MemorySearchResult(BaseModel):
    status: str
    count: int
    data: List[Memory]


class MemoryDeleteResult(BaseModel):
    status: str
    deleted_id: uuid.UUID
    message: str


class MemoryPruneResult(BaseModel):
    status: str
    pruned_count: int
    message: str
