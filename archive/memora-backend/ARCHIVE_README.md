# Archived: Legacy memora-backend Prototype

This directory contains the legacy raw-asyncpg prototype of the Memora backend.
It has been superseded by the canonical FastAPI + SQLAlchemy + pgvector implementation in `/backend`.

## Why this was archived:
- `backend/` is the sole canonical production backend.
- `memora-backend/` lacked Alembic migrations, tenant authentication middleware, learning pipelines, and auditable models.
- Core capabilities from this prototype (such as cosine distance queries and pgvector connection initialization) were reconciled into `backend/`.

Do not deploy or maintain this directory. All backend development must occur in `/backend/`.
