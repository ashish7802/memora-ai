'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  HardDrive,
  Send,
  Radio,
  RefreshCw,
  Sparkles,
  Bot,
  Activity,
  CheckCircle2,
  Clock,
  Trash2,
  Play,
  Terminal,
  Layers,
  ArrowRight,
  Share2,
  Copy,
  Check,
  Zap,
  Globe,
  Settings,
} from 'lucide-react';
import { OllamaHealthStatus, OllamaConfig } from '@/lib/memora/ollama';
import { PlatformEventLog } from '@/lib/memora/platforms';

interface LocalAndPlatformsProps {
  sessionId?: string;
  onSendToChat?: (text: string) => void;
}

export default function LocalAndPlatforms({
  sessionId = 'default',
  onSendToChat,
}: LocalAndPlatformsProps) {
  const [activeSubTab, setActiveSubTab] = useState<'ollama' | 'telegram' | 'discord' | 'slack' | 'stream'>('ollama');

  // Ollama State
  const [ollamaHealth, setOllamaHealth] = useState<OllamaHealthStatus | null>(null);
  const [ollamaConfig, setOllamaConfig] = useState<OllamaConfig>({
    endpoint: 'http://127.0.0.1:11434',
    selectedModel: 'llama3:8b',
    embeddingModel: 'nomic-embed-text:latest',
    mode: 'hybrid',
    timeoutMs: 15000,
    temperature: 0.7,
    isSimulatedFallback: true,
  });
  const [isPingingOllama, setIsPingingOllama] = useState(false);
  const [testPrompt, setTestPrompt] = useState('Evaluate local vector memory latency for 10,000 embeddings.');
  const [localInferenceResult, setLocalInferenceResult] = useState<any>(null);
  const [isInferencing, setIsInferencing] = useState(false);

  // Platform State & Logs
  const [eventLogs, setEventLogs] = useState<PlatformEventLog[]>([]);
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Simulators
  const [simText, setSimText] = useState('/recall vector compression');
  const [isSimulating, setIsSimulating] = useState(false);
  const [lastSimResponse, setLastSimResponse] = useState<any>(null);

  // Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState('Hermes Swarm Synthesis Complete');
  const [broadcastMessage, setBroadcastMessage] = useState('Swarm executed 5 parallel sub-tasks across memory and research pipelines.');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Fetch Ollama status
  const fetchOllamaStatus = useCallback(async () => {
    setIsPingingOllama(true);
    try {
      const res = await fetch('/api/local/ollama');
      if (res.ok) {
        const data = await res.json();
        setOllamaHealth(data.health);
        if (data.config) setOllamaConfig(data.config);
      }
    } catch {
      // silent fallback
    } finally {
      setIsPingingOllama(false);
    }
  }, []);

  // Fetch Event Logs
  const fetchLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const url = filterPlatform !== 'all' ? `/api/platforms/events?platform=${filterPlatform}` : '/api/platforms/events';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setEventLogs(data.logs || []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingLogs(false);
    }
  }, [filterPlatform]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [oRes, eRes] = await Promise.all([
          fetch('/api/local/ollama'),
          fetch('/api/platforms/events'),
        ]);
        if (oRes.ok && isMounted) {
          const oData = await oRes.json();
          setOllamaHealth(oData.health);
          if (oData.config) setOllamaConfig(oData.config);
        }
        if (eRes.ok && isMounted) {
          const eData = await eRes.json();
          setEventLogs(eData.logs || []);
        }
      } catch {
        // silent
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Update Ollama Config
  const handleUpdateOllamaMode = async (newMode: 'cloud' | 'local' | 'hybrid' | 'airgapped') => {
    const updated = { ...ollamaConfig, mode: newMode };
    setOllamaConfig(updated);
    try {
      const res = await fetch('/api/local/ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_config', config: updated }),
      });
      if (res.ok) {
        const data = await res.json();
        setOllamaHealth(data.health);
      }
    } catch {
      // ignore
    }
  };

  const handleUpdateOllamaModel = async (modelName: string) => {
    const updated = { ...ollamaConfig, selectedModel: modelName };
    setOllamaConfig(updated);
    try {
      const res = await fetch('/api/local/ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_config', config: updated }),
      });
      if (res.ok) {
        const data = await res.json();
        setOllamaHealth(data.health);
      }
    } catch {
      // ignore
    }
  };

  // Run Test Local Inference
  const handleRunLocalInference = async () => {
    if (!testPrompt.trim()) return;
    setIsInferencing(true);
    setLocalInferenceResult(null);
    try {
      const res = await fetch('/api/local/ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          prompt: testPrompt,
          model: ollamaConfig.selectedModel,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLocalInferenceResult(data.result);
      }
    } catch (err: any) {
      setLocalInferenceResult({ response: `Error: ${err.message}` });
    } finally {
      setIsInferencing(false);
    }
  };

  // Run Simulator for Telegram, Discord, or Slack
  const handleSimulatePlatform = async (platform: 'telegram' | 'discord' | 'slack') => {
    if (!simText.trim()) return;
    setIsSimulating(true);
    setLastSimResponse(null);
    try {
      const res = await fetch('/api/platforms/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, text: simText }),
      });
      if (res.ok) {
        const data = await res.json();
        setLastSimResponse(data.result);
        fetchLogs();
      }
    } catch (err: any) {
      setLastSimResponse({ error: err.message });
    } finally {
      setIsSimulating(false);
    }
  };

  // Broadcast
  const handleBroadcast = async () => {
    setIsBroadcasting(true);
    setBroadcastSuccess(false);
    try {
      const res = await fetch('/api/platforms/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'broadcast',
          title: broadcastTitle,
          message: broadcastMessage,
        }),
      });
      if (res.ok) {
        setBroadcastSuccess(true);
        fetchLogs();
        setTimeout(() => setBroadcastSuccess(false), 3000);
      }
    } catch {
      // ignore
    } finally {
      setIsBroadcasting(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleClearLogs = async () => {
    try {
      await fetch('/api/platforms/events', { method: 'DELETE' });
      setEventLogs([]);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FDFBF7]">
      {/* HEADER / CONTROL BAR */}
      <div className="p-4 border-b border-[#E6E2DE] bg-white shrink-0 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#3D5A801A] text-[#3D5A80] rounded-lg">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#2D2D2A] flex items-center gap-2">
                Part 4: Local-First Engine &amp; Multi-Platform Hub
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-[#3D5A8015] text-[#3D5A80] border border-[#3D5A8033] rounded-full">
                  Ollama + Telegram/Discord/Slack
                </span>
              </h2>
              <p className="text-[11px] text-[#8A817C]">
                Offline-First Vector Store, Local LLM Daemon, and Webhook Gateways
              </p>
            </div>
          </div>

          {/* Quick Sub-Tab Selector */}
          <div className="flex items-center gap-1.5 bg-[#F8F5F2] p-1 border border-[#E6E2DE] rounded-2xl">
            <button
              onClick={() => setActiveSubTab('ollama')}
              className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'ollama'
                  ? 'bg-white text-[#2D2D2A] shadow-xs'
                  : 'text-[#8A817C] hover:text-[#2D2D2A]'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5 text-[#3D5A80]" />
              <span>Ollama Hub</span>
            </button>
            <button
              onClick={() => setActiveSubTab('telegram')}
              className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'telegram'
                  ? 'bg-white text-[#2D2D2A] shadow-xs'
                  : 'text-[#8A817C] hover:text-[#2D2D2A]'
              }`}
            >
              <Send className="w-3.5 h-3.5 text-[#2A9D8F]" />
              <span>Telegram</span>
            </button>
            <button
              onClick={() => setActiveSubTab('discord')}
              className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'discord'
                  ? 'bg-white text-[#2D2D2A] shadow-xs'
                  : 'text-[#8A817C] hover:text-[#2D2D2A]'
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-[#5865F2]" />
              <span>Discord</span>
            </button>
            <button
              onClick={() => setActiveSubTab('slack')}
              className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'slack'
                  ? 'bg-white text-[#2D2D2A] shadow-xs'
                  : 'text-[#8A817C] hover:text-[#2D2D2A]'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-[#E76F51]" />
              <span>Slack</span>
            </button>
            <button
              onClick={() => setActiveSubTab('stream')}
              className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'stream'
                  ? 'bg-white text-[#2D2D2A] shadow-xs'
                  : 'text-[#8A817C] hover:text-[#2D2D2A]'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-[#588157]" />
              <span>Event Stream ({eventLogs.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* SUBTAB 1: OLLAMA LOCAL-FIRST ENGINE */}
      {activeSubTab === 'ollama' && (
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {/* Status & Mode Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Health Card */}
            <div className="p-4 bg-white border border-[#E6E2DE] rounded-2xl shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#8A817C]">Daemon Status</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                    ollamaHealth?.connected
                      ? 'bg-[#58815715] text-[#588157] border border-[#58815733]'
                      : 'bg-[#D4A37315] text-[#D4A373] border border-[#D4A37333]'
                  }`}
                >
                  {ollamaHealth?.connected ? 'ONLINE' : 'SIMULATED BRIDGE'}
                </span>
              </div>
              <p className="text-xs font-mono text-[#2D2D2A] font-medium truncate">
                {ollamaConfig.endpoint}
              </p>
              <div className="flex items-center justify-between text-[11px] text-[#8A817C] pt-1 border-t border-[#F2EFEA]">
                <span>Ping Latency:</span>
                <span className="font-mono text-[#2D2D2A]">{ollamaHealth?.latencyMs || 12} ms</span>
              </div>
              <button
                onClick={fetchOllamaStatus}
                disabled={isPingingOllama}
                className="w-full py-1 text-xs text-[#588157] hover:bg-[#5881570D] rounded-lg border border-[#58815733] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isPingingOllama ? 'animate-spin' : ''}`} />
                <span>Refresh Daemon Connection</span>
              </button>
            </div>

            {/* Operating Mode Selector */}
            <div className="p-4 bg-white border border-[#E6E2DE] rounded-2xl shadow-2xs space-y-2">
              <span className="text-xs font-semibold text-[#8A817C]">Inference Routing Mode</span>
              <div className="grid grid-cols-2 gap-1.5">
                {(['hybrid', 'local', 'cloud', 'airgapped'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => handleUpdateOllamaMode(m)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-medium capitalize border transition-all cursor-pointer text-left ${
                      ollamaConfig.mode === m
                        ? 'bg-[#3D5A80] text-white border-[#3D5A80] shadow-xs'
                        : 'bg-[#FDFBF7] text-[#555] border-[#E6E2DE] hover:bg-white'
                    }`}
                  >
                    <span className="block font-semibold">{m}</span>
                    <span className="text-[9px] opacity-80 block truncate">
                      {m === 'hybrid'
                        ? 'Local + Cloud failover'
                        : m === 'local'
                        ? 'Ollama priority'
                        : m === 'airgapped'
                        ? '100% Zero-Cloud'
                        : 'Gemini Cloud API'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Active Model Selector */}
            <div className="p-4 bg-white border border-[#E6E2DE] rounded-2xl shadow-2xs space-y-2">
              <span className="text-xs font-semibold text-[#8A817C]">Active Local Weights</span>
              <select
                value={ollamaConfig.selectedModel}
                onChange={(e) => handleUpdateOllamaModel(e.target.value)}
                className="w-full p-2 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl text-xs font-semibold text-[#2D2D2A] focus:outline-hidden"
              >
                {ollamaHealth?.models?.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name} ({m.details?.parameter_size || 'Local GGUF'})
                  </option>
                ))}
              </select>
              <div className="text-[10px] text-[#8A817C] space-y-0.5">
                <p>• Embedding Model: <span className="font-mono text-[#2D2D2A]">{ollamaConfig.embeddingModel}</span></p>
                <p>• Quantization: <span className="font-mono text-[#588157]">Q4_K_M / Float32</span></p>
              </div>
            </div>
          </div>

          {/* Interactive Local Inference Playground */}
          <div className="p-4 bg-white border border-[#E6E2DE] rounded-2xl shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#3D5A80]" />
                <h3 className="text-xs font-bold text-[#2D2D2A]">Local Inference &amp; Vector Sizing Playground</h3>
              </div>
              <span className="text-[11px] font-mono text-[#8A817C]">
                Model: <span className="text-[#3D5A80] font-semibold">{ollamaConfig.selectedModel}</span>
              </span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRunLocalInference();
                }}
                placeholder="Ask local model or test offline memory pipeline..."
                className="flex-1 px-3.5 py-2 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl text-xs text-[#2D2D2A] focus:outline-hidden"
              />
              <button
                onClick={handleRunLocalInference}
                disabled={isInferencing || !testPrompt.trim()}
                className="px-4 py-2 bg-[#3D5A80] hover:bg-[#2F4664] disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <Zap className={`w-3.5 h-3.5 ${isInferencing ? 'animate-spin' : ''}`} />
                <span>{isInferencing ? 'Running Inference...' : 'Execute Local Inference'}</span>
              </button>
            </div>

            {/* Inference Result Output Box */}
            {localInferenceResult && (
              <div className="p-3.5 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl space-y-2 text-xs animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-[#2D2D2A] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#588157]" />
                    Local Model Response ({localInferenceResult.model})
                  </span>
                  <div className="flex items-center gap-2 text-[#8A817C] font-mono text-[10px]">
                    <span>Latency: {localInferenceResult.latencyMs}ms</span>
                    <span>• Speed: {localInferenceResult.tokens_per_sec || 45.2} tok/s</span>
                    <span>• Tokens: {localInferenceResult.eval_count || 128}</span>
                  </div>
                </div>
                <div className="p-3 bg-white border border-[#E6E2DE] rounded-lg text-xs text-[#2D2D2A] whitespace-pre-wrap leading-relaxed">
                  {localInferenceResult.response}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 2: TELEGRAM BOT INTEGRATION */}
      {activeSubTab === 'telegram' && (
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Telegram Config Box */}
            <div className="p-4 bg-white border border-[#E6E2DE] rounded-2xl shadow-2xs space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-[#2A9D8F15] text-[#2A9D8F] rounded-lg">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#2D2D2A]">Telegram Bot Gateway</h3>
                  <p className="text-[10px] text-[#8A817C]">Bidirectional chat, memory storage &amp; swarm commands</p>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-[10px] font-mono text-[#8A817C] uppercase">Webhook Endpoint</label>
                  <div className="flex items-center gap-2 mt-0.5">
                    <input
                      type="text"
                      readOnly
                      value="/api/platforms/telegram/webhook"
                      className="flex-1 p-2 bg-[#F8F5F2] border border-[#E6E2DE] rounded-xl text-xs font-mono text-[#555]"
                    />
                    <button
                      onClick={() => copyToClipboard('/api/platforms/telegram/webhook', 'tg-webhook')}
                      className="p-2 text-[#8A817C] hover:text-[#2D2D2A] bg-white border border-[#E6E2DE] rounded-xl cursor-pointer"
                    >
                      {copiedText === 'tg-webhook' ? <Check className="w-3.5 h-3.5 text-[#588157]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-[#8A817C] uppercase">Supported Slash Commands</label>
                  <div className="p-2 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl space-y-1 font-mono text-[11px] text-[#444] mt-0.5">
                    <p>• <span className="font-semibold text-[#2A9D8F]">/remember &lt;text&gt;</span> - Ingest to vector memory</p>
                    <p>• <span className="font-semibold text-[#2A9D8F]">/recall &lt;query&gt;</span> - Top-k semantic search</p>
                    <p>• <span className="font-semibold text-[#2A9D8F]">/swarm &lt;goal&gt;</span> - Dispatches Hermes Swarm</p>
                    <p>• <span className="font-semibold text-[#2A9D8F]">/stats</span> - Memory &amp; plugin metrics</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Telegram Live Interactive Simulator */}
            <div className="p-4 bg-white border border-[#E6E2DE] rounded-2xl shadow-2xs space-y-3 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#2D2D2A]">Telegram Message Simulator</span>
                <span className="text-[10px] font-mono text-[#2A9D8F]">@alex_ops (ID: 981240)</span>
              </div>

              {/* Preset buttons */}
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                <button
                  onClick={() => setSimText('/remember Offline local mode preference')}
                  className="px-2 py-0.5 bg-[#F8F5F2] hover:bg-white border border-[#E6E2DE] rounded text-[#555]"
                >
                  /remember
                </button>
                <button
                  onClick={() => setSimText('/recall vector quantization')}
                  className="px-2 py-0.5 bg-[#F8F5F2] hover:bg-white border border-[#E6E2DE] rounded text-[#555]"
                >
                  /recall
                </button>
                <button
                  onClick={() => setSimText('/swarm Analyze database memory indexes')}
                  className="px-2 py-0.5 bg-[#F8F5F2] hover:bg-white border border-[#E6E2DE] rounded text-[#555]"
                >
                  /swarm
                </button>
                <button
                  onClick={() => setSimText('/stats')}
                  className="px-2 py-0.5 bg-[#F8F5F2] hover:bg-white border border-[#E6E2DE] rounded text-[#555]"
                >
                  /stats
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSimulatePlatform('telegram');
                  }}
                  placeholder="Type telegram message or command..."
                  className="flex-1 px-3 py-2 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl text-xs text-[#2D2D2A] focus:outline-hidden"
                />
                <button
                  onClick={() => handleSimulatePlatform('telegram')}
                  disabled={isSimulating}
                  className="px-3.5 py-2 bg-[#2A9D8F] hover:bg-[#238276] text-white text-xs font-semibold rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Send className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
                  <span>Send</span>
                </button>
              </div>

              {/* Bot Response Output */}
              {lastSimResponse && (
                <div className="p-3 bg-[#FDFBF7] border border-[#2A9D8F33] rounded-xl text-xs space-y-1 mt-auto">
                  <span className="text-[10px] font-mono text-[#2A9D8F] font-bold">Memora Bot Reply:</span>
                  <div className="p-2.5 bg-white border border-[#E6E2DE] rounded-lg whitespace-pre-wrap font-sans text-xs text-[#2D2D2A]">
                    {lastSimResponse.reply || JSON.stringify(lastSimResponse, null, 2)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: DISCORD GATEWAY & EMBEDS */}
      {activeSubTab === 'discord' && (
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Discord Webhook & Config */}
            <div className="p-4 bg-white border border-[#E6E2DE] rounded-2xl shadow-2xs space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-[#5865F215] text-[#5865F2] rounded-lg">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#2D2D2A]">Discord Webhook &amp; Slash Gateway</h3>
                  <p className="text-[10px] text-[#8A817C]">Rich embed cards, swarm notifications, and slash commands</p>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-[10px] font-mono text-[#8A817C] uppercase">Interaction Endpoint</label>
                  <div className="flex items-center gap-2 mt-0.5">
                    <input
                      type="text"
                      readOnly
                      value="/api/platforms/discord/webhook"
                      className="flex-1 p-2 bg-[#F8F5F2] border border-[#E6E2DE] rounded-xl text-xs font-mono text-[#555]"
                    />
                    <button
                      onClick={() => copyToClipboard('/api/platforms/discord/webhook', 'disc-webhook')}
                      className="p-2 text-[#8A817C] hover:text-[#2D2D2A] bg-white border border-[#E6E2DE] rounded-xl cursor-pointer"
                    >
                      {copiedText === 'disc-webhook' ? <Check className="w-3.5 h-3.5 text-[#588157]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-[#8A817C] uppercase">Channel Target</label>
                  <p className="font-mono text-xs text-[#5865F2] font-semibold bg-[#FDFBF7] p-2 rounded-xl border border-[#E6E2DE] mt-0.5">
                    #memora-agent-feed (Guild ID: 1122334455)
                  </p>
                </div>
              </div>
            </div>

            {/* Discord Interactive Slash Simulator & Embed Preview */}
            <div className="p-4 bg-white border border-[#E6E2DE] rounded-2xl shadow-2xs space-y-3 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#2D2D2A]">Discord Command Tester</span>
                <span className="text-[10px] font-mono text-[#5865F2]">/memora [command]</span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSimulatePlatform('discord');
                  }}
                  placeholder="e.g. recall benchmarks OR swarm Analyze cluster"
                  className="flex-1 px-3 py-2 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl text-xs text-[#2D2D2A] focus:outline-hidden"
                />
                <button
                  onClick={() => handleSimulatePlatform('discord')}
                  disabled={isSimulating}
                  className="px-3.5 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-semibold rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Bot className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
                  <span>Execute</span>
                </button>
              </div>

              {/* Discord Rich Embed Visualizer */}
              {lastSimResponse && lastSimResponse.data?.embeds?.[0] && (
                <div className="p-3 bg-[#2F3136] text-white rounded-xl text-xs space-y-2 border-l-4 border-[#588157] mt-auto">
                  <h4 className="font-bold text-xs text-[#588157]">
                    {lastSimResponse.data.embeds[0].title}
                  </h4>
                  <p className="text-[11px] text-[#DCDDDE]">
                    {lastSimResponse.data.embeds[0].description}
                  </p>
                  {lastSimResponse.data.embeds[0].fields && (
                    <div className="space-y-1 pt-1 border-t border-[#40444B]">
                      {lastSimResponse.data.embeds[0].fields.map((f: any, i: number) => (
                        <div key={i} className="text-[11px]">
                          <span className="font-semibold text-white">{f.name}: </span>
                          <span className="text-[#B9BBBE]">{f.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: SLACK WORKSPACE INTEGRATION */}
      {activeSubTab === 'slack' && (
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Slack Config Box */}
            <div className="p-4 bg-white border border-[#E6E2DE] rounded-2xl shadow-2xs space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-[#E76F5115] text-[#E76F51] rounded-lg">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#2D2D2A]">Slack Workspace App</h3>
                  <p className="text-[10px] text-[#8A817C]">Block Kit message formatting &amp; enterprise channels</p>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-[10px] font-mono text-[#8A817C] uppercase">Slack Event / Command URL</label>
                  <div className="flex items-center gap-2 mt-0.5">
                    <input
                      type="text"
                      readOnly
                      value="/api/platforms/slack/webhook"
                      className="flex-1 p-2 bg-[#F8F5F2] border border-[#E6E2DE] rounded-xl text-xs font-mono text-[#555]"
                    />
                    <button
                      onClick={() => copyToClipboard('/api/platforms/slack/webhook', 'slack-webhook')}
                      className="p-2 text-[#8A817C] hover:text-[#2D2D2A] bg-white border border-[#E6E2DE] rounded-xl cursor-pointer"
                    >
                      {copiedText === 'slack-webhook' ? <Check className="w-3.5 h-3.5 text-[#588157]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-[#8A817C] uppercase">Default Channel Target</label>
                  <p className="font-mono text-xs text-[#E76F51] font-semibold bg-[#FDFBF7] p-2 rounded-xl border border-[#E6E2DE] mt-0.5">
                    #ai-memora-ops (Slack Team T000)
                  </p>
                </div>
              </div>
            </div>

            {/* Slack Block Kit Simulator */}
            <div className="p-4 bg-white border border-[#E6E2DE] rounded-2xl shadow-2xs space-y-3 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#2D2D2A]">Slack Slash Command Simulator</span>
                <span className="text-[10px] font-mono text-[#E76F51]">/memora</span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSimulatePlatform('slack');
                  }}
                  placeholder="e.g. remember vector quantization standard"
                  className="flex-1 px-3 py-2 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl text-xs text-[#2D2D2A] focus:outline-hidden"
                />
                <button
                  onClick={() => handleSimulatePlatform('slack')}
                  disabled={isSimulating}
                  className="px-3.5 py-2 bg-[#E76F51] hover:bg-[#D45D3F] text-white text-xs font-semibold rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Send className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
                  <span>Send</span>
                </button>
              </div>

              {/* Slack Block Kit Render Box */}
              {lastSimResponse && (
                <div className="p-3.5 bg-[#4A154B0D] border border-[#4A154B22] rounded-xl text-xs space-y-2 mt-auto">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#E76F51]"></span>
                    <span className="font-bold text-xs text-[#2D2D2A]">
                      {lastSimResponse.text || 'Memora App'}
                    </span>
                  </div>
                  <div className="p-3 bg-white border border-[#E6E2DE] rounded-lg text-xs font-sans text-[#333] space-y-1">
                    {lastSimResponse.blocks?.map((blk: any, idx: number) => (
                      <div key={idx} className="leading-relaxed">
                        {blk.text?.text || blk.elements?.[0]?.text || ''}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 5: LIVE UNIFIED EVENT STREAM & CROSS-PLATFORM BROADCAST */}
      {activeSubTab === 'stream' && (
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {/* Cross-Platform One-Click Broadcast Dispatcher */}
          <div className="p-4 bg-white border border-[#E6E2DE] rounded-2xl shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-[#588157]" />
                <h3 className="text-xs font-bold text-[#2D2D2A]">
                  Cross-Platform Unified Broadcast Dispatcher
                </h3>
              </div>
              <span className="text-[10px] font-mono text-[#8A817C]">
                Targets: Telegram + Discord + Slack
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder="Broadcast Notification Title..."
                className="px-3 py-2 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl text-xs text-[#2D2D2A] focus:outline-hidden"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Notification Message..."
                  className="flex-1 px-3 py-2 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl text-xs text-[#2D2D2A] focus:outline-hidden"
                />
                <button
                  onClick={handleBroadcast}
                  disabled={isBroadcasting}
                  className="px-4 py-2 bg-[#588157] hover:bg-[#476a46] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                >
                  <Send className={`w-3.5 h-3.5 ${isBroadcasting ? 'animate-spin' : ''}`} />
                  <span>{broadcastSuccess ? 'Dispatched!' : 'Broadcast'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Unified Event Logs Table */}
          <div className="p-4 bg-white border border-[#E6E2DE] rounded-2xl shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#3D5A80]" />
                <h3 className="text-xs font-bold text-[#2D2D2A]">
                  Unified Platform Event Audit Stream
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={filterPlatform}
                  onChange={(e) => setFilterPlatform(e.target.value)}
                  className="px-2 py-1 bg-[#F8F5F2] border border-[#E6E2DE] rounded-lg text-xs text-[#2D2D2A] cursor-pointer"
                >
                  <option value="all">All Platforms</option>
                  <option value="telegram">Telegram</option>
                  <option value="discord">Discord</option>
                  <option value="slack">Slack</option>
                </select>

                <button
                  onClick={fetchLogs}
                  className="p-1.5 text-[#8A817C] hover:text-[#2D2D2A] rounded-lg border border-[#E6E2DE]"
                  title="Refresh Logs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                </button>

                <button
                  onClick={handleClearLogs}
                  className="p-1.5 text-[#E76F51] hover:bg-[#E76F5115] rounded-lg border border-[#E6E2DE]"
                  title="Clear Event Logs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Event list */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {eventLogs.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#8A817C] border border-dashed border-[#E6E2DE] rounded-xl">
                  No platform events recorded yet. Use the simulators above or trigger a broadcast!
                </div>
              ) : (
                eventLogs.map((log) => {
                  const platColor =
                    log.platform === 'telegram'
                      ? '#2A9D8F'
                      : log.platform === 'discord'
                      ? '#5865F2'
                      : '#E76F51';

                  return (
                    <div
                      key={log.id}
                      className="p-3 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl text-xs space-y-1.5 hover:border-[#D4A373] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold text-white uppercase"
                            style={{ backgroundColor: platColor }}
                          >
                            {log.platform}
                          </span>
                          <span className="text-[11px] font-semibold text-[#2D2D2A]">
                            {log.eventType}
                          </span>
                          <span className="text-[10px] text-[#8A817C] font-mono">
                            from {log.sender}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-[#8A817C]">
                          <span>{log.latencyMs}ms</span>
                          <span>• {new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>

                      <p className="text-xs text-[#2D2D2A] font-mono bg-white p-2 rounded-lg border border-[#E6E2DE]">
                        {log.content}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
