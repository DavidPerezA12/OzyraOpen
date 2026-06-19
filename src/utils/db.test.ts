import { beforeEach, describe, expect, it } from 'vitest';

import {
  createChat,
  createMessage,
  deleteMessagesByIds,
  getMessages,
  incrementMessageUsage,
  replaceChatWithMessages,
  updateMessageContent,
  upsertProfile,
} from './db';

describe('local db concurrency', () => {
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
    expect(messages[0].content).toBe('after');
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
    expect(messages[0].attachments).toEqual([
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
    expect(messages[0].use_web_search).toBe(true);
    expect(messages[0].search_queries).toEqual(['query']);
    expect(messages[0].annotations).toEqual([
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

  it('preserves a corrupt local db snapshot before resetting it', async () => {
    storage.set('ozyrachat:local-db:v1', '{broken json');

    await createChat({
      id: 'chat-after-corruption',
      title: 'Recovered',
      user_id: 'user-1',
    });

    const corruptBackupKey = Array.from(storage.keys()).find((key) =>
      key.startsWith('ozyrachat:local-db:v1:corrupt:')
    );

    expect(corruptBackupKey).toBeDefined();
    expect(storage.get(corruptBackupKey ?? '')).toBe('{broken json');
    expect(storage.get('ozyrachat:local-db:v1')).toContain('chat-after-corruption');
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
