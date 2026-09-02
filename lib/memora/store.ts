import { MemoryItem, ExperienceRecord, SkillProposal, UserModel } from './types';
import { getEmbedding, cosineDistance, cosineSimilarity } from './vector';

export interface GraphNode {
  id: string;
  text: string;
  category: string;
  source: string;
  timestamp?: string;
  degree?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  similarity: number;
  distance: number;
}

export interface SemanticGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  categories: string[];
}

// Initial memories to seed
const INITIAL_MEMORIES: Array<{ text: string; metadata: Record<string, any> }> = [
  {
    text: 'User preference: Preferred morning beverage is fresh ginger tea with raw honey.',
    metadata: { source: 'Chat_History_092', category: 'Preference' },
  },
  {
    text: 'User preference: Prefers concise, markdown-formatted responses without marketing buzzwords.',
    metadata: { source: 'User_Settings', category: 'Preference' },
  },
  {
    text: 'User preference: Focus work hours are 08:00 to 12:00 UTC with quiet notifications.',
    metadata: { source: 'Calendar_Sync', category: 'Preference' },
  },
  {
    text: 'Project Context: Memora Foundation Stack runs with intelligent Agent Memory and Vector recall.',
    metadata: { source: 'Documentation_Upload', category: 'Project' },
  },
  {
    text: 'Core Strategy: Always prioritize clean vector index lookups and semantic recall.',
    metadata: { source: 'System_Directive', category: 'Strategy' },
  },
  {
    text: 'Architecture: Next.js App Router with server-side tool orchestration and client visualization.',
    metadata: { source: 'Architecture_RFC', category: 'Architecture' },
  },
  {
    text: 'Tool Registry: Dynamic skill discovery enables the agent to propose and integrate new functions.',
    metadata: { source: 'Plugin_Core', category: 'Skills' },
  },
  {
    text: 'Vector Space: High-dimensional embeddings scored using cosine similarity for associative recall.',
    metadata: { source: 'Vector_Spec', category: 'Vector' },
  },
  {
    text: 'Machine Learning: Semantic similarity clusters concepts into associative memory graphs.',
    metadata: { source: 'Research_Notes', category: 'AI/ML' },
  },
];

// Initial proposals
const INITIAL_PROPOSALS: SkillProposal[] = [
  {
    skill_name: 'text_formatter',
    description: 'Formats, transforms, and normalizes text (uppercase, lowercase, title case, slugify).',
    use_case: 'Automates string transformations and formatting for user queries.',
    example_queries: ['Format this text to uppercase: deep learning agent'],
    confidence_score: 0.9,
    tool_input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to format' },
        mode: { type: 'string', enum: ['upper', 'lower', 'title', 'slug'], description: 'Format mode' },
      },
      required: ['text'],
    },
    status: 'integrated',
    created_at: '2026-09-02T16:55:18.779842',
  },
  {
    skill_name: 'unit_converter',
    description: 'Converts metric and imperial measurements, temperatures, and currencies.',
    use_case: 'Provides deterministic physical and financial conversion calculations.',
    example_queries: ['Please convert 50 celsius to fahrenheit'],
    confidence_score: 0.92,
    tool_input_schema: {
      type: 'object',
      properties: {
        value: { type: 'number', description: 'Numerical amount' },
        from_unit: { type: 'string', description: 'Starting unit' },
        to_unit: { type: 'string', description: 'Desired unit' },
      },
      required: ['value', 'from_unit', 'to_unit'],
    },
    status: 'integrated',
    created_at: '2026-09-02T16:55:18.822400',
  },
  {
    skill_name: 'json_parser',
    description: 'Parses, validates, formats, and extracts fields from JSON data strings.',
    use_case: 'Simplifies JSON data manipulation and debugging.',
    example_queries: ['Can you parse and validate this json string'],
    confidence_score: 0.9,
    tool_input_schema: {
      type: 'object',
      properties: {
        json_string: { type: 'string', description: 'Raw JSON string' },
      },
      required: ['json_string'],
    },
    status: 'integrated',
    created_at: '2026-09-02T17:15:00.000000',
  },
];

// Initial experiences
const INITIAL_EXPERIENCES: ExperienceRecord[] = [
  {
    session_id: 'test-orchestrator-sess',
    user_query: 'Hello Memora!',
    agent_response: 'Hello! I am Memora, your intelligent AI agent. How can I help you today?',
    tool_used: null,
    tool_input: null,
    tool_result: null,
    success: true,
    timestamp: '2026-09-02T16:36:06.741385',
    feedback_score: null,
  },
  {
    session_id: 'test-cluster-sess',
    user_query: 'Please convert 50 celsius to fahrenheit',
    agent_response: '50 C is 122 F',
    tool_used: 'unit_converter',
    tool_input: { value: 50, from_unit: 'celsius', to_unit: 'fahrenheit' },
    tool_result: { converted_value: 122, status: 'success' },
    success: true,
    timestamp: '2026-09-02T16:53:17.887726',
    feedback_score: null,
  },
  {
    session_id: 'test-cluster-sess',
    user_query: 'Format this text to uppercase: deep learning agent',
    agent_response: 'DEEP LEARNING AGENT',
    tool_used: 'text_formatter',
    tool_input: { text: 'deep learning agent', mode: 'upper' },
    tool_result: { formatted_text: 'DEEP LEARNING AGENT', status: 'success' },
    success: true,
    timestamp: '2026-09-02T16:53:17.888157',
    feedback_score: null,
  },
];

