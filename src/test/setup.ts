import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

const createMemoryStorage = (): Storage => {
  const storage = new Map<string, string>();

  return {
    get length() {
      return storage.size;
    },
    clear: () => {
      storage.clear();
    },
    getItem: (key: string) => storage.get(key) ?? null,
    key: (index: number) => Array.from(storage.keys())[index] ?? null,
    removeItem: (key: string) => {
      storage.delete(key);
    },
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
  } as Storage;
};

const testStorage = createMemoryStorage();

const installMemoryStorage = (): void => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: testStorage,
  });

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: testStorage,
  });
};

// Fresh in-memory IndexedDB per test. `getLocalDbConnection` caches its
// connection per IDBFactory instance, so swapping the factory both isolates
// data between tests and resets the connection cache.
const installMemoryIndexedDb = (): void => {
  const factory = new IDBFactory();

  Object.defineProperty(window, 'indexedDB', {
    configurable: true,
    value: factory,
  });

  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: factory,
  });
};

installMemoryStorage();
installMemoryIndexedDb();

beforeEach(() => {
  testStorage.clear();
  installMemoryStorage();
  installMemoryIndexedDb();
});
