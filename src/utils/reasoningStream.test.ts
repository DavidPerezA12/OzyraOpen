import { describe, expect, it } from 'vitest';

import {
  escapeThinkingMarkers,
  splitReasoningChunk,
  stripReasoningMarkers,
} from './reasoningStream';

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

  it('escapes model-injected markers so the parser never flips state', () => {
    const escaped = escapeThinkingMarkers('mira <thinking>secreto</thinking> fin');
    expect(escaped).toBe('mira &lt;thinking&gt;secreto&lt;/thinking&gt; fin');

    const parsed = splitReasoningChunk(escaped, false);
    expect(parsed).toEqual({
      responseDelta: 'mira &lt;thinking&gt;secreto&lt;/thinking&gt; fin',
      thinkingDelta: '',
      isReasoning: false,
    });
  });

  it('leaves text without markers untouched', () => {
    expect(escapeThinkingMarkers('respuesta normal')).toBe('respuesta normal');
  });
});
