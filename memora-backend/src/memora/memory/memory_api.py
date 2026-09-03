import math
import uuid
from typing import Any, Dict, List, Optional, Tuple
import httpx

from memora.core.config import Settings, get_settings
from memora.core.models import MemoryItem, SearchResult
from memora.memory.vector_store import VectorStore

try:
    from app.monitoring.logger import get_logger
    logger = get_logger("memora.memory")
except ImportError:
    import logging
    logger = logging.getLogger("memora.memory")


class MemoryClient:
    """High-level Facade client providing intuitive agentic memory APIs.

    Handles embedding generation and delegates persistence to the underlying VectorStore.
    """

    def __init__(self, vector_store: VectorStore, settings: Optional[Settings] = None):
        self.store = vector_store
        self.settings = settings or get_settings()

    def _generate_deterministic_embedding(self, text: str, dim: int = 768) -> List[float]:
        """Generates a normalized deterministic embedding for local development/testing."""
        if not text:
            return [0.0] * dim
        vec = []
        for i in range(dim):
            val = math.sin(i * 0.123 + len(text) * 0.456 + sum(ord(c) * (j + 1) for j, c in enumerate(text[:32])))
            vec.append(val)
        norm = math.sqrt(sum(x * x for x in vec)) or 1.0
        return [round(x / norm, 6) for x in vec]

    async def get_embedding(self, text: str) -> Tuple[List[float], Optional[str]]:
        """Fetches vector embedding using configured provider (Ollama / Gemini / Fallback).

        Returns a tuple of (embedding_vector, fallback_source_flag).
        """
        dim = self.settings.EMBEDDING_DIM

        # 1. Ollama Provider
        if self.settings.EMBEDDING_PROVIDER == "ollama":
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        f"{self.settings.OLLAMA_ENDPOINT}/api/embeddings",
                        json={"model": self.settings.EMBEDDING_MODEL, "prompt": text},
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        emb = data.get("embedding", [])
                        if len(emb) == dim:
                            return emb, None
                        else:
                            logger.warning(
                                f"Ollama embedding dimension mismatch: expected {dim}, got {len(emb)}. Falling back to deterministic embedding.",
                                extra={"expected_dim": dim, "received_dim": len(emb), "model": self.settings.EMBEDDING_MODEL},
                            )
                    else:
                        logger.warning(
                            f"Ollama embedding request failed with HTTP {resp.status_code}: {resp.text}. Falling back to deterministic embedding.",
                            extra={"status_code": resp.status_code, "model": self.settings.EMBEDDING_MODEL},
                        )
            except Exception as exc:
                logger.warning(
                    f"Ollama connection error during embedding generation: {exc}. Falling back to deterministic embedding.",
                    extra={"error": str(exc), "endpoint": self.settings.OLLAMA_ENDPOINT},
                )

        # 2. Gemini Provider
        elif self.settings.EMBEDDING_PROVIDER == "gemini":
            if not self.settings.GEMINI_API_KEY:
                logger.warning(
                    "GEMINI_API_KEY is missing or empty. Falling back to deterministic embedding.",
                    extra={"provider": "gemini"},
                )
            else:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.settings.EMBEDDING_MODEL}:embedContent?key={self.settings.GEMINI_API_KEY}"
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        resp = await client.post(
                            url,
                            json={"content": {"parts": [{"text": text}]}},
                        )
                        if resp.status_code == 200:
                            data = resp.json()
                            emb = data.get("embedding", {}).get("values", [])
                            if len(emb) != dim:
                                raise ValueError(
                                    f"Gemini embedding dimension mismatch: expected {dim}, got {len(emb)} from model '{self.settings.EMBEDDING_MODEL}'."
                                )
                            return emb, None
                        else:
                            logger.warning(
                                f"Gemini API returned HTTP {resp.status_code}: {resp.text}. Falling back to deterministic embedding.",
                                extra={"status_code": resp.status_code, "model": self.settings.EMBEDDING_MODEL},
                            )
                except ValueError:
                    raise
                except Exception as exc:
                    logger.warning(
                        f"Gemini API request error: {exc}. Falling back to deterministic embedding.",
                        extra={"error": str(exc), "model": self.settings.EMBEDDING_MODEL},
                    )

        # 3. Deterministic Local Math Fallback
        return self._generate_deterministic_embedding(text, dim=dim), "fallback_deterministic"

    async def remember(
        self,
        text: str,
        metadata: Optional[Dict[str, Any]] = None,
        embedding: Optional[List[float]] = None,
        memory_id: Optional[uuid.UUID] = None,
    ) -> MemoryItem:
        """Stores a new memory statement in vector memory."""
        meta = dict(metadata or {})
        if embedding is not None:
            vec = embedding
        else:
            vec, fallback_flag = await self.get_embedding(text)
            if fallback_flag:
                meta["embedding_source"] = fallback_flag

        return await self.store.add(
            text=text,
            embedding=vec,
            metadata=meta,
            memory_id=memory_id,
        )

    async def recall(
        self,
        query: str,
        top_k: int = 5,
        threshold: float = 0.0,
    ) -> List[SearchResult]:
        """Searches vector memory semantically against query string."""
        query_vec, _ = await self.get_embedding(query)
        return await self.store.search(
            query_embedding=query_vec,
            top_k=top_k,
            threshold=threshold,
        )

    async def forget(self, memory_id: uuid.UUID) -> bool:
        """Deletes a memory record by ID."""
        return await self.store.delete(memory_id)

    async def update(
        self,
        memory_id: uuid.UUID,
        text: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        embedding: Optional[List[float]] = None,
        decay_score: Optional[float] = None,
    ) -> Optional[MemoryItem]:
        """Updates text, metadata or decay score of an existing memory."""
        new_vec = embedding
        meta = dict(metadata) if metadata is not None else None

        if text is not None and embedding is None:
            new_vec, fallback_flag = await self.get_embedding(text)
            if fallback_flag:
                if meta is None:
                    current_item = await self.store.get(memory_id)
                    meta = dict(current_item.metadata) if current_item else {}
                meta["embedding_source"] = fallback_flag

        return await self.store.update(
            memory_id=memory_id,
            text=text,
            embedding=new_vec,
            metadata=meta,
            decay_score=decay_score,
        )

    async def prune(self, threshold: float = 0.2) -> int:
        """Prunes stale memories whose decay score is below the threshold."""
        return await self.store.prune(threshold=threshold)
