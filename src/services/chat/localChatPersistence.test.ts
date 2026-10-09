import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chat, Message } from '../../types';
import { createChat, createMessage, updateChatTitle } from '../../utils/db';
import {
  persistChatIfNeeded,
  saveGeneratedTitleToLocalHistory,
  saveMessageToLocalHistory,
} from './localChatPersistence';

vi.mock('../../utils/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/db')>()),
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

  it('persists a draft chat for the local profile', async () => {
    vi.mocked(createChat).mockResolvedValue({
      id: chat.id,
      title: chat.title,
      user_id: 'local-user',
      created_at: '2026-06-19T00:00:00.000Z',
      model: chat.model,
    });

    await expect(persistChatIfNeeded(chat)).resolves.toMatchObject({
      id: 'chat-1',
      isPersisted: true,
    });
    expect(createChat).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'chat-1',
        title: 'Nueva Conversación',
        user_id: 'local-user',
        model: 'openai/gpt-5-chat',
        created_at: '1970-01-01T00:00:00.001Z',
      })
    );
  });

  it('does not recreate chats that are already persisted', async () => {
    const persisted = { ...chat, isPersisted: true };
    await expect(persistChatIfNeeded(persisted)).resolves.toBe(persisted);
    expect(createChat).not.toHaveBeenCalled();
  });

  it('stores user and assistant messages as local records', async () => {
    await saveMessageToLocalHistory(userMessage, chat.id);
    await expect(saveMessageToLocalHistory(assistantMessage, chat.id)).resolves.toBe('saved');

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
      saveMessageToLocalHistory({ ...assistantMessage, content: '   ' }, chat.id)
    ).resolves.toBe('empty');
    await saveGeneratedTitleToLocalHistory(chat.id, 'Título');

    expect(createMessage).not.toHaveBeenCalled();
    expect(updateChatTitle).toHaveBeenCalledWith('chat-1', 'Título');
  });
});
