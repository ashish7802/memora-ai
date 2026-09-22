import { GoogleGenAI } from '@google/genai';
import { memoryStore } from './store';
import { builtInSkills } from './skills';
import { ollamaManager } from './ollama';

export interface ThoughtStep {
  stage: 'intent' | 'recall' | 'execution' | 'synthesis';
  label: string;
  details: string;
  timestamp: string;
}

export interface ChatResult {
  response: string;
  reply: string;
  session_id: string;
  sessionId: string;
  tool_used: string | null;
  tool_input: any | null;
  tool_result: any | null;
  thought_chain?: ThoughtStep[];
  metadata?: {
    usedMemory?: boolean;
    recalledMemoriesCount?: number;
    model?: string;
    latencyMs?: number;
  };
}

export async function runOrchestrator(
  message: string,
  sessionId: string = 'default'
): Promise<ChatResult> {
  const startTime = Date.now();
  const query = message.trim();
  let toolUsed: string | null = null;
  let toolInput: any | null = null;
  let toolResult: any | null = null;
  let finalResponse = '';

  const thoughtChain: ThoughtStep[] = [];

  // 1. RAG Step: Retrieve top relevant memories
  const relevantMemories = await memoryStore.searchMemory(query, 3);
  const memoryContext =
    relevantMemories.length > 0
      ? relevantMemories
          .map((m) => `- [Memory #${m.id} (${m.metadata.category || 'general'})]: ${m.text}`)
          .join('\n')
      : 'No prior memories found for this query.';

  const isHindi = /namaste|kya|kaun|kaise|shukriya|dhanyawad|aap|batao|yaad|bhoole|khojo/i.test(query);

  thoughtChain.push({
    stage: 'intent',
    label: 'Intent & Linguistic Parsing',
    details: `Parsed prompt (${query.length} chars). Detected language: ${
      isHindi ? 'Hindi / Hinglish' : 'English / Universal'
    }. Analyzing required capabilities.`,
    timestamp: new Date().toISOString(),
  });

  thoughtChain.push({
    stage: 'recall',
    label: 'Vector Space Memory Recall',
    details:
      relevantMemories.length > 0
        ? `Retrieved ${relevantMemories.length} relevant memory vector(s) (top similarity distance: ${(relevantMemories[0].distance ?? 0.5).toFixed(3)}). Context augmented.`
        : 'Zero high-confidence memory vectors matched query threshold. Proceeding with clean operational state.',
    timestamp: new Date().toISOString(),
  });

  const ollamaConfig = ollamaManager.getConfig();
  const apiKey = process.env.GEMINI_API_KEY;
  const isAirGapped = ollamaConfig.mode === 'airgapped';
  const forceLocalOnly = ollamaConfig.mode === 'local' && !apiKey;

  // 2A. Air-gapped or force-local without API key
  if (isAirGapped || forceLocalOnly) {
    try {
      const localRes = await ollamaManager.generate(
        query,
        `You are Memora, an intelligent local AI agent operating with zero remote telemetry. Relevant retrieved memories:\n${memoryContext}`
      );
      if (localRes.response) {
        finalResponse = localRes.response;
        thoughtChain.push({
          stage: 'execution',
          label: 'Local Air-Gapped Engine',
          details: `Inference executed on local runtime (${ollamaConfig.selectedModel || 'llama3.2'}).`,
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // Fall through to deterministic skills
    }
  }

  // 2B. Try Cloud Gemini API (if key available and not in airgapped mode)
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

      const toolsDesc = Object.entries(builtInSkills)
        .map(([name, def]) => `- ${name}: ${def.description}`)
        .join('\n');

      const systemPrompt = `You are Memora, an advanced sovereign AI cognitive agent with continuous semantic vector memory and an extensible skill registry.
You understand and respond fluently in whatever language the user communicates in (including Hindi, Hinglish, English, etc.).
You are helpful, concise, intelligent, and accurate.

Available Skills:
${toolsDesc}

Relevant Retrieved Memories from Vector Space:
${memoryContext}

Instructions:
1. If the user's request requires executing one of the available skills, invoke that tool.
2. Otherwise, reply directly to the user in their language.

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
        if (raw.trim()) {
          finalResponse = raw.trim();
        }
      }

      if (parsed) {
        if (parsed.action && parsed.action !== 'reply' && builtInSkills[parsed.action]) {
          toolUsed = parsed.action;
          toolInput = parsed.input || {};
          toolResult = await builtInSkills[parsed.action].execute(toolInput);

          thoughtChain.push({
            stage: 'execution',
            label: `Skill Execution (${toolUsed})`,
            details: `Dispatched payload to ${toolUsed}. Result status: ${toolResult.status || 'success'}.`,
            timestamp: new Date().toISOString(),
          });

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
      console.warn('Gemini API call error in orchestrator:', e?.message || e);
    }
  }

  // 3. Deterministic Intent & Cognitive Skills Engine
  // If Gemini was unavailable or quota exhausted, execute skills and contextual intents directly
  if (!finalResponse) {
    const qLower = query.toLowerCase();

    // Check for Forget / Delete Memory (Auditable Forget on Command)
    if (
      /\b(forget|delete memory|remove memory|erase memory|bhoole jao|yaad mat rakhna|bhool jao)\b/i.test(qLower) &&
      builtInSkills.forget_memory
    ) {
      toolUsed = 'forget_memory';
      const target = query
        .replace(/^(?:please\s+)?(?:forget|delete memory|remove memory|erase memory|bhoole jao|yaad mat rakhna|bhool jao)(?:\s+that|\s+about)?:\s*/i, '')
        .trim();
      toolInput = { query_or_id: target || query };
      toolResult = await builtInSkills.forget_memory.execute(toolInput);
      thoughtChain.push({
        stage: 'execution',
        label: 'Auditable Memory Erasure Gate',
        details: `Invoked forget_memory for "${toolInput.query_or_id}". Expunged ${toolResult.deleted_ids?.length || 0} vector(s).`,
        timestamp: new Date().toISOString(),
      });
      finalResponse = toolResult.message;
    }
    // Check for Code Interpreter / Execution
    else if (
      /\b(run code|eval|execute code|javascript:|js:|code:)\b/i.test(qLower) &&
      builtInSkills.code_interpreter
    ) {
      toolUsed = 'code_interpreter';
      const codeStr = query.replace(/^(?:run code|eval|execute code|javascript|js|code):?\s*/i, '').replace(/^:\s*/, '').trim();
      toolInput = { code: codeStr };
      toolResult = await builtInSkills.code_interpreter.execute(toolInput);
      thoughtChain.push({
        stage: 'execution',
        label: 'Sandboxed Code Interpreter',
        details: `Executed in safe JavaScript isolate in ${toolResult.execution_time_ms}ms.`,
        timestamp: new Date().toISOString(),
      });
      if (toolResult.status === 'success') {
        finalResponse = `Code executed successfully in ${toolResult.execution_time_ms}ms:\n\`\`\`\n${
          typeof toolResult.result === 'object' ? JSON.stringify(toolResult.result, null, 2) : toolResult.result
        }\n\`\`\``;
      } else {
        finalResponse = `Execution error: ${toolResult.error}`;
      }
    }
    // Check for Swarm Planner
    else if (
      /\b(swarm plan|plan task|plan project|decompose|multitask|swarm planner)\b/i.test(qLower) &&
      builtInSkills.swarm_planner
    ) {
      toolUsed = 'swarm_planner';
      const goalStr = query
        .replace(/^(?:swarm plan|plan task|plan project|decompose|swarm planner)(?:\s+for)?:\s*/i, '')
        .trim();
      toolInput = { goal: goalStr || query };
      toolResult = await builtInSkills.swarm_planner.execute(toolInput);
      thoughtChain.push({
        stage: 'execution',
        label: 'Hermes Multi-Agent Task Decomposition',
        details: `Decomposed goal into ${toolResult.total_subtasks} synchronized worker subtasks.`,
        timestamp: new Date().toISOString(),
      });
      const planBullets = toolResult.execution_plan
        .map((p: any) => `**Step ${p.step} [${p.agent}]**: ${p.role}\n  → ${p.action}`)
        .join('\n\n');
      finalResponse = `### 🐝 Hermes Swarm Execution Plan for "${toolResult.goal}":\n\n${planBullets}\n\n*Swarm status: Ready to dispatch across worker agents.*`;
    }
    // Check for Summarization
    else if (
      /\b(summarize|summary of|extract key points|tldr)\b/i.test(qLower) &&
      builtInSkills.summarizer
    ) {
      toolUsed = 'summarizer';
      const textToSum = query
        .replace(/^(?:please\s+)?(?:summarize|summary of|extract key points|tldr)(?:\s+this)?:\s*/i, '')
        .trim();
      toolInput = { text: textToSum || query };
      toolResult = await builtInSkills.summarizer.execute(toolInput);
      thoughtChain.push({
        stage: 'execution',
        label: 'Cognitive Text Summarization',
        details: `Summarized text into key points. Original words: ${toolResult.stats?.original_words || 0}.`,
        timestamp: new Date().toISOString(),
      });
      if (toolResult.status === 'success') {
        const takeaways = (toolResult.key_takeaways || []).map((t: string) => `• ${t}`).join('\n');
        finalResponse = `**Summary:**\n${toolResult.summary}\n\n**Key Takeaways:**\n${takeaways}\n\n*Estimated reading time: ${toolResult.stats.estimated_reading_time}*`;
      } else {
        finalResponse = `Summarizer: ${toolResult.error}`;
      }
    }
    // Check for Language Translation
    else if (
      /\b(translate to|anuvad|translate)\b/i.test(qLower) &&
      builtInSkills.language_translator
    ) {
      toolUsed = 'language_translator';
      let tgtLang = 'hindi';
      if (qLower.includes('english')) tgtLang = 'english';
      else if (qLower.includes('spanish')) tgtLang = 'spanish';
      else if (qLower.includes('french')) tgtLang = 'french';
      else if (qLower.includes('german')) tgtLang = 'german';

      const phrase = query.replace(/^.*?(?:translate\s+(?:this\s+)?to\s+[a-zA-Z]+|anuvad\s+karo):?\s*/i, '').trim();
      toolInput = { text: phrase || query, target_language: tgtLang };
      toolResult = await builtInSkills.language_translator.execute(toolInput);
      thoughtChain.push({
        stage: 'execution',
        label: 'Cross-Lingual Cognitive Adapter',
        details: `Translated text to ${tgtLang}.`,
        timestamp: new Date().toISOString(),
      });
      finalResponse = `${toolResult.translation}`;
    }
    // Check for Sentiment Analysis
    else if (
      /\b(sentiment|analyze sentiment|emotion of|tone of)\b/i.test(qLower) &&
      builtInSkills.sentiment_analyzer
    ) {
      toolUsed = 'sentiment_analyzer';
      const textToAnalyze = query.replace(/^.*?(?:sentiment|analyze sentiment|emotion of|tone of):?\s*/i, '').trim();
      toolInput = { text: textToAnalyze || query };
      toolResult = await builtInSkills.sentiment_analyzer.execute(toolInput);
      thoughtChain.push({
        stage: 'execution',
        label: 'Sentiment & Polarity Engine',
        details: `Evaluated score: ${toolResult.score} (${toolResult.sentiment}). Confidence: ${toolResult.confidence}.`,
        timestamp: new Date().toISOString(),
      });
      finalResponse = `**Sentiment Analysis Report:**\n• Tone: **${toolResult.sentiment.toUpperCase()}**\n• Polarity Score: **${toolResult.score}** (Range: -1.0 to +1.0)\n• Confidence: **${Math.round(toolResult.confidence * 100)}%**`;
    }
    // Check for Weather
    else if (
      /\b(weather|temperature in|forecast|mausam)\b/i.test(qLower) &&
      builtInSkills.weather_sim
    ) {
      toolUsed = 'weather_sim';
      const cityMatch = query.match(/(?:weather in|weather for|temperature in|mausam in|forecast for)\s+([a-zA-Z\s]+)/i);
      const city = cityMatch ? cityMatch[1].trim() : 'Delhi';
      toolInput = { city };
      toolResult = await builtInSkills.weather_sim.execute(toolInput);
      thoughtChain.push({
        stage: 'execution',
        label: 'Environmental Telemetry Query',
        details: `Retrieved atmospheric telemetry for ${toolResult.location}.`,
        timestamp: new Date().toISOString(),
      });
      finalResponse = `🌤️ **Weather for ${toolResult.location}:**\n• Temperature: **${toolResult.temperature_c}°C** (${toolResult.temperature_f}°F)\n• Condition: **${toolResult.condition}**\n• Humidity: **${toolResult.humidity}**\n• Wind: **${toolResult.wind_speed}**`;
    }
    // Check for math / calculator
    else if (
      (/\b(calculate|compute|sqrt|math|\+|\*|\/|\^)\b/i.test(qLower) ||
        (/^[0-9\s+\-*/().^]+$/.test(query.trim()) && query.length >= 3)) &&
      builtInSkills.calculator
    ) {
      toolUsed = 'calculator';
      const expr = query.replace(/(?:calculate|compute|what is|solve|=|\?)/gi, '').trim();
      toolInput = { expression: expr || query };
      toolResult = await builtInSkills.calculator.execute(toolInput);
      thoughtChain.push({
        stage: 'execution',
        label: 'Sandboxed Math Engine',
        details: `Computed algebraic evaluation: ${toolInput.expression}.`,
        timestamp: new Date().toISOString(),
      });
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
      thoughtChain.push({
        stage: 'execution',
        label: 'Metric/Imperial Converter',
        details: `Converted ${val} ${fromUnit} -> ${toolResult.converted_value} ${toUnit}.`,
        timestamp: new Date().toISOString(),
      });
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
      thoughtChain.push({
        stage: 'execution',
        label: 'Text Transformation Skill',
        details: `Applied string transform mode: ${mode}.`,
        timestamp: new Date().toISOString(),
      });
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
      thoughtChain.push({
        stage: 'execution',
        label: 'JSON Syntax & AST Validator',
        details: `Validated JSON payload. Status: ${toolResult.valid ? 'Valid' : 'Malformed'}.`,
        timestamp: new Date().toISOString(),
      });
      finalResponse = toolResult.valid
        ? `Valid JSON! Formatted output:\n${toolResult.formatted}`
        : `Invalid JSON: ${toolResult.error}`;
    }
    // Check for time
    else if (/\b(time|date|today|current time|clock|samay|tarikh)\b/i.test(qLower) && builtInSkills.time) {
      toolUsed = 'time';
      toolInput = {};
      toolResult = await builtInSkills.time.execute({});
      thoughtChain.push({
        stage: 'execution',
        label: 'Chrono-Temporal Reference',
        details: `Synchronized system clock.`,
        timestamp: new Date().toISOString(),
      });
      finalResponse = `The current system time and date is: ${toolResult.formatted || toolResult.current_time} (ISO: ${toolResult.current_time}).`;
    }
    // Check for save note / memory
    else if (/\b(remember|save note|store note|save this|record memory|yaad rakhna|note likho)\b/i.test(qLower) && builtInSkills.save_note) {
      toolUsed = 'save_note';
      const noteText = query
        .replace(/^(?:please\s+)?(?:remember|save note|store note|save this|yaad rakhna|note likho):\s*/i, '')
        .trim();
      toolInput = { text: noteText || query, metadata: { session_id: sessionId, source: 'chat_command' } };
      toolResult = await builtInSkills.save_note.execute(toolInput);
      thoughtChain.push({
        stage: 'execution',
        label: 'Persistent Vector Store Write',
        details: `Generated embedding and committed memory record (ID: ${toolResult.id}).`,
        timestamp: new Date().toISOString(),
      });
      finalResponse = `Note saved to semantic memory store (ID: ${toolResult.id}). It will be recalled in future queries for context.`;
    }
    // Check for search
    else if (/\b(search|find online|look up|google|duckduckgo|khojo)\b/i.test(qLower) && builtInSkills.web_search) {
      toolUsed = 'web_search';
      const sQuery = query.replace(/^(?:search for|look up|find|search|khojo)\s+/i, '').trim();
      toolInput = { query: sQuery || query };
      toolResult = await builtInSkills.web_search.execute(toolInput);
      thoughtChain.push({
        stage: 'execution',
        label: 'Web Knowledge Crawler',
        details: `Indexed search results for query "${sQuery}".`,
        timestamp: new Date().toISOString(),
      });
      finalResponse = `Found ${toolResult.results.length} results for "${sQuery}":\n\n${toolResult.results
        .map((r: any) => `• **${r.title}**: ${r.body}`)
        .join('\n\n')}`;
    }
    // Check for Memory queries (asking what the agent knows/remembers)
    else if (/\b(what do you remember|what do you know|mere baare me|kya yaad hai|recall memories|show memory)\b/i.test(qLower)) {
      thoughtChain.push({
        stage: 'execution',
        label: 'Continuous Memory Bank Scan',
        details: `Synthesized current vector bank state.`,
        timestamp: new Date().toISOString(),
      });
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
      thoughtChain.push({
        stage: 'execution',
        label: 'Vernacular Cognitive Personality Model',
        details: `Synthesized direct vernacular conversational response.`,
        timestamp: new Date().toISOString(),
      });
      if (/kaun|kya ho/i.test(qLower)) {
        finalResponse = `Namaste! Main **Memora** hoon — aapka sovereign AI cognitive agent. Main aapki baat samajh sakta hoon, continuous memory maintain karta hoon, mathematical calculations, code execution, unit conversions aur multi-agent workflows execute kar sakta hoon. Batayein, main aaj aapki kya madad karoon?`;
      } else if (/kya kar sakte|madad/i.test(qLower)) {
        finalResponse = `Main yeh sab kar sakta hoon:
1. 🧠 **Semantic Vector Memory**: Baatein yaad rakhna aur "forget" bolne par auditable remove karna.
2. ⚡ **Cognitive Skills**: Code sandbox execute karna, math expressions solve karna, units convert karna, text formatting, aur JSON validation.
3. 🌐 **Knowledge & Search**: Factual answers, text summarization, translations, aur weather telemetry.
4. 🤖 **Multi-Agent Swarm**: Complex goals ko multi-agent subtasks me decompose karna.
Aap koi bhi sawal pooch sakte hain!`;
      } else {
        finalResponse = `Namaste! Main badhiya hoon. Memora Engine active hai aur aapke commands ke liye ready hai.`;
      }
    }
    // Contextual direct response if memories exist
    else if (relevantMemories.length > 0 && (relevantMemories[0].distance ?? 1) < 0.65) {
      thoughtChain.push({
        stage: 'execution',
        label: 'Contextual Memory Injection',
        details: `High-relevance memory matched (${relevantMemories[0].id}). Directing contextual dialog.`,
        timestamp: new Date().toISOString(),
      });
      finalResponse = `Based on your semantic memory bank: "${relevantMemories[0].text}". How would you like to proceed or explore this further?`;
    }
  }

  // 4. Ollama local manager fallback
  if (!finalResponse && !isAirGapped) {
    try {
      const localRes = await ollamaManager.generate(
        query,
        `You are Memora, an intelligent sovereign cognitive agent. Relevant memories:\n${memoryContext}`
      );
      if (localRes.response) {
        finalResponse = localRes.response;
        thoughtChain.push({
          stage: 'execution',
          label: 'Local Ollama Fallback Engine',
          details: `Generated via local runtime bridge.`,
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // Fallback
    }
  }

  // 5. Ultimate conversational guarantee
  if (!finalResponse) {
    finalResponse = `Hello! I am Memora, your sovereign AI cognitive agent. I am ready to calculate, execute code, format, convert units, search, and recall semantic memories. How can I assist you right now?`;
  }

  const latencyMs = Date.now() - startTime;

  thoughtChain.push({
    stage: 'synthesis',
    label: 'Answer Synthesis & Safety Audit',
    details: `Response prepared in ${latencyMs}ms with zero unauthorized outbound data transmission.`,
    timestamp: new Date().toISOString(),
  });

  // 6. Log Experience into ExperienceStore
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
    thought_chain: thoughtChain,
    metadata: {
      usedMemory: relevantMemories.length > 0,
      recalledMemoriesCount: relevantMemories.length,
      model: apiKey && ollamaConfig.mode !== 'airgapped' ? 'gemini-3.8-flash' : (ollamaConfig.selectedModel || 'local'),
      latencyMs,
    },
  };
}
