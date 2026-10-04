/**
 * Utilidades para manejo de preferencias de usuario
 */

import { getProfile, upsertProfile } from './db';
import { writeLocalStorage } from './browserStorage';

export interface UserPreferences {
  name: string;
  knowledge: string;
  traits: string;
  additionalInfo: string;
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
 * Actualiza preferencias en la base de datos
 */
export async function updatePreferencesInDatabase(
  userId: string,
  prefs: UserPreferences
): Promise<void> {
  const existing = await getProfile(userId);
  await upsertProfile({
    id: userId,
    email: existing?.email ?? '',
    ...existing,
    name: prefs.name,
    knowledge: prefs.knowledge,
    traits: prefs.traits,
    additionalInfo: prefs.additionalInfo,
  });
}
