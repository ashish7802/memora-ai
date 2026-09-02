import os
import asyncio
from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any

from app.core.config import GEMINI_API_KEY
from app.memory.embedding import get_embedding
from app.memory.vector_store import VectorStore
from app.skills.base import SkillRegistry
from app.skills.builtin import register_all_skills
from app.rag.pipeline import RAGPipeline
from app.agents.orchestrator import Orchestrator
from app.learning import (
    ExperienceStore,
    experience_to_dict,
    SkillGenerator,
    SkillRegistryEnhancer,
    UserModel,
    UserModelBuilder,
    user_model_to_dict,
    AutoIntegrator,
)

app = FastAPI(title="Memora Memory & Skills Platform", version="1.0.0")

# Enable CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables (Initially None, initialized in background)
vector_store = None
skill_registry = None
experience_store = None
skill_generator = None
skill_enhancer = None
auto_integrator = None
user_model_builder = None
rag_pipeline = None
orchestrator = None
services_ready = False

async def initialize_services():
    """Heavy initialization function called as a background task"""
    global vector_store, skill_registry, experience_store, skill_generator
    global skill_enhancer, auto_integrator, user_model_builder, rag_pipeline
    global orchestrator, services_ready

    # 1. Initialize Vector Store
    vector_store = VectorStore()

    # 2. Seed database with some initial memories if empty
    try:
        existing_items = vector_store.collection.get()
        if not existing_items or not existing_items.get("ids"):
            vector_store.add_memory(
                "User preference: Preferred morning beverage is fresh ginger tea with raw honey.",
                {"source": "Chat_History_092", "category": "Preference"}
            )
            vector_store.add_memory(
                "Project Context: Memora Foundation Stack runs with FastAPI backend and ChromaDB persistence.",
                {"source": "Documentation_Upload", "category": "Project"}
            )
            vector_store.add_memory(
                "Core Strategy: Always prioritize clean vector index lookups and semantic recall.",
                {"source": "System_Directive", "category": "Strategy"}
            )
    except Exception as e:
        print(f"Warning: Seeding initial memories failed: {e}")

    # 3. Initialize Registries, Skills, RAG, ExperienceStore and Orchestrator
    skill_registry = SkillRegistry()
    register_all_skills(skill_registry, vector_store=vector_store)

    experience_store = ExperienceStore()
    skill_generator = SkillGenerator(experience_store=experience_store)
    skill_enhancer = SkillRegistryEnhancer(skill_registry=skill_registry, generator=skill_generator)
    auto_integrator = AutoIntegrator(skill_generator=skill_generator, skill_enhancer=skill_enhancer, threshold=0.8)
    user_model_builder = UserModelBuilder(experience_store=experience_store)
    rag_pipeline = RAGPipeline(vector_store=vector_store)
    orchestrator = Orchestrator(registry=skill_registry, vector_store=vector_store, experience_store=experience_store)

    services_ready = True
    print("Services initialized successfully!")

@app.on_event("startup")
async def startup_event():
    # Start initialization in background so server doesn't timeout
    asyncio.create_task(initialize_services())

def require_services():
    """Helper function to check if services are ready"""
    if not services_ready:
        raise HTTPException(status_code=503, detail="Service is starting up. Please wait a few seconds.")
    return vector_store, orchestrator, experience_store, skill_generator, skill_enhancer, auto_integrator, user_model_builder

class AddMemoryPayload(BaseModel):
    text: str
    metadata: Optional[Dict[str, Any]] = None

class ChatPayload(BaseModel):
    message: str
    session_id: Optional[str] = "default"

