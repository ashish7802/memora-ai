import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from sqlalchemy import and_, delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.memory.models import MemoryRecord


class PgVectorStore:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def add(
        self,
        text: str,
        embedding: List[float],
        session_id: str = "default",
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        cluster: str = "general",
        importance: float = 1.0,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> MemoryRecord:
        record = MemoryRecord(
            id=uuid.uuid4(),
            text=text,
            embedding=embedding,
            session_id=session_id,
            user_id=user_id,
            agent_id=agent_id,
            cluster=cluster,
            importance=importance,
            access_count=0.0,
            metadata_=metadata or {},
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            last_accessed_at=datetime.now(timezone.utc),
        )
        self.session.add(record)
        await self.session.commit()
        await self.session.refresh(record)
        return record

    async def search(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        session_id: Optional[str] = None,
        cluster: Optional[str] = None,
        user_id: Optional[str] = None,
        threshold: Optional[float] = None,
    ) -> List[Tuple[MemoryRecord, float, float]]:
        """
        Performs cosine distance search using pgvector (<=> operator).
        Returns list of tuples: (MemoryRecord, cosine_distance, similarity_score)
        """
        distance_col = MemoryRecord.embedding.cosine_distance(query_embedding).label("distance")

        filters = []
        if session_id:
            filters.append(MemoryRecord.session_id == session_id)
        if cluster:
            filters.append(MemoryRecord.cluster == cluster)
        if user_id:
            filters.append(MemoryRecord.user_id == user_id)

        stmt = select(MemoryRecord, distance_col)
        if filters:
            stmt = stmt.where(and_(*filters))

        stmt = stmt.order_by(distance_col.asc()).limit(top_k)

        result = await self.session.execute(stmt)
        rows = result.all()

        max_thresh = threshold if threshold is not None else settings.DEFAULT_DISTANCE_THRESHOLD
        records_with_scores: List[Tuple[MemoryRecord, float, float]] = []

        now = datetime.now(timezone.utc)
        ids_to_touch = []

        for record, dist in rows:
            dist_val = float(dist)
            if dist_val <= max_thresh:
                # Cosine similarity roughly = 1 - distance
                similarity = max(0.0, min(1.0, 1.0 - (dist_val / 2.0)))
                records_with_scores.append((record, dist_val, similarity))
                ids_to_touch.append(record.id)

        # Update touch/access metrics
        if ids_to_touch:
            touch_stmt = (
                update(MemoryRecord)
                .where(MemoryRecord.id.in_(ids_to_touch))
                .values(
                    access_count=MemoryRecord.access_count + 1.0,
                    last_accessed_at=now,
                )
            )
            await self.session.execute(touch_stmt)
            await self.session.commit()

        return records_with_scores

    async def get_by_id(self, memory_id: uuid.UUID) -> Optional[MemoryRecord]:
        stmt = select(MemoryRecord).where(MemoryRecord.id == memory_id)
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def update(
        self,
        memory_id: uuid.UUID,
        text: Optional[str] = None,
        embedding: Optional[List[float]] = None,
        cluster: Optional[str] = None,
        importance: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[MemoryRecord]:
        record = await self.get_by_id(memory_id)
        if not record:
            return None

        if text is not None:
            record.text = text
        if embedding is not None:
            record.embedding = embedding
        if cluster is not None:
            record.cluster = cluster
        if importance is not None:
            record.importance = importance
        if metadata is not None:
            record.metadata_ = metadata

        record.updated_at = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(record)
        return record

    async def delete(self, memory_id: uuid.UUID) -> bool:
        stmt = delete(MemoryRecord).where(MemoryRecord.id == memory_id)
        result = await self.session.execute(stmt)
        await self.session.commit()
        return result.rowcount > 0

    async def prune(
        self,
        session_id: Optional[str] = None,
        older_than_days: Optional[int] = None,
        max_importance: Optional[float] = None,
        max_access_count: Optional[float] = None,
    ) -> int:
        filters = []
        if session_id:
            filters.append(MemoryRecord.session_id == session_id)
        if older_than_days is not None:
            cutoff = datetime.now(timezone.utc).timestamp() - (older_than_days * 86400)
            cutoff_dt = datetime.fromtimestamp(cutoff, tz=timezone.utc)
            filters.append(MemoryRecord.created_at <= cutoff_dt)
        if max_importance is not None:
            filters.append(MemoryRecord.importance <= max_importance)
        if max_access_count is not None:
            filters.append(MemoryRecord.access_count <= max_access_count)

        if not filters:
            return 0

        stmt = delete(MemoryRecord).where(and_(*filters))
        result = await self.session.execute(stmt)
        await self.session.commit()
        return result.rowcount
