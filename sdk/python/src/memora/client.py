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
    Memory,
    MemoryCreate,
    MemoryDeleteResult,
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
            "User-Agent": "memora-python-sdk/0.1.0",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
            headers["X-API-Key"] = self.api_key
        headers.update(self._custom_headers)
        return headers

    def _handle_response(self, response: httpx.Response) -> Any:
        if response.is_success:
            return response.json()

        # Parse standardized error JSON if available: {"error": {"code": "...", "message": "..."}}
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

    # Core Wedge Methods
    def remember(
        self,
        text: str,
        session_id: str = "default",
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        cluster: str = "general",
        importance: float = 1.0,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Memory:
        """Store a memory item in vector memory."""
        payload = MemoryCreate(
            text=text,
            session_id=session_id,
            user_id=user_id,
            agent_id=agent_id,
            cluster=cluster,
            importance=importance,
            metadata=metadata or {},
        )
        try:
            resp = self._client.post("/v1/memory/add", json=payload.model_dump())
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
        top_k: int = 5,
        threshold: Optional[float] = None,
    ) -> List[Memory]:
        """Perform semantic associative vector search."""
        payload = MemorySearchQuery(
            query=query,
            session_id=session_id,
            cluster=cluster,
            user_id=user_id,
            top_k=top_k,
            threshold=threshold,
        )
        try:
            resp = self._client.post("/v1/memory/search", json=payload.model_dump())
            data = self._handle_response(resp)
            result = MemorySearchResult.model_validate(data)
            return result.data
        except httpx.RequestError as e:
            raise MemoraConnectionError(f"Connection failed: {str(e)}") from e

    def forget(self, id: Union[str, uuid.UUID]) -> MemoryDeleteResult:
        """Delete a memory item by UUID."""
        uid = uuid.UUID(str(id)) if isinstance(id, str) else id
        try:
            resp = self._client.request("DELETE", "/v1/memory/delete", json={"id": str(uid)})
            data = self._handle_response(resp)
            return MemoryDeleteResult.model_validate(data)
        except httpx.RequestError as e:
            raise MemoraConnectionError(f"Connection failed: {str(e)}") from e

    def update(
        self,
        id: Union[str, uuid.UUID],
        text: Optional[str] = None,
        cluster: Optional[str] = None,
        importance: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> Memory:
        """Update an existing memory item."""
        uid = uuid.UUID(str(id)) if isinstance(id, str) else id
        payload = MemoryUpdate(
            id=uid,
            text=text or kwargs.get("text"),
            cluster=cluster or kwargs.get("cluster"),
            importance=importance if importance is not None else kwargs.get("importance"),
            metadata=metadata if metadata is not None else kwargs.get("metadata"),
        )
        try:
            resp = self._client.put("/v1/memory/update", json=payload.model_dump(mode="json"))
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
        **kwargs: Any,
    ) -> MemoryPruneResult:
        """Bulk prune stale memories."""
        payload = {
            "session_id": session_id or kwargs.get("session_id"),
            "older_than_days": older_than_days if older_than_days is not None else kwargs.get("older_than_days"),
            "max_importance": max_importance if max_importance is not None else kwargs.get("max_importance"),
            "max_access_count": max_access_count if max_access_count is not None else kwargs.get("max_access_count"),
        }
        try:
            resp = self._client.post("/v1/memory/prune", json=payload)
            data = self._handle_response(resp)
            return MemoryPruneResult.model_validate(data)
        except httpx.RequestError as e:
            raise MemoraConnectionError(f"Connection failed: {str(e)}") from e

    # Aliases
    add = remember
    search = recall
    delete = forget


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
        importance: float = 1.0,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Memory:
        """Store a memory item in vector memory asynchronously."""
        payload = MemoryCreate(
            text=text,
            session_id=session_id,
            user_id=user_id,
            agent_id=agent_id,
            cluster=cluster,
            importance=importance,
            metadata=metadata or {},
        )
        try:
            resp = await self._client.post("/v1/memory/add", json=payload.model_dump())
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
        top_k: int = 5,
        threshold: Optional[float] = None,
    ) -> List[Memory]:
        """Perform semantic associative vector search asynchronously."""
        payload = MemorySearchQuery(
            query=query,
            session_id=session_id,
            cluster=cluster,
            user_id=user_id,
            top_k=top_k,
            threshold=threshold,
        )
        try:
            resp = await self._client.post("/v1/memory/search", json=payload.model_dump())
            data = self._handle_response(resp)
            result = MemorySearchResult.model_validate(data)
            return result.data
        except httpx.RequestError as e:
            raise MemoraConnectionError(f"Connection failed: {str(e)}") from e

    async def forget(self, id: Union[str, uuid.UUID]) -> MemoryDeleteResult:
        """Delete a memory item by UUID asynchronously."""
        uid = uuid.UUID(str(id)) if isinstance(id, str) else id
        try:
            resp = await self._client.request("DELETE", "/v1/memory/delete", json={"id": str(uid)})
            data = self._handle_response(resp)
            return MemoryDeleteResult.model_validate(data)
        except httpx.RequestError as e:
            raise MemoraConnectionError(f"Connection failed: {str(e)}") from e

    async def update(
        self,
        id: Union[str, uuid.UUID],
        text: Optional[str] = None,
        cluster: Optional[str] = None,
        importance: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> Memory:
        """Update an existing memory item asynchronously."""
        uid = uuid.UUID(str(id)) if isinstance(id, str) else id
        payload = MemoryUpdate(
            id=uid,
            text=text or kwargs.get("text"),
            cluster=cluster or kwargs.get("cluster"),
            importance=importance if importance is not None else kwargs.get("importance"),
            metadata=metadata if metadata is not None else kwargs.get("metadata"),
        )
        try:
            resp = await self._client.put("/v1/memory/update", json=payload.model_dump(mode="json"))
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
        **kwargs: Any,
    ) -> MemoryPruneResult:
        """Bulk prune stale memories asynchronously."""
        payload = {
            "session_id": session_id or kwargs.get("session_id"),
            "older_than_days": older_than_days if older_than_days is not None else kwargs.get("older_than_days"),
            "max_importance": max_importance if max_importance is not None else kwargs.get("max_importance"),
            "max_access_count": max_access_count if max_access_count is not None else kwargs.get("max_access_count"),
        }
        try:
            resp = await self._client.post("/v1/memory/prune", json=payload)
            data = self._handle_response(resp)
            return MemoryPruneResult.model_validate(data)
        except httpx.RequestError as e:
            raise MemoraConnectionError(f"Connection failed: {str(e)}") from e

    # Aliases
    add = remember
    search = recall
    delete = forget


# Class Aliases for Client Naming Conventions
MemoraClient = Memora
AsyncMemoraClient = AsyncMemora