@app.get("/", response_class=HTMLResponse)
def get_dashboard():
    try:
        if services_ready:
            count = vector_store.collection.count()
        else:
            count = 0
    except Exception:
        count = 0

    html_content = """<!doctype html>
<html lang="en" class="h-full">
  <head>
    <script>
      // Fix for platform/extension attempts to override read-only window.fetch
      try {
        let activeFetch = window.fetch;
        Object.defineProperty(window, 'fetch', {
          get: function() {
            return activeFetch;
          },
          set: function(val) {
            activeFetch = val;
          },
          configurable: true,
          enumerable: true
        });
      } catch (e) {
        console.warn("Failed to define custom window.fetch accessors:", e);
      }
    </script>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Memora - Agent Memory & Skills Platform</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..700;1,400..700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet" />
    <style>
      body {
        font-family: 'Plus Jakarta Sans', sans-serif;
      }
      .font-serif {
        font-family: 'Playfair Display', serif;
      }
      .font-mono {
        font-family: 'Fira Code', monospace;
      }
    </style>
  </head>
  <body class="h-full bg-[#FDFBF7] text-[#3C3C3B] flex flex-col overflow-hidden">
    <!-- Header -->
    <header class="flex justify-between items-center px-8 py-5 border-b border-[#E6E2DE] bg-white shadow-sm">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-[#A3B18A] rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-sm">M</div>
        <div>
          <h1 class="text-xl font-serif font-semibold tracking-tight text-[#2D2D2A]">
            Memora <span class="text-sm font-sans font-normal text-[#A3B18A] ml-2 px-2.5 py-0.5 bg-[#A3B18A1A] rounded-md">Engine v2.0</span>
          </h1>
        </div>
      </div>
      <nav class="flex gap-8 text-xs font-semibold uppercase tracking-widest text-[#8A817C]">
        <span class="text-[#A3B18A] border-b-2 border-[#A3B18A] pb-1 cursor-pointer">Architecture</span>
        <span class="hover:text-[#A3B18A] transition-colors cursor-pointer" onclick="switchTab('search')">Memory Layer</span>
        <span class="hover:text-[#A3B18A] transition-colors cursor-pointer" onclick="switchTab('chat')">Skill Library</span>
      </nav>
    </header>

    <!-- Main Container -->
    <main class="flex-1 grid grid-cols-12 gap-8 p-8 overflow-hidden">
      
      <!-- Left Sidebar: Core Components -->
      <section class="col-span-3 flex flex-col gap-5 overflow-y-auto pr-2">
        <h2 class="text-xs uppercase font-bold tracking-widest text-[#8A817C] mb-1">Core Components</h2>
        <div class="flex flex-col gap-3">
          <div class="p-3.5 bg-white border border-[#E6E2DE] rounded-xl shadow-sm flex items-center gap-3">
            <div class="w-2.5 h-2.5 rounded-full bg-[#A3B18A]"></div>
            <div>
              <p class="text-xs font-mono font-medium text-[#2D2D2A]">app/agents/orchestrator.py</p>
              <p class="text-[10px] text-[#8A817C] mt-0.5">LangGraph Agent Loop</p>
            </div>
          </div>
          <div class="p-3.5 bg-white border border-[#E6E2DE] rounded-xl shadow-sm flex items-center gap-3">
            <div class="w-2.5 h-2.5 rounded-full bg-[#A3B18A]"></div>
            <div>
              <p class="text-xs font-mono font-medium text-[#2D2D2A]">app/rag/pipeline.py</p>
              <p class="text-[10px] text-[#8A817C] mt-0.5">Context Recall Engine</p>
            </div>
          </div>
          <div class="p-3.5 bg-white border border-[#E6E2DE] rounded-xl shadow-sm flex items-center gap-3">
            <div class="w-2.5 h-2.5 rounded-full bg-[#A3B18A]"></div>
            <div>
              <p class="text-xs font-mono font-medium text-[#2D2D2A]">app/skills/builtin.py</p>
              <p class="text-[10px] text-[#8A817C] mt-0.5">Custom Skills Suite</p>
            </div>
          </div>
          <div class="p-3.5 bg-white border border-[#E6E2DE] rounded-xl shadow-sm flex items-center gap-3">
            <div class="w-2.5 h-2.5 rounded-full bg-[#D4A373]"></div>
            <div>
              <p class="text-xs font-mono font-medium text-[#2D2D2A]">app/memory/vector_store.py</p>
              <p class="text-[10px] text-[#8A817C] mt-0.5">ChromaDB Wrapper</p>
            </div>
          </div>
        </div>

        <div class="mt-4 p-5 bg-[#5881571A] rounded-2xl border border-[#58815733]">
          <h3 class="text-xs uppercase tracking-wider font-bold text-[#588157] mb-2">LangGraph & Gemini Status</h3>
          <p class="text-xs text-[#588157CC] leading-relaxed font-mono text-[11px]">
            Orchestrator: Loading...<br>
            Skills Registered: 4<br>
            Loop: Operational
          </p>
        </div>
      </section>

      <!-- Center Pane: Memory & Intelligence Controls -->
      <section class="col-span-6 flex flex-col gap-6 h-full overflow-hidden">
        
        <!-- Tab view for searching vs adding memories -->
        <div class="bg-white rounded-3xl border border-[#E6E2DE] shadow-sm p-6 flex flex-col overflow-hidden flex-1">
          <div class="flex border-b border-[#E6E2DE] pb-4 justify-between items-center">
            <h2 class="text-lg font-serif italic text-[#2D2D2A] font-semibold">Memory Insight Console</h2>
            <div class="flex gap-2">
              <button id="tab-chat" class="px-4 py-1.5 rounded-full text-xs font-semibold bg-[#A3B18A] text-white transition-all cursor-pointer" onclick="switchTab('chat')">Chat Agent</button>
              <button id="tab-search" class="px-4 py-1.5 rounded-full text-xs font-semibold text-[#8A817C] bg-[#FDFBF7] border border-[#E6E2DE] hover:bg-white transition-all cursor-pointer" onclick="switchTab('search')">Search Stream</button>
              <button id="tab-add" class="px-4 py-1.5 rounded-full text-xs font-semibold text-[#8A817C] bg-[#FDFBF7] border border-[#E6E2DE] hover:bg-white transition-all cursor-pointer" onclick="switchTab('add')">Inject Memory</button>
            </div>
          </div>

          <!-- Dynamic Container for Active Tab -->
          <div class="flex-1 overflow-y-auto py-5 space-y-4">
            
            <!-- CHAT TAB CONTENT -->
            <div id="content-chat" class="space-y-4 flex flex-col h-full overflow-hidden">
              <div class="flex-1 overflow-y-auto space-y-3 pr-2" id="chat-messages">
                <div class="p-3 bg-[#F8F5F2] rounded-xl text-xs text-[#8A817C]">
                  Welcome to Memora Orchestrator. Type a message below to query skills like math, current time, web search, or memory storage!
                </div>
              </div>
              <div class="flex gap-3">
                <input id="chat-input" type="text" placeholder="Ask Memora (e.g. What is the square root of 25?)" 
                  class="flex-1 px-4 py-2.5 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#A3B18A]"
                  onkeydown="if(event.key === 'Enter') triggerChat()" />
                <button onclick="triggerChat()" class="px-5 py-2.5 bg-[#A3B18A] hover:bg-[#8F9F76] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer">
                  Send
                </button>
              </div>
            </div>

            <!-- SEARCH TAB CONTENT (HIDDEN BY DEFAULT) -->
            <div id="content-search" class="hidden space-y-4">
              <div class="flex gap-3">
                <input id="search-input" type="text" placeholder="Query semantic context (e.g. morning beverage preference)" 
                  class="flex-1 px-4 py-2.5 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#A3B18A]"
                  onkeydown="if(event.key === 'Enter') triggerSearch()" />
                <button onclick="triggerSearch()" class="px-5 py-2.5 bg-[#3C3C3B] hover:bg-[#2D2D2A] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer">
                  Search
                </button>
              </div>

              <!-- Search results will inject here -->
              <div id="search-results" class="space-y-4">
                <div class="text-center py-8 text-xs text-[#8A817C]">
                  Type a semantic query above and click search to retrieve real vectors.
                </div>
              </div>
            </div>

            <!-- ADD MEMORY TAB CONTENT (HIDDEN BY DEFAULT) -->
            <div id="content-add" class="hidden space-y-4">
              <div class="space-y-3">
                <label class="block text-xs uppercase font-bold tracking-widest text-[#8A817C]">Memory Content</label>
                <textarea id="add-text" rows="3" placeholder="Enter a statement or preference (e.g., User is highly interested in Rust programming and prefers dark-mode themes)." 
                  class="w-full px-4 py-3 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#A3B18A]"></textarea>
              </div>
              
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs uppercase font-bold tracking-widest text-[#8A817C] mb-1">Source</label>
                  <input id="add-source" type="text" placeholder="e.g. User_Input" class="w-full px-3 py-2 bg-[#FDFBF7] border border-[#E6E2DE] rounded-lg text-xs" />
                </div>
                <div>
                  <label class="block text-xs uppercase font-bold tracking-widest text-[#8A817C] mb-1">Category</label>
                  <input id="add-category" type="text" placeholder="e.g. Habit" class="w-full px-3 py-2 bg-[#FDFBF7] border border-[#E6E2DE] rounded-lg text-xs" />
                </div>
              </div>

              <button onclick="triggerAddMemory()" class="w-full py-3 bg-[#A3B18A] hover:bg-[#8F9F76] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors cursor-pointer">
                Commit to ChromaDB Vector Store
              </button>
              <div id="add-status" class="hidden p-3.5 rounded-xl text-xs text-center font-semibold"></div>
            </div>

          </div>

          <!-- Live Embedding Test Widget -->
          <div class="p-4 bg-[#F8F5F2] rounded-2xl border border-[#E6E2DE] flex flex-col gap-3">
            <div class="flex justify-between items-center">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-[#A3B18A] animate-pulse"></span>
                <span class="text-[10px] uppercase font-bold tracking-widest text-[#8A817C]">Real-time Vector Test</span>
              </div>
              <span class="text-[10px] text-[#A3B18A] font-mono font-semibold">GET /test-embed</span>
            </div>
            
            <div class="flex gap-2">
              <input id="test-embed-text" type="text" placeholder="Generate quick embedding" class="flex-1 px-3 py-1.5 bg-white border border-[#E6E2DE] rounded-lg text-xs" />
              <button onclick="triggerEmbedTest()" class="px-3 py-1.5 bg-[#3C3C3B] hover:bg-[#2D2D2A] text-white text-[10px] font-bold rounded-lg cursor-pointer">Generate</button>
            </div>
            <div id="test-embed-result" class="hidden p-3 bg-white border border-[#E6E2DE] rounded-xl font-mono text-[10px] max-h-24 overflow-y-auto text-[#8A817C]"></div>
          </div>

        </div>
      </section>

      <!-- Right Sidebar: Database Stats & Custom Skills -->
      <section class="col-span-3 flex flex-col gap-6 overflow-y-auto">
        <div class="bg-[#D4A3731A] p-6 rounded-3xl border border-[#D4A37333] shadow-sm">
          <h3 class="text-xs uppercase font-bold tracking-widest text-[#D4A373] mb-4">ChromaDB Stats</h3>
          <div class="space-y-4">
            <div>
              <p id="stats-count" class="text-3xl font-serif font-bold text-[#3C3C3B]">{CHROMA_COUNT}</p>
              <p class="text-[10px] text-[#8A817C] uppercase tracking-wider font-bold mt-1">Active Embeddings</p>
            </div>
            <div class="h-px bg-[#D4A37333]"></div>
            <div>
              <p class="text-lg font-mono font-bold text-[#3C3C3B]">memora_collection</p>
              <p class="text-[10px] text-[#8A817C] uppercase tracking-wider font-bold mt-1">Collection Instance</p>
            </div>
          </div>
        </div>

        <div class="flex-1 bg-white rounded-3xl border border-[#E6E2DE] p-6 shadow-sm flex flex-col overflow-hidden">
          <h3 class="text-xs uppercase font-bold tracking-widest text-[#8A817C] mb-4">Skill Registry</h3>
          <div class="flex-1 overflow-y-auto space-y-3">
            <div class="flex items-center justify-between p-2.5 bg-[#FDFBF7] rounded-xl border border-[#E6E2DE]">
              <div>
                <span class="text-xs font-mono font-bold text-[#2D2D2A]">calculator</span>
                <p class="text-[9px] text-[#8A817C] mt-0.5">Executes math expression</p>
              </div>
              <span class="w-2 h-2 rounded-full bg-[#A3B18A]"></span>
            </div>
            <div class="flex items-center justify-between p-2.5 bg-[#FDFBF7] rounded-xl border border-[#E6E2DE]">
              <div>
                <span class="text-xs font-mono font-bold text-[#2D2D2A]">time</span>
                <p class="text-[9px] text-[#8A817C] mt-0.5">Get current date and time</p>
              </div>
              <span class="w-2 h-2 rounded-full bg-[#A3B18A]"></span>
            </div>
            <div class="flex items-center justify-between p-2.5 bg-[#FDFBF7] rounded-xl border border-[#E6E2DE]">
              <div>
                <span class="text-xs font-mono font-bold text-[#2D2D2A]">web_search</span>
                <p class="text-[9px] text-[#8A817C] mt-0.5">Search via DuckDuckGo</p>
              </div>
              <span class="w-2 h-2 rounded-full bg-[#A3B18A]"></span>
            </div>
            <div class="flex items-center justify-between p-2.5 bg-[#FDFBF7] rounded-xl border border-[#E6E2DE]">
              <div>
                <span class="text-xs font-mono font-bold text-[#2D2D2A]">save_note</span>
                <p class="text-[9px] text-[#8A817C] mt-0.5">Commit note to vector store</p>
              </div>
              <span class="w-2 h-2 rounded-full bg-[#A3B18A]"></span>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- Footer -->
    <footer class="h-12 bg-[#3C3C3B] text-[#FDFBF7] flex items-center justify-between px-8 text-[9px] uppercase tracking-[0.2em]">
      <div>Memora Foundation Stack • Agent Intelligence Layer</div>
      <div class="flex gap-6">
        <span>FastAPI Status: 200 OK</span>
        <span>Uvicorn Server Port 3000</span>
      </div>
    </footer>

    <!-- Frontend Interactive Logic -->
    <script>
      let activeTab = 'chat';

      function switchTab(tab) {
        activeTab = tab;
        const btnChat = document.getElementById('tab-chat');
        const btnSearch = document.getElementById('tab-search');
        const btnAdd = document.getElementById('tab-add');
        
        const contentChat = document.getElementById('content-chat');
        const contentSearch = document.getElementById('content-search');
        const contentAdd = document.getElementById('content-add');

        // Reset all
        btnChat.className = "px-4 py-1.5 rounded-full text-xs font-semibold text-[#8A817C] bg-[#FDFBF7] border border-[#E6E2DE] hover:bg-white transition-all cursor-pointer";
        btnSearch.className = "px-4 py-1.5 rounded-full text-xs font-semibold text-[#8A817C] bg-[#FDFBF7] border border-[#E6E2DE] hover:bg-white transition-all cursor-pointer";
        btnAdd.className = "px-4 py-1.5 rounded-full text-xs font-semibold text-[#8A817C] bg-[#FDFBF7] border border-[#E6E2DE] hover:bg-white transition-all cursor-pointer";
        
        contentChat.classList.add('hidden');
        contentSearch.classList.add('hidden');
        contentAdd.classList.add('hidden');

        if (tab === 'chat') {
          btnChat.className = "px-4 py-1.5 rounded-full text-xs font-semibold bg-[#A3B18A] text-white transition-all cursor-pointer";
          contentChat.classList.remove('hidden');
        } else if (tab === 'search') {
          btnSearch.className = "px-4 py-1.5 rounded-full text-xs font-semibold bg-[#A3B18A] text-white transition-all cursor-pointer";
          contentSearch.classList.remove('hidden');
        } else {
          btnAdd.className = "px-4 py-1.5 rounded-full text-xs font-semibold bg-[#A3B18A] text-white transition-all cursor-pointer";
          contentAdd.classList.remove('hidden');
        }
      }

      async function updateStats() {
        try {
          const response = await fetch('/api/stats');
          const data = await response.json();
          document.getElementById('stats-count').innerText = data.count || 0;
        } catch (error) {
          console.error("Error updating stats:", error);
        }
      }

      async function triggerChat() {
        const inputEl = document.getElementById('chat-input');
        const text = inputEl.value.trim();
        if (!text) return;

        inputEl.value = '';
        const chatMessages = document.getElementById('chat-messages');
        
        // Add User Message
        chatMessages.innerHTML += `
          <div class="flex justify-end">
            <div class="p-3 bg-[#A3B18A] text-white text-xs rounded-xl max-w-xs shadow-sm">
              ${escapeHtml(text)}
            </div>
          </div>
        `;
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Add loading placeholder
        const loadId = 'msg-load-' + Date.now();
        chatMessages.innerHTML += `
          <div class="flex justify-start" id="${loadId}">
            <div class="p-3 bg-[#F8F5F2] text-xs text-[#8A817C] rounded-xl max-w-xs shadow-sm flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-[#A3B18A] animate-ping"></span>
              Thinking...
            </div>
          </div>
        `;
        chatMessages.scrollTop = chatMessages.scrollHeight;

        try {
          const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, session_id: "default" })
          });
          const data = await response.json();
          
          document.getElementById(loadId).remove();
          
          chatMessages.innerHTML += `
            <div class="flex justify-start">
              <div class="p-3 bg-[#F8F5F2] text-xs text-[#2D2D2A] rounded-xl max-w-md shadow-sm whitespace-pre-line leading-relaxed">
                ${escapeHtml(data.response || "No response generated.")}
              </div>
            </div>
          `;
          chatMessages.scrollTop = chatMessages.scrollHeight;
          updateStats();
        } catch (error) {
          document.getElementById(loadId).remove();
          chatMessages.innerHTML += `
            <div class="flex justify-start">
              <div class="p-3 bg-red-50 text-xs text-red-600 rounded-xl max-w-xs shadow-sm">
                Error: ${error.message}
              </div>
            </div>
          `;
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
      }

      async function triggerSearch() {
        const query = document.getElementById('search-input').value.trim();
        const resultsContainer = document.getElementById('search-results');
        
        if (!query) {
          resultsContainer.innerHTML = '<div class="text-center py-8 text-xs text-red-500">Please enter a valid query string.</div>';
          return;
        }

        resultsContainer.innerHTML = `
          <div class="flex items-center justify-center py-10 gap-3">
            <span class="w-2.5 h-2.5 rounded-full bg-[#A3B18A] animate-ping"></span>
            <span class="text-xs text-[#8A817C] uppercase tracking-wider font-semibold">Running semantic similarity scan...</span>
          </div>
        `;

        try {
          const response = await fetch(`/api/memory/search?q=${encodeURIComponent(query)}`);
          const results = await response.json();
          
          if (!results || results.length === 0) {
            resultsContainer.innerHTML = '<div class="text-center py-8 text-xs text-[#8A817C]">No matching semantic memories found in ChromaDB.</div>';
            return;
          }

          let html = '';
          results.forEach((item, index) => {
            const score = item.distance !== undefined ? (1 - parseFloat(item.distance)).toFixed(3) : 'N/A';
            const metadataStr = Object.entries(item.metadata || {})
              .map(([k, v]) => `${k}: ${v}`)
              .join(' | ') || 'None';

            html += `
              <div class="flex gap-4 p-4 bg-[#FDFBF7] rounded-xl border border-[#E6E2DE] transition-all hover:border-[#A3B18A]">
                <div class="flex-shrink-0 w-8 h-8 rounded-full bg-[#A3B18A1A] flex items-center justify-center text-[#A3B18A] text-xs font-bold">
                  0${index + 1}
                </div>
                <div class="flex-1">
                  <p class="text-sm font-medium text-[#2D2D2A]">${escapeHtml(item.text)}</p>
                  <p class="text-[10px] text-[#8A817C] mt-1.5 font-mono">Similarity Confidence: <span class="text-[#A3B18A] font-bold">${score}</span></p>
                  <div class="mt-2.5 flex flex-wrap gap-2">
                    <span class="px-2 py-0.5 bg-white border border-[#E6E2DE] rounded text-[9px] text-[#8A817C] font-mono">ID: ${item.id.slice(0, 8)}...</span>
                    <span class="px-2 py-0.5 bg-white border border-[#E6E2DE] rounded text-[9px] text-[#A3B18A] font-mono">${escapeHtml(metadataStr)}</span>
                  </div>
                </div>
              </div>
            `;
          });
          resultsContainer.innerHTML = html;
        } catch (error) {
          resultsContainer.innerHTML = `<div class="text-center py-8 text-xs text-red-500">Error: ${error.message}</div>`;
        }
      }

      async function triggerAddMemory() {
        const text = document.getElementById('add-text').value.trim();
        const source = document.getElementById('add-source').value.trim() || 'UI_Entry';
        const category = document.getElementById('add-category').value.trim() || 'General';
        const statusDiv = document.getElementById('add-status');

        if (!text) {
          statusDiv.className = "p-3.5 rounded-xl text-xs text-center font-semibold bg-red-100 text-red-600";
          statusDiv.innerText = "Memory text cannot be empty!";
          statusDiv.classList.remove('hidden');
          return;
        }

        statusDiv.className = "p-3.5 rounded-xl text-xs text-center font-semibold bg-[#FDFBF7] border border-[#E6E2DE] text-[#8A817C]";
        statusDiv.innerText = "Saving to vector space...";
        statusDiv.classList.remove('hidden');

        try {
          const response = await fetch('/api/memory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: text,
              metadata: {
                source: source,
                category: category,
                timestamp: new Date().toISOString()
              }
            })
          });

          const data = await response.json();
          if (response.ok) {
            statusDiv.className = "p-3.5 rounded-xl text-xs text-center font-semibold bg-green-100 text-green-700";
            statusDiv.innerText = `Success! Saved with ID: ${data.id}`;
            document.getElementById('add-text').value = '';
            updateStats();
            setTimeout(() => {
              switchTab('search');
              document.getElementById('search-input').value = text;
              triggerSearch();
            }, 1200);
          } else {
            throw new Error(data.detail || "Failed to save memory.");
          }
        } catch (error) {
          statusDiv.className = "p-3.5 rounded-xl text-xs text-center font-semibold bg-red-100 text-red-600";
          statusDiv.innerText = `Error: ${error.message}`;
        }
      }

      async function triggerEmbedTest() {
        const text = document.getElementById('test-embed-text').value.trim();
        const resultContainer = document.getElementById('test-embed-result');

        if (!text) {
          resultContainer.innerText = "Please enter some text.";
          resultContainer.classList.remove('hidden');
          return;
        }

        resultContainer.innerText = "Generating...";
        resultContainer.classList.remove('hidden');

        try {
          const response = await fetch(`/test-embed?text=${encodeURIComponent(text)}`);
          const data = await response.json();
          if (data.embedding) {
            resultContainer.innerText = JSON.stringify(data.embedding);
          } else {
            resultContainer.innerText = JSON.stringify(data);
          }
        } catch (error) {
          resultContainer.innerText = `Error: ${error.message}`;
        }
      }

      function escapeHtml(text) {
        return text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }

      // On Initial Load
      updateStats();
      switchTab('chat');
    </script>
  </body>
</html>
"""
    return HTMLResponse(content=html_content.replace("{CHROMA_COUNT}", str(count)))


