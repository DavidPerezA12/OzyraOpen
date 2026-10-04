/**
 * Application Entry Point
 *
 * Punto de entrada principal para la aplicación React Ozyra Open.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { logger } from './utils/logger';
import './index.css';

const initializeApp = () => {
  const rootElement = document.getElementById('root');

  if (!rootElement) {
    throw new Error(
      'Root element not found. Make sure there is an element with id="root" in your HTML.'
    );
  }

  const root = createRoot(rootElement);

  const appTree = (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );

  // StrictMode siempre: en producción es un no-op, en desarrollo expone
  // dobles montajes/efectos antes de que lleguen a producción.
  root.render(<StrictMode>{appTree}</StrictMode>);

  logger.info('🚀 Ozyra Open application initialized successfully');

  if (import.meta.env.DEV) {
    logger.info('🔧 Running in development mode');
  }
};

function createSecureErrorElement(error: Error): HTMLElement {
  // Último recurso sin árbol React (sin i18n): ES/EN según el navegador.
  const useEnglish =
    typeof navigator !== 'undefined' && !navigator.language.toLowerCase().startsWith('es');
  const strings = useEnglish
    ? {
        title: 'Initialization Error',
        body: 'The application could not be initialized.',
        reload: 'Reload Page',
      }
    : {
        title: 'Error de Inicialización',
        body: 'No se pudo inicializar la aplicación.',
        reload: 'Recargar Página',
      };
  const container = document.createElement('div');
  container.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    font-family: system-ui, -apple-system, sans-serif;
    background: #f9fafb;
    margin: 0;
    padding: 20px;
  `;

  const card = document.createElement('div');
  card.style.cssText = `
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    max-width: 400px;
    text-align: center;
  `;

  const title = document.createElement('h1');
  title.style.cssText = 'color: #dc2626; margin-bottom: 1rem;';
  title.textContent = strings.title;

  const description = document.createElement('p');
  description.style.cssText = 'color: #6b7280; margin-bottom: 1rem;';
  description.textContent = strings.body;

  const details = document.createElement('p');
  details.style.cssText =
    'color: #9ca3af; font-size: 0.85rem; margin-bottom: 1.25rem; word-break: break-word;';
  details.textContent = `Detalle: ${error.message}`;

  const reloadButton = document.createElement('button');
  reloadButton.style.cssText = `
    background: #3b82f6;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  `;
  reloadButton.textContent = strings.reload;
  reloadButton.addEventListener('click', () => window.location.reload());

  card.appendChild(title);
  card.appendChild(description);
  card.appendChild(details);
  card.appendChild(reloadButton);
  container.appendChild(card);

  return container;
}

try {
  const debugEnabled = import.meta.env.VITE_DEBUG === 'true';
  const shouldSilence = import.meta.env.PROD || !debugEnabled;

  if (shouldSilence) {
    // eslint-disable-next-line no-console -- este bloque ES el mecanismo de parcheo de consola
    const originalError = console.error.bind(console);

    const maskSensitive = (text: string) =>
      text
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[uuid]')
        .replace(/[A-Za-z0-9-_]{24,}/g, '[id]')
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]');

    // eslint-disable-next-line no-console -- parcheo intencional en producción
    console.info = () => {};
    // eslint-disable-next-line no-console -- parcheo intencional en producción
    console.warn = () => {};

    // eslint-disable-next-line no-console -- parcheo intencional en producción
    console.error = (...args: unknown[]) => {
      try {
        const sanitized = args.map((a) => {
          if (a instanceof Error) {
            return maskSensitive(a.message);
          }
          if (typeof a === 'string') {
            return maskSensitive(a);
          }
          if (typeof a === 'object') {
            return '[object]';
          }
          return String(a);
        });
        originalError(...sanitized);
      } catch {
        originalError('Error');
      }
    };
  }

  initializeApp();
} catch (error) {
  logger.error('Failed to initialize application', error);
  document.body.appendChild(createSecureErrorElement(error as Error));
}
