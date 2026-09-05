import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_api_key
from app.auth.models import APIKey
from app.core.database import get_db
from app.core.exceptions import AppException, NotFoundException
from app.memory.models import (
    AuditLogBatchResponse,
    AuditLogResponse,
    ExplainableSearchResponse,
    MemoryBatchResponse,
    MemoryCreate,
    MemoryDelete,
    MemoryDeleteResponse,
    MemoryForgetResponse,
    MemoryForgetRequest,
    MemoryPruneRequest,
    MemoryPruneResponse,
    MemoryResponse,
    MemorySearchQuery,
    MemoryUpdate,
)
from app.memory.service import MemoryService

router = APIRouter(prefix="/memory", tags=["Auditable Memory"])


@router.post(
    "",
    response_model=MemoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add an auditable memory item",
)
@router.post(
    "/add",
    response_model=MemoryResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
async def add_memory(
    payload: MemoryCreate,
    api_key: APIKey = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Ingest a new memory item with tenant isolation, provenance, temporal validity, and conflict detection."""
    service = MemoryService(db)
    try:
        return await service.add_memory(
            tenant_id=api_key.tenant_id,
            payload=payload,
            created_by=str(api_key.user_id),
        )
    except AppException:
        raise
    except Exception as exc:
        raise AppException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="INGEST_ERROR",
            message=f"Failed to ingest memory: {str(exc)}",
        )


@router.get(
    "",
    response_model=MemoryBatchResponse,
    summary="List all memories for authenticated tenant",
)
async def list_memories(
    session_id: Optional[str] = Query(None, description="Filter by session ID"),
    cluster: Optional[str] = Query(None, description="Filter by cluster"),
    status_filter: str = Query("active", alias="status", description="Status filter: active, forgotten, deprecated"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    api_key: APIKey = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
):
    service = MemoryService(db)
    items = await service.list_memories(
        tenant_id=api_key.tenant_id,
        session_id=session_id,
        cluster=cluster,
        status=status_filter,
        limit=limit,
        offset=offset,
    )
    return MemoryBatchResponse(status="success", count=len(items), data=items)


@router.post(
    "/search",
    response_model=ExplainableSearchResponse,
    summary="Explainable associative search",
)
async def search_memories(
    payload: MemorySearchQuery,
    api_key: APIKey = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Perform explainable semantic recall with scoring breakdown (vector similarity, recency, importance, frequency)."""
    service = MemoryService(db)
    try:
        return await service.search_memories(tenant_id=api_key.tenant_id, payload=payload)
    except AppException:
        raise
    except Exception as exc:
        raise AppException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="SEARCH_ERROR",
            message=f"Search failed: {str(exc)}",
        )


@router.get(
    "/search",
    response_model=ExplainableSearchResponse,
    summary="Explainable associative search via GET",
)
async def search_memories_get(
    query: str = Query(..., min_length=1),
    session_id: Optional[str] = Query(None),
    cluster: Optional[str] = Query(None),
    top_k: int = Query(5, ge=1, le=100),
    threshold: Optional[float] = Query(None),
    api_key: APIKey = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
):
    service = MemoryService(db)
    payload = MemorySearchQuery(
        query=query,
        session_id=session_id,
        cluster=cluster,
        top_k=top_k,
        threshold=threshold,
    )
    return await service.search_memories(tenant_id=api_key.tenant_id, payload=payload)


@router.get(
    "/graph",
    summary="Server-side semantic similarity graph",
)
async def get_memory_graph(
    session_id: Optional[str] = Query(None),
    limit: int = Query(40, ge=2, le=100),
    api_key: APIKey = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Generates server-side cosine similarity graph nodes & edges between memories within the tenant."""
    service = MemoryService(db)
    return await service.get_graph(tenant_id=api_key.tenant_id, session_id=session_id, limit=limit)


@router.get(
    "/stats",
    summary="Live tenant memory metrics",
)
async def get_memory_stats(
    api_key: APIKey = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
):
    service = MemoryService(db)
    return await service.get_stats(tenant_id=api_key.tenant_id)


@router.get(
    "/audit",
    response_model=AuditLogBatchResponse,
    summary="Fetch tenant audit logs",
)
async def get_audit_logs(
    target_id: Optional[str] = Query(None, description="Filter audit logs by target ID"),
    limit: int = Query(50, ge=1, le=200),
    api_key: APIKey = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
):
    service = MemoryService(db)
    records = await service.get_audit_logs(tenant_id=api_key.tenant_id, target_id=target_id, limit=limit)
    items = [AuditLogResponse.model_validate(r) for r in records]
    return AuditLogBatchResponse(status="success", count=len(items), data=items)


@router.get(
    "/{memory_id}",
    response_model=MemoryResponse,
    summary="Get single memory by ID",
)
async def get_memory_by_id(
    memory_id: uuid.UUID,
    api_key: APIKey = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
):
    service = MemoryService(db)
    item = await service.get_memory(tenant_id=api_key.tenant_id, memory_id=memory_id)
    if not item:
        raise NotFoundException(f"Memory '{memory_id}' not found in tenant space")
    return item


@router.put(
    "/update",
    response_model=MemoryResponse,
    summary="Update a memory item",
    include_in_schema=False,
)
@router.put(
    "/{memory_id}",
    response_model=MemoryResponse,
    summary="Update memory item",
)
async def update_memory(
    payload: MemoryUpdate,
    memory_id: Optional[uuid.UUID] = None,
    api_key: APIKey = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
):
    service = MemoryService(db)
    target_id = memory_id or payload.id
    payload.id = target_id
    updated = await service.update_memory(
        tenant_id=api_key.tenant_id,
        payload=payload,
        updated_by=str(api_key.user_id),
    )
    if not updated:
        raise NotFoundException(f"Memory '{target_id}' not found in tenant space")
    return updated


@router.post(
    "/{memory_id}/forget",
    response_model=MemoryForgetResponse,
    summary="Verifiable Forget on Command (Soft tombstone or Cryptographic Hard purge)",
)
async def forget_memory(
    memory_id: uuid.UUID,
    payload: MemoryForgetRequest = MemoryForgetRequest(),
    api_key: APIKey = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Phase 7: Forget on Command.

    - mode='soft': Sets status='forgotten', immediate exclusion from recall queries, retains tombstone audit log.
    - mode='hard': Permanently deletes text and embedding vector, records non-reversible audit log, returns SHA-256 cryptographic deletion proof.
    """
    service = MemoryService(db)
    return await service.forget_memory(
        tenant_id=api_key.tenant_id,
        memory_id=memory_id,
        mode=payload.mode,
        reason=payload.reason or "user_forget_command",
        actor_id=str(api_key.user_id),
    )


@router.delete(
    "/delete",
    response_model=MemoryDeleteResponse,
    summary="Delete a memory item",
    include_in_schema=False,
)
@router.delete(
    "/{memory_id}",
    response_model=MemoryDeleteResponse,
    summary="Delete memory item by ID",
)
async def delete_memory(
    memory_id: Optional[uuid.UUID] = None,
    payload: Optional[MemoryDelete] = None,
    api_key: APIKey = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
):
    service = MemoryService(db)
    target_id = memory_id or (payload.id if payload else None)
    if not target_id:
        raise AppException(status_code=400, code="INVALID_ARGUMENT", message="Memory ID required")

    success = await service.delete_memory(tenant_id=api_key.tenant_id, memory_id=target_id)
    if not success:
        raise NotFoundException(f"Memory '{target_id}' not found in tenant space")

    return MemoryDeleteResponse(
        status="success",
        deleted_id=target_id,
        message=f"Memory '{target_id}' successfully deleted.",
    )


@router.post(
    "/prune",
    response_model=MemoryPruneResponse,
    summary="Prune stale memories by decay and importance thresholds",
)
async def prune_memories(
    payload: MemoryPruneRequest,
    api_key: APIKey = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
):
    service = MemoryService(db)
    pruned_count = await service.prune_memories(tenant_id=api_key.tenant_id, payload=payload)
    return MemoryPruneResponse(
        status="success",
        pruned_count=pruned_count,
        message=f"Pruned {pruned_count} memory items from tenant storage.",
    )