@app.post("/chat")
@app.post("/api/chat")
def chat_endpoint(payload: ChatPayload):
    vs, orch, es, sg, se, ai, umb = require_services()
    try:
        session_id = payload.session_id or "default"
        response_text = orch.run(payload.message, session_id=session_id)
        return {"response": response_text, "session_id": session_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/memory/{session_id}")
def get_memories_by_session(session_id: str):
    vs, orch, es, sg, se, ai, umb = require_services()
    try:
        # Fetch matching items from the collections with the target session_id
        results = vs.collection.get(
            where={"session_id": session_id},
            limit=10
        )
        
        formatted = []
        if results and "ids" in results and results["ids"]:
            ids = results["ids"]
            documents = results.get("documents", [])
            metadatas = results.get("metadatas", [])
            
            for i in range(len(ids)):
                formatted.append({
                    "id": ids[i],
                    "text": documents[i] if i < len(documents) else "",
                    "metadata": metadatas[i] if (metadatas and i < len(metadatas)) else {}
                })
        return {"memories": formatted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/memory")
def add_memory_endpoint(payload: AddMemoryPayload):
    vs, orch, es, sg, se, ai, umb = require_services()
    try:
        memory_id = vs.add_memory(payload.text, payload.metadata)
        return {"id": memory_id, "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/memory/search")
def search_memory_endpoint(q: str = Query(..., description="Semantic search query")):
    vs, orch, es, sg, se, ai, umb = require_services()
    try:
        results = vs.search_memory(q)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stats")
def get_stats_endpoint():
    try:
        if services_ready:
            return {"count": vector_store.collection.count()}
        else:
            return {"count": 0}
    except Exception as e:
        return {"count": 0, "error": str(e)}


@app.get("/test-embed")
def test_embed(text: str = Query(..., description="Text to generate embedding for")):
    try:
        embedding = get_embedding(text)
        return {"embedding": embedding}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/experiences/{session_id}")
def get_experiences_by_session_endpoint(session_id: str):
    vs, orch, es, sg, se, ai, umb = require_services()
    try:
        exps = es.get_by_session(session_id)
        return {
            "session_id": session_id,
            "experiences": [experience_to_dict(exp) for exp in exps],
            "count": len(exps)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/experiences")
def get_recent_experiences_endpoint(limit: int = 100):
    vs, orch, es, sg, se, ai, umb = require_services()
    try:
        exps = es.get_recent(limit=limit)
        return {
            "experiences": [experience_to_dict(exp) for exp in exps],
            "count": len(exps)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class AnalyzeSkillsPayload(BaseModel):
    session_id: Optional[str] = None


@app.post("/api/skills/analyze")
def analyze_skills_endpoint(payload: Optional[AnalyzeSkillsPayload] = None, session_id: Optional[str] = None):
    vs, orch, es, sg, se, ai, umb = require_services()
    try:
        target_session = (payload.session_id if payload and payload.session_id else None) or session_id
        proposals = sg.analyze_experiences(session_id=target_session)
        return {
            "status": "success",
            "message": f"Analysis complete. Generated/updated {len(proposals)} proposals.",
            "count": len(proposals),
            "proposals": [
                p.model_dump(mode="json") if hasattr(p, "model_dump") else p.dict()
                for p in proposals
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/skills/proposals")
def get_skill_proposals_endpoint(status: Optional[str] = None):
    vs, orch, es, sg, se, ai, umb = require_services()
    try:
        proposals = sg.get_proposals(status=status)
        return {
            "status": "success",
            "count": len(proposals),
            "proposals": [
                p.model_dump(mode="json") if hasattr(p, "model_dump") else p.dict()
                for p in proposals
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/skills/integrate/{proposal_name}")
def integrate_skill_endpoint(proposal_name: str):
    vs, orch, es, sg, se, ai, umb = require_services()
    try:
        proposal = sg.get_proposal(proposal_name)
        if not proposal:
            raise HTTPException(status_code=404, detail=f"Proposal '{proposal_name}' not found.")

        success = se.integrate_proposal(proposal)
        if not success:
            raise HTTPException(status_code=500, detail=f"Failed to integrate skill '{proposal_name}'.")

        return {
            "status": "success",
            "message": f"Skill '{proposal_name}' successfully integrated into SkillRegistry.",
            "skill_name": proposal_name,
            "proposal": proposal.model_dump(mode="json") if hasattr(proposal, "model_dump") else proposal.dict()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/skills/auto-integrate")
def auto_integrate_endpoint():
    vs, orch, es, sg, se, ai, umb = require_services()
    try:
        integrated = ai.check_and_integrate()
        return {
            "status": "success",
            "message": f"Auto-integration check completed. {len(integrated)} skills integrated.",
            "count": len(integrated),
            "integrated_skills": integrated
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class AnalyzeUserPayload(BaseModel):
    session_id: Optional[str] = None


@app.get("/api/users/{session_id}/model")
def get_user_model_endpoint(session_id: str):
    vs, orch, es, sg, se, ai, umb = require_services()
    try:
        model = umb.build_from_experiences(session_id)
        return {
            "status": "success",
            "session_id": session_id,
            "user_model": user_model_to_dict(model)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/users/analyze")
def analyze_users_endpoint(payload: Optional[AnalyzeUserPayload] = None, session_id: Optional[str] = None):
    vs, orch, es, sg, se, ai, umb = require_services()
    try:
        target_session = (payload.session_id if payload and payload.session_id else None) or session_id
        if target_session:
            model = umb.build_from_experiences(target_session)
            return {
                "status": "success",
                "message": f"User model analyzed and built for session '{target_session}'.",
                "user_models": [user_model_to_dict(model)]
            }
        else:
            models = umb.build_all_users()
            return {
                "status": "success",
                "message": f"User models analyzed and updated for {len(models)} sessions.",
                "count": len(models),
                "user_models": [user_model_to_dict(m) for m in models.values()]
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=True)
