"""add auditable memory fields, audit_logs table, and row-level security

Revision ID: 004
Revises: 003
Create Date: 2026-09-04 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Backfill any existing memories with missing tenant_id before enforcing NOT NULL
    op.execute("""
        DO $$
        DECLARE
            default_tenant_id UUID;
        BEGIN
            IF EXISTS (SELECT 1 FROM memories WHERE tenant_id IS NULL) THEN
                SELECT id INTO default_tenant_id FROM tenants LIMIT 1;
                IF default_tenant_id IS NULL THEN
                    default_tenant_id := gen_random_uuid();
                    INSERT INTO tenants (id, name, created_at)
                    VALUES (default_tenant_id, 'default_migration_tenant', now());
                END IF;
                UPDATE memories SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
            END IF;
        END $$;
    """)

    # Enforce NOT NULL on memories.tenant_id
    op.alter_column('memories', 'tenant_id', existing_type=postgresql.UUID(as_uuid=True), nullable=False)

    # 2. Add auditable columns to memories
    op.add_column('memories', sa.Column('memory_type', sa.String(length=32), nullable=False, server_default='context'))
    op.add_column('memories', sa.Column('status', sa.String(length=32), nullable=False, server_default='active'))
    op.add_column('memories', sa.Column('confidence', sa.Float(), nullable=False, server_default='0.9'))
    op.add_column('memories', sa.Column('recall_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('memories', sa.Column('source_type', sa.String(length=64), nullable=False, server_default='user_prompt'))
    op.add_column('memories', sa.Column('source_id', sa.String(length=128), nullable=True))
    op.add_column('memories', sa.Column('document_id', sa.String(length=128), nullable=True))
    op.add_column('memories', sa.Column('message_id', sa.String(length=128), nullable=True))
    op.add_column('memories', sa.Column('valid_from', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')))
    op.add_column('memories', sa.Column('valid_until', sa.DateTime(timezone=True), nullable=True))
    op.add_column('memories', sa.Column('last_recalled_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('memories', sa.Column('legal_basis', sa.String(length=64), nullable=True))
    op.add_column('memories', sa.Column('retention_policy', sa.String(length=64), nullable=True))
    op.add_column('memories', sa.Column('forget_requested_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('memories', sa.Column('forgotten_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('memories', sa.Column('created_by', sa.String(length=128), nullable=True))
    op.add_column('memories', sa.Column('updated_by', sa.String(length=128), nullable=True))
    op.add_column('memories', sa.Column('embedding_provider', sa.String(length=64), nullable=False, server_default='gemini'))
    op.add_column('memories', sa.Column('embedding_model', sa.String(length=64), nullable=False, server_default='text-embedding-004'))
    op.add_column('memories', sa.Column('embedding_dim', sa.Integer(), nullable=False, server_default='768'))

    op.create_index('ix_memories_tenant_status', 'memories', ['tenant_id', 'status'], unique=False)
    op.create_index('ix_memories_tenant_cluster', 'memories', ['tenant_id', 'cluster'], unique=False)
    op.create_index(op.f('ix_memories_memory_type'), 'memories', ['memory_type'], unique=False)
    op.create_index(op.f('ix_memories_status'), 'memories', ['status'], unique=False)

    # 3. Create audit_logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('target_type', sa.String(length=64), nullable=False),
        sa.Column('target_id', sa.String(length=128), nullable=False),
        sa.Column('action', sa.String(length=64), nullable=False),
        sa.Column('actor_type', sa.String(length=32), nullable=False, server_default='user'),
        sa.Column('actor_id', sa.String(length=128), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index(op.f('ix_audit_logs_id'), 'audit_logs', ['id'], unique=False)
    op.create_index(op.f('ix_audit_logs_tenant_id'), 'audit_logs', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_action'), 'audit_logs', ['action'], unique=False)
    op.create_index(op.f('ix_audit_logs_timestamp'), 'audit_logs', ['timestamp'], unique=False)
    op.create_index('ix_audit_logs_tenant_timestamp', 'audit_logs', ['tenant_id', 'timestamp'], unique=False)
    op.create_index('ix_audit_logs_tenant_target', 'audit_logs', ['tenant_id', 'target_type', 'target_id'], unique=False)

    # 4. Enable Row Level Security (RLS) on tenant-owned tables
    op.execute("ALTER TABLE memories ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE experience_logs ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE pattern_clusters ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE skill_proposals ENABLE ROW LEVEL SECURITY;")

    # Create tenant isolation RLS policies
    op.execute("""
        CREATE POLICY tenant_isolation_memories ON memories
        FOR ALL
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
    """)

    op.execute("""
        CREATE POLICY tenant_isolation_audit_logs ON audit_logs
        FOR ALL
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
    """)

    op.execute("""
        CREATE POLICY tenant_isolation_experience_logs ON experience_logs
        FOR ALL
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
    """)

    op.execute("""
        CREATE POLICY tenant_isolation_pattern_clusters ON pattern_clusters
        FOR ALL
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
    """)

    op.execute("""
        CREATE POLICY tenant_isolation_skill_proposals ON skill_proposals
        FOR ALL
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
    """)


def downgrade() -> None:
    # Drop RLS policies
    op.execute("DROP POLICY IF EXISTS tenant_isolation_skill_proposals ON skill_proposals;")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_pattern_clusters ON pattern_clusters;")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_experience_logs ON experience_logs;")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_audit_logs ON audit_logs;")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_memories ON memories;")

    # Disable RLS
    op.execute("ALTER TABLE skill_proposals DISABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE pattern_clusters DISABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE experience_logs DISABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE memories DISABLE ROW LEVEL SECURITY;")

    # Drop audit_logs table
    op.drop_table('audit_logs')

    # Drop added memory columns
    op.drop_index('ix_memories_tenant_cluster', table_name='memories')
    op.drop_index('ix_memories_tenant_status', table_name='memories')
    op.drop_index(op.f('ix_memories_status'), table_name='memories')
    op.drop_index(op.f('ix_memories_memory_type'), table_name='memories')

    for col in [
        'embedding_dim', 'embedding_model', 'embedding_provider', 'updated_by', 'created_by',
        'forgotten_at', 'forget_requested_at', 'retention_policy', 'legal_basis', 'last_recalled_at',
        'valid_until', 'valid_from', 'message_id', 'document_id', 'source_id', 'source_type',
        'recall_count', 'confidence', 'status', 'memory_type'
    ]:
        op.drop_column('memories', col)
