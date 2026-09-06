import uuid
import pytest
import respx
import httpx
from memora.client import Memora, MemoraClient, AsyncMemora, AsyncMemoraClient
from memora.memory import MemoryManager, AsyncMemoryManager
from memora.exceptions import (
    MemoraError,
    MemoraAPIError,
    MemoraAuthError,
    MemoraNotFoundError,
    MemoraRateLimitError,
)
from memora.integrations.crewai import MemoraTool


@pytest.fixture
def mock_api():
    with respx.mock(base_url="http://localhost:8000") as respx_mock:
        yield respx_mock


def test_sync_client_remember_recall_forget(mock_api):
    mem_id = str(uuid.uuid4())

    # Mock /v1/memory
    mock_api.post("/v1/memory").mock(
        return_value=httpx.Response(
            201,
            json={
                "id": mem_id,
                "text": "User prefers Python async and pgvector",
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
                        "text": "User prefers Python async and pgvector",
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

    # Mock /v1/memory/{id}/forget
    audit_id = str(uuid.uuid4())
    mock_api.post(f"/v1/memory/{mem_id}/forget").mock(
        return_value=httpx.Response(
            200,
            json={
                "status": "forgotten",
                "memory_id": mem_id,
                "mode": "soft",
                "audit_log_id": audit_id,
                "deletion_proof": "proof_123",
                "message": f"Memory {mem_id} forgotten successfully",
            },
        )
    )

    client = MemoraClient(api_key="mm_test_secret_key", base_url="http://localhost:8000")

    # 1. Remember
    created = client.remember(
        text="User prefers Python async and pgvector",
        session_id="test_sess",
        cluster="preferences",
        importance=2.0,
    )
    assert str(created.id) == mem_id
    assert created.cluster == "preferences"

    # 2. Recall
    results = client.recall(query="Python preferences", session_id="test_sess")
    assert len(results) == 1
    assert results[0].similarity_score == 0.94

    # 3. Forget
    del_res = client.forget(id=mem_id)
    assert del_res.status == "forgotten"
    assert str(del_res.memory_id) == mem_id


def test_auth_error_handling(mock_api):
    mock_api.post("/v1/memory").mock(
        return_value=httpx.Response(
            401,
            json={
                "error": {
                    "code": "API_KEY_REQUIRED",
                    "message": "API Key missing. Provide 'X-API-Key' or 'Authorization: Bearer <api_key>' header.",
                }
            },
        )
    )

    client = MemoraClient(base_url="http://localhost:8000")
    with pytest.raises(MemoraAuthError) as exc_info:
        client.remember("Unauthorized attempt")
    assert exc_info.value.status_code == 401
    assert exc_info.value.code == "API_KEY_REQUIRED"


def test_rate_limit_error_handling(mock_api):
    mock_api.post("/v1/memory/search").mock(
        return_value=httpx.Response(
            429,
            headers={"Retry-After": "45"},
            json={
                "error": {
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": "Rate limit exceeded. Maximum 100 requests per minute allowed.",
                }
            },
        )
    )

    client = MemoraClient(base_url="http://localhost:8000")
    with pytest.raises(MemoraRateLimitError) as exc_info:
        client.recall("Fast query loop")
    assert exc_info.value.status_code == 429
    assert exc_info.value.retry_after == 45


def test_crewai_tool_helper(mock_api):
    mem_id = str(uuid.uuid4())
    mock_api.post("/v1/memory").mock(
        return_value=httpx.Response(
            201,
            json={
                "id": mem_id,
                "text": "Extracted key finding from paper",
                "session_id": "crew_test",
                "cluster": "agent_knowledge",
                "importance": 1.0,
                "access_count": 0.0,
                "metadata": {},
                "created_at": "2026-09-02T12:00:00Z",
                "updated_at": "2026-09-02T12:00:00Z",
                "last_accessed_at": "2026-09-02T12:00:00Z",
            },
        )
    )

    tool = MemoraTool(session_id="crew_test", base_url="http://localhost:8000")
    res = tool.remember("Extracted key finding from paper")
    assert f"Memory stored with ID: {mem_id}" == res
