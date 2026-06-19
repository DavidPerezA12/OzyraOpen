import { beforeEach, describe, expect, it, vi } from 'vitest';

import { queueLocalFolderSnapshotIfPermitted } from './localFolderSync';

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
    expect(writtenSnapshots).toHaveLength(2);
  });
});
