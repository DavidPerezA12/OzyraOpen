/**
 * Vite Environment Variables Type Definitions
 *
 * This file provides TypeScript type definitions for environment variables
 * used in the Ozyra Open application. All variables prefixed with VITE_ are
 * exposed to the client-side code.
 *
 * Security Note: Never include private secrets here as these
 * variables are exposed to the browser.
 */

/// <reference types="vite/client" />

/**
 * Environment variables interface for type safety
 * All variables are readonly and prefixed with VITE_ for client exposure
 */
interface ImportMetaEnv {
  // ============================================================================
  // API CONFIGURATION
  // ============================================================================

  /**
   * OpenRouter API key for AI model access
   * Optional when a key is saved from Settings
   */
  readonly VITE_OPENROUTER_BASE_URL?: string;
  readonly VITE_OPENROUTER_SITE_URL?: string;
  readonly VITE_OPENROUTER_APP_TITLE?: string;
  readonly VITE_TAVILY_API_KEY?: string;
  readonly VITE_BRAVE_SEARCH_API_KEY?: string;
  readonly VITE_SITE_URL?: string;

  // ============================================================================
  // APPLICATION CONFIGURATION
  // ============================================================================

  /**
   * Application environment
   * Automatically set by Vite
   */
  readonly MODE: string;

  /**
   * Base URL for the application
   * Automatically set by Vite
   */
  readonly BASE_URL: string;

  /**
   * Whether the app is running in production
   * Automatically set by Vite
   */
  readonly PROD: boolean;

  /**
   * Whether the app is running in development
   * Automatically set by Vite
   */
  readonly DEV: boolean;

  /**
   * Whether the app is running in SSR mode
   * Automatically set by Vite
   */
  readonly SSR: boolean;

  // ============================================================================
  // OPTIONAL CONFIGURATION
  // ============================================================================

  /**
   * Enable debug mode
   * Optional: enables additional logging and debugging features
   */
  readonly VITE_DEBUG?: string;
}

// ============================================================================
// TYPE UTILITIES
// ============================================================================

/**
 * Type guard to check if an environment variable is defined
 */
declare global {
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  interface FileSystemHandlePermissionDescriptor {
    readonly mode?: 'read' | 'readwrite';
  }

  interface FileSystemHandle {
    queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  }

  interface Window {
    showDirectoryPicker(
      options?: FileSystemHandlePermissionDescriptor
    ): Promise<FileSystemDirectoryHandle>;
  }

  namespace NodeJS {
    interface ProcessEnv extends Partial<ImportMetaEnv> {
      readonly [key: string]: string | undefined;
    }
  }
}

/**
 * Helper type for required environment variables
 */
export type RequiredEnvVars = Record<string, never>;

/**
 * Helper type for optional environment variables
 */
export type OptionalEnvVars = Pick<
  ImportMetaEnv,
  | 'VITE_OPENROUTER_BASE_URL'
  | 'VITE_OPENROUTER_SITE_URL'
  | 'VITE_OPENROUTER_APP_TITLE'
  | 'VITE_TAVILY_API_KEY'
  | 'VITE_BRAVE_SEARCH_API_KEY'
  | 'VITE_SITE_URL'
  | 'VITE_DEBUG'
>;

/**
 * Environment validation utility type
 */
export interface EnvironmentConfig {
  readonly isValid: boolean;
  readonly missing: string[];
  readonly optional: Partial<OptionalEnvVars>;
  readonly required: RequiredEnvVars;
}
