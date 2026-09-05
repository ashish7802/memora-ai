# Memora Canonical Backend Architecture

## Overview
Memora provides an auditable memory and context-control layer for AI agents:
> **"Remember the right thing. Prove why it was recalled. Forget it on command."**

The sole canonical production API backend is the Python FastAPI application located in `/backend/`.

## Architecture Diagram & Request Flow

```
[AI Agent / SDK / Frontend]
             │
             ▼  (HTTP with X-API-Key or Authorization: Bearer <key>)
   FastAPI Canonical ASGI Core (/backend/app/main.py)
             │
             ├─► APIKeyAuthMiddleware: SHA-256 validation & Tenant Context Binding
             │
             ├─► RLS Session Setting: app.current_tenant_id = <tenant_uuid>
             │
             ├─► Services (/backend/app/memory/service.py, /learning/service.py)
             │      ├─ Fail-closed Embedding Generation (Gemini text-embedding-004 / provider)
             │      ├─ Conflict Detection & Temporal Invalidation
             │      ├─ Explainable Recall Ranking (similarity, recency, importance, frequency)
             │      └─ Auditable Logging (every recall, addition, purge recorded)
             │
             └─► PostgreSQL 16 + pgvector (HNSW Index, Cosine Ops)
                    ├─ Row Level Security (RLS) enforcement
                    ├─ memories (tenant-isolated, provenance, temporal, status)
                    ├─ audit_logs (immutable ledger of memory operations)
                    └─ skill_proposals (sandboxed proposals, no runtime code execution)
```

## Production vs Development Rules
1. **Source of Truth**: Production always connects to the canonical PostgreSQL + pgvector database via `/backend`.
2. **No Silent Fallbacks**: Production returns `503 Service Unavailable` with `BACKEND_UNAVAILABLE` or `EMBEDDING_PROVIDER_ERROR` if the database or embedding provider is unavailable. It never silently substitutes fake in-memory data or mock vectors.
3. **Development Preview Mode**: Any non-production mock data or deterministic embeddings must be explicitly tagged with `development_preview: true` and `embedding_provider: "deterministic_test"`.
4. **Tenant Identity**: Tenant identity is exclusively determined server-side from the authenticated API key hash. It is never accepted from untrusted request bodies.
