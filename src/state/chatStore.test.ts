import { describe, expect, it, vi } from 'vitest';
import type { Chat } from '../types';
import { createChatStore } from './chatStore';

const chat = (id: string, createdAt: number): Chat => ({
  id,
  title: id,
  messages: [],
  createdAt,
  model: 'openai/gpt-5-chat',
});

describe('createChatStore', () => {
  it('derives the current chat from its id, so updates are never stale', () => {
    const store = createChatStore([chat('a', 1)]);
    store.selectChat('a');

    store.updateChat('a', (current) => ({ ...current, title: 'Renombrado' }));

    expect(store.getCurrentChat()?.title).toBe('Renombrado');
  });

  it('ignores selecting unknown chats', () => {
    const store = createChatStore([chat('a', 1)]);
    store.selectChat('missing');
    expect(store.getState().currentChatId).toBeNull();
  });

  it('prepends new chats and replaces existing ones on upsert', () => {
    const store = createChatStore([chat('a', 1)]);
    store.upsertChat(chat('b', 2));
    store.upsertChat({ ...chat('a', 1), title: 'A2' });

    expect(store.getState().chats.map((item) => item.title)).toEqual(['b', 'A2']);
  });

  it('selects the most recent remaining chat when the current one is removed', () => {
    const store = createChatStore([chat('old', 1), chat('current', 2), chat('newest', 3)]);
    store.selectChat('current');

    expect(store.removeChat('current')?.id).toBe('newest');
    expect(store.getState().currentChatId).toBe('newest');
  });

  it('keeps the selection when removing another chat', () => {
    const store = createChatStore([chat('a', 1), chat('b', 2)]);
    store.selectChat('a');

    expect(store.removeChat('b')?.id).toBe('a');
  });

  it('notifies subscribers only on real changes', () => {
    const store = createChatStore([chat('a', 1)]);
    const listener = vi.fn();
    store.subscribe(listener);

    store.updateChat('a', (current) => current);
    store.updateChat('missing', (current) => ({ ...current, title: 'x' }));
    store.selectChat(null);
    expect(listener).not.toHaveBeenCalled();

    store.selectChat('a');
    expect(listener).toHaveBeenCalledOnce();
  });

  it('drops the selection when replacing chats without the current one', () => {
    const store = createChatStore([chat('a', 1)]);
    store.selectChat('a');

    store.replaceChats([chat('b', 2)]);

    expect(store.getState().currentChatId).toBeNull();
  });
});
