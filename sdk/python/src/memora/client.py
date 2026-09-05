from datetime import datetime
from typing import Any, Dict, List, Optional, Union
import uuid
import httpx

from memora.exceptions import (
    MemoraAPIError,
    MemoraAuthError,
    MemoraConnectionError,
    MemoraError,
    MemoraNotFoundError,
    MemoraRateLimitError,
)
from memora.models import (
    AuditLogEntry,
    Memory,
    MemoryCreate,
    MemoryDeleteResult,
    MemoryForgetResult,
    MemoryPruneResult,
    MemorySearchQuery,
    MemorySearchResult,
    MemoryUpdate,
)


class BaseClient:
    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        api_key: Optional[str] = None,
        timeout: float = 30.0,
        headers: Optional[Dict[str, str]] = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self._custom_headers = headers or {}

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "memora-python-sdk/0.2.0",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
            headers["X-API-Key"] = self.api_key
        headers.update(self._custom_headers)
        return headers

    def _handle_response(self, response: httpx.Response) -> Any:
        if response.is_success:
            return response.json()

        error_code = None
        error_message = response.text
        try:
            err_json = response.json()
            if isinstance(err_json, dict) and "error" in err_json:
                error_code = err_json["error"].get("code")
                error_message = err_json["error"].get("message", response.text)
            elif isinstance(err_json, dict) and "detail" in err_json:
                error_message = str(err_json["detail"])
        except Exception:
            pass

        if response.status_code in (401, 403):
            raise MemoraAuthError(
                message=error_message,
                status_code=response.status_code,
                code=error_code or "AUTH_ERROR",
                response_body=response.text,
            )
        if response.status_code == 404:
            raise MemoraNotFoundError(
                message=error_message,
                status_code=response.status_code,
                code=error_code or "NOT_FOUND",
                response_body=response.text,
            )
        if response.status_code == 429:
            retry_after = None
            if "Retry-After" in response.headers:
                try:
                    retry_after = int(response.headers["Retry-After"])
                except ValueError:
                    pass
            raise MemoraRateLimitError(
                message=error_message,
                status_code=429,
                retry_after=retry_after,
                response_body=response.text,
            )

        raise MemoraAPIError(
            message=f"HTTP {response.status_code} ({error_code or 'UNKNOWN'}): {error_message}",
            status_code=response.status_code,
            code=error_code,
            response_body=response.text,
        )


