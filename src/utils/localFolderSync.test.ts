import { beforeEach, describe, expect, it, vi } from 'vitest';

import { queueLocalFolderSnapshotIfPermitted, writeLocalFolderSnapshot } from './localFolderSync';
import { createChat, createMessage } from './db';

describe('automatic local folder snapshots', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        length: 1,
        key: () => 'ozyrachat:local-db:v1',
        getItem: () => JSON.stringify({ chats: [] }),
      },
    });
  });

  it('serializes automatic writes to the selected directory', async () => {
    let activeWrites = 0;
    let maximumConcurrentWrites = 0;
    const writtenSnapshots: string[] = [];

    const directoryHandle = {
      queryPermission: vi.fn().mockResolvedValue('granted'),
      getFileHandle: vi.fn().mockResolvedValue({
        createWritable: vi.fn().mockImplementation(async () => ({
          write: async (value: string) => {
            activeWrites += 1;
            maximumConcurrentWrites = Math.max(maximumConcurrentWrites, activeWrites);
            await new Promise((resolve) => setTimeout(resolve, 5));
            writtenSnapshots.push(value);
            activeWrites -= 1;
          },
          close: vi.fn().mockResolvedValue(undefined),
        })),
      }),
    };

    const createRequest = <T>(result: T) => {
      const request = {
        result,
        error: null,
        onsuccess: null as null | (() => void),
        onerror: null as null | (() => void),
      };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    };
    const database = {
      transaction: () => ({
        objectStore: () => ({
          get: () => createRequest(directoryHandle),
        }),
      }),
      close: vi.fn(),
    };
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: {
        open: () => createRequest(database),
      },
    });

    await Promise.all([
      queueLocalFolderSnapshotIfPermitted(),
      queueLocalFolderSnapshotIfPermitted(),
    ]);

    expect(maximumConcurrentWrites).toBe(1);
    // Coalescado anti-ráfaga: la primera escritura dispara snapshot inmediato
    // y la segunda se fusiona en un único snapshot diferido.
    expect(writtenSnapshots).toHaveLength(1);

    await vi.waitFor(() => expect(writtenSnapshots).toHaveLength(2), {
      timeout: 5000,
    });
    expect(maximumConcurrentWrites).toBe(1);
  });
});

describe('local folder snapshot contents', () => {
  it('exports the IndexedDB state under the canonical local-db key', async () => {
    await createChat({ id: 'chat-1', title: 'Snapshot chat', user_id: 'user-1' });
    await createMessage({
      id: 'msg-1',
      chat_id: 'chat-1',
      role: 'user',
      content: 'backed up',
      timestamp: 1,
      user_id: 'user-1',
    });

    const writtenSnapshots: string[] = [];
    const directoryHandle = {
      queryPermission: vi.fn().mockResolvedValue('granted'),
      requestPermission: vi.fn().mockResolvedValue('granted'),
      getFileHandle: vi.fn().mockResolvedValue({
        createWritable: vi.fn().mockImplementation(async () => ({
          write: async (value: string) => {
            writtenSnapshots.push(value);
          },
          close: vi.fn().mockResolvedValue(undefined),
        })),
      }),
    } as unknown as FileSystemDirectoryHandle;

    await writeLocalFolderSnapshot(directoryHandle);

    expect(writtenSnapshots).toHaveLength(1);
    const snapshot = JSON.parse(String(writtenSnapshots[0])) as {
      storage: Record<string, { chats?: unknown[]; messages?: unknown[] }>;
    };
    const dbState = snapshot.storage['ozyrachat:local-db:v1'];
    expect(dbState).toBeDefined();
    expect(dbState?.chats).toEqual([expect.objectContaining({ id: 'chat-1' })]);
    expect(dbState?.messages).toEqual([
      expect.objectContaining({ id: 'msg-1', content: 'backed up' }),
    ]);
  });
});