// Initial user models
const INITIAL_USER_MODELS: Record<string, UserModel> = {
  'test-cluster-sess': {
    user_id: 'test-cluster-sess',
    preferences: {
      language: 'en',
      topics: ['math', 'formatting', 'unit conversion'],
      tool_preferences: {},
      preferred_tools: ['unit_converter', 'text_formatter'],
    },
    interaction_count: 2,
    avg_confidence: 1.0,
    last_seen: '2026-09-02T16:53:17.888157',
  },
  'test-orchestrator-sess': {
    user_id: 'test-orchestrator-sess',
    preferences: {
      language: 'en',
      topics: ['general'],
      tool_preferences: {},
      preferred_tools: [],
    },
    interaction_count: 1,
    avg_confidence: 1.0,
    last_seen: '2026-09-02T16:36:06.741385',
  },
};

class MemoryStore {
  private memories: MemoryItem[] = [];
  private experiences: ExperienceRecord[] = [...INITIAL_EXPERIENCES];
  private proposals: SkillProposal[] = [...INITIAL_PROPOSALS];
  private userModels: Record<string, UserModel> = { ...INITIAL_USER_MODELS };
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      if (this.memories.length > 0) return;
      for (const item of INITIAL_MEMORIES) {
        const embedding = await getEmbedding(item.text);
        this.memories.push({
          id: 'mem-' + Math.random().toString(36).substring(2, 9),
          text: item.text,
          metadata: item.metadata,
          embedding,
        });
      }
    })();
    return this.initPromise;
  }

  async addMemory(text: string, metadata: Record<string, any> = {}): Promise<string> {
    await this.init();
    const id = 'mem-' + Math.random().toString(36).substring(2, 9);
    const embedding = await getEmbedding(text);
    const item: MemoryItem = {
      id,
      text,
      metadata: {
        ...metadata,
        timestamp: metadata.timestamp || new Date().toISOString(),
      },
      embedding,
    };
    this.memories.unshift(item);
    return id;
  }

  async searchMemory(query: string, topK: number = 3): Promise<MemoryItem[]> {
    await this.init();
    if (this.memories.length === 0) return [];

    const queryEmbedding = await getEmbedding(query);
    const scored = this.memories.map((item) => {
      const distance = item.embedding ? cosineDistance(queryEmbedding, item.embedding) : 1.0;
      return {
        id: item.id,
        text: item.text,
        metadata: item.metadata,
        distance: Number(distance.toFixed(4)),
      };
    });

    scored.sort((a, b) => (a.distance ?? 1) - (b.distance ?? 1));
    return scored.slice(0, topK);
  }

  getMemoriesBySession(sessionId: string, limit: number = 10): MemoryItem[] {
    return this.memories
      .filter((m) => m.metadata.session_id === sessionId)
      .slice(0, limit)
      .map((m) => ({ id: m.id, text: m.text, metadata: m.metadata }));
  }

  getAllMemories(): MemoryItem[] {
    return this.memories.map((m) => ({ id: m.id, text: m.text, metadata: m.metadata }));
  }

  getStats(): { count: number } {
    return { count: this.memories.length };
  }

  async getSemanticGraph(minSimilarity: number = 0.2): Promise<SemanticGraphData> {
    await this.init();
    const nodes: GraphNode[] = this.memories.map((m) => ({
      id: m.id,
      text: m.text,
      category: (m.metadata.category as string) || 'General',
      source: (m.metadata.source as string) || 'MemoryStore',
      timestamp: m.metadata.timestamp as string | undefined,
      degree: 0,
    }));

    const links: GraphLink[] = [];
    const categoriesSet = new Set<string>();

    nodes.forEach((n) => categoriesSet.add(n.category));

    // Pairwise similarity calculations
    for (let i = 0; i < this.memories.length; i++) {
      for (let j = i + 1; j < this.memories.length; j++) {
        const embA = this.memories[i].embedding;
        const embB = this.memories[j].embedding;
        if (!embA || !embB) continue;

        const sim = cosineSimilarity(embA, embB);
        if (sim >= minSimilarity) {
          links.push({
            source: this.memories[i].id,
            target: this.memories[j].id,
            similarity: Number(sim.toFixed(4)),
            distance: Number(Math.max(0, 1 - sim).toFixed(4)),
          });
          nodes[i].degree = (nodes[i].degree || 0) + 1;
          nodes[j].degree = (nodes[j].degree || 0) + 1;
        }
      }
    }

    // Connect any isolated nodes to their nearest neighbor
    for (let i = 0; i < this.memories.length; i++) {
      if (nodes[i].degree === 0 && this.memories.length > 1) {
        let bestSim = -1;
        let bestJ = -1;
        const embA = this.memories[i].embedding;
        if (!embA) continue;
        for (let j = 0; j < this.memories.length; j++) {
          if (i === j) continue;
          const embB = this.memories[j].embedding;
          if (!embB) continue;
          const sim = cosineSimilarity(embA, embB);
          if (sim > bestSim) {
            bestSim = sim;
            bestJ = j;
          }
        }
        if (bestJ !== -1 && bestSim > 0.05) {
          links.push({
            source: this.memories[i].id,
            target: this.memories[bestJ].id,
            similarity: Number(bestSim.toFixed(4)),
            distance: Number(Math.max(0, 1 - bestSim).toFixed(4)),
          });
          nodes[i].degree = (nodes[i].degree || 0) + 1;
          nodes[bestJ].degree = (nodes[bestJ].degree || 0) + 1;
        }
      }
    }

    return {
      nodes,
      links,
      categories: Array.from(categoriesSet),
    };
  }

  // Experiences
  addExperience(exp: ExperienceRecord): ExperienceRecord {
    this.experiences.unshift(exp);
    this.updateUserModel(exp);
    return exp;
  }

  getExperiencesBySession(sessionId: string): ExperienceRecord[] {
    return this.experiences.filter((e) => e.session_id === sessionId);
  }

  getRecentExperiences(limit: number = 100): ExperienceRecord[] {
    return this.experiences.slice(0, limit);
  }

  // Proposals
  getProposals(status?: string): SkillProposal[] {
    if (status) {
      return this.proposals.filter((p) => p.status === status);
    }
    return this.proposals;
  }

  getProposal(name: string): SkillProposal | undefined {
    return this.proposals.find((p) => p.skill_name === name);
  }

  addProposal(proposal: SkillProposal): SkillProposal {
    const existingIdx = this.proposals.findIndex((p) => p.skill_name === proposal.skill_name);
    if (existingIdx >= 0) {
      this.proposals[existingIdx] = proposal;
    } else {
      this.proposals.push(proposal);
    }
    return proposal;
  }

  integrateProposal(name: string): boolean {
    const p = this.proposals.find((prop) => prop.skill_name === name);
    if (p) {
      p.status = 'integrated';
      return true;
    }
    return false;
  }

  autoIntegrate(threshold: number = 0.8): string[] {
    const integrated: string[] = [];
    for (const p of this.proposals) {
      if (p.status !== 'integrated' && p.confidence_score >= threshold) {
        p.status = 'integrated';
        integrated.push(p.skill_name);
      }
    }
    return integrated;
  }

  // User models
  getUserModel(sessionId: string): UserModel | undefined {
    return this.userModels[sessionId];
  }

  getAllUserModels(): Record<string, UserModel> {
    return this.userModels;
  }

  private updateUserModel(exp: ExperienceRecord) {
    const sid = exp.session_id || 'default';
    let model = this.userModels[sid];
    if (!model) {
      model = {
        user_id: sid,
        preferences: {
          language: 'en',
          topics: [],
          tool_preferences: {},
          preferred_tools: [],
        },
        interaction_count: 0,
        avg_confidence: 1.0,
        last_seen: exp.timestamp,
      };
      this.userModels[sid] = model;
    }

    model.interaction_count += 1;
    model.last_seen = exp.timestamp;

    if (exp.tool_used && !model.preferences.preferred_tools.includes(exp.tool_used)) {
      model.preferences.preferred_tools.push(exp.tool_used);
    }

    // Infer topics
    const q = exp.user_query.toLowerCase();
    const detected: string[] = [];
    if (/math|calc|\+|\-|\*|\/|sqrt/i.test(q)) detected.push('math');
    if (/celsius|fahrenheit|convert|temp|kg|lb|km|mile/i.test(q)) detected.push('unit conversion');
    if (/format|uppercase|lowercase|slug|title/i.test(q)) detected.push('formatting');
    if (/json|parse|object|schema/i.test(q)) detected.push('json');
    if (/time|date|clock/i.test(q)) detected.push('time');
    if (/search|who|what|google|ddg/i.test(q)) detected.push('search');

    for (const topic of detected) {
      if (!model.preferences.topics.includes(topic)) {
        model.preferences.topics.push(topic);
      }
    }
  }

  buildUserModelFromExperiences(sessionId: string): UserModel {
    const sessionExps = this.getExperiencesBySession(sessionId);
    const existing = this.userModels[sessionId];
    if (existing) return existing;

    const model: UserModel = {
      user_id: sessionId,
      preferences: {
        language: 'en',
        topics: ['general'],
        tool_preferences: {},
        preferred_tools: [],
      },
      interaction_count: sessionExps.length,
      avg_confidence: 1.0,
      last_seen: new Date().toISOString(),
    };

    for (const exp of sessionExps) {
      if (exp.tool_used && !model.preferences.preferred_tools.includes(exp.tool_used)) {
        model.preferences.preferred_tools.push(exp.tool_used);
      }
    }

    this.userModels[sessionId] = model;
    return model;
  }
}

// Global singleton
export const memoryStore = new MemoryStore();
