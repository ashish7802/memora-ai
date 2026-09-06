'use client';

import React, { useState, useEffect } from 'react';
import {
  Brain,
  Sparkles,
  Bot,
  Terminal,
  Zap,
  HardDrive,
  Network,
  Kanban,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight,
  Github,
  Star,
  Layers,
  ChevronRight,
  Shield,
  Activity,
  Cpu,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  Flame,
  Radio,
  Share2,
} from 'lucide-react';
import HeroBackgroundGraph from '@/components/HeroBackgroundGraph';
import LiveHeroPlayground from '@/components/LiveHeroPlayground';
import MemorySemanticGraph from '@/components/MemorySemanticGraph';
import SwarmKanban from '@/components/SwarmKanban';
import LocalAndPlatforms from '@/components/LocalAndPlatforms';
import MemoraConsole from '@/components/MemoraConsole';

export default function MemoraLandingPage() {
  const [viewMode, setViewMode] = useState<'landing' | 'console'>('landing');
  const [consoleTab, setConsoleTab] = useState<'chat' | 'search' | 'add' | 'proposals' | 'learning' | 'swarm' | 'platforms'>('chat');
  const [copiedCli, setCopiedCli] = useState(false);
  const [activeFeatureTab, setActiveFeatureTab] = useState<'swarm' | 'graph' | 'platforms'>('swarm');

  const copyCliCommand = () => {
    navigator.clipboard.writeText('npm create memora-app@latest');
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2200);
  };

  const openConsoleWithTab = (tab: 'chat' | 'search' | 'add' | 'proposals' | 'learning' | 'swarm' | 'platforms') => {
    setConsoleTab(tab);
    setViewMode('console');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#0E1015] text-[#E4E6EB] font-sans selection:bg-[#588157]/40 selection:text-white flex flex-col antialiased">
      {/* 1. Global Navigation Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0E1015]/80 border-b border-[#22252E] px-4 sm:px-8 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setViewMode('landing')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#588157] to-[#2A9D8F] flex items-center justify-center text-white shadow-lg shadow-[#588157]/20">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">Memora</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#588157]/20 text-[#588157] border border-[#588157]/40">
                  v1.0 Sovereign
                </span>
              </div>
              <p className="text-[10px] text-[#8C90A0] hidden sm:block font-mono">Cognitive Memory &amp; Swarm Platform</p>
            </div>
          </div>

          {/* Navigation Links */}
          {viewMode === 'landing' ? (
            <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-[#A0A5B5]">
              <a href="#features" className="hover:text-white transition-colors">
                Architecture
              </a>
              <a href="#interactive-deepdive" className="hover:text-white transition-colors">
                Live Swarm &amp; Graph
              </a>
              <a href="#tech-stack" className="hover:text-white transition-colors">
                Tech Stack
              </a>
              <a href="#deploy" className="hover:text-white transition-colors">
                1-Click Deploy
              </a>
              <a href="#stats" className="hover:text-white transition-colors">
                Telemetry
              </a>
            </nav>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[#588157] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#588157] animate-pulse"></span>
                Full Platform Cockpit Active
              </span>
            </div>
          )}

          {/* Header Action CTAs */}
          <div className="flex items-center gap-3">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 bg-[#1B1D24] hover:bg-[#252832] text-xs font-semibold text-white rounded-xl border border-[#2E323D] flex items-center gap-1.5 transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Star</span>
              <span className="px-1.5 py-0.2 bg-[#2E323D] rounded-full text-[10px] text-[#D4A373] font-mono flex items-center gap-0.5">
                <Star className="w-2.5 h-2.5 fill-[#D4A373]" /> 52.4k
              </span>
            </a>

            {viewMode === 'landing' ? (
              <button
                onClick={() => openConsoleWithTab('chat')}
                className="px-4 py-1.5 bg-gradient-to-r from-[#588157] to-[#456d44] hover:from-[#4d754c] hover:to-[#3e633d] text-xs font-semibold text-white rounded-xl shadow-md shadow-[#588157]/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Launch OS</span>
              </button>
            ) : (
              <button
                onClick={() => setViewMode('landing')}
                className="px-4 py-1.5 bg-[#1E2028] hover:bg-[#292D38] text-xs font-semibold text-white rounded-xl border border-[#343844] transition-colors cursor-pointer"
              >
                Back to Landing
              </button>
            )}
          </div>
        </div>
      </header>

      {/* VIEW 1: FULL CONSOLE MODE */}
      {viewMode === 'console' && (
        <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full animate-in fade-in duration-200">
          <MemoraConsole initialTab={consoleTab} onClose={() => setViewMode('landing')} />
        </main>
      )}

      {/* VIEW 2: VIRAL LANDING PAGE MODE */}
      {viewMode === 'landing' && (
        <main className="flex-1 flex flex-col">
          {/* 2. HERO SECTION */}
          <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden border-b border-[#22252E] px-4 sm:px-8 py-16">
            {/* Interactive D3/Canvas Background */}
            <HeroBackgroundGraph />

            {/* Gradient Overlays for Ambient Lighting */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#588157]/15 blur-[120px] pointer-events-none rounded-full" />
            <div className="absolute top-1/3 right-1/4 w-[400px] h-[300px] bg-[#3D5A80]/15 blur-[120px] pointer-events-none rounded-full" />

            <div className="relative z-10 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Left Column: Viral Messaging */}
              <div className="lg:col-span-6 flex flex-col space-y-6 text-center lg:text-left">
                {/* Release Badge */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#1A1D24] border border-[#2B2F3B] rounded-full text-xs text-[#A2A7B8] mx-auto lg:mx-0 w-fit shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-[#588157] animate-ping" />
                  <span className="font-mono text-[11px] text-[#588157] font-bold">MEMORA v1.0</span>
                  <span className="text-[#646877]">|</span>
                  <span>Auditable Memory &amp; Context-Control Layer</span>
                </div>

                {/* Primary Headline */}
                <h1 className="text-4xl sm:text-5xl xl:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
                  Remember the Right Thing.{' '}
                  <span className="bg-gradient-to-r from-[#588157] via-[#2A9D8F] to-[#E76F51] bg-clip-text text-transparent">
                    Prove Why.
                  </span>{' '}
                  Forget on Command.
                </h1>

                {/* Subtitle */}
                <p className="text-sm sm:text-base text-[#9DA2B3] leading-relaxed max-w-2xl mx-auto lg:mx-0 font-normal">
                  An auditable memory and context-control layer for AI agents. Tenant-isolated vector storage with
                  mathematical recall provenance, temporal validity enforcement, conflict detection, and verifiable forget on command.
                </p>

                {/* Action CTA Buttons */}
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3.5 pt-2">
                  <button
                    onClick={() => openConsoleWithTab('chat')}
                    className="px-6 py-3 bg-gradient-to-r from-[#588157] to-[#3e633d] hover:from-[#4d754c] hover:to-[#355534] text-white text-sm font-semibold rounded-2xl shadow-lg shadow-[#588157]/30 flex items-center gap-2 transition-all cursor-pointer transform hover:-translate-y-0.5"
                  >
                    <span>Launch Console</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <a
                    href="#interactive-deepdive"
                    className="px-5 py-3 bg-[#1C1F28] hover:bg-[#252A36] text-[#D0D4E4] text-sm font-medium rounded-2xl border border-[#2E3342] flex items-center gap-2 transition-colors"
                  >
                    <Kanban className="w-4 h-4 text-[#E76F51]" />
                    <span>Explore Vector Graph</span>
                  </a>
                </div>

                {/* Copyable CLI Installer Pill */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 text-xs text-[#8C90A0]">
                  <div className="flex items-center gap-2 px-3.5 py-2 bg-[#15171D] border border-[#262A35] rounded-xl font-mono text-[11px] text-[#A6ACCD]">
                    <span className="text-[#588157]">$</span>
                    <span>pip install memora-ai</span>
                    <button
                      onClick={copyCliCommand}
                      className="ml-2 p-1 hover:bg-[#252934] rounded text-[#8C90A0] hover:text-white transition-colors cursor-pointer"
                      title="Copy to clipboard"
                    >
                      {copiedCli ? <Check className="w-3.5 h-3.5 text-[#588157]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <span className="text-[11px] font-mono text-[#666B7C]">Open Source &bull; Self-Hosted</span>
                </div>
              </div>

              {/* Right Column: Embedded Live Interactive Playground */}
              <div className="lg:col-span-6 w-full">
                <div className="relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-[#588157]/30 to-[#3D5A80]/30 rounded-3xl blur-xl opacity-75"></div>
                  <div className="relative">
                    <LiveHeroPlayground onLaunchFullConsole={() => openConsoleWithTab('chat')} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 3. ARCHITECTURE SPECS & INTEGRITY BANNER */}
          <section id="stats" className="border-b border-[#22252E] bg-[#12141A] py-10 px-4 sm:px-8">
            <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-6 text-center">
              <div className="p-4 rounded-2xl bg-[#171922] border border-[#252836]">
                <div className="text-2xl sm:text-3xl font-extrabold font-mono text-white flex items-center justify-center gap-1">
                  <span>768</span>
                </div>
                <div className="text-xs text-[#8C90A0] mt-1 font-medium">Vector Dimensions</div>
              </div>

              <div className="p-4 rounded-2xl bg-[#171922] border border-[#252836]">
                <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#2A9D8F] flex items-center justify-center gap-1">
                  <span>HNSW</span>
                </div>
                <div className="text-xs text-[#8C90A0] mt-1 font-medium">Cosine Indexing</div>
              </div>

              <div className="p-4 rounded-2xl bg-[#171922] border border-[#252836]">
                <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#E76F51] flex items-center justify-center gap-1">
                  <span>SHA-256</span>
                </div>
                <div className="text-xs text-[#8C90A0] mt-1 font-medium">Cryptographic Deletion Proof</div>
              </div>

              <div className="p-4 rounded-2xl bg-[#171922] border border-[#252836]">
                <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#D4A373] flex items-center justify-center gap-1">
                  <span>RLS</span>
                </div>
                <div className="text-xs text-[#8C90A0] mt-1 font-medium">Row-Level Tenant Isolation</div>
              </div>

              <div className="p-4 rounded-2xl bg-[#171922] border border-[#252836] col-span-2 md:col-span-1">
                <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#588157] flex items-center justify-center gap-1">
                  <span>MIT</span>
                </div>
                <div className="text-xs text-[#8C90A0] mt-1 font-medium">Open Source Core</div>
              </div>
            </div>
          </section>

          {/* 4. CORE FEATURES BENTO GRID */}
          <section id="features" className="py-20 px-4 sm:px-8 max-w-7xl mx-auto w-full">
            <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#588157]/15 text-[#588157] border border-[#588157]/30">
                SOVEREIGN CAPABILITIES
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Engineered for Autonomous, Self-Improving Intelligence
              </h2>
              <p className="text-sm text-[#9DA2B3] leading-relaxed">
                Every component is modular, fully type-safe, and designed for continuous operational autonomy without human babysitting.
              </p>
            </div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Feature 1: Memory & Vector Topology */}
              <div className="p-6 rounded-3xl bg-[#15171F] border border-[#262A36] hover:border-[#588157]/50 transition-all flex flex-col justify-between group">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-[#588157]/15 border border-[#588157]/30 flex items-center justify-center text-[#588157] mb-5 group-hover:scale-110 transition-transform">
                    <Network className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Durable Associative Vector Memory</h3>
                  <p className="text-xs text-[#9DA2B3] leading-relaxed mb-4">
                    Sub-millisecond cosine similarity search over dense embeddings with temporal decay curves, automatic cluster grouping, and real-time D3 force topology visualization.
                  </p>
                </div>
                <button
                  onClick={() => openConsoleWithTab('search')}
                  className="text-xs font-mono font-semibold text-[#588157] flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <span>Explore Vector Graph</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Feature 2: Hermes Swarm Kanban */}
              <div className="p-6 rounded-3xl bg-[#15171F] border border-[#262A36] hover:border-[#E76F51]/50 transition-all flex flex-col justify-between group">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-[#E76F51]/15 border border-[#E76F51]/30 flex items-center justify-center text-[#E76F51] mb-5 group-hover:scale-110 transition-transform">
                    <Kanban className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Hermes Multi-Agent Swarm</h3>
                  <p className="text-xs text-[#9DA2B3] leading-relaxed mb-4">
                    Hierarchical DAG task decomposition dispatching parallel worker agents, research scouts, adversarial critics, and memory synthesizers onto a real-time Kanban board.
                  </p>
                </div>
                <button
                  onClick={() => openConsoleWithTab('swarm')}
                  className="text-xs font-mono font-semibold text-[#E76F51] flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <span>View Swarm Kanban</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Feature 3: Self-Learning Skill Generator */}
              <div className="p-6 rounded-3xl bg-[#15171F] border border-[#262A36] hover:border-[#D4A373]/50 transition-all flex flex-col justify-between group">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-[#D4A373]/15 border border-[#D4A373]/30 flex items-center justify-center text-[#D4A373] mb-5 group-hover:scale-110 transition-transform">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Audited Skill Proposals</h3>
                  <p className="text-xs text-[#9DA2B3] leading-relaxed mb-4">
                    Experience logging pipeline that mines interaction patterns, detects capability gaps, drafts sandboxed tool proposals, and audits them with AST static analysis for human review.
                  </p>
                </div>
                <button
                  onClick={() => openConsoleWithTab('learning')}
                  className="text-xs font-mono font-semibold text-[#D4A373] flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <span>Inspect Skill Proposals</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Feature 4: Local-First Ollama Bridge */}
              <div className="p-6 rounded-3xl bg-[#15171F] border border-[#262A36] hover:border-[#3D5A80]/50 transition-all flex flex-col justify-between group">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-[#3D5A80]/15 border border-[#3D5A80]/30 flex items-center justify-center text-[#3D5A80] mb-5 group-hover:scale-110 transition-transform">
                    <HardDrive className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Local-First &amp; Air-Gapped (Ollama)</h3>
                  <p className="text-xs text-[#9DA2B3] leading-relaxed mb-4">
                    Run 100% offline with native local GGUF models (Llama 3.2, Mistral, Qwen 2.5) with automatic fallback chains when cloud quota or internet connectivity is constrained.
                  </p>
                </div>
                <button
                  onClick={() => openConsoleWithTab('platforms')}
                  className="text-xs font-mono font-semibold text-[#3D5A80] flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <span>Configure Ollama Hub</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Feature 5: Omnichannel Gateways */}
              <div className="p-6 rounded-3xl bg-[#15171F] border border-[#262A36] hover:border-[#2A9D8F]/50 transition-all flex flex-col justify-between group">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-[#2A9D8F]/15 border border-[#2A9D8F]/30 flex items-center justify-center text-[#2A9D8F] mb-5 group-hover:scale-110 transition-transform">
                    <Radio className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Omnichannel Webhook Gateways</h3>
                  <p className="text-xs text-[#9DA2B3] leading-relaxed mb-4">
                    Sync memories and trigger swarms directly from Telegram bots (/remember, /recall), Discord rich embeds, and Slack Block Kit cards with centralized audit logs.
                  </p>
                </div>
                <button
                  onClick={() => openConsoleWithTab('platforms')}
                  className="text-xs font-mono font-semibold text-[#2A9D8F] flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <span>Test Webhooks</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Feature 6: Production Observability */}
              <div className="p-6 rounded-3xl bg-[#15171F] border border-[#262A36] hover:border-[#588157]/50 transition-all flex flex-col justify-between group">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-[#588157]/15 border border-[#588157]/30 flex items-center justify-center text-[#588157] mb-5 group-hover:scale-110 transition-transform">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Hardened Observability</h3>
                  <p className="text-xs text-[#9DA2B3] leading-relaxed mb-4">
                    FastAPI request-tracing middleware, distributed X-Request-ID headers, p95 latency aggregators, and structured JSON logs outputted to file &amp; stdout sinks.
                  </p>
                </div>
                <a
                  href="/api/metrics"
                  target="_blank"
                  className="text-xs font-mono font-semibold text-[#588157] flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <span>View /api/metrics Endpoint</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </section>

          {/* 5. INTERACTIVE LIVE DEEP-DIVE SECTION */}
          <section id="interactive-deepdive" className="py-20 px-4 sm:px-8 bg-[#12141A] border-y border-[#22252E]">
            <div className="max-w-7xl mx-auto w-full space-y-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#E76F51]/15 text-[#E76F51] border border-[#E76F51]/30">
                    INTERACTIVE LAB
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
                    Experience the Cognitive Modules Live
                  </h2>
                </div>

                {/* Sub-tab pills */}
                <div className="flex items-center gap-1.5 bg-[#1B1D25] p-1 rounded-2xl border border-[#2E3342] text-xs font-medium">
                  <button
                    onClick={() => setActiveFeatureTab('swarm')}
                    className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeFeatureTab === 'swarm'
                        ? 'bg-[#E76F51] text-white shadow-xs font-semibold'
                        : 'text-[#8C90A0] hover:text-white'
                    }`}
                  >
                    <Kanban className="w-3.5 h-3.5" />
                    <span>Swarm Kanban</span>
                  </button>
                  <button
                    onClick={() => setActiveFeatureTab('graph')}
                    className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeFeatureTab === 'graph'
                        ? 'bg-[#588157] text-white shadow-xs font-semibold'
                        : 'text-[#8C90A0] hover:text-white'
                    }`}
                  >
                    <Network className="w-3.5 h-3.5" />
                    <span>D3 Vector Graph</span>
                  </button>
                  <button
                    onClick={() => setActiveFeatureTab('platforms')}
                    className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeFeatureTab === 'platforms'
                        ? 'bg-[#3D5A80] text-white shadow-xs font-semibold'
                        : 'text-[#8C90A0] hover:text-white'
                    }`}
                  >
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Local &amp; Platforms</span>
                  </button>
                </div>
              </div>

              {/* Module Frame */}
              <div className="h-[580px] bg-[#161820] rounded-3xl border border-[#292D3B] p-4 overflow-hidden shadow-2xl flex flex-col">
                {activeFeatureTab === 'swarm' && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <SwarmKanban
                      sessionId="landing_demo"
                      onSendToChat={(prompt) => openConsoleWithTab('chat')}
                    />
                  </div>
                )}

                {activeFeatureTab === 'graph' && (
                  <div className="flex-1 flex flex-col overflow-hidden bg-[#0F1117] rounded-2xl border border-[#222530] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-[#588157] font-semibold">
                        Dynamic Associative Memory Topology (D3.js Force Physics)
                      </span>
                      <span className="text-[10px] text-[#8C90A0] font-mono">Drag nodes to test semantic clustering</span>
                    </div>
                    <div className="flex-1 rounded-xl overflow-hidden">
                      <MemorySemanticGraph
                        onQueryInChat={() => openConsoleWithTab('chat')}
                        onSelectMemory={() => openConsoleWithTab('chat')}
                      />
                    </div>
                  </div>
                )}

                {activeFeatureTab === 'platforms' && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <LocalAndPlatforms
                      sessionId="landing_demo"
                      onSendToChat={(text) => openConsoleWithTab('chat')}
                    />
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 6. TECH STACK BADGES */}
          <section id="tech-stack" className="py-16 px-4 sm:px-8 max-w-7xl mx-auto w-full">
            <div className="text-center mb-10">
              <span className="text-xs font-mono text-[#8C90A0] uppercase tracking-widest">
                Built with Modern, Battle-Tested Open Standards
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 max-w-4xl mx-auto">
              {[
                { name: 'Python 3.11+', role: 'Backend & Async Engine', color: '#3776AB' },
                { name: 'Next.js 15 App Router', role: 'Full-Stack React Framework', color: '#FFFFFF' },
                { name: 'Google Gemini 2.5 / 3.5', role: 'High-Reasoning Cloud LLM', color: '#4285F4' },
                { name: 'Ollama GGUF', role: 'Local & Air-Gapped Daemon', color: '#FF6B6B' },
                { name: 'FastAPI & Starlette', role: 'High-Throughput ASGI Core', color: '#009688' },
                { name: 'ChromaDB / Vector Index', role: 'Cosine Similarity Store', color: '#E76F51' },
                { name: 'D3.js v7', role: 'Force-Directed Graph Physics', color: '#F9A03F' },
                { name: 'Tailwind CSS v4', role: 'Design System & Motion', color: '#38BDF8' },
                { name: 'Telegram / Discord / Slack', role: 'Omnichannel Webhooks', color: '#2A9D8F' },
              ].map((tech, idx) => (
                <div
                  key={idx}
                  className="px-4 py-2.5 rounded-2xl bg-[#15171F] border border-[#282C38] flex items-center gap-2.5 hover:border-[#588157]/50 transition-colors shadow-xs"
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tech.color }} />
                  <span className="text-xs font-semibold text-white">{tech.name}</span>
                  <span className="text-[10px] font-mono text-[#8C90A0] hidden sm:inline">({tech.role})</span>
                </div>
              ))}
            </div>
          </section>

          {/* 7. DEPLOY IN 1-CLICK SECTION */}
          <section id="deploy" className="py-20 px-4 sm:px-8 bg-[#12141A] border-t border-[#22252E]">
            <div className="max-w-7xl mx-auto w-full text-center space-y-10">
              <div className="max-w-2xl mx-auto space-y-3">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#588157]/15 text-[#588157] border border-[#588157]/30">
                  INSTANT DEPLOYMENT
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                  Deploy to Production in Under 60 Seconds
                </h2>
                <p className="text-sm text-[#9DA2B3]">
                  Host on your private cloud, sovereign server, or edge container with automated Docker templates.
                </p>
              </div>

              {/* 1-Click Platform Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
                <a
                  href="https://render.com/deploy"
                  target="_blank"
                  rel="noreferrer"
                  className="p-4 rounded-2xl bg-[#171922] border border-[#2B2F3D] hover:border-[#588157] flex flex-col items-center justify-center gap-2 group transition-all cursor-pointer"
                >
                  <span className="text-sm font-bold text-white group-hover:text-[#588157] transition-colors">
                    Deploy to Render
                  </span>
                  <span className="text-[10px] text-[#8C90A0] font-mono">1-Click Blueprint</span>
                </a>

                <a
                  href="https://railway.app/new"
                  target="_blank"
                  rel="noreferrer"
                  className="p-4 rounded-2xl bg-[#171922] border border-[#2B2F3D] hover:border-[#E76F51] flex flex-col items-center justify-center gap-2 group transition-all cursor-pointer"
                >
                  <span className="text-sm font-bold text-white group-hover:text-[#E76F51] transition-colors">
                    Deploy on Railway
                  </span>
                  <span className="text-[10px] text-[#8C90A0] font-mono">Auto-provisioned Redis &amp; DB</span>
                </a>

                <a
                  href="https://huggingface.co/spaces"
                  target="_blank"
                  rel="noreferrer"
                  className="p-4 rounded-2xl bg-[#171922] border border-[#2B2F3D] hover:border-[#D4A373] flex flex-col items-center justify-center gap-2 group transition-all cursor-pointer"
                >
                  <span className="text-sm font-bold text-white group-hover:text-[#D4A373] transition-colors">
                    Run in Hugging Face
                  </span>
                  <span className="text-[10px] text-[#8C90A0] font-mono">Docker Space Demo</span>
                </a>

                <a
                  href="https://vercel.com/new"
                  target="_blank"
                  rel="noreferrer"
                  className="p-4 rounded-2xl bg-[#171922] border border-[#2B2F3D] hover:border-white flex flex-col items-center justify-center gap-2 group transition-all cursor-pointer"
                >
                  <span className="text-sm font-bold text-white group-hover:text-white transition-colors">
                    Deploy with Vercel
                  </span>
                  <span className="text-[10px] text-[#8C90A0] font-mono">Edge-Accelerated SPA</span>
                </a>
              </div>

              {/* Docker Single Liner */}
              <div className="max-w-2xl mx-auto p-4 bg-[#161820] border border-[#292D3B] rounded-2xl flex items-center justify-between font-mono text-xs text-[#A6ACCD]">
                <div className="flex items-center gap-2 overflow-x-auto">
                  <span className="text-[#588157]">$</span>
                  <span>docker run -p 3000:3000 memora/sovereign-agent:latest</span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('docker run -p 3000:3000 memora/sovereign-agent:latest');
                  }}
                  className="ml-3 p-1.5 hover:bg-[#252936] rounded text-[#8C90A0] hover:text-white transition-colors cursor-pointer shrink-0"
                  title="Copy docker command"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          </section>

          {/* 8. VIRAL CALL-TO-ACTION & OPEN SOURCE COMMUNITY */}
          <section className="py-24 px-4 sm:px-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-[#12141A] to-[#0E1015]" />
            <div className="relative z-10 max-w-4xl mx-auto text-center space-y-8">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#588157] to-[#2A9D8F] flex items-center justify-center text-white mx-auto shadow-2xl shadow-[#588157]/30">
                <Brain className="w-8 h-8" />
              </div>

              <h2 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
                Build the Next Generation of Sovereign Agent Intelligence
              </h2>

              <p className="text-base text-[#9DA2B3] max-w-2xl mx-auto">
                Memora is 100% open-source, enterprise-hardened, and ready for developer customization. Star the repository, connect your local Ollama models, and deploy your autonomous workforce today.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                <button
                  onClick={() => openConsoleWithTab('chat')}
                  className="px-7 py-3.5 bg-[#588157] hover:bg-[#476a46] text-white text-sm font-semibold rounded-2xl shadow-xl shadow-[#588157]/30 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Layers className="w-4 h-4" />
                  <span>Launch Memora Cockpit</span>
                </button>

                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noreferrer"
                  className="px-6 py-3.5 bg-[#1C1F28] hover:bg-[#262B38] text-white text-sm font-semibold rounded-2xl border border-[#2E3342] flex items-center gap-2 transition-colors"
                >
                  <Github className="w-4 h-4" />
                  <span>Star on GitHub</span>
                </a>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* 9. GLOBAL FOOTER */}
      <footer className="border-t border-[#22252E] bg-[#0A0C10] py-10 px-4 sm:px-8 text-xs text-[#7A7F90]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-[#588157] flex items-center justify-center text-white text-xs font-bold">
              M
            </div>
            <span className="font-bold text-white">Memora Platform</span>
            <span>— MIT Licensed &amp; Open Source</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
              GitHub
            </a>
            <a href="https://discord.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
              Discord
            </a>
            <a href="/api/metrics" target="_blank" className="hover:text-white transition-colors font-mono">
              /api/metrics
            </a>
            <a href="/healthz" target="_blank" className="hover:text-white transition-colors font-mono">
              /healthz
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
