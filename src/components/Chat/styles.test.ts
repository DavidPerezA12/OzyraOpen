import { describe, expect, it } from 'vitest';
import { getConfidenceBadgeStyles } from './styles';

describe('Chat styles utilities', () => {
  it('computes confidence badge styles by level and theme', () => {
    expect(getConfidenceBadgeStyles(95, false)).toBe('bg-green-100 text-green-700');
    expect(getConfidenceBadgeStyles(75, true)).toBe('bg-yellow-900/30 text-yellow-400');
    expect(getConfidenceBadgeStyles(40, false)).toBe('bg-orange-100 text-orange-700');
  });
});
