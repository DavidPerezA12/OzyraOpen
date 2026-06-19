/**
 * Utilidades para manejo de preferencias de usuario
 */

import { getProfile, upsertProfile } from './db';

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
  localStorage.setItem('userName', prefs.name);
  localStorage.setItem('userKnowledge', prefs.knowledge);
  localStorage.setItem('userTraits', prefs.traits);
  localStorage.setItem('userAdditionalInfo', prefs.additionalInfo);
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
