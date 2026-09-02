from typing import Any, Dict, Optional, Type
from pydantic import BaseModel, Field
from memora.client import Memora

try:
    from crewai.tools import BaseTool
except ImportError:
    class BaseTool:  # type: ignore
        name: str = ""
        description: str = ""
        args_schema: Optional[Type[BaseModel]] = None


class MemoraSearchSchema(BaseModel):
    query: str = Field(..., description="The semantic search query to look up in agent long-term memory")
    top_k: int = Field(default=3, description="Number of relevant memory items to retrieve")


class MemoraRememberSchema(BaseModel):
    text: str = Field(..., description="Fact, conclusion, or insight to commit to durable memory")
    importance: float = Field(default=1.0, description="Priority weight from 0.0 to 5.0")


class MemoraCrewAITool(BaseTool):
    """Tool for CrewAI agents to read and write to Memora cognitive memory."""

    name: str = "memora_memory"
    description: str = (
        "Useful for storing important facts and recalling past context, user preferences, "
        "and previous agent findings using semantic vector search."
    )
    args_schema: Type[BaseModel] = MemoraSearchSchema

    session_id: str = "crew_session"
    agent_id: Optional[str] = None
    cluster: str = "agent_knowledge"
    base_url: str = "http://localhost:8000"
    api_key: Optional[str] = None
    _client: Optional[Memora] = None

    def __init__(
        self,
        session_id: str = "crew_session",
        agent_id: Optional[str] = None,
        cluster: str = "agent_knowledge",
        base_url: str = "http://localhost:8000",
        api_key: Optional[str] = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.session_id = session_id
        self.agent_id = agent_id
        self.cluster = cluster
        self.base_url = base_url
        self.api_key = api_key
        self._client = Memora(base_url=base_url, api_key=api_key)

    def _run(self, query: str, top_k: int = 3) -> str:
        """Search memory for relevant facts."""
        if not self._client:
            self._client = Memora(base_url=self.base_url, api_key=self.api_key)

        results = self._client.search(
            query=query,
            session_id=self.session_id,
            cluster=self.cluster,
            top_k=top_k,
        )

        if not results:
            return "No relevant memories found."

        return "\n".join([f"- {item.text} (similarity: {item.similarity_score:.2f})" for item in results])

    def remember(self, text: str, importance: float = 1.0) -> str:
        """Helper to let agent store a memory explicitly."""
        if not self._client:
            self._client = Memora(base_url=self.base_url, api_key=self.api_key)

        res = self._client.add(
            text=text,
            session_id=self.session_id,
            agent_id=self.agent_id,
            cluster=self.cluster,
            importance=importance,
        )
        return f"Memory stored with ID: {res.id}"
