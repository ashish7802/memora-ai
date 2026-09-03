# Memora Product Blueprint

## 1. Vision & Positioning
Memora is an open-source cognitive memory layer for autonomous AI agents and LLM applications. It provides long-term persistent episodic, semantic, and procedural memory with vector search, automatic decay scoring, and self-learning capabilities.

Competitors: Mem0, Zep, Letta, Cognee.

## 2. Architecture

```
Client / Agent / SDK
       │
       ▼
 FastAPI Backend (/v1)
       │
       ├─► PostgreSQL 16 + pgvector (HNSW index, cosine distance)
       ├─► Embeddings: Ollama (primary) → Gemini (fallback) → Deterministic local (fallback/dev)
       └─► Experience Logger & Pattern Miner
```

## 3. Tech Stack
- **Backend:** Python 3.11+, FastAPI, SQLAlchemy (asyncio), asyncpg, pgvector
- **DB:** PostgreSQL 16 + pgvector, HNSW index (`vector_cosine_ops`)
- **Embeddings:** Ollama (primary) → Gemini (fallback) → deterministic local fallback (dev/test only, tagged in metadata)
- **Frontend:** Next.js 15, React 19, Tailwind v4, D3.js

## 4. API Surface (Live)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/v1/auth/register` | Register tenant & issue API key |
| POST | `/v1/auth/keys` | Generate new API key |
| GET | `/v1/auth/keys` | List active API keys |
| DELETE | `/v1/auth/keys/{id}` | Revoke API key |
| POST | `/v1/memory` | Add memory |
| GET | `/v1/memory` | List all, paginated |
| GET | `/v1/memory/search` | Semantic search |
| GET | `/v1/memory/graph` | Server-side similarity graph |
| GET | `/v1/memory/stats` | Memory & cluster statistics |
| GET | `/v1/memory/{id}` | Get single memory |
| PUT | `/v1/memory/{id}` | Update memory |
| DELETE | `/v1/memory/{id}` | Delete memory |
| POST | `/v1/memory/prune` | Bulk-delete below decay threshold |
| POST | `/v1/learning/log` | Log agent interaction turn |
| GET | `/v1/learning/logs/{session_id}` | Retrieve interaction logs |
| POST | `/v1/learning/mine` | Mine behavioral pattern clusters |
| GET | `/v1/learning/patterns` | Get discovered patterns |
| POST | `/v1/learning/generate-skill` | Synthesize skill tool code |
| GET | `/healthz` | Liveness check |

## 5. Known Limitations
- `stats`, `skills/*`, `users/*` Next.js frontend proxy routes fall back to local store if backend is unreachable.
- `decay_score` requires periodic scheduled pruning triggers via `/v1/memory/prune`.
- Swarm/chat/platform playground routes use client-orchestrated agent loop.

## 6. Roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 | Single Python backend, pgvector, memory CRUD API | ✅ Done |
| 2 | Production vector store (pgvector, HNSW) | ✅ Done (merged into Phase 1) |
| 3 | API hardening — auth, rate limiting, error contracts | ✅ Done |
| 4 | SDK — Python (`memora-ai`) & TypeScript (`@memora/client`) SDKs + adapters | ✅ Done |
| 5 | Real experience-logging + pattern mining + skill synthesis | ✅ Done |
| 6 | Real benchmarks (10k+ vectors, HNSW sub-3ms latency) | ✅ Done |
| 7 | Auth + multi-tenant (API keys, tenant isolation) | ✅ Done |

## 7. Explicit Non-Negotiables
- No feature ships unless README claim matches shipped code.
- No new platform integrations until SDK (Phase 4) is usable and tested.
- No merge with QuantumX or any "everything platform" idea.
