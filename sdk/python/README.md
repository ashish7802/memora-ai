# Memora Python SDK

> Sovereign cognitive vector memory & autonomous multi-agent tool framework for Python.

[![PyPI version](https://img.shields.io/pypi/v/memora.svg)](https://pypi.org/project/memora/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

## Installation

```bash
# Core client
pip install memora

# With LangChain support
pip install "memora[langchain]"

# With LlamaIndex support
pip install "memora[llamaindex]"

# With CrewAI support
pip install "memora[crewai]"

# All integrations
pip install "memora[all]"
```

---

## Quickstart

```python
from memora import MemoraClient

# Initialize client with sovereign API key
client = MemoraClient(api_key="mm_...", base_url="http://localhost:8000")

# 1. Remember: Store a memory
client.remember("User prefers Python async and pgvector", session_id="user_123")

# 2. Recall: Semantic vector search
results = client.recall("Python preferences", session_id="user_123")
for mem in results:
    print(f"- {mem.text} (similarity: {mem.similarity_score})")

# 3. Forget: Delete a memory
client.forget(id=results[0].id)
```

---

## High-Level Memory Manager (Session-Scoped)

```python
from memora import MemoryManager

# Scoped to a specific user or multi-agent conversation
mem = MemoryManager(session_id="session_chat_42", api_key="mm_...", base_url="http://localhost:8000")

# Remembers automatically into 'session_chat_42'
mem.remember("User ordered coffee with oat milk at 9:00 AM", cluster="orders")

# Recalls bounded to this session
past_orders = mem.recall("What milk does the user drink?")
for item in past_orders:
    print(item.text)
```

---

## Framework Integrations

### LangChain (`MemoraMemory`)

```python
from langchain.chains import ConversationChain
from langchain_openai import ChatOpenAI
from memora.integrations.langchain import MemoraMemory

memory = MemoraMemory(
    session_id="langchain_user_01",
    api_key="mm_...",
    base_url="http://localhost:8000"
)

conversation = ConversationChain(
    llm=ChatOpenAI(temperature=0),
    memory=memory,
    verbose=True
)

conversation.predict(input="My favorite programming language is Rust.")
```

### LlamaIndex (`MemoraVectorStore`)

```python
from llama_index.core import VectorStoreIndex, StorageContext
from memora.integrations.llamaindex import MemoraVectorStore

vector_store = MemoraVectorStore(
    session_id="llamaindex_docs",
    api_key="mm_...",
    base_url="http://localhost:8000"
)
storage_context = StorageContext.from_defaults(vector_store=vector_store)
```

### CrewAI (`MemoraTool`)

```python
from crewai import Agent, Task, Crew
from memora.integrations.crewai import MemoraTool

memory_tool = MemoraTool(
    session_id="crew_research_project",
    api_key="mm_...",
    base_url="http://localhost:8000"
)

researcher = Agent(
    role="Principal AI Researcher",
    goal="Extract and retain insights from AI papers",
    backstory="You are an expert researcher with access to persistent cognitive memory.",
    tools=[memory_tool],
    verbose=True
)
```

---

## License

MIT © [Memora AI](https://github.com/memora-ai/memora)
