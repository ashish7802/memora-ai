"""
Row-Level Security (RLS) & Multi-Tenant Isolation Test Matrix.

This test suite strictly verifies:
1. Tests execute under a non-superuser application role (`memora_app`) with NO SUPERUSER and NO BYPASSRLS.
2. FORCE ROW LEVEL SECURITY and ENABLE ROW LEVEL SECURITY are active on all tenant-isolated tables.
3. Tenant B cannot read, search, update, delete, prune, or count Tenant A memories.
4. Tenant B cannot read Tenant A experience logs, pattern clusters, skill proposals, or audit logs.
5. Missing tenant context safely fails closed (returns 0 rows).
6. RLS enforces tenant isolation even when SQLAlchemy queries deliberately omit the `tenant_id` WHERE predicate.
7. Connection pool reuse does not leak tenant context across sessions.
"""

import os
import uuid
from datetime import datetime, timezone
import pytest
import pytest_asyncio
from sqlalchemy import text, select, func, delete, update
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.memory.models import MemoryRecord, AuditLogRecord
from app.learning.models import ExperienceLog, PatternCluster, SkillProposal
from app.auth.models import Tenant, User, APIKey
from app.core.database import set_tenant_context

TEST_DATABASE_URL = os.getenv(
    "APP_ROLE_DATABASE_URL",
    "postgresql+asyncpg://memora_app:memora_secret@127.0.0.1:5432/memora_test",
)


@pytest_asyncio.fixture
async def db_engine():
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        pool_size=5,
        max_overflow=0,
    )
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def session_factory(db_engine):
    return async_sessionmaker(
        bind=db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )


async def ensure_tenants(session: AsyncSession, tenant_a_id: uuid.UUID, tenant_b_id: uuid.UUID):
    """Seed tenant records with created_at timestamp."""
    await session.execute(
        text("""
            INSERT INTO tenants (id, name, created_at)
            VALUES (:id_a, :name_a, NOW()), (:id_b, :name_b, NOW())
            ON CONFLICT (id) DO NOTHING
        """),
        {
            "id_a": tenant_a_id,
            "name_a": f"Tenant_A_{tenant_a_id.hex[:8]}",
            "id_b": tenant_b_id,
            "name_b": f"Tenant_B_{tenant_b_id.hex[:8]}",
        },
    )
    await session.commit()


@pytest.mark.asyncio
async def test_01_verify_role_is_non_superuser(session_factory):
    """Prove that the testing role is NOT a superuser and does NOT have BYPASSRLS."""
    async with session_factory() as session:
        result = await session.execute(
            text("""
                SELECT current_user, rolsuper, rolbypassrls
                FROM pg_roles
                WHERE rolname = current_user;
            """)
        )
        row = result.fetchone()
        assert row is not None, "Could not query current_user role properties"
        current_user, rolsuper, rolbypassrls = row
        assert rolsuper is False, f"CRITICAL: Testing role '{current_user}' must NOT be a superuser!"
        assert rolbypassrls is False, f"CRITICAL: Testing role '{current_user}' must NOT have BYPASSRLS!"


@pytest.mark.asyncio
async def test_02_verify_force_rls_on_tables(session_factory):
    """Prove that all tenant-owned tables have ENABLE RLS and FORCE RLS active."""
    tables = [
        "memories",
        "audit_logs",
        "experience_logs",
        "pattern_clusters",
        "skill_proposals",
    ]
    async with session_factory() as session:
        for tbl in tables:
            result = await session.execute(
                text(f"""
                    SELECT relrowsecurity, relforcerowsecurity
                    FROM pg_class
                    WHERE relname = '{tbl}';
                """)
            )
            row = result.fetchone()
            assert row is not None, f"Table {tbl} not found in pg_class"
            rls_enabled, rls_forced = row
            assert rls_enabled is True, f"Table {tbl} must have relrowsecurity=True"
            assert rls_forced is True, f"Table {tbl} must have relforcerowsecurity=True"


