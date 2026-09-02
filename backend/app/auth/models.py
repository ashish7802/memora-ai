import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.memory import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    tenant = relationship("Tenant", back_populates="users")
    api_keys = relationship("APIKey", back_populates="user", cascade="all, delete-orphan")


class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(128), nullable=False, default="default")
    key_hash = Column(String(128), nullable=False, unique=True, index=True)
    prefix = Column(String(16), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    last_used = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)

    user = relationship("User", back_populates="api_keys")


# Pydantic Schemas

class TenantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    created_at: datetime


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    email: str
    name: str
    created_at: datetime


class UserRegisterRequest(BaseModel):
    email: EmailStr = Field(..., description="User email address")
    name: str = Field(..., min_length=1, description="User full name")
    tenant_name: Optional[str] = Field(default=None, description="Optional tenant or organization name")
    key_name: Optional[str] = Field(default="Initial API Key", description="Name label for first API key")


class APIKeyCreateRequest(BaseModel):
    name: str = Field(default="Default Key", min_length=1, max_length=128, description="API Key friendly name")
    expires_in_days: Optional[int] = Field(default=None, ge=1, le=365, description="Optional expiry in days")


class APIKeyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    prefix: str
    created_at: datetime
    last_used: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_active: bool


class APIKeyCreatedResponse(APIKeyResponse):
    raw_api_key: str = Field(..., description="The raw secret API key. Displayed ONLY once upon creation.")


class RegisterResponse(BaseModel):
    user: UserResponse
    tenant: TenantResponse
    api_key: APIKeyCreatedResponse
