from typing import Any, Dict, List, Optional
from memora.client import Memora

try:
    from langchain_core.memory import BaseMemory
    from langchain_core.messages import BaseMessage, get_buffer_string
except ImportError:
    # Graceful fallback if langchain_core is not installed
    class BaseMemory:  # type: ignore
        pass


class MemoraLangChainMemory(BaseMemory):
    """LangChain memory provider powered by Memora pgvector backend."""

    memory_key: str = "history"
    session_id: str = "default"
    user_id: Optional[str] = None
    input_key: Optional[str] = "input"
    output_key: Optional[str] = "output"
    return_messages: bool = False
    top_k: int = 5
    cluster: str = "conversation"
    client: Optional[Any] = None

    def __init__(
        self,
        session_id: str = "default",
        user_id: Optional[str] = None,
        base_url: str = "http://localhost:8000",
        api_key: Optional[str] = None,
        top_k: int = 5,
        cluster: str = "conversation",
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.session_id = session_id
        self.user_id = user_id
        self.top_k = top_k
        self.cluster = cluster
        self.client = Memora(base_url=base_url, api_key=api_key)

    @property
    def memory_variables(self) -> List[str]:
        return [self.memory_key]

    def load_memory_variables(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Fetch associative memories related to the current input."""
        query_text = ""
        if self.input_key and self.input_key in inputs:
            query_text = str(inputs[self.input_key])
        elif inputs:
            query_text = " ".join(str(v) for v in inputs.values())

        if not query_text.strip():
            return {self.memory_key: "" if not self.return_messages else []}

        memories = self.client.search(
            query=query_text,
            session_id=self.session_id,
            user_id=self.user_id,
            top_k=self.top_k,
        )

        formatted_context = "\n".join([f"- {m.text}" for m in memories])
        return {self.memory_key: formatted_context}

    def save_context(self, inputs: Dict[str, Any], outputs: Dict[str, str]) -> None:
        """Store the dialogue exchange as durable associative memory."""
        input_str = inputs.get(self.input_key or "input", "")
        output_str = outputs.get(self.output_key or "output", "")

        memory_text = f"Human: {input_str}\nAI: {output_str}"
        self.client.add(
            text=memory_text,
            session_id=self.session_id,
            user_id=self.user_id,
            cluster=self.cluster,
            importance=1.0,
            metadata={"source": "langchain_dialogue", "type": "context_save"},
        )

    def clear(self) -> None:
        """Prune memories for this session."""
        self.client.prune(session_id=self.session_id)