@pytest.mark.asyncio
async def test_03_tenant_b_cannot_read_tenant_a_memory(session_factory):
    """Prove Tenant B cannot read Tenant A memories by ID or listing."""
    tenant_a_id = uuid.uuid4()
    tenant_b_id = uuid.uuid4()
    mem_a_id = uuid.uuid4()

    async with session_factory() as session:
        await ensure_tenants(session, tenant_a_id, tenant_b_id)

        # Insert memory as Tenant A
        await set_tenant_context(session, tenant_a_id)
        mem = MemoryRecord(
            id=mem_a_id,
            tenant_id=tenant_a_id,
            text="Confidential strategy data for Tenant A",
            session_id="sess_a",
            cluster="general",
            importance=1.0,
            embedding=[0.1] * 768,
            access_count=0.0,
            metadata={},
        )
        session.add(mem)
        await session.commit()

    # Step 2: Tenant A verifies they can read their memory
    async with session_factory() as session:
        await set_tenant_context(session, tenant_a_id)
        res_a = await session.execute(select(MemoryRecord).where(MemoryRecord.id == mem_a_id))
        assert res_a.scalar_one_or_none() is not None, "Tenant A should be able to read own memory"

    # Step 3: Tenant B attempts to read Tenant A memory by ID
    async with session_factory() as session:
        await set_tenant_context(session, tenant_b_id)
        res_b = await session.execute(select(MemoryRecord).where(MemoryRecord.id == mem_a_id))
        assert res_b.scalar_one_or_none() is None, "Tenant B must NOT be able to read Tenant A memory by ID!"

        # Tenant B lists all memories
        list_b = await session.execute(select(MemoryRecord.id))
        rows_b = list_b.fetchall()
        for r in rows_b:
            assert r[0] != mem_a_id, "Tenant B memory list must never include Tenant A memory!"


@pytest.mark.asyncio
async def test_04_tenant_b_cannot_search_tenant_a_memory(session_factory):
    """Prove Tenant B vector search never returns Tenant A memories."""
    tenant_a_id = uuid.uuid4()
    tenant_b_id = uuid.uuid4()
    mem_a_id = uuid.uuid4()

    async with session_factory() as session:
        await ensure_tenants(session, tenant_a_id, tenant_b_id)

        # Insert vector under Tenant A
        await set_tenant_context(session, tenant_a_id)
        mem = MemoryRecord(
            id=mem_a_id,
            tenant_id=tenant_a_id,
            text="Target vector for cosine similarity test",
            session_id="sess_search",
            cluster="security",
            importance=2.0,
            embedding=[0.5] * 768,
            access_count=0.0,
            metadata={},
        )
        session.add(mem)
        await session.commit()

    # As Tenant B, run vector cosine similarity search with exact same vector
    async with session_factory() as session:
        await set_tenant_context(session, tenant_b_id)
        # Using pgvector distance operator <=>
        stmt = (
            select(MemoryRecord.id)
            .order_by(MemoryRecord.embedding.cosine_distance([0.5] * 768))
            .limit(5)
        )
        search_res = await session.execute(stmt)
        results = search_res.fetchall()
        for r in results:
            assert r[0] != mem_a_id, "Tenant B vector search leaked Tenant A memory!"


