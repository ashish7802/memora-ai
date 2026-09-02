import argparse
import json
import random
import uuid
from typing import Any, Dict, List
import numpy as np


DOMAINS = [
    "user_preferences",
    "technical_architecture",
    "customer_support",
    "research_findings",
    "agent_dialogue",
    "code_snippets",
    "financial_records",
    "system_telemetry",
]

SAMPLE_SUBJECTS = [
    "PostgreSQL 17 pgvector index configuration",
    "HNSW m=16 ef_construction=64 tuning",
    "LangChain memory session serialization",
    "CrewAI hierarchical agent orchestration",
    "FastAPI async connection pool recycling",
    "Embedding cosine similarity threshold at 0.85",
    "Redis semantic cache eviction strategy",
    "Kubernetes horizontal pod vector workload scaling",
    "User authentication OAuth2 bearer tokens",
    "LlamaIndex custom TextNode vector retriever",
]

SAMPLE_PREDICATES = [
    "exhibits optimal throughput under concurrency",
    "requires memory pruning after 30 days of inactivity",
    "demonstrates lower sub-5ms retrieval latency",
    "was updated during recent automated skill synthesis",
    "triggers background index re-indexing on bulk insert",
    "stores vector embeddings normalized to unit length",
    "filters partitioned results by session identifier",
]


def generate_synthetic_embedding(dim: int = 1536) -> List[float]:
    """Generate a unit-normalized random vector representing an embedding."""
    vec = np.random.randn(dim).astype(np.float32)
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return vec.tolist()


def generate_synthetic_record(dim: int = 1536) -> Dict[str, Any]:
    """Generate a single realistic memory record."""
    domain = random.choice(DOMAINS)
    subject = random.choice(SAMPLE_SUBJECTS)
    predicate = random.choice(SAMPLE_PREDICATES)
    session_num = random.randint(1, 200)
    user_num = random.randint(1, 50)
    
    text = f"[{domain.upper()}] {subject} {predicate}. Observed during benchmark execution."
    
    return {
        "id": str(uuid.uuid4()),
        "session_id": f"sess_{session_num:04d}",
        "user_id": f"user_{user_num:03d}",
        "agent_id": f"agent_{random.randint(1, 10):02d}",
        "cluster": domain,
        "text": text,
        "importance": round(random.uniform(0.5, 3.0), 2),
        "access_count": random.randint(0, 50),
        "metadata": {
            "synthetic": True,
            "domain": domain,
            "version": "1.0",
            "benchmark_run": "scale_10k",
            "tags": [domain, "synthetic", f"tier_{random.randint(1, 3)}"],
        },
        "embedding": generate_synthetic_embedding(dim),
    }


def generate_dataset(count: int = 10000, dim: int = 1536, output_file: str = "benchmarks/synthetic_10k.json"):
    """Generate N synthetic memories and save to disk."""
    print(f"Generating {count} synthetic memory records (dim={dim})...")
    records = []
    for i in range(count):
        records.append(generate_synthetic_record(dim=dim))
        if (i + 1) % 2000 == 0:
            print(f"  Generated {i + 1}/{count} records...")

    with open(output_file, "w") as f:
        json.dump(records, f)
    
    print(f"Successfully generated and saved {count} records to {output_file}")
    return records


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate synthetic memories for vector benchmarking")
    parser.add_argument("--count", type=int, default=10000, help="Number of records to generate")
    parser.add_argument("--dim", type=int, default=1536, help="Embedding vector dimension")
    parser.add_argument("--output", type=str, default="benchmarks/synthetic_10k.json", help="Output path")
    args = parser.parse_args()

    generate_dataset(count=args.count, dim=args.dim, output_file=args.output)
