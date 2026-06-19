import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chat, Message } from '../../types';
import {
  buildAssistantMessage,
  buildAssistantMessageRecord,
  buildBaseMessages,
  buildStreamRequest,
  buildUserMessageRecord,
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

  it('builds base messages with user preferences, chat customization and recent history', () => {
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
        userName: 'David',
        userKnowledge: 'TypeScript',
        userTraits: 'Directo',
        userAdditionalInfo: 'Prefiere español',
      },
      webSearchContext: 'Contexto web',
    });

    expect(baseMessages[0]).toMatchObject({
      role: 'system',
      content: expect.stringContaining('Nombre: David'),
    });
    expect(baseMessages[1]).toEqual({ role: 'system', content: 'Responde con precisión.' });
    expect(baseMessages[2]).toEqual({ role: 'system', content: 'Contexto web' });
    expect(baseMessages).toHaveLength(13);
    expect(baseMessages[baseMessages.length - 1]).toMatchObject({ role: 'user', content: 'Hola' });
  });

  it('creates OpenRouter web search and stream requests from model capabilities', () => {
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
    });

    expect(config.apiModelId).toBe('anthropic/claude-sonnet-4.5');
    expect(config.supportsReasoning).toBe(true);
    expect(config.reasoning).toMatchObject({ enabled: true, max_tokens: 4000 });
    expect(streamRequest).toMatchObject({
      model: 'anthropic/claude-sonnet-4.5',
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 2048,
    });
    expect(streamRequest.tools?.some((tool) => tool.type === 'openrouter:web_search')).toBe(true);
  });

  it('creates local messages and persistence records consistently', () => {
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
    expect(
      buildUserMessageRecord({ message: userMessage, chatId: 'chat-1', userId: 'local-user' })
    ).toMatchObject({
      id: '00000000-0000-4000-8000-000000000000',
      chat_id: 'chat-1',
      role: 'user',
      content: 'Hola',
      user_id: 'local-user',
    });
    expect(
      buildAssistantMessageRecord({
        message: assistantMessage,
        chatId: 'chat-1',
        userId: 'local-user',
      })
    ).toMatchObject({
      id: '00000000-0000-4000-8000-000000000000',
      chat_id: 'chat-1',
      role: 'assistant',
      content: 'Respuesta',
      thinking_content: 'Plan',
      use_web_search: true,
      search_queries: ['consulta'],
      user_id: 'local-user',
    });
  });
});
