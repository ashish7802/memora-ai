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

### 1. Basic Memory Operations (Sync)

```python
from memora import Memora

# Initialize client
client = Memora(base_url="http://localhost:8000")

# 1. Add memory
memory = client.add(
    text="User prefers PostgreSQL 17 with pgvector for vector search",
    session_id="user_123",
    cluster="technical_preferences",
    importance=2.0,
    metadata={"verified": True}
)
print(f"Stored Memory ID: {memory.id}")

# 2. Semantic Search
results = client.search(
    query="What database does the user prefer?",
    session_id="user_123",
    top_k=3
)

for item in results:
    print(f"[{item.cluster}] {item.text} (similarity: {item.similarity_score:.2f})")

# 3. Delete memory
client.delete(id=memory.id)
```

### 2. High-Level Memory Manager (Session-Scoped)

```python
from memora import MemoryManager

# Scoped to a specific conversation or user
mem = MemoryManager(session_id="session_chat_42", base_url="http://localhost:8000")

# Remembers automatically into 'session_chat_42'
mem.remember("User ordered coffee with oat milk at 9:00 AM", cluster="orders")

# Recalls bounded to this session
past_orders = mem.recall("What milk does the user drink?")
for item in past_orders:
    print(item.text)
```

### 3. Async Client (`asyncio`)

```python
import asyncio
from memora import AsyncMemora

async def main():
    async with AsyncMemora(base_url="http://localhost:8000") as client:
        memory = await client.add("Deployment scheduled for Friday at 5pm UTC")
        results = await client.search("When is the deployment?")
        print(results[0].text)

asyncio.run(main())
```

---

## Framework Integrations

### LangChain

```python
from langchain.chains import ConversationChain
from langchain_openai import ChatOpenAI
from memora.integrations.langchain import MemoraLangChainMemory

memory = MemoraLangChainMemory(
    session_id="langchain_user_01",
    base_url="http://localhost:8000"
)

conversation = ConversationChain(
    llm=ChatOpenAI(temperature=0),
    memory=memory,
    verbose=True
)

conversation.predict(input="My favorite programming language is Rust.")
```

### LlamaIndex

```python
from llama_index.core import VectorStoreIndex, StorageContext
from memora.integrations.llamaindex import MemoraVectorStore

vector_store = MemoraVectorStore(
    session_id="llamaindex_docs",
    base_url="http://localhost:8000"
)
storage_context = StorageContext.from_defaults(vector_store=vector_store)

# Now build or query index
# index = VectorStoreIndex.from_documents(documents, storage_context=storage_context)
```

### CrewAI

```python
from crewai import Agent, Task, Crew
from memora.integrations.crewai import MemoraCrewAITool

memory_tool = MemoraCrewAITool(
    session_id="crew_research_project",
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
