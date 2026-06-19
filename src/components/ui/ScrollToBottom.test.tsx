import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ScrollToBottom } from './ScrollToBottom';

const createScrollContainer = () => {
  const container = document.createElement('div');
  Object.defineProperty(container, 'scrollHeight', {
    configurable: true,
    value: 1000,
  });
  Object.defineProperty(container, 'clientHeight', {
    configurable: true,
    value: 300,
  });
  Object.defineProperty(container, 'scrollTo', {
    configurable: true,
    value: vi.fn(({ top }: { top: number }) => {
      container.scrollTop = top;
    }),
  });
  return container;
};

describe('ScrollToBottom', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('anchors a newly selected chat at the bottom', () => {
    const container = createScrollContainer();
    const containerRef = { current: container };

    const { rerender } = render(
      <ScrollToBottom containerRef={containerRef} followKey="first" resetKey="chat-1" />
    );

    expect(container.scrollTop).toBe(1000);

    container.scrollTop = 120;
    rerender(<ScrollToBottom containerRef={containerRef} followKey="second" resetKey="chat-2" />);

    expect(container.scrollTop).toBe(1000);
  });

  it('does not follow new content after the user scrolls away from the bottom', () => {
    const container = createScrollContainer();
    const containerRef = { current: container };

    const { rerender } = render(
      <ScrollToBottom containerRef={containerRef} followKey="first" resetKey="chat-1" />
    );

    act(() => {
      container.scrollTop = 120;
      container.dispatchEvent(new Event('scroll'));
    });

    rerender(<ScrollToBottom containerRef={containerRef} followKey="second" resetKey="chat-1" />);

    expect(container.scrollTop).toBe(120);
  });
});
