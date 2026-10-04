import { describe, expect, it } from 'vitest';
import { getSafeHostname, getSafeImageSrc, isSafeHttpUrl, isSafeLinkHref } from './safeUrl';

describe('safeUrl', () => {
  it('bloquea esquemas peligrosos en enlaces', () => {
    expect(isSafeLinkHref('javascript:alert(1)')).toBe(false);
    expect(isSafeLinkHref('data:text/html,<h1>x</h1>')).toBe(false);
    expect(isSafeLinkHref('vbscript:msgbox(1)')).toBe(false);
    expect(isSafeLinkHref('https://example.com/a')).toBe(true);
    expect(isSafeLinkHref('http://example.com/a')).toBe(true);
    expect(isSafeLinkHref('mailto:a@b.com')).toBe(true);
    expect(isSafeLinkHref('/docs')).toBe(true);
    expect(isSafeLinkHref('#ancla')).toBe(true);
  });

  it('bloquea data: como href pero permite http(s) como imagen', () => {
    expect(isSafeHttpUrl('https://example.com/x.png')).toBe(true);
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('data:image/png;base64,AAA')).toBe(false);
  });

  it('nunca rompe el render con URLs inválidas', () => {
    expect(getSafeHostname('not a url')).toBe('enlace');
    expect(getSafeHostname('javascript:alert(1)')).toBe('enlace');
    expect(getSafeHostname('https://example.com/path')).toBe('example.com');
    expect(getSafeHostname(null)).toBe('enlace');
  });

  it('solo permite contentType de imagen y base64 válido', () => {
    expect(
      getSafeImageSrc({ url: '', contentType: 'image/png', data: 'aGVsbG8=' }, 'fallback')
    ).toContain('data:image/png');
    expect(
      getSafeImageSrc({ url: '', contentType: 'text/html', data: 'aGVsbG8=' }, 'fallback')
    ).toBe('fallback');
    expect(
      getSafeImageSrc({ url: '', contentType: 'image/png', data: '"><script>' }, 'fallback')
    ).toBe('fallback');
    expect(getSafeImageSrc({ url: 'https://example.com/a.png' })).toBe('https://example.com/a.png');
    expect(getSafeImageSrc({ url: 'javascript:alert(1)' }, 'fallback')).toBe('fallback');
  });
});
