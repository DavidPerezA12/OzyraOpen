import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { t } from '../i18n';
import {
  readStoredPreferences,
  savePreferencesToLocalStorage,
  updatePreferencesInDatabase,
  type UserPreferences,
} from '../utils/userPreferences';
import { logger } from '../utils/logger';

/** Perfil del usuario (nombre, conocimientos…) que se añade al prompt de sistema. */
export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(readStoredPreferences);

  const savePreferences = useCallback(async (next: UserPreferences) => {
    setPreferences(next);
    savePreferencesToLocalStorage(next);
    try {
      await updatePreferencesInDatabase(next);
    } catch (error) {
      logger.error('Error al actualizar preferencias locales:', error);
      toast.error(t('savePreferencesError'));
    }
  }, []);

  return { preferences, savePreferences } as const;
}
