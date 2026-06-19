import { beforeEach, describe, expect, it } from 'vitest';

import type { Chat } from '../types';
import { migrateLocalChatsToDatabase } from './chatMigration';
import { createChat, createMessage, getChats, getMessages } from './db';

describe('migrateLocalChatsToDatabase', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
        clear: () => {
          storage.clear();
        },
      },
    });
  });

  it('reconciles existing data and persists new chats and messages', async () => {
    await createChat({ id: 'chat-existing', title: 'Existing', user_id: 'local-user' });
    await createMessage({
      id: 'message-existing',
      chat_id: 'chat-existing',
      role: 'user',
      content: 'Already stored',
      timestamp: 1,
      user_id: 'local-user',
    });
    window.localStorage.setItem('chats', 'legacy payload');

    const localChats: Chat[] = [
      {
        id: 'chat-existing',
        title: 'Existing',
        createdAt: 1,
        model: 'test-model',
        messages: [
          {
            id: 'message-existing',
            role: 'user',
            content: 'Already stored',
            timestamp: 1,
          },
          {
            id: 'message-new',
            role: 'assistant',
            content: 'Reconciled',
            timestamp: 2,
          },
        ],
      },
      {
        id: 'chat-new',
        title: 'New chat',
        createdAt: 2,
        model: 'test-model',
        messages: [
          {
            id: 'message-another',
            role: 'user',
            content: 'New chat message',
            timestamp: 3,
          },
        ],
      },
    ];

    await expect(migrateLocalChatsToDatabase('local-user', localChats)).resolves.toEqual({
      success: true,
      migratedCount: 1,
    });

    expect((await getChats('local-user')).map((chat) => chat.id).sort()).toEqual([
      'chat-existing',
      'chat-new',
    ]);
    expect((await getMessages('chat-existing')).map((message) => message.id)).toEqual([
      'message-existing',
      'message-new',
    ]);
    expect((await getMessages('chat-new')).map((message) => message.id)).toEqual([
      'message-another',
    ]);
    expect(window.localStorage.getItem('migrated_chats_local-user')).toBe('true');
    expect(window.localStorage.getItem('chats')).toBeNull();
  });

  it('keeps legacy chats when migration has partial failures', async () => {
    window.localStorage.setItem('chats', 'legacy payload');

    const localChats: Chat[] = [
      {
        id: 'chat-partial',
        title: 'Partial chat',
        createdAt: 1,
        model: 'test-model',
        messages: [
          {
            id: 'message-invalid',
            role: 'assistant',
            content: '',
            timestamp: 1,
          },
        ],
      },
    ];

    await expect(migrateLocalChatsToDatabase('local-user', localChats)).resolves.toEqual({
      success: false,
      migratedCount: 1,
    });

    expect((await getChats('local-user')).map((chat) => chat.id)).toEqual(['chat-partial']);
    expect(await getMessages('chat-partial')).toEqual([]);
    expect(window.localStorage.getItem('migrated_chats_local-user')).toBeNull();
    expect(window.localStorage.getItem('chats')).toBe('legacy payload');
  });
});
