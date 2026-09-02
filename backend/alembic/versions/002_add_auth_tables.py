"""add auth tables and multi-tenant isolation

Revision ID: 002
Revises: 001
Create Date: 2026-09-02 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create tenants table
    op.create_table(
        'tenants',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False, unique=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f('ix_tenants_id'), 'tenants', ['id'], unique=False)
    op.create_index(op.f('ix_tenants_name'), 'tenants', ['name'], unique=True)

    # 2. Create users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False, unique=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_tenant_id'), 'users', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # 3. Create api_keys table
    op.create_table(
        'api_keys',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False, server_default='default'),
        sa.Column('key_hash', sa.String(length=128), nullable=False, unique=True),
        sa.Column('prefix', sa.String(length=16), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_used', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
    )
    op.create_index(op.f('ix_api_keys_id'), 'api_keys', ['id'], unique=False)
    op.create_index(op.f('ix_api_keys_user_id'), 'api_keys', ['user_id'], unique=False)
    op.create_index(op.f('ix_api_keys_tenant_id'), 'api_keys', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_api_keys_key_hash'), 'api_keys', ['key_hash'], unique=True)
    op.create_index(op.f('ix_api_keys_is_active'), 'api_keys', ['is_active'], unique=False)

    # 4. Add tenant_id to memories, experience_logs, pattern_clusters, skill_proposals
    op.add_column('memories', sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_memories_tenant_id', 'memories', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
    op.create_index(op.f('ix_memories_tenant_id'), 'memories', ['tenant_id'], unique=False)
    op.create_index('ix_memories_tenant_session', 'memories', ['tenant_id', 'session_id'], unique=False)

    op.add_column('experience_logs', sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_experience_logs_tenant_id', 'experience_logs', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
    op.create_index(op.f('ix_experience_logs_tenant_id'), 'experience_logs', ['tenant_id'], unique=False)

    op.add_column('pattern_clusters', sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_pattern_clusters_tenant_id', 'pattern_clusters', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
    op.create_index(op.f('ix_pattern_clusters_tenant_id'), 'pattern_clusters', ['tenant_id'], unique=False)

    op.add_column('skill_proposals', sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_skill_proposals_tenant_id', 'skill_proposals', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
    op.create_index(op.f('ix_skill_proposals_tenant_id'), 'skill_proposals', ['tenant_id'], unique=False)


def downgrade() -> None:
    op.drop_constraint('fk_skill_proposals_tenant_id', 'skill_proposals', type_='foreignkey')
    op.drop_index(op.f('ix_skill_proposals_tenant_id'), table_name='skill_proposals')
    op.drop_column('skill_proposals', 'tenant_id')

    op.drop_constraint('fk_pattern_clusters_tenant_id', 'pattern_clusters', type_='foreignkey')
    op.drop_index(op.f('ix_pattern_clusters_tenant_id'), table_name='pattern_clusters')
    op.drop_column('pattern_clusters', 'tenant_id')

    op.drop_constraint('fk_experience_logs_tenant_id', 'experience_logs', type_='foreignkey')
    op.drop_index(op.f('ix_experience_logs_tenant_id'), table_name='experience_logs')
    op.drop_column('experience_logs', 'tenant_id')

    op.drop_index('ix_memories_tenant_session', table_name='memories')
    op.drop_constraint('fk_memories_tenant_id', 'memories', type_='foreignkey')
    op.drop_index(op.f('ix_memories_tenant_id'), table_name='memories')
    op.drop_column('memories', 'tenant_id')

    op.drop_table('api_keys')
    op.drop_table('users')
    op.drop_table('tenants')
