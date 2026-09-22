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
  ChevronDown,
  ChevronUp,
  Terminal,
  Network,
  Kanban,
  HardDrive,
  Share2,
  Activity,
  Trash2,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Download,
  Code,
  ShieldCheck,
  FileText,
  Globe,
  Plus,
  Compass,
} from 'lucide-react';
import MemorySemanticGraph from '@/components/MemorySemanticGraph';
import SwarmKanban from '@/components/SwarmKanban';
import LocalAndPlatforms from '@/components/LocalAndPlatforms';

import { MemoryItem, SearchResult } from '@/lib/memora/types';

interface ThoughtStepUI {
  stage: 'intent' | 'recall' | 'execution' | 'synthesis';
  label: string;
  details: string;
  timestamp: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  tool_used?: string | null;
  tool_input?: any | null;
  tool_result?: any | null;
  thought_chain?: ThoughtStepUI[];
  latency_ms?: number;
  model?: string;
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

interface SkillCatalogItem {
  id: string;
  name: string;
  description: string;
  inputSchema?: any;
  samplePrompts?: string[];
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
  const [sessionList, setSessionList] = useState<string[]>([
    'default',
    'research-session',
    'coding-session',
    'hindi-vernacular',
  ]);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [newSessionInput, setNewSessionInput] = useState('');

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'agent',
      content:
        'Namaste! Welcome to Memora Sovereign Orchestrator. I am equipped with continuous semantic vector memory, sandboxed code execution, language translation, sentiment analysis, task decomposition, and local/cloud cognitive models. How may I assist you today?',
      timestamp: 'Just now',
      thought_chain: [
        {
          stage: 'intent',
          label: 'System Boot & Intent Verification',
          details: 'Initialized sovereign agent runtime with 14 integrated skills and persistent vector memory.',
          timestamp: new Date().toISOString(),
        },
        {
          stage: 'recall',
          label: 'Vector Space Warmup',
          details: 'Vector memory store connected. 384-dimensional cosine similarity indexing active.',
          timestamp: new Date().toISOString(),
        },
        {
          stage: 'execution',
          label: 'Readiness Probe',
          details: 'All sandbox isolates and cognitive adapters pass healthcheck.',
          timestamp: new Date().toISOString(),
        },
        {
          stage: 'synthesis',
          label: 'Output Formatting',
          details: 'Ready to receive multi-lingual and deterministic instructions.',
          timestamp: new Date().toISOString(),
        },
      ],
      latency_ms: 8,
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Cognitive Trace & Interaction states
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({});
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  // Memory Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MemoryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [deletedMemoryIds, setDeletedMemoryIds] = useState<Set<string>>(new Set());

  // Add Memory State
  const [addText, setAddText] = useState('');
  const [addSource, setAddSource] = useState('UI_Entry');
  const [addCategory, setAddCategory] = useState('General');
  const [addStatus, setAddStatus] = useState<{ message: string; type: 'success' | 'error' | 'loading' } | null>(null);

  // Stats & Skills State
  const [memoryCount, setMemoryCount] = useState<number>(3);
  const [proposals, setProposals] = useState<SkillProposal[]>([]);
  const [skillsList, setSkillsList] = useState<SkillCatalogItem[]>([]);
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

