import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from memora.api.dependencies import get_memory_client
from memora.core.models import (
    GraphResponse,
    MemoryCreate,
    MemoryItem,
    MemoryPruneRequest,
    MemoryPruneResponse,
    MemoryUpdate,
    SearchResult,
)
from memora.memory.memory_api import MemoryClient

router = APIRouter(prefix="/v1/memory", tags=["Vector Memory"])


@router.post(
    "",
    response_model=MemoryItem,
    status_code=status.HTTP_201_CREATED,
    summary="Store new memory item",
)
async def add_memory(
    payload: MemoryCreate,
    client: MemoryClient = Depends(get_memory_client),
) -> MemoryItem:
    """Ingests a text payload, computes vector embedding, and stores it in pgvector."""
    return await client.remember(
        text=payload.text,
        metadata=payload.metadata,
        embedding=payload.embedding,
        memory_id=payload.id,
    )


@router.get(
    "",
    response_model=List[MemoryItem],
    summary="List all memories with pagination",
)
async def list_memories(
    limit: int = Query(default=50, ge=1, le=1000, description="Number of memories to return"),
    offset: int = Query(default=0, ge=0, description="Offset for pagination"),
    client: MemoryClient = Depends(get_memory_client),
) -> List[MemoryItem]:
    """Retrieves paginated memories ordered by creation time descending."""
    return await client.store.list_all(limit=limit, offset=offset)


@router.get(
    "/graph",
    response_model=GraphResponse,
    summary="Semantic memory topology graph",
)
async def get_memory_graph(
    min_similarity: float = Query(
        default=0.3,
        ge=0.0,
        le=1.0,
        description="Minimum pairwise cosine similarity threshold for graph edges",
    ),
    limit: int = Query(
        default=200,
        ge=1,
        le=1000,
        description="Maximum recent memories to include in graph computation",
    ),
    client: MemoryClient = Depends(get_memory_client),
) -> GraphResponse:
    """Computes server-side semantic topology graph with pairwise cosine similarity."""
    graph_data = await client.store.get_graph(min_similarity=min_similarity, limit=limit)
    return GraphResponse(**graph_data)


@router.get(
    "/search",
    response_model=List[SearchResult],
    summary="Semantic vector search",
)
async def search_memories(
    q: str = Query(..., min_length=1, description="Semantic search query text"),
    top_k: int = Query(default=5, ge=1, le=100, description="Maximum results to return"),
    threshold: float = Query(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Minimum cosine similarity score threshold (0.0 - 1.0)",
    ),
    client: MemoryClient = Depends(get_memory_client),
) -> List[SearchResult]:
    """Searches memory store by query cosine similarity with top_k and threshold filtering."""
    return await client.recall(query=q, top_k=top_k, threshold=threshold)


@router.get(
    "/{memory_id}",
    response_model=MemoryItem,
    summary="Get single memory by UUID",
)
async def get_memory(
    memory_id: uuid.UUID,
    client: MemoryClient = Depends(get_memory_client),
) -> MemoryItem:
    item = await client.store.get(memory_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Memory item with ID '{memory_id}' was not found.",
        )
    return item


@router.put(
    "/{memory_id}",
    response_model=MemoryItem,
    summary="Update existing memory item",
)
async def update_memory(
    memory_id: uuid.UUID,
    payload: MemoryUpdate,
    client: MemoryClient = Depends(get_memory_client),
) -> MemoryItem:
    """Updates text, embedding, metadata, or decay score of an existing memory."""
    updated = await client.update(
        memory_id=memory_id,
        text=payload.text,
        metadata=payload.metadata,
        embedding=payload.embedding,
        decay_score=payload.decay_score,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Memory item with ID '{memory_id}' was not found.",
        )
    return updated


@router.delete(
    "/{memory_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete memory item",
)
async def delete_memory(
    memory_id: uuid.UUID,
    client: MemoryClient = Depends(get_memory_client),
):
    """Permanently deletes a memory item by ID."""
    deleted = await client.forget(memory_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Memory item with ID '{memory_id}' was not found.",
        )
    return {"status": "success", "deleted_id": str(memory_id)}


@router.post(
    "/prune",
    response_model=MemoryPruneResponse,
    summary="Prune decaying memories",
)
async def prune_memories(
    payload: MemoryPruneRequest,
    client: MemoryClient = Depends(get_memory_client),
) -> MemoryPruneResponse:
    """Prunes low-relevance memories whose decay score is below the threshold."""
    count = await client.prune(threshold=payload.threshold)
    return MemoryPruneResponse(
        status="success",
        pruned_count=count,
        threshold=payload.threshold,
    )
