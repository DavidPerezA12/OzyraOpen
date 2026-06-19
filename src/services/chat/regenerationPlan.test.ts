import { describe, expect, it } from 'vitest';
import type { Chat, Message } from '../../types';
import { buildRegenerationPlan } from './regenerationPlan';

const userMessage = (id: string, content: string): Message => ({
  id,
  role: 'user',
  content,
  timestamp: 1,
});

const assistantMessage = (id: string, content: string): Message => ({
  id,
  role: 'assistant',
  content,
  timestamp: 2,
});

const baseChat = (messages: Message[]): Chat => ({
  id: 'chat-1',
  title: 'Chat',
  messages,
  createdAt: 1,
  model: 'openai/gpt-5-chat',
  isPersisted: true,
});

describe('buildRegenerationPlan', () => {
  it('returns the previous user message, truncated chat and removed ids', () => {
    const messageWithImages: Message = {
      ...userMessage('u2', 'describe'),
      attachments: [
        {
          type: 'image',
          name: 'captura.png',
          url: 'blob:image',
          contentType: 'image/jpeg',
          data: 'abc',
        },
      ],
    };
    const chat = baseChat([
      userMessage('u1', 'hola'),
      assistantMessage('a1', 'respuesta'),
      messageWithImages,
      assistantMessage('a2', 'otra respuesta'),
    ]);

    const plan = buildRegenerationPlan(chat, 'a2');

    expect(plan).toMatchObject({
      userMessage: messageWithImages,
      updatedChat: { messages: [chat.messages[0], chat.messages[1], messageWithImages] },
      removedMessageIds: ['a2'],
      attachmentsOverride: [{ url: 'blob:image', contentType: 'image/jpeg', data: 'abc' }],
    });
  });

  it('returns null when there is no assistant response to regenerate', () => {
    const chat = baseChat([userMessage('u1', 'hola')]);

    expect(buildRegenerationPlan(chat)).toBeNull();
  });
});
