# Memora Backend Engine — Phase 1 (Vector Memory Core)

Consolidated asynchronous Python backend for Memora, featuring high-throughput vector memory storage powered by **PostgreSQL 16**, **pgvector** (HNSW Indexing), and **asyncpg**.

---

## 🏗️ Architecture & Features

- **FastAPI Core**: Async REST API (`/v1/memory`) with full type safety via Pydantic v2.
- **PgVectorStore**: Native asyncpg pool implementation with `vector(768)` dimensions and cosine distance operator (`<=>`).
- **MemoryClient Facade**: High-level interface supporting `remember()`, `recall()`, `forget()`, and `prune()`.
- **HNSW Indexing**: Sub-3ms vector similarity searches with configurable $m$ and $ef\_construction$ parameters.
- **Observability**: Direct integration with existing `app/monitoring` distributed tracing and latency metrics.
- **Decay Score**: `decay_score` is currently a static field — automatic time-based decay computation is NOT yet implemented and is planned for a later phase.

---

## 🚀 Quick Start

### 1. Start PostgreSQL with pgvector

```bash
docker-compose up -d
```

This starts Postgres 16 on port `5432` and automatically executes `migrations/001_create_memory_table.sql` on first boot.

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Run Migrations (Manual SQL)

If not using Docker's automatic `docker-entrypoint-initdb.d`, run the migration against your PostgreSQL instance:

```bash
psql -h localhost -U memora -d memora_db -f migrations/001_create_memory_table.sql
```

### 4. Start FastAPI Server

```bash
# Can be run from project root, memora-backend/, or memora-backend/src/
python -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
# or
cd src && uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive API documentation will be available at:
- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **OpenAPI Schema**: [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)

---

## 🧪 Running Tests

Run asynchronous unit and integration tests using pytest:

```bash
pytest tests/ -v
```

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/v1/memory` | Ingest text, compute embedding, and save memory item |
| `GET` | `/v1/memory?limit={limit}&offset={offset}` | List all persisted memories with pagination |
| `GET` | `/v1/memory/graph?min_similarity={sim}&limit={limit}` | Server-side semantic topology graph calculation |
| `GET` | `/v1/memory/search?q={query}&top_k={k}&threshold={t}` | Cosine similarity vector search |
| `GET` | `/v1/memory/{id}` | Retrieve memory item by UUID |
| `PUT` | `/v1/memory/{id}` | Update text, metadata, or decay score (static field) |
| `DELETE` | `/v1/memory/{id}` | Delete memory item |
| `POST` | `/v1/memory/prune` | Prune decayed memories below threshold |
| `GET` | `/healthz` | Health check & database connection probe |

---

## ⚠️ Known Limitations (Phase 1)

The following frontend/prototype Next.js API routes still read from the legacy in-memory `memoryStore` (`lib/memora/store.ts`) and are disconnected from the new Postgres-backed `/v1/memory` engine until Phase 3/5:
- `app/api/stats/route.ts`: Global memory statistics reflect legacy in-memory counts rather than Postgres records.
- `app/api/skills/analyze/route.ts`: Skill synthesis reads experience records from legacy in-memory store.
- `app/api/skills/proposals/route.ts`: Skill proposals list reflects in-memory registry proposals.
- `app/api/skills/integrate/[proposal_name]/route.ts`: Skill integration acts on in-memory proposal registry.
- `app/api/skills/auto-integrate/route.ts`: Auto-integration processes proposals from in-memory store.
- `app/api/users/[session_id]/model/route.ts`: User modeling aggregates interactions from legacy in-memory experiences.
- `app/api/users/analyze/route.ts`: Multi-user profiling analyzes in-memory session records.
