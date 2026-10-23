import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchHealth, sendChatMessage, generateIdea } from './api';

describe('Frontend API Client Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchHealth returns offline fallback when backend is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const health = await fetchHealth();
    expect(health.status).toBe('offline');
    expect(health.database_configured).toBe(false);
    expect(health.gemini_configured).toBe(false);
  });

  it('sendChatMessage returns mock response when backend fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Failed to fetch'));

    const res = await sendChatMessage('Hello world');
    expect(res.is_mock).toBe(true);
    expect(res.reply).toContain('Client Fallback');
  });

  it('generateIdea returns fallback structured idea on network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Failed to fetch'));

    const idea = await generateIdea('Robotics', 'Students');
    expect(idea.title).toContain('Robotics');
    expect(idea.target_users).toBe('Students');
    expect(Array.isArray(idea.core_features)).toBe(true);
    expect(idea.suggested_tech_stack).toContain('FastAPI');
  });

  it('sends the chat contract and returns a successful backend response', async () => {
    const response = { reply: 'Hello', model: 'test-model', is_mock: false };
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(response), { status: 200 }),
    );
    expect(await sendChatMessage('Hi', 'Be concise')).toEqual(response);
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/chat$/), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hi', system_instruction: 'Be concise' }),
    });
  });

  it('labels HTTP failures as chat fallback rather than successful live output', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Unavailable', { status: 503 }));
    const response = await sendChatMessage('Hi');
    expect(response.is_mock).toBe(true);
    expect(response.reply).toContain('503');
  });

  it('handles malformed health JSON as offline', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('invalid json', { status: 200 }));
    const response = await fetchHealth();
    expect(response.status).toBe('offline');
    expect(response.error).toBeTruthy();
  });
});
