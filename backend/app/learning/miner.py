import json
import re
import uuid
from collections import defaultdict
from typing import Any, Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.learning.models import ExperienceLog, PatternCluster, SkillProposal


class PatternMiner:
    """Discovers behavioral patterns, clusters queries, detects capability gaps,

    and drafts automated skill proposals from real PostgreSQL experience logs.
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
        session_id: Optional[str] = None,
        min_frequency: int = 1,
        lookback_limit: int = 100,
        tenant_id: Optional[uuid.UUID] = None,
    ) -> List[PatternCluster]:
        """Runs the pattern mining pipeline over recent PostgreSQL experience logs."""
        stmt = select(ExperienceLog)
        if tenant_id:
            stmt = stmt.where(ExperienceLog.tenant_id == tenant_id)
        if session_id:
            stmt = stmt.where(ExperienceLog.session_id == session_id)
        
        stmt = stmt.order_by(desc(ExperienceLog.created_at)).limit(lookback_limit)
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

    async def generate_skill_proposal(self, pattern: PatternCluster, tenant_id: Optional[uuid.UUID] = None) -> SkillProposal:
        """Creates a formal skill proposal based on a detected pattern cluster."""
        tool_name = pattern.suggested_tool_name or f"skill_{pattern.category}"
        
        proposal = SkillProposal(
            id=uuid.uuid4(),
            tenant_id=tenant_id or pattern.tenant_id,
            cluster_id=pattern.id,
            name=tool_name,
            description=f"Automated skill to address {pattern.title}: {pattern.description}",
            language="python",
            code=f"# Auto-generated skill scaffold for {tool_name}\n\ndef execute(params: dict) -> dict:\n    \"\"\"{pattern.description}\"\"\"\n    return {{'status': 'success', 'result': f'Executed {tool_name}'}}\n",
            input_schema={"type": "object", "properties": {"query": {"type": "string"}}},
            output_schema={"type": "object", "properties": {"result": {"type": "string"}}},
            confidence_score=max(0.70, min(0.95, 0.5 + (pattern.frequency * 0.1))),
            status="proposed",
        )
        self.db.add(proposal)
        pattern.status = "proposed"
        await self.db.commit()
        await self.db.refresh(proposal)
        return proposal
