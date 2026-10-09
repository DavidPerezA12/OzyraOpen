import { describe, expect, it } from 'vitest';
import type { Chat, Message } from '../../types';
import { fromChatRecord, fromMessageRecord, toChatRecord, toMessageRecord } from './chatRecords';

const assistantMessage: Message = {
  id: 'assistant-1',
  role: 'assistant',
  content: '  Respuesta  ',
  timestamp: 20,
  model: 'openai/gpt-5-chat',
  thinkingContent: 'Plan',
  useWebSearch: true,
  searchQueries: ['consulta'],
  annotations: [
    { type: 'url_citation', url_citation: { url: 'https://example.com', title: 'Example' } },
  ],
};

const userMessage: Message = {
  id: 'user-1',
  role: 'user',
  content: 'Hola',
  timestamp: 10,
  model: 'openai/gpt-5-chat',
  useWebSearch: false,
  attachments: [{ type: 'image', name: 'a.png', url: 'blob:a', contentType: 'image/png' }],
};

describe('chatRecords', () => {
  it('maps messages to records for the local profile, trimming content', () => {
    expect(toMessageRecord(assistantMessage, 'chat-1')).toEqual({
      id: 'assistant-1',
      chat_id: 'chat-1',
      role: 'assistant',
      content: 'Respuesta',
      timestamp: 20,
      model: 'openai/gpt-5-chat',
      thinking_content: 'Plan',
      use_web_search: true,
      search_queries: ['consulta'],
      annotations: assistantMessage.annotations,
      attachments: undefined,
      user_id: 'local-user',
    });
    expect(toMessageRecord({ ...userMessage, role: 'model' }, 'chat-1').role).toBe('assistant');
  });

  it('round-trips messages through records', () => {
    const record = toMessageRecord(userMessage, 'chat-1');
    expect(fromMessageRecord(record, 'fallback/model')).toEqual(userMessage);
    expect(fromMessageRecord({ ...record, model: undefined }, 'fallback/model').model).toBe(
      'fallback/model'
    );
  });

  it('round-trips chats through records', () => {
    const chat: Chat = {
      id: 'chat-1',
      title: 'Chat',
      messages: [userMessage],
      createdAt: Date.UTC(2026, 0, 1),
      model: 'openai/gpt-5-chat',
      isPinned: true,
      customizationPrompt: 'Sé breve',
      isPersisted: true,
    };

    const record = toChatRecord(chat);
    expect(record).toEqual({
      id: 'chat-1',
      title: 'Chat',
      user_id: 'local-user',
      model: 'openai/gpt-5-chat',
      customization_prompt: 'Sé breve',
      is_pinned: true,
      created_at: '2026-01-01T00:00:00.000Z',
    });
    expect(
      fromChatRecord(
        { ...record, created_at: record.created_at ?? '' },
        chat.messages.map((message) => toMessageRecord(message, chat.id))
      )
    ).toEqual(chat);
  });
});
