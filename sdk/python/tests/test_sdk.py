import uuid
import pytest
import respx
import httpx
from memora.client import Memora, AsyncMemora
from memora.memory import MemoryManager
from memora.exceptions import MemoraNotFoundError


@pytest.fixture
def mock_api():
    with respx.mock(base_url="http://localhost:8000") as respx_mock:
        yield respx_mock


def test_sync_client_add_search_delete(mock_api):
    mem_id = str(uuid.uuid4())

    # Mock /v1/memory/add
    mock_api.post("/v1/memory/add").mock(
        return_value=httpx.Response(
            201,
            json={
                "id": mem_id,
                "text": "User prefers dark mode and Python async syntax",
                "session_id": "test_sess",
                "cluster": "preferences",
                "importance": 2.0,
                "access_count": 0.0,
                "metadata": {"test": True},
                "created_at": "2026-09-02T12:00:00Z",
                "updated_at": "2026-09-02T12:00:00Z",
                "last_accessed_at": "2026-09-02T12:00:00Z",
            },
        )
    )

    # Mock /v1/memory/search
    mock_api.post("/v1/memory/search").mock(
        return_value=httpx.Response(
            200,
            json={
                "status": "success",
                "count": 1,
                "data": [
                    {
                        "id": mem_id,
                        "text": "User prefers dark mode and Python async syntax",
                        "session_id": "test_sess",
                        "cluster": "preferences",
                        "importance": 2.0,
                        "access_count": 1.0,
                        "metadata": {"test": True},
                        "similarity_score": 0.94,
                        "cosine_distance": 0.12,
                        "created_at": "2026-09-02T12:00:00Z",
                        "updated_at": "2026-09-02T12:00:00Z",
                        "last_accessed_at": "2026-09-02T12:00:00Z",
                    }
                ],
            },
        )
    )

    # Mock /v1/memory/delete
    mock_api.delete("/v1/memory/delete").mock(
        return_value=httpx.Response(
            200,
            json={
                "status": "success",
                "deleted_id": mem_id,
                "message": f"Memory {mem_id} deleted successfully",
            },
        )
    )

    client = Memora(base_url="http://localhost:8000")

    # 1. Add
    created = client.add(
        text="User prefers dark mode and Python async syntax",
        session_id="test_sess",
        cluster="preferences",
        importance=2.0,
    )
    assert str(created.id) == mem_id
    assert created.cluster == "preferences"

    # 2. Search
    results = client.search(query="dark mode syntax", session_id="test_sess")
    assert len(results) == 1
    assert results[0].similarity_score == 0.94

    # 3. Delete
    del_res = client.delete(id=mem_id)
    assert del_res.status == "success"
    assert str(del_res.deleted_id) == mem_id


def test_memory_manager_interface(mock_api):
    mem_id = str(uuid.uuid4())
    mock_api.post("/v1/memory/add").mock(
        return_value=httpx.Response(
            201,
            json={
                "id": mem_id,
                "text": "High level memory remember test",
                "session_id": "scoped_session",
                "cluster": "general",
                "importance": 1.0,
                "access_count": 0.0,
                "metadata": {},
                "created_at": "2026-09-02T12:00:00Z",
                "updated_at": "2026-09-02T12:00:00Z",
                "last_accessed_at": "2026-09-02T12:00:00Z",
            },
        )
    )

    manager = MemoryManager(session_id="scoped_session", base_url="http://localhost:8000")
    mem = manager.remember("High level memory remember test")
    assert str(mem.id) == mem_id
    assert mem.session_id == "scoped_session"


@pytest.mark.asyncio
async def test_async_client(mock_api):
    mem_id = str(uuid.uuid4())
    mock_api.post("/v1/memory/search").mock(
        return_value=httpx.Response(
            200,
            json={
                "status": "success",
                "count": 0,
                "data": [],
            },
        )
    )

    async with AsyncMemora(base_url="http://localhost:8000") as client:
        results = await client.search(query="nothing matches")
        assert len(results) == 0
