import json
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import asyncpg

from memora.core.models import GraphLink, GraphNode, GraphResponse, MemoryItem, SearchResult


class VectorStore(ABC):
    """Abstract Vector Store base interface defining async storage operations."""

    @abstractmethod
    async def add(
        self,
        text: str,
        embedding: List[float],
        metadata: Optional[Dict[str, Any]] = None,
        memory_id: Optional[uuid.UUID] = None,
    ) -> MemoryItem:
        """Persists a new memory item with its vector embedding."""
        pass

    @abstractmethod
    async def search(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        threshold: float = 0.0,
    ) -> List[SearchResult]:
        """Performs cosine vector search bounded by top_k and minimum similarity threshold."""
        pass

    @abstractmethod
    async def get(self, memory_id: uuid.UUID) -> Optional[MemoryItem]:
        """Retrieves a single memory item by UUID."""
        pass

    @abstractmethod
    async def list_all(self, limit: int = 50, offset: int = 0) -> List[MemoryItem]:
        """Lists persisted memories with limit and offset pagination."""
        pass

    @abstractmethod
    async def get_graph(self, min_similarity: float = 0.3, limit: int = 200) -> Dict[str, Any]:
        """Computes server-side semantic topology graph using pairwise cosine similarity."""
        pass

    @abstractmethod
    async def update(
        self,
        memory_id: uuid.UUID,
        text: Optional[str] = None,
        embedding: Optional[List[float]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        decay_score: Optional[float] = None,
    ) -> Optional[MemoryItem]:
        """Updates attributes of an existing memory item."""
        pass

    @abstractmethod
    async def delete(self, memory_id: uuid.UUID) -> bool:
        """Removes a memory item from persistent storage."""
        pass

    @abstractmethod
    async def prune(self, threshold: float = 0.2) -> int:
        """Prunes low-relevance memories whose decay score falls below the threshold."""
        pass


class PgVectorStore(VectorStore):
    """Production-grade PostgreSQL + pgvector asynchronous vector store powered by asyncpg."""

    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool

    async def add(
        self,
        text: str,
        embedding: List[float],
        metadata: Optional[Dict[str, Any]] = None,
        memory_id: Optional[uuid.UUID] = None,
    ) -> MemoryItem:
        mem_id = memory_id or uuid.uuid4()
        now = datetime.now(timezone.utc)
        meta_json = json.dumps(metadata or {})

        query = """
            INSERT INTO memories (id, text, embedding, metadata, created_at, updated_at, decay_score)
            VALUES ($1, $2, $3, $4::jsonb, $5, $5, 1.0)
            RETURNING id, text, metadata, created_at, updated_at, decay_score;
        """

        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query,
                mem_id,
                text,
                embedding,
                meta_json,
                now,
            )

        return MemoryItem(
            id=row["id"],
            text=row["text"],
            embedding=embedding,
            metadata=json.loads(row["metadata"]) if isinstance(row["metadata"], str) else row["metadata"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            decay_score=row["decay_score"],
        )

    async def search(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        threshold: float = 0.0,
    ) -> List[SearchResult]:
        # pgvector cosine distance operator is `<=>`. Cosine similarity = 1 - distance.
        query = """
            SELECT 
                id, 
                text, 
                metadata, 
                created_at,
                decay_score,
                (1 - (embedding <=> $1)) AS similarity_score
            FROM memories
            WHERE (1 - (embedding <=> $1)) >= $2
            ORDER BY embedding <=> $1 ASC
            LIMIT $3;
        """

        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, query_embedding, threshold, top_k)

        results: List[SearchResult] = []
        for r in rows:
            meta = json.loads(r["metadata"]) if isinstance(r["metadata"], str) else r["metadata"]
            results.append(
                SearchResult(
                    id=r["id"],
                    text=r["text"],
                    metadata=meta or {},
                    score=float(r["similarity_score"]),
                    created_at=r["created_at"],
                    decay_score=r["decay_score"],
                )
            )
        return results

    async def get(self, memory_id: uuid.UUID) -> Optional[MemoryItem]:
        query = """
            SELECT id, text, metadata, created_at, updated_at, decay_score
            FROM memories
            WHERE id = $1;
        """
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query, memory_id)

        if not row:
            return None

        meta = json.loads(row["metadata"]) if isinstance(row["metadata"], str) else row["metadata"]
        return MemoryItem(
            id=row["id"],
            text=row["text"],
            metadata=meta or {},
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            decay_score=row["decay_score"],
        )

    async def list_all(self, limit: int = 50, offset: int = 0) -> List[MemoryItem]:
        query = """
            SELECT id, text, metadata, created_at, updated_at, decay_score
            FROM memories
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2;
        """
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, limit, offset)

        items: List[MemoryItem] = []
        for r in rows:
            meta = json.loads(r["metadata"]) if isinstance(r["metadata"], str) else r["metadata"]
            items.append(
                MemoryItem(
                    id=r["id"],
                    text=r["text"],
                    metadata=meta or {},
                    created_at=r["created_at"],
                    updated_at=r["updated_at"],
                    decay_score=r["decay_score"],
                )
            )
        return items

    async def get_graph(self, min_similarity: float = 0.3, limit: int = 200) -> Dict[str, Any]:
        """Computes server-side semantic topology graph using pairwise cosine similarity on latest limit memories."""
        nodes_query = """
            SELECT id, text, metadata, created_at
            FROM memories
            ORDER BY created_at DESC
            LIMIT $1;
        """

        links_query = """
            WITH recent AS (
                SELECT id, embedding
                FROM memories
                ORDER BY created_at DESC
                LIMIT $1
            )
            SELECT 
                a.id::text AS source,
                b.id::text AS target,
                (1 - (a.embedding <=> b.embedding)) AS similarity
            FROM recent a
            JOIN recent b ON a.id > b.id
            WHERE (1 - (a.embedding <=> b.embedding)) >= $2;
        """

        async with self.pool.acquire() as conn:
            node_rows = await conn.fetch(nodes_query, limit)
            link_rows = await conn.fetch(links_query, limit, min_similarity)

        degrees: Dict[str, int] = {}
        links: List[Dict[str, Any]] = []

        for lr in link_rows:
            src = str(lr["source"])
            tgt = str(lr["target"])
            sim = round(float(lr["similarity"]), 4)
            dist = round(max(0.01, 1.0 - sim), 4)

            degrees[src] = degrees.get(src, 0) + 1
            degrees[tgt] = degrees.get(tgt, 0) + 1

            links.append({
                "source": src,
                "target": tgt,
                "similarity": sim,
                "distance": dist,
            })

        categories_set = set()
        nodes: List[Dict[str, Any]] = []

        for nr in node_rows:
            nid = str(nr["id"])
            meta = json.loads(nr["metadata"]) if isinstance(nr["metadata"], str) else (nr["metadata"] or {})
            category = meta.get("category", "General") if isinstance(meta, dict) else "General"
            categories_set.add(category)

            nodes.append({
                "id": nid,
                "text": nr["text"],
                "category": category,
                "source": meta.get("source", "MemoraStore") if isinstance(meta, dict) else "MemoraStore",
                "timestamp": nr["created_at"].isoformat() if nr["created_at"] else None,
                "degree": degrees.get(nid, 0),
            })

        return {
            "nodes": nodes,
            "links": links,
            "categories": sorted(list(categories_set)),
        }

    async def update(
        self,
        memory_id: uuid.UUID,
        text: Optional[str] = None,
        embedding: Optional[List[float]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        decay_score: Optional[float] = None,
    ) -> Optional[MemoryItem]:
        current = await self.get(memory_id)
        if not current:
            return None

        now = datetime.now(timezone.utc)
        meta_json = json.dumps(metadata) if metadata is not None else None

        query = """
            UPDATE memories
            SET 
                text = COALESCE($2, text),
                embedding = CASE WHEN $3::real[] IS NOT NULL THEN $3::vector ELSE embedding END,
                metadata = CASE WHEN $4::jsonb IS NOT NULL THEN $4::jsonb ELSE metadata END,
                decay_score = COALESCE($5, decay_score),
                updated_at = $6
            WHERE id = $1
            RETURNING id, text, metadata, created_at, updated_at, decay_score;
        """

        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                query,
                memory_id,
                text,
                embedding,
                meta_json,
                decay_score,
                now,
            )

        if not row:
            return None

        meta = json.loads(row["metadata"]) if isinstance(row["metadata"], str) else row["metadata"]
        return MemoryItem(
            id=row["id"],
            text=row["text"],
            embedding=embedding,
            metadata=meta or {},
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            decay_score=row["decay_score"],
        )

    async def delete(self, memory_id: uuid.UUID) -> bool:
        query = "DELETE FROM memories WHERE id = $1 RETURNING id;"
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query, memory_id)
        return row is not None

    async def prune(self, threshold: float = 0.2) -> int:
        query = "DELETE FROM memories WHERE decay_score < $1 RETURNING id;"
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, threshold)
        return len(rows)
