from typing import Optional, Dict, Any


class MemoraError(Exception):
    """Base exception for all Memora SDK errors."""
    pass


class MemoraAPIError(MemoraError):
    """Raised when the Memora API returns an error response."""
    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        code: Optional[str] = None,
        response_body: Optional[Any] = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.response_body = response_body


class MemoraAuthError(MemoraAPIError):
    """Raised on 401/403 authentication and API key errors."""
    pass


class MemoraRateLimitError(MemoraAPIError):
    """Raised on 429 rate limit exceeded."""
    def __init__(
        self,
        message: str = "Rate limit exceeded",
        status_code: int = 429,
        retry_after: Optional[int] = None,
        response_body: Optional[Any] = None,
    ):
        super().__init__(message=message, status_code=status_code, code="RATE_LIMIT_EXCEEDED", response_body=response_body)
        self.retry_after = retry_after


class MemoraNotFoundError(MemoraAPIError):
    """Raised when a specific memory entity or resource is not found (404)."""
    pass


class MemoraConnectionError(MemoraError):
    """Raised when unable to connect to the Memora server or request times out."""
    pass
