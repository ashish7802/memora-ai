from typing import Any, Dict, List, Optional
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.learning.models import ExperienceLog, ExperienceLogCreate


class ExperienceLogger:
    """Production logger for capturing real user-agent interactions in PostgreSQL."""

    def __init__(self, db_session: AsyncSession):
        self.db = db_session

    async def log_interaction(
        self,
        session_id: str,
        user_query: str,
        agent_response: str,
        tool_used: Optional[str] = None,
        tool_input: Optional[Dict[str, Any]] = None,
        tool_result: Optional[Dict[str, Any]] = None,
        success: bool = True,
        latency_ms: float = 0.0,
        tenant_id: Optional[uuid.UUID] = None,
    ) -> ExperienceLog:
        """Persist a live interaction turn into PostgreSQL."""
        log_entry = ExperienceLog(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            session_id=session_id or "default",
            user_query=user_query,
            agent_response=agent_response,
            tool_used=tool_used,
            tool_input=tool_input or {},
            tool_result=tool_result or {},
            success=success,
            latency_ms=latency_ms,
        )
        self.db.add(log_entry)
        await self.db.commit()
        await self.db.refresh(log_entry)
        return log_entry

    async def get_session_logs(self, session_id: str, limit: int = 100) -> List[ExperienceLog]:
        """Fetch chronological interaction logs for a given session."""
        stmt = (
            select(ExperienceLog)
            .where(ExperienceLog.session_id == session_id)
            .order_by(desc(ExperienceLog.created_at))
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_recent_logs(self, limit: int = 100) -> List[ExperienceLog]:
        """Fetch the most recent experience logs across all sessions."""
        stmt = (
            select(ExperienceLog)
            .order_by(desc(ExperienceLog.created_at))
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
