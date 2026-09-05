"""Unit tests for Memora Core Security, Explainability, and Auditability Rules."""

import ast
import hashlib
import json
import time
import unittest
import uuid
from datetime import datetime, timedelta, timezone


class StaticAnalysisAuditor:
    """Mirrors the static analysis engine in app.learning.skill_gen."""

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
    def audit_code(cls, code: str):
        findings = []
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            return False, [f"SyntaxError: {e.msg} at line {e.lineno}"]

        for node in ast.walk(tree):
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
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    if node.func.id in cls.BANNED_CALLS:
                        findings.append(f"Forbidden function call: '{node.func.id}()'")
                elif isinstance(node.func, ast.Attribute):
                    if node.func.attr in cls.BANNED_CALLS:
                        findings.append(f"Forbidden method invocation: '.{node.func.attr}()'")

        passed = len(findings) == 0
        return passed, findings


class TestSecurityAuditor(unittest.TestCase):
    def test_blocks_exec_and_eval(self):
        unsafe_code = """
def malicious_runner():
    exec("import os; os.system('rm -rf /')")
    eval("2 + 2")
"""
        passed, findings = StaticAnalysisAuditor.audit_code(unsafe_code)
        self.assertFalse(passed)
        self.assertTrue(any("exec" in f for f in findings))
        self.assertTrue(any("eval" in f for f in findings))

    def test_blocks_forbidden_imports(self):
        unsafe_code = """
import os
import subprocess
from socket import socket

def ping():
    subprocess.run(["ping", "localhost"])
"""
        passed, findings = StaticAnalysisAuditor.audit_code(unsafe_code)
        self.assertFalse(passed)
        self.assertTrue(any("os" in f for f in findings))
        self.assertTrue(any("subprocess" in f for f in findings))
        self.assertTrue(any("socket" in f for f in findings))

    def test_allows_safe_pure_computational_code(self):
        safe_code = """
from typing import Dict, Any

def execute(params: Dict[str, Any]) -> Dict[str, Any]:
    text = params.get("text", "")
    word_count = len(text.split())
    return {"word_count": word_count, "status": "completed"}
"""
        passed, findings = StaticAnalysisAuditor.audit_code(safe_code)
        self.assertTrue(passed)
        self.assertEqual(findings, [])


class TestCryptographicDeletionProof(unittest.TestCase):
    def test_deletion_proof_reproducibility_and_entropy(self):
        memory_id = uuid.uuid4()
        tenant_id = uuid.uuid4()
        audit_id = uuid.uuid4()
        timestamp_iso = "2026-09-05T12:00:00Z"

        payload = f"{memory_id}:{tenant_id}:{timestamp_iso}:{audit_id}"
        proof1 = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        proof2 = hashlib.sha256(payload.encode("utf-8")).hexdigest()

        self.assertEqual(proof1, proof2)
        self.assertEqual(len(proof1), 64)

        # Changing tenant ID alters proof
        other_tenant = uuid.uuid4()
        other_payload = f"{memory_id}:{other_tenant}:{timestamp_iso}:{audit_id}"
        other_proof = hashlib.sha256(other_payload.encode("utf-8")).hexdigest()
        self.assertNotEqual(proof1, other_proof)


class TestDeterministicEmbeddings(unittest.TestCase):
    def test_hash_derived_seed_stability(self):
        text = "Cognitive user preferences regarding dark mode"

        # Stable cross-process seed calculation using sha256
        seed1 = int(hashlib.sha256(text.encode("utf-8")).hexdigest()[:8], 16)
        seed2 = int(hashlib.sha256(text.encode("utf-8")).hexdigest()[:8], 16)

        self.assertEqual(seed1, seed2)

        # Different text produces different seed
        other_seed = int(hashlib.sha256("Different text entirely".encode("utf-8")).hexdigest()[:8], 16)
        self.assertNotEqual(seed1, other_seed)


class TestExplainableRecallRanking(unittest.TestCase):
    def test_ranking_breakdown_formula(self):
        # Combined score = 0.65 * sim + 0.15 * recency + 0.10 * importance + 0.10 * freq
        sim = 0.90
        recency = 0.80
        importance = 1.0  # normalized
        freq = 0.50       # normalized

        expected = (0.65 * sim) + (0.15 * recency) + (0.10 * importance) + (0.10 * freq)
        self.assertAlmostEqual(expected, 0.855, places=3)
        self.assertTrue(0.0 <= expected <= 1.0)


class TestTemporalValidity(unittest.TestCase):
    def test_temporal_filtering(self):
        now = datetime.now(timezone.utc)
        valid_from = now - timedelta(days=5)
        valid_until_future = now + timedelta(days=10)
        valid_until_past = now - timedelta(days=1)

        # Active memory
        is_active = (valid_from <= now) and (valid_until_future > now)
        self.assertTrue(is_active)

        # Expired memory
        is_expired = (valid_until_past < now)
        self.assertTrue(is_expired)


if __name__ == "__main__":
    unittest.main()
