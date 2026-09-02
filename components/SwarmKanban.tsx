'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Kanban,
  Bot,
  Cpu,
  Zap,
  Clock,
  CheckCircle2,
  Play,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Database,
  Calculator,
  Search,
  Code2,
  Check,
  Copy,
  ChevronRight,
  X,
  AlertCircle,
  MessageSquare,
  BookmarkPlus,
} from 'lucide-react';
import { SwarmPlan, SwarmTask, WorkerAgent, TaskStatus, WorkerRole } from '@/lib/memora/swarm';

interface SwarmKanbanProps {
  sessionId?: string;
  onSendToChat?: (text: string) => void;
  onInjectMemory?: (text: string) => void;
}

const PRESET_GOALS = [
  'Analyze Memora Vector Memory architecture, calculate latency overhead for 100k queries, and synthesize deployment recommendations.',
  'Research vector quantization strategies (SQ8 vs PQ), calculate RAM footprint reduction, and format production specifications.',
  'Retrieve user profile directives, search best practices for offline-first agent swarms, and format an implementation roadmap.',
  'Evaluate multi-currency API conversion rates, calculate operational costs with 15% margin, and generate a validated billing schema.',
];

const AGENT_ICONS: Record<WorkerRole, React.ReactNode> = {
  researcher: <Search className="w-3.5 h-3.5" />,
  calculator: <Calculator className="w-3.5 h-3.5" />,
  memory_specialist: <Database className="w-3.5 h-3.5" />,
  coder: <Code2 className="w-3.5 h-3.5" />,
  synthesizer: <Bot className="w-3.5 h-3.5" />,
};

const COLUMN_CONFIG: { id: TaskStatus; title: string; subtitle: string; color: string; bg: string; border: string }[] = [
  {
    id: 'backlog',
    title: 'Backlog / Planned',
    subtitle: 'Awaiting dependency resolution',
    color: '#8A817C',
    bg: '#F8F5F2',
    border: '#E6E2DE',
  },
  {
    id: 'in_progress',
    title: 'In Progress',
    subtitle: 'Worker agent executing tool',
    color: '#D4A373',
    bg: '#FEFAE033',
    border: '#D4A37366',
  },
  {
    id: 'review',
    title: 'Review & Validation',
    subtitle: 'Artifact quality verification',
    color: '#3D5A80',
    bg: '#3D5A800D',
    border: '#3D5A8033',
  },
  {
    id: 'completed',
    title: 'Completed',
    subtitle: 'Synthesized & ready',
    color: '#588157',
    bg: '#5881570D',
    border: '#58815733',
  },
];

