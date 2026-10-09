import { useCallback, useLayoutEffect, useState } from 'react';
import { readLocalStorage, writeLocalStorage } from '../utils/browserStorage';

const THEME_STORAGE_KEY = 'theme';

const getInitialDarkMode = (): boolean => {
  const savedTheme = readLocalStorage(THEME_STORAGE_KEY);
  if (savedTheme) {
    return savedTheme === 'dark';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const applyTheme = (isDarkMode: boolean): void => {
  const theme = isDarkMode ? 'dark' : 'light';
  document.body.classList.toggle('dark', isDarkMode);
  document.body.classList.toggle('light', !isDarkMode);
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
};

/**
 * Tema claro/oscuro. Sin preferencia guardada sigue al sistema; al cambiarlo
 * manualmente se guarda en este navegador.
 */
export function useTheme() {
  const [isDarkMode, setIsDarkMode] = useState(getInitialDarkMode);

  // Antes del pintado para no mostrar un frame con el tema equivocado.
  useLayoutEffect(() => applyTheme(isDarkMode), [isDarkMode]);

  const toggleTheme = useCallback(() => {
    setIsDarkMode((current) => {
      const next = !current;
      // Escritura idempotente: es seguro aunque React repita el updater.
      writeLocalStorage(THEME_STORAGE_KEY, next ? 'dark' : 'light');
      return next;
    });
  }, []);

  return { isDarkMode, toggleTheme } as const;
}
