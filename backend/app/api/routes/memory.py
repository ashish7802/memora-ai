import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.memory.models import (
    MemoryBatchResponse,
    MemoryCreate,
    MemoryDelete,
    MemoryDeleteResponse,
    MemoryPruneRequest,
    MemoryPruneResponse,
    MemoryResponse,
    MemorySearchQuery,
    MemoryUpdate,
)
from app.memory.service import MemoryService

router = APIRouter(prefix="/memory", tags=["Memory"])


@router.post("/add", response_model=MemoryResponse, status_code=status.HTTP_201_CREATED)
async def add_memory(
    payload: MemoryCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Ingest a new memory item, embed it with pgvector, and persist to cluster storage.
    """
    service = MemoryService(db)
    try:
        return await service.add_memory(payload)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest memory: {str(exc)}",
        )


@router.post("/search", response_model=MemoryBatchResponse)
async def search_memories(
    payload: MemorySearchQuery,
    db: AsyncSession = Depends(get_db),
):
    """
    Perform semantic associative search using cosine distance on pgvector HNSW index.
    """
    service = MemoryService(db)
    try:
        results = await service.search_memories(payload)
        return MemoryBatchResponse(
            status="success",
            count=len(results),
            data=results,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(exc)}",
        )


@router.put("/update", response_model=MemoryResponse)
async def update_memory(
    payload: MemoryUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Update memory content, metadata, cluster, or importance. Re-embeds if text changed.
    """
    service = MemoryService(db)
    updated = await service.update_memory(payload)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Memory with ID '{payload.id}' not found",
        )
    return updated


@router.delete("/delete", response_model=MemoryDeleteResponse)
async def delete_memory(
    payload: MemoryDelete,
    db: AsyncSession = Depends(get_db),
):
    """
    Remove a memory vector from pgvector storage.
    """
    service = MemoryService(db)
    deleted = await service.delete_memory(payload.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Memory with ID '{payload.id}' not found",
        )
    return MemoryDeleteResponse(
        status="success",
        deleted_id=payload.id,
        message=f"Memory {payload.id} deleted successfully",
    )


@router.post("/prune", response_model=MemoryPruneResponse)
async def prune_memories(
    payload: MemoryPruneRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Prune stale or low-importance memories matching criteria.
    """
    service = MemoryService(db)
    count = await service.prune_memories(payload)
    return MemoryPruneResponse(
        status="success",
        pruned_count=count,
        message=f"Successfully pruned {count} memories",
    )