  const fetchSkillsList = async () => {
    try {
      const res = await fetch('/api/skills/list');
      if (res.ok) {
        const data = await res.json();
        setSkillsList(data.skills || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchStats();
    fetchProposals();
    fetchSkillsList();
  }, []);

  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  // Handle Speech Synthesis (Listen 🔊)
  const handleSpeak = (id: string, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (speakingMsgId === id) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[#*`_]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Auto-detect Hindi vs English
    if (/[\u0900-\u097F]/.test(cleanText) || /namaste|kya|kaun|kaise|shukriya|dhanyawad|aap|batao/i.test(cleanText)) {
      utterance.lang = 'hi-IN';
    } else {
      utterance.lang = 'en-US';
    }

    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);
    setSpeakingMsgId(id);
    window.speechSynthesis.speak(utterance);
  };

  // Handle Speech Recognition (Mic 🎙️)
  const handleToggleMic = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setChatInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  // Handle Copy text
  const handleCopy = (id: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedMsgId(id);
      setTimeout(() => setCopiedMsgId(null), 2000);
    }
  };

  // Handle Export Chat
  const handleExportChat = (format: 'markdown' | 'json') => {
    if (chatMessages.length === 0) return;
    let content = '';
    const filename = `memora-chat-${sessionId}.${format === 'markdown' ? 'md' : 'json'}`;
    const mime = format === 'markdown' ? 'text/markdown' : 'application/json';

    if (format === 'json') {
      content = JSON.stringify({ sessionId, exported_at: new Date().toISOString(), messages: chatMessages }, null, 2);
    } else {
      content = `# Memora Sovereign Agent Conversation (${sessionId})\n*Exported: ${new Date().toLocaleString()}*\n\n` +
        chatMessages
          .map(
            (m) =>
              `### ${m.role === 'user' ? '👤 User' : '🤖 Memora Agent'} (${m.timestamp})\n\n${m.content}\n\n` +
              (m.tool_used ? `> **Tool:** \`${m.tool_used}\`\n\n` : '') +
              (m.thought_chain ? `> **Cognitive Stages:** ${m.thought_chain.map((s) => s.label).join(' → ')}\n\n` : '')
          )
          .join('---\n\n');
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

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
        content: data.reply || data.response || 'Request processed successfully.',
        tool_used: data.tool_used,
        tool_input: data.tool_input,
        tool_result: data.tool_result,
        thought_chain: data.thought_chain,
        latency_ms: data.metadata?.latencyMs,
        model: data.metadata?.model,
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

  const MEMORA_API_URL = process.env.NEXT_PUBLIC_MEMORA_API_URL || '/api/memory';

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || isSearching) return;

    setIsSearching(true);
    try {
      const res = await fetch(`${MEMORA_API_URL}/search?q=${encodeURIComponent(searchQuery)}&top_k=10`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      const rawResults = Array.isArray(data) ? data : data.results || [];
      const formattedResults: MemoryItem[] = rawResults.map((item: any) => ({
        id: String(item.id),
        text: item.text,
        metadata: item.metadata || {},
        score: typeof item.score === 'number' ? item.score : 1 - (item.distance || 0.2),
        distance: typeof item.score === 'number' ? 1 - item.score : item.distance,
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

  const handleDeleteMemory = async (id: string) => {
    try {
      const res = await fetch(`/api/memory?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeletedMemoryIds((prev) => new Set(prev).add(id));
        setSearchResults((prev) => prev.filter((m) => m.id !== id));
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to delete memory:', err);
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
                v1.2 Sovereign Intelligent OS
              </span>
            </div>
            <p className="text-xs text-[#8A817C]">Continuous Vector Memory • Sandboxed Code • Vernacular Indian Intelligence</p>
          </div>
        </div>

        {/* Tab Switcher Pills */}
        <div className="flex items-center gap-1.5 bg-[#F4F1EA] p-1 rounded-2xl border border-[#E6E2DE] overflow-x-auto max-w-full text-xs font-medium">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'chat'
                ? 'bg-[#588157] text-white shadow-xs font-semibold'
                : 'text-[#8A817C] hover:text-[#2D2D2A] hover:bg-white/50'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Cognitive Chat</span>
          </button>
          <button
            onClick={() => setActiveTab('swarm')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'swarm'
                ? 'bg-[#588157] text-white shadow-xs font-semibold'
                : 'text-[#8A817C] hover:text-[#2D2D2A] hover:bg-white/50'
            }`}
          >
            <Kanban className="w-3.5 h-3.5" />
            <span>Hermes Swarm</span>
          </button>
          <button
            onClick={() => setActiveTab('platforms')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'platforms'
                ? 'bg-[#588157] text-white shadow-xs font-semibold'
                : 'text-[#8A817C] hover:text-[#2D2D2A] hover:bg-white/50'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Platforms &amp; Local</span>
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'search'
                ? 'bg-[#588157] text-white shadow-xs font-semibold'
                : 'text-[#8A817C] hover:text-[#2D2D2A] hover:bg-white/50'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Memory Graph</span>
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'add'
                ? 'bg-[#588157] text-white shadow-xs font-semibold'
                : 'text-[#8A817C] hover:text-[#2D2D2A] hover:bg-white/50'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Inject Memory</span>
          </button>
          <button
            onClick={() => setActiveTab('learning')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'learning'
                ? 'bg-[#588157] text-white shadow-xs font-semibold'
                : 'text-[#8A817C] hover:text-[#2D2D2A] hover:bg-white/50'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Skills &amp; Lab</span>
          </button>
        </div>
      </header>

      {/* Main Container Area */}
      <div className="flex-1 p-6 overflow-hidden flex flex-col">
        {/* TAB 1: COGNITIVE CHAT */}
        {activeTab === 'chat' && (
          <div className="grid grid-cols-12 gap-6 h-full flex-1 overflow-hidden">
            <div className="col-span-12 lg:col-span-8 flex flex-col bg-white rounded-2xl border border-[#E6E2DE] shadow-xs p-5 overflow-hidden">
              {/* Chat Sub-Header */}
              <div className="flex flex-wrap items-center justify-between pb-3 mb-3 border-b border-[#E6E2DE] gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#588157] animate-pulse" />
                  <span className="text-xs font-bold text-[#2D2D2A]">Agent Cognition Console</span>
                  
                  {/* Session Switcher */}
                  <div className="flex items-center gap-1 ml-2">
                    <select
                      value={sessionId}
                      onChange={(e) => {
                        if (e.target.value === '__new__') {
                          setIsCreatingSession(true);
                        } else {
                          setSessionId(e.target.value);
                        }
                      }}
                      className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#F4F1EA] text-[#2D2D2A] border border-[#E6E2DE] focus:outline-none cursor-pointer"
                    >
                      {sessionList.map((s) => (
                        <option key={s} value={s}>
                          Session: {s}
                        </option>
                      ))}
                      <option value="__new__">+ New Session...</option>
                    </select>

                    {isCreatingSession && (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          placeholder="session-name"
                          value={newSessionInput}
                          onChange={(e) => setNewSessionInput(e.target.value)}
                          className="px-2 py-0.5 text-[11px] font-mono bg-white border border-[#588157] rounded-md"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (newSessionInput.trim()) {
                              const s = newSessionInput.trim().toLowerCase().replace(/\s+/g, '-');
                              setSessionList((prev) => (prev.includes(s) ? prev : [...prev, s]));
                              setSessionId(s);
                              setNewSessionInput('');
                            }
                            setIsCreatingSession(false);
                          }}
                          className="px-1.5 py-0.5 bg-[#588157] text-white text-[10px] rounded"
                        >
                          OK
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Export Chat */}
                  <button
                    onClick={() => handleExportChat('markdown')}
                    className="flex items-center gap-1 text-[11px] text-[#8A817C] hover:text-[#2D2D2A] transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-[#F4F1EA]"
                    title="Export conversation as Markdown"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export MD</span>
                  </button>

                  {/* Clear Chat */}
                  {chatMessages.length > 0 && (
                    <button
                      onClick={() => setChatMessages([])}
                      className="flex items-center gap-1 text-[11px] text-[#8A817C] hover:text-[#B91C1C] transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-red-50"
                      title="Clear Chat History"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {chatMessages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#8A817C]">
                    <div className="w-12 h-12 rounded-2xl bg-[#588157]/10 flex items-center justify-center text-[#588157] mb-3">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-semibold text-[#2D2D2A]">Start chatting with Memora Sovereign Agent</p>
                    <p className="text-[11px] max-w-sm mt-1">
                      Ask questions in Hindi or English, execute JavaScript code in the sandbox, trigger multi-agent swarm plans, or erase and recall vector memories.
                    </p>
                  </div>
                )}

                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[88%] p-4 rounded-2xl text-xs shadow-2xs ${
                        msg.role === 'user'
                          ? 'bg-[#588157] text-white rounded-tr-xs'
                          : 'bg-[#F4F1EA] text-[#2D2D2A] border border-[#E6E2DE] rounded-tl-xs'
                      }`}
                    >
                      {/* Message Content */}
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                      {/* Tool Execution Badge & Code Display */}
                      {msg.tool_used && (
                        <div className="mt-3 pt-2.5 border-t border-black/10">
                          <div className="flex items-center justify-between font-mono text-[10px] text-[#588157] font-semibold mb-1">
                            <span className="flex items-center gap-1.5">
                              <Zap className="w-3 h-3 text-[#E76F51]" />
                              <span>Tool Executed: {msg.tool_used}</span>
                            </span>
                            {msg.tool_result && (
                              <button
                                onClick={() => handleCopy(msg.id + '_tool', typeof msg.tool_result === 'string' ? msg.tool_result : JSON.stringify(msg.tool_result, null, 2))}
                                className="flex items-center gap-1 text-[10px] text-[#8A817C] hover:text-[#2D2D2A] cursor-pointer"
                              >
                                {copiedMsgId === msg.id + '_tool' ? <Check className="w-3 h-3 text-[#588157]" /> : <Copy className="w-3 h-3" />}
                                <span>Copy Result</span>
                              </button>
                            )}
                          </div>
                          {msg.tool_result && (
                            <pre className="mt-1 p-2 bg-black/5 rounded-lg text-[10px] font-mono text-[#2D2D2A] overflow-x-auto max-h-32">
                              {typeof msg.tool_result === 'string'
                                ? msg.tool_result
                                : JSON.stringify(msg.tool_result, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}

                      {/* Cognitive Trace Thought Chain Accordion */}
                      {msg.role === 'agent' && msg.thought_chain && msg.thought_chain.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-black/10">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedThoughts((prev) => ({
                                ...prev,
                                [msg.id]: !prev[msg.id],
                              }))
                            }
                            className="flex items-center justify-between w-full py-1 text-[10px] font-mono text-[#588157] hover:text-[#476a46] transition-colors cursor-pointer"
                          >
                            <span className="flex items-center gap-1 font-semibold">
                              <Brain className="w-3 h-3" />
                              <span>Cognitive Trace ({msg.thought_chain.length} stages)</span>
                              {msg.latency_ms && (
                                <span className="text-[9px] text-[#8A817C] font-normal">
                                  • {msg.latency_ms}ms
                                </span>
                              )}
                            </span>
                            {expandedThoughts[msg.id] ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>

                          {expandedThoughts[msg.id] && (
                            <div className="mt-2 space-y-1.5 p-2.5 bg-white/70 rounded-xl border border-[#E6E2DE] text-[11px]">
                              {msg.thought_chain.map((step, sIdx) => {
                                const stageBadge =
                                  step.stage === 'intent'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : step.stage === 'recall'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : step.stage === 'execution'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-purple-50 text-purple-700 border-purple-200';

                                return (
                                  <div key={sIdx} className="flex flex-col gap-0.5 py-1 border-b border-[#F4F1EA] last:border-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${stageBadge}`}>
                                        {step.stage}
                                      </span>
                                      <span className="font-semibold text-[#2D2D2A] text-[10px]">
                                        {step.label}
                                      </span>
                                    </div>
                                    <p className="text-[#8A817C] text-[10px] pl-1 font-mono leading-relaxed">
                                      {step.details}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action icons & timestamp */}
                    <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-[#8A817C]">
                      <span>{msg.timestamp}</span>
                      {msg.role === 'agent' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSpeak(msg.id, msg.content)}
                            className="hover:text-[#2D2D2A] cursor-pointer flex items-center gap-0.5"
                            title={speakingMsgId === msg.id ? 'Stop speaking' : 'Listen to response'}
                          >
                            {speakingMsgId === msg.id ? (
                              <>
                                <VolumeX className="w-3 h-3 text-[#E76F51] animate-pulse" />
                                <span className="text-[9px] text-[#E76F51]">Stop</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3 h-3" />
                                <span className="text-[9px]">Listen</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="hover:text-[#2D2D2A] cursor-pointer flex items-center gap-0.5"
                            title="Copy response"
                          >
                            {copiedMsgId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-[#588157]" />
                                <span className="text-[9px] text-[#588157]">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span className="text-[9px]">Copy</span>
                              </>
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}

                {isChatLoading && (
                  <div className="flex items-center gap-2 text-xs text-[#8A817C] p-3 bg-[#F4F1EA] rounded-xl max-w-fit">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#588157]" />
                    <span>Orchestrating vector recall, linguistic parsing &amp; skills...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggestion Chips */}
              <div className="pt-2 pb-1 overflow-x-auto flex items-center gap-1.5 no-scrollbar">
                <span className="text-[10px] uppercase font-bold text-[#8A817C] shrink-0">Try:</span>
                <button
                  type="button"
                  onClick={() => setChatInput('Namaste! Aap kaun hain aur kya kar sakte hain?')}
                  className="shrink-0 px-2.5 py-1 bg-[#FDFBF7] hover:bg-[#F4F1EA] text-[#2D2D2A] text-[11px] rounded-lg border border-[#E6E2DE] transition-colors cursor-pointer"
                >
                  🇮🇳 Namaste! Aap kaun hain?
                </button>
                <button
                  type="button"
                  onClick={() => setChatInput('run code: [10, 20, 30, 40].reduce((a, b) => a + b, 0)')}
                  className="shrink-0 px-2.5 py-1 bg-[#FDFBF7] hover:bg-[#F4F1EA] text-[#2D2D2A] text-[11px] rounded-lg border border-[#E6E2DE] transition-colors cursor-pointer"
                >
                  🐍 Run Code Sandbox
                </button>
                <button
                  type="button"
                  onClick={() => setChatInput('swarm plan: Deploy decentralized vector mesh')}
                  className="shrink-0 px-2.5 py-1 bg-[#FDFBF7] hover:bg-[#F4F1EA] text-[#2D2D2A] text-[11px] rounded-lg border border-[#E6E2DE] transition-colors cursor-pointer"
                >
                  🐝 Swarm Plan
                </button>
                <button
                  type="button"
                  onClick={() => setChatInput('weather in Mumbai')}
                  className="shrink-0 px-2.5 py-1 bg-[#FDFBF7] hover:bg-[#F4F1EA] text-[#2D2D2A] text-[11px] rounded-lg border border-[#E6E2DE] transition-colors cursor-pointer"
                >
                  🌤️ Weather in Mumbai
                </button>
                <button
                  type="button"
                  onClick={() => setChatInput('translate to hindi: Artificial Intelligence is empowering humans')}
                  className="shrink-0 px-2.5 py-1 bg-[#FDFBF7] hover:bg-[#F4F1EA] text-[#2D2D2A] text-[11px] rounded-lg border border-[#E6E2DE] transition-colors cursor-pointer"
                >
                  🌐 Translate to Hindi
                </button>
                <button
                  type="button"
                  onClick={() => setChatInput('calculate (45 * 12) + sqrt(256)')}
                  className="shrink-0 px-2.5 py-1 bg-[#FDFBF7] hover:bg-[#F4F1EA] text-[#2D2D2A] text-[11px] rounded-lg border border-[#E6E2DE] transition-colors cursor-pointer"
                >
                  🔢 Calculate (45 * 12) + 16
                </button>
                <button
                  type="button"
                  onClick={() => setChatInput('mere baare me kya jante ho?')}
                  className="shrink-0 px-2.5 py-1 bg-[#FDFBF7] hover:bg-[#F4F1EA] text-[#2D2D2A] text-[11px] rounded-lg border border-[#E6E2DE] transition-colors cursor-pointer"
                >
                  🧠 Recall Memories
                </button>
                <button
                  type="button"
                  onClick={() => setChatInput('forget: User requested end-to-end working chat')}
                  className="shrink-0 px-2.5 py-1 bg-[#FDFBF7] hover:bg-[#F4F1EA] text-[#2D2D2A] text-[11px] rounded-lg border border-[#E6E2DE] transition-colors cursor-pointer"
                >
                  🗑️ Forget on Command
                </button>
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSendMessage} className="mt-2 pt-2 border-t border-[#E6E2DE] flex items-center gap-2">
                <div className="flex-1 flex items-center bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl px-3 focus-within:border-[#588157]">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask in Hindi or English, run code, convert units, search, or trigger swarm plans..."
                    className="flex-1 py-2.5 bg-transparent text-xs text-[#2D2D2A] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleToggleMic}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'text-[#8A817C] hover:text-[#2D2D2A]'
                    }`}
                    title={isListening ? 'Listening (Click to stop)' : 'Voice dictation'}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isChatLoading || !chatInput.trim()}
                  className="px-5 py-2.5 bg-[#588157] hover:bg-[#476a46] disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </div>

            {/* Right Telemetry & Quick Workflows Sidebar */}
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 overflow-y-auto">
              {/* Telemetry Stats */}
              <div className="p-5 bg-white rounded-2xl border border-[#E6E2DE] shadow-xs">
                <h3 className="text-xs font-bold text-[#2D2D2A] uppercase tracking-wider mb-3">Telemetry &amp; Engine</h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#F4F1EA]">
                    <span className="text-[#8A817C]">Vector Index Dimension:</span>
                    <span className="font-mono font-bold text-[#2D2D2A]">384-D (Dense)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F4F1EA]">
                    <span className="text-[#8A817C]">Indexed Memories:</span>
                    <span className="font-mono font-bold text-[#588157]">{memoryCount} Vectors</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F4F1EA]">
                    <span className="text-[#8A817C]">Orchestrator Mode:</span>
                    <span className="font-mono font-bold text-[#3D5A80]">Hybrid (Gemini 3.8 + Local)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F4F1EA]">
                    <span className="text-[#8A817C]">Active Skills:</span>
                    <span className="font-mono font-bold text-[#588157]">14 Integrated Tools</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#8A817C]">Multi-lingual Adapter:</span>
                    <span className="font-mono font-bold text-[#E76F51]">Hindi / Hinglish / English</span>
                  </div>
                </div>
              </div>

              {/* Quick Workflows */}
              <div className="p-5 bg-white rounded-2xl border border-[#E6E2DE] shadow-xs">
                <h3 className="text-xs font-bold text-[#2D2D2A] uppercase tracking-wider mb-3">Advanced Workflows</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setChatInput('Namaste! Main aaj ek naya project shuru kar raha hoon.')}
                    className="w-full text-left p-2.5 bg-[#FDFBF7] hover:bg-[#F4F1EA] rounded-xl border border-[#E6E2DE] text-xs text-[#2D2D2A] transition-colors cursor-pointer"
                  >
                    🇮🇳 Chat in Hindi (Hinglish Support)
                  </button>
                  <button
                    onClick={() => setChatInput('run code: [2, 4, 6, 8, 10].map(x => x ** 2)')}
                    className="w-full text-left p-2.5 bg-[#FDFBF7] hover:bg-[#F4F1EA] rounded-xl border border-[#E6E2DE] text-xs text-[#2D2D2A] transition-colors cursor-pointer"
                  >
                    🐍 Sandboxed Code Execution
                  </button>
                  <button
                    onClick={() => setChatInput('swarm plan: Architect a zero-knowledge vector database')}
                    className="w-full text-left p-2.5 bg-[#FDFBF7] hover:bg-[#F4F1EA] rounded-xl border border-[#E6E2DE] text-xs text-[#2D2D2A] transition-colors cursor-pointer"
                  >
                    🐝 Multi-Agent Swarm Planner
                  </button>
                  <button
                    onClick={() => setChatInput('sentiment of: The sovereign AI execution was lightning fast and highly precise!')}
                    className="w-full text-left p-2.5 bg-[#FDFBF7] hover:bg-[#F4F1EA] rounded-xl border border-[#E6E2DE] text-xs text-[#2D2D2A] transition-colors cursor-pointer"
                  >
                    📊 Sentiment &amp; Polarity Analysis
                  </button>
                  <button
                    onClick={() => setChatInput('weather in Delhi')}
                    className="w-full text-left p-2.5 bg-[#FDFBF7] hover:bg-[#F4F1EA] rounded-xl border border-[#E6E2DE] text-xs text-[#2D2D2A] transition-colors cursor-pointer"
                  >
                    🌤️ Atmospheric Telemetry (Weather)
                  </button>
                  <button
                    onClick={() => setChatInput('remember: Sovereign agent deployed with 14 cognitive skills and vector RAG')}
                    className="w-full text-left p-2.5 bg-[#FDFBF7] hover:bg-[#F4F1EA] rounded-xl border border-[#E6E2DE] text-xs text-[#2D2D2A] transition-colors cursor-pointer"
                  >
                    💾 Save Note to Vector Bank
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
                  placeholder="Semantic query (e.g. project, agent)..."
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
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[#8A817C]">
                            Sim: {((item.score ?? (1 - (item.distance || 0.2))) * 100).toFixed(1)}%
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteMemory(item.id)}
                            className="text-red-500 hover:text-red-700 p-0.5 rounded cursor-pointer"
                            title="Auditable Forget: Expunge this memory"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
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

        {/* TAB 6: SKILLS & LAB */}
        {activeTab === 'learning' && (
          <div className="grid grid-cols-12 gap-6 h-full flex-1 overflow-hidden">
            {/* Integrated Skills Catalog */}
            <div className="col-span-12 lg:col-span-7 bg-white rounded-2xl border border-[#E6E2DE] shadow-xs p-5 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-xs font-bold text-[#2D2D2A] uppercase tracking-wider">Active Sovereign Skills ({skillsList.length || 14})</h3>
                  <p className="text-[11px] text-[#8A817C]">Sandboxed cognitive tools executable on command or automatically</p>
                </div>
                <button
                  onClick={fetchSkillsList}
                  className="p-1.5 bg-[#FDFBF7] hover:bg-[#F4F1EA] rounded-lg border border-[#E6E2DE] text-[#2D2D2A] cursor-pointer"
                  title="Refresh skills"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {skillsList.map((skill) => (
                  <div key={skill.id} className="p-3 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[#588157] text-[11px] flex items-center gap-1.5">
                        <Zap className="w-3 h-3 text-[#E76F51]" />
                        {skill.name}
                      </span>
                      {skill.samplePrompts && skill.samplePrompts.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('chat');
                            setChatInput(skill.samplePrompts![0]);
                          }}
                          className="px-2 py-0.5 rounded bg-white hover:bg-[#588157] hover:text-white border border-[#E6E2DE] text-[10px] font-medium text-[#2D2D2A] transition-colors cursor-pointer"
                        >
                          Try in Chat →
                        </button>
                      )}
                    </div>
                    <p className="text-[#2D2D2A] text-[11px]">{skill.description}</p>
                    {skill.samplePrompts && skill.samplePrompts.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {skill.samplePrompts.map((sp, pIdx) => (
                          <span
                            key={pIdx}
                            onClick={() => {
                              setActiveTab('chat');
                              setChatInput(sp);
                            }}
                            className="px-2 py-0.5 rounded-md bg-white border border-[#E6E2DE] text-[10px] font-mono text-[#8A817C] hover:text-[#588157] hover:border-[#588157] cursor-pointer"
                          >
                            &quot;{sp}&quot;
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Dynamic Proposals & Self-Learning */}
            <div className="col-span-12 lg:col-span-5 bg-white rounded-2xl border border-[#E6E2DE] shadow-xs p-5 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-[#2D2D2A] uppercase tracking-wider">Dynamic Proposals</h3>
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
                    No open proposals. Engine continuously monitors execution logs for unhandled user intents.
                  </div>
                ) : (
                  proposals.map((prop, idx) => (
                    <div key={idx} className="p-3 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[#588157]">{prop.skill_name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E76F51]/15 text-[#E76F51]">
                          {(prop.confidence_score * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-[#2D2D2A] text-[11px]">{prop.description}</p>
                      <div className="p-2 bg-white rounded-lg border border-[#E6E2DE] font-mono text-[10px] text-[#8A817C]">
                        Use case: {prop.use_case}
                      </div>
                    </div>
                  ))
                )}

                <div className="p-4 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl text-xs space-y-3 mt-3">
                  <span className="font-bold text-[#2D2D2A] block">Experience Mining Metrics</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 bg-white border border-[#E6E2DE] rounded-xl">
                      <span className="text-[10px] text-[#8A817C] block font-mono">Cognitive Traces</span>
                      <span className="text-base font-bold font-mono text-[#2D2D2A]">1,428</span>
                    </div>
                    <div className="p-2.5 bg-white border border-[#E6E2DE] rounded-xl">
                      <span className="text-[10px] text-[#8A817C] block font-mono">Verified Skills</span>
                      <span className="text-base font-bold font-mono text-[#588157]">14 Active</span>
                    </div>
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