class Memora(BaseClient):
    """Synchronous client for Memora Vector Memory API."""

    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        api_key: Optional[str] = None,
        timeout: float = 30.0,
        headers: Optional[Dict[str, str]] = None,
    ):
        super().__init__(base_url=base_url, api_key=api_key, timeout=timeout, headers=headers)
        self._client = httpx.Client(
            base_url=self.base_url,
            headers=self._get_headers(),
            timeout=self.timeout,
        )

    def close(self):
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def remember(
        self,
        text: str,
        session_id: str = "default",
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        cluster: str = "general",
        memory_type: str = "context",
        importance: float = 1.0,
        confidence: float = 0.9,
        metadata: Optional[Dict[str, Any]] = None,
        valid_from: Optional[datetime] = None,
        valid_until: Optional[datetime] = None,
        legal_basis: Optional[str] = None,
        retention_policy: Optional[str] = None,
    ) -> Memory:
        """Store an auditable memory item in vector memory."""
        payload = MemoryCreate(
            text=text,
            session_id=session_id,
            user_id=user_id,
            agent_id=agent_id,
            cluster=cluster,
            memory_type=memory_type,
            importance=importance,
            confidence=confidence,
            metadata=metadata or {},
            valid_from=valid_from,
            valid_until=valid_until,
            legal_basis=legal_basis,
            retention_policy=retention_policy,
        )
        try:
            resp = self._client.post("/v1/memory", json=payload.model_dump(mode="json"))
            data = self._handle_response(resp)
            return Memory.model_validate(data)
        except httpx.RequestError as e:
            raise MemoraConnectionError(f"Connection failed: {str(e)}") from e

    def recall(
        self,
        query: str,
        session_id: Optional[str] = None,
        cluster: Optional[str] = None,
        user_id: Optional[str] = None,
        memory_type: Optional[str] = None,
        status: Optional[str] = "active",
        top_k: int = 5,
        threshold: Optional[float] = None,
        as_of: Optional[datetime] = None,
    ) -> List[Memory]:
        """Perform explainable semantic recall."""
        payload = MemorySearchQuery(
            query=query,
            session_id=session_id,
            cluster=cluster,
            user_id=user_id,
            memory_type=memory_type,
            status=status,
            top_k=top_k,
            threshold=threshold,
            as_of=as_of,
        )
        try:
            resp = self._client.post("/v1/memory/search", json=payload.model_dump(mode="json"))
            data = self._handle_response(resp)
            result = MemorySearchResult.model_validate(data)
            return result.data
        except httpx.RequestError as e:
            raise MemoraConnectionError(f"Connection failed: {str(e)}") from e

    def forget(
        self,
        id: Union[str, uuid.UUID],
        mode: str = "soft",
        reason: str = "user_command",
    ) -> MemoryForgetResult:
        """Verifiable forget on command (soft tombstone or cryptographic hard purge)."""
        uid = uuid.UUID(str(id)) if isinstance(id, str) else id
        try:
            resp = self._client.post(
                f"/v1/memory/{uid}/forget",
                json={"mode": mode, "reason": reason},
            )
            data = self._handle_response(resp)
            return MemoryForgetResult.model_validate(data)
        except httpx.RequestError as e:
            raise MemoraConnectionError(f"Connection failed: {str(e)}") from e

    def delete(self, id: Union[str, uuid.UUID]) -> MemoryDeleteResult:
        """Permanently delete a memory item."""
        uid = uuid.UUID(str(id)) if isinstance(id, str) else id
        try:
            resp = self._client.delete(f"/v1/memory/{uid}")
            data = self._handle_response(resp)
            return MemoryDeleteResult.model_validate(data)
        except httpx.RequestError as e:
            raise MemoraConnectionError(f"Connection failed: {str(e)}") from e

    def update(
        self,
        id: Union[str, uuid.UUID],
        text: Optional[str] = None,
        cluster: Optional[str] = None,
        memory_type: Optional[str] = None,
        status: Optional[str] = None,
        importance: Optional[float] = None,
        confidence: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None,
        valid_until: Optional[datetime] = None,
    ) -> Memory:
        """Update an existing memory item."""
        uid = uuid.UUID(str(id)) if isinstance(id, str) else id
        payload = MemoryUpdate(
            id=uid,
            text=text,
            cluster=cluster,
            memory_type=memory_type,
            status=status,
            importance=importance,
            confidence=confidence,
            metadata=metadata,
            valid_until=valid_until,
        )
        try:
            resp = self._client.put(f"/v1/memory/{uid}", json=payload.model_dump(mode="json"))
            data = self._handle_response(resp)
            return Memory.model_validate(data)
        except httpx.RequestError as e:
            raise MemoraConnectionError(f"Connection failed: {str(e)}") from e

    def prune(
        self,
        session_id: Optional[str] = None,
        older_than_days: Optional[int] = None,
        max_importance: Optional[float] = None,
        max_access_count: Optional[float] = None,
    ) -> MemoryPruneResult:
        """Bulk prune stale memories."""
        payload = {
            "session_id": session_id,
            "older_than_days": older_than_days,
            "max_importance": max_importance,
            "max_access_count": max_access_count,
        }
        try:
            resp = self._client.post("/v1/memory/prune", json=payload)
            data = self._handle_response(resp)
            return MemoryPruneResult.model_validate(data)
        except httpx.RequestError as e:
            raise MemoraConnectionError(f"Connection failed: {str(e)}") from e

    def get_audit_logs(
        self,
        target_id: Optional[str] = None,
        limit: int = 50,
    ) -> List[AuditLogEntry]:
        """Fetch tenant audit logs."""
        params = {"limit": limit}
        if target_id:
            params["target_id"] = target_id
        try:
            resp = self._client.get("/v1/memory/audit", params=params)
            data = self._handle_response(resp)
            return [AuditLogEntry.model_validate(item) for item in data.get("data", [])]
        except httpx.RequestError as e:
            raise MemoraConnectionError(f"Connection failed: {str(e)}") from e

    def get_stats(self) -> Dict[str, Any]:
        """Retrieve live tenant memory metrics."""
        try:
            resp = self._client.get("/v1/stats")
            return self._handle_response(resp)
        except httpx.RequestError as e:
            raise MemoraConnectionError(f"Connection failed: {str(e)}") from e

    # Aliases
    add = remember
    search = recall


