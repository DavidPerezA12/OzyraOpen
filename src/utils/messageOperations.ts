/**
 * Message Operations Utilities
 *
 * Funciones para manejar operaciones de mensajes como:
 * - Creación de mensajes
 * - Edición de mensajes
 * - Regeneración de respuestas
 */

import type { Message } from '../types';

/**
 * Encuentra el índice del mensaje de usuario anterior a un mensaje de asistente
 */
export function findPreviousUserMessageIndex(
  messages: Message[],
  assistantMessageId?: string
): number {
  if (!assistantMessageId) {
    // Buscar el último mensaje de usuario
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        return i;
      }
    }
    return -1;
  }

  const assistantIndex = messages.findIndex((m) => m.id === assistantMessageId);
  if (assistantIndex <= 0 || messages[assistantIndex].role !== 'assistant') {
    return -1;
  }

  // Buscar el mensaje de usuario anterior
  for (let i = assistantIndex - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      return i;
    }
  }

  return -1;
}

/**
 * Copia texto al portapapeles
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Error al copiar al portapapeles:', error);
    return false;
  }
}
