import { describe, expect, it } from 'vitest';

import {
  createChat,
  createMessage,
  DbUnavailableError,
  deleteMessagesByIds,
  getChats,
  getMessages,
  getProfile,
  incrementMessageUsage,
  replaceChatWithMessages,
  updateMessageContent,
  upsertProfile,
} from './db';
import {
  CHATS_STORE,
  LEGACY_DB_KEY,
  LOCAL_DB_NAME,
  LOCAL_DB_VERSION,
  MESSAGES_BY_CHAT_INDEX,
  MESSAGES_STORE,
  MIGRATED_DB_KEY,
  PROFILES_STORE,
} from './localDbStore';

describe('local db', () => {
  it('preserves messages created in parallel for the same chat', async () => {
    await createChat({
      id: 'chat-1',
      title: 'Parallel chat',
      user_id: 'user-1',
    });

    await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        createMessage({
          id: `msg-${index}`,
          chat_id: 'chat-1',
          role: index % 2 === 0 ? 'user' : 'assistant',
          content: `message ${index}`,
          timestamp: index,
          user_id: 'user-1',
        })
      )
    );

    const messages = await getMessages('chat-1');
    expect(messages).toHaveLength(12);
    expect(messages.map((message) => message.id)).toEqual(
      Array.from({ length: 12 }, (_, index) => `msg-${index}`)
    );
  });

  it('increments usage from parallel completions without lost updates', async () => {
    await upsertProfile({
      id: 'user-1',
      email: '',
      has_local_access: true,
    });

    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        incrementMessageUsage('user-1', index % 2 === 0 ? 'standard' : 'premium')
      )
    );

    const updated = await incrementMessageUsage('user-1', 'standard');
    expect(updated).toEqual({
      standard_message_usage: 5,
      premium_message_usage: 4,
    });
  });

  it('updates persisted message content', async () => {
    await createChat({
      id: 'chat-1',
      title: 'Editable chat',
      user_id: 'user-1',
    });
    await createMessage({
      id: 'msg-1',
      chat_id: 'chat-1',
      role: 'user',
      content: 'before',
      timestamp: 1,
      user_id: 'user-1',
    });

    await updateMessageContent('msg-1', 'after');

    const messages = await getMessages('chat-1');
    expect(messages[0]?.content).toBe('after');
  });

  it('preserves image attachments and allows image-only messages', async () => {
    await createChat({
      id: 'chat-1',
      title: 'Image chat',
      user_id: 'user-1',
    });

    await createMessage({
      id: 'msg-1',
      chat_id: 'chat-1',
      role: 'user',
      content: '',
      timestamp: 1,
      user_id: 'user-1',
      attachments: [
        {
          type: 'image',
          name: 'image.png',
          url: 'blob:preview',
          contentType: 'image/png',
          data: 'abc123',
        },
      ],
    });

    const messages = await getMessages('chat-1');
    expect(messages[0]?.attachments).toEqual([
      {
        type: 'image',
        name: 'image.png',
        url: 'blob:preview',
        contentType: 'image/png',
        data: 'abc123',
      },
    ]);
  });

  it('preserves web search metadata and citation annotations', async () => {
    await createChat({
      id: 'chat-1',
      title: 'Search chat',
      user_id: 'user-1',
    });

    await createMessage({
      id: 'msg-1',
      chat_id: 'chat-1',
      role: 'assistant',
      content: 'Respuesta con fuente',
      timestamp: 1,
      user_id: 'user-1',
      use_web_search: true,
      search_queries: ['query'],
      annotations: [
        {
          type: 'url_citation',
          url_citation: {
            url: 'https://example.com/news',
            title: 'Example News',
            content: 'Snippet',
            start_index: 0,
            end_index: 10,
          },
        },
      ],
    });

    const messages = await getMessages('chat-1');
    expect(messages[0]?.use_web_search).toBe(true);
    expect(messages[0]?.search_queries).toEqual(['query']);
    expect(messages[0]?.annotations).toEqual([
      {
        type: 'url_citation',
        url_citation: {
          url: 'https://example.com/news',
          title: 'Example News',
          content: 'Snippet',
          start_index: 0,
          end_index: 10,
        },
      },
    ]);
  });

  it('deletes selected messages only from the target chat', async () => {
    await createChat({ id: 'chat-1', title: 'Target chat', user_id: 'user-1' });
    await createChat({ id: 'chat-2', title: 'Other chat', user_id: 'user-1' });
    await createMessage({
      id: 'msg-1',
      chat_id: 'chat-1',
      role: 'user',
      content: 'kept',
      timestamp: 1,
      user_id: 'user-1',
    });
    await createMessage({
      id: 'msg-2',
      chat_id: 'chat-1',
      role: 'assistant',
      content: 'removed',
      timestamp: 2,
      user_id: 'user-1',
    });
    await createMessage({
      id: 'msg-3',
      chat_id: 'chat-2',
      role: 'assistant',
      content: 'other chat',
      timestamp: 2,
      user_id: 'user-1',
    });

    await deleteMessagesByIds('chat-1', ['msg-2']);

    expect((await getMessages('chat-1')).map((message) => message.id)).toEqual(['msg-1']);
    expect((await getMessages('chat-2')).map((message) => message.id)).toEqual(['msg-3']);
  });

  it('rejects imported message ids that already belong to another chat', async () => {
    await createChat({ id: 'chat-1', title: 'Imported target', user_id: 'user-1' });
    await createChat({ id: 'chat-2', title: 'Other chat', user_id: 'user-1' });
    await createMessage({
      id: 'shared-message-id',
      chat_id: 'chat-2',
      role: 'assistant',
      content: 'Do not remove me',
      timestamp: 1,
      user_id: 'user-1',
    });

    await expect(
      replaceChatWithMessages(
        {
          id: 'chat-1',
          title: 'Imported target',
          user_id: 'user-1',
        },
        [
          {
            id: 'shared-message-id',
            chat_id: 'chat-1',
            role: 'user',
            content: 'Imported',
            timestamp: 2,
            user_id: 'user-1',
          },
        ]
      )
    ).rejects.toThrow('Imported message id already exists in another chat: shared-message-id');

    expect(await getMessages('chat-2')).toEqual([
      expect.objectContaining({ id: 'shared-message-id', content: 'Do not remove me' }),
    ]);
  });
});

