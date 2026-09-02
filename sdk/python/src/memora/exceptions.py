from typing import Optional


class MemoraError(Exception):
    """Base exception for all Memora SDK errors."""
    pass


class MemoraAPIError(MemoraError):
    """Raised when the Memora API returns an error response."""
    def __init__(self, message: str, status_code: Optional[int] = None, response_body: Optional[str] = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body


class MemoraNotFoundError(MemoraAPIError):
    """Raised when a specific memory entity is not found."""
    pass


class MemoraConnectionError(MemoraError):
    """Raised when unable to connect to the Memora server."""
    pass
