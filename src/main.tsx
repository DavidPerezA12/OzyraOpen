/**
 * Application Entry Point
 *
 * Punto de entrada principal para la aplicación React Ozyra Open.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
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

  // Desactivar StrictMode en desarrollo para evitar dobles montajes (flicker en Dev)
  const useStrict = import.meta.env.PROD;
  root.render(useStrict ? <StrictMode>{appTree}</StrictMode> : appTree);

  console.info('🚀 Ozyra Open application initialized successfully');

  if (import.meta.env.DEV) {
    console.info('🔧 Running in development mode');
  }
};

function createSecureErrorElement(error: Error): HTMLElement {
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
  title.textContent = 'Error de Inicialización';

  const description = document.createElement('p');
  description.style.cssText = 'color: #6b7280; margin-bottom: 1rem;';
  description.textContent = 'No se pudo inicializar la aplicación.';

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
  reloadButton.textContent = 'Recargar Página';
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
    const originalError = console.error.bind(console);

    const maskSensitive = (text: string) =>
      text
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[uuid]')
        .replace(/[A-Za-z0-9-_]{24,}/g, '[id]')
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]');

    console.info = () => {};
    console.warn = () => {};

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
  console.error('Failed to initialize application:', error);
  document.body.appendChild(createSecureErrorElement(error as Error));
}