describe('legacy localStorage migration', () => {
  const legacyState = {
    profiles: [{ id: 'user-1', email: 'user@example.com', name: 'User' }],
    chats: [
      {
        id: 'legacy-chat',
        title: 'Legacy chat',
        created_at: '2024-01-01T00:00:00.000Z',
        user_id: 'user-1',
      },
    ],
    messages: [
      {
        id: 'legacy-msg',
        chat_id: 'legacy-chat',
        role: 'user',
        content: 'hello from localStorage',
        timestamp: 1,
        user_id: 'user-1',
      },
    ],
  };

  const seedExistingDatabase = (chatId: string): Promise<void> =>
    new Promise((resolve, reject) => {
      const request = indexedDB.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore(PROFILES_STORE, { keyPath: 'id' });
        db.createObjectStore(CHATS_STORE, { keyPath: 'id' });
        const messages = db.createObjectStore(MESSAGES_STORE, { keyPath: 'id' });
        messages.createIndex(MESSAGES_BY_CHAT_INDEX, 'chat_id', { unique: false });
      };
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(CHATS_STORE, 'readwrite');
        transaction.objectStore(CHATS_STORE).put({
          id: chatId,
          title: 'Existing chat',
          created_at: '2024-06-01T00:00:00.000Z',
          user_id: 'user-1',
        });
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    });

  it('imports the legacy payload on first open and renames the key', async () => {
    const raw = JSON.stringify(legacyState);
    window.localStorage.setItem(LEGACY_DB_KEY, raw);

    const chats = await getChats('user-1');
    expect(chats.map((chat) => chat.id)).toEqual(['legacy-chat']);

    const messages = await getMessages('legacy-chat');
    expect(messages).toEqual([expect.objectContaining({ id: 'legacy-msg' })]);

    const profile = await getProfile('user-1');
    expect(profile).toEqual(expect.objectContaining({ id: 'user-1', name: 'User' }));

    expect(window.localStorage.getItem(LEGACY_DB_KEY)).toBeNull();
    expect(window.localStorage.getItem(MIGRATED_DB_KEY)).toBe(raw);
  });

  it('keeps the safety-net copy intact while later writes go to IndexedDB', async () => {
    window.localStorage.setItem(LEGACY_DB_KEY, JSON.stringify(legacyState));

    await updateMessageContent('legacy-msg', 'edited after migration');

    const messages = await getMessages('legacy-chat');
    expect(messages[0]?.content).toBe('edited after migration');
    expect(window.localStorage.getItem(MIGRATED_DB_KEY)).toContain('hello from localStorage');
  });

  it('skips the import when the database already contains data', async () => {
    await seedExistingDatabase('existing-chat');
    const raw = JSON.stringify(legacyState);
    window.localStorage.setItem(LEGACY_DB_KEY, raw);

    const chats = await getChats('user-1');
    expect(chats.map((chat) => chat.id)).toEqual(['existing-chat']);

    expect(window.localStorage.getItem(LEGACY_DB_KEY)).toBeNull();
    expect(window.localStorage.getItem(MIGRATED_DB_KEY)).toBe(raw);
  });

  it('preserves a corrupt legacy payload before resetting it', async () => {
    window.localStorage.setItem(LEGACY_DB_KEY, '{broken json');

    await createChat({
      id: 'chat-after-corruption',
      title: 'Recovered',
      user_id: 'user-1',
    });

    const corruptBackupKey = Array.from({ length: window.localStorage.length }, (_, index) =>
      window.localStorage.key(index)
    ).find((key) => key?.startsWith(`${LEGACY_DB_KEY}:corrupt:`));

    expect(corruptBackupKey).toBeDefined();
    expect(window.localStorage.getItem(corruptBackupKey ?? '')).toBe('{broken json');
    expect(window.localStorage.getItem(LEGACY_DB_KEY)).toBeNull();
    expect(window.localStorage.getItem(MIGRATED_DB_KEY)).toBeNull();

    const chats = await getChats('user-1');
    expect(chats.map((chat) => chat.id)).toEqual(['chat-after-corruption']);
  });
});

describe('environments without IndexedDB', () => {
  const removeIndexedDb = (): void => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: undefined,
    });
  };

  it('degrades gracefully to empty reads and explicit write failures', async () => {
    removeIndexedDb();

    await expect(
      createChat({ id: 'chat-1', title: 'Ephemeral', user_id: 'user-1' })
    ).rejects.toBeInstanceOf(DbUnavailableError);

    expect(await getChats('user-1')).toEqual([]);
    expect(await getMessages('chat-1')).toEqual([]);
    expect(await getProfile('user-1')).toBeNull();

    await expect(incrementMessageUsage('user-1', 'standard')).rejects.toBeInstanceOf(
      DbUnavailableError
    );
    await expect(upsertProfile({ id: 'user-1', email: '' })).rejects.toBeInstanceOf(
      DbUnavailableError
    );
  });
});
