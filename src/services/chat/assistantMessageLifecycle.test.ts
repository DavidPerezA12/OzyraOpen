import { describe, expect, it } from 'vitest';
import type { Message } from '../../types';
import {
  applyAssistantDraftUpdate,
  applyFinalAssistantMessage,
  markAssistantMessageInterrupted,
} from './assistantMessageLifecycle';

const assistantMessage = (overrides: Partial<Message> = {}): Message => ({
  id: 'assistant-1',
  role: 'assistant',
  content: 'draft',
  timestamp: 10,
  model: 'openai/gpt-5-chat',
  ...overrides,
});

describe('assistantMessageLifecycle', () => {
  it('applies partial stream updates without losing unchanged fields', () => {
    expect(
      applyAssistantDraftUpdate(assistantMessage({ thinkingContent: 'old plan' }), {
        partialResponse: 'partial answer',
      })
    ).toMatchObject({
      content: 'partial answer',
      thinkingContent: 'old plan',
      model: 'openai/gpt-5-chat',
    });
  });

  it('clears thinking content when the stream update supplies an empty value', () => {
    expect(
      applyAssistantDraftUpdate(assistantMessage({ thinkingContent: 'old plan' }), {
        thinkingProcessContent: '',
      }).thinkingContent
    ).toBeUndefined();
  });

  it('replaces a draft with final assistant fields while preserving draft identity metadata', () => {
    const finalMessage = assistantMessage({
      id: 'assistant-1',
      content: 'final answer',
      timestamp: 99,
      thinkingContent: 'final plan',
      useWebSearch: true,
      searchQueries: ['query'],
      annotations: [
        {
          type: 'url_citation',
          url_citation: { url: 'https://example.com', title: 'Example' },
        },
      ],
    });

    expect(applyFinalAssistantMessage(assistantMessage({ timestamp: 10 }), finalMessage)).toEqual({
      ...assistantMessage({ timestamp: 10 }),
      content: 'final answer',
      thinkingContent: 'final plan',
      useWebSearch: true,
      searchQueries: ['query'],
      annotations: finalMessage.annotations,
    });
  });

  it('marks interrupted assistant messages using the latest partial response and thinking content', () => {
    expect(
      markAssistantMessageInterrupted({
        message: assistantMessage({ content: 'old draft', thinkingContent: 'old plan' }),
        partialResponse: 'latest partial',
        thinkingContent: 'latest plan',
      })
    ).toMatchObject({
      content: 'latest partial\n\n_(Generación interrumpida por el usuario)_',
      thinkingContent: 'latest plan',
    });
  });
});
