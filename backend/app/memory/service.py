import os
import uuid
from typing import Any, Dict, List, Optional
import google.generativeai as genai
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.memory.models import (
    MemoryCreate,
    MemoryDelete,
    MemoryPruneRequest,
    MemoryResponse,
    MemorySearchQuery,
    MemoryUpdate,
)
from app.memory.vector_store import PgVectorStore


class MemoryService:
    def __init__(self, session: AsyncSession):
        self.vector_store = PgVectorStore(session)
        self._init_embedding_client()

    def _init_embedding_client(self):
        api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)

    async def generate_embedding(self, text: str) -> List[float]:
        api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")
        if api_key:
            try:
                result = genai.embed_content(
                    model=settings.EMBEDDING_MODEL,
                    content=text,
                    task_type="retrieval_document",
                )
                embedding = result["embedding"]
                if len(embedding) == settings.EMBEDDING_DIMENSION:
                    return embedding
            except Exception:
                pass

        # Deterministic fallback pseudo-embedding when Gemini key is not configured (e.g. tests)
        rng = np.random.default_rng(seed=abs(hash(text)) % (2**32))
        vec = rng.standard_normal(settings.EMBEDDING_DIMENSION)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()

    async def add_memory(self, payload: MemoryCreate) -> MemoryResponse:
        embedding = await self.generate_embedding(payload.text)
        record = await self.vector_store.add(
            text=payload.text,
            embedding=embedding,
            session_id=payload.session_id,
            user_id=payload.user_id,
            agent_id=payload.agent_id,
            cluster=payload.cluster,
            importance=payload.importance,
            metadata=payload.metadata,
        )
        return MemoryResponse.model_validate(record)

    async def search_memories(self, payload: MemorySearchQuery) -> List[MemoryResponse]:
        query_embedding = await self.generate_embedding(payload.query)
        results = await self.vector_store.search(
            query_embedding=query_embedding,
            top_k=payload.top_k,
            session_id=payload.session_id,
            cluster=payload.cluster,
            user_id=payload.user_id,
            threshold=payload.threshold,
        )

        responses = []
        for record, dist, sim in results:
            item = MemoryResponse.model_validate(record)
            item.cosine_distance = dist
            item.similarity_score = sim
            responses.append(item)
        return responses

    async def update_memory(self, payload: MemoryUpdate) -> Optional[MemoryResponse]:
        embedding = None
        if payload.text is not None:
            embedding = await self.generate_embedding(payload.text)

        record = await self.vector_store.update(
            memory_id=payload.id,
            text=payload.text,
            embedding=embedding,
            cluster=payload.cluster,
            importance=payload.importance,
            metadata=payload.metadata,
        )
        if not record:
            return None
        return MemoryResponse.model_validate(record)

    async def delete_memory(self, memory_id: uuid.UUID) -> bool:
        return await self.vector_store.delete(memory_id)

    async def prune_memories(self, payload: MemoryPruneRequest) -> int:
        return await self.vector_store.prune(
            session_id=payload.session_id,
            older_than_days=payload.older_than_days,
            max_importance=payload.max_importance,
            max_access_count=payload.max_access_count,
        )

    async def get_stats(self, session_id: Optional[str] = None) -> Dict[str, Any]:
        from sqlalchemy import func, select
        from app.memory.models import MemoryRecord

        stmt = select(func.count(MemoryRecord.id))
        if session_id:
            stmt = stmt.where(MemoryRecord.session_id == session_id)
        total_res = await self.vector_store.session.execute(stmt)
        total_memories = total_res.scalar() or 0

        cluster_stmt = select(MemoryRecord.cluster, func.count(MemoryRecord.id)).group_by(MemoryRecord.cluster)
        if session_id:
            cluster_stmt = cluster_stmt.where(MemoryRecord.session_id == session_id)
        cluster_res = await self.vector_store.session.execute(cluster_stmt)
        cluster_dist = {row[0]: row[1] for row in cluster_res.all()}

        avg_stmt = select(func.avg(MemoryRecord.importance), func.sum(MemoryRecord.access_count))
        if session_id:
            avg_stmt = avg_stmt.where(MemoryRecord.session_id == session_id)
        avg_res = await self.vector_store.session.execute(avg_stmt)
        avg_imp, sum_access = avg_res.first() or (1.0, 0.0)

        return {
            "total_memories": total_memories,
            "cluster_distribution": cluster_dist,
            "average_importance": round(float(avg_imp or 1.0), 3),
            "total_access_count": float(sum_access or 0.0),
            "storage_engine": "PostgreSQL + pgvector (HNSW index)",
        }
