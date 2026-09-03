from typing import Any, Dict, Optional
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    code: str = Field(..., description="Machine-readable error code string")
    message: str = Field(..., description="Human-readable explanation of error")


class ErrorResponse(BaseModel):
    error: ErrorDetail


def create_error_response(
    status_code: int,
    code: str,
    message: str,
    headers: Optional[Dict[str, str]] = None,
) -> JSONResponse:
    """Utility to return standard JSON error payload: {"error": {"code": "...", "message": "..."}}"""
    content = {
        "error": {
            "code": code,
            "message": message,
        }
    }
    return JSONResponse(status_code=status_code, content=content, headers=headers)


class AppException(Exception):
    """Base application exception returning consistent JSON error structure."""

    def __init__(
        self,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        code: str = "INTERNAL_SERVER_ERROR",
        message: str = "An unexpected error occurred",
        headers: Optional[Dict[str, str]] = None,
    ):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.headers = headers
        super().__init__(self.message)


class APIKeyRequiredException(AppException):
    def __init__(self, message: str = "API Key missing. Provide 'X-API-Key' or 'Authorization: Bearer <api_key>' header."):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="API_KEY_REQUIRED",
            message=message,
            headers={"WWW-Authenticate": "Bearer"},
        )


class InvalidAPIKeyException(AppException):
    def __init__(self, message: str = "Invalid API key provided."):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="INVALID_API_KEY",
            message=message,
        )


class APIKeyInactiveException(AppException):
    def __init__(self, message: str = "API key has been revoked or is inactive."):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            code="API_KEY_INACTIVE",
            message=message,
        )


class APIKeyExpiredException(AppException):
    def __init__(self, message: str = "API key has expired."):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="API_KEY_EXPIRED",
            message=message,
        )


class RateLimitExceededException(AppException):
    def __init__(
        self,
        message: str = "Rate limit exceeded. Maximum 100 requests per minute allowed.",
        retry_after: int = 60,
    ):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            code="RATE_LIMIT_EXCEEDED",
            message=message,
            headers={"Retry-After": str(retry_after)},
        )


class NotFoundException(AppException):
    def __init__(self, message: str = "Resource not found."):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            code="NOT_FOUND",
            message=message,
        )


class BadRequestException(AppException):
    def __init__(self, message: str = "Bad request parameters."):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="BAD_REQUEST",
            message=message,
        )


def register_exception_handlers(app: FastAPI) -> None:
    """Registers standard handlers formatting every exception into {"error": {"code": "...", "message": "..."}}."""

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        return create_error_response(
            status_code=exc.status_code,
            code=exc.code,
            message=exc.message,
            headers=exc.headers,
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        # Infer machine-readable code from status code or exc detail
        code_map = {
            400: "BAD_REQUEST",
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            409: "CONFLICT",
            422: "VALIDATION_ERROR",
            429: "RATE_LIMIT_EXCEEDED",
            500: "INTERNAL_SERVER_ERROR",
        }
        code = code_map.get(exc.status_code, f"HTTP_{exc.status_code}")
        message = str(exc.detail) if exc.detail else "An error occurred"
        return create_error_response(
            status_code=exc.status_code,
            code=code,
            message=message,
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        first_error = exc.errors()[0] if exc.errors() else {}
        field = ".".join(str(loc) for loc in first_error.get("loc", []))
        msg = first_error.get("msg", "Invalid request body")
        detail_msg = f"Validation error at '{field}': {msg}" if field else f"Validation error: {msg}"
        return create_error_response(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            code="VALIDATION_ERROR",
            message=detail_msg,
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        return create_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="INTERNAL_SERVER_ERROR",
            message=f"Internal server error: {str(exc)}",
        )
