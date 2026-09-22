import { GoogleGenAI } from '@google/genai';
import { memoryStore } from './store';
import { builtInSkills } from './skills';
import { ollamaManager } from './ollama';

export interface ChatResult {
  response: string;
  reply: string;
  session_id: string;
  sessionId: string;
  tool_used: string | null;
  tool_input: any | null;
  tool_result: any | null;
  metadata?: {
    usedMemory?: boolean;
    recalledMemoriesCount?: number;
    model?: string;
  };
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

  const ollamaConfig = ollamaManager.getConfig();
  const apiKey = process.env.GEMINI_API_KEY;
  const isAirGapped = ollamaConfig.mode === 'airgapped';
  const forceLocalOnly = ollamaConfig.mode === 'local' && !apiKey;

  // 2A. If strictly Air-gapped or force-local without API key
  if (isAirGapped || forceLocalOnly) {
    try {
      const localRes = await ollamaManager.generate(
        query,
        `You are Memora, an intelligent local AI agent operating with zero remote telemetry. Relevant retrieved memories:\n${memoryContext}`
      );
      if (localRes.response) {
        finalResponse = localRes.response;
      }
    } catch {
      // Fallback
    }
  }

  // 2B. Try Cloud Gemini API (if not in airgapped mode and no response yet)
  if (!finalResponse && apiKey && !isAirGapped) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // Check tool definitions
      const toolsDesc = Object.entries(builtInSkills)
        .map(([k, v]) => `- ${k}: ${v.description}`)
        .join('\n');

      const systemPrompt = `You are Memora, an advanced sovereign AI cognitive agent with semantic vector memory and a modular skill registry.
You are fully capable of understanding and replying fluently in whatever language the user communicates in (including Hindi, Hinglish, English, etc.).
You are helpful, concise, intelligent, and accurate.

Available Skills:
${toolsDesc}

Relevant Retrieved Memories from Vector Space:
${memoryContext}

Instructions:
1. If the user's request requires executing one of the available skills (such as calculator for math, unit_converter for measurements/temperatures, text_formatter for case/slugify, time for current time, web_search for looking up information, save_note for remembering a fact, or json_parser for parsing/validating JSON), invoke that tool.
2. Otherwise, reply directly to the user in their language (e.g. Hindi if they speak Hindi/Hinglish, English if English).

Respond in JSON format:
Format A (Tool invocation):
{"action": "<tool_name>", "input": { <parameters> }}

Format B (Direct conversational reply):
{"action": "reply", "response": "<your helpful response here>"}`;

