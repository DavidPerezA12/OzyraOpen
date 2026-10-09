import { describe, expect, it } from 'vitest';
import type { Message } from '../../types';
import { estimateMessageTokens, selectHistoryWindow } from './historyWindow';

const conversation = (count: number, content = 'texto'): Message[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `m-${index}`,
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `${content} ${index}`,
    timestamp: index,
  }));

const limits = { maxMessages: 40, step: 10, maxTokens: 100_000 };

describe('selectHistoryWindow', () => {
  it('returns the whole conversation while it fits', () => {
    const messages = conversation(39);
    expect(selectHistoryWindow(messages, limits)).toBe(messages);
  });

  it('only moves the window start in step-sized jumps', () => {
    const starts = [41, 45, 49, 51, 59, 61].map(
      (count) => selectHistoryWindow(conversation(count), limits)[0]?.id
    );
    expect(starts).toEqual(['m-10', 'm-10', 'm-10', 'm-20', 'm-20', 'm-30']);
  });

  it('always starts the window on a user message', () => {
    const messages: Message[] = [
      ...conversation(10),
      { id: 'extra-assistant', role: 'assistant', content: 'seguido', timestamp: 10 },
      ...conversation(31).map((message) => ({ ...message, id: `late-${message.id}` })),
    ];

    const window = selectHistoryWindow(messages, limits);
    expect(window[0]?.role).toBe('user');
    expect(window.length).toBeLessThanOrEqual(limits.maxMessages);
  });

  it('trims by estimated tokens in step-sized jumps', () => {
    const big = conversation(12, 'x'.repeat(3000));
    const tokenLimits = { maxMessages: 40, step: 4, maxTokens: 9_000 };

    const first = selectHistoryWindow(big, tokenLimits);
    const totalTokens = first.reduce((total, message) => total + estimateMessageTokens(message), 0);
    expect(totalTokens).toBeLessThanOrEqual(tokenLimits.maxTokens);
    expect(first[0]?.id).toBe('m-4');
  });

  it('keeps at least the last user message even when it exceeds the budget', () => {
    const messages = conversation(3, 'y'.repeat(30_000));
    expect(selectHistoryWindow(messages, { ...limits, maxTokens: 100 }).map((m) => m.id)).toEqual([
      'm-2',
    ]);
  });

  it('counts image attachments in the estimate', () => {
    const withImage: Message = {
      id: 'img',
      role: 'user',
      content: '',
      timestamp: 0,
      attachments: [{ type: 'image', name: 'a.png', url: 'blob:a' }],
    };
    expect(estimateMessageTokens(withImage)).toBeGreaterThanOrEqual(1000);
  });
});
