import { useMemo, useSyncExternalStore } from 'react';
import { getBrowserLocalStorage } from '../utils/browserStorage';
import { logger } from '../utils/logger';

const MODEL_USAGE_KEY = 'ozyra_model_usage';
const MAX_USAGE_RECORDS = 40;

interface ModelUsageRecord {
  readonly id: string;
  readonly count: number;
  readonly lastUsedAt: number;
}

const EMPTY_RECORDS: readonly ModelUsageRecord[] = [];
const listeners = new Set<() => void>();

const isUsageRecord = (item: unknown): item is ModelUsageRecord => {
  if (!item || typeof item !== 'object') {
    return false;
  }
  const record = item as Partial<ModelUsageRecord>;
  return (
    typeof record.id === 'string' &&
    typeof record.count === 'number' &&
    typeof record.lastUsedAt === 'number'
  );
};

const parseRecords = (raw: string | null): readonly ModelUsageRecord[] => {
  if (!raw) {
    return EMPTY_RECORDS;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return EMPTY_RECORDS;
    }
    return parsed.filter(isUsageRecord).sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  } catch (error) {
    logger.warn('[Models] Failed to read model usage stats', { detail: error });
    return EMPTY_RECORDS;
  }
};

/**
 * Snapshot memoizado por el valor crudo de localStorage: devuelve la misma
 * referencia mientras el valor no cambie (requisito de useSyncExternalStore)
 * y detecta cambios hechos desde fuera (otra pestaña, tests).
 */
let cachedRaw: string | null = null;
let cachedRecords: readonly ModelUsageRecord[] = EMPTY_RECORDS;

const getModelUsageRecords = (): readonly ModelUsageRecord[] => {
  let raw: string | null = null;
  try {
    raw = getBrowserLocalStorage()?.getItem(MODEL_USAGE_KEY) ?? null;
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedRecords = parseRecords(raw);
  }
  return cachedRecords;
};

const subscribeToModelUsage = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Quita los sufijos de variante (`:online`, `-reasoning`) para agrupar el uso por modelo. */
const normalizeUsedModelId = (modelId: string): string =>
  modelId.replace(/:online$/, '').replace(/(?:-reasoning|:reasoning)(?=:online$|$)/, '');

export const recordModelUsage = (modelId: string): void => {
  const normalizedId = normalizeUsedModelId(modelId);
  const existing = getModelUsageRecords();
  const next = [
    {
      id: normalizedId,
      count: (existing.find((record) => record.id === normalizedId)?.count ?? 0) + 1,
      lastUsedAt: Date.now(),
    },
    ...existing.filter((record) => record.id !== normalizedId),
  ].slice(0, MAX_USAGE_RECORDS);

  try {
    getBrowserLocalStorage()?.setItem(MODEL_USAGE_KEY, JSON.stringify(next));
  } catch (error) {
    logger.warn('[Models] Failed to save model usage stats', { detail: error });
    return;
  }
  listeners.forEach((listener) => listener());
};

/** Ids usados recientemente (más reciente primero), filtrados por los disponibles. */
export const getRecentlyUsedModelIds = (
  isAvailable: (modelId: string) => boolean,
  limit: number
): string[] =>
  getModelUsageRecords()
    .filter((record) => isAvailable(record.id))
    .slice(0, limit)
    .map((record) => record.id);

/** Puntuación de uso por modelo para ordenar el selector (reciente y frecuente arriba). */
export const useModelUsageScores = (): ReadonlyMap<string, number> => {
  const records = useSyncExternalStore(
    subscribeToModelUsage,
    getModelUsageRecords,
    getModelUsageRecords
  );
  return useMemo(
    () => new Map(records.map((record) => [record.id, record.lastUsedAt + record.count] as const)),
    [records]
  );
};
