import time
from collections import defaultdict
from typing import Dict, List, Optional
from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class InMemoryRateLimiter:
    """Sliding-window in-memory rate limiter tracking request timestamps per client/API key."""

    def __init__(self, requests_per_minute: int = 100, window_seconds: int = 60):
        self.requests_per_minute = requests_per_minute
        self.window_seconds = window_seconds
        self.request_history: Dict[str, List[float]] = defaultdict(list)
        self.last_cleanup = time.time()

    def _cleanup_stale(self, now: float) -> None:
        """Periodically removes entries older than 5 minutes to prevent memory leaks."""
        if now - self.last_cleanup < 120:
            return
        cutoff = now - self.window_seconds
        stale_keys = []
        for key, timestamps in self.request_history.items():
            valid_timestamps = [t for t in timestamps if t > cutoff]
            if valid_timestamps:
                self.request_history[key] = valid_timestamps
            else:
                stale_keys.append(key)
        for key in stale_keys:
            self.request_history.pop(key, None)
        self.last_cleanup = now

    def check_rate_limit(self, identifier: str) -> tuple[bool, int, int]:
        """Returns (is_allowed, remaining_requests, retry_after_seconds)."""
        now = time.time()
        self._cleanup_stale(now)

        cutoff = now - self.window_seconds
        # Keep only timestamps in active sliding window
        valid_timestamps = [t for t in self.request_history[identifier] if t > cutoff]
        self.request_history[identifier] = valid_timestamps

        count = len(valid_timestamps)
        if count >= self.requests_per_minute:
            oldest_in_window = valid_timestamps[0]
            retry_after = max(1, int(self.window_seconds - (now - oldest_in_window)))
            return False, 0, retry_after

        # Record this request
        valid_timestamps.append(now)
        remaining = self.requests_per_minute - len(valid_timestamps)
        return True, remaining, 0


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Enforces 100 requests/minute per API key (or client IP for public paths)."""

    def __init__(self, app, requests_per_minute: int = 100, window_seconds: int = 60):
        super().__init__(app)
        self.limiter = InMemoryRateLimiter(
            requests_per_minute=requests_per_minute,
            window_seconds=window_seconds,
        )

    def _get_client_identifier(self, request: Request) -> str:
        # Prioritize authenticated API key from state, header, or fall back to client IP
        if hasattr(request.state, "api_key") and request.state.api_key:
            return f"key:{request.state.api_key.key_hash}"
        
        raw_key = request.headers.get("X-API-Key")
        if not raw_key:
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                raw_key = auth_header[7:].strip()
        
        if raw_key:
            return f"key_raw:{raw_key[:16]}"

        # Fallback to client host IP
        client_ip = request.client.host if request.client else "unknown"
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        return f"ip:{client_ip}"

    async def dispatch(self, request: Request, call_next):
        # Allow OPTIONS preflight requests
        if request.method == "OPTIONS":
            return await call_next(request)

        identifier = self._get_client_identifier(request)
        is_allowed, remaining, retry_after = self.limiter.check_rate_limit(identifier)

        if not is_allowed:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": {
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": f"Rate limit exceeded. Maximum {self.limiter.requests_per_minute} requests per minute allowed.",
                    }
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(self.limiter.requests_per_minute),
                    "X-RateLimit-Remaining": "0",
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.limiter.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
