import time
import uuid
from typing import Callable
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from .logger import get_logger
from .metrics import MetricsCollector

logger = get_logger("middleware")


class MetricsMiddleware(BaseHTTPMiddleware):
    """
    FastAPI / Starlette Middleware that intercepts all requests:
    - Injects unique X-Request-ID for distributed tracing.
    - Measures precise latency (ms).
    - Records request telemetry in MetricsCollector.
    - Logs structured request access logs.
    """

    def __init__(self, app, collector: MetricsCollector | None = None):
        super().__init__(app)
        self.collector = collector or MetricsCollector()

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate or capture existing request ID
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id

        start_time = time.perf_counter()
        status_code = 500

        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception as exc:
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            self.collector.record_request(
                endpoint=request.url.path,
                method=request.method,
                status_code=500,
                duration_ms=duration_ms,
            )
            logger.error(
                f"Unhandled Exception in request {request.method} {request.url.path}: {exc}",
                extra={"request_id": request_id, "extra_data": {"duration_ms": duration_ms}},
                exc_info=True,
            )
            raise exc

        duration_ms = (time.perf_counter() - start_time) * 1000.0

        # Record metric
        self.collector.record_request(
            endpoint=request.url.path,
            method=request.method,
            status_code=status_code,
            duration_ms=duration_ms,
        )

        # Append tracking header
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"

        # Structured access log
        logger.info(
            f"{request.method} {request.url.path} -> {status_code} ({duration_ms:.2f}ms)",
            extra={
                "request_id": request_id,
                "extra_data": {
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": status_code,
                    "duration_ms": round(duration_ms, 2),
                    "client_ip": request.client.host if request.client else "unknown",
                },
            },
        )

        return response