class AsyncMemora(BaseClient):
    """Asynchronous client for Memora Vector Memory API."""

    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        api_key: Optional[str] = None,
        timeout: float = 30.0,
        headers: Optional[Dict[str, str]] = None,
    ):
        super().__init__(base_url=base_url, api_key=api_key, timeout=timeout, headers=headers)
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers=self._get_headers(),
            timeout=self.timeout,
        )

    async def close(self):
        await self._client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    async def remember(
        self,
        text: str,
        session_id: str = "default",
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        cluster: str = "general",
        memory_type: str = "context",
        importance: float = 1.0,
        confidence: float = 0.9,
        metadata: Optional[Dict[str, Any]] = None,
        valid_from: Optional[datetime] = None,
        valid_until: Optional[datetime] = None,
        legal_basis: Optional[str] = None,
        retention_policy: Optional[str] = None,
    ) -> Memory:
        payload = MemoryCreate(
            text=text,
            session_id=session_id,
            user_id=user_id,
            agent_id=agent_id,
            cluster=cluster,
            memory_type=memory_type,
            importance=importance,
            confidence=confidence,
            metadata=metadata or {},
            valid_from=valid_from,
            valid_until=valid_until,
            legal_basis=legal_basis,
            retention_policy=retention_policy,
        )
        try:
            resp = await self._client.post("/v1/memory", json=payload.model_dump(mode="json"))
            data = self._handle_response(resp)
            return Memory.model_validate(data)
        except httpx.RequestError as e:
            raise MemoraConnectionError(f"Connection failed: {str(e)}") from e

    async def recall(
        self,
        query: str,
        session_id: Optional[str] = None,
        cluster: Optional[str] = None,
        user_id: Optional[str] = None,
        memory_type: Optional[str] = None,
        status: Optional[str] = "active",
        top_k: int = 5,
        threshold: Optional[float] = None,
        as_of: Optional[datetime] = None,
    ) -> List[Memory]:
        payload = MemorySearchQuery(
            query=query,
            session_id=session_id,
            cluster=cluster,
            user_id=user_id,
            memory_type=memory_type,
            status=status,
            top_k=top_k,
            threshold=threshold,
            as_of=as_of,
        )
        try:
            resp = await self._client.post("/v1/memory/search", json=payload.model_dump(mode="json"))
            data = self._handle_response(resp)
            result = MemorySearchResult.model_validate(data)
            return result.data
        except httpx.RequestError as e:
            raise MemoraConnectionError(f"Connection failed: {str(e)}") from e

    async def forget(
        self,
        id: Union[str, uuid.UUID],
        mode: str = "soft",
        reason: str = "user_command",
    ) -> MemoryForgetResult:
        uid = uuid.UUID(str(id)) if isinstance(id, str) else id
        try:
            resp = await self._client.post(
                f"/v1/memory/{uid}/forget",
                json={"mode": mode, "reason": reason},
            )
            data = self._handle_response(resp)
            return MemoryForgetResult.model_validate(data)
        except httpx.RequestError as e:
            raise MemoraConnectionError(f"Connection failed: {str(e)}") from e

    async def delete(self, id: Union[str, uuid.UUID]) -> MemoryDeleteResult:
        uid = uuid.UUID(str(id)) if isinstance(id, str) else id
        try:
            resp = await self._client.delete(f"/v1/memory/{uid}")
            data = self._handle_response(resp)
            return MemoryDeleteResult.model_validate(data)
        except httpx.RequestError as e:
            raise MemoraConnectionError(f"Connection failed: {str(e)}") from e

    async def update(
        self,
        id: Union[str, uuid.UUID],
        text: Optional[str] = None,
        cluster: Optional[str] = None,
        memory_type: Optional[str] = None,
        status: Optional[str] = None,
        importance: Optional[float] = None,
        confidence: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None,
        valid_until: Optional[datetime] = None,
    ) -> Memory:
        uid = uuid.UUID(str(id)) if isinstance(id, str) else id
        payload = MemoryUpdate(
            id=uid,
            text=text,
            cluster=cluster,
            memory_type=memory_type,
            status=status,
            importance=importance,
            confidence=confidence,
            metadata=metadata,
            valid_until=valid_until,
        )
        try:
            resp = await self._client.put(f"/v1/memory/{uid}", json=payload.model_dump(mode="json"))
            data = self._handle_response(resp)
            return Memory.model_validate(data)
        except httpx.RequestError as e:
            raise MemoraConnectionError(f"Connection failed: {str(e)}") from e

    async def prune(
        self,
        session_id: Optional[str] = None,
        older_than_days: Optional[int] = None,
        max_importance: Optional[float] = None,
        max_access_count: Optional[float] = None,
    ) -> MemoryPruneResult:
        payload = {
            "session_id": session_id,
            "older_than_days": older_than_days,
            "max_importance": max_importance,
            "max_access_count": max_access_count,
        }
        try:
            resp = await self._client.post("/v1/memory/prune", json=payload)
            data = self._handle_response(resp)
            return MemoryPruneResult.model_validate(data)
        except httpx.RequestError as e:
            raise MemoraConnectionError(f"Connection failed: {str(e)}") from e

    async def get_audit_logs(
        self,
        target_id: Optional[str] = None,
        limit: int = 50,
    ) -> List[AuditLogEntry]:
        params = {"limit": limit}
        if target_id:
            params["target_id"] = target_id
        try:
            resp = await self._client.get("/v1/memory/audit", params=params)
            data = self._handle_response(resp)
            return [AuditLogEntry.model_validate(item) for item in data.get("data", [])]
        except httpx.RequestError as e:
            raise MemoraConnectionError(f"Connection failed: {str(e)}") from e

    async def get_stats(self) -> Dict[str, Any]:
        try:
            resp = await self._client.get("/v1/stats")
            return self._handle_response(resp)
        except httpx.RequestError as e:
            raise MemoraConnectionError(f"Connection failed: {str(e)}") from e

    # Aliases
    add = remember
    search = recall


# Class Aliases
MemoraClient = Memora
AsyncMemoraClient = AsyncMemora
