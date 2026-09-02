import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, update

from app.core.database import get_db
from app.auth.models import (
    APIKey,
    APIKeyCreatedResponse,
    APIKeyCreateRequest,
    APIKeyResponse,
    RegisterResponse,
    Tenant,
    TenantResponse,
    User,
    UserRegisterRequest,
    UserResponse,
)
from app.auth.middleware import generate_api_key, hash_api_key
from app.auth.dependencies import get_current_user, get_current_tenant

router = APIRouter(prefix="/auth", tags=["Authentication & Multi-Tenant Access"])


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register new user & tenant, and generate initial API key",
)
async def register_user(
    payload: UserRegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Public registration endpoint that sets up an isolated Tenant, User,

    and initial API key.
    """
    # 1. Check if user email already exists
    existing_user_stmt = select(User).where(User.email == payload.email)
    existing_user_res = await db.execute(existing_user_stmt)
    if existing_user_res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email '{payload.email}' already exists.",
        )

    # 2. Create or find Tenant
    tenant_name = payload.tenant_name or f"{payload.name}'s Workspace"
    tenant_stmt = select(Tenant).where(Tenant.name == tenant_name)
    tenant_res = await db.execute(tenant_stmt)
    tenant = tenant_res.scalars().first()

    if not tenant:
        tenant = Tenant(
            id=uuid.uuid4(),
            name=tenant_name,
        )
        db.add(tenant)
        await db.flush()

    # 3. Create User attached to Tenant
    user = User(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        email=payload.email,
        name=payload.name,
    )
    db.add(user)
    await db.flush()

    # 4. Generate first API Key
    raw_key, prefix, key_hash = generate_api_key()
    api_key_record = APIKey(
        id=uuid.uuid4(),
        user_id=user.id,
        tenant_id=tenant.id,
        name=payload.key_name or "Initial Key",
        key_hash=key_hash,
        prefix=prefix,
        is_active=True,
    )
    db.add(api_key_record)
    await db.commit()
    await db.refresh(tenant)
    await db.refresh(user)
    await db.refresh(api_key_record)

    return RegisterResponse(
        user=UserResponse.model_validate(user),
        tenant=TenantResponse.model_validate(tenant),
        api_key=APIKeyCreatedResponse(
            id=api_key_record.id,
            user_id=api_key_record.user_id,
            tenant_id=api_key_record.tenant_id,
            name=api_key_record.name,
            prefix=api_key_record.prefix,
            created_at=api_key_record.created_at,
            last_used=api_key_record.last_used,
            expires_at=api_key_record.expires_at,
            is_active=api_key_record.is_active,
            raw_api_key=raw_key,
        ),
    )


@router.post(
    "/api-keys",
    response_model=APIKeyCreatedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a new API key for the authenticated user",
)
async def create_api_key(
    payload: APIKeyCreateRequest,
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Generates a new API key scoped to the caller's tenant and user profile."""
    raw_key, prefix, key_hash = generate_api_key()

    expires_at = None
    if payload.expires_in_days:
        from datetime import timedelta
        expires_at = datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days)

    api_key_record = APIKey(
        id=uuid.uuid4(),
        user_id=current_user.id,
        tenant_id=current_tenant.id,
        name=payload.name,
        key_hash=key_hash,
        prefix=prefix,
        expires_at=expires_at,
        is_active=True,
    )
    db.add(api_key_record)
    await db.commit()
    await db.refresh(api_key_record)

    return APIKeyCreatedResponse(
        id=api_key_record.id,
        user_id=api_key_record.user_id,
        tenant_id=api_key_record.tenant_id,
        name=api_key_record.name,
        prefix=api_key_record.prefix,
        created_at=api_key_record.created_at,
        last_used=api_key_record.last_used,
        expires_at=api_key_record.expires_at,
        is_active=api_key_record.is_active,
        raw_api_key=raw_key,
    )


@router.get(
    "/api-keys",
    response_model=List[APIKeyResponse],
    summary="List all API keys for the authenticated user",
)
async def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lists all active and revoked API keys belonging to the current authenticated user."""
    stmt = (
        select(APIKey)
        .where(APIKey.user_id == current_user.id)
        .order_by(desc(APIKey.created_at))
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.delete(
    "/api-keys/{key_id}",
    status_code=status.HTTP_200_OK,
    summary="Revoke an API key",
)
async def revoke_api_key(
    key_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deactivates/revokes an API key belonging to the authenticated user."""
    stmt = select(APIKey).where(
        APIKey.id == key_id,
        APIKey.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    api_key_record = result.scalars().first()

    if not api_key_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API Key not found or does not belong to the current user.",
        )

    api_key_record.is_active = False
    await db.commit()

    return {
        "status": "revoked",
        "key_id": str(key_id),
        "message": f"API key '{api_key_record.name}' ({api_key_record.prefix}...) has been revoked.",
    }