export default function SwarmKanban({
  sessionId = 'default',
  onSendToChat,
  onInjectMemory,
}: SwarmKanbanProps) {
  const [plans, setPlans] = useState<SwarmPlan[]>([]);
  const [activePlan, setActivePlan] = useState<SwarmPlan | null>(null);
  const [agents, setAgents] = useState<WorkerAgent[]>([]);
  const [goalInput, setGoalInput] = useState<string>('');
  const [isDecomposing, setIsDecomposing] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = activePlan?.tasks.find((t) => t.id === selectedTaskId) || null;
  const setSelectedTask = (task: SwarmTask | null) => setSelectedTaskId(task ? task.id : null);
  const [copiedSynthesis, setCopiedSynthesis] = useState<boolean>(false);
  const [injectedMemoryId, setInjectedMemoryId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Fetch all plans and worker agents on demand
  const fetchPlansAndAgents = useCallback(async () => {
    try {
      const [plansRes, agentsRes] = await Promise.all([
        fetch('/api/swarm/plans'),
        fetch('/api/swarm/agents'),
      ]);

      if (plansRes.ok) {
        const pData = await plansRes.json();
        setPlans(pData.plans || []);
        if (pData.plans && pData.plans.length > 0) {
          setActivePlan((prev) => {
            if (!prev) return pData.plans[0];
            const updated = pData.plans.find((p: SwarmPlan) => p.id === prev.id);
            return updated || pData.plans[0];
          });
        }
      }

      if (agentsRes.ok) {
        const aData = await agentsRes.json();
        setAgents(aData.agents || []);
      }
    } catch {
      // silent fallback
    }
  }, []);

  // Initial load
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [plansRes, agentsRes] = await Promise.all([
          fetch('/api/swarm/plans'),
          fetch('/api/swarm/agents'),
        ]);

        if (plansRes.ok && isMounted) {
          const pData = await plansRes.json();
          setPlans(pData.plans || []);
          if (pData.plans && pData.plans.length > 0) {
            setActivePlan(pData.plans[0]);
          }
        }

        if (agentsRes.ok && isMounted) {
          const aData = await agentsRes.json();
          setAgents(aData.agents || []);
        }
      } catch {
        // silent fallback
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle Goal Decomposition (Hermes Orchestrator)
  const handleDecompose = async (goalToUse?: string) => {
    const goal = (goalToUse || goalInput).trim();
    if (!goal) return;

    setIsDecomposing(true);
    setStatusMessage('Hermes Orchestrator analyzing query and decomposing sub-tasks...');
    try {
      const res = await fetch('/api/swarm/decompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, session_id: sessionId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Decomposition failed');
      }

      const data = await res.json();
      if (data.plan) {
        setPlans((prev) => [data.plan, ...prev]);
        setActivePlan(data.plan);
        setStatusMessage(`Successfully generated ${data.plan.tasks.length} structured sub-tasks with dependency graph!`);
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsDecomposing(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  // Handle Parallel Swarm Execution
  const handleExecuteSwarm = async () => {
    if (!activePlan) return;

    setIsExecuting(true);
    setStatusMessage('Dispatched parallel Worker Agents across dependency graph...');
    try {
      const res = await fetch('/api/swarm/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: activePlan.id }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Execution failed');
      }

      const data = await res.json();
      if (data.plan) {
        setActivePlan(data.plan);
        setPlans((prev) => prev.map((p) => (p.id === data.plan.id ? data.plan : p)));
        setStatusMessage(
          `Swarm completed in ${data.plan.totalExecutionTimeMs || 'N/A'}ms! Hermes final synthesis synthesized.`
        );
        fetchPlansAndAgents();
      }
    } catch (err: any) {
      setStatusMessage(`Execution Error: ${err.message}`);
    } finally {
      setIsExecuting(false);
      setTimeout(() => setStatusMessage(null), 6000);
    }
  };

  // Run a single task
  const handleExecuteSingleTask = async (taskId: string) => {
    if (!activePlan) return;

    setRunningTaskId(taskId);
    try {
      const res = await fetch('/api/swarm/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: activePlan.id, task_id: taskId }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.plan) {
          setActivePlan(data.plan);
          setPlans((prev) => prev.map((p) => (p.id === data.plan.id ? data.plan : p)));
        }
      }
    } catch {
      // ignore
    } finally {
      setRunningTaskId(null);
      fetchPlansAndAgents();
    }
  };

  // Update task status (Manual Kanban advancement)
  const handleUpdateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    if (!activePlan) return;

    try {
      const res = await fetch(`/api/swarm/plans/${activePlan.id}/task`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, status: newStatus }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.plan) {
          setActivePlan(data.plan);
          setPlans((prev) => prev.map((p) => (p.id === data.plan.id ? data.plan : p)));
        }
      }
    } catch {
      // ignore
    }
  };

  // Inject Synthesis into Memory Store
  const handleInjectSynthesisToMemory = async () => {
    if (!activePlan || !activePlan.finalSynthesis) return;

    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Swarm Synthesis [${activePlan.goal}]: ${activePlan.finalSynthesis}`,
          metadata: {
            source: 'Hermes_MultiAgent_Swarm',
            category: 'Strategy',
            plan_id: activePlan.id,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setInjectedMemoryId(data.id);
        setStatusMessage(`Executive synthesis saved into Vector Memory (ID: ${data.id})!`);
        setTimeout(() => setInjectedMemoryId(null), 4000);
      }
    } catch (err: any) {
      setStatusMessage(`Memory Save Error: ${err.message}`);
    }
  };

  const handleCopySynthesis = () => {
    if (activePlan?.finalSynthesis) {
      navigator.clipboard.writeText(activePlan.finalSynthesis);
      setCopiedSynthesis(true);
      setTimeout(() => setCopiedSynthesis(false), 2000);
    }
  };

  // Calculate stats for active plan
  const completedTasksCount = activePlan?.tasks.filter((t) => t.status === 'completed').length || 0;
  const totalTasksCount = activePlan?.tasks.length || 0;
  const progressPercent = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FDFBF7]">
      {/* TOP CONTROL BAR: TASK DECOMPOSER */}
      <div className="p-4 border-b border-[#E6E2DE] bg-white shrink-0 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#5881571A] text-[#588157] rounded-lg">
              <Kanban className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#2D2D2A] flex items-center gap-2">
                Hermes Multi-Agent Swarm Orchestrator
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-[#58815715] text-[#588157] border border-[#58815733] rounded-full">
                  Part 3: Swarm
                </span>
              </h2>
              <p className="text-[11px] text-[#8A817C]">
                Hierarchical Task Decomposition &amp; Parallel Worker Agent Execution
              </p>
            </div>
          </div>

          {/* Plan Selector & Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {plans.length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F8F5F2] border border-[#E6E2DE] rounded-xl text-xs">
                <span className="text-[#8A817C] text-[11px]">Plan:</span>
                <select
                  value={activePlan?.id || ''}
                  onChange={(e) => {
                    const found = plans.find((p) => p.id === e.target.value);
                    if (found) setActivePlan(found);
                  }}
                  className="bg-transparent text-xs font-semibold text-[#2D2D2A] focus:outline-hidden cursor-pointer max-w-[180px] truncate"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.goal.slice(0, 32)}... ({p.status})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleExecuteSwarm}
              disabled={isExecuting || !activePlan || activePlan.status === 'executing'}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer ${
                isExecuting
                  ? 'bg-[#D4A373] text-white animate-pulse'
                  : activePlan?.status === 'completed'
                  ? 'bg-[#588157] text-white hover:bg-[#476a46]'
                  : 'bg-[#3C3C3B] text-white hover:bg-[#2D2D2A]'
              }`}
            >
              <Play className={`w-3.5 h-3.5 ${isExecuting ? 'animate-spin' : ''}`} />
              <span>{isExecuting ? 'Swarm Executing...' : 'Execute Swarm'}</span>
            </button>

            <button
              onClick={fetchPlansAndAgents}
              className="p-2 text-[#8A817C] hover:text-[#2D2D2A] hover:bg-[#F8F5F2] rounded-xl border border-[#E6E2DE] transition-colors cursor-pointer"
              title="Refresh Swarm State"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Query Input Bar for Task Decomposer */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <input
              type="text"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleDecompose();
              }}
              placeholder="Input high-level mission or prompt to decompose (e.g. Analyze vector latency & compute memory cost)..."
              className="w-full pl-9 pr-4 py-2 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl text-xs text-[#2D2D2A] focus:outline-hidden focus:ring-1 focus:ring-[#A3B18A]"
            />
            <Sparkles className="w-4 h-4 text-[#D4A373] absolute left-3 top-2.5 pointer-events-none" />
          </div>
          <button
            onClick={() => handleDecompose()}
            disabled={isDecomposing || !goalInput.trim()}
            className="px-4 py-2 bg-[#588157] hover:bg-[#466845] disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-xs"
          >
            <Cpu className={`w-3.5 h-3.5 ${isDecomposing ? 'animate-spin' : ''}`} />
            <span>{isDecomposing ? 'Decomposing...' : 'Decompose Goal'}</span>
          </button>
        </div>

        {/* Preset Prompt Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] text-[#8A817C] no-scrollbar">
          <span className="shrink-0 font-medium">Presets:</span>
          {PRESET_GOALS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setGoalInput(preset);
                handleDecompose(preset);
              }}
              className="shrink-0 px-2.5 py-0.5 bg-[#F8F5F2] hover:bg-white border border-[#E6E2DE] rounded-lg text-[#555] transition-colors cursor-pointer text-left truncate max-w-[280px]"
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Status Notification Banner if active */}
        {statusMessage && (
          <div className="p-2 bg-[#58815712] border border-[#58815733] text-[#588157] text-xs rounded-xl flex items-center justify-between">
            <span className="font-medium">{statusMessage}</span>
            <button onClick={() => setStatusMessage(null)} className="text-[#588157] hover:opacity-75">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ACTIVE PLAN METADATA & WORKER AGENT ROSTER */}
      <div className="px-4 py-2.5 bg-[#F8F5F2] border-b border-[#E6E2DE] shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Active Goal Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase text-[#8A817C] tracking-wider">Active Mission</span>
              <span
                className={`px-2 py-0.2 rounded-full text-[10px] font-semibold ${
                  activePlan?.status === 'completed'
                    ? 'bg-[#58815715] text-[#588157] border border-[#58815733]'
                    : activePlan?.status === 'executing'
                    ? 'bg-[#D4A37320] text-[#D4A373] border border-[#D4A37344]'
                    : 'bg-[#3D5A8015] text-[#3D5A80] border border-[#3D5A8033]'
                }`}
              >
                {activePlan?.status?.toUpperCase() || 'IDLE'}
              </span>
              {activePlan?.totalExecutionTimeMs && (
                <span className="text-[11px] font-mono text-[#8A817C] flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {activePlan.totalExecutionTimeMs}ms total
                </span>
              )}
            </div>
            <p className="text-xs text-[#2D2D2A] font-medium truncate mt-0.5">
              {activePlan?.goal || 'No active plan selected. Use prompt bar above to decompose a goal.'}
            </p>
          </div>

          {/* Progress Bar & Worker Avatars */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-[#8A817C]">Subtasks:</span>
                <span className="font-semibold text-[#2D2D2A]">
                  {completedTasksCount} / {totalTasksCount} ({progressPercent}%)
                </span>
              </div>
              <div className="w-32 h-1.5 bg-[#E6E2DE] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#588157] transition-all duration-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Specialized Worker Agent Pills */}
            <div className="hidden sm:flex items-center gap-1.5 pl-3 border-l border-[#E6E2DE]">
              {agents.map((ag) => (
                <div
                  key={ag.id}
                  title={`${ag.name} (${ag.role}): ${ag.specialization}`}
                  className="flex items-center gap-1 px-2 py-1 bg-white border border-[#E6E2DE] rounded-lg text-[11px]"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: ag.avatarColor }}
                  />
                  <span className="font-medium text-[#444]">{ag.name.replace(' Agent', '')}</span>
                  {ag.status === 'busy' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D4A373] animate-ping" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* HERMES KANBAN BOARD (4 COLUMNS) */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 bg-[#FDFBF7]">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-full min-w-[900px]">
          {COLUMN_CONFIG.map((col) => {
            const columnTasks = activePlan?.tasks.filter((t) => t.status === col.id) || [];

            return (
              <div
                key={col.id}
                className="flex flex-col h-full rounded-2xl border bg-white shadow-2xs overflow-hidden"
                style={{ borderColor: col.border }}
              >
                {/* Column Header */}
                <div
                  className="p-3 border-b flex items-center justify-between"
                  style={{ backgroundColor: col.bg, borderColor: col.border }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#2D2D2A]">{col.title}</span>
                      <span
                        className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold"
                        style={{ color: col.color, backgroundColor: `${col.color}22` }}
                      >
                        {columnTasks.length}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#8A817C] truncate mt-0.5">{col.subtitle}</p>
                  </div>

                  {col.id === 'in_progress' && isExecuting && (
                    <Zap className="w-4 h-4 text-[#D4A373] animate-bounce" />
                  )}
                  {col.id === 'completed' && (
                    <CheckCircle2 className="w-4 h-4 text-[#588157]" />
                  )}
                </div>

                {/* Task Cards List */}
                <div className="flex-1 p-2.5 overflow-y-auto space-y-2.5">
                  {columnTasks.length === 0 ? (
                    <div className="h-28 flex items-center justify-center border border-dashed border-[#E6E2DE] rounded-xl text-[11px] text-[#8A817C]">
                      No tasks in this lane
                    </div>
                  ) : (
                    columnTasks.map((task) => {
                      const isRunning = runningTaskId === task.id;
                      const hasDependencies = task.dependsOn.length > 0;
                      const depsCompleted = task.dependsOn.every(
                        (dId) => activePlan?.tasks.find((t) => t.id === dId)?.status === 'completed'
                      );

                      return (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTask(task)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer bg-white hover:shadow-xs space-y-2 ${
                            selectedTask?.id === task.id
                              ? 'border-[#588157] ring-1 ring-[#58815733]'
                              : 'border-[#E6E2DE] hover:border-[#D4A373]'
                          }`}
                        >
                          {/* Task Header: ID & Assigned Agent */}
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold text-[#8A817C]">
                              {task.id}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span
                                className="px-2 py-0.5 rounded-md text-[10px] font-medium flex items-center gap-1 text-white"
                                style={{
                                  backgroundColor:
                                    agents.find((a) => a.id === task.assignedAgent)?.avatarColor || '#588157',
                                }}
                              >
                                {AGENT_ICONS[task.assignedAgent]}
                                <span>{task.assignedAgent.replace('_', ' ')}</span>
                              </span>
                            </div>
                          </div>

                          {/* Task Title & Description */}
                          <div>
                            <h4 className="text-xs font-semibold text-[#2D2D2A] leading-tight">
                              {task.title}
                            </h4>
                            <p className="text-[11px] text-[#8A817C] line-clamp-2 mt-1 leading-snug">
                              {task.description}
                            </p>
                          </div>

                          {/* Dependencies & Badges */}
                          <div className="flex flex-wrap items-center gap-1 text-[10px]">
                            {hasDependencies && (
                              <span
                                className={`px-1.5 py-0.5 rounded-md font-mono ${
                                  depsCompleted
                                    ? 'bg-[#58815715] text-[#588157]'
                                    : 'bg-[#D4A37315] text-[#D4A373]'
                                }`}
                              >
                                Depends: {task.dependsOn.join(', ')}
                              </span>
                            )}
                            {task.toolUsed && (
                              <span className="px-1.5 py-0.5 bg-[#F8F5F2] border border-[#E6E2DE] rounded-md font-mono text-[#555]">
                                Tool: {task.toolUsed}
                              </span>
                            )}
                            {task.executionTimeMs !== undefined && (
                              <span className="px-1.5 py-0.5 bg-[#F8F5F2] border border-[#E6E2DE] rounded-md font-mono text-[#8A817C]">
                                {task.executionTimeMs}ms
                              </span>
                            )}
                          </div>

                          {/* Action Footer on Card */}
                          <div className="pt-1.5 border-t border-[#F2EFEA] flex items-center justify-between text-[10px]">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTask(task);
                              }}
                              className="text-[#588157] font-semibold hover:underline flex items-center gap-0.5"
                            >
                              <span>Inspect</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>

                            <div className="flex items-center gap-1">
                              {task.status !== 'completed' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleExecuteSingleTask(task.id);
                                  }}
                                  disabled={isRunning}
                                  className="px-2 py-0.5 bg-[#F8F5F2] hover:bg-[#588157] hover:text-white rounded border border-[#E6E2DE] text-[#444] transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <Play className="w-2.5 h-2.5" />
                                  <span>{isRunning ? 'Running...' : 'Run'}</span>
                                </button>
                              )}

                              {/* Advance Button */}
                              {task.status === 'backlog' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateTaskStatus(task.id, 'in_progress');
                                  }}
                                  className="px-1.5 py-0.5 bg-[#FEFAE0] hover:bg-[#D4A373] hover:text-white rounded text-[#8A817C] transition-colors"
                                  title="Move to In Progress"
                                >
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                              {task.status === 'in_progress' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateTaskStatus(task.id, 'review');
                                  }}
                                  className="px-1.5 py-0.5 bg-[#3D5A8015] hover:bg-[#3D5A80] hover:text-white rounded text-[#3D5A80] transition-colors"
                                  title="Move to Review"
                                >
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                              {task.status === 'review' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateTaskStatus(task.id, 'completed');
                                  }}
                                  className="px-1.5 py-0.5 bg-[#58815715] hover:bg-[#588157] hover:text-white rounded text-[#588157] transition-colors"
                                  title="Mark Completed"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FINAL SYNTHESIS DRAWER / FOOTER */}
      {activePlan?.finalSynthesis && (
        <div className="p-4 border-t border-[#E6E2DE] bg-white shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-[#588157]" />
              <h3 className="text-xs font-bold text-[#2D2D2A]">
                Hermes Final Synthesis &amp; Cross-Agent Report
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopySynthesis}
                className="px-2.5 py-1 bg-[#F8F5F2] hover:bg-[#E6E2DE] text-[#2D2D2A] text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              >
                {copiedSynthesis ? <Check className="w-3 h-3 text-[#588157]" /> : <Copy className="w-3 h-3" />}
                <span>{copiedSynthesis ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={handleInjectSynthesisToMemory}
                className="px-2.5 py-1 bg-[#58815715] hover:bg-[#588157] hover:text-white text-[#588157] text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              >
                <BookmarkPlus className="w-3 h-3" />
                <span>{injectedMemoryId ? 'Saved to Memory!' : 'Save into Vector Memory'}</span>
              </button>
              {onSendToChat && (
                <button
                  onClick={() => onSendToChat(`Discuss swarm findings: ${activePlan.finalSynthesis}`)}
                  className="px-2.5 py-1 bg-[#3C3C3B] hover:bg-[#2D2D2A] text-white text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>Discuss in Chat</span>
                </button>
              )}
            </div>
          </div>
          <div className="p-3 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl text-xs text-[#2D2D2A] max-h-36 overflow-y-auto leading-relaxed whitespace-pre-wrap font-sans">
            {activePlan.finalSynthesis}
          </div>
        </div>
      )}

      {/* TASK INSPECTOR MODAL / DRAWER */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border border-[#E6E2DE] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#E6E2DE] flex items-center justify-between bg-[#FDFBF7]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-[#8A817C]">{selectedTask.id}</span>
                <span
                  className="px-2 py-0.5 rounded text-[11px] font-medium text-white flex items-center gap-1"
                  style={{
                    backgroundColor:
                      agents.find((a) => a.id === selectedTask.assignedAgent)?.avatarColor || '#588157',
                  }}
                >
                  {AGENT_ICONS[selectedTask.assignedAgent]}
                  <span>{selectedTask.assignedAgent.replace('_', ' ')}</span>
                </span>
                <span className="text-xs font-semibold text-[#2D2D2A] truncate max-w-sm">
                  {selectedTask.title}
                </span>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="p-1 text-[#8A817C] hover:text-[#2D2D2A] rounded-lg hover:bg-[#F8F5F2]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#8A817C]">Mission Directive</label>
                <p className="text-xs text-[#2D2D2A] mt-1 font-medium bg-[#F8F5F2] p-2.5 rounded-xl border border-[#E6E2DE]">
                  {selectedTask.description}
                </p>
              </div>

              {/* Status & Execution Info */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-2.5 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl">
                  <span className="text-[10px] font-mono text-[#8A817C]">Status</span>
                  <p className="font-semibold text-xs text-[#2D2D2A] capitalize mt-0.5">
                    {selectedTask.status}
                  </p>
                </div>
                <div className="p-2.5 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl">
                  <span className="text-[10px] font-mono text-[#8A817C]">Tool Used</span>
                  <p className="font-mono text-xs text-[#588157] font-semibold mt-0.5">
                    {selectedTask.toolUsed || 'None yet'}
                  </p>
                </div>
                <div className="p-2.5 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl">
                  <span className="text-[10px] font-mono text-[#8A817C]">Execution Time</span>
                  <p className="font-mono text-xs text-[#2D2D2A] font-semibold mt-0.5">
                    {selectedTask.executionTimeMs !== undefined ? `${selectedTask.executionTimeMs} ms` : 'Pending'}
                  </p>
                </div>
              </div>

              {/* Task Input Payload */}
              <div>
                <label className="text-[10px] font-mono uppercase text-[#8A817C]">Input Parameters</label>
                <pre className="p-2.5 bg-[#F8F5F2] border border-[#E6E2DE] rounded-xl font-mono text-[11px] text-[#333] overflow-x-auto mt-1">
                  {JSON.stringify(selectedTask.input, null, 2)}
                </pre>
              </div>

              {/* Output Artifact */}
              {selectedTask.output && (
                <div>
                  <label className="text-[10px] font-mono uppercase text-[#588157] font-bold">
                    Worker Output &amp; Analysis
                  </label>
                  {selectedTask.output.agentAnalysis && (
                    <div className="p-3 bg-[#5881570D] border border-[#58815733] rounded-xl text-xs text-[#2D2D2A] leading-relaxed mb-2 whitespace-pre-wrap">
                      {selectedTask.output.agentAnalysis}
                    </div>
                  )}
                  <pre className="p-2.5 bg-[#FDFBF7] border border-[#E6E2DE] rounded-xl font-mono text-[11px] text-[#333] overflow-x-auto max-h-48">
                    {JSON.stringify(selectedTask.output, null, 2)}
                  </pre>
                </div>
              )}

              {/* Execution Logs */}
              <div>
                <label className="text-[10px] font-mono uppercase text-[#8A817C]">Execution Audit Logs</label>
                <div className="p-2.5 bg-[#2D2D2A] text-[#FDFBF7] rounded-xl font-mono text-[10px] space-y-1 mt-1 max-h-36 overflow-y-auto">
                  {selectedTask.logs.map((log, i) => (
                    <div key={i} className="text-[#A3B18A]">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-[#E6E2DE] bg-[#FDFBF7] flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#8A817C]">Move column:</span>
                <select
                  value={selectedTask.status}
                  onChange={(e) => handleUpdateTaskStatus(selectedTask.id, e.target.value as TaskStatus)}
                  className="px-2 py-1 bg-white border border-[#E6E2DE] rounded-lg text-xs font-semibold text-[#2D2D2A]"
                >
                  <option value="backlog">Backlog</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExecuteSingleTask(selectedTask.id)}
                  disabled={runningTaskId === selectedTask.id}
                  className="px-3 py-1.5 bg-[#588157] hover:bg-[#466845] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Play className="w-3 h-3" />
                  <span>{runningTaskId === selectedTask.id ? 'Executing...' : 'Re-run Task'}</span>
                </button>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="px-3 py-1.5 bg-[#F8F5F2] hover:bg-[#E6E2DE] text-[#2D2D2A] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