@pytest.mark.asyncio
async def test_05_tenant_b_cannot_update_or_delete_tenant_a_memory(session_factory):
    """Prove Tenant B cannot mutate or delete Tenant A memory."""
    tenant_a_id = uuid.uuid4()
    tenant_b_id = uuid.uuid4()
    mem_a_id = uuid.uuid4()

    async with session_factory() as session:
        await ensure_tenants(session, tenant_a_id, tenant_b_id)

        # Insert Tenant A record
        await set_tenant_context(session, tenant_a_id)
        mem = MemoryRecord(
            id=mem_a_id,
            tenant_id=tenant_a_id,
            text="Original text by Tenant A",
            session_id="sess_mut",
            cluster="general",
            importance=1.0,
            embedding=[0.2] * 768,
            access_count=0.0,
            metadata={},
        )
        session.add(mem)
        await session.commit()

    # Tenant B tries to UPDATE Tenant A record
    async with session_factory() as session:
        await set_tenant_context(session, tenant_b_id)
        upd = await session.execute(
            update(MemoryRecord)
            .where(MemoryRecord.id == mem_a_id)
            .values(text="Hacked by Tenant B")
        )
        await session.commit()
        assert upd.rowcount == 0, "Tenant B must NOT be able to update Tenant A memory!"

    # Tenant B tries to DELETE Tenant A record
    async with session_factory() as session:
        await set_tenant_context(session, tenant_b_id)
        del_res = await session.execute(
            delete(MemoryRecord).where(MemoryRecord.id == mem_a_id)
        )
        await session.commit()
        assert del_res.rowcount == 0, "Tenant B must NOT be able to delete Tenant A memory!"

    # Tenant A verifies their record is completely intact and untampered
    async with session_factory() as session:
        await set_tenant_context(session, tenant_a_id)
        check = await session.execute(
            select(MemoryRecord.text).where(MemoryRecord.id == mem_a_id)
        )
        row = check.fetchone()
        assert row is not None
        assert row[0] == "Original text by Tenant A"


@pytest.mark.asyncio
async def test_06_tenant_b_cannot_prune_or_count_tenant_a_memory(session_factory):
    """Prove Tenant B cannot count or prune Tenant A memories."""
    tenant_a_id = uuid.uuid4()
    tenant_b_id = uuid.uuid4()

    async with session_factory() as session:
        await ensure_tenants(session, tenant_a_id, tenant_b_id)

        # Insert 3 memories for Tenant A with low importance
        await set_tenant_context(session, tenant_a_id)
        for i in range(3):
            mem = MemoryRecord(
                id=uuid.uuid4(),
                tenant_id=tenant_a_id,
                text=f"Prune test {i}",
                session_id="sess_prune",
                cluster="general",
                importance=0.1,
                embedding=[0.1] * 768,
                access_count=0.0,
                metadata={},
            )
            session.add(mem)
        await session.commit()

    # Tenant B counts memories -> must be 0 (if Tenant B has no memories)
    async with session_factory() as session:
        await set_tenant_context(session, tenant_b_id)
        count_res = await session.execute(select(func.count(MemoryRecord.id)))
        assert count_res.scalar() == 0, "Tenant B count must NOT include Tenant A memories!"

        # Tenant B executes a bulk prune command
        prune_res = await session.execute(
            delete(MemoryRecord).where(MemoryRecord.importance <= 1.0)
        )
        await session.commit()
        assert prune_res.rowcount == 0, "Tenant B prune must not delete Tenant A memories!"

    # Tenant A verifies their 3 memories remain
    async with session_factory() as session:
        await set_tenant_context(session, tenant_a_id)
        count_a = await session.execute(
            select(func.count(MemoryRecord.id)).where(MemoryRecord.session_id == "sess_prune")
        )
        assert count_a.scalar() == 3, "Tenant A memories must remain intact after Tenant B prune attempt"


