import { describe, expect, it } from 'vitest';

import { buildOpenRouterPayload } from './buildPayload';
import type { ChatCompletionRequest } from './types';

describe('buildOpenRouterPayload', () => {
  it('maps image attachments to OpenRouter multimodal content', () => {
    const payload = buildOpenRouterPayload({
      model: 'vision-model',
      messages: [
        {
          role: 'user',
          content: 'Describe this',
          images: [
            {
              url: 'blob:local-preview',
              contentType: 'image/png',
              data: 'abc123',
            },
          ],
        },
      ],
    });

    expect(payload.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this' },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,abc123' },
          },
        ],
      },
    ]);
  });

  it('preserves assistant tool calls and tool results', () => {
    const request: ChatCompletionRequest = {
      model: 'tool-model',
      messages: [
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'call-1',
              type: 'function',
              function: { name: 'get_current_time', arguments: '{}' },
            },
          ],
        },
        {
          role: 'tool',
          tool_call_id: 'call-1',
          content: '2026-06-11T12:00:00.000Z',
        },
      ],
    };

    expect(buildOpenRouterPayload(request).messages).toEqual(request.messages);
  });

  it('preserves OpenRouter web search server tools', () => {
    const request: ChatCompletionRequest = {
      model: 'openai/gpt-5.2',
      messages: [{ role: 'user', content: 'Busca noticias recientes' }],
      tools: [
        {
          type: 'openrouter:web_search',
          parameters: {
            max_results: 5,
            search_context_size: 'medium',
          },
        },
      ],
      tool_choice: 'auto',
    };

    expect(buildOpenRouterPayload(request)).toMatchObject({
      model: 'openai/gpt-5.2',
      tools: [
        {
          type: 'openrouter:web_search',
          parameters: {
            max_results: 5,
            search_context_size: 'medium',
          },
        },
      ],
      tool_choice: 'auto',
    });
  });
});
