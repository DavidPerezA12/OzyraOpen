import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_MODEL_ID } from '../config/models';
import { createChat, createMessage, getChats, getMessages } from './db';
import { parseImportableChats, persistImportedChats } from './importChats';

const makeStoredChat = (overrides: Record<string, unknown> = {}) => ({
  id: 'chat-1',
  title: 'Imported chat',
  createdAt: 1_700_000_000_000,
  model: DEFAULT_MODEL_ID,
  messages: [
    {
      id: 'message-1',
      role: 'user',
      content: 'Hello',
      timestamp: 1_700_000_000_001,
    },
  ],
  ...overrides,
});

describe('parseImportableChats', () => {
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

  it('accepts a single chat exported from the sidebar', () => {
    const chats = parseImportableChats({
      ...makeStoredChat(),
      exportedAt: '2026-06-10T12:00:00.000Z',
    });

    expect(chats).toHaveLength(1);
    expect(chats[0].id).toBe('chat-1');
    expect(chats[0].messages).toHaveLength(1);
  });

  it('accepts the multi-chat export format', () => {
    const chats = parseImportableChats({
      chats: [makeStoredChat({ id: 'chat-1' }), makeStoredChat({ id: 'chat-2' })],
    });

    expect(chats.map((chat) => chat.id)).toEqual(['chat-1', 'chat-2']);
  });

  it('accepts local folder snapshots backed by the local db state', () => {
    const chats = parseImportableChats({
      app: 'Ozyra Open',
      version: 1,
      exportedAt: '2026-06-10T12:00:00.000Z',
      storage: {
        'ozyrachat:local-db:v1': {
          profiles: [],
          chats: [
            {
              id: 'chat-db',
              title: 'DB chat',
              created_at: '2026-06-10T12:00:00.000Z',
              user_id: 'local-user',
              model: DEFAULT_MODEL_ID,
              customization_prompt: 'Be concise',
              is_pinned: true,
            },
          ],
          messages: [
            {
              id: 'msg-db',
              chat_id: 'chat-db',
              role: 'assistant',
              content: 'Restored',
              timestamp: 1_781_092_800_000,
              thinking_content: 'Reasoning',
              use_web_search: true,
              search_queries: ['restored query'],
              annotations: [
                {
                  type: 'url_citation',
                  url_citation: {
                    url: 'https://example.com/source',
                    title: 'Example Source',
                  },
                },
              ],
              attachments: [
                {
                  type: 'image',
                  name: 'restored.png',
                  url: 'blob:restored',
                  contentType: 'image/png',
                  data: 'abc123',
                },
              ],
            },
          ],
        },
      },
    });

    expect(chats).toHaveLength(1);
    expect(chats[0]).toMatchObject({
      id: 'chat-db',
      title: 'DB chat',
      customizationPrompt: 'Be concise',
      isPinned: true,
      isPersisted: true,
    });
    expect(chats[0].messages[0]).toMatchObject({
      id: 'msg-db',
      role: 'assistant',
      content: 'Restored',
      thinkingContent: 'Reasoning',
      useWebSearch: true,
      searchQueries: ['restored query'],
      annotations: [
        {
          type: 'url_citation',
          url_citation: {
            url: 'https://example.com/source',
            title: 'Example Source',
          },
        },
      ],
      attachments: [
        {
          type: 'image',
          name: 'restored.png',
          url: 'blob:restored',
          contentType: 'image/png',
          data: 'abc123',
        },
      ],
    });
  });

  it('persists imported chats and all of their messages', async () => {
    const chats = parseImportableChats({
      chats: [
        makeStoredChat({
          id: 'chat-1',
          messages: [
            {
              id: 'message-1',
              role: 'user',
              content: 'First',
              timestamp: 1,
            },
            {
              id: 'message-2',
              role: 'assistant',
              content: 'Second',
              timestamp: 2,
            },
          ],
        }),
        makeStoredChat({
          id: 'chat-2',
          messages: [
            {
              id: 'message-3',
              role: 'user',
              content: 'Another chat',
              timestamp: 3,
            },
          ],
        }),
      ],
    });

    const persistedIds = await persistImportedChats('local-user', chats);

    expect([...persistedIds]).toEqual(['chat-1', 'chat-2']);
    expect((await getChats('local-user')).map((chat) => chat.id).sort()).toEqual([
      'chat-1',
      'chat-2',
    ]);
    expect((await getMessages('chat-1')).map((message) => message.id)).toEqual([
      'message-1',
      'message-2',
    ]);
    expect((await getMessages('chat-2')).map((message) => message.id)).toEqual(['message-3']);
  });

  it('replaces an existing chat and its messages atomically', async () => {
    await createChat({
      id: 'chat-1',
      title: 'Old title',
      user_id: 'local-user',
      model: DEFAULT_MODEL_ID,
    });
    await createMessage({
      id: 'old-message',
      chat_id: 'chat-1',
      role: 'user',
      content: 'Old content',
      timestamp: 1,
      user_id: 'local-user',
    });

    const chats = parseImportableChats({
      chats: [
        makeStoredChat({
          title: 'Restored title',
          messages: [
            {
              id: 'restored-message',
              role: 'assistant',
              content: 'Restored content',
              timestamp: 2,
            },
          ],
        }),
      ],
    });

    await persistImportedChats('local-user', chats);

    expect(await getChats('local-user')).toEqual([
      expect.objectContaining({ id: 'chat-1', title: 'Restored title' }),
    ]);
    expect(await getMessages('chat-1')).toEqual([
      expect.objectContaining({ id: 'restored-message', content: 'Restored content' }),
    ]);
  });
});
