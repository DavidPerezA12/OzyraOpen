/**
 * Type Guards and Validation Utilities
 *
 * Centralized type guards and validation functions for the Ozyra Open application.
 * These utilities help ensure type safety and data validation across the codebase.
 */

import type { Chat, Message } from '../types';

/**
 * Type guard to check if a value is a valid stored message
 */
const isStoredMessage = (value: unknown): value is Message => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<Message>;
  const allowedRoles: Message['role'][] = ['user', 'assistant', 'model'];

  return (
    typeof candidate.id === 'string' &&
    allowedRoles.includes(candidate.role as Message['role']) &&
    typeof candidate.content === 'string' &&
    typeof candidate.timestamp === 'number'
  );
};

/**
 * Type guard to check if a value is a valid stored chat
 */
const isStoredChat = (value: unknown): value is Chat & { messages: Message[] } => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<Chat & { messages: Message[] }>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.createdAt === 'number' &&
    typeof candidate.model === 'string' &&
    Array.isArray(candidate.messages) &&
    candidate.messages.every(isStoredMessage)
  );
};

/**
 * Parse and validate stored chats from unknown data
 */
export const parseStoredChats = (raw: unknown): (Chat & { messages: Message[] })[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((value) =>
    isStoredChat(value)
      ? [
          {
            ...value,
            messages: value.messages.map((message) => ({ ...message })),
          },
        ]
      : []
  );
};

/**
 * Type guard to check if a value is a record object
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Validate and parse fetch URL parameters
 */
