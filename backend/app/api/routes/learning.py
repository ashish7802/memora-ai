import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.learning.logger import ExperienceLogger
from app.learning.miner import PatternMiner
from app.learning.models import (
    ExperienceLog,
    ExperienceLogCreate,
    ExperienceLogResponse,
    MinePatternsRequest,
    PatternCluster,
    PatternClusterResponse,
    SkillGenerateRequest,
    SkillProposal,
    SkillProposalResponse,
)
from app.learning.skill_gen import SkillGenerator

router = APIRouter(prefix="/learning", tags=["Experience Learning & Skill Synthesis"])


@router.post("/log", response_model=ExperienceLogResponse, status_code=status.HTTP_201_CREATED)
async def log_interaction(
    payload: ExperienceLogCreate,
    db: AsyncSession = Depends(get_db),
):
    """Logs a live interaction (query, response, tool call, outcome) into PostgreSQL."""
    logger = ExperienceLogger(db)
    log_entry = await logger.log_interaction(
        session_id=payload.session_id,
        user_query=payload.user_query,
        agent_response=payload.agent_response,
        tool_used=payload.tool_used,
        tool_input=payload.tool_input,
        tool_result=payload.tool_result,
        success=payload.success,
        latency_ms=payload.latency_ms,
    )
    return log_entry


@router.get("/logs/{session_id}", response_model=List[ExperienceLogResponse])
async def get_session_logs(
    session_id: str,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all interaction logs captured for a specific session."""
    logger = ExperienceLogger(db)
    return await logger.get_session_logs(session_id=session_id, limit=limit)


@router.post("/mine", response_model=List[PatternClusterResponse])
async def mine_patterns(
    payload: MinePatternsRequest,
    db: AsyncSession = Depends(get_db),
):
    """Triggers the pattern mining pipeline over stored experience logs."""
    miner = PatternMiner(db)
    patterns = await miner.mine_patterns(
        session_id=payload.session_id,
        min_frequency=payload.min_frequency,
        lookback_limit=payload.lookback_limit,
    )
    return patterns


@router.get("/patterns", response_model=List[PatternClusterResponse])
async def get_mined_patterns(
    session_id: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Returns previously discovered behavioral pattern clusters."""
    stmt = select(PatternCluster)
    if session_id:
        stmt = stmt.where(PatternCluster.session_id == session_id)
    stmt = stmt.order_by(desc(PatternCluster.created_at)).limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/generate-skill", response_model=SkillProposalResponse, status_code=status.HTTP_201_CREATED)
async def generate_skill(
    payload: SkillGenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generates and scaffolds executable Python tool code from a pattern cluster."""
    generator = SkillGenerator(db)

    pattern = None
    if payload.pattern_id:
        stmt = select(PatternCluster).where(PatternCluster.id == payload.pattern_id)
        res = await db.execute(stmt)
        pattern = res.scalars().first()
        if not pattern:
            raise HTTPException(status_code=404, detail="Pattern cluster not found")
    else:
        pattern = PatternCluster(
            id=uuid.uuid4(),
            title=f"Custom Intent: {payload.tool_name or 'custom_skill'}",
            category="custom",
            description=payload.description or "User-defined skill generation request",
            frequency=1,
            failure_rate=0.0,
            sample_queries=payload.sample_queries or [],
            suggested_tool_name=payload.tool_name or "custom_skill",
            status="detected",
        )
        db.add(pattern)
        await db.commit()
        await db.refresh(pattern)

    proposal = await generator.generate_from_patterns(
        pattern=pattern,
        tool_name=payload.tool_name,
    )

    # Automatically register into dynamic runtime registry
    generator.auto_register_skill(proposal.name, proposal.code)

    return proposal
