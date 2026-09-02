"""create memory tables with pgvector extension

Revision ID: 001_create_memory_tables
Revises: 
Create Date: 2026-09-02 00:00:00.000000

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_create_memory_tables'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    op.create_table(
        'memories',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('session_id', sa.String(length=128), nullable=False),
        sa.Column('user_id', sa.String(length=128), nullable=True),
        sa.Column('agent_id', sa.String(length=128), nullable=True),
        sa.Column('cluster', sa.String(length=64), nullable=False),
        sa.Column('importance', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('access_count', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('embedding', Vector(768), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('last_accessed_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_index(op.f('ix_memories_id'), 'memories', ['id'], unique=False)
    op.create_index(op.f('ix_memories_session_id'), 'memories', ['session_id'], unique=False)
    op.create_index(op.f('ix_memories_user_id'), 'memories', ['user_id'], unique=False)
    op.create_index(op.f('ix_memories_agent_id'), 'memories', ['agent_id'], unique=False)
    op.create_index(op.f('ix_memories_cluster'), 'memories', ['cluster'], unique=False)
    op.create_index(op.f('ix_memories_created_at'), 'memories', ['created_at'], unique=False)

    # HNSW Index for fast sub-millisecond approximate nearest neighbor cosine search
    op.execute(
        "CREATE INDEX ix_memories_embedding_hnsw ON memories USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_memories_embedding_hnsw;")
    op.drop_index(op.f('ix_memories_created_at'), table_name='memories')
    op.drop_index(op.f('ix_memories_cluster'), table_name='memories')
    op.drop_index(op.f('ix_memories_agent_id'), table_name='memories')
    op.drop_index(op.f('ix_memories_user_id'), table_name='memories')
    op.drop_index(op.f('ix_memories_session_id'), table_name='memories')
    op.drop_index(op.f('ix_memories_id'), table_name='memories')
    op.drop_table('memories')
    op.execute("DROP EXTENSION IF EXISTS vector;")