      const res = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `${systemPrompt}\n\nUser: ${query}\nOutput (JSON):`,
      });

      const raw = res.text || '';
      let parsed: any = null;
      try {
        const clean = raw.replace(/^```json\s*|```$/g, '').trim();
        parsed = JSON.parse(clean);
      } catch {
        // If the model replied directly in natural language without strict JSON
        if (raw.trim()) {
          finalResponse = raw.trim();
        }
      }

      if (parsed) {
        if (parsed.action && parsed.action !== 'reply' && builtInSkills[parsed.action]) {
          toolUsed = parsed.action;
          toolInput = parsed.input || {};
          toolResult = await builtInSkills[parsed.action].execute(toolInput);

          // Second pass to format the answer with tool result
          try {
            const secondPass = await ai.models.generateContent({
              model: 'gemini-3.8-flash',
              contents: `User asked: "${query}".
The tool "${toolUsed}" was executed with output: ${JSON.stringify(toolResult)}.
Please formulate a natural, polished, and helpful response to the user incorporating this result in the user's preferred language.`,
            });
            finalResponse = secondPass.text || JSON.stringify(toolResult);
          } catch {
            finalResponse = JSON.stringify(toolResult);
          }
        } else if (parsed.response) {
          finalResponse = parsed.response;
        } else if (typeof parsed === 'string') {
          finalResponse = parsed;
        }
      }
    } catch (e: any) {
      // Graceful fallback to local engine or deterministic skill match
      console.warn('Gemini API call error in orchestrator:', e?.message || e);
    }
  }

  // 3. Skills & Deterministic Intent Engine
  // If Gemini was unavailable or quota exhausted, execute skills and contextual intents directly
  if (!finalResponse) {
    const qLower = query.toLowerCase();

    // Check for math / calculator
    if (
      (/\b(calculate|compute|sqrt|math|\+|\*|\/|\^)\b/i.test(qLower) ||
        (/^[0-9\s+\-*/().^]+$/.test(query.trim()) && query.length >= 3)) &&
      builtInSkills.calculator
    ) {
      toolUsed = 'calculator';
      const expr = query.replace(/(?:calculate|compute|what is|solve|=|\?)/gi, '').trim();
      toolInput = { expression: expr || query };
      toolResult = await builtInSkills.calculator.execute(toolInput);
      if (toolResult.status === 'success') {
        finalResponse = `The calculated result of ${expr || query} is ${toolResult.result}.`;
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
      finalResponse = `${val} ${fromUnit} is equal to ${toolResult.converted_value} ${toUnit}.`;
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
      finalResponse = `Formatted text (${mode}): ${toolResult.formatted_text}`;
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
        ? `Valid JSON! Formatted output:\n${toolResult.formatted}`
        : `Invalid JSON: ${toolResult.error}`;
    }
    // Check for time
    else if (/\b(time|date|today|current time|clock|samay|tarikh)\b/i.test(qLower) && builtInSkills.time) {
      toolUsed = 'time';
      toolInput = {};
      toolResult = await builtInSkills.time.execute({});
      finalResponse = `The current system time and date is: ${toolResult.formatted || toolResult.current_time} (ISO: ${toolResult.current_time}).`;
    }
    // Check for save note / memory
    else if (/\b(remember|save note|store note|save this|record memory|yaad rakhna|note likho)\b/i.test(qLower) && builtInSkills.save_note) {
      toolUsed = 'save_note';
      const noteText = query.replace(/^(?:please\s+)?(?:remember|save note|store note|save this|yaad rakhna|note likho):\s*/i, '').trim();
      toolInput = { text: noteText || query, metadata: { session_id: sessionId, source: 'chat_command' } };
      toolResult = await builtInSkills.save_note.execute(toolInput);
      finalResponse = `Note saved to semantic memory store (ID: ${toolResult.id}). It will be recalled in future queries for context.`;
    }
    // Check for search
    else if (/\b(search|find online|look up|google|duckduckgo|khojo)\b/i.test(qLower) && builtInSkills.web_search) {
      toolUsed = 'web_search';
      const sQuery = query.replace(/^(?:search for|look up|find|search|khojo)\s+/i, '').trim();
      toolInput = { query: sQuery || query };
      toolResult = await builtInSkills.web_search.execute(toolInput);
      finalResponse = `Found ${toolResult.results.length} results for "${sQuery}":\n\n${toolResult.results
        .map((r: any) => `• **${r.title}**: ${r.body}`)
        .join('\n\n')}`;
    }
    // Check for Memory queries (asking what the agent knows/remembers)
    else if (/\b(what do you remember|what do you know|mere baare me|kya yaad hai|recall memories|show memory)\b/i.test(qLower)) {
      if (relevantMemories.length > 0) {
        const memList = relevantMemories
          .map((m, idx) => `${idx + 1}. "${m.text}" (Category: ${m.metadata.category || 'General'})`)
          .join('\n');
        if (/mere baare me|kya yaad|batao/i.test(qLower)) {
          finalResponse = `Mujhe vector memory me yeh context mila hai:\n${memList}\n\nKya aap chahte hain ki main isme kuch naya jodoon ya is par koi task execute karoon?`;
        } else {
          finalResponse = `Here are relevant contextual memories retrieved from the vector store:\n${memList}\n\nHow would you like to build on this context?`;
        }
      } else {
        if (/mere baare me|kya yaad/i.test(qLower)) {
          finalResponse = `Filhal aapke is topic par koi specific memory store nahi hai. Aap "remember: [jankari]" bolkar naye facts save kar sakte hain!`;
        } else {
          finalResponse = `No specific memories found matching your query yet. You can store memories anytime by typing "remember: <your note>".`;
        }
      }
    }
    // Check for Hindi/Hinglish greetings and introductions
    else if (/namaste|kaun ho|kaun hai|kya kar sakte|kaise ho|kya haal|shukriya|dhanyawad|madad/i.test(qLower)) {
      if (/kaun|kya ho/i.test(qLower)) {
        finalResponse = `Namaste! Main **Memora** hoon — aapka sovereign AI cognitive agent. Main aapki baat samajh sakta hoon, continuous memory maintain karta hoon, mathematical calculations, unit conversions aur multi-agent workflows execute kar sakta hoon. Batayein, main aaj aapki kya madad karoon?`;
      } else if (/kya kar sakte|madad/i.test(qLower)) {
        finalResponse = `Main yeh sab kar sakta hoon:
1. 🧠 **Semantic Vector Memory**: Aapki baatein aur notes yaad rakhna.
2. ⚡ **Cognitive Skills**: Math expressions solve karna, units convert karna, text formatting, aur JSON validation.
3. 🔍 **Contextual Search**: Vector database aur web lookups.
4. 🤖 **Multi-Agent Swarm**: Complex queries ko sub-tasks me decompose karna.
Aap koi bhi sawal pooch sakte hain!`;
      } else {
        finalResponse = `Namaste! Main badhiya hoon. Memora Engine active hai aur aapke commands ke liye ready hai.`;
      }
    }
    // Contextual direct response if memories exist
    else if (relevantMemories.length > 0 && (relevantMemories[0].distance ?? 1) < 0.65) {
      finalResponse = `Based on your semantic memory bank: "${relevantMemories[0].text}". How would you like to proceed or explore this further?`;
    }
  }

  // 4. If still no response, use Ollama manager (local connection or contextual generation)
  if (!finalResponse && !isAirGapped) {
    try {
      const localRes = await ollamaManager.generate(
        query,
        `You are Memora, an intelligent sovereign cognitive agent. Relevant memories:\n${memoryContext}`
      );
      if (localRes.response) {
        finalResponse = localRes.response;
      }
    } catch {
      // Fallback
    }
  }

  // 5. Ultimate conversational guarantee
  if (!finalResponse) {
    finalResponse = `Hello! I am Memora, your sovereign AI cognitive agent. I am ready to calculate, format, convert units, search, and recall semantic memories. How can I assist you right now?`;
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
    reply: finalResponse,
    session_id: sessionId,
    sessionId: sessionId,
    tool_used: toolUsed,
    tool_input: toolInput,
    tool_result: toolResult,
    metadata: {
      usedMemory: relevantMemories.length > 0,
      recalledMemoriesCount: relevantMemories.length,
      model: apiKey && ollamaConfig.mode !== 'airgapped' ? 'gemini-3.8-flash' : (ollamaConfig.selectedModel || 'local'),
    },
  };
}
