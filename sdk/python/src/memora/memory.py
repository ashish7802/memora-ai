from typing import Any, Dict, List, Optional, Union
import uuid

from memora.client import AsyncMemora, Memora
from memora.models import Memory, MemoryDeleteResult, MemoryPruneResult


class MemoryManager:
    """High-level abstraction for stateful memory management with session scoping."""

    def __init__(
        self,
        client: Optional[Memora] = None,
        session_id: str = "default",
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        base_url: str = "http://localhost:8000",
        api_key: Optional[str] = None,
    ):
        self.client = client or Memora(base_url=base_url, api_key=api_key)
        self.session_id = session_id
        self.user_id = user_id
        self.agent_id = agent_id

    def remember(
        self,
        text: str,
        cluster: str = "general",
        importance: float = 1.0,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Memory:
        """Store a new memory under the current session context."""
        return self.client.add(
            text=text,
            session_id=self.session_id,
            user_id=self.user_id,
            agent_id=self.agent_id,
            cluster=cluster,
            importance=importance,
            metadata=metadata,
        )

    def recall(
        self,
        query: str,
        cluster: Optional[str] = None,
        top_k: int = 5,
        threshold: Optional[float] = None,
    ) -> List[Memory]:
        """Perform semantic search bounded to the current session."""
        return self.client.search(
            query=query,
            session_id=self.session_id,
            cluster=cluster,
            user_id=self.user_id,
            top_k=top_k,
            threshold=threshold,
        )

    def forget(self, id: Union[str, uuid.UUID]) -> MemoryDeleteResult:
        """Delete a memory item by ID."""
        return self.client.delete(id=id)

    def edit(
        self,
        id: Union[str, uuid.UUID],
        text: Optional[str] = None,
        cluster: Optional[str] = None,
        importance: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Memory:
        """Update an existing memory item."""
        return self.client.update(
            id=id,
            text=text,
            cluster=cluster,
            importance=importance,
            metadata=metadata,
        )

    def clean(
        self,
        older_than_days: Optional[int] = None,
        max_importance: Optional[float] = 1.0,
        max_access_count: Optional[float] = 0.0,
    ) -> MemoryPruneResult:
        """Prune stale memories inside current session."""
        return self.client.prune(
            session_id=self.session_id,
            older_than_days=older_than_days,
            max_importance=max_importance,
            max_access_count=max_access_count,
        )


class AsyncMemoryManager:
    """Asynchronous high-level abstraction for stateful memory management."""

    def __init__(
        self,
        client: Optional[AsyncMemora] = None,
        session_id: str = "default",
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        base_url: str = "http://localhost:8000",
        api_key: Optional[str] = None,
    ):
        self.client = client or AsyncMemora(base_url=base_url, api_key=api_key)
        self.session_id = session_id
        self.user_id = user_id
        self.agent_id = agent_id

    async def remember(
        self,
        text: str,
        cluster: str = "general",
        importance: float = 1.0,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Memory:
        return await self.client.add(
            text=text,
            session_id=self.session_id,
            user_id=self.user_id,
            agent_id=self.agent_id,
            cluster=cluster,
            importance=importance,
            metadata=metadata,
        )

    async def recall(
        self,
        query: str,
        cluster: Optional[str] = None,
        top_k: int = 5,
        threshold: Optional[float] = None,
    ) -> List[Memory]:
        return await self.client.search(
            query=query,
            session_id=self.session_id,
            cluster=cluster,
            user_id=self.user_id,
            top_k=top_k,
            threshold=threshold,
        )

    async def forget(self, id: Union[str, uuid.UUID]) -> MemoryDeleteResult:
        return await self.client.delete(id=id)

    async def edit(
        self,
        id: Union[str, uuid.UUID],
        text: Optional[str] = None,
        cluster: Optional[str] = None,
        importance: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Memory:
        return await self.client.update(
            id=id,
            text=text,
            cluster=cluster,
            importance=importance,
            metadata=metadata,
        )

    async def clean(
        self,
        older_than_days: Optional[int] = None,
        max_importance: Optional[float] = 1.0,
        max_access_count: Optional[float] = 0.0,
    ) -> MemoryPruneResult:
        return await self.client.prune(
            session_id=self.session_id,
            older_than_days=older_than_days,
            max_importance=max_importance,
            max_access_count=max_access_count,
        )
