"""add skill governance columns to skill_proposals

Revision ID: 005
Revises: 004
Create Date: 2026-09-06 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '005'
down_revision: Union[str, None] = '004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('skill_proposals', sa.Column('review_status', sa.String(length=32), nullable=False, server_default='unreviewed'))
    op.add_column('skill_proposals', sa.Column('reviewer', sa.String(length=128), nullable=True))
    op.add_column('skill_proposals', sa.Column('model_provider', sa.String(length=64), nullable=True, server_default='gemini'))
    op.add_column('skill_proposals', sa.Column('prompt_hash', sa.String(length=64), nullable=True))
    op.add_column('skill_proposals', sa.Column('code_hash', sa.String(length=64), nullable=True))
    op.add_column('skill_proposals', sa.Column('static_analysis_passed', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('skill_proposals', sa.Column('static_analysis_findings', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'))
    op.create_index(op.f('ix_skill_proposals_review_status'), 'skill_proposals', ['review_status'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_skill_proposals_review_status'), table_name='skill_proposals')
    op.drop_column('skill_proposals', 'static_analysis_findings')
    op.drop_column('skill_proposals', 'static_analysis_passed')
    op.drop_column('skill_proposals', 'code_hash')
    op.drop_column('skill_proposals', 'prompt_hash')
    op.drop_column('skill_proposals', 'model_provider')
    op.drop_column('skill_proposals', 'reviewer')
    op.drop_column('skill_proposals', 'review_status')
