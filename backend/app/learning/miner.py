import hashlib
import re
import uuid
from collections import defaultdict
from typing import Any, Dict, List, Optional
from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_tenant_context
from app.learning.models import ExperienceLog, PatternCluster, SkillProposal
from app.learning.skill_gen import StaticAnalysisAuditor


class PatternMiner:
    """Discovers behavioral patterns, clusters queries, detects capability gaps,

    and drafts automated skill proposals from real PostgreSQL experience logs with tenant isolation.
    """

    def __init__(self, db_session: AsyncSession):
        self.db = db_session

    def cluster_queries(self, logs: List[ExperienceLog]) -> Dict[str, List[ExperienceLog]]:
        """Group similar queries by extracting semantic intent keywords and actions."""
        clusters = defaultdict(list)

        intent_patterns = {
            "web_search_and_news": [r"\b(search|find|google|news|latest|articles|lookup|web)\b"],
            "code_execution_and_math": [r"\b(calculate|compute|math|python|code|execute|eval|formula|solve)\b"],
            "database_and_sql": [r"\b(query|select|database|sql|postgres|table|schema|records)\b"],
            "file_and_document_io": [r"\b(file|read|pdf|csv|json|parse|extract|convert|write|save)\b"],
            "api_and_integration": [r"\b(api|webhook|http|fetch|post|rest|endpoint|slack|github)\b"],
            "summarization_and_nlp": [r"\b(summarize|summary|translate|rephrase|extract key|sentiment)\b"],
            "general_conversation": [r".*"],
        }

        for log in logs:
            matched_category = "general_conversation"
            text_lower = (log.user_query or "").lower()

            for category, patterns in intent_patterns.items():
                if category == "general_conversation":
                    continue
                if any(re.search(pat, text_lower) for pat in patterns):
                    matched_category = category
                    break

            clusters[matched_category].append(log)

        return clusters

    def identify_gaps(self, clustered_logs: Dict[str, List[ExperienceLog]]) -> List[Dict[str, Any]]:
        """Identifies capability gaps based on missing tools or frequent failure rates."""
        gaps = []

        for category, logs in clustered_logs.items():
            if not logs:
                continue

            total = len(logs)
            failures = sum(1 for l in logs if not l.success)
            missing_tool_count = sum(1 for l in logs if not l.tool_used)
            failure_rate = (failures / total) if total > 0 else 0.0

            if total >= 2 or failures > 0 or missing_tool_count > 1:
                suggested_name = f"{category}_tool"
                gaps.append({
                    "category": category,
                    "frequency": total,
                    "failure_rate": round(failure_rate, 2),
                    "suggested_tool_name": suggested_name,
                    "sample_queries": [l.user_query for l in logs[:5]],
                    "description": f"Repeated user intent in '{category}' ({total} requests, {failures} failures).",
                })

        return gaps

    async def mine_patterns(
        self,
        tenant_id: uuid.UUID,
        session_id: Optional[str] = None,
        min_frequency: int = 1,
        lookback_limit: int = 100,
    ) -> List[PatternCluster]:
        """Runs the pattern mining pipeline over recent PostgreSQL experience logs."""
        await set_tenant_context(self.db, tenant_id)
        filters = [ExperienceLog.tenant_id == tenant_id]
        if session_id:
            filters.append(ExperienceLog.session_id == session_id)

        stmt = select(ExperienceLog).where(and_(*filters)).order_by(desc(ExperienceLog.created_at)).limit(lookback_limit)
        res = await self.db.execute(stmt)
        logs = list(res.scalars().all())

        if not logs:
            return []

        clustered = self.cluster_queries(logs)
        gaps = self.identify_gaps(clustered)

        persisted_clusters = []
        for gap in gaps:
            if gap["frequency"] < min_frequency:
                continue

            cluster_entry = PatternCluster(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                session_id=session_id,
                title=f"Intent Pattern: {gap['category'].replace('_', ' ').title()}",
                category=gap["category"],
                description=gap["description"],
                frequency=gap["frequency"],
                failure_rate=gap["failure_rate"],
                sample_queries=gap["sample_queries"],
                suggested_tool_name=gap["suggested_tool_name"],
                status="detected",
            )
            self.db.add(cluster_entry)
            persisted_clusters.append(cluster_entry)

        await self.db.commit()
        for pc in persisted_clusters:
            await self.db.refresh(pc)

        return persisted_clusters

    async def generate_skill_proposal(self, tenant_id: uuid.UUID, pattern: PatternCluster) -> SkillProposal:
        """Creates a formal skill proposal based on a detected pattern cluster with static analysis."""
        await set_tenant_context(self.db, tenant_id)
        tool_name = pattern.suggested_tool_name or f"skill_{pattern.category}"

        scaffold_code = (
            f'"""Memora Proposed Skill: {tool_name}\n'
            f'Auto-synthesized for pattern: {pattern.title}\n'
            f'Status: PROPOSED\n'
            f'"""\n\n'
            f'from typing import Dict, Any\n\n'
            f'def execute(params: Dict[str, Any]) -> Dict[str, Any]:\n'
            f'    """{pattern.description}"""\n'
            f'    query = params.get("query", "")\n'
            f'    return {{"status": "completed", "tool": "{tool_name}", "processed": query}}\n'
        )

        passed, findings = StaticAnalysisAuditor.audit_code(scaffold_code)
        prompt_hash = hashlib.sha256(pattern.description.encode("utf-8")).hexdigest()
        code_hash = hashlib.sha256(scaffold_code.encode("utf-8")).hexdigest()

        heuristic_score = min(0.70, (pattern.frequency / 10.0) * 0.4 + (0.3 if passed else 0.0))

        proposal = SkillProposal(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            cluster_id=pattern.id,
            name=tool_name,
            description=f"Automated skill proposal to address {pattern.title}: {pattern.description}",
            language="python",
            code=scaffold_code,
            input_schema={"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]},
            output_schema={"type": "object", "properties": {"status": {"type": "string"}}},
            confidence_score=round(heuristic_score, 3),
            status="proposed",
            review_status="unreviewed",
            reviewer=None,
            model_provider="heuristic_scaffolder_v1",
            prompt_hash=prompt_hash,
            code_hash=code_hash,
            static_analysis_passed=passed,
            static_analysis_findings=findings,
        )
        self.db.add(proposal)
        pattern.status = "proposed"
        await self.db.commit()
        await self.db.refresh(proposal)
        return proposal
