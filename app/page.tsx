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
} from 'lucide-react';
import MemorySemanticGraph from '@/components/MemorySemanticGraph';
import SwarmKanban from '@/components/SwarmKanban';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  tool_used?: string | null;
  tool_result?: any | null;
  timestamp: string;
}

interface MemoryItem {
  id: string;
  text: string;
  metadata: {
    source?: string;
    category?: string;
    timestamp?: string;
    [key: string]: any;
  };
  distance?: number;
}

interface SkillProposal {
  skill_name: string;
  description: string;
  use_case: string;
  confidence_score: number;
  status: 'proposed' | 'integrated';
  example_queries: string[];
}

export default function MemoraDashboard() {
  const [activeTab, setActiveTab] = useState<'chat' | 'search' | 'add' | 'proposals' | 'learning' | 'swarm'>('chat');
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

  // Vector Test State
  const [testText, setTestText] = useState('agent memory vector test');
  const [testEmbedding, setTestEmbedding] = useState<string | null>(null);
  const [isGeneratingEmbed, setIsGeneratingEmbed] = useState(false);

  // Stats State
  const [memoryCount, setMemoryCount] = useState<number>(3);
  const [proposals, setProposals] = useState<SkillProposal[]>([]);
  const [isLoadingProposals, setIsLoadingProposals] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch initial stats and proposals
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Handlers
  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || chatInput;
    if (!textToSend.trim() || isChatLoading) return;

    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString(),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!customText) setChatInput('');
    setIsChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend, session_id: sessionId }),
      });

      const data = await res.json();
      if (res.ok) {
        const agentMsg: ChatMessage = {
          id: 'msg-' + (Date.now() + 1),
          role: 'agent',
          content: data.response || 'No response generated.',
          tool_used: data.tool_used,
          tool_result: data.tool_result,
          timestamp: new Date().toLocaleTimeString(),
        };
        setChatMessages((prev) => [...prev, agentMsg]);
        fetchStats();
      } else {
        throw new Error(data.error || 'Failed to get response');
      }
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: 'msg-' + (Date.now() + 1),
          role: 'agent',
          content: `Error: ${err.message}`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSearchMemory = async (queryText?: string) => {
    const q = queryText !== undefined ? queryText : searchQuery;
    if (!q.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(`/api/memory/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddMemory = async () => {
    if (!addText.trim()) {
      setAddStatus({ message: 'Memory text cannot be empty!', type: 'error' });
      return;
    }

    setAddStatus({ message: 'Saving to vector space...', type: 'loading' });
    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: addText.trim(),
          metadata: {
            source: addSource.trim() || 'UI_Entry',
            category: addCategory.trim() || 'General',
            session_id: sessionId,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setAddStatus({ message: `Successfully saved with ID: ${data.id}`, type: 'success' });
        const savedText = addText;
        setAddText('');
        fetchStats();
        setTimeout(() => {
          setActiveTab('search');
          setSearchQuery(savedText);
          handleSearchMemory(savedText);
          setAddStatus(null);
        }, 1200);
      } else {
        throw new Error(data.detail || 'Failed to save');
      }
    } catch (err: any) {
      setAddStatus({ message: `Error: ${err.message}`, type: 'error' });
    }
  };

  const handleTestEmbed = async () => {
    if (!testText.trim()) return;
    setIsGeneratingEmbed(true);
    try {
      const res = await fetch(`/api/test-embed?text=${encodeURIComponent(testText)}`);
      const data = await res.json();
      if (data.embedding) {
        setTestEmbedding(JSON.stringify(data.embedding.slice(0, 16)) + `... (${data.embedding.length} dims)`);
      } else {
        setTestEmbedding(JSON.stringify(data));
      }
    } catch (err: any) {
      setTestEmbedding(`Error: ${err.message}`);
    } finally {
      setIsGeneratingEmbed(false);
    }
  };

  const handleAutoIntegrate = async () => {
    try {
      const res = await fetch('/api/skills/auto-integrate', { method: 'POST' });
      if (res.ok) {
        fetchProposals();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleIntegrateProposal = async (name: string) => {
    try {
      const res = await fetch(`/api/skills/integrate/${name}`, { method: 'POST' });
      if (res.ok) {
        fetchProposals();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-screen w-screen bg-[#FDFBF7] text-[#3C3C3B] flex flex-col overflow-hidden font-sans">
      {/* Top Bar */}
      <header className="flex justify-between items-center px-6 py-3.5 border-b border-[#E6E2DE] bg-white shadow-xs shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#A3B18A] rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-xs">
            M
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-[#2D2D2A] flex items-center gap-2">
              <span>Memora</span>
              <span className="text-xs font-normal text-[#588157] px-2 py-0.5 bg-[#58815714] rounded-md border border-[#58815726]">
                Engine v2.0
              </span>
            </h1>
            <p className="text-[11px] text-[#8A817C] font-mono">Agent Memory & Skills Platform</p>
          </div>
        </div>

        <nav className="flex items-center gap-6 text-xs font-semibold uppercase tracking-wider text-[#8A817C]">
          <button
            onClick={() => setActiveTab('chat')}
            className={`pb-1 transition-all cursor-pointer ${
              activeTab === 'chat'
                ? 'text-[#588157] border-b-2 border-[#588157]'
                : 'hover:text-[#2D2D2A]'
            }`}
          >
            Chat Orchestrator
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`pb-1 transition-all cursor-pointer ${
              activeTab === 'search'
                ? 'text-[#588157] border-b-2 border-[#588157]'
                : 'hover:text-[#2D2D2A]'
            }`}
          >
            Memory Stream
          </button>
          <button
            onClick={() => setActiveTab('swarm')}
            className={`pb-1 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'swarm'
                ? 'text-[#588157] border-b-2 border-[#588157]'
                : 'hover:text-[#2D2D2A]'
            }`}
          >
            <span>Multi-Agent Swarm</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-[#D4A37322] text-[#D4A373]">
              Part 3
            </span>
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`pb-1 transition-all cursor-pointer ${
              activeTab === 'add'
                ? 'text-[#588157] border-b-2 border-[#588157]'
                : 'hover:text-[#2D2D2A]'
            }`}
          >
            Inject Memory
          </button>
          <button
            onClick={() => setActiveTab('proposals')}
            className={`pb-1 transition-all cursor-pointer ${
              activeTab === 'proposals'
                ? 'text-[#588157] border-b-2 border-[#588157]'
                : 'hover:text-[#2D2D2A]'
            }`}
          >
            Skill Generator
          </button>
        </nav>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-[#F8F5F2] border border-[#E6E2DE] rounded-lg text-xs font-mono">
            <span className="text-[#8A817C]">Session:</span>
            <select
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="bg-transparent font-semibold text-[#2D2D2A] focus:outline-hidden cursor-pointer"
            >
              <option value="default">default</option>
              <option value="test-cluster-sess">test-cluster-sess</option>
              <option value="test-orchestrator-sess">test-orchestrator-sess</option>
              <option value="research-session-1">research-session-1</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 grid grid-cols-12 gap-5 p-5 overflow-hidden">
        {/* Left Column: Core Architecture & Components */}
        <section className="col-span-3 flex flex-col gap-4 overflow-y-auto pr-1">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase font-bold tracking-widest text-[#8A817C]">Core Components</h2>
            <span className="w-2 h-2 rounded-full bg-[#588157] animate-pulse"></span>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="p-3 bg-white border border-[#E6E2DE] rounded-xl shadow-xs flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-[#588157] shrink-0"></div>
              <div className="min-w-0">
                <p className="text-xs font-mono font-medium text-[#2D2D2A] truncate">orchestrator.ts</p>
                <p className="text-[10px] text-[#8A817C]">Agent Loop & Tool Calling</p>
              </div>
            </div>

            <div className="p-3 bg-white border border-[#E6E2DE] rounded-xl shadow-xs flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-[#588157] shrink-0"></div>
              <div className="min-w-0">
                <p className="text-xs font-mono font-medium text-[#2D2D2A] truncate">swarm.ts</p>
                <p className="text-[10px] text-[#8A817C]">Hermes Swarm & 5 Workers</p>
              </div>
            </div>

            <div className="p-3 bg-white border border-[#E6E2DE] rounded-xl shadow-xs flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-[#588157] shrink-0"></div>
              <div className="min-w-0">
                <p className="text-xs font-mono font-medium text-[#2D2D2A] truncate">vector.ts</p>
                <p className="text-[10px] text-[#8A817C]">Vector Recall & Cosine Space</p>
              </div>
            </div>

            <div className="p-3 bg-white border border-[#E6E2DE] rounded-xl shadow-xs flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-[#588157] shrink-0"></div>
              <div className="min-w-0">
                <p className="text-xs font-mono font-medium text-[#2D2D2A] truncate">skills.ts</p>
                <p className="text-[10px] text-[#8A817C]">7 Registered Custom Skills</p>
              </div>
            </div>

            <div className="p-3 bg-white border border-[#E6E2DE] rounded-xl shadow-xs flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-[#D4A373] shrink-0"></div>
              <div className="min-w-0">
                <p className="text-xs font-mono font-medium text-[#2D2D2A] truncate">learning.ts</p>
                <p className="text-[10px] text-[#8A817C]">Experience Logger & Enhancer</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-[#58815712] rounded-2xl border border-[#58815726] flex flex-col gap-2">
            <h3 className="text-xs uppercase tracking-wider font-bold text-[#588157] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Engine Status
            </h3>
            <div className="text-xs text-[#588157] leading-relaxed font-mono text-[11px] space-y-1">
              <div className="flex justify-between">
                <span>Orchestrator:</span>
                <span className="font-bold">Active</span>
              </div>
              <div className="flex justify-between">
                <span>Skills Registered:</span>
                <span className="font-bold">7</span>
              </div>
              <div className="flex justify-between">
                <span>Memory Space:</span>
                <span className="font-bold">{memoryCount} records</span>
              </div>
              <div className="flex justify-between">
                <span>Learning Loop:</span>
                <span className="font-bold">Operational</span>
              </div>
            </div>
          </div>

          {/* Real-time Vector Test Widget */}
          <div className="p-4 bg-white rounded-2xl border border-[#E6E2DE] shadow-xs flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#588157]"></span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#8A817C]">
                  Vector Test
                </span>
              </div>
              <span className="text-[10px] text-[#588157] font-mono font-semibold">GET /test-embed</span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="Generate quick embedding"
                className="flex-1 px-2.5 py-1.5 bg-[#FDFBF7] border border-[#E6E2DE] rounded-lg text-xs font-mono focus:outline-hidden focus:ring-1 focus:ring-[#A3B18A]"
              />
              <button
                onClick={handleTestEmbed}
                disabled={isGeneratingEmbed}
                className="px-3 py-1.5 bg-[#3C3C3B] hover:bg-[#2D2D2A] text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer shrink-0"
              >
                {isGeneratingEmbed ? '...' : 'Embed'}
              </button>
            </div>
            {testEmbedding && (
              <div className="p-2.5 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl font-mono text-[10px] max-h-24 overflow-y-auto text-[#8A817C] break-all">
                {testEmbedding}
              </div>
            )}
          </div>
        </section>

        {/* Center Column: Active Console Pane */}
        <section
          className={`${
            activeTab === 'swarm' ? 'col-span-9' : 'col-span-6'
          } flex flex-col gap-4 h-full overflow-hidden transition-all duration-300`}
        >
          <div className="bg-white rounded-3xl border border-[#E6E2DE] shadow-xs p-5 flex flex-col overflow-hidden flex-1">
            {/* Header with Navigation Pills */}
            <div className="flex border-b border-[#E6E2DE] pb-3.5 justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-[#2D2D2A]">Memory Insight Console</h2>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'chat'
                      ? 'bg-[#588157] text-white shadow-xs'
                      : 'text-[#8A817C] bg-[#FDFBF7] border border-[#E6E2DE] hover:bg-white'
                  }`}
                >
                  Chat Agent
                </button>
                <button
                  onClick={() => setActiveTab('search')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'search'
                      ? 'bg-[#588157] text-white shadow-xs'
                      : 'text-[#8A817C] bg-[#FDFBF7] border border-[#E6E2DE] hover:bg-white'
                  }`}
                >
                  <Network className="w-3.5 h-3.5" />
                  <span>Memory Stream</span>
                </button>
                <button
                  onClick={() => setActiveTab('swarm')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'swarm'
                      ? 'bg-[#588157] text-white shadow-xs'
                      : 'text-[#8A817C] bg-[#FDFBF7] border border-[#E6E2DE] hover:bg-white'
                  }`}
                >
                  <Kanban className="w-3.5 h-3.5" />
                  <span>Multi-Agent Swarm</span>
                </button>
                <button
                  onClick={() => setActiveTab('add')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'add'
                      ? 'bg-[#588157] text-white shadow-xs'
                      : 'text-[#8A817C] bg-[#FDFBF7] border border-[#E6E2DE] hover:bg-white'
                  }`}
                >
                  Inject Memory
                </button>
                <button
                  onClick={() => setActiveTab('proposals')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'proposals'
                      ? 'bg-[#588157] text-white shadow-xs'
                      : 'text-[#8A817C] bg-[#FDFBF7] border border-[#E6E2DE] hover:bg-white'
                  }`}
                >
                  Proposals
                </button>
              </div>
            </div>

            {/* TAB CONTENT: CHAT */}
            {activeTab === 'chat' && (
              <div className="flex-1 flex flex-col overflow-hidden pt-4">
                {/* Suggestions bar */}
                <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 shrink-0 text-[11px] text-[#8A817C]">
                  <span className="self-center font-medium shrink-0">Try:</span>
                  <button
                    onClick={() => handleSendMessage('Calculate sqrt(144) * 5 + 10')}
                    className="px-2.5 py-1 bg-[#FDFBF7] hover:bg-[#F0EDE8] border border-[#E6E2DE] rounded-lg shrink-0 cursor-pointer text-[#2D2D2A]"
                  >
                    sqrt(144) * 5 + 10
                  </button>
                  <button
                    onClick={() => handleSendMessage('Convert 50 celsius to fahrenheit')}
                    className="px-2.5 py-1 bg-[#FDFBF7] hover:bg-[#F0EDE8] border border-[#E6E2DE] rounded-lg shrink-0 cursor-pointer text-[#2D2D2A]"
                  >
                    Convert 50 C to F
                  </button>
                  <button
                    onClick={() => handleSendMessage('What is my preferred morning beverage?')}
                    className="px-2.5 py-1 bg-[#FDFBF7] hover:bg-[#F0EDE8] border border-[#E6E2DE] rounded-lg shrink-0 cursor-pointer text-[#2D2D2A]"
                  >
                    Morning beverage?
                  </button>
                  <button
                    onClick={() => handleSendMessage('Format to slug: Autonomous Agent Memory')}
                    className="px-2.5 py-1 bg-[#FDFBF7] hover:bg-[#F0EDE8] border border-[#E6E2DE] rounded-lg shrink-0 cursor-pointer text-[#2D2D2A]"
                  >
                    Slug format
                  </button>
                </div>

                {/* Messages scroll area */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`p-3.5 rounded-2xl text-xs max-w-md shadow-xs leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-[#588157] text-white rounded-tr-xs'
                            : 'bg-[#F8F5F2] text-[#2D2D2A] border border-[#E6E2DE] rounded-tl-xs'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>

                        {msg.tool_used && (
                          <div className="mt-2 pt-2 border-t border-[#E6E2DE]/50 flex flex-wrap items-center gap-1.5 text-[10px] text-[#588157]">
                            <Zap className="w-3 h-3" />
                            <span className="font-bold uppercase tracking-wider">Skill Used:</span>
                            <span className="font-mono bg-white/70 px-1.5 py-0.5 rounded border border-[#E6E2DE]">
                              {msg.tool_used}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] text-[#8A817C] mt-1 px-1" suppressHydrationWarning>{msg.timestamp}</span>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex items-start">
                      <div className="p-3 bg-[#F8F5F2] text-[#8A817C] text-xs rounded-2xl border border-[#E6E2DE] flex items-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#588157]" />
                        <span>Memora reasoning & executing skills...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Chat Input */}
                <div className="flex gap-2 pt-3 shrink-0">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendMessage();
                    }}
                    placeholder="Ask Memora (e.g. Convert 75 kg to lbs, or What is my tea preference?)"
                    className="flex-1 px-4 py-2.5 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl text-xs focus:outline-hidden focus:ring-1 focus:ring-[#A3B18A]"
                  />
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={isChatLoading || !chatInput.trim()}
                    className="px-5 py-2.5 bg-[#588157] hover:bg-[#466845] disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT: MEMORY STREAM (D3 SEMANTIC GRAPH) */}
            {activeTab === 'search' && (
              <div id="memory-stream-panel" className="flex-1 flex flex-col overflow-hidden -mx-5 -mb-5 mt-3 border-t border-[#E6E2DE]">
                <MemorySemanticGraph
                  onQueryInChat={(text) => {
                    setActiveTab('chat');
                    setChatInput(`Analyze this context: "${text}"`);
                  }}
                  onNavigateToInject={() => setActiveTab('add')}
                  highlightQuery={searchQuery}
                />
              </div>
            )}

            {/* TAB CONTENT: MULTI-AGENT SWARM (HERMES KANBAN) */}
            {activeTab === 'swarm' && (
              <div id="multi-agent-swarm-panel" className="flex-1 flex flex-col overflow-hidden -mx-5 -mb-5 mt-3 border-t border-[#E6E2DE]">
                <SwarmKanban
                  sessionId={sessionId}
                  onSendToChat={(text) => {
                    setActiveTab('chat');
                    setChatInput(text);
                  }}
                  onInjectMemory={(text) => {
                    setActiveTab('add');
                    setAddText(text);
                  }}
                />
              </div>
            )}

            {/* TAB CONTENT: INJECT MEMORY */}
            {activeTab === 'add' && (
              <div className="flex-1 flex flex-col overflow-y-auto pt-4 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs uppercase font-bold tracking-widest text-[#8A817C]">
                    Memory Content
                  </label>
                  <textarea
                    rows={3}
                    value={addText}
                    onChange={(e) => setAddText(e.target.value)}
                    placeholder="Enter statement, context, or preference (e.g., User is highly interested in Rust programming and prefers dark-mode themes)."
                    className="w-full px-4 py-3 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl text-xs focus:outline-hidden focus:ring-1 focus:ring-[#A3B18A]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs uppercase font-bold tracking-widest text-[#8A817C] mb-1">
                      Source Tag
                    </label>
                    <input
                      type="text"
                      value={addSource}
                      onChange={(e) => setAddSource(e.target.value)}
                      placeholder="e.g. User_Input"
                      className="w-full px-3 py-2 bg-[#FDFBF7] border border-[#E6E2DE] rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase font-bold tracking-widest text-[#8A817C] mb-1">
                      Category Tag
                    </label>
                    <input
                      type="text"
                      value={addCategory}
                      onChange={(e) => setAddCategory(e.target.value)}
                      placeholder="e.g. Preference"
                      className="w-full px-3 py-2 bg-[#FDFBF7] border border-[#E6E2DE] rounded-lg text-xs"
                    />
                  </div>
                </div>

                <button
                  onClick={handleAddMemory}
                  className="w-full py-3 bg-[#588157] hover:bg-[#466845] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                >
                  <Database className="w-4 h-4" />
                  <span>Commit to Vector Store</span>
                </button>

                {addStatus && (
                  <div
                    className={`p-3.5 rounded-xl text-xs text-center font-semibold ${
                      addStatus.type === 'success'
                        ? 'bg-green-100 text-green-800'
                        : addStatus.type === 'error'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-[#F8F5F2] text-[#8A817C]'
                    }`}
                  >
                    {addStatus.message}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: PROPOSALS */}
            {activeTab === 'proposals' && (
              <div className="flex-1 flex flex-col overflow-hidden pt-4 space-y-4">
                <div className="flex justify-between items-center shrink-0">
                  <div>
                    <h3 className="text-xs uppercase font-bold tracking-widest text-[#8A817C]">
                      Auto-Discovered Skill Proposals
                    </h3>
                    <p className="text-[11px] text-[#8A817C]">
                      Generated automatically from repeated user experience patterns.
                    </p>
                  </div>
                  <button
                    onClick={handleAutoIntegrate}
                    className="px-3.5 py-1.5 bg-[#588157] hover:bg-[#466845] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Auto-Integrate All (Score &ge; 0.8)</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {isLoadingProposals ? (
                    <div className="text-center py-8 text-xs text-[#8A817C]">Loading proposals...</div>
                  ) : (
                    proposals.map((prop) => (
                      <div
                        key={prop.skill_name}
                        className="p-4 bg-[#FDFBF7] border border-[#E6E2DE] rounded-2xl shadow-2xs space-y-2"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[#2D2D2A]">
                              {prop.skill_name}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${
                                prop.status === 'integrated'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {prop.status}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-[#588157] font-semibold">
                            Confidence: {Math.round(prop.confidence_score * 100)}%
                          </span>
                        </div>
                        <p className="text-xs text-[#8A817C]">{prop.description}</p>
                        <div className="text-[11px] text-[#2D2D2A]">
                          <span className="font-semibold text-[#8A817C]">Use Case:</span> {prop.use_case}
                        </div>
                        {prop.status !== 'integrated' && (
                          <button
                            onClick={() => handleIntegrateProposal(prop.skill_name)}
                            className="mt-2 px-3 py-1 bg-[#2D2D2A] hover:bg-black text-white text-[11px] font-semibold rounded-lg cursor-pointer"
                          >
                            Integrate Skill
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Database Stats & Skill Registry */}
        <section
          className={`${
            activeTab === 'swarm' ? 'hidden' : 'col-span-3'
          } flex flex-col gap-4 overflow-y-auto`}
        >
          {/* Stats Box */}
          <div className="bg-[#D4A37314] p-5 rounded-3xl border border-[#D4A37333] shadow-xs">
            <h3 className="text-xs uppercase font-bold tracking-widest text-[#D4A373] mb-3">
              Memory Store Stats
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-3xl font-serif font-bold text-[#3C3C3B]">{memoryCount}</p>
                <p className="text-[10px] text-[#8A817C] uppercase tracking-wider font-bold mt-0.5">
                  Active Embeddings
                </p>
              </div>
              <div className="h-px bg-[#D4A37333]"></div>
              <div>
                <p className="text-sm font-mono font-bold text-[#3C3C3B]">memora_collection</p>
                <p className="text-[10px] text-[#8A817C] uppercase tracking-wider font-bold mt-0.5">
                  Collection Instance
                </p>
              </div>
            </div>
          </div>

          {/* Skill Registry List */}
          <div className="flex-1 bg-white rounded-3xl border border-[#E6E2DE] p-5 shadow-xs flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs uppercase font-bold tracking-widest text-[#8A817C]">Skill Registry</h3>
              <span className="text-[10px] text-[#588157] font-mono font-semibold">7 active</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              <div
                onClick={() => {
                  setActiveTab('chat');
                  setChatInput('Calculate 45 * 12 + 150');
                }}
                className="p-2.5 bg-[#FDFBF7] hover:bg-[#F0EDE8] rounded-xl border border-[#E6E2DE] flex items-center justify-between cursor-pointer transition-colors"
              >
                <div>
                  <span className="font-mono font-bold text-[#2D2D2A]">calculator</span>
                  <p className="text-[10px] text-[#8A817C]">Math & arithmetic evaluation</p>
                </div>
                <span className="w-2 h-2 rounded-full bg-[#588157]"></span>
              </div>

              <div
                onClick={() => {
                  setActiveTab('chat');
                  setChatInput('Convert 100 celsius to fahrenheit');
                }}
                className="p-2.5 bg-[#FDFBF7] hover:bg-[#F0EDE8] rounded-xl border border-[#E6E2DE] flex items-center justify-between cursor-pointer transition-colors"
              >
                <div>
                  <span className="font-mono font-bold text-[#2D2D2A]">unit_converter</span>
                  <p className="text-[10px] text-[#8A817C]">Metric & imperial conversion</p>
                </div>
                <span className="w-2 h-2 rounded-full bg-[#588157]"></span>
              </div>

              <div
                onClick={() => {
                  setActiveTab('chat');
                  setChatInput('Format to slug: Autonomous Agent Memory Systems');
                }}
                className="p-2.5 bg-[#FDFBF7] hover:bg-[#F0EDE8] rounded-xl border border-[#E6E2DE] flex items-center justify-between cursor-pointer transition-colors"
              >
                <div>
                  <span className="font-mono font-bold text-[#2D2D2A]">text_formatter</span>
                  <p className="text-[10px] text-[#8A817C]">Case and slug transformations</p>
                </div>
                <span className="w-2 h-2 rounded-full bg-[#588157]"></span>
              </div>

              <div
                onClick={() => {
                  setActiveTab('chat');
                  setChatInput('Can you parse and validate this json string: {"name": "Memora", "active": true}');
                }}
                className="p-2.5 bg-[#FDFBF7] hover:bg-[#F0EDE8] rounded-xl border border-[#E6E2DE] flex items-center justify-between cursor-pointer transition-colors"
              >
                <div>
                  <span className="font-mono font-bold text-[#2D2D2A]">json_parser</span>
                  <p className="text-[10px] text-[#8A817C]">Validates & formats JSON data</p>
                </div>
                <span className="w-2 h-2 rounded-full bg-[#588157]"></span>
              </div>

              <div
                onClick={() => {
                  setActiveTab('chat');
                  setChatInput('What is the current time?');
                }}
                className="p-2.5 bg-[#FDFBF7] hover:bg-[#F0EDE8] rounded-xl border border-[#E6E2DE] flex items-center justify-between cursor-pointer transition-colors"
              >
                <div>
                  <span className="font-mono font-bold text-[#2D2D2A]">time</span>
                  <p className="text-[10px] text-[#8A817C]">Returns current date & time</p>
                </div>
                <span className="w-2 h-2 rounded-full bg-[#588157]"></span>
              </div>

              <div
                onClick={() => {
                  setActiveTab('chat');
                  setChatInput('Search for vector databases');
                }}
                className="p-2.5 bg-[#FDFBF7] hover:bg-[#F0EDE8] rounded-xl border border-[#E6E2DE] flex items-center justify-between cursor-pointer transition-colors"
              >
                <div>
                  <span className="font-mono font-bold text-[#2D2D2A]">web_search</span>
                  <p className="text-[10px] text-[#8A817C]">Search via DuckDuckGo</p>
                </div>
                <span className="w-2 h-2 rounded-full bg-[#588157]"></span>
              </div>

              <div
                onClick={() => {
                  setActiveTab('chat');
                  setChatInput('Remember: User is building autonomous intelligence agents with memory');
                }}
                className="p-2.5 bg-[#FDFBF7] hover:bg-[#F0EDE8] rounded-xl border border-[#E6E2DE] flex items-center justify-between cursor-pointer transition-colors"
              >
                <div>
                  <span className="font-mono font-bold text-[#2D2D2A]">save_note</span>
                  <p className="text-[10px] text-[#8A817C]">Commit memory note</p>
                </div>
                <span className="w-2 h-2 rounded-full bg-[#588157]"></span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="h-9 bg-[#3C3C3B] text-[#FDFBF7] flex items-center justify-between px-6 text-[10px] uppercase tracking-wider shrink-0">
        <div>Memora Foundation Stack &bull; Agent Intelligence Layer</div>
        <div className="flex gap-4 text-[#A3B18A]">
          <span>Next.js Node 22 Runtime</span>
          <span>Port 3000 (0.0.0.0)</span>
          <span>Status: 200 OK</span>
        </div>
      </footer>
    </div>
  );
}
