/**
 * IndexedDB engine for the local database.
 *
 * Encapsulates connection management, the object store schema and the
 * one-shot migration from the legacy localStorage payload. The public data
 * API lives in `db.ts`; this module has no knowledge of the app domain
 * beyond the record shapes it stores.
 */

import { getBrowserLocalStorage } from './browserStorage';
import { isRecord } from './typeGuards';
import type { ChatRecord, MessageRecord, Profile } from './db';
import { logger } from './logger';

export interface LocalDbState {
  readonly profiles: Profile[];
  readonly chats: ChatRecord[];
  readonly messages: MessageRecord[];
}

export const LOCAL_DB_NAME = 'ozyrachat-local-db';
export const LOCAL_DB_VERSION = 1;

export const PROFILES_STORE = 'profiles';
export const CHATS_STORE = 'chats';
export const MESSAGES_STORE = 'messages';
export const MESSAGES_BY_CHAT_INDEX = 'chat_id';

export const LEGACY_DB_KEY = 'ozyrachat:local-db:v1';
export const MIGRATED_DB_KEY = `${LEGACY_DB_KEY}:migrated`;

const getIndexedDbFactory = (): IDBFactory | null => {
  try {
    return typeof indexedDB === 'undefined' ? null : indexedDB;
  } catch {
    return null;
  }
};

export const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });

/**
 * Runs `operation` inside a single IndexedDB transaction and resolves once
 * the transaction commits. The operation must only await IndexedDB requests
 * belonging to the transaction (awaiting anything else auto-commits it).
 */
export const runTransaction = async <T>(
  db: IDBDatabase,
  storeNames: string | string[],
  mode: IDBTransactionMode,
  operation: (transaction: IDBTransaction) => Promise<T>
): Promise<T> => {
  const transaction = db.transaction(storeNames, mode);
  const completion = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  });

  let result: T;
  try {
    result = await operation(transaction);
  } catch (error) {
    // Swallow the abort notification: the operation error is the one that
    // matters to the caller.
    void completion.catch(() => undefined);
    try {
      transaction.abort();
    } catch {
      // The transaction may already be aborting because of the failure.
    }
    throw error;
  }

  await completion;
  return result;
};

const applySchema = (db: IDBDatabase): void => {
  if (!db.objectStoreNames.contains(PROFILES_STORE)) {
    db.createObjectStore(PROFILES_STORE, { keyPath: 'id' });
  }
  if (!db.objectStoreNames.contains(CHATS_STORE)) {
    db.createObjectStore(CHATS_STORE, { keyPath: 'id' });
  }
  if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
    const messages = db.createObjectStore(MESSAGES_STORE, { keyPath: 'id' });
    messages.createIndex(MESSAGES_BY_CHAT_INDEX, 'chat_id', { unique: false });
  }
};

const openDatabase = (factory: IDBFactory): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = factory.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);
    request.onupgradeneeded = () => applySchema(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to open the local IndexedDB database'));
  });

const preserveCorruptDbSnapshot = (storage: Storage, raw: string): void => {
  try {
    storage.setItem(`${LEGACY_DB_KEY}:corrupt:${Date.now()}`, raw);
  } catch {
    // Best-effort recovery only. If storage is unavailable/full, reset below.
  }
};

const isRecordWithStringId = (value: unknown): value is { readonly id: string } =>
  isRecord(value) && typeof value.id === 'string' && value.id !== '';

const parseLegacyState = (raw: string): LocalDbState | null => {
  const parsed = JSON.parse(raw) as Partial<LocalDbState>;
  if (!isRecord(parsed)) {
    return null;
  }
  return {
    profiles: Array.isArray(parsed.profiles) ? parsed.profiles.filter(isRecordWithStringId) : [],
    chats: Array.isArray(parsed.chats) ? parsed.chats.filter(isRecordWithStringId) : [],
    messages: Array.isArray(parsed.messages) ? parsed.messages.filter(isRecordWithStringId) : [],
  };
};

const isDatabaseEmpty = async (db: IDBDatabase): Promise<boolean> =>
  runTransaction(
    db,
    [PROFILES_STORE, CHATS_STORE, MESSAGES_STORE],
    'readonly',
    async (transaction) => {
      const counts = await Promise.all([
        requestToPromise(transaction.objectStore(PROFILES_STORE).count()),
        requestToPromise(transaction.objectStore(CHATS_STORE).count()),
        requestToPromise(transaction.objectStore(MESSAGES_STORE).count()),
      ]);
      return counts.every((count) => count === 0);
    }
  );

