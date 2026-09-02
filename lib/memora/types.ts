export interface MemoryItem {
  id: string;
  text: string;
  metadata: {
    source?: string;
    category?: string;
    timestamp?: string;
    session_id?: string;
    [key: string]: any;
  };
  embedding?: number[];
  distance?: number;
}

export interface SkillDefinition {
  name: string;
  description: string;
  execute: (params: any) => Promise<any> | any;
  inputSchema?: Record<string, any>;
}

export interface SkillProposal {
  skill_name: string;
  description: string;
  use_case: string;
  example_queries: string[];
  confidence_score: number;
  tool_input_schema: Record<string, any>;
  status: 'proposed' | 'integrated';
  created_at: string;
}

export interface ExperienceRecord {
  session_id: string;
  user_query: string;
  agent_response: string;
  tool_used: string | null;
  tool_input: any | null;
  tool_result: any | null;
  success: boolean;
  timestamp: string;
  feedback_score?: number | null;
}

export interface UserModel {
  user_id: string;
  preferences: {
    language: string;
    topics: string[];
    tool_preferences: Record<string, any>;
    preferred_tools: string[];
  };
  interaction_count: number;
  avg_confidence: number;
  last_seen: string;
}
