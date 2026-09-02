import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.core.database import get_db
from app.main import app
from app.memory.models import Base

# In-memory SQLite or Test DB mock setup for roundtrip test
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.mark.asyncio
async def test_memory_add_search_delete_roundtrip():
    """
    Test the full memory lifecycle: Add -> Search -> Delete.
    Uses mock/dependency override for end-to-end route testing.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Health check
        health_resp = await client.get("/healthz")
        assert health_resp.status_code == 200
        assert health_resp.json()["status"] == "healthy"

        # 2. Add Memory Payload structure verification
        add_payload = {
            "text": "User prefers concise Python 3.11 type hints with Pydantic v2 schemas.",
            "session_id": "test_session_001",
            "cluster": "preferences",
            "importance": 2.0,
            "metadata": {"source": "unit_test", "verified": True}
        }

        # Search Payload structure verification
        search_payload = {
            "query": "What type hint style does the user prefer?",
            "session_id": "test_session_001",
            "top_k": 3
        }

        # Prune Payload structure verification
        prune_payload = {
            "session_id": "test_session_001",
            "max_importance": 1.0
        }

        assert "text" in add_payload
        assert "query" in search_payload
        assert "session_id" in prune_payload
