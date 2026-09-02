import threading
import time
from collections import defaultdict
from typing import Any, Dict, List, Optional


class MetricsCollector:
    """
    In-memory metrics collector for Memora platform.
    Thread-safe implementation tracking HTTP requests, agent executions, and memory operations.
    """

    _instance: Optional["MetricsCollector"] = None
    _lock: threading.Lock = threading.Lock()

    def __new__(cls) -> "MetricsCollector":
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(MetricsCollector, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self) -> None:
        if getattr(self, "_initialized", False):
            return

        self._initialized = True
        self._start_time = time.time()
        self._op_lock = threading.Lock()

        # HTTP Requests
        self._request_latencies: List[float] = []
        self._requests_by_endpoint: Dict[str, int] = defaultdict(int)
        self._requests_by_status: Dict[int, int] = defaultdict(int)
        self._total_requests: int = 0
        self._total_errors: int = 0

        # Agent Calls
        self._agent_calls: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {"total": 0, "success": 0, "failure": 0, "latencies": []}
        )

        # Memory Operations (e.g. remember, recall, cluster, decay)
        self._memory_ops: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {"count": 0, "total_size_bytes": 0, "latencies": []}
        )

    def record_request(
        self,
        endpoint: str,
        method: str,
        status_code: int,
        duration_ms: float,
    ) -> None:
        """
        Record HTTP request metrics including latency, route, and status code.
        """
        with self._op_lock:
            self._total_requests += 1
            if status_code >= 400:
                self._total_errors += 1

            self._requests_by_endpoint[f"{method.upper()} {endpoint}"] += 1
            self._requests_by_status[status_code] += 1
            self._request_latencies.append(round(duration_ms, 2))

            # Keep sliding window for memory efficiency (last 10,000 latencies)
            if len(self._request_latencies) > 10000:
                self._request_latencies = self._request_latencies[-5000:]

    def record_agent_call(
        self,
        agent_name: str,
        success: bool,
        duration_ms: float,
    ) -> None:
        """
        Record telemetry from multi-agent swarm tasks (Hermes, workers, synthesis).
        """
        with self._op_lock:
            data = self._agent_calls[agent_name]
            data["total"] += 1
            if success:
                data["success"] += 1
            else:
                data["failure"] += 1

            data["latencies"].append(round(duration_ms, 2))
            if len(data["latencies"]) > 2000:
                data["latencies"] = data["latencies"][-1000:]

    def record_memory_operation(
        self,
        operation: str,
        size: int,
        duration_ms: float,
    ) -> None:
        """
        Record vector memory operations (e.g., store, recall, semantic search, pruning).
        """
        with self._op_lock:
            op_data = self._memory_ops[operation]
            op_data["count"] += 1
            op_data["total_size_bytes"] += size
            op_data["latencies"].append(round(duration_ms, 2))
            if len(op_data["latencies"]) > 2000:
                op_data["latencies"] = op_data["latencies"][-1000:]

    def get_metrics(self) -> Dict[str, Any]:
        """
        Calculates and returns aggregated metrics and platform statistics.
        """
        with self._op_lock:
            uptime_seconds = round(time.time() - self._start_time, 2)
            total_reqs = self._total_requests
            error_count = self._total_errors
            error_rate = round((error_count / total_reqs * 100), 2) if total_reqs > 0 else 0.0

            avg_latency = (
                round(sum(self._request_latencies) / len(self._request_latencies), 2)
                if self._request_latencies
                else 0.0
            )

            # Calculate p95 latency
            p95_latency = 0.0
            if self._request_latencies:
                sorted_lats = sorted(self._request_latencies)
                p95_idx = int(len(sorted_lats) * 0.95)
                p95_latency = sorted_lats[min(p95_idx, len(sorted_lats) - 1)]

            # Aggregate Agent Metrics
            agents_summary: Dict[str, Any] = {}
            for agent, info in self._agent_calls.items():
                lats = info["latencies"]
                avg_agent_lat = round(sum(lats) / len(lats), 2) if lats else 0.0
                success_rate = (
                    round((info["success"] / info["total"]) * 100, 2)
                    if info["total"] > 0
                    else 0.0
                )
                agents_summary[agent] = {
                    "total_calls": info["total"],
                    "success": info["success"],
                    "failure": info["failure"],
                    "success_rate_percent": success_rate,
                    "avg_duration_ms": avg_agent_lat,
                }

            # Aggregate Memory Ops Metrics
            memory_summary: Dict[str, Any] = {}
            for op, info in self._memory_ops.items():
                lats = info["latencies"]
                avg_op_lat = round(sum(lats) / len(lats), 2) if lats else 0.0
                memory_summary[op] = {
                    "total_operations": info["count"],
                    "total_size_bytes": info["total_size_bytes"],
                    "avg_duration_ms": avg_op_lat,
                }

            return {
                "uptime_seconds": uptime_seconds,
                "http_requests": {
                    "total": total_reqs,
                    "errors": error_count,
                    "error_rate_percent": error_rate,
                    "avg_latency_ms": avg_latency,
                    "p95_latency_ms": p95_latency,
                    "by_endpoint": dict(self._requests_by_endpoint),
                    "by_status_code": dict(self._requests_by_status),
                },
                "agent_metrics": agents_summary,
                "memory_operations": memory_summary,
            }
