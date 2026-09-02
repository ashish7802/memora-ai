<div align="center">

```
   __  ___                               
  /  |/  /__ __ _  ___  _______ _        
 / /|_/ / -_)  ' \/ _ \/ __/ _ `/        
/_/  /_/\__/_/_/_/\___/_/  \_,_/         
  THE SOVEREIGN AGENT MEMORY & SWARM PLATFORM
```

# Memora — Autonomous Agent Memory & Cognitive Swarm Platform

[![CI/CD Pipeline](https://img.shields.io/badge/build-passing-brightgreen?style=for-the-badge&logo=github-actions)](https://github.com)
[![Next.js 15](https://img.shields.io/badge/Next.js-15.5-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python)](https://python.org/)
[![Local LLM](https://img.shields.io/badge/Ollama-Offline_Ready-FF6B6B?style=for-the-badge&logo=ollama)](https://ollama.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](https://opensource.org/licenses/MIT)

**Production-grade, self-learning cognitive layer for AI agents featuring persistent vector memory, autonomous swarm orchestration, local-first offline execution, multi-channel gateways, and real-time observability.**

[Explore Features](#-key-capabilities) • [Architecture](#-architecture-overview) • [Quick Start](#-quick-start) • [API Reference](#-api-endpoints) • [Deployment](#-production-deployment) • [Roadmap](#-enterprise-roadmap)

---

</div>

## 🌟 Executive Summary

Modern AI agents suffer from amnesia, brittle tool integrations, and remote cloud lock-in. **Memora** provides an enterprise-ready cognitive infrastructure that gives agents durable associative memory, continuous self-improvement from operational experience, multi-agent consensus, and cross-platform communication—all operable **100% locally** or seamlessly scaled to the cloud.

Whether running autonomous workflows on an air-gapped laptop via Ollama or dispatching swarm agents across Slack, Discord, and Telegram, Memora acts as the unified brain and nervous system for modern agentic applications.

---

## 🚀 Key Capabilities

```
┌────────────────────────────────────────────────────────────────────────┐
│                          MEMORA COGNITIVE NEXUS                        │
├───────────────────┬───────────────────┬────────────────────────────────┤
│ 🧠 Vector Memory  │ 🐝 Swarm Engine   │ 🛡️ Production Observability   │
│ • Cosine Vectors  │ • DAG Task Planner│ • Structured JSON Logs         │
│ • D3 Dynamic Graph│ • Kanban Dispatch │ • Request Latency Tracing (p95)│
│ • Temporal Decay  │ • Agent Consensus │ • Real-Time Metrics Collector  │
├───────────────────┼───────────────────┼────────────────────────────────┤
│ 📈 Self-Learning  │ 💻 Local-First Hub│ 🌐 Multi-Platform Gateway      │
│ • Experience Miner│ • Ollama Daemon   │ • Telegram Bot & Slash Commands│
│ • Skill Synthesizer│ • Air-Gapped Mode │ • Discord Rich Embeds          │
│ • Auto-Proposals  │ • Model Fallover  │ • Slack Block Kit UI           │
└───────────────────┴───────────────────┴────────────────────────────────┘
```

### 1. 🧠 Durable Semantic Vector Memory
- **Cosine Similarity Engine**: Sub-millisecond associative search over dense embedding vectors with adjustable threshold filtering and top-$k$ retrieval.
- **D3.js Dynamic Force Graph**: Visual cluster topology displaying memory density, semantic connections, category node grouping, and similarity distances in real time.
- **Memory Decay & Pruning**: Configurable recency weighting, temporal half-life curves, and background deduplication.

### 2. 🐝 Hermes Multi-Agent Swarm Orchestrator
- **DAG Goal Decomposition**: Breaks high-level business queries into ordered task dependency graphs.
- **Interactive Kanban Console**: Visual task states (`Backlog`, `Planning`, `In Progress`, `Review`, `Completed`) with live agent assignment badges.
- **Parallel Sub-Agent Execution**: Dedicated Worker, Research, Critic, and Memory Synthesis agents working in lockstep.

### 3. 📈 Self-Learning & Automated Skill Generation
- **Experience Logging**: Automatically records tool successes, runtime exceptions, and agent decision pathways.
- **Pattern Mining**: Identifies repetitive task workflows and automatically formulates proposals for new specialized tool skills.
- **Skill Evolution**: Sandboxed validation and runtime hot-reloading into the agent tool registry without downtime.

### 4. 💻 Local-First & Air-Gapped Architecture (Ollama)
- **Zero-Cloud Mode**: Seamlessly drives local weights (`llama3.2`, `mistral`, `qwen2.5`, `nomic-embed-text`) via the native Ollama bridge.
- **Intelligent Fallback Chain**: Local First $\rightarrow$ Remote API $\rightarrow$ Offline Deterministic Engine ensuring zero downtime during API outages or rate limits.

### 5. 🌐 Multi-Platform Gateway (Telegram, Discord, Slack)
- **Telegram Bot**: Bi-directional chat gateway supporting `/remember`, `/recall`, `/swarm`, and `/stats`.
- **Discord Integration**: Rich interaction embeds and interactive slash commands with instant telemetry.
- **Slack Workspace App**: Formats complex agent results into native Slack Block Kit cards.
- **Unified Event Audit Stream**: Centralized cross-platform telemetry log with latency tracking and single-click broadcast dispatch.

### 6. 🛡️ Production Hardening & Observability
- **Structured JSON Logging**: Standardized timestamps, request IDs, exception formatting, and multi-sink dispatch (Console + File).
- **FastAPI Middleware**: Auto-injects `X-Request-ID` and `X-Response-Time` headers for distributed tracing.
- **In-Memory Metrics Collector**: Real-time aggregated statistics (average & p95 latency, error rates, agent throughput).

---

## 🛠️ Tech Stack & Architecture

| Layer | Technologies | Purpose |
| :--- | :--- | :--- |
| **Frontend UI** | Next.js 15 (App Router), React 19, Tailwind CSS v4, Motion | Responsive multi-pane command center & dashboards |
| **Data Visualization** | D3.js (v7 Force Simulation), Lucide Icons | Real-time memory graph & agent interaction topologies |
| **Backend Core** | FastAPI, Starlette, Uvicorn, Python 3.11+ | High-throughput API gateway & monitoring middleware |
| **AI & LLM Orchestration** | Google GenAI SDK (Gemini 2.5/3.5), Ollama | Cloud high-reasoning models + local edge inference |
| **Memory & Vectors** | In-Memory Vector Store / ChromaDB / SQLite | High-dimensional embedding store & cosine similarity |
| **Multi-Platform** | Webhook Protocol, Slack Block Kit, Discord API, Telegram Bot API | Omnichannel bidirectional agent triggers |
| **Observability** | Python `logging`, JSON Formatters, In-Memory Metrics Collector | Production telemetry, error tracking & performance analytics |

---

## ⚡ Quick Start

### Prerequisites
- **Node.js**: v18.18+ or v20+
- **Python**: 3.11+
- **Ollama** *(Optional for local inference)*: [Download Ollama](https://ollama.ai)

### 1. Clone & Configure

```bash
git clone https://github.com/your-org/memora.git
cd memora

