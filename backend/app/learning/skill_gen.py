import ast
import hashlib
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession

from app.learning.models import PatternCluster, SkillProposal

logger = logging.getLogger("memora.learning.skill_gen")


class StaticAnalysisAuditor:
    """Performs strict AST inspection on generated skill proposals.

    Denies execution of dangerous primitives (eval, exec, file I/O, subprocess, network imports).
    """

    BANNED_CALLS = {
        "eval",
        "exec",
        "compile",
        "__import__",
        "open",
        "system",
        "popen",
        "spawn",
        "fork",
    }

    BANNED_MODULES = {
        "os",
        "sys",
        "subprocess",
        "socket",
        "shutil",
        "pickle",
        "pty",
        "requests",
        "urllib",
        "http",
        "asyncio",
    }

    @classmethod
    def audit_code(cls, code: str) -> Tuple[bool, List[str]]:
        findings = []
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            return False, [f"SyntaxError: {e.msg} at line {e.lineno}"]

        for node in ast.walk(tree):
            # Check imports
            if isinstance(node, ast.Import):
                for alias in node.names:
                    root_mod = alias.name.split(".")[0]
                    if root_mod in cls.BANNED_MODULES:
                        findings.append(f"Forbidden module import: '{alias.name}'")
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    root_mod = node.module.split(".")[0]
                    if root_mod in cls.BANNED_MODULES:
                        findings.append(f"Forbidden from-import module: '{node.module}'")

            # Check function calls
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    if node.func.id in cls.BANNED_CALLS:
                        findings.append(f"Forbidden function call: '{node.func.id}()'")
                elif isinstance(node.func, ast.Attribute):
                    if node.func.attr in cls.BANNED_CALLS:
                        findings.append(f"Forbidden method invocation: '.{node.func.attr}()'")

        passed = len(findings) == 0
        return passed, findings


class SkillGenerator:
    """Synthesizes tool code proposals from detected behavioral pattern clusters.

    Security Guarantee:
    Generated skills are untrusted proposals only. No dynamic module compilation,
    eval, exec, or runtime mounting is permitted in this process.
    """

    def __init__(self, db: Optional[AsyncSession] = None):
        self.db = db

    async def generate_from_patterns(
        self,
        tenant_id: uuid.UUID,
        pattern: PatternCluster,
        tool_name: Optional[str] = None,
    ) -> SkillProposal:
        raw_name = tool_name or pattern.suggested_tool_name or f"tool_{pattern.category}"
        resolved_name = re.sub(r"[^a-zA-Z0-9_]", "_", raw_name).lower()
        if not resolved_name.startswith("tool_"):
            resolved_name = f"tool_{resolved_name}"

        # Scaffold a clean, safe functional template
        generated_code = f'''"""Memora Proposed Skill: {resolved_name}
Auto-synthesized for pattern: {pattern.title}
Status: PROPOSED (Requires human review and sandboxed container execution)
"""

from typing import Dict, Any

def execute(params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute logic for {resolved_name}.
    Input params schema validated before execution.
    """
    query = params.get("query", "")
    # Pure computational logic placeholder
    return {{
        "tool": "{resolved_name}",
        "processed_query": query,
        "status": "completed"
    }}
'''

        # Static analysis audit
        passed, findings = StaticAnalysisAuditor.audit_code(generated_code)

        # Hashing for provenance
        prompt_text = f"Synthesize tool for pattern: {pattern.title} ({pattern.description})"
        prompt_hash = hashlib.sha256(prompt_text.encode("utf-8")).hexdigest()
        code_hash = hashlib.sha256(generated_code.encode("utf-8")).hexdigest()

        # Heuristic confidence score (never a fake 0.92)
        # Based on pattern observation frequency and AST hygiene
        heuristic_score = min(0.75, (pattern.frequency / 10.0) * 0.5 + (0.25 if passed else 0.0))

        input_schema = {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Target input query for processing"}
            },
            "required": ["query"],
        }
        output_schema = {
            "type": "object",
            "properties": {
                "tool": {"type": "string"},
                "processed_query": {"type": "string"},
                "status": {"type": "string"},
            },
        }

        proposal = SkillProposal(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            cluster_id=pattern.id,
            name=resolved_name,
            description=f"Auto-generated proposal for '{pattern.title}'. Addresses recurring queries like: {', '.join((pattern.sample_queries or [])[:2])}",
            language="python",
            code=generated_code,
            input_schema=input_schema,
            output_schema=output_schema,
            confidence_score=round(heuristic_score, 3),
            status="proposed",  # Strictly proposed, never auto-verified
            review_status="unreviewed",
            reviewer=None,
            model_provider="heuristic_scaffolder_v1",
            prompt_hash=prompt_hash,
            code_hash=code_hash,
            static_analysis_passed=passed,
            static_analysis_findings=findings,
            created_at=datetime.now(timezone.utc),
        )

        if self.db:
            self.db.add(proposal)
            pattern.status = "proposed"
            await self.db.commit()
            await self.db.refresh(proposal)

        return proposal
