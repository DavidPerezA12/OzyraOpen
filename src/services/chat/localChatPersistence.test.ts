import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chat, Message } from '../../types';
import { createChat, createMessage, updateChatTitle } from '../../utils/db';
import {
  persistChatIfNeeded,
  saveAssistantMessageToLocalHistory,
  saveGeneratedTitleToLocalHistory,
  saveUserMessageToLocalHistory,
} from './localChatPersistence';

vi.mock('../../utils/db', () => ({
  createChat: vi.fn(),
  createMessage: vi.fn(),
  updateChatTitle: vi.fn(),
}));

const chat: Chat = {
  id: 'chat-1',
  title: 'Nueva Conversación',
  messages: [],
  createdAt: 1,
  model: 'openai/gpt-5-chat',
  isPersisted: false,
};

const userMessage: Message = {
  id: 'm-user',
  role: 'user',
  content: 'Hola',
  timestamp: 10,
  model: 'openai/gpt-5-chat',
};

const assistantMessage: Message = {
  id: 'm-assistant',
  role: 'assistant',
  content: 'Respuesta',
  timestamp: 20,
  model: 'openai/gpt-5-chat',
};

describe('localChatPersistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists a draft chat locally when a user id exists', async () => {
    vi.mocked(createChat).mockResolvedValue({
      id: chat.id,
      title: chat.title,
      user_id: 'local-user',
      created_at: '2026-06-19T00:00:00.000Z',
      model: chat.model,
    });

    await expect(persistChatIfNeeded({ chat, userId: 'local-user' })).resolves.toMatchObject({
      id: 'chat-1',
      isPersisted: true,
    });
    expect(createChat).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'chat-1',
        title: 'Nueva Conversación',
        user_id: 'local-user',
        model: 'openai/gpt-5-chat',
      })
    );
  });

  it('stores user and assistant messages as local records', async () => {
    await saveUserMessageToLocalHistory({
      message: userMessage,
      chatId: chat.id,
      userId: 'local-user',
    });
    await expect(
      saveAssistantMessageToLocalHistory({
        message: assistantMessage,
        chatId: chat.id,
        userId: 'local-user',
      })
    ).resolves.toBe('saved');

    expect(createMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 'm-user', role: 'user', content: 'Hola' })
    );
    expect(createMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: 'm-assistant', role: 'assistant', content: 'Respuesta' })
    );
  });

  it('skips empty assistant messages and saves generated titles', async () => {
    await expect(
      saveAssistantMessageToLocalHistory({
        message: { ...assistantMessage, content: '   ' },
        chatId: chat.id,
        userId: 'local-user',
      })
    ).resolves.toBe('empty');
    await saveGeneratedTitleToLocalHistory({
      chatId: chat.id,
      title: 'Título',
      userId: 'local-user',
    });

    expect(createMessage).not.toHaveBeenCalled();
    expect(updateChatTitle).toHaveBeenCalledWith('chat-1', 'Título');
  });
});