@pytest.mark.asyncio
async def test_07_tenant_b_cannot_read_tenant_a_logs_or_patterns(session_factory):
    """Prove Tenant B cannot read experience logs, pattern clusters, skill proposals, or audit logs of Tenant A."""
    tenant_a_id = uuid.uuid4()
    tenant_b_id = uuid.uuid4()

    exp_id = uuid.uuid4()
    pattern_id = uuid.uuid4()
    skill_id = uuid.uuid4()
    audit_id = uuid.uuid4()

    async with session_factory() as session:
        await ensure_tenants(session, tenant_a_id, tenant_b_id)

        # Insert records for Tenant A
        await set_tenant_context(session, tenant_a_id)
        exp = ExperienceLog(
            id=exp_id,
            tenant_id=tenant_a_id,
            session_id="sess_log",
            user_query="Query A",
            agent_response="Response A",
            tool_input={},
            tool_result={},
            success=True,
            latency_ms=12.0,
        )
        session.add(exp)

        pat = PatternCluster(
            id=pattern_id,
            tenant_id=tenant_a_id,
            title="Cluster A",
            description="Pattern of Tenant A",
            category="general",
            sample_queries=[],
        )
        session.add(pat)

        skill = SkillProposal(
            id=skill_id,
            tenant_id=tenant_a_id,
            name=f"skill_a_{uuid.uuid4().hex[:6]}",
            description="Skill of Tenant A",
            code="def run(): pass",
            input_schema={},
            output_schema={},
        )
        session.add(skill)

        aud = AuditLogRecord(
            id=audit_id,
            tenant_id=tenant_a_id,
            action="created",
            target_type="memory",
            target_id="target_123",
            metadata_={},
        )
        session.add(aud)

        await session.commit()

    # Query as Tenant B
    async with session_factory() as session:
        await set_tenant_context(session, tenant_b_id)
        exp_b = await session.execute(select(ExperienceLog.id).where(ExperienceLog.id == exp_id))
        assert exp_b.fetchone() is None, "Tenant B must not read Tenant A experience logs"

        pat_b = await session.execute(select(PatternCluster.id).where(PatternCluster.id == pattern_id))
        assert pat_b.fetchone() is None, "Tenant B must not read Tenant A pattern clusters"

        sk_b = await session.execute(select(SkillProposal.id).where(SkillProposal.id == skill_id))
        assert sk_b.fetchone() is None, "Tenant B must not read Tenant A skill proposals"

        aud_b = await session.execute(select(AuditLogRecord.id).where(AuditLogRecord.id == audit_id))
        assert aud_b.fetchone() is None, "Tenant B must not read Tenant A audit logs"


@pytest.mark.asyncio
async def test_08_missing_tenant_context_fails_closed(session_factory):
    """Prove that missing or empty tenant context returns 0 rows (fail closed)."""
    async with session_factory() as session:
        # DO NOT set app.current_tenant_id
        # PostgreSQL evaluates NULLIF(current_setting('app.current_tenant_id', true), '')::uuid as NULL
        # Any condition tenant_id = NULL evaluates to UNKNOWN / False
        res_mem = await session.execute(select(MemoryRecord.id))
        assert len(res_mem.fetchall()) == 0, "Missing tenant context must return 0 memories"

        res_count = await session.execute(select(func.count(MemoryRecord.id)))
        assert res_count.scalar() == 0, "Missing tenant context must count 0 memories"

        res_aud = await session.execute(select(AuditLogRecord.id))
        assert len(res_aud.fetchall()) == 0, "Missing tenant context must return 0 audit logs"

        res_exp = await session.execute(select(ExperienceLog.id))
        assert len(res_exp.fetchall()) == 0, "Missing tenant context must return 0 experience logs"


@pytest.mark.asyncio
async def test_09_rls_blocks_access_when_sqlalchemy_predicate_omitted(session_factory):
    """
    Prove that RLS enforces tenant isolation even when the developer forgets or deliberately omits
    the tenant_id filter in SQLAlchemy query (e.g. select(MemoryRecord).where(MemoryRecord.id == mem_id)).
    """
    tenant_a_id = uuid.uuid4()
    tenant_b_id = uuid.uuid4()
    mem_a_id = uuid.uuid4()

    async with session_factory() as session:
        await ensure_tenants(session, tenant_a_id, tenant_b_id)

        # Insert as Tenant A
        await set_tenant_context(session, tenant_a_id)
        mem = MemoryRecord(
            id=mem_a_id,
            tenant_id=tenant_a_id,
            text="SQLAlchemy omitted predicate test memory",
            session_id="sess_pred",
            cluster="test",
            importance=1.0,
            embedding=[0.3] * 768,
            access_count=0.0,
            metadata={},
        )
        session.add(mem)
        await session.commit()

    # Now, as Tenant B, construct an ORM query that DELIBERATELY OMITS `tenant_id == ...`
    async with session_factory() as session:
        await set_tenant_context(session, tenant_b_id)

        # Omit tenant predicate: only filter by memory ID!
        stmt = select(MemoryRecord).where(MemoryRecord.id == mem_a_id)
        result = await session.execute(stmt)
        record = result.scalars().first()

        assert record is None, (
            "CRITICAL: RLS failed! Deliberately omitting the SQLAlchemy tenant_id predicate "
            "must still return None because PostgreSQL RLS enforces tenant boundary at the DB level!"
        )


