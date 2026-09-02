from typing import Any, Dict, List, Optional, Union
import uuid
import httpx

from memora.exceptions import MemoraAPIError, MemoraConnectionError, MemoraNotFoundError
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
        if response.status_code == 404:
            raise MemoraNotFoundError(
                message=response.text,
                status_code=response.status_code,
                response_body=response.text,
            )
        raise MemoraAPIError(
            message=f"HTTP {response.status_code}: {response.text}",
            status_code=response.status_code,
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

    def add(
        self,
        text: str,
        session_id: str = "default",
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        cluster: str = "general",
        importance: float = 1.0,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Memory:
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

    def search(
        self,
        query: str,
        session_id: Optional[str] = None,
        cluster: Optional[str] = None,
        user_id: Optional[str] = None,
        top_k: int = 5,
        threshold: Optional[float] = None,
    ) -> List[Memory]:
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

    def update(
        self,
        id: Union[str, uuid.UUID],
        text: Optional[str] = None,
        cluster: Optional[str] = None,
        importance: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Memory:
        uid = uuid.UUID(str(id)) if isinstance(id, str) else id
        payload = MemoryUpdate(
            id=uid,
            text=text,
            cluster=cluster,
            importance=importance,
            metadata=metadata,
        )
        try:
            resp = self._client.put("/v1/memory/update", json=payload.model_dump(mode="json"))
            data = self._handle_response(resp)
            return Memory.model_validate(data)
        except httpx.RequestError as e:
            raise MemoraConnectionError(f"Connection failed: {str(e)}") from e

    def delete(self, id: Union[str, uuid.UUID]) -> MemoryDeleteResult:
        uid = uuid.UUID(str(id)) if isinstance(id, str) else id
        try:
            resp = self._client.request("DELETE", "/v1/memory/delete", json={"id": str(uid)})
            data = self._handle_response(resp)
            return MemoryDeleteResult.model_validate(data)
        except httpx.RequestError as e:
            raise MemoraConnectionError(f"Connection failed: {str(e)}") from e

    def prune(
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
            resp = self._client.post("/v1/memory/prune", json=payload)
            data = self._handle_response(resp)
            return MemoryPruneResult.model_validate(data)
        except httpx.RequestError as e:
            raise MemoraConnectionError(f"Connection failed: {str(e)}") from e


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

    async def add(
        self,
        text: str,
        session_id: str = "default",
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        cluster: str = "general",
        importance: float = 1.0,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Memory:
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

    async def search(
        self,
        query: str,
        session_id: Optional[str] = None,
        cluster: Optional[str] = None,
        user_id: Optional[str] = None,
        top_k: int = 5,
        threshold: Optional[float] = None,
    ) -> List[Memory]:
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

    async def update(
        self,
        id: Union[str, uuid.UUID],
        text: Optional[str] = None,
        cluster: Optional[str] = None,
        importance: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Memory:
        uid = uuid.UUID(str(id)) if isinstance(id, str) else id
        payload = MemoryUpdate(
            id=uid,
            text=text,
            cluster=cluster,
            importance=importance,
            metadata=metadata,
        )
        try:
            resp = await self._client.put("/v1/memory/update", json=payload.model_dump(mode="json"))
            data = self._handle_response(resp)
            return Memory.model_validate(data)
        except httpx.RequestError as e:
            raise MemoraConnectionError(f"Connection failed: {str(e)}") from e

    async def delete(self, id: Union[str, uuid.UUID]) -> MemoryDeleteResult:
        uid = uuid.UUID(str(id)) if isinstance(id, str) else id
        try:
            resp = await self._client.request("DELETE", "/v1/memory/delete", json={"id": str(uid)})
            data = self._handle_response(resp)
            return MemoryDeleteResult.model_validate(data)
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