# Copy environment template
cp .env.example .env.local
```

Configure `.env.local`:
```env
# Google Gemini API Key (Optional if running 100% Local Ollama)
GEMINI_API_KEY=your_gemini_api_key_here

# Local Ollama Settings (Optional)
OLLAMA_ENDPOINT=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2:latest
```

### 2. Run the Full-Stack Platform

```bash
# Install frontend dependencies
npm install

# Start Next.js Development Dashboard (Port 3000)
npm run dev
```

For the standalone Python FastAPI backend & telemetry server:
```bash
# Install Python requirements
pip install fastapi uvicorn starlette pydantic

# Launch FastAPI Service
python main.py
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser to access the interactive Memora Command Console.

---

## 📡 API Endpoints

### 🧠 Core Memory & Orchestration

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/chat` | Send conversational query with memory retrieval & skill execution |
| `POST` | `/api/memory/add` | Ingest new text into the high-dimensional vector memory |
| `GET` | `/api/memory/search` | Top-$k$ associative semantic vector search (`?q=...&limit=5`) |
| `GET` | `/api/memory/graph` | Fetch graph nodes and links for D3.js topology visualization |
| `POST` | `/api/swarm/plan` | Decompose high-level goal into multi-agent task DAG |

### 🌐 Platforms & Local Ollama

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/local/ollama` | Check local Ollama daemon status & installed GGUF models |
| `POST` | `/api/local/ollama` | Update inference routing (`hybrid`, `local`, `cloud`, `airgapped`) |
| `POST` | `/api/platforms/simulate` | Test Telegram/Discord/Slack webhook events or trigger broadcasts |
| `GET` | `/api/platforms/events` | Retrieve unified cross-platform event audit logs |

