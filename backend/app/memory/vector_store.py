import hashlib
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import and_, delete, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.memory.models import (
    AuditLogRecord,
    MemoryRecord,
    MemoryStatus,
    MemoryType,
    SourceType,
)


class PgVectorStore:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def add(
        self,
        tenant_id: uuid.UUID,
        text: str,
        embedding: List[float],
        session_id: str = "default",
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        cluster: str = "general",
        memory_type: str = MemoryType.CONTEXT.value,
        importance: float = 1.0,
        confidence: float = 0.9,
        source_type: str = SourceType.USER_PROMPT.value,
        source_id: Optional[str] = None,
        document_id: Optional[str] = None,
        message_id: Optional[str] = None,
        valid_from: Optional[datetime] = None,
        valid_until: Optional[datetime] = None,
        metadata: Optional[Dict[str, Any]] = None,
        legal_basis: Optional[str] = None,
        retention_policy: Optional[str] = None,
        created_by: Optional[str] = None,
        embedding_provider: str = "gemini",
        embedding_model: str = "text-embedding-004",
        embedding_dim: int = 768,
    ) -> MemoryRecord:
        now = datetime.now(timezone.utc)
        record_id = uuid.uuid4()

        record = MemoryRecord(
            id=record_id,
            tenant_id=tenant_id,
            text=text,
            embedding=embedding,
            session_id=session_id,
            user_id=user_id,
            agent_id=agent_id,
            cluster=cluster,
            memory_type=memory_type,
            status=MemoryStatus.ACTIVE.value,
            importance=importance,
            confidence=confidence,
            access_count=0.0,
            recall_count=0,
            source_type=source_type,
            source_id=source_id,
            document_id=document_id,
            message_id=message_id,
            valid_from=valid_from or now,
            valid_until=valid_until,
            metadata_=metadata or {},
            legal_basis=legal_basis,
            retention_policy=retention_policy,
            created_by=created_by,
            embedding_provider=embedding_provider,
            embedding_model=embedding_model,
            embedding_dim=embedding_dim,
            created_at=now,
            updated_at=now,
            last_accessed_at=now,
        )
        self.session.add(record)

        # Audit Log: Record creation
        audit = AuditLogRecord(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            target_type="memory",
            target_id=str(record_id),
            action="created",
            actor_type=created_by or "user",
            actor_id=user_id or agent_id,
            reason="Memory ingested",
            metadata_={
                "cluster": cluster,
                "memory_type": memory_type,
                "embedding_provider": embedding_provider,
            },
            timestamp=now,
        )
        self.session.add(audit)

        await self.session.commit()
        await self.session.refresh(record)
        return record

    async def search(
        self,
        tenant_id: uuid.UUID,
        query_embedding: List[float],
        top_k: int = 5,
        session_id: Optional[str] = None,
        cluster: Optional[str] = None,
        user_id: Optional[str] = None,
        memory_type: Optional[str] = None,
        status: Optional[str] = MemoryStatus.ACTIVE.value,
        threshold: Optional[float] = None,
        as_of: Optional[datetime] = None,
    ) -> List[Tuple[MemoryRecord, float, float]]:
        """Performs tenant-isolated cosine distance search using pgvector (<=> operator).

        Returns list of tuples: (MemoryRecord, cosine_distance, similarity_score)
        """
        distance_col = MemoryRecord.embedding.cosine_distance(query_embedding).label("distance")

        # Tenant isolation is non-negotiable
        filters = [MemoryRecord.tenant_id == tenant_id]

        # Status filter: Exclude forgotten/purged memories unless explicitly asked
        if status:
            filters.append(MemoryRecord.status == status)
        else:
            filters.append(MemoryRecord.status != MemoryStatus.FORGOTTEN.value)

        if session_id:
            filters.append(MemoryRecord.session_id == session_id)
        if cluster:
            filters.append(MemoryRecord.cluster == cluster)
        if user_id:
            filters.append(MemoryRecord.user_id == user_id)
        if memory_type:
            filters.append(MemoryRecord.memory_type == memory_type)

        # Temporal validity filter: valid_from <= as_of AND (valid_until IS NULL OR valid_until > as_of)
        eval_time = as_of or datetime.now(timezone.utc)
        filters.append(MemoryRecord.valid_from <= eval_time)
        filters.append(
            or_(
                MemoryRecord.valid_until.is_(None),
                MemoryRecord.valid_until > eval_time,
            )
        )

        stmt = select(MemoryRecord, distance_col).where(and_(*filters))
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
                # Cosine similarity roughly = 1 - (dist / 2) for normalized vectors
                similarity = max(0.0, min(1.0, 1.0 - (dist_val / 2.0)))
                records_with_scores.append((record, dist_val, similarity))
                ids_to_touch.append(record.id)

        # Audit Log: Record recall and touch access counters
        if ids_to_touch:
            touch_stmt = (
                update(MemoryRecord)
                .where(and_(MemoryRecord.tenant_id == tenant_id, MemoryRecord.id.in_(ids_to_touch)))
                .values(
                    access_count=MemoryRecord.access_count + 1.0,
                    recall_count=MemoryRecord.recall_count + 1,
                    last_accessed_at=now,
                    last_recalled_at=now,
                )
            )
            await self.session.execute(touch_stmt)

            for rec_id in ids_to_touch:
                audit = AuditLogRecord(
                    id=uuid.uuid4(),
                    tenant_id=tenant_id,
                    target_type="memory",
                    target_id=str(rec_id),
                    action="recalled",
                    actor_type="system",
                    reason="Semantic recall query match",
                    metadata_={"threshold": max_thresh},
                    timestamp=now,
                )
                self.session.add(audit)

            await self.session.commit()

        return records_with_scores

    async def get_by_id(self, tenant_id: uuid.UUID, memory_id: uuid.UUID) -> Optional[MemoryRecord]:
        stmt = select(MemoryRecord).where(
            and_(MemoryRecord.tenant_id == tenant_id, MemoryRecord.id == memory_id)
        )
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def list_memories(
        self,
        tenant_id: uuid.UUID,
        session_id: Optional[str] = None,
        cluster: Optional[str] = None,
        status: str = MemoryStatus.ACTIVE.value,
        limit: int = 50,
        offset: int = 0,
    ) -> List[MemoryRecord]:
        filters = [MemoryRecord.tenant_id == tenant_id]
        if status:
            filters.append(MemoryRecord.status == status)
        if session_id:
            filters.append(MemoryRecord.session_id == session_id)
        if cluster:
            filters.append(MemoryRecord.cluster == cluster)

        stmt = (
            select(MemoryRecord)
            .where(and_(*filters))
            .order_by(MemoryRecord.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        res = await self.session.execute(stmt)
        return list(res.scalars().all())

    async def update(
        self,
        tenant_id: uuid.UUID,
        memory_id: uuid.UUID,
        text: Optional[str] = None,
        embedding: Optional[List[float]] = None,
        cluster: Optional[str] = None,
        memory_type: Optional[str] = None,
        status: Optional[str] = None,
        importance: Optional[float] = None,
        confidence: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None,
        valid_until: Optional[datetime] = None,
        updated_by: Optional[str] = None,
    ) -> Optional[MemoryRecord]:
        record = await self.get_by_id(tenant_id, memory_id)
        if not record:
            return None

        now = datetime.now(timezone.utc)
        if text is not None:
            record.text = text
        if embedding is not None:
            record.embedding = embedding
        if cluster is not None:
            record.cluster = cluster
        if memory_type is not None:
            record.memory_type = memory_type
        if status is not None:
            record.status = status
        if importance is not None:
            record.importance = importance
        if confidence is not None:
            record.confidence = confidence
        if metadata is not None:
            record.metadata_ = metadata
        if valid_until is not None:
            record.valid_until = valid_until
        if updated_by is not None:
            record.updated_by = updated_by

        record.updated_at = now

        # Audit Log: Record update
        audit = AuditLogRecord(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            target_type="memory",
            target_id=str(memory_id),
            action="updated",
            actor_type="user",
            actor_id=updated_by,
            reason="Memory content or attributes updated",
            metadata_={"text_changed": text is not None},
            timestamp=now,
        )
        self.session.add(audit)

        await self.session.commit()
        await self.session.refresh(record)
        return record

    async def soft_forget(
        self,
        tenant_id: uuid.UUID,
        memory_id: uuid.UUID,
        reason: str = "user_command",
        actor_id: Optional[str] = None,
    ) -> Tuple[Optional[MemoryRecord], uuid.UUID]:
        """Soft delete: Sets status='forgotten' and records timestamp.

        Excluded from search & graph immediately. Retains tombstone in audit log.
        """
        record = await self.get_by_id(tenant_id, memory_id)
        if not record:
            return None, uuid.uuid4()

        now = datetime.now(timezone.utc)
        record.status = MemoryStatus.FORGOTTEN.value
        record.forgotten_at = now
        record.updated_at = now

        audit_id = uuid.uuid4()
        audit = AuditLogRecord(
            id=audit_id,
            tenant_id=tenant_id,
            target_type="memory",
            target_id=str(memory_id),
            action="forgotten",
            actor_type="user",
            actor_id=actor_id,
            reason=reason,
            metadata_={"mode": "soft", "previous_status": "active"},
            timestamp=now,
        )
        self.session.add(audit)

        await self.session.commit()
        await self.session.refresh(record)
        return record, audit_id

    async def hard_purge(
        self,
        tenant_id: uuid.UUID,
        memory_id: uuid.UUID,
        reason: str = "user_purge_command",
        actor_id: Optional[str] = None,
    ) -> Tuple[bool, uuid.UUID, str]:
        """Hard purge: Permanently deletes text and embedding from DB.

        Returns (success, audit_log_id, cryptographic_proof_of_deletion).
        """
        record = await self.get_by_id(tenant_id, memory_id)
        if not record:
            return False, uuid.uuid4(), ""

        now = datetime.now(timezone.utc)
        audit_id = uuid.uuid4()

        # Generate cryptographic proof of deletion: SHA-256(memory_id + tenant_id + timestamp + audit_id)
        proof_payload = f"{memory_id}:{tenant_id}:{now.isoformat()}:{audit_id}"
        deletion_proof = hashlib.sha256(proof_payload.encode("utf-8")).hexdigest()

        # Delete the memory row permanently
        stmt = delete(MemoryRecord).where(
            and_(MemoryRecord.tenant_id == tenant_id, MemoryRecord.id == memory_id)
        )
        await self.session.execute(stmt)

        # Retain non-reversible audit log entry
        audit = AuditLogRecord(
            id=audit_id,
            tenant_id=tenant_id,
            target_type="memory",
            target_id=str(memory_id),
            action="purged",
            actor_type="user",
            actor_id=actor_id,
            reason=reason,
            metadata_={
                "mode": "hard",
                "deletion_proof": deletion_proof,
                "purged_at": now.isoformat(),
            },
            timestamp=now,
        )
        self.session.add(audit)

        await self.session.commit()
        return True, audit_id, deletion_proof

    async def delete(self, tenant_id: uuid.UUID, memory_id: uuid.UUID) -> bool:
        success, _, _ = await self.hard_purge(tenant_id, memory_id)
        return success

    async def prune(
        self,
        tenant_id: uuid.UUID,
        session_id: Optional[str] = None,
        older_than_days: Optional[int] = None,
        max_importance: Optional[float] = None,
        max_access_count: Optional[float] = None,
    ) -> int:
        filters = [MemoryRecord.tenant_id == tenant_id]
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

        stmt = delete(MemoryRecord).where(and_(*filters))
        result = await self.session.execute(stmt)
        await self.session.commit()
        return result.rowcount

    async def get_audit_logs(
        self,
        tenant_id: uuid.UUID,
        target_id: Optional[str] = None,
        limit: int = 50,
    ) -> List[AuditLogRecord]:
        filters = [AuditLogRecord.tenant_id == tenant_id]
        if target_id:
            filters.append(AuditLogRecord.target_id == target_id)

        stmt = (
            select(AuditLogRecord)
            .where(and_(*filters))
            .order_by(AuditLogRecord.timestamp.desc())
            .limit(limit)
        )
        res = await self.session.execute(stmt)
        return list(res.scalars().all())

    async def get_stats(self, tenant_id: uuid.UUID) -> Dict[str, Any]:
        """Calculates real, live statistics strictly scoped to the tenant."""
        from sqlalchemy import func

        stmt = select(
            func.count(MemoryRecord.id).label("total_memories"),
            func.count(MemoryRecord.id).filter(MemoryRecord.status == MemoryStatus.ACTIVE.value).label("active_memories"),
            func.count(MemoryRecord.id).filter(MemoryRecord.status == MemoryStatus.FORGOTTEN.value).label("forgotten_memories"),
            func.coalesce(func.sum(MemoryRecord.recall_count), 0).label("total_recalls"),
        ).where(MemoryRecord.tenant_id == tenant_id)

        res = await self.session.execute(stmt)
        row = res.one()

        # Audit logs count
        audit_stmt = select(func.count(AuditLogRecord.id)).where(AuditLogRecord.tenant_id == tenant_id)
        audit_res = await self.session.execute(audit_stmt)
        audit_count = audit_res.scalar_one()

        return {
            "tenant_id": str(tenant_id),
            "total_memories": row.total_memories,
            "active_memories": row.active_memories,
            "forgotten_memories": row.forgotten_memories,
            "total_recalls": int(row.total_recalls),
            "audit_events_count": audit_count,
            "vector_dimension": 768,
        }
