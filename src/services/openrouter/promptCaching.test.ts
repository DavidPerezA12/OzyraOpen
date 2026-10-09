import { describe, expect, it } from 'vitest';
import { getPromptCachingParams, supportsAutomaticCacheControl } from './promptCaching';

describe('getPromptCachingParams', () => {
  it('enables automatic cache_control and sticky routing for Anthropic models', () => {
    expect(
      getPromptCachingParams({ apiModelId: 'anthropic/claude-sonnet-4.5', sessionId: 'chat-1' })
    ).toEqual({ cache_control: { type: 'ephemeral' }, session_id: 'chat-1' });
  });

  it('relies on implicit caching (session only) for other providers', () => {
    for (const apiModelId of ['openai/gpt-5', 'google/gemini-2.5-pro', 'deepseek/deepseek-chat']) {
      expect(getPromptCachingParams({ apiModelId, sessionId: 'chat-1' })).toEqual({
        session_id: 'chat-1',
      });
    }
  });

  it('omits session_id when no session is given and truncates long ids', () => {
    expect(getPromptCachingParams({ apiModelId: 'openai/gpt-5' })).toEqual({});
    expect(
      getPromptCachingParams({ apiModelId: 'openai/gpt-5', sessionId: 'x'.repeat(300) }).session_id
    ).toHaveLength(256);
  });

  it('matches Anthropic model aliases', () => {
    expect(supportsAutomaticCacheControl('~anthropic/claude-sonnet-latest')).toBe(true);
    expect(supportsAutomaticCacheControl('openrouter/auto')).toBe(false);
  });
});
