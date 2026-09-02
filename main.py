from contextlib import asynccontextmanager
from typing import Any, Dict
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.monitoring import MetricsCollector, get_logger, setup_logging
from app.monitoring.middleware import MetricsMiddleware

logger = get_logger("main")
metrics_collector = MetricsCollector()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize structured logging
    setup_logging(log_level="INFO", log_file="memora.log")
    logger.info("Memora Agent System started successfully with Production Logging & Monitoring.")
    yield
    # Shutdown
    logger.info("Memora Agent System shutting down.")


# Initialize FastAPI Application
app = FastAPI(
    title="Memora - Agent Memory & Skills Platform",
    description="Production-hardened Agent Memory, Experience Logger, Multi-Agent Swarm & Observability Layer.",
    version="1.0.0",
    lifespan=lifespan,
)

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add Metrics & Request Tracking Middleware
app.add_middleware(MetricsMiddleware, collector=metrics_collector)


@app.get("/healthz")
async def health_check() -> Dict[str, str]:
    """Health check probe."""
    return {"status": "healthy", "service": "memora-core"}


@app.get("/api/metrics")
async def get_metrics() -> Dict[str, Any]:
    """
    Returns real-time aggregated metrics, latency statistics,
    and agent telemetry recorded by MetricsCollector.
    """
    return metrics_collector.get_metrics()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
