"""add learning tables for experience logs, pattern clusters, and skill proposals

Revision ID: 003
Revises: 002
Create Date: 2026-09-03 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create experience_logs table
    op.create_table(
        'experience_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=True),
        sa.Column('session_id', sa.String(length=128), nullable=False, server_default='default'),
        sa.Column('user_query', sa.Text(), nullable=False),
        sa.Column('agent_response', sa.Text(), nullable=False),
        sa.Column('tool_used', sa.String(length=128), nullable=True),
        sa.Column('tool_input', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('tool_result', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('success', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('latency_ms', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index(op.f('ix_experience_logs_id'), 'experience_logs', ['id'], unique=False)
    op.create_index(op.f('ix_experience_logs_tenant_id'), 'experience_logs', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_experience_logs_session_id'), 'experience_logs', ['session_id'], unique=False)
    op.create_index(op.f('ix_experience_logs_tool_used'), 'experience_logs', ['tool_used'], unique=False)
    op.create_index(op.f('ix_experience_logs_success'), 'experience_logs', ['success'], unique=False)
    op.create_index(op.f('ix_experience_logs_created_at'), 'experience_logs', ['created_at'], unique=False)

    # 2. Create pattern_clusters table
    op.create_table(
        'pattern_clusters',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=True),
        sa.Column('session_id', sa.String(length=128), nullable=True),
        sa.Column('title', sa.String(length=256), nullable=False),
        sa.Column('category', sa.String(length=64), nullable=False, server_default='general'),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('frequency', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('failure_rate', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('sample_queries', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('suggested_tool_name', sa.String(length=128), nullable=True),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='detected'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index(op.f('ix_pattern_clusters_id'), 'pattern_clusters', ['id'], unique=False)
    op.create_index(op.f('ix_pattern_clusters_tenant_id'), 'pattern_clusters', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_pattern_clusters_session_id'), 'pattern_clusters', ['session_id'], unique=False)
    op.create_index(op.f('ix_pattern_clusters_category'), 'pattern_clusters', ['category'], unique=False)
    op.create_index(op.f('ix_pattern_clusters_status'), 'pattern_clusters', ['status'], unique=False)

    # 3. Create skill_proposals table
    op.create_table(
        'skill_proposals',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=True),
        sa.Column('cluster_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('name', sa.String(length=128), nullable=False, unique=True),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('language', sa.String(length=32), nullable=False, server_default='python'),
        sa.Column('code', sa.Text(), nullable=False),
        sa.Column('input_schema', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('output_schema', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('confidence_score', sa.Float(), nullable=False, server_default='0.85'),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='proposed'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index(op.f('ix_skill_proposals_id'), 'skill_proposals', ['id'], unique=False)
    op.create_index(op.f('ix_skill_proposals_tenant_id'), 'skill_proposals', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_skill_proposals_cluster_id'), 'skill_proposals', ['cluster_id'], unique=False)
    op.create_index(op.f('ix_skill_proposals_name'), 'skill_proposals', ['name'], unique=True)
    op.create_index(op.f('ix_skill_proposals_status'), 'skill_proposals', ['status'], unique=False)


def downgrade() -> None:
    op.drop_table('skill_proposals')
    op.drop_table('pattern_clusters')
    op.drop_table('experience_logs')