@pytest.mark.asyncio
async def test_10_connection_pool_reuse_isolation(session_factory):
    """
    Prove that reusing pooled connections between Tenant A and Tenant B does NOT leak tenant context.
    1. Execute Tenant A request on connection from pool.
    2. Return connection to pool (session close / commit).
    3. Check out connection for Tenant B and prove Tenant A data is isolated.
    4. Check out connection without tenant context and prove it fails closed.
    """
    tenant_a_id = uuid.uuid4()
    tenant_b_id = uuid.uuid4()
    mem_a_id = uuid.uuid4()
    mem_b_id = uuid.uuid4()

    # Seed Tenant A & B
    async with session_factory() as session:
        await ensure_tenants(session, tenant_a_id, tenant_b_id)

    # Phase 1: Tenant A checks out connection, writes memory, reads memory, releases back to pool
    async with session_factory() as session_a:
        await set_tenant_context(session_a, tenant_a_id)
        mem_a = MemoryRecord(
            id=mem_a_id,
            tenant_id=tenant_a_id,
            text="Pooled connection memory Tenant A",
            session_id="pool_test",
            cluster="pool",
            importance=1.0,
            embedding=[0.4] * 768,
            access_count=0.0,
            metadata={},
        )
        session_a.add(mem_a)
        await session_a.commit()

        # In a new transaction for Tenant A:
        await set_tenant_context(session_a, tenant_a_id)
        count_a = await session_a.execute(
            select(func.count(MemoryRecord.id)).where(MemoryRecord.session_id == "pool_test")
        )
        assert count_a.scalar() == 1

    # Connection is now returned to pool.

    # Phase 2: Tenant B checks out connection from the pool, writes Tenant B memory
    async with session_factory() as session_b:
        await set_tenant_context(session_b, tenant_b_id)
        mem_b = MemoryRecord(
            id=mem_b_id,
            tenant_id=tenant_b_id,
            text="Pooled connection memory Tenant B",
            session_id="pool_test",
            cluster="pool",
            importance=1.0,
            embedding=[0.4] * 768,
            access_count=0.0,
            metadata={},
        )
        session_b.add(mem_b)
        await session_b.commit()

        # Tenant B queries memories with session_id='pool_test':
        # MUST ONLY SEE 1 record (their own), NEVER Tenant A's record!
        await set_tenant_context(session_b, tenant_b_id)
        b_records = await session_b.execute(
            select(MemoryRecord.id, MemoryRecord.text).where(MemoryRecord.session_id == "pool_test")
        )
        rows = b_records.fetchall()
        assert len(rows) == 1, f"Tenant B must see exactly 1 record, got {len(rows)}"
        assert rows[0][0] == mem_b_id, "Tenant B must only see mem_b"

    # Phase 3: Check out connection from pool with NO tenant context set.
    # Must NOT retain Tenant A or Tenant B context!
    async with session_factory() as session_neutral:
        neutral_records = await session_neutral.execute(
            select(MemoryRecord.id).where(MemoryRecord.session_id == "pool_test")
        )
        neutral_rows = neutral_records.fetchall()
        assert len(neutral_rows) == 0, (
            "CRITICAL LEAK: Connection checked out without tenant context must see 0 rows, "
            f"but found {len(neutral_rows)} rows!"
        )
