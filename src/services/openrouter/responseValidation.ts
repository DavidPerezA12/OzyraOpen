import { isRecord } from '../../utils/typeGuards';
import type { ChatCompletionResponse } from './types';

const isMessageLike = (value: unknown): boolean => {
  if (!isRecord(value)) {
    return false;
  }
  const content = value.content;
  return typeof content === 'string' || content === null || content === undefined;
};

const isChoiceLike = (value: unknown): boolean => {
  if (!isRecord(value)) {
    return false;
  }
  return isRecord(value.message) && isMessageLike(value.message);
};

/**
 * Valida en runtime la respuesta de `/chat/completions` antes del cast.
 *
 * Sin esto, un cambio de formato en OpenRouter (o un proxy intermedio)
 * produce `undefined` silenciosos aguas abajo (`choices[0].message.content`).
 * El contrato mínimo: objeto con array `choices` donde cada choice trae un
 * objeto `message` con `content` string (o ausente/nulo, p. ej. tool calls).
 */
export function parseChatCompletionResponse(data: unknown): ChatCompletionResponse {
  if (!isRecord(data)) {
    throw new Error('Invalid chat completion response: not an object');
  }

  if ('error' in data && data.error !== undefined && data.error !== null) {
    const detail = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
    throw new Error(detail);
  }

  if (!Array.isArray(data.choices)) {
    throw new Error('Invalid chat completion response: missing choices array');
  }

  if (!data.choices.every(isChoiceLike)) {
    throw new Error('Invalid chat completion response: malformed choice entry');
  }

  return data as unknown as ChatCompletionResponse;
}
