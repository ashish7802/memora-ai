from fastapi import Depends, Request, Security
from fastapi.security.api_key import APIKeyHeader

from app.auth.models import APIKey, Tenant, User
from app.core.exceptions import APIKeyRequiredException, UnauthorizedException

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def get_current_user(request: Request) -> User:
    """Dependency that returns the authenticated User attached to the request state."""
    user = getattr(request.state, "current_user", None)
    if not user:
        raise APIKeyRequiredException("User not authenticated.")
    return user


def get_current_tenant(request: Request) -> Tenant:
    """Dependency that returns the authenticated Tenant attached to the request state."""
    tenant = getattr(request.state, "current_tenant", None)
    if not tenant:
        raise APIKeyRequiredException("Tenant context missing or unauthorized.")
    return tenant


def get_current_api_key(request: Request) -> APIKey:
    """Dependency that returns the active APIKey instance used for authentication."""
    key = getattr(request.state, "api_key", None)
    if not key:
        raise APIKeyRequiredException("API key context missing or unauthorized.")
    return key


def require_api_key(
    request: Request,
    _header: str = Security(api_key_header),
) -> APIKey:
    """Route dependency requiring a valid API key and returning the active APIKey record."""
    return get_current_api_key(request)
