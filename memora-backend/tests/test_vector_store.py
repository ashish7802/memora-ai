import math
import uuid
import pytest
import pytest_asyncio
import asyncpg
from pgvector.asyncpg import register_vector

from memora.core.config import get_settings
from memora.memory.vector_store import PgVectorStore
from memora.memory.memory_api import MemoryClient


def generate_mock_embedding(seed: str, dim: int = 768) -> list[float]:
    """Generates a normalized test embedding vector."""
    vec = [math.sin(i * 0.1 + len(seed) * 0.5) for i in range(dim)]
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


@pytest_asyncio.fixture
async def db_pool():
    settings = get_settings()

    async def init_conn(conn):
        await register_vector(conn)

    pool = await asyncpg.create_pool(
        dsn=settings.DATABASE_URL,
        min_size=1,
        max_size=5,
        init=init_conn,
    )
    yield pool
    await pool.close()


@pytest_asyncio.fixture
async def vector_store(db_pool):
    return PgVectorStore(pool=db_pool)


@pytest_asyncio.fixture
async def memory_client(vector_store):
    return MemoryClient(vector_store=vector_store)


@pytest.mark.asyncio
async def test_vector_store_crud_lifecycle(vector_store: PgVectorStore):
    """Verifies end-to-end memory lifecycle: Add -> Search -> Update -> Delete -> Verify Empty."""
    test_id = uuid.uuid4()
    original_text = "Memora sovereign cognitive layer for autonomous AI agents."
    original_emb = generate_mock_embedding(original_text)
    metadata = {"category": "architecture", "test_run": True}

    # 1. Add Memory
    item = await vector_store.add(
        text=original_text,
        embedding=original_emb,
        metadata=metadata,
        memory_id=test_id,
    )
    assert item.id == test_id
    assert item.text == original_text
    assert item.metadata.get("category") == "architecture"

    # 2. Search Memory (Finds item with high similarity score)
    search_results = await vector_store.search(
        query_embedding=original_emb,
        top_k=5,
        threshold=0.8,
    )
    assert len(search_results) >= 1
    matched = next((r for r in search_results if r.id == test_id), None)
    assert matched is not None
    assert matched.score >= 0.99  # Identical vector should yield ~1.0

    # 3. Update Memory
    updated_text = "Updated Memora sovereign cognitive layer for distributed agent swarms."
    updated_emb = generate_mock_embedding(updated_text)
    updated_item = await vector_store.update(
        memory_id=test_id,
        text=updated_text,
        embedding=updated_emb,
        metadata={"category": "swarms", "updated": True},
        decay_score=0.95,
    )
    assert updated_item is not None
    assert updated_item.text == updated_text
    assert updated_item.metadata.get("category") == "swarms"
    assert updated_item.decay_score == 0.95

    # 4. Delete Memory
    deleted = await vector_store.delete(test_id)
    assert deleted is True

    # 5. Verify Search and Get return empty
    fetch_after_delete = await vector_store.get(test_id)
    assert fetch_after_delete is None

    search_after_delete = await vector_store.search(
        query_embedding=original_emb,
        top_k=5,
        threshold=0.0,
    )
    assert not any(r.id == test_id for r in search_after_delete)


@pytest.mark.asyncio
async def test_memory_client_facade(memory_client: MemoryClient):
    """Verifies MemoryClient high-level facade remember and recall workflows."""
    test_id = uuid.uuid4()
    topic = f"PostgreSQL pgvector test cluster session {uuid.uuid4().hex[:6]}"

    # Remember
    stored = await memory_client.remember(
        text=topic,
        metadata={"source": "pytest"},
        memory_id=test_id,
    )
    assert stored.id == test_id

    # Recall
    results = await memory_client.recall(query=topic, top_k=3, threshold=0.5)
    assert len(results) >= 1
    assert any(r.id == test_id for r in results)

    # Cleanup / Forget
    forgotten = await memory_client.forget(test_id)
    assert forgotten is True
