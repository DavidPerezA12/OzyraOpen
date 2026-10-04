import { useCallback, useState } from 'react';
import { readLocalStorage, writeLocalStorage } from '../utils/browserStorage';

const FAVORITE_CHAT_IDS_KEY = 'ozyra:favorite-chat-ids:v1';
const MAX_FAVORITES = 500;

const readFavoriteIds = (): Set<string> => {
  try {
    const raw = readLocalStorage(FAVORITE_CHAT_IDS_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(
      parsed
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
        .slice(0, MAX_FAVORITES)
    );
  } catch {
    return new Set();
  }
};

/**
 * Favoritos de chats persistidos en localStorage.
 *
 * Antes el filtro "solo favoritos" de la búsqueda existía en la UI pero el
 * conjunto siempre estaba vacío: activarlo devolvía cero resultados sin
 * forma de añadir ninguno.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(readFavoriteIds);

  const toggleFavorite = useCallback((chatId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) {
        next.delete(chatId);
      } else if (next.size < MAX_FAVORITES) {
        next.add(chatId);
      }
      writeLocalStorage(FAVORITE_CHAT_IDS_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  return { favorites, toggleFavorite };
}
