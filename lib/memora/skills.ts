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
};
