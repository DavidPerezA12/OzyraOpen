import { HISTORY_CONFIG } from '../../config/constants';
import type { Message } from '../../types';

export interface HistoryWindowLimits {
  /** Máximo de mensajes incluidos */
  readonly maxMessages: number;
  /** Granularidad con la que puede avanzar el inicio de la ventana */
  readonly step: number;
  /** Máximo estimado de tokens incluidos */
  readonly maxTokens: number;
}

export const DEFAULT_HISTORY_WINDOW_LIMITS: HistoryWindowLimits = {
  maxMessages: HISTORY_CONFIG.MAX_MESSAGES,
  step: HISTORY_CONFIG.STEP_MESSAGES,
  maxTokens: HISTORY_CONFIG.MAX_TOKENS,
};

const MESSAGE_OVERHEAD_TOKENS = 4;

/**
 * Estimación conservadora (≈3 caracteres por token) para acotar la ventana.
 * No pretende ser exacta: solo evita desbordar el contexto del modelo.
 */
export const estimateTextTokens = (text: string): number => Math.ceil(text.length / 3);

export const estimateMessageTokens = (message: Message): number => {
  const imageCount =
    message.attachments?.filter((attachment) => attachment.type === 'image').length ?? 0;
  return (
    MESSAGE_OVERHEAD_TOKENS +
    estimateTextTokens(message.content) +
    imageCount * HISTORY_CONFIG.IMAGE_TOKENS
  );
};

const findUserMessageFrom = (messages: readonly Message[], start: number): number => {
  for (let index = start; index < messages.length; index += 1) {
    if (messages[index]?.role === 'user') {
      return index;
    }
  }
  return -1;
};

const findLastUserMessage = (messages: readonly Message[]): number => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      return index;
    }
  }
  return -1;
};

/**
 * Selecciona la ventana de historial a enviar, optimizada para prompt caching.
 *
 * Los inicios candidatos son múltiplos de `step` (alineados al siguiente
 * mensaje de usuario, porque varios proveedores exigen que la conversación
 * empiece por `user`). Se elige el primer candidato que respete los límites.
 * Como el historial solo crece por el final, el inicio elegido es estable
 * entre turnos y únicamente salta cuando la ventana deja de caber: el prefijo
 * de la petición se repite byte a byte y el proveedor puede servirlo desde
 * cache. Si nada cabe, se envía al menos el último mensaje de usuario.
 */
export const selectHistoryWindow = (
  messages: readonly Message[],
  limits: HistoryWindowLimits = DEFAULT_HISTORY_WINDOW_LIMITS
): readonly Message[] => {
  const count = messages.length;
  if (count === 0) {
    return messages;
  }

  const suffixTokens = new Array<number>(count + 1).fill(0);
  for (let index = count - 1; index >= 0; index -= 1) {
    const message = messages[index];
    suffixTokens[index] =
      (suffixTokens[index + 1] ?? 0) + (message ? estimateMessageTokens(message) : 0);
  }

  const step = Math.max(1, Math.floor(limits.step));
  for (let candidate = 0; candidate < count; candidate += step) {
    const start = findUserMessageFrom(messages, candidate);
    if (start === -1) {
      break;
    }
    if (count - start <= limits.maxMessages && (suffixTokens[start] ?? 0) <= limits.maxTokens) {
      return start === 0 ? messages : messages.slice(start);
    }
  }

  const lastUserIndex = findLastUserMessage(messages);
  return messages.slice(lastUserIndex === -1 ? count - 1 : lastUserIndex);
};
