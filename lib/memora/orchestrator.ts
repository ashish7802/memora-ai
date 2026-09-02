import { GoogleGenAI } from '@google/genai';
import { memoryStore } from './store';
import { builtInSkills } from './skills';

export interface ChatResult {
  response: string;
  session_id: string;
  tool_used: string | null;
  tool_input: any | null;
  tool_result: any | null;
}

export async function runOrchestrator(
  message: string,
  sessionId: string = 'default'
): Promise<ChatResult> {
  const query = message.trim();
  let toolUsed: string | null = null;
  let toolInput: any | null = null;
  let toolResult: any | null = null;
  let finalResponse = '';

  // 1. RAG Step: Retrieve top relevant memories
  const relevantMemories = await memoryStore.searchMemory(query, 2);
  const memoryContext =
    relevantMemories.length > 0
      ? relevantMemories
          .map((m) => `- [Memory #${m.id} (${m.metadata.category || 'general'})]: ${m.text}`)
          .join('\n')
      : 'No prior memories found for this query.';

  // 2. Check if GEMINI_API_KEY is available
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });

      // Check tool definitions
      const toolsDesc = Object.entries(builtInSkills)
        .map(([k, v]) => `- ${k}: ${v.description}`)
        .join('\n');

      const systemPrompt = `You are Memora, an intelligent AI agent with semantic vector memory and a modular skill registry.
Decide if you should invoke a tool to answer the user query or reply directly.

Available Skills:
${toolsDesc}

Relevant Retrieved Memories from Vector Space:
${memoryContext}

Respond ONLY with a JSON object in one of two formats:
Format A (Tool invocation):
{"action": "<tool_name>", "input": { <parameters> }}

Format B (Direct reply):
{"action": "reply", "response": "<your helpful response here>"}`;

      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `${systemPrompt}\n\nUser: ${query}\nOutput (JSON):`,
      });

      const raw = res.text || '';
      const clean = raw.replace(/^```json\s*|```$/g, '').trim();
      const parsed = JSON.parse(clean);

      if (parsed.action && parsed.action !== 'reply' && builtInSkills[parsed.action]) {
        toolUsed = parsed.action;
        toolInput = parsed.input || {};
        toolResult = await builtInSkills[parsed.action].execute(toolInput);

        // Second pass to format the answer with tool result
        const secondPass = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `User asked: "${query}".
The tool "${toolUsed}" was executed with output: ${JSON.stringify(toolResult)}.
Please formulate a concise, polished response to the user incorporating this result.`,
        });
        finalResponse = secondPass.text || JSON.stringify(toolResult);
      } else if (parsed.response) {
        finalResponse = parsed.response;
      }
    } catch {
      // Fallback to deterministic agent if API fails or parsing errors
    }
  }

  // 3. Fallback / Deterministic Orchestrator (if no Gemini API key or error)
  if (!finalResponse) {
    const qLower = query.toLowerCase();

    // Check for math / calculator
    const mathMatch = query.match(/(?:calculate|what is|compute)?\s*([0-9+\-*/().,%^a-zA-Z\s]{3,})/i);
    if (
      (/\b(calculate|compute|sqrt|math|\+|\*|\/|\^)\b/i.test(qLower) ||
        (/^[0-9\s+\-*/().^]+$/.test(query.trim()) && query.length >= 3)) &&
      builtInSkills.calculator
    ) {
      toolUsed = 'calculator';
      const expr = query.replace(/(?:calculate|compute|what is|=|\?)/gi, '').trim();
      toolInput = { expression: expr || query };
      toolResult = await builtInSkills.calculator.execute(toolInput);
      if (toolResult.status === 'success') {
        finalResponse = `Result: ${expr} = ${toolResult.result}`;
      } else {
        finalResponse = `Error calculating expression: ${toolResult.error}`;
      }
    }
    // Check for unit conversion
    else if (
      /\b(convert|celsius|fahrenheit|kg|pounds|lbs|kilometers|miles)\b/i.test(qLower) &&
      builtInSkills.unit_converter
    ) {
      toolUsed = 'unit_converter';
      const numMatch = query.match(/-?\d+(?:\.\d+)?/);
      const val = numMatch ? parseFloat(numMatch[0]) : 50;
      let fromUnit = 'celsius';
      let toUnit = 'fahrenheit';

      if (qLower.includes('celsius') && qLower.includes('fahrenheit')) {
        fromUnit = qLower.indexOf('celsius') < qLower.indexOf('fahrenheit') ? 'celsius' : 'fahrenheit';
        toUnit = fromUnit === 'celsius' ? 'fahrenheit' : 'celsius';
      } else if (qLower.includes('kg') || qLower.includes('pound')) {
        fromUnit = qLower.includes('kg') ? 'kg' : 'lb';
        toUnit = fromUnit === 'kg' ? 'lb' : 'kg';
      } else if (qLower.includes('km') || qLower.includes('mile')) {
        fromUnit = qLower.includes('km') ? 'km' : 'miles';
        toUnit = fromUnit === 'km' ? 'miles' : 'km';
      }

      toolInput = { value: val, from_unit: fromUnit, to_unit: toUnit };
      toolResult = await builtInSkills.unit_converter.execute(toolInput);
      finalResponse = `${val} ${fromUnit} is ${toolResult.converted_value} ${toUnit}`;
    }
    // Check for text formatting
    else if (
      /\b(format|uppercase|lowercase|slugify|title case|titlecase)\b/i.test(qLower) &&
      builtInSkills.text_formatter
    ) {
      toolUsed = 'text_formatter';
      let mode = 'upper';
      if (qLower.includes('lower')) mode = 'lower';
      else if (qLower.includes('slug')) mode = 'slug';
      else if (qLower.includes('title')) mode = 'title';

      const targetText = query.replace(/^.*?(?:to\s+(?:uppercase|lowercase|slug|title)|format:?)\s*/i, '').trim();
      toolInput = { text: targetText || query, mode };
      toolResult = await builtInSkills.text_formatter.execute(toolInput);
      finalResponse = `Formatted (${mode}): ${toolResult.formatted_text}`;
    }
    // Check for JSON parser
    else if (/\b(json|parse|validate json)\b/i.test(qLower) && builtInSkills.json_parser) {
      toolUsed = 'json_parser';
      const jsonStart = query.indexOf('{');
      const jsonEnd = query.lastIndexOf('}');
      const jsonStr = jsonStart !== -1 && jsonEnd !== -1 ? query.substring(jsonStart, jsonEnd + 1) : query;
      toolInput = { json_string: jsonStr };
      toolResult = await builtInSkills.json_parser.execute(toolInput);
      finalResponse = toolResult.valid
        ? `Valid JSON! Formatted:\n${toolResult.formatted}`
        : `Invalid JSON: ${toolResult.error}`;
    }
    // Check for time
    else if (/\b(time|date|today|current time|clock)\b/i.test(qLower) && builtInSkills.time) {
      toolUsed = 'time';
      toolInput = {};
      toolResult = await builtInSkills.time.execute({});
      finalResponse = `The current date and time is ${toolResult.formatted || toolResult.current_time}.`;
    }
    // Check for save note / memory
    else if (/\b(remember|save note|store note|save this|record memory)\b/i.test(qLower) && builtInSkills.save_note) {
      toolUsed = 'save_note';
      const noteText = query.replace(/^(?:please\s+)?(?:remember|save note|store note|save this):\s*/i, '').trim();
      toolInput = { text: noteText || query, metadata: { session_id: sessionId } };
      toolResult = await builtInSkills.save_note.execute(toolInput);
      finalResponse = `Saved to memory store (ID: ${toolResult.id}). It will be recalled for future contextual queries.`;
    }
    // Check for search
    else if (/\b(search|find online|look up|google|duckduckgo)\b/i.test(qLower) && builtInSkills.web_search) {
      toolUsed = 'web_search';
      const sQuery = query.replace(/^(?:search for|look up|find|search)\s+/i, '').trim();
      toolInput = { query: sQuery || query };
      toolResult = await builtInSkills.web_search.execute(toolInput);
      finalResponse = `Found ${toolResult.results.length} results for "${sQuery}":\n${toolResult.results
        .map((r: any) => `• ${r.title}: ${r.body}`)
        .join('\n')}`;
    }
    // Contextual direct response
    else {
      if (relevantMemories.length > 0 && (relevantMemories[0].distance ?? 1) < 0.75) {
        finalResponse = `I found a relevant context in your memory bank: "${relevantMemories[0].text}". How else can I assist you with this?`;
      } else {
        finalResponse = `Hello! I am Memora, your agent memory and skill platform. I can calculate math expressions, convert units, format text, validate JSON, store memories, and recall semantic context. What would you like to do?`;
      }
    }
  }

  // 4. Log Experience into ExperienceStore
  memoryStore.addExperience({
    session_id: sessionId,
    user_query: message,
    agent_response: finalResponse,
    tool_used: toolUsed,
    tool_input: toolInput,
    tool_result: toolResult,
    success: true,
    timestamp: new Date().toISOString(),
    feedback_score: null,
  });

  return {
    response: finalResponse,
    session_id: sessionId,
    tool_used: toolUsed,
    tool_input: toolInput,
    tool_result: toolResult,
  };
}
