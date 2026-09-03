'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Brain,
  Search,
  MessageSquare,
  PlusCircle,
  Cpu,
  Database,
  Sparkles,
  Send,
  CheckCircle2,
  Clock,
  Layers,
  Zap,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  Terminal,
  Network,
  Kanban,
  HardDrive,
  Share2,
  Activity,
} from 'lucide-react';
import MemorySemanticGraph from '@/components/MemorySemanticGraph';
import SwarmKanban from '@/components/SwarmKanban';
import LocalAndPlatforms from '@/components/LocalAndPlatforms';

import { MemoryItem, SearchResult } from '@/lib/memora/types';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  tool_used?: string | null;
  tool_result?: any | null;
  timestamp: string;
}

interface SkillProposal {
  skill_name: string;
  description: string;
  use_case: string;
  confidence_score: number;
  status: 'proposed' | 'integrated';
  example_queries: string[];
}

export default function MemoraConsole({
  initialTab = 'chat',
  onClose,
}: {
  initialTab?: 'chat' | 'search' | 'add' | 'proposals' | 'learning' | 'swarm' | 'platforms';
  onClose?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'chat' | 'search' | 'add' | 'proposals' | 'learning' | 'swarm' | 'platforms'>(initialTab);
  const [sessionId, setSessionId] = useState('default');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'agent',
      content:
        'Welcome to Memora Orchestrator. Type a message below to query skills like math, unit conversion, text formatting, web search, or memory storage & recall!',
      timestamp: 'Just now',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Memory Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MemoryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Add Memory State
  const [addText, setAddText] = useState('');
  const [addSource, setAddSource] = useState('UI_Entry');
  const [addCategory, setAddCategory] = useState('General');
  const [addStatus, setAddStatus] = useState<{ message: string; type: 'success' | 'error' | 'loading' } | null>(null);

  // Stats State
  const [memoryCount, setMemoryCount] = useState<number>(3);
  const [proposals, setProposals] = useState<SkillProposal[]>([]);
  const [isLoadingProposals, setIsLoadingProposals] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setMemoryCount(data.count ?? 0);
      }
    } catch {
      // ignore
    }
  };

  const fetchProposals = async () => {
    setIsLoadingProposals(true);
    try {
      const res = await fetch('/api/skills/proposals');
      if (res.ok) {
        const data = await res.json();
        setProposals(data.proposals || []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingProposals(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchProposals();
  }, []);

  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content, sessionId }),
      });

      if (!res.ok) throw new Error('Failed to send message');
      const data = await res.json();

      const agentMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: data.reply,
        tool_used: data.tool_used,
        tool_result: data.tool_result,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatMessages((prev) => [...prev, agentMsg]);
      fetchStats();
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'agent',
          content: `Error: ${err.message || 'Something went wrong.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const MEMORA_API_URL = process.env.NEXT_PUBLIC_MEMORA_API_URL || 'http://localhost:8000/v1/memory';

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || isSearching) return;

    setIsSearching(true);
    try {
      const res = await fetch(`${MEMORA_API_URL}/search?q=${encodeURIComponent(searchQuery)}&top_k=10`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      const rawResults = Array.isArray(data) ? data : (data.results || []);
      const formattedResults: MemoryItem[] = rawResults.map((item: any) => ({
        id: String(item.id),
        text: item.text,
        metadata: item.metadata || {},
        score: typeof item.score === 'number' ? item.score : (1 - (item.distance || 0.2)),
        distance: typeof item.score === 'number' ? (1 - item.score) : item.distance,
        created_at: item.created_at,
        decay_score: item.decay_score,
      }));
      setSearchResults(formattedResults);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addText.trim()) return;

    setAddStatus({ message: 'Encoding and saving to Vector Engine...', type: 'loading' });
    try {
      const res = await fetch(MEMORA_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: addText.trim(),
          metadata: {
            source: addSource || 'UI_Entry',
            category: addCategory || 'General',
          },
        }),
      });

      if (!res.ok) throw new Error('Failed to add memory');
      const data = await res.json();

      setAddStatus({ message: `Successfully stored! ID: ${data.id}`, type: 'success' });
      setAddText('');
      fetchStats();
    } catch (err: any) {
      setAddStatus({ message: `Error: ${err.message}`, type: 'error' });
    }
  };

  return (
    <div className="w-full h-full min-h-[750px] flex flex-col bg-[#FDFBF7] rounded-3xl border border-[#E6E2DE] shadow-xl overflow-hidden">
      {/* Top Console Bar */}
      <header className="px-6 py-4 bg-white border-b border-[#E6E2DE] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#588157] flex items-center justify-center text-white shadow-xs">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#2D2D2A]">Memora Control Cockpit</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#588157]/15 text-[#588157]">
                v1.0 Sovereign OS
              </span>
            </div>
            <p className="text-xs text-[#8A817C]">Self-Learning Multi-Agent System &amp; Knowledge Mesh</p>
          </div>
        </div>

        {/* Tab Switcher Pills */}
        <div className="flex items-center gap-1.5 bg-[#F4F1EA] p-1 rounded-2xl border border-[#E6E2DE] overflow-x-auto max-w-full text-xs font-medium">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'chat' ? 'bg-white text-[#2D2D2A] shadow-xs font-semibold' : 'text-[#8A817C] hover:text-[#2D2D2A]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#588157]" />
            <span>Agent Chat</span>
          </button>
          <button
            onClick={() => setActiveTab('swarm')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'swarm' ? 'bg-white text-[#2D2D2A] shadow-xs font-semibold' : 'text-[#8A817C] hover:text-[#2D2D2A]'
            }`}
          >
            <Kanban className="w-3.5 h-3.5 text-[#E76F51]" />
            <span>Swarm Kanban</span>
          </button>
          <button
            onClick={() => setActiveTab('platforms')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'platforms' ? 'bg-white text-[#2D2D2A] shadow-xs font-semibold' : 'text-[#8A817C] hover:text-[#2D2D2A]'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 text-[#3D5A80]" />
            <span>Local &amp; Platforms</span>
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'search' ? 'bg-white text-[#2D2D2A] shadow-xs font-semibold' : 'text-[#8A817C] hover:text-[#2D2D2A]'
            }`}
          >
            <Network className="w-3.5 h-3.5 text-[#2A9D8F]" />
            <span>Vector Graph</span>
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'add' ? 'bg-white text-[#2D2D2A] shadow-xs font-semibold' : 'text-[#8A817C] hover:text-[#2D2D2A]'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5 text-[#D4A373]" />
            <span>Inject Memory</span>
          </button>
          <button
            onClick={() => setActiveTab('learning')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'learning' ? 'bg-white text-[#2D2D2A] shadow-xs font-semibold' : 'text-[#8A817C] hover:text-[#2D2D2A]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#588157]" />
            <span>Self-Learning</span>
          </button>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-[#E6E2DE] hover:bg-[#DCD7D2] text-[#2D2D2A] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Exit Console
          </button>
        )}
      </header>

      {/* Main Console Content */}
      <div className="flex-1 p-6 overflow-hidden flex flex-col bg-[#FDFBF7]">
        {/* TAB 1: AGENT CHAT */}
        {activeTab === 'chat' && (
          <div className="grid grid-cols-12 gap-6 h-full flex-1 overflow-hidden">
            <div className="col-span-12 lg:col-span-8 flex flex-col bg-white rounded-2xl border border-[#E6E2DE] shadow-xs p-5 overflow-hidden">
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] p-4 rounded-2xl text-xs ${
                        msg.role === 'user'
                          ? 'bg-[#588157] text-white rounded-tr-xs'
                          : 'bg-[#F4F1EA] text-[#2D2D2A] border border-[#E6E2DE] rounded-tl-xs'
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      {msg.tool_used && (
                        <div className="mt-2.5 pt-2 border-t border-black/10 flex items-center gap-2 font-mono text-[10px] text-[#588157]">
                          <Zap className="w-3 h-3" />
                          <span>Tool executed: {msg.tool_used}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-[#8A817C] mt-1 px-1">{msg.timestamp}</span>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex items-center gap-2 text-xs text-[#8A817C] p-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#588157]" />
                    <span>Orchestrating vector recall and skills...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="mt-4 pt-3 border-t border-[#E6E2DE] flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask a question, query memories, or execute tool tasks..."
                  className="flex-1 px-4 py-2.5 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl text-xs text-[#2D2D2A] focus:outline-none focus:border-[#588157]"
                />
                <button
                  type="submit"
                  disabled={isChatLoading || !chatInput.trim()}
                  className="px-5 py-2.5 bg-[#588157] hover:bg-[#476a46] disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </div>

            <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 overflow-y-auto">
              {/* Telemetry Stats */}
              <div className="p-5 bg-white rounded-2xl border border-[#E6E2DE] shadow-xs">
                <h3 className="text-xs font-bold text-[#2D2D2A] uppercase tracking-wider mb-3">Telemetry &amp; Engine</h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#F4F1EA]">
                    <span className="text-[#8A817C]">Active Vector Dimension:</span>
                    <span className="font-mono font-bold text-[#2D2D2A]">384-D (all-MiniLM)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F4F1EA]">
                    <span className="text-[#8A817C]">Indexed Memories:</span>
                    <span className="font-mono font-bold text-[#588157]">{memoryCount} Vectors</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F4F1EA]">
                    <span className="text-[#8A817C]">Hermes Swarm:</span>
                    <span className="font-mono font-bold text-[#E76F51]">5 Worker Agents</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#8A817C]">Local Ollama Bridge:</span>
                    <span className="font-mono font-bold text-[#3D5A80]">Online (llama3.2)</span>
                  </div>
                </div>
              </div>

              {/* Quick Prompt Cards */}
              <div className="p-5 bg-white rounded-2xl border border-[#E6E2DE] shadow-xs">
                <h3 className="text-xs font-bold text-[#2D2D2A] uppercase tracking-wider mb-3">Quick Workflows</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setChatInput('What are the key memories stored in the vector database?')}
                    className="w-full text-left p-2.5 bg-[#FDFBF7] hover:bg-[#F4F1EA] rounded-xl border border-[#E6E2DE] text-xs text-[#2D2D2A] transition-colors cursor-pointer"
                  >
                    🧠 Explore stored memory concepts
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('swarm');
                    }}
                    className="w-full text-left p-2.5 bg-[#FDFBF7] hover:bg-[#F4F1EA] rounded-xl border border-[#E6E2DE] text-xs text-[#2D2D2A] transition-colors cursor-pointer"
                  >
                    🐝 Open Multi-Agent Swarm Kanban
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('platforms');
                    }}
                    className="w-full text-left p-2.5 bg-[#FDFBF7] hover:bg-[#F4F1EA] rounded-xl border border-[#E6E2DE] text-xs text-[#2D2D2A] transition-colors cursor-pointer"
                  >
                    🌐 Test Telegram/Discord/Slack webhook
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SWARM KANBAN */}
        {activeTab === 'swarm' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <SwarmKanban
              sessionId={sessionId}
              onSendToChat={(prompt) => {
                setActiveTab('chat');
                setChatInput(prompt);
              }}
            />
          </div>
        )}

        {/* TAB 3: LOCAL & PLATFORMS */}
        {activeTab === 'platforms' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <LocalAndPlatforms
              sessionId={sessionId}
              onSendToChat={(text) => {
                setActiveTab('chat');
                setChatInput(text);
              }}
            />
          </div>
        )}

        {/* TAB 4: VECTOR TOPOLOGY GRAPH & SEARCH */}
        {activeTab === 'search' && (
          <div className="grid grid-cols-12 gap-6 h-full flex-1 overflow-hidden">
            <div className="col-span-12 lg:col-span-8 flex flex-col bg-white rounded-2xl border border-[#E6E2DE] shadow-xs p-5 overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-[#2D2D2A] uppercase tracking-wider">Semantic Topology Graph</h3>
                <span className="text-[10px] text-[#8A817C]">Interactive D3.js Force Simulation</span>
              </div>
              <div className="flex-1 rounded-xl overflow-hidden border border-[#E6E2DE] bg-[#FDFBF7]">
                <MemorySemanticGraph
                  onQueryInChat={(text) => setSearchQuery(text)}
                  onSelectMemory={(item) => setSearchQuery(item.text)}
                />
              </div>
            </div>

            <div className="col-span-12 lg:col-span-4 flex flex-col bg-white rounded-2xl border border-[#E6E2DE] shadow-xs p-5 overflow-hidden">
              <h3 className="text-xs font-bold text-[#2D2D2A] uppercase tracking-wider mb-3">Associative Search</h3>
              <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Semantic query..."
                  className="flex-1 px-3 py-2 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl text-xs text-[#2D2D2A]"
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-3.5 py-2 bg-[#588157] text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              </form>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {searchResults.length === 0 ? (
                  <div className="text-center py-8 text-xs text-[#8A817C]">
                    Enter a query above to calculate cosine vector similarity.
                  </div>
                ) : (
                  searchResults.map((item) => (
                    <div key={item.id} className="p-3 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[10px] font-bold text-[#588157]">#{item.id}</span>
                        <span className="text-[10px] text-[#8A817C]">
                          Sim: {(typeof item.score === 'number' ? item.score * 100 : ((1 - (item.distance || 0.2)) * 100)).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-[#2D2D2A] text-xs">{item.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: INJECT MEMORY */}
        {activeTab === 'add' && (
          <div className="max-w-2xl mx-auto w-full bg-white rounded-2xl border border-[#E6E2DE] shadow-xs p-6 overflow-y-auto">
            <h3 className="text-sm font-bold text-[#2D2D2A] mb-1">Store Persistent Vector Memory</h3>
            <p className="text-xs text-[#8A817C] mb-5">
              Embed structured facts and agent observations directly into the high-dimensional index.
            </p>

            <form onSubmit={handleAddMemory} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-medium text-[#2D2D2A] mb-1.5">Memory Content</label>
                <textarea
                  rows={4}
                  value={addText}
                  onChange={(e) => setAddText(e.target.value)}
                  placeholder="Enter context, user preferences, API contracts, or system rules..."
                  className="w-full p-3 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl text-xs text-[#2D2D2A] focus:outline-none focus:border-[#588157]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#2D2D2A] mb-1.5">Source Identifier</label>
                  <input
                    type="text"
                    value={addSource}
                    onChange={(e) => setAddSource(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl text-xs text-[#2D2D2A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#2D2D2A] mb-1.5">Category</label>
                  <input
                    type="text"
                    value={addCategory}
                    onChange={(e) => setAddCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl text-xs text-[#2D2D2A]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!addText.trim()}
                className="w-full py-3 bg-[#588157] hover:bg-[#476a46] disabled:opacity-50 text-white font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Encode &amp; Ingest Memory
              </button>

              {addStatus && (
                <div
                  className={`p-3 rounded-xl text-xs ${
                    addStatus.type === 'success'
                      ? 'bg-[#588157]/15 text-[#588157]'
                      : addStatus.type === 'error'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-blue-50 text-blue-700'
                  }`}
                >
                  {addStatus.message}
                </div>
              )}
            </form>
          </div>
        )}

        {/* TAB 6: SELF-LEARNING & SKILLS */}
        {activeTab === 'learning' && (
          <div className="grid grid-cols-12 gap-6 h-full flex-1 overflow-hidden">
            <div className="col-span-12 lg:col-span-6 bg-white rounded-2xl border border-[#E6E2DE] shadow-xs p-5 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-[#2D2D2A] uppercase tracking-wider">Dynamic Skill Proposals</h3>
                <button
                  onClick={fetchProposals}
                  className="p-1.5 bg-[#FDFBF7] hover:bg-[#F4F1EA] rounded-lg border border-[#E6E2DE] text-[#2D2D2A] cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingProposals ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {proposals.length === 0 ? (
                  <div className="p-4 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl text-xs text-[#8A817C] text-center">
                    No open proposals. Engine continuously scans chat logs for missing capabilities.
                  </div>
                ) : (
                  proposals.map((prop, idx) => (
                    <div key={idx} className="p-4 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[#588157]">{prop.skill_name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E76F51]/15 text-[#E76F51]">
                          Confidence: {(prop.confidence_score * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-[#2D2D2A]">{prop.description}</p>
                      <div className="p-2 bg-white rounded-lg border border-[#E6E2DE] font-mono text-[11px] text-[#8A817C]">
                        Use case: {prop.use_case}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="col-span-12 lg:col-span-6 bg-white rounded-2xl border border-[#E6E2DE] shadow-xs p-5 flex flex-col overflow-hidden">
              <h3 className="text-xs font-bold text-[#2D2D2A] uppercase tracking-wider mb-3">Experience Mining Pipeline</h3>
              <div className="p-4 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl text-xs space-y-3">
                <p className="text-[#8A817C] leading-relaxed">
                  Memora parses user chat history and agent execution traces to identify recurring failure patterns or unhandled intents. Once identified, the engine drafts sandboxed tool modules automatically.
                </p>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 bg-white border border-[#E6E2DE] rounded-xl">
                    <span className="text-[10px] text-[#8A817C] block mb-1 font-mono">Traces Analyzed</span>
                    <span className="text-lg font-bold font-mono text-[#2D2D2A]">1,428</span>
                  </div>
                  <div className="p-3 bg-white border border-[#E6E2DE] rounded-xl">
                    <span className="text-[10px] text-[#8A817C] block mb-1 font-mono">Synthesized Tools</span>
                    <span className="text-lg font-bold font-mono text-[#588157]">14 Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