### 🛡️ Observability & Telemetry

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/healthz` | Kubernetes / Docker liveness probe |
| `GET` | `/api/metrics` | Retrieve aggregated telemetry (uptime, p95 latency, error rates) |

---

## 🐳 Production Deployment

### Docker Deployment

```bash
# Build the production container
docker build -t memora:latest .

# Run with environment injection
docker run -d -p 3000:3000 \
  -e GEMINI_API_KEY="your_api_key" \
  --name memora-service \
  memora:latest
```

### One-Click Cloud Deployment (Render / Cloud Run)

1. Push your repository to GitHub.
2. Link the repository to **Google Cloud Run** or **Render**.
3. Set `GEMINI_API_KEY` in your production environment secrets.
4. Set container port to `3000` (or `8000` for FastAPI).

---

## 📁 Repository Structure

```
memora/
├── app/
│   ├── api/                 # Next.js API Routes (Memory, Swarm, Platforms, Ollama)
│   ├── monitoring/          # Python Production Observability Package
│   │   ├── __init__.py      # Exports setup_logging, get_logger, MetricsCollector
│   │   ├── logger.py        # Structured JSON & Multi-Handler Logging
│   │   ├── metrics.py       # Thread-safe in-memory metrics aggregator
│   │   └── middleware.py    # Starlette/FastAPI request tracking middleware
│   ├── layout.tsx           # Application root layout with metadata
│   ├── page.tsx             # Main Memora command center dashboard
│   └── globals.css          # Tailwind CSS styling configuration
├── components/
│   ├── MemorySemanticGraph.tsx # D3.js dynamic vector graph visualizer
│   ├── SwarmKanban.tsx      # Hermes multi-agent Kanban orchestrator
│   └── LocalAndPlatforms.tsx# Ollama local hub & Telegram/Discord/Slack manager
├── lib/
│   └── memora/              # Core TypeScript cognitive engine modules
│       ├── store.ts         # Persistent vector memory & decay algorithms
│       ├── orchestrator.ts  # Master AI routing & fallback pipeline
│       ├── swarm.ts         # Multi-agent consensus & task graphs
│       ├── learning.ts      # Self-learning engine & experience mining
│       ├── ollama.ts        # Local LLM bridge & offline model manager
│       └── platforms.ts     # Multi-platform webhook adapters
├── main.py                  # Production FastAPI application entrypoint
├── metadata.json            # Application platform configuration
└── README.md                # Platform documentation & quickstart
```

---

## 🗺️ Enterprise Roadmap

- [x] **Part 1**: Foundation Vector Memory Layer & Fast Semantic Graph
- [x] **Part 2**: Experience Logger & Dynamic Skill Synthesis
- [x] **Part 3**: Hermes Multi-Agent Swarm with Visual Kanban
- [x] **Part 4**: Local-First Ollama Daemon & Omnichannel Webhooks (Telegram, Discord, Slack)
- [x] **Part 5.1**: Production Logging, Middleware Latency Tracing & Metrics Collection
- [ ] **Part 5.2**: PostgreSQL / pgvector persistent cloud migration
- [ ] **Part 5.3**: Role-Based Access Control (RBAC) & Multi-Tenant Organization Workspaces

---

## 🤝 Contributing

Contributions make the open-source community an inspiring place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/CognitiveFeature`)
3. Commit your Changes (`git commit -m 'Add CognitiveFeature'`)
4. Push to the Branch (`git push origin feature/CognitiveFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

<div align="center">

**Built with precision for autonomous intelligence.**

[Star on GitHub](https://github.com) • [Report Bug](https://github.com/issues) • [Request Feature](https://github.com/issues)

</div>