const importLegacyState = async (db: IDBDatabase, state: LocalDbState): Promise<void> =>
  runTransaction(
    db,
    [PROFILES_STORE, CHATS_STORE, MESSAGES_STORE],
    'readwrite',
    async (transaction) => {
      const profiles = transaction.objectStore(PROFILES_STORE);
      const chats = transaction.objectStore(CHATS_STORE);
      const messages = transaction.objectStore(MESSAGES_STORE);
      await Promise.all([
        ...state.profiles.map((profile) => requestToPromise(profiles.put(profile))),
        ...state.chats.map((chat) => requestToPromise(chats.put(chat))),
        ...state.messages.map((message) => requestToPromise(messages.put(message))),
      ]);
    }
  );

/**
 * One-shot migration from the legacy localStorage payload. If the legacy key
 * exists and the IndexedDB stores are still empty, its content is imported.
 * The legacy key is then renamed to `…:migrated` as a user safety net (never
 * deleted). Corrupt JSON is preserved under a `…:corrupt:<timestamp>` key,
 * mirroring the previous localStorage implementation.
 */
const migrateLegacyLocalStorage = async (db: IDBDatabase): Promise<void> => {
  const storage = getBrowserLocalStorage();
  if (!storage) {
    return;
  }

  const raw = storage.getItem(LEGACY_DB_KEY);
  if (raw === null) {
    return;
  }

  let state: LocalDbState | null;
  try {
    state = parseLegacyState(raw);
  } catch (error) {
    logger.error('[LocalDB] Failed to parse legacy local database during migration', error);
    preserveCorruptDbSnapshot(storage, raw);
    storage.removeItem(LEGACY_DB_KEY);
    return;
  }

  if (state && (await isDatabaseEmpty(db))) {
    await importLegacyState(db, state);
  }

  try {
    storage.setItem(MIGRATED_DB_KEY, raw);
    storage.removeItem(LEGACY_DB_KEY);
  } catch {
    // If the safety-net copy cannot be written (e.g. storage is full), keep
    // the original key so no data is lost; the migration retries on the next
    // open and the import is skipped because the stores are populated.
  }
};

interface CachedConnection {
  readonly factory: IDBFactory;
  readonly connection: Promise<IDBDatabase | null>;
}

let cachedConnection: CachedConnection | null = null;

/**
 * Opens (or reuses) the IndexedDB connection. Resolves to `null` when
 * IndexedDB is unavailable (SSR, restricted browser contexts) so callers can
 * degrade gracefully. The cache is keyed by the active IDBFactory so tests
 * that swap in a fresh factory get a fresh database.
 */
export const getLocalDbConnection = (): Promise<IDBDatabase | null> => {
  const factory = getIndexedDbFactory();
  if (!factory) {
    return Promise.resolve(null);
  }

  if (!cachedConnection || cachedConnection.factory !== factory) {
    const connection = (async (): Promise<IDBDatabase | null> => {
      try {
        const db = await openDatabase(factory);
        try {
          await migrateLegacyLocalStorage(db);
        } catch (error) {
          logger.error('[LocalDB] Legacy localStorage migration failed', error);
        }
        return db;
      } catch (error) {
        logger.error('[LocalDB] Failed to open IndexedDB', error);
        return null;
      }
    })();
    cachedConnection = { factory, connection };
  }

  return cachedConnection.connection;
};

/**
 * Reads the whole database as a single serializable state object (used by the
 * local folder snapshot). Returns `null` when the database is unavailable so
 * callers can keep whatever fallback data they already have.
 */
export const exportLocalDbState = async (): Promise<LocalDbState | null> => {
  try {
    const db = await getLocalDbConnection();
    if (!db) {
      return null;
    }

    return await runTransaction(
      db,
      [PROFILES_STORE, CHATS_STORE, MESSAGES_STORE],
      'readonly',
      async (transaction) => {
        const [profiles, chats, messages] = await Promise.all([
          requestToPromise(
            transaction.objectStore(PROFILES_STORE).getAll() as IDBRequest<Profile[]>
          ),
          requestToPromise(
            transaction.objectStore(CHATS_STORE).getAll() as IDBRequest<ChatRecord[]>
          ),
          requestToPromise(
            transaction.objectStore(MESSAGES_STORE).getAll() as IDBRequest<MessageRecord[]>
          ),
        ]);
        return { profiles, chats, messages };
      }
    );
  } catch (error) {
    logger.warn('[LocalDB] Failed to export local database state', { detail: error });
    return null;
  }
};
