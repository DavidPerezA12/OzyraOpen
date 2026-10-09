import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chat, Message } from '../../types';
import {
  buildAssistantMessage,
  buildBaseMessages,
  buildStreamRequest,
  createAssistantDraft,
  createUserMessage,
  createWebSearchTool,
  getStreamRequestConfig,
  mapMessageToChatMessage,
} from './generationPipeline';

const baseChat = (messages: Message[] = []): Chat => ({
  id: 'chat-1',
  title: 'Chat local',
  messages,
  createdAt: 1,
  model: 'anthropic/claude-sonnet-4.5-reasoning',
  customizationPrompt: 'Responde con precisión.',
  isPersisted: true,
});

describe('generationPipeline', () => {
  beforeEach(() => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000000');
  });

  it('maps local image attachments to OpenRouter chat messages', () => {
    expect(
      mapMessageToChatMessage({
        id: 'msg-1',
        role: 'user',
        content: 'Describe esto',
        timestamp: 10,
        attachments: [
          {
            type: 'image',
            name: 'captura.png',
            url: 'blob:preview',
            contentType: 'image/png',
            data: 'abc123',
          },
        ],
      })
    ).toEqual({
      role: 'user',
      content: 'Describe esto',
      images: [
        {
          url: 'blob:preview',
          contentType: 'image/png',
          data: 'abc123',
        },
      ],
    });
  });

  it('builds base messages with stable system prompts, history and the web context last', () => {
    const userMessage = createUserMessage({
      content: 'Hola',
      images: [],
      model: 'openai/gpt-5-chat',
      useWebSearch: true,
    });
    const messages = Array.from(
      { length: 12 },
      (_, index): Message => ({
        id: `m-${index}`,
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `mensaje ${index}`,
        timestamp: index,
      })
    );

    const baseMessages = buildBaseMessages({
      chat: baseChat([...messages, userMessage]),
      preferences: {
        name: 'David',
        knowledge: 'TypeScript',
        traits: 'Directo',
        additionalInfo: 'Prefiere español',
      },
      webSearchContext: 'Contexto web',
    });

    expect(baseMessages[0]).toMatchObject({
      role: 'system',
      content: expect.stringContaining('Nombre: David'),
    });
    expect(baseMessages[1]).toEqual({
      role: 'system',
      content:
        '--- INICIO PERSONALIZACIÓN DEL CHAT (preferencias del usuario) ---\nResponde con precisión.\n--- FIN PERSONALIZACIÓN DEL CHAT ---',
    });
    // Sin system intermedios: el contexto web no rompe el prefijo cacheable.
    expect(baseMessages.slice(2).every((message) => message.role !== 'system')).toBe(true);
    expect(baseMessages).toHaveLength(2 + 13);
    expect(baseMessages[2]).toMatchObject({ role: 'user', content: 'mensaje 0' });
    expect(baseMessages[baseMessages.length - 1]).toEqual({
      role: 'user',
      content: 'Contexto web\n\n--- MENSAJE DEL USUARIO ---\nHola',
    });
  });

  it('keeps the request prefix identical between consecutive turns', () => {
    const preferences = {
      name: 'David',
      knowledge: '',
      traits: '',
      additionalInfo: '',
    };
    let history: Message[] = [];
    let previous: ReturnType<typeof buildBaseMessages> | null = null;
    let prefixBreaks = 0;

    for (let turn = 0; turn < 60; turn += 1) {
      history = [
        ...history,
        { id: `u-${turn}`, role: 'user', content: `pregunta ${turn}`, timestamp: turn * 2 },
      ];
      const current = buildBaseMessages({ chat: baseChat(history), preferences });
      if (previous) {
        const sharedPrefix = previous.slice(0, -1);
        const stillPrefix = sharedPrefix.every(
          (message, index) => JSON.stringify(message) === JSON.stringify(current[index])
        );
        if (!stillPrefix) {
          prefixBreaks += 1;
        }
      }
      previous = [...current, { role: 'assistant', content: `respuesta ${turn}` }];
      history = [
        ...history,
        {
          id: `a-${turn}`,
          role: 'assistant',
          content: `respuesta ${turn}`,
          timestamp: turn * 2 + 1,
        },
      ];
    }

    // Los 20 primeros turnos caben enteros (≤ 40 mensajes); después el inicio
    // avanza en saltos de 10 mensajes, es decir, cada 5 turnos: 8 cambios de
    // prefijo en 60 turnos (una ventana deslizante de 10 mensajes rompía 55).
    expect(prefixBreaks).toBe(8);
  });

  it('builds a reasoning stream request with a token budget, tools and prompt caching', () => {
    const webSearchTool = createWebSearchTool();
    expect(webSearchTool).toMatchObject({
      type: 'openrouter:web_search',
      parameters: {
        max_results: 5,
        search_context_size: 'medium',
      },
    });

    const config = getStreamRequestConfig({
      modelId: 'anthropic/claude-sonnet-4.5-reasoning:online',
      useWebSearchTool: true,
      reasoningLevel: 'high',
    });
    const streamRequest = buildStreamRequest({
      baseMessages: [{ role: 'user', content: 'Busca algo' }],
      config,
      sessionId: 'chat-1',
    });

    expect(config.apiModelId).toBe('anthropic/claude-sonnet-4.5');
    expect(config.supportsReasoning).toBe(true);
    expect(config.reasoning).toEqual({ max_tokens: 16384 });
    expect(streamRequest).toMatchObject({
      model: 'anthropic/claude-sonnet-4.5',
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 8192 + 16384,
      cache_control: { type: 'ephemeral' },
      session_id: 'chat-1',
    });
    expect(streamRequest.max_tokens).toBeGreaterThan(config.reasoning?.max_tokens ?? 0);
    expect(streamRequest.tools?.some((tool) => tool.type === 'openrouter:web_search')).toBe(true);
  });

  it('uses effort-based reasoning and no explicit cache_control for OpenAI models', () => {
    const config = getStreamRequestConfig({
      modelId: 'openai/gpt-5',
      useWebSearchTool: false,
      reasoningLevel: 'low',
    });
    const streamRequest = buildStreamRequest({
      baseMessages: [{ role: 'user', content: 'Hola' }],
      config,
      sessionId: 'chat-2',
    });

    expect(config.reasoning).toEqual({ effort: 'low' });
    expect(streamRequest.max_tokens).toBe(8192 + 2048);
    expect(streamRequest.cache_control).toBeUndefined();
    expect(streamRequest.session_id).toBe('chat-2');
    expect(streamRequest.tools).toBeUndefined();
  });

  it('creates local user, draft and final assistant messages', () => {
    const userMessage = createUserMessage({
      content: '  Hola  ',
      images: [{ url: 'blob:preview', contentType: 'image/jpeg', data: 'xyz' }],
      model: 'openai/gpt-5-chat',
      useWebSearch: false,
    });
    const assistantDraft = createAssistantDraft({
      model: 'openai/gpt-5-chat',
      useWebSearch: true,
    });
    const assistantMessage = buildAssistantMessage({
      id: assistantDraft.id,
      content: 'Respuesta',
      model: 'openai/gpt-5-chat',
      thinkingContent: 'Plan',
      useWebSearch: true,
      searchQueries: ['consulta'],
      annotations: [
        {
          type: 'url_citation',
          url_citation: { url: 'https://example.com', title: 'Example' },
        },
      ],
    });

    expect(userMessage).toMatchObject({
      id: '00000000-0000-4000-8000-000000000000',
      role: 'user',
      content: '  Hola  ',
      attachments: [{ type: 'image', contentType: 'image/jpeg', data: 'xyz' }],
    });
    expect(assistantDraft).toMatchObject({
      id: '00000000-0000-4000-8000-000000000000',
      role: 'assistant',
      content: '',
      useWebSearch: true,
    });
    expect(assistantMessage).toMatchObject({
      id: assistantDraft.id,
      role: 'assistant',
      content: 'Respuesta',
      thinkingContent: 'Plan',
      searchQueries: ['consulta'],
    });
  });
});
