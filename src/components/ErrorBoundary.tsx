/**
 * Error Boundary components
 *
 * Proporciona un manejador de errores reutilizable y una interfaz de fallback
 * para mostrar errores no controlados en la aplicación.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '../i18n';
import { logger } from '../utils/logger';

export class ErrorBoundary extends Component<
  {
    children: ReactNode;
    /**
     * Fallback propio de la zona (chat, composer, sidebar...). Si se omite,
     * se muestra la pantalla completa de error con recarga.
     */
    fallback?: ReactNode;
    /**
     * Fallback con reintento: recibe `retry` para remontar solo el subárbol
     * caído sin recargar la página (el estado vive fuera del boundary).
     */
    renderFallback?: (retry: () => void) => ReactNode;
    /**
     * Claves que, al cambiar, reintentan la zona sin recargar (p. ej. el id
     * del chat actual). El estado de la app vive fuera del boundary, así que
     * los borradores y el historial se conservan.
     */
    resetKeys?: readonly unknown[];
  },
  { hasError: boolean; error: Error | null }
> {
  private previousResetKeys: readonly unknown[];

  constructor(props: {
    children: ReactNode;
    fallback?: ReactNode;
    renderFallback?: (retry: () => void) => ReactNode;
    resetKeys?: readonly unknown[];
  }) {
    super(props);
    this.state = { hasError: false, error: null };
    this.previousResetKeys = props.resetKeys ?? [];
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Application Error:', error);
    logger.error('Component Stack:', errorInfo.componentStack);

    // Los errores se registran localmente en consola; no hay servicio remoto de monitorización.
  }

  override componentDidUpdate() {
    const resetKeys = this.props.resetKeys ?? [];
    const changed =
      resetKeys.length !== this.previousResetKeys.length ||
      resetKeys.some((key, index) => !Object.is(key, this.previousResetKeys[index]));
    this.previousResetKeys = resetKeys;
    if (changed && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleReset = () => {
    // Con fallback de zona basta con reintentar el subárbol (sin reload).
    if (this.props.fallback) {
      this.setState({ hasError: false, error: null });
      return;
    }
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  override render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.renderFallback) {
        return <>{this.props.renderFallback(this.handleReset)}</>;
      }
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
              <svg
                className="w-6 h-6 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>

            <h1 className="text-xl font-semibold text-gray-900 dark:text-white text-center mb-2">
              {t('errorBoundaryTitle')}
            </h1>

            <p className="text-gray-600 dark:text-gray-300 text-center mb-4">
              {t('errorBoundaryBody')}
            </p>

            {import.meta.env.DEV && (
              <details className="mb-4">
                <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                  {t('errorBoundaryDetails')}
                </summary>
                <pre className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 p-2 rounded overflow-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <button
              type="button"
              onClick={this.handleReset}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {t('errorBoundaryRetry')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
