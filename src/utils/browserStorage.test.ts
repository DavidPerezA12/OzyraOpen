import { describe, expect, it } from 'vitest';

import {
  forEachLocalStorageEntry,
  getBrowserLocalStorage,
  readLocalStorage,
  readLocalStorageJson,
  readTrimmedLocalStorage,
  removeLocalStorage,
  writeLocalStorage,
  writeLocalStorageJson,
} from './browserStorage';

describe('browserStorage', () => {
  it('reads, trims, writes, removes and iterates browser storage values', () => {
    expect(getBrowserLocalStorage()).toBe(window.localStorage);

    expect(writeLocalStorage('plain', '  value  ')).toBe(true);
    expect(readLocalStorage('plain')).toBe('  value  ');
    expect(readTrimmedLocalStorage('plain')).toBe('value');

    expect(writeLocalStorageJson('json', { ok: true })).toBe(true);
    expect(readLocalStorageJson<{ ok: boolean }>('json')).toEqual({ ok: true });

    const entries: Record<string, string> = {};
    forEachLocalStorageEntry((key, value) => {
      entries[key] = value;
    });
    expect(entries).toMatchObject({ plain: '  value  ', json: '{"ok":true}' });

    expect(removeLocalStorage('plain')).toBe(true);
    expect(readLocalStorage('plain')).toBeNull();
  });

  it('returns null for invalid JSON payloads', () => {
    writeLocalStorage('broken', '{');

    expect(readLocalStorageJson('broken')).toBeNull();
  });

  it('fails closed when storage access throws', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('storage disabled');
      },
    });

    expect(getBrowserLocalStorage()).toBeNull();
    expect(readLocalStorage('plain')).toBeNull();
    expect(readTrimmedLocalStorage('plain')).toBe('');
    expect(writeLocalStorage('plain', 'value')).toBe(false);
    expect(removeLocalStorage('plain')).toBe(false);
    expect(readLocalStorageJson('plain')).toBeNull();
    expect(writeLocalStorageJson('plain', { ok: true })).toBe(false);

    const entries: string[] = [];
    forEachLocalStorageEntry((key) => entries.push(key));
    expect(entries).toEqual([]);
  });
});
