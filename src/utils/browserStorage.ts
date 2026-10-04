export type StorageEntryHandler = (key: string, value: string) => void;

export const getBrowserLocalStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const readLocalStorage = (key: string): string | null => {
  const storage = getBrowserLocalStorage();
  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

export const readTrimmedLocalStorage = (key: string): string => readLocalStorage(key)?.trim() ?? '';

export const writeLocalStorage = (key: string, value: string): boolean => {
  const storage = getBrowserLocalStorage();
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

export const removeLocalStorage = (key: string): boolean => {
  const storage = getBrowserLocalStorage();
  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};

export const readLocalStorageJson = <T>(key: string): T | null => {
  const value = readLocalStorage(key);
  if (value === null) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export const writeLocalStorageJson = (key: string, value: unknown): boolean => {
  try {
    return writeLocalStorage(key, JSON.stringify(value));
  } catch {
    return false;
  }
};

export const forEachLocalStorageEntry = (handler: StorageEntryHandler): void => {
  const storage = getBrowserLocalStorage();
  if (!storage) {
    return;
  }

  const entries: Array<readonly [string, string]> = [];

  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key) {
        continue;
      }

      const value = storage.getItem(key);
      if (value !== null) {
        entries.push([key, value]);
      }
    }
  } catch {
    // Some browsers can deny storage access at runtime; callers treat this as
    // an empty storage snapshot.
  }

  for (const [key, value] of entries) {
    handler(key, value);
  }
};
