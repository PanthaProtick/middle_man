const API_BASE: string = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export interface HealthStatus {
  status: string;
  project_name: string;
  environment: string;
  database_configured: boolean;
  gemini_configured: boolean;
  clerk_configured?: boolean;
  version?: string;
  error?: string;
}

export interface ChatResponse {
  reply: string;
  model: string;
  conversation_id?: string;
  is_mock: boolean;
}

export interface HackathonIdea {
  title: string;
  tagline: string;
  target_users: string;
  core_features: string[];
  suggested_tech_stack: string[];
  winning_pitch_hook: string;
}

export interface Item {
  id: string;
  title: string;
  description: string;
  tags: string[];
  created_at: string;
}

export interface ItemCreatePayload {
  title: string;
  description: string;
  tags?: string[];
}

export async function fetchHealth(): Promise<HealthStatus> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      status: 'offline',
      project_name: 'Dev Template API (Unreachable)',
      environment: 'local',
      database_configured: false,
      gemini_configured: false,
      error: errorMessage
    };
  }
}

export async function sendChatMessage(message: string, systemInstruction?: string): Promise<ChatResponse> {
  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, system_instruction: systemInstruction })
    });
    if (!res.ok) throw new Error(`Chat error! status: ${res.status}`);
    return await res.json();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      reply: `[Client Fallback] Could not reach backend: ${errorMessage}. Please ensure the FastAPI backend is running on port 8000.`,
      model: 'client-offline-fallback',
      is_mock: true
    };
  }
}

export async function generateIdea(topic: string, targetAudience?: string): Promise<HackathonIdea> {
  try {
    const res = await fetch(`${API_BASE}/generate-idea`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, target_audience: targetAudience })
    });
    if (!res.ok) throw new Error(`Generation error! status: ${res.status}`);
    return await res.json();
  } catch {
    return {
      title: `${topic || 'Hackathon'} Solution Hub`,
      tagline: 'Rapid prototyping engine for hackathon validation.',
      target_users: targetAudience || 'Hackathon Participants & End Users',
      core_features: [
        'Instant AI inference and prompt chaining',
        'Decoupled client architecture with FastAPI',
        'Postgres serverless persistence on Neon'
      ],
      suggested_tech_stack: ['React', 'FastAPI', 'Neon', 'Gemini', 'uv'],
      winning_pitch_hook: 'Validates concepts with high velocity and clean modular architecture.'
    };
  }
}

export async function fetchItems(): Promise<Item[]> {
  try {
    const res = await fetch(`${API_BASE}/items`);
    if (!res.ok) throw new Error(`Items error! status: ${res.status}`);
    return await res.json();
  } catch {
    return [];
  }
}

export async function createItem(item: ItemCreatePayload): Promise<Item> {
  try {
    const res = await fetch(`${API_BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    if (!res.ok) throw new Error(`Create item error! status: ${res.status}`);
    return await res.json();
  } catch {
    return {
      id: Math.random().toString(36).substring(7),
      title: item.title,
      description: item.description,
      tags: item.tags || [],
      created_at: new Date().toISOString()
    };
  }
}

