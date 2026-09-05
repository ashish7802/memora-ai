import hashlib
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import google.generativeai as genai
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import set_tenant_context
from app.core.exceptions import AppException
from app.memory.models import (
    AuditLogRecord,
    ExplainableSearchResponse,
    MemoryCreate,
    MemoryForgetResponse,
    MemoryPruneRequest,
    MemoryRecord,
    MemoryResponse,
    MemorySearchQuery,
    MemoryStatus,
    MemoryUpdate,
    RankingBreakdown,
    SearchExplanation,
    SourceType,
)
from app.memory.vector_store import PgVectorStore


class MemoryService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.vector_store = PgVectorStore(session)
        self._init_embedding_client()

    def _init_embedding_client(self):
        api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)

    async def generate_embedding(self, text: str) -> Tuple[List[float], str, str]:
        """Generates embedding for text.

        Returns (embedding_vector, provider_name, model_name).

        Phase 5 Fail-Closed Rule:
        - In production mode, a real embedding provider is required. If unavailable or dim is invalid,
          fails closed immediately with an explicit 503 error.
        - In development/testing mode without API keys, generates deterministic vectors using SHA-256
          stable hashing (consistent across processes and machines).
        """
        api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")
        is_production = settings.ENVIRONMENT.lower() == "production"

        if api_key:
            try:
                result = genai.embed_content(
                    model=settings.EMBEDDING_MODEL,
                    content=text,
                    task_type="retrieval_document",
                )
                embedding = result.get("embedding")
                if embedding and len(embedding) == settings.EMBEDDING_DIMENSION:
                    return embedding, "gemini", settings.EMBEDDING_MODEL
                elif is_production:
                    raise AppException(
                        status_code=503,
                        code="EMBEDDING_DIMENSION_MISMATCH",
                        message=f"Gemini returned dimension {len(embedding) if embedding else 0}, expected {settings.EMBEDDING_DIMENSION}",
                    )
            except Exception as exc:
                if is_production:
                    raise AppException(
                        status_code=503,
                        code="EMBEDDING_PROVIDER_ERROR",
                        message=f"Production embedding provider failed: {str(exc)}",
                    )

        if is_production:
            raise AppException(
                status_code=503,
                code="EMBEDDING_PROVIDER_UNAVAILABLE",
                message="Production environment requires a valid GEMINI_API_KEY or configured embedding provider.",
            )

        # Development / Test Fallback: Deterministic embedding derived from SHA-256 of text
        # This guarantees stability across test runs, processes, and operating systems
        text_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
        seed = int(text_hash[:8], 16)
        rng = np.random.default_rng(seed=seed)
        vec = rng.standard_normal(settings.EMBEDDING_DIMENSION)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        else:
            vec[0] = 1.0

        return vec.tolist(), "deterministic_test", "sha256_rng_v1"

    async def add_memory(
        self,
        tenant_id: uuid.UUID,
        payload: MemoryCreate,
        created_by: Optional[str] = None,
    ) -> MemoryResponse:
        await set_tenant_context(self.session, tenant_id)

        embedding, provider, model = await self.generate_embedding(payload.text)

        # Phase 8: Conflict Detection against active memories in the same tenant & session
        conflict_warning: Optional[str] = None
        potential_conflicts = await self.vector_store.search(
            tenant_id=tenant_id,
            query_embedding=embedding,
            top_k=3,
            session_id=payload.session_id,
            threshold=0.15,  # Very high cosine distance threshold (high similarity >= 0.85)
        )

        for candidate, dist, sim in potential_conflicts:
            if sim >= 0.85:
                # Contradiction / Supersession heuristic: Same topic/cluster with competing statements
                candidate_text = candidate.text.lower()
                new_text = payload.text.lower()

                negation_terms = ["not", "no longer", "instead", "changed to", "moved from", "prefers", "updated"]
                has_negation = any(term in new_text for term in negation_terms) or (
                    candidate.cluster == payload.cluster and candidate.text != payload.text
                )

                if has_negation:
                    # Deprecate the superseded memory
                    candidate.status = MemoryStatus.DEPRECATED.value
                    candidate.updated_at = datetime.now(timezone.utc)
                    conflict_warning = f"Superseded prior conflicting memory {candidate.id} (similarity: {sim:.2f})"

                    # Record conflict in audit log
                    audit = AuditLogRecord(
                        id=uuid.uuid4(),
                        tenant_id=tenant_id,
                        target_type="memory",
                        target_id=str(candidate.id),
                        action="conflict_detected",
                        actor_type="system",
                        reason=f"New memory claims precedence over previous statement",
                        metadata_={
                            "similarity": sim,
                            "superseded_by_text": payload.text[:128],
                        },
                        timestamp=datetime.now(timezone.utc),
                    )
                    self.session.add(audit)
                    break

        prov = payload.provenance
        record = await self.vector_store.add(
            tenant_id=tenant_id,
            text=payload.text,
            embedding=embedding,
            session_id=payload.session_id,
            user_id=payload.user_id,
            agent_id=payload.agent_id,
            cluster=payload.cluster,
            memory_type=payload.memory_type,
            importance=payload.importance,
            confidence=payload.confidence,
            source_type=prov.source_type if prov else SourceType.USER_PROMPT.value,
            source_id=prov.source_id if prov else None,
            document_id=prov.document_id if prov else None,
            message_id=prov.message_id if prov else None,
            valid_from=payload.valid_from,
            valid_until=payload.valid_until,
            metadata=payload.metadata,
            legal_basis=payload.legal_basis,
            retention_policy=payload.retention_policy,
            created_by=created_by,
            embedding_provider=provider,
            embedding_model=model,
            embedding_dim=len(embedding),
        )

        resp = MemoryResponse.model_validate(record)
        resp.conflict_warning = conflict_warning
        return resp

    async def search_memories(
        self,
        tenant_id: uuid.UUID,
        payload: MemorySearchQuery,
    ) -> ExplainableSearchResponse:
        await set_tenant_context(self.session, tenant_id)

        query_embedding, provider, model = await self.generate_embedding(payload.query)

        raw_results = await self.vector_store.search(
            tenant_id=tenant_id,
            query_embedding=query_embedding,
            top_k=payload.top_k,
            session_id=payload.session_id,
            cluster=payload.cluster,
            user_id=payload.user_id,
            memory_type=payload.memory_type,
            status=payload.status,
            threshold=payload.threshold,
            as_of=payload.as_of,
        )

        now = datetime.now(timezone.utc)
        items: List[MemoryResponse] = []

        for record, dist, sim in raw_results:
            item = MemoryResponse.model_validate(record)
            item.cosine_distance = dist
            item.similarity_score = sim

            # Phase 6: Explainable ranking breakdown
            # Recency score: exponential decay over 30 days
            age_days = (now - record.created_at).total_seconds() / 86400.0
            recency_score = float(np.exp(-age_days / 30.0))
            importance_score = min(1.0, max(0.0, record.importance / 5.0))
            frequency_score = min(1.0, max(0.0, record.recall_count / 20.0))

            combined_score = (
                (0.65 * sim)
                + (0.15 * recency_score)
                + (0.10 * importance_score)
                + (0.10 * frequency_score)
            )

            item.ranking_breakdown = RankingBreakdown(
                vector_similarity=round(sim, 4),
                recency_score=round(recency_score, 4),
                importance_score=round(importance_score, 4),
                frequency_score=round(frequency_score, 4),
                combined_score=round(combined_score, 4),
            )
            items.append(item)

        # Sort by explainable combined ranking score
        items.sort(key=lambda x: (x.ranking_breakdown.combined_score if x.ranking_breakdown else 0.0), reverse=True)

        explanation = SearchExplanation(
            query=payload.query,
            top_k=payload.top_k,
            threshold=payload.threshold or settings.DEFAULT_DISTANCE_THRESHOLD,
            embedding_provider=provider,
            embedding_model=model,
            embedding_dimension=len(query_embedding),
            total_candidates_examined=len(raw_results),
            total_matches_returned=len(items),
            rejected_count=0,
            filter_summary={
                "session_id": payload.session_id,
                "cluster": payload.cluster,
                "status": payload.status,
                "as_of": payload.as_of.isoformat() if payload.as_of else None,
            },
        )

        return ExplainableSearchResponse(
            status="success",
            count=len(items),
            data=items,
            explanation=explanation,
        )

    async def list_memories(
        self,
        tenant_id: uuid.UUID,
        session_id: Optional[str] = None,
        cluster: Optional[str] = None,
        status: str = MemoryStatus.ACTIVE.value,
        limit: int = 50,
        offset: int = 0,
    ) -> List[MemoryResponse]:
        await set_tenant_context(self.session, tenant_id)
        records = await self.vector_store.list_memories(
            tenant_id=tenant_id,
            session_id=session_id,
            cluster=cluster,
            status=status,
            limit=limit,
            offset=offset,
        )
        return [MemoryResponse.model_validate(r) for r in records]

    async def get_memory(
        self,
        tenant_id: uuid.UUID,
        memory_id: uuid.UUID,
    ) -> Optional[MemoryResponse]:
        await set_tenant_context(self.session, tenant_id)
        record = await self.vector_store.get_by_id(tenant_id, memory_id)
        if not record:
            return None
        return MemoryResponse.model_validate(record)

    async def update_memory(
        self,
        tenant_id: uuid.UUID,
        payload: MemoryUpdate,
        updated_by: Optional[str] = None,
    ) -> Optional[MemoryResponse]:
        await set_tenant_context(self.session, tenant_id)

        embedding = None
        if payload.text is not None:
            emb, _, _ = await self.generate_embedding(payload.text)
            embedding = emb

        record = await self.vector_store.update(
            tenant_id=tenant_id,
            memory_id=payload.id,
            text=payload.text,
            embedding=embedding,
            cluster=payload.cluster,
            memory_type=payload.memory_type,
            status=payload.status,
            importance=payload.importance,
            confidence=payload.confidence,
            metadata=payload.metadata,
            valid_until=payload.valid_until,
            updated_by=updated_by,
        )
        if not record:
            return None
        return MemoryResponse.model_validate(record)

    async def forget_memory(
        self,
        tenant_id: uuid.UUID,
        memory_id: uuid.UUID,
        mode: str = "soft",
        reason: str = "user_command",
        actor_id: Optional[str] = None,
    ) -> MemoryForgetResponse:
        """Phase 7: Verifiable Forget on Command (Soft tombstone or cryptographic Hard purge)."""
        await set_tenant_context(self.session, tenant_id)

        if mode.lower() == "hard":
            success, audit_id, proof = await self.vector_store.hard_purge(
                tenant_id=tenant_id,
                memory_id=memory_id,
                reason=reason,
                actor_id=actor_id,
            )
            if not success:
                raise AppException(status_code=404, code="NOT_FOUND", message=f"Memory {memory_id} not found")
            return MemoryForgetResponse(
                status="success",
                memory_id=memory_id,
                mode="hard",
                audit_log_id=audit_id,
                deletion_proof=proof,
                message="Memory permanently purged with cryptographic deletion proof.",
            )
        else:
            record, audit_id = await self.vector_store.soft_forget(
                tenant_id=tenant_id,
                memory_id=memory_id,
                reason=reason,
                actor_id=actor_id,
            )
            if not record:
                raise AppException(status_code=404, code="NOT_FOUND", message=f"Memory {memory_id} not found")
            return MemoryForgetResponse(
                status="success",
                memory_id=memory_id,
                mode="soft",
                audit_log_id=audit_id,
                deletion_proof=None,
                message="Memory status set to 'forgotten' and excluded from recall.",
            )

    async def delete_memory(self, tenant_id: uuid.UUID, memory_id: uuid.UUID) -> bool:
        await set_tenant_context(self.session, tenant_id)
        return await self.vector_store.delete(tenant_id, memory_id)

    async def prune_memories(self, tenant_id: uuid.UUID, payload: MemoryPruneRequest) -> int:
        await set_tenant_context(self.session, tenant_id)
        return await self.vector_store.prune(
            tenant_id=tenant_id,
            session_id=payload.session_id,
            older_than_days=payload.older_than_days,
            max_importance=payload.max_importance,
            max_access_count=payload.max_access_count,
        )

    async def get_graph(
        self,
        tenant_id: uuid.UUID,
        session_id: Optional[str] = None,
        limit: int = 40,
    ) -> Dict[str, Any]:
        """Calculates server-side cosine similarity graph between tenant active memories."""
        await set_tenant_context(self.session, tenant_id)
        memories = await self.vector_store.list_memories(
            tenant_id=tenant_id,
            session_id=session_id,
            status=MemoryStatus.ACTIVE.value,
            limit=limit,
        )

        nodes = []
        categories = set()
        for m in memories:
            categories.add(m.cluster)
            nodes.append({
                "id": str(m.id),
                "text": m.text,
                "category": m.cluster,
                "memory_type": m.memory_type,
                "created_at": m.created_at.isoformat(),
            })

        # Calculate pairwise cosine similarities
        links = []
        for i in range(len(memories)):
            vec_a = np.array(memories[i].embedding)
            norm_a = np.linalg.norm(vec_a) or 1.0
            for j in range(i + 1, len(memories)):
                vec_b = np.array(memories[j].embedding)
                norm_b = np.linalg.norm(vec_b) or 1.0
                sim = float(np.dot(vec_a, vec_b) / (norm_a * norm_b))
                if sim >= 0.45:  # threshold for graph connectivity
                    links.append({
                        "source": str(memories[i].id),
                        "target": str(memories[j].id),
                        "similarity": round(sim, 4),
                    })

        return {
            "nodes": nodes,
            "links": links,
            "categories": list(categories),
            "tenant_id": str(tenant_id),
        }

    async def get_audit_logs(
        self,
        tenant_id: uuid.UUID,
        target_id: Optional[str] = None,
        limit: int = 50,
    ) -> List[AuditLogRecord]:
        await set_tenant_context(self.session, tenant_id)
        return await self.vector_store.get_audit_logs(tenant_id, target_id=target_id, limit=limit)

    async def get_stats(self, tenant_id: uuid.UUID) -> Dict[str, Any]:
        await set_tenant_context(self.session, tenant_id)
        return await self.vector_store.get_stats(tenant_id)
