import { describe, expect, it } from 'vitest';

import { splitReasoningChunk, stripReasoningMarkers } from './reasoningStream';

describe('reasoningStream', () => {
  it('splits reasoning and visible response when tags arrive in one chunk', () => {
    const result = splitReasoningChunk('<thinking>paso interno</thinking>respuesta', false);

    expect(result).toEqual({
      responseDelta: 'respuesta',
      thinkingDelta: 'paso interno',
      isReasoning: false,
    });
  });

  it('continues reasoning across chunks until the close marker arrives', () => {
    const first = splitReasoningChunk('<thinking>paso ', false);
    const second = splitReasoningChunk('interno</thinking>respuesta', first.isReasoning);

    expect(first).toEqual({
      responseDelta: '',
      thinkingDelta: 'paso ',
      isReasoning: true,
    });
    expect(second).toEqual({
      responseDelta: 'respuesta',
      thinkingDelta: 'interno',
      isReasoning: false,
    });
  });

  it('keeps visible text clean when a stray close marker appears', () => {
    const result = splitReasoningChunk('respuesta</thinking> limpia', false);

    expect(result).toEqual({
      responseDelta: 'respuesta limpia',
      thinkingDelta: '',
      isReasoning: false,
    });
  });

  it('strips internal markers from final visible text defensively', () => {
    expect(stripReasoningMarkers('a<thinking>b</thinking>c')).toBe('abc');
  });
});
