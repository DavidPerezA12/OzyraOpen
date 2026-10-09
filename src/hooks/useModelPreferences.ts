import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import {
  getInitialEnabledModelIds,
  getValidModelId,
  isModelAvailable,
  isModelCatalogStale,
  subscribeToModelCatalog,
  syncModelCatalog,
} from '../models/catalog';
import { recordModelUsage } from '../models/usage';
import {
  readLocalStorage,
  readLocalStorageJson,
  writeLocalStorage,
  writeLocalStorageJson,
} from '../utils/browserStorage';
import { logger } from '../utils/logger';

const SELECTED_MODEL_KEY = 'selectedModel';
const ENABLED_MODEL_IDS_KEY = 'ozyra:enabled-model-ids:v2';
const LEGACY_ENABLED_MODEL_IDS_KEY = 'enabledModelIds';
const LEGACY_ENABLED_MODEL_IDS_MAX = 40;

const readEnabledIds = (key: string, maxItems?: number): string[] | null => {
  const parsed = readLocalStorageJson<unknown>(key);
  if (!Array.isArray(parsed) || (maxItems !== undefined && parsed.length > maxItems)) {
    return null;
  }
  return parsed.filter((id): id is string => typeof id === 'string' && isModelAvailable(id));
};

/**
 * Lista guardada de modelos activos. Una lista vacía es una preferencia
 * explícita del usuario y se respeta; la clave legacy solo se usa si no está vacía.
 */
const getInitialEnabledModelIdsFromStorage = (): string[] => {
  const currentIds = readEnabledIds(ENABLED_MODEL_IDS_KEY);
  if (currentIds !== null) {
    return currentIds;
  }
  const legacyIds = readEnabledIds(LEGACY_ENABLED_MODEL_IDS_KEY, LEGACY_ENABLED_MODEL_IDS_MAX);
  return legacyIds && legacyIds.length > 0 ? legacyIds : getInitialEnabledModelIds();
};

const getInitialSelectedModel = (): string => getValidModelId(readLocalStorage(SELECTED_MODEL_KEY));

/** Modelo seleccionado y modelos activos, persistidos y sincronizados con el catálogo. */
export function useModelPreferences() {
  const [selectedModel, setSelectedModelState] = useState(getInitialSelectedModel);
  const [enabledModelIds, setEnabledModelIdsState] = useState<string[]>(
    getInitialEnabledModelIdsFromStorage
  );

  const setSelectedModel = useCallback((modelId: string) => {
    const validModelId = getValidModelId(modelId);
    setSelectedModelState(validModelId);
    writeLocalStorage(SELECTED_MODEL_KEY, validModelId);
  }, []);

  const setEnabledModelIds = useCallback<Dispatch<SetStateAction<string[]>>>((action) => {
    setEnabledModelIdsState((current) => {
      const next = typeof action === 'function' ? action(current) : action;
      writeLocalStorageJson(ENABLED_MODEL_IDS_KEY, next);
      return next;
    });
  }, []);

  const toggleModelEnabled = useCallback(
    (modelId: string) => {
      setEnabledModelIds((current) =>
        current.includes(modelId) ? current.filter((id) => id !== modelId) : [...current, modelId]
      );
    },
    [setEnabledModelIds]
  );

  /** Selección desde el composer: registra el uso y garantiza que el modelo quede activo. */
  const chooseModel = useCallback(
    (modelId: string) => {
      const validModelId = getValidModelId(modelId);
      recordModelUsage(validModelId);
      setSelectedModel(validModelId);
      setEnabledModelIds((current) =>
        current.includes(validModelId) ? current : [...current, validModelId]
      );
      return validModelId;
    },
    [setEnabledModelIds, setSelectedModel]
  );

  // Revalidar la selección cuando cambia el catálogo (sincronización).
  useEffect(
    () =>
      subscribeToModelCatalog(() => {
        setSelectedModelState((current) => {
          const next = getValidModelId(current);
          writeLocalStorage(SELECTED_MODEL_KEY, next);
          return next;
        });
        setEnabledModelIds((current) => {
          if (current.length === 0) {
            return current;
          }
          const stillAvailable = current.filter(isModelAvailable);
          return stillAvailable.length > 0 ? stillAvailable : getInitialEnabledModelIds();
        });
      }),
    [setEnabledModelIds]
  );

  // Refrescar en segundo plano un catálogo sincronizado que ha caducado.
  useEffect(() => {
    if (!isModelCatalogStale()) {
      return;
    }
    syncModelCatalog().catch((error: unknown) => {
      logger.warn('[Models] No se pudo refrescar el catálogo caducado', { detail: error });
    });
  }, []);

  return {
    selectedModel,
    setSelectedModel,
    chooseModel,
    enabledModelIds,
    setEnabledModelIds,
    toggleModelEnabled,
  } as const;
}
