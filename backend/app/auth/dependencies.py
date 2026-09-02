from fastapi import Depends, HTTPException, Request, Security, status
from fastapi.security.api_key import APIKeyHeader

from app.auth.models import APIKey, Tenant, User

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def get_current_user(request: Request) -> User:
    """Dependency that returns the authenticated User attached to the request state."""
    user = getattr(request.state, "current_user", None)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_current_tenant(request: Request) -> Tenant:
    """Dependency that returns the authenticated Tenant attached to the request state."""
    tenant = getattr(request.state, "current_tenant", None)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tenant not authenticated or tenant context missing.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return tenant


def get_current_api_key(request: Request) -> APIKey:
    """Dependency that returns the active APIKey instance used for authentication."""
    key = getattr(request.state, "api_key", None)
    if not key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API Key context missing.",
        )
    return key


def require_api_key(
    request: Request,
    _header: str = Security(api_key_header),
) -> APIKey:
    """Route dependency ensuring a valid API key was resolved by middleware."""
    return get_current_api_key(request)
