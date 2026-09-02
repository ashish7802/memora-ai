import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import declarative_base

from app.memory.models import Base


class ExperienceLog(Base):
    __tablename__ = "experience_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)
    session_id = Column(String(128), nullable=False, index=True, default="default")
    user_query = Column(Text, nullable=False)
    agent_response = Column(Text, nullable=False)
    tool_used = Column(String(128), nullable=True, index=True)
    tool_input = Column(JSONB, nullable=False, default=dict)
    tool_result = Column(JSONB, nullable=False, default=dict)
    success = Column(Boolean, nullable=False, default=True, index=True)
    latency_ms = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)


class PatternCluster(Base):
    __tablename__ = "pattern_clusters"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)
    session_id = Column(String(128), nullable=True, index=True)
    title = Column(String(256), nullable=False)
    category = Column(String(64), nullable=False, default="general", index=True)
    description = Column(Text, nullable=False)
    frequency = Column(Integer, nullable=False, default=1)
    failure_rate = Column(Float, nullable=False, default=0.0)
    sample_queries = Column(JSONB, nullable=False, default=list)
    suggested_tool_name = Column(String(128), nullable=True)
    status = Column(String(32), nullable=False, default="detected", index=True)  # detected, proposed, synthesized, active
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)


class SkillProposal(Base):
    __tablename__ = "skill_proposals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)
    cluster_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    name = Column(String(128), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=False)
    language = Column(String(32), nullable=False, default="python")
    code = Column(Text, nullable=False)
    input_schema = Column(JSONB, nullable=False, default=dict)
    output_schema = Column(JSONB, nullable=False, default=dict)
    confidence_score = Column(Float, nullable=False, default=0.85)
    status = Column(String(32), nullable=False, default="proposed", index=True)  # proposed, verified, loaded, disabled
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


# --- Pydantic Schemas ---

class ExperienceLogCreate(BaseModel):
    session_id: str = Field(default="default", description="Session partition identifier")
    user_query: str = Field(..., min_length=1, description="User question or prompt")
    agent_response: str = Field(..., description="Agent final response")
    tool_used: Optional[str] = Field(default=None, description="Name of tool used if any")
    tool_input: Dict[str, Any] = Field(default_factory=dict, description="Input parameters passed to tool")
    tool_result: Dict[str, Any] = Field(default_factory=dict, description="Output payload or error from tool")
    success: bool = Field(default=True, description="Whether interaction or tool execution succeeded")
    latency_ms: float = Field(default=0.0, description="Latency of execution in milliseconds")


class ExperienceLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: Optional[uuid.UUID] = None
    session_id: str
    user_query: str
    agent_response: str
    tool_used: Optional[str] = None
    tool_input: Dict[str, Any]
    tool_result: Dict[str, Any]
    success: bool
    latency_ms: float
    created_at: datetime


class PatternClusterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: Optional[uuid.UUID] = None
    session_id: Optional[str] = None
    title: str
    category: str
    description: str
    frequency: int
    failure_rate: float
    sample_queries: List[str]
    suggested_tool_name: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime


class MinePatternsRequest(BaseModel):
    session_id: Optional[str] = Field(default=None, description="Optional session filter")
    min_frequency: int = Field(default=2, ge=1, description="Minimum occurrences to constitute a pattern")
    lookback_limit: int = Field(default=100, ge=1, le=1000, description="Number of recent logs to scan")


class SkillGenerateRequest(BaseModel):
    pattern_id: Optional[uuid.UUID] = Field(default=None, description="Optional pattern cluster ID to synthesize from")
    tool_name: Optional[str] = Field(default=None, description="Explicit tool name override")
    description: Optional[str] = Field(default=None, description="Description of desired tool capability")
    sample_queries: Optional[List[str]] = Field(default=None, description="Representative user queries")


class SkillProposalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: Optional[uuid.UUID] = None
    cluster_id: Optional[uuid.UUID] = None
    name: str
    description: str
    language: str
    code: str
    input_schema: Dict[str, Any]
    output_schema: Dict[str, Any]
    confidence_score: float
    status: str
    created_at: datetime
