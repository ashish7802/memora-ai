# Memora

A cognitive memory layer for AI agents and LLM applications, backed by PostgreSQL and pgvector.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776AB.svg?logo=python)](https://python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com/)
[![PostgreSQL & pgvector](https://img.shields.io/badge/pgvector-HNSW-336791.svg?logo=postgresql)](https://github.com/pgvector/pgvector)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-black.svg?logo=next.js)](https://nextjs.org/)

---

## 1. Overview

**Memora** is an open-source long-term memory system designed for autonomous AI agents, multi-agent frameworks, and conversational applications. It acts as an external memory substrate, providing persistence across sessions, semantic vector search, and interaction logging.

### Positioning & Alternatives
Memora is positioned in the AI agent memory infrastructure category alongside:
- **Mem0**
- **Zep**
- **Letta (formerly MemGPT)**
- **Cognee**

For complete architecture details, technical decisions, and specifications, see [docs/BLUEPRINT.md](docs/BLUEPRINT.md).

---

## 2. Architecture & Tech Stack

```
Agent / Client / SDK
       │
       ▼
 FastAPI Backend (/v1)
       │
       ├─► PostgreSQL 16 + pgvector (HNSW cosine similarity index)
       ├─► Embedding Cascade: Ollama -> Gemini -> Deterministic fallback (dev/test)
       └─► Experience Logger & Pattern Mining Pipeline
```

- **Backend:** Python 3.11+, FastAPI, SQLAlchemy (asyncio), asyncpg, pgvector
- **Database:** PostgreSQL 16/17 + pgvector extension with HNSW index (`vector_cosine_ops`)
- **Embeddings:** Ollama (primary) with fallback to Gemini API or deterministic local fallback (dev/test)
- **Frontend / Dashboard:** Next.js 15 (App Router), React 19, Tailwind CSS v4, D3.js force graphs
- **SDKs:** Python SDK (`memora-ai`) and TypeScript SDK (`@memora/client`)

---

## 3. API Surface

All API routes are served under `/v1` by the FastAPI backend:

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/auth/register` | Register new tenant and generate primary API key |
| `POST` | `/v1/auth/keys` | Create an additional API key for the current tenant |
| `GET` | `/v1/auth/keys` | List all active API keys for tenant |
| `DELETE` | `/v1/auth/keys/{id}` | Revoke an API key |
| `POST` | `/v1/memory` | Add a new memory record with vector embedding |
| `GET` | `/v1/memory` | List paginated memories with optional session/cluster filter |
| `GET` | `/v1/memory/search` | Semantic vector search using cosine similarity |
| `GET` | `/v1/memory/graph` | Generate graph topology nodes and edges |
| `GET` | `/v1/memory/stats` | Retrieve memory counts, cluster distribution, and access metrics |
| `GET` | `/v1/memory/{id}` | Get single memory by ID |
| `PUT` | `/v1/memory/{id}` | Update memory content, importance, or metadata |
| `DELETE` | `/v1/memory/{id}` | Delete a memory record |
| `POST` | `/v1/memory/prune` | Bulk prune low-importance or decayed memories |
| `POST` | `/v1/learning/log` | Log an interaction turn (query, response, tool, status) |
| `GET` | `/v1/learning/logs/{session_id}` | Retrieve interaction history for a session |
| `POST` | `/v1/learning/mine` | Cluster interaction logs and identify capability gaps |
| `GET` | `/v1/learning/patterns` | List detected pattern clusters |
| `POST` | `/v1/learning/generate-skill` | Generate executable Python tool code from pattern |
| `GET` | `/healthz` | System health and status check |

---

## 4. Known Limitations

- **Legacy Route Fallbacks:** Next.js API routes (`app/api/stats`, `app/api/skills/*`, `app/api/users/*`) proxy to the Python backend and fall back to local store if the backend is unreachable.
- **Decay Computation:** `decay_score` in memory records is stored as a numerical score; automatic time-based background decay recalculation requires invoking `/v1/memory/prune` with threshold filters.
- **Experimental Interfaces:** Multi-agent swarm, Telegram, Slack, and Discord dashboard views operate as client-driven interfaces in the web frontend.

---

## 5. Development & Setup

### Prerequisites
- Python 3.11+
- Node.js 18.18+ / 20+
- Docker & Docker Compose

### 1. Database Setup (PostgreSQL + pgvector)

Start PostgreSQL with pgvector enabled via Docker Compose:

```bash
cd backend
docker-compose up -d
```

Apply database migrations:

```bash
alembic upgrade head
```

### 2. Start Python Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive documentation is available at `http://localhost:8000/v1/docs`.

### 3. Start Frontend UI

```bash
# In the root directory
npm install
npm run dev
```

The Next.js dashboard will be accessible at `http://localhost:3000`.

---

## 6. Benchmarks

Empirical latency measurements on 10,000 synthetic vector records (1536 dimensions, PostgreSQL 17 + pgvector HNSW index):

| Metric | Measured Value | Target | Status |
| :--- | :--- | :--- | :--- |
| **P50 Latency** | **2.81 ms** | < 10.0 ms | Passed |
| **P95 Latency** | **3.64 ms** | < 15.0 ms | Passed |
| **P99 Latency** | **4.12 ms** | < 25.0 ms | Passed |
| **Throughput (Single Conn)** | **349.6 QPS** | > 100 QPS | Passed |
| **Bulk Ingestion Rate** | **2,924 records/sec** | > 1,000 rec/s | Passed |

Full benchmark data and reproduction commands can be found in [benchmarks/results.md](benchmarks/results.md).

---

## 7. Roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 | Single Python backend, pgvector, memory CRUD API | Done |
| 2 | Production vector store (pgvector, HNSW) | Done (merged into Phase 1) |
| 3 | API hardening — auth, rate limiting, error contracts | Done |
| 4 | SDK — Python (`memora-ai`) & TypeScript (`@memora/client`) + adapters | Done |
| 5 | Real experience-logging + pattern mining + skill synthesis | Done |
| 6 | Real benchmarks (10k+ vectors, HNSW sub-3ms latency) | Done |
| 7 | Auth + multi-tenant (API keys, tenant isolation) | Done |

---

## 8. License

Distributed under the MIT License. See `LICENSE` for more information.
