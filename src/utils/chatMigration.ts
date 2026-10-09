/**
 * Utilidades para migración de chats locales a base de datos
 */

import type { Chat as ChatType } from '../types';
import { fromChatRecord, toChatRecord, toMessageRecord } from '../services/chat/chatRecords';
import {
  LOCAL_USER_ID,
  createChat as createChatDb,
  createMessage,
  getChats as getChatsDb,
  getMessages as getMessagesDb,
} from './db';
import { readLocalStorage, removeLocalStorage, writeLocalStorage } from './browserStorage';
import { generateId } from './id';
import { logger } from './logger';

/**
 * Migra/reconcilia chats guardados en localStorage a la base local actual.
 */
export async function migrateLocalChatsToDatabase(
  localChats: readonly ChatType[]
): Promise<{ success: boolean; migratedCount: number }> {
  const migrationKey = `migrated_chats_${LOCAL_USER_ID}`;
  const alreadyMigrated = readLocalStorage(migrationKey);
  const existingChats = await getChatsDb(LOCAL_USER_ID);
  const existingChatIds = new Set(existingChats.map((chat) => chat.id));

  if (alreadyMigrated && localChats.every((chat) => existingChatIds.has(chat.id))) {
    logger.info('[Migration] Chats already reconciled for this user, skipping');
    removeLocalStorage('chats');
    return { success: true, migratedCount: 0 };
  }

  if (localChats.length === 0) {
    writeLocalStorage(migrationKey, 'true');
    removeLocalStorage('chats');
    return { success: true, migratedCount: 0 };
  }

  logger.info(`[Migration] Reconciling ${localChats.length} local chats`);
  const claimedChatIds = new Set(existingChatIds);
  const migrationResults = await Promise.all(
    localChats.map(async (chat) => {
      const shouldCreateChat = !claimedChatIds.has(chat.id);
      claimedChatIds.add(chat.id);
      let migratedCount = 0;
      let failed = false;

      try {
        if (shouldCreateChat) {
          await createChatDb(toChatRecord(chat));
          migratedCount = 1;
        }

        const existingMessages = await getMessagesDb(chat.id);
        const existingMessageIds = new Set(existingMessages.map((message) => message.id));

        await Promise.all(
          chat.messages.map(async (message) => {
            const messageId = message.id && message.id.trim() !== '' ? message.id : generateId();

            if (existingMessageIds.has(messageId)) {
              logger.info(`[Migration] Skipping existing message: ${messageId}`);
              return;
            }

            try {
              await createMessage(toMessageRecord({ ...message, id: messageId }, chat.id));
              logger.info(`[Migration] Reconciled message: ${messageId}`);
            } catch (messageError: unknown) {
              failed = true;
              logger.error('Error migrando mensaje local:', messageError);
            }
          })
        );

        logger.info(`[Migration] Successfully reconciled chat: ${chat.id}`);
      } catch (chatError: unknown) {
        failed = true;
        logger.error('Error migrando chat local:', chatError);
      }

      return { migratedCount, failed };
    })
  );
  const migratedCount = migrationResults.reduce((total, result) => total + result.migratedCount, 0);
  const hasFailures = migrationResults.some((result) => result.failed);

  if (hasFailures) {
    logger.warn('[Migration] Migration finished with errors; keeping legacy chats for retry');
    return { success: false, migratedCount };
  }

  // Mark migration as completed
  writeLocalStorage(migrationKey, 'true');
  removeLocalStorage('chats');
  logger.info('[Migration] Migration completed successfully');

  return { success: true, migratedCount };
}

/**
 * Carga chats desde la base de datos
 */
export async function loadChatsFromDatabase(): Promise<ChatType[]> {
  const chatRecords = await getChatsDb(LOCAL_USER_ID);
  return Promise.all(
    chatRecords.map(async (record) => fromChatRecord(record, await getMessagesDb(record.id)))
  );
}
