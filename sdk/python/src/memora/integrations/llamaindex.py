from typing import Any, Dict, List, Optional
from memora.client import Memora

try:
    from llama_index.core.vector_stores.types import (
        BasePydanticVectorStore,
        VectorStoreQuery,
        VectorStoreQueryResult,
    )
    from llama_index.core.schema import TextNode, NodeRelationship
except ImportError:
    class BasePydanticVectorStore:  # type: ignore
        pass
    class VectorStoreQuery:  # type: ignore
        pass
    class VectorStoreQueryResult:  # type: ignore
        pass


class MemoraVectorStore(BasePydanticVectorStore):
    """LlamaIndex VectorStore provider backed by Memora."""

    stores_text: bool = True
    is_embedding_query: bool = True

    session_id: str = "default"
    cluster: str = "llamaindex"
    base_url: str = "http://localhost:8000"
    api_key: Optional[str] = None
    _client: Optional[Memora] = None

    def __init__(
        self,
        session_id: str = "default",
        cluster: str = "llamaindex",
        base_url: str = "http://localhost:8000",
        api_key: Optional[str] = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.session_id = session_id
        self.cluster = cluster
        self.base_url = base_url
        self.api_key = api_key
        self._client = Memora(base_url=base_url, api_key=api_key)

    @property
    def client(self) -> Memora:
        if self._client is None:
            self._client = Memora(base_url=self.base_url, api_key=self.api_key)
        return self._client

    def add(self, nodes: List[Any], **add_kwargs: Any) -> List[str]:
        node_ids = []
        for node in nodes:
            text = node.get_content(metadata_mode="all") if hasattr(node, "get_content") else str(node)
            metadata = getattr(node, "metadata", {})
            res = self.client.add(
                text=text,
                session_id=self.session_id,
                cluster=self.cluster,
                metadata=metadata,
            )
            node_ids.append(str(res.id))
        return node_ids

    def delete(self, ref_doc_id: str, **delete_kwargs: Any) -> None:
        self.client.delete(id=ref_doc_id)

    def query(self, query: Any, **kwargs: Any) -> Any:
        query_str = getattr(query, "query_str", None) or str(query)
        top_k = getattr(query, "similarity_top_k", 5)

        memories = self.client.search(
            query=query_str,
            session_id=self.session_id,
            cluster=self.cluster,
            top_k=top_k,
        )

        nodes = []
        similarities = []
        ids = []

        for mem in memories:
            try:
                node = TextNode(
                    text=mem.text,
                    id_=str(mem.id),
                    metadata=mem.metadata,
                )
                nodes.append(node)
            except Exception:
                nodes.append(mem.text)

            similarities.append(mem.similarity_score or 1.0)
            ids.append(str(mem.id))

        try:
            return VectorStoreQueryResult(nodes=nodes, similarities=similarities, ids=ids)
        except Exception:
            return {"nodes": nodes, "similarities": similarities, "ids": ids}
