import { t } from '../i18n';
import { STORAGE_KEYS } from '../config/constants';
import { forEachLocalStorageEntry } from './browserStorage';
import { LEGACY_DB_KEY, exportLocalDbState } from './localDbStore';

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

  // Internal safety-net copies of the legacy database (":migrated" and
  // ":corrupt:*") stay in localStorage only; the snapshot carries the live
  // IndexedDB state under the canonical key instead.
  if (key.startsWith(`${LEGACY_DB_KEY}:`)) {
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
    request.onerror = () => reject(request.error ?? new Error(t('folderIdbOpenError')));
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
        reject(transaction.error ?? new Error(t('folderHandleSaveError')));
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
      request.onerror = () => reject(request.error ?? new Error(t('folderHandleLoadError')));
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
    throw new Error(t('folderPermissionDenied'));
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
let lastAutomaticSnapshotStart = 0;
let trailingSnapshotTimer: ReturnType<typeof setTimeout> | null = null;

/** Ventana de coalescado: durante el streaming hay decenas de escrituras/seg. */
const AUTOMATIC_SNAPSHOT_THROTTLE_MS = 3000;

const runAutomaticSnapshot = (): Promise<boolean> => {
  lastAutomaticSnapshotStart = Date.now();
  const nextSnapshot = automaticSnapshotQueue.then(() => writeLocalFolderSnapshotIfPermitted());
  automaticSnapshotQueue = nextSnapshot.catch(() => false);
  return nextSnapshot;
};

const scheduleTrailingSnapshot = (): void => {
  if (trailingSnapshotTimer) {
    return;
  }
  const wait = Math.max(
    0,
    AUTOMATIC_SNAPSHOT_THROTTLE_MS - (Date.now() - lastAutomaticSnapshotStart)
  );
  trailingSnapshotTimer = setTimeout(() => {
    trailingSnapshotTimer = null;
    void runAutomaticSnapshot();
  }, wait);
};

export const queueLocalFolderSnapshotIfPermitted = (): Promise<boolean> => {
  if (Date.now() - lastAutomaticSnapshotStart < AUTOMATIC_SNAPSHOT_THROTTLE_MS) {
    // Ráfaga de escrituras (p. ej. streaming): coalescar en un único snapshot
    // diferido en lugar de exportar la DB completa en cada escritura.
    scheduleTrailingSnapshot();
    return automaticSnapshotQueue;
  }
  return runAutomaticSnapshot();
};

const createLocalFolderSnapshot = async (): Promise<LocalFolderSnapshot> => {
  const storage: Record<string, SerializableValue> = {};

  forEachLocalStorageEntry((key, value) => {
    if (shouldIncludeStorageKey(key)) {
      storage[key] = parseStorageValue(value);
    }
  });

  // Chats, messages and profiles live in IndexedDB; export them under the
  // canonical key so existing snapshot import paths keep working. When the
  // database is unavailable, keep whatever localStorage still holds (e.g. the
  // legacy payload before migration).
  const dbState = await exportLocalDbState();
  if (dbState) {
    storage[LEGACY_DB_KEY] = dbState as unknown as SerializableValue;
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
    throw new Error(t('folderPickUnsupported'));
  }

  return window.showDirectoryPicker({ mode: 'readwrite' });
};

export const writeLocalFolderSnapshot = async (
  directoryHandle: FileSystemDirectoryHandle
): Promise<{ fileName: string; exportedAt: string }> => {
  await ensureReadWritePermission(directoryHandle);

  const snapshot = await createLocalFolderSnapshot();
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
