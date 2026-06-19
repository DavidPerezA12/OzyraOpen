import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chat, Message } from '../../types';
import { createLocalChat, updateMessageInChat, upsertChat } from './chatState';

const message = (id: string, content: string): Message => ({
  id,
  role: 'user',
  content,
  timestamp: 1,
});

const chat = (id: string, messages: Message[] = []): Chat => ({
  id,
  title: `Chat ${id}`,
  messages,
  createdAt: 1,
  model: 'openai/gpt-5-chat',
  isPersisted: true,
});

describe('chatState', () => {
  beforeEach(() => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000000');
    vi.spyOn(Date, 'now').mockReturnValue(123);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a local draft chat for the selected model', () => {
    expect(createLocalChat('anthropic/claude-sonnet-4.5')).toMatchObject({
      id: '00000000-0000-4000-8000-000000000000',
      title: 'Nueva Conversación',
      messages: [],
      createdAt: 123,
      model: 'anthropic/claude-sonnet-4.5',
      isPersisted: false,
      isPinned: false,
    });
  });

  it('updates one message inside a chat', () => {
    const original = chat('chat-1', [message('m1', 'hola'), message('m2', 'adiós')]);

    expect(
      updateMessageInChat(original, 'm2', (target) => ({ ...target, content: 'editado' })).messages
    ).toEqual([message('m1', 'hola'), message('m2', 'editado')]);
  });

  it('upserts existing chats and prepends new chats', () => {
    const first = chat('chat-1');
    const second = chat('chat-2');
    const updatedFirst = { ...first, title: 'Actualizado' };

    expect(upsertChat([first, second], updatedFirst)).toEqual([updatedFirst, second]);
    expect(upsertChat([first], second)).toEqual([second, first]);
  });
});
