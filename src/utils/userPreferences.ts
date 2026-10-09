/**
 * Utilidades para manejo de preferencias de usuario
 */

import { LOCAL_USER_ID, upsertProfile } from './db';
import { readLocalStorage, writeLocalStorage } from './browserStorage';

export interface UserPreferences {
  readonly name: string;
  readonly knowledge: string;
  readonly traits: string;
  readonly additionalInfo: string;
}

/**
 * Lee las preferencias guardadas en localStorage (fuente de verdad en el arranque)
 */
export function readStoredPreferences(): UserPreferences {
  return {
    name: readLocalStorage('userName') ?? '',
    knowledge: readLocalStorage('userKnowledge') ?? '',
    traits: readLocalStorage('userTraits') ?? '',
    additionalInfo: readLocalStorage('userAdditionalInfo') ?? '',
  };
}

/**
 * Guarda preferencias en localStorage
 */
export function savePreferencesToLocalStorage(prefs: UserPreferences): void {
  writeLocalStorage('userName', prefs.name);
  writeLocalStorage('userKnowledge', prefs.knowledge);
  writeLocalStorage('userTraits', prefs.traits);
  writeLocalStorage('userAdditionalInfo', prefs.additionalInfo);
}

/**
 * Refleja las preferencias en el perfil local de IndexedDB (se incluye en el
 * snapshot de carpeta local y en las exportaciones).
 */
export async function updatePreferencesInDatabase(prefs: UserPreferences): Promise<void> {
  await upsertProfile({
    id: LOCAL_USER_ID,
    email: '',
    name: prefs.name,
    knowledge: prefs.knowledge,
    traits: prefs.traits,
    additionalInfo: prefs.additionalInfo,
  });
}
