import { STORAGE_KEYS } from '../config/constants';

type SerializableValue =
  | string
  | number
  | boolean
  | null
  | SerializableValue[]
  | {
      readonly [key: string]: SerializableValue;
    };

interface LocalFolderSnapshot {
  readonly app: 'Ozyra Open';
  readonly version: 1;
  readonly exportedAt: string;
  readonly storage: Record<string, SerializableValue>;
  readonly note: string;
}

const HANDLE_DB_NAME = 'ozyrachat-local-folder-sync';
const HANDLE_DB_VERSION = 1;
const HANDLE_STORE_NAME = 'handles';
const DIRECTORY_HANDLE_KEY = 'directory';

const EXCLUDED_KEYS = new Set<string>([
  STORAGE_KEYS.OPENROUTER_API_KEY,
  STORAGE_KEYS.TAVILY_API_KEY,
  STORAGE_KEYS.BRAVE_SEARCH_API_KEY,
]);

const SAFE_KEY_PREFIXES = ['ozyra', 'ozyrachat'];
const SAFE_KEYS = new Set([
  'chats',
  'selectedModel',
  'enabledModelIds',
  'theme',
  'userName',
  'userKnowledge',
  'userTraits',
  'userAdditionalInfo',
]);

const parseStorageValue = (value: string): SerializableValue => {
  try {
    return JSON.parse(value) as SerializableValue;
  } catch {
    return value;
  }
};

const shouldIncludeStorageKey = (key: string): boolean => {
  if (EXCLUDED_KEYS.has(key)) {
    return false;
  }

  return SAFE_KEYS.has(key) || SAFE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
};

export const isLocalFolderSyncSupported = (): boolean => {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
};

const openHandleDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HANDLE_DB_NAME, HANDLE_DB_VERSION);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(HANDLE_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir IndexedDB'));
  });
};

export const saveLocalSyncDirectoryHandle = async (
  directoryHandle: FileSystemDirectoryHandle
): Promise<void> => {
  const db = await openHandleDb();

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(HANDLE_STORE_NAME, 'readwrite');
      transaction.objectStore(HANDLE_STORE_NAME).put(directoryHandle, DIRECTORY_HANDLE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error('No se pudo guardar la carpeta elegida'));
    });
  } finally {
    db.close();
  }
};

export const loadLocalSyncDirectoryHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
  if (!isLocalFolderSyncSupported()) {
    return null;
  }

  const db = await openHandleDb();

  try {
    return await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
      const transaction = db.transaction(HANDLE_STORE_NAME, 'readonly');
      const request = transaction.objectStore(HANDLE_STORE_NAME).get(DIRECTORY_HANDLE_KEY);
      request.onsuccess = () => resolve((request.result as FileSystemDirectoryHandle) ?? null);
      request.onerror = () =>
        reject(request.error ?? new Error('No se pudo cargar la carpeta elegida'));
    });
  } finally {
    db.close();
  }
};

const ensureReadWritePermission = async (
  directoryHandle: FileSystemDirectoryHandle
): Promise<void> => {
  const options: FileSystemHandlePermissionDescriptor = { mode: 'readwrite' };
  const currentPermission = await directoryHandle.queryPermission(options);
  if (currentPermission === 'granted') {
    return;
  }

  const nextPermission = await directoryHandle.requestPermission(options);
  if (nextPermission !== 'granted') {
    throw new Error('Permiso denegado para escribir en la carpeta elegida.');
  }
};

const writeLocalFolderSnapshotIfPermitted = async (): Promise<boolean> => {
  const directoryHandle = await loadLocalSyncDirectoryHandle();
  if (!directoryHandle) {
    return false;
  }

  const permission = await directoryHandle.queryPermission({ mode: 'readwrite' });
  if (permission !== 'granted') {
    return false;
  }

  await writeLocalFolderSnapshot(directoryHandle);
  return true;
};

let automaticSnapshotQueue: Promise<boolean> = Promise.resolve(false);

export const queueLocalFolderSnapshotIfPermitted = (): Promise<boolean> => {
  const nextSnapshot = automaticSnapshotQueue.then(() => writeLocalFolderSnapshotIfPermitted());
  automaticSnapshotQueue = nextSnapshot.catch(() => false);
  return nextSnapshot;
};

const createLocalFolderSnapshot = (): LocalFolderSnapshot => {
  const storage: Record<string, SerializableValue> = {};

  if (typeof window !== 'undefined') {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !shouldIncludeStorageKey(key)) {
        continue;
      }

      const value = localStorage.getItem(key);
      if (value !== null) {
        storage[key] = parseStorageValue(value);
      }
    }
  }

  return {
    app: 'Ozyra Open',
    version: 1,
    exportedAt: new Date().toISOString(),
    storage,
    note: 'Backup local. Las claves de OpenRouter, Tavily y Brave Search no se incluyen por seguridad.',
  };
};

export const pickLocalSyncDirectory = async (): Promise<FileSystemDirectoryHandle> => {
  if (!isLocalFolderSyncSupported()) {
    throw new Error('Tu navegador no permite elegir carpetas locales desde una web.');
  }

  return window.showDirectoryPicker({ mode: 'readwrite' });
};

export const writeLocalFolderSnapshot = async (
  directoryHandle: FileSystemDirectoryHandle
): Promise<{ fileName: string; exportedAt: string }> => {
  await ensureReadWritePermission(directoryHandle);

  const snapshot = createLocalFolderSnapshot();
  const fileName = 'ozyrachat-data.json';
  const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();

  try {
    await writable.write(JSON.stringify(snapshot, null, 2));
  } finally {
    await writable.close();
  }

  return { fileName, exportedAt: snapshot.exportedAt };
};
