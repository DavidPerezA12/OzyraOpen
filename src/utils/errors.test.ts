import { describe, expect, it } from 'vitest';
import { isAbortError } from './errors';

describe('isAbortError', () => {
  it('detects DOM and Error abort failures', () => {
    expect(isAbortError(new DOMException('Request aborted', 'AbortError'))).toBe(true);

    const error = new Error('Request aborted');
    error.name = 'AbortError';
    expect(isAbortError(error)).toBe(true);
  });

  it('ignores non-abort failures', () => {
    expect(isAbortError(new Error('Network failed'))).toBe(false);
    expect(isAbortError('AbortError')).toBe(false);
  });
});
