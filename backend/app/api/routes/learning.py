import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_api_key
from app.auth.models import APIKey
from app.core.database import get_db
from app.core.exceptions import AppException, NotFoundException
from app.learning.logger import ExperienceLogger
from app.learning.miner import PatternMiner
from app.learning.models import (
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

router = APIRouter(prefix="/learning", tags=["Experience Learning & Audited Skill Synthesis"])


@router.post("/log", response_model=ExperienceLogResponse, status_code=status.HTTP_201_CREATED)
async def log_interaction(
    payload: ExperienceLogCreate,
    api_key: APIKey = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Logs a live agent interaction turn into PostgreSQL with tenant isolation."""
    logger = ExperienceLogger(db)
    return await logger.log_interaction(
        tenant_id=api_key.tenant_id,
        session_id=payload.session_id,
        user_query=payload.user_query,
        agent_response=payload.agent_response,
        tool_used=payload.tool_used,
        tool_input=payload.tool_input,
        tool_result=payload.tool_result,
        success=payload.success,
        latency_ms=payload.latency_ms,
    )


@router.get("/logs/{session_id}", response_model=List[ExperienceLogResponse])
async def get_session_logs(
    session_id: str,
    limit: int = Query(100, ge=1, le=500),
    api_key: APIKey = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve interaction logs for a specific session within authenticated tenant."""
    logger = ExperienceLogger(db)
    return await logger.get_session_logs(tenant_id=api_key.tenant_id, session_id=session_id, limit=limit)


@router.post("/mine", response_model=List[PatternClusterResponse])
async def mine_patterns(
    payload: MinePatternsRequest,
    api_key: APIKey = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Runs behavioral pattern mining across recent tenant interaction logs."""
    miner = PatternMiner(db)
    return await miner.mine_patterns(
        tenant_id=api_key.tenant_id,
        session_id=payload.session_id,
        min_frequency=payload.min_frequency,
        lookback_limit=payload.lookback_limit,
    )


@router.get("/patterns", response_model=List[PatternClusterResponse])
async def get_mined_patterns(
    session_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    api_key: APIKey = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Returns detected pattern clusters for authenticated tenant."""
    filters = [PatternCluster.tenant_id == api_key.tenant_id]
    if session_id:
        filters.append(PatternCluster.session_id == session_id)

    stmt = select(PatternCluster).where(and_(*filters)).order_by(desc(PatternCluster.created_at)).limit(limit)
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.post("/generate-skill", response_model=SkillProposalResponse, status_code=status.HTTP_201_CREATED)
async def generate_skill(
    payload: SkillGenerateRequest,
    api_key: APIKey = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Synthesizes a tool code proposal from a pattern cluster.

    Safety Guarantee:
    - Status is set to 'proposed' (never auto-verified or loaded into host runtime).
    - Code is statically analyzed for forbidden AST calls/imports.
    - Proposal includes SHA-256 prompt hash and code hash.
    """
    generator = SkillGenerator(db)

    pattern = None
    if payload.pattern_id:
        stmt = select(PatternCluster).where(
            and_(PatternCluster.tenant_id == api_key.tenant_id, PatternCluster.id == payload.pattern_id)
        )
        res = await db.execute(stmt)
        pattern = res.scalars().first()
        if not pattern:
            raise NotFoundException(f"Pattern cluster '{payload.pattern_id}' not found")
    else:
        pattern = PatternCluster(
            id=uuid.uuid4(),
            tenant_id=api_key.tenant_id,
            title=f"Custom Intent: {payload.tool_name or 'custom_skill'}",
            category="custom",
            description=payload.description or "User-defined skill proposal request",
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
        tenant_id=api_key.tenant_id,
        pattern=pattern,
        tool_name=payload.tool_name,
    )
    return proposal


@router.post("/integrate-skill", status_code=status.HTTP_410_GONE)
@router.post("/auto-register", status_code=status.HTTP_410_GONE)
async def integrate_skill_disabled():
    """Phase 4 Security Enforcement: Automatic in-process runtime execution of untrusted generated code is disabled.

    Generated skills are stored as sandboxed proposals requiring human review and isolated container execution.
    """
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Automatic in-process code execution is disabled. Generated skills are proposals only and require human review and isolated sandbox worker execution.",
    )
