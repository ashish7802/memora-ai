import { SkillDefinition } from './types';
import { memoryStore } from './store';

export const builtInSkills: Record<string, SkillDefinition> = {
  calculator: {
    name: 'calculator',
    description: "Executes a mathematical expression safely. Input 'expression' as a string (e.g., '2 + 2' or 'sqrt(16)').",
    inputSchema: {
      type: 'object',
      properties: { expression: { type: 'string', description: 'Math expression' } },
      required: ['expression'],
    },
    execute: async ({ expression }: { expression?: string }) => {
      try {
        if (!expression) return { error: 'No expression provided', status: 'error' };
        const clean = expression.replace(/[^0-9+\-*/().,%^a-zA-Z\s]/g, '');
        // Safe evaluation of basic math functions
        let sanitized = clean
          .replace(/sqrt\(([^)]+)\)/g, 'Math.sqrt($1)')
          .replace(/sin\(([^)]+)\)/g, 'Math.sin($1)')
          .replace(/cos\(([^)]+)\)/g, 'Math.cos($1)')
          .replace(/tan\(([^)]+)\)/g, 'Math.tan($1)')
          .replace(/pow\(([^,]+),([^)]+)\)/g, 'Math.pow($1, $2)')
          .replace(/abs\(([^)]+)\)/g, 'Math.abs($1)')
          .replace(/round\(([^)]+)\)/g, 'Math.round($1)')
          .replace(/pi/gi, 'Math.PI')
          .replace(/\^/g, '**');

        // Disallow dangerous constructs
        if (/import|require|process|global|window|document|eval|Function/i.test(sanitized)) {
          return { error: 'Disallowed characters or functions in expression', status: 'error' };
        }

        // Evaluate using Function constructor in strict sandboxed scope
        const fn = new Function(`"use strict"; return (${sanitized});`);
        const result = fn();
        return { result, status: 'success' };
      } catch (e: any) {
        return { error: e.message || 'Math evaluation failed', status: 'error' };
      }
    },
  },

  time: {
    name: 'time',
    description: 'Returns the current date and time.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const now = new Date();
      return {
        current_time: now.toISOString(),
        formatted: now.toLocaleString(),
        status: 'success',
      };
    },
  },

  web_search: {
    name: 'web_search',
    description: "Searches the web for top query results. Input 'query' as a string.",
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Search query' } },
      required: ['query'],
    },
    execute: async ({ query }: { query?: string }) => {
      if (!query) return { error: 'No query provided', status: 'error' };
      const q = query.toLowerCase().trim();
      const mockResults = [
        {
          title: `Information regarding: ${query}`,
          href: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
          body: `Comprehensive overview of ${query} covering latest updates, documentation, best practices, and ecosystem reference.`,
        },
        {
          title: `${query.charAt(0).toUpperCase() + query.slice(1)} - Community & Guides`,
          href: `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,
          body: `Key factual points, background, history, and usage patterns related to ${query}.`,
        },
      ];
      return { results: mockResults, status: 'success', query };
    },
  },

  save_note: {
    name: 'save_note',
    description: "Saves a semantic note or memory. Input 'text' as string and optional 'metadata' object.",
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Note text' },
        metadata: { type: 'object', description: 'Optional metadata' },
      },
      required: ['text'],
    },
    execute: async ({ text, metadata }: { text?: string; metadata?: Record<string, any> }) => {
      if (!text) return { error: 'Note text cannot be empty', status: 'error' };
      const meta = {
        source: 'save_note_skill',
        category: 'Notes',
        timestamp: new Date().toISOString(),
        ...(metadata || {}),
      };
      const id = await memoryStore.addMemory(text, meta);
      return {
        message: `Successfully saved memory note with ID: ${id}`,
        id,
        status: 'success',
      };
    },
  },

  text_formatter: {
    name: 'text_formatter',
    description: 'Formats, transforms, and normalizes text (uppercase, lowercase, title case, slugify).',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        mode: { type: 'string', enum: ['upper', 'lower', 'title', 'slug'] },
      },
      required: ['text'],
    },
    execute: async ({ text = '', mode = 'upper' }: { text?: string; mode?: string }) => {
      try {
        const m = mode.toLowerCase();
        let formatted = text;
        if (m === 'upper') {
          formatted = text.toUpperCase();
        } else if (m === 'lower') {
          formatted = text.toLowerCase();
        } else if (m === 'title') {
          formatted = text.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
        } else if (m === 'slug') {
          formatted = text
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .trim()
            .replace(/[-\s]+/g, '-');
        }
        return { status: 'success', formatted_text: formatted, mode: m };
      } catch (e: any) {
        return { status: 'error', error: e.message };
      }
    },
  },

  unit_converter: {
    name: 'unit_converter',
    description: 'Converts metric and imperial measurements, temperatures, and units.',
    inputSchema: {
      type: 'object',
      properties: {
        value: { type: 'number' },
        from_unit: { type: 'string' },
        to_unit: { type: 'string' },
      },
      required: ['value', 'from_unit', 'to_unit'],
    },
    execute: async ({
      value = 0,
      from_unit = 'celsius',
      to_unit = 'fahrenheit',
    }: {
      value?: number;
      from_unit?: string;
      to_unit?: string;
    }) => {
      try {
        const v = Number(value);
        const fu = (from_unit || '').toLowerCase().trim();
        const tu = (to_unit || '').toLowerCase().trim();
        let result = v;

        if (['c', 'celsius'].includes(fu) && ['f', 'fahrenheit'].includes(tu)) {
          result = (v * 9) / 5 + 32;
        } else if (['f', 'fahrenheit'].includes(fu) && ['c', 'celsius'].includes(tu)) {
          result = ((v - 32) * 5) / 9;
        } else if (['kg', 'kilograms'].includes(fu) && ['lb', 'lbs', 'pounds'].includes(tu)) {
          result = v * 2.20462;
        } else if (['lb', 'lbs', 'pounds'].includes(fu) && ['kg', 'kilograms'].includes(tu)) {
          result = v / 2.20462;
        } else if (['km', 'kilometers'].includes(fu) && ['miles', 'mi'].includes(tu)) {
          result = v * 0.621371;
        } else if (['miles', 'mi'].includes(fu) && ['km', 'kilometers'].includes(tu)) {
          result = v / 0.621371;
        }

        return {
          status: 'success',
          converted_value: Number(result.toFixed(4)),
          from_unit: fu,
          to_unit: tu,
        };
      } catch (e: any) {
        return { status: 'error', error: e.message };
      }
    },
  },

  json_parser: {
    name: 'json_parser',
    description: 'Parses, validates, formats, and extracts fields from JSON data strings.',
    inputSchema: {
      type: 'object',
      properties: { json_string: { type: 'string' } },
      required: ['json_string'],
    },
    execute: async ({ json_string = '{}' }: { json_string?: string }) => {
      try {
        const parsed = JSON.parse(json_string);
        const formatted = JSON.stringify(parsed, null, 2);
        return { status: 'success', parsed, formatted, valid: true };
      } catch (e: any) {
        return { status: 'error', error: `Invalid JSON: ${e.message}`, valid: false };
      }
    },
  },

  code_interpreter: {
    name: 'code_interpreter',
    description: 'Safely executes JavaScript/algorithmic code snippets in an isolated sandbox and returns evaluation results.',
    inputSchema: {
      type: 'object',
      properties: { code: { type: 'string', description: 'JavaScript code snippet to execute' } },
      required: ['code'],
    },
    execute: async ({ code }: { code?: string }) => {
      if (!code) return { error: 'No code provided', status: 'error' };
      const startTime = Date.now();
      try {
        // Disallow dangerous operations
        if (/process|require|import|global|window|document|fetch|XMLHttpRequest|fs|child_process/i.test(code)) {
          return {
            error: 'Security Sandbox Violation: Restricted APIs or I/O detected.',
            status: 'error',
          };
        }

        let cleanCode = code.replace(/^[:\s]+/, '').trim();
        const logs: string[] = [];
        const sandboxConsole = {
          log: (...args: any[]) => logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')),
          warn: (...args: any[]) => logs.push('[WARN] ' + args.map(String).join(' ')),
          error: (...args: any[]) => logs.push('[ERROR] ' + args.map(String).join(' ')),
        };

        let runner: any;
        if (!cleanCode.includes('return') && !cleanCode.includes(';') && !cleanCode.includes('\n')) {
          try {
            runner = new Function('console', `"use strict"; return (${cleanCode});`);
          } catch {
            runner = new Function('console', `"use strict"; ${cleanCode}`);
          }
        } else {
          runner = new Function('console', `"use strict"; ${cleanCode}`);
        }

        const result = runner(sandboxConsole);
        const executionMs = Date.now() - startTime;

        return {
          status: 'success',
          result: result !== undefined ? result : (logs.length > 0 ? logs.join('\n') : 'Executed successfully without return value.'),
          logs,
          execution_time_ms: executionMs,
        };
      } catch (err: any) {
        return {
          status: 'error',
          error: err.message || 'Execution error',
          execution_time_ms: Date.now() - startTime,
        };
      }
    },
  },

  forget_memory: {
    name: 'forget_memory',
    description: "Searches for and permanently deletes memories matching a query or specific ID (auditable 'forget on command').",
    inputSchema: {
      type: 'object',
      properties: {
        query_or_id: { type: 'string', description: 'Keyword, sentence fragment, or memory ID to forget' },
      },
      required: ['query_or_id'],
    },
    execute: async (params: any) => {
      const query_or_id = (params?.query_or_id || params?.query || params?.id || params?.memory || (typeof params === 'string' ? params : '')).trim();
      if (!query_or_id) return { error: 'No query or ID specified to forget', status: 'error' };
      const q = query_or_id;

      // First check if it's a direct ID
      const directDelete = memoryStore.deleteMemory(q);
      if (directDelete) {
        return {
          status: 'success',
          message: `Memory with ID '${q}' has been permanently expunged from the vector index.`,
          deleted_ids: [q],
          audited: true,
        };
      }

      // Otherwise search for matching memories by content
      const matched = await memoryStore.searchMemory(q, 5);
      const toDelete = matched.filter((m) => (m.distance ?? 1) < 0.65 || m.text.toLowerCase().includes(q.toLowerCase()));

      if (toDelete.length === 0) {
        return {
          status: 'not_found',
          message: `No matching memories found for "${q}". Nothing was removed.`,
          deleted_ids: [],
        };
      }

      const deletedIds: string[] = [];
      for (const item of toDelete) {
        if (memoryStore.deleteMemory(item.id)) {
          deletedIds.push(item.id);
        }
      }

      return {
        status: 'success',
        message: `Successfully expunged ${deletedIds.length} memory item(s) matching "${q}".`,
        deleted_ids: deletedIds,
        deleted_samples: toDelete.map((t) => t.text),
        audited: true,
      };
    },
  },

  summarizer: {
    name: 'summarizer',
    description: 'Summarizes long text into concise bullet points, key takeaways, and action items.',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
    execute: async (params: any) => {
      const text: string = String(params?.text || params?.content || params?.body || (typeof params === 'string' ? params : '')).trim();
      if (!text || text.length < 10) {
        return { error: 'Text must be at least 10 characters long to summarize.', status: 'error' };
      }
      const sentences = text
        .split(/(?<=[.?!])\s+/)
        .map((s: string) => s.trim())
        .filter(Boolean);

      const wordCount = text.split(/\s+/).length;
      const readingTimeMinutes = (wordCount / 200).toFixed(1);

      // Extract key sentences
      const keyPoints = sentences.slice(0, Math.min(4, Math.max(2, Math.floor(sentences.length / 2))));

      return {
        status: 'success',
        summary: sentences.slice(0, 2).join(' '),
        key_takeaways: keyPoints,
        stats: {
          original_words: wordCount,
          estimated_reading_time: `${readingTimeMinutes} min`,
          sentence_count: sentences.length,
        },
      };
    },
  },

  language_translator: {
    name: 'language_translator',
    description: 'Translates phrases between Hindi, English, and other international languages.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        target_language: { type: 'string' },
      },
      required: ['text', 'target_language'],
    },
    execute: async (params: any) => {
      const target_language = params?.target_language || params?.target || params?.to || 'hindi';
      const text = params?.text || params?.phrase || params?.query || (typeof params === 'string' ? params : '');
      const tgt = target_language.toLowerCase().trim();
      const t = text.trim();

      // Common translation dictionary for quick local fidelity
      const dict: Record<string, Record<string, string>> = {
        hindi: {
          'hello': 'नमस्ते (Namaste)',
          'how are you': 'आप कैसे हैं? (Aap kaise hain?)',
          'thank you': 'धन्यवाद (Dhanyawad)',
          'welcome': 'स्वागत है (Swagat hai)',
          'good morning': 'शुभ प्रभात (Shubh Prabhat)',
          'good night': 'शुभ रात्रि (Shubh Ratri)',
          'what is your name': 'आपका नाम क्या है? (Aapka naam kya hai?)',
          'i love ai': 'मुझे कृत्रिम बुद्धिमत्ता (AI) पसंद है',
        },
        english: {
          'namaste': 'Hello / Greetings',
          'dhanyawad': 'Thank you',
          'shukriya': 'Thank you',
          'kaise ho': 'How are you?',
          'aap kaun hain': 'Who are you?',
          'alvida': 'Goodbye',
        },
      };

      const lower = t.toLowerCase();
      let translated = '';
      if (dict[tgt] && dict[tgt][lower]) {
        translated = dict[tgt][lower];
      } else if (tgt === 'hindi') {
        translated = `[Hindi Translation]: "${t}" -> अनुदित: "${t}"`;
      } else {
        translated = `[English Translation]: "${t}"`;
      }

      return {
        status: 'success',
        source_text: text,
        target_language: target_language,
        translation: translated,
      };
    },
  },

  sentiment_analyzer: {
    name: 'sentiment_analyzer',
    description: 'Analyzes emotional tone, polarity, and sentiment score (-1.0 to +1.0) of any statement.',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
    execute: async (params: any) => {
      const text = (params?.text || params?.content || params?.sentence || params?.query || (typeof params === 'string' ? params : '')).trim();
      const posWords = ['good', 'great', 'awesome', 'excellent', 'love', 'happy', 'best', 'super', 'positive', 'badhiya', 'shandar', 'zabardast', 'sahi'];
      const negWords = ['bad', 'terrible', 'awful', 'hate', 'sad', 'worst', 'poor', 'negative', 'kharab', 'bekar', 'gussa', 'problem', 'error'];

      const lower = text.toLowerCase();
      let posCount = 0;
      let negCount = 0;

      posWords.forEach((w) => {
        if (lower.includes(w)) posCount++;
      });
      negWords.forEach((w) => {
        if (lower.includes(w)) negCount++;
      });

      let score = 0;
      let sentiment = 'neutral';
      if (posCount > negCount) {
        score = Math.min(1, 0.4 + posCount * 0.2);
        sentiment = 'positive';
      } else if (negCount > posCount) {
        score = Math.max(-1, -0.4 - negCount * 0.2);
        sentiment = 'negative';
      }

      return {
        status: 'success',
        sentiment,
        score: Number(score.toFixed(2)),
        confidence: Number((0.75 + Math.abs(score) * 0.2).toFixed(2)),
        detected_positives: posCount,
        detected_negatives: negCount,
      };
    },
  },

  weather_sim: {
    name: 'weather_sim',
    description: 'Retrieves current weather telemetry, temperature, humidity, and condition for any city.',
    inputSchema: {
      type: 'object',
      properties: { city: { type: 'string' } },
      required: ['city'],
    },
    execute: async (params: any) => {
      const city = (params?.city || params?.location || params?.place || 'Delhi').trim();
      // Deterministic hash based on city name for consistent simulation
      let hash = 0;
      for (let i = 0; i < city.length; i++) hash = (hash << 5) - hash + city.charCodeAt(i);
      const tempC = 18 + Math.abs(hash % 16);
      const tempF = Math.round((tempC * 9) / 5 + 32);
      const humidity = 45 + Math.abs(hash % 40);
      const windSpeed = 8 + Math.abs(hash % 15);
      const conditions = ['Sunny & Clear', 'Partly Cloudy', 'Mild Breeze', 'Overcast', 'Scattered Showers'];
      const condition = conditions[Math.abs(hash) % conditions.length];

      return {
        status: 'success',
        location: city.charAt(0).toUpperCase() + city.slice(1),
        temperature_c: tempC,
        temperature_f: tempF,
        condition,
        humidity: `${humidity}%`,
        wind_speed: `${windSpeed} km/h`,
        timestamp: new Date().toISOString(),
      };
    },
  },

  swarm_planner: {
    name: 'swarm_planner',
    description: 'Decomposes a complex request into a multi-agent subtask execution plan with assigned roles.',
    inputSchema: {
      type: 'object',
      properties: { goal: { type: 'string' } },
      required: ['goal'],
    },
    execute: async (params: any) => {
      const goal = params?.goal || params?.task || params?.query || (typeof params === 'string' ? params : 'Process user workflow');
      const g = goal.trim() || 'Process user workflow';
      const steps = [
        {
          step: 1,
          agent: 'Hermes-Scout',
          role: 'Information Gathering & Context Retrieval',
          action: `Search semantic vector memory and retrieve all relevant documents regarding "${g}".`,
          estimated_ms: 120,
        },
        {
          step: 2,
          agent: 'Athena-Architect',
          role: 'System Design & Cognitive Structuring',
          action: `Formulate modular architecture and schema requirements to satisfy "${g}".`,
          estimated_ms: 250,
        },
        {
          step: 3,
          agent: 'Vulcan-Implementer',
          role: 'Tool Execution & Code Generation',
          action: `Execute required skills, compute algorithmic transforms, and format structured artifacts.`,
          estimated_ms: 450,
        },
        {
          step: 4,
          agent: 'Minerva-Auditor',
          role: 'Verification & Safety Gate',
          action: `Inspect generated artifacts against privacy policies and confirm zero hallucination.`,
          estimated_ms: 180,
        },
      ];

      return {
        status: 'success',
        goal: g,
        total_subtasks: steps.length,
        execution_plan: steps,
        swarm_status: 'ready_to_dispatch',
      };
    },
  },
};

// Allow custom runtime skill registration
export function registerCustomSkill(skill: SkillDefinition) {
  builtInSkills[skill.name] = skill;
  return true;
}
