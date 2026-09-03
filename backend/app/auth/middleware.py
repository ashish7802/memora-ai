import hashlib
import secrets
from datetime import datetime, timezone
from typing import Optional, Tuple
from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.auth.models import APIKey, Tenant, User
from app.core.database import AsyncSessionLocal
from app.core.exceptions import create_error_response


def generate_api_key(prefix_str: str = "mm_") -> Tuple[str, str, str]:
    """Generates a secure API key, its display prefix, and SHA-256 hash.

    Format: mm_<32-byte-hex>
    """
    raw_token = secrets.token_hex(24)
    full_key = f"{prefix_str}{raw_token}"
    prefix = full_key[:8]
    key_hash = hashlib.sha256(full_key.encode("utf-8")).hexdigest()
    return full_key, prefix, key_hash


def hash_api_key(raw_key: str) -> str:
    """Computes SHA-256 hash of a raw API key."""
    return hashlib.sha256(raw_key.strip().encode("utf-8")).hexdigest()


class APIKeyAuthMiddleware(BaseHTTPMiddleware):
    """Intercepts requests, extracts API key from X-API-Key or Authorization Bearer header,

    validates active status and tenant association, and attaches user & tenant to request.state.
    """

    PUBLIC_PATHS = {
        "/healthz",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/v1/docs",
        "/v1/openapi.json",
        "/v1/auth/register",
    }

    async def dispatch(self, request: Request, call_next):
        # Allow OPTIONS preflight and public endpoints without auth
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        if any(path == public_path or path.startswith(f"{public_path}/") for public_path in self.PUBLIC_PATHS):
            return await call_next(request)

        # 1. Extract API Key
        raw_key: Optional[str] = request.headers.get("X-API-Key")
        if not raw_key:
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                raw_key = auth_header[7:].strip()

        if not raw_key:
            return create_error_response(
                status_code=status.HTTP_401_UNAUTHORIZED,
                code="API_KEY_REQUIRED",
                message="API Key missing. Provide 'X-API-Key' or 'Authorization: Bearer <api_key>' header.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # 2. Compute hash and validate against PostgreSQL
        key_hash = hash_api_key(raw_key)

        async with AsyncSessionLocal() as session:
            stmt = (
                select(APIKey)
                .options(selectinload(APIKey.user).selectinload(User.tenant))
                .where(APIKey.key_hash == key_hash)
            )
            result = await session.execute(stmt)
            api_key_record = result.scalars().first()

            if not api_key_record:
                return create_error_response(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    code="INVALID_API_KEY",
                    message="Invalid API key provided.",
                )

            if not api_key_record.is_active:
                return create_error_response(
                    status_code=status.HTTP_403_FORBIDDEN,
                    code="API_KEY_INACTIVE",
                    message="API key has been revoked or is inactive.",
                )

            # Check expiration
            if api_key_record.expires_at:
                now_utc = datetime.now(timezone.utc)
                if api_key_record.expires_at < now_utc:
                    return create_error_response(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        code="API_KEY_EXPIRED",
                        message="API key has expired.",
                    )

            # Update last_used timestamp asynchronously
            api_key_record.last_used = datetime.now(timezone.utc)
            await session.commit()

            # Attach context to request.state
            request.state.current_user = api_key_record.user
            request.state.current_tenant = api_key_record.user.tenant
            request.state.api_key = api_key_record

        return await call_next(request)
