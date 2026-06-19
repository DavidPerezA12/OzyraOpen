/**
 * Professional logging utility for Ozyra Open
 * Provides structured logging with different levels and production-safe output
 *
 * @module utils/logger
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment: boolean;
  private isDebugEnabled: boolean;

  constructor() {
    this.isDevelopment = import.meta.env.DEV;
    this.isDebugEnabled = import.meta.env.VITE_DEBUG === 'true';
  }

  /**
   * Sanitizes sensitive data from log messages
   */
  private sanitize(value: unknown): unknown {
    if (typeof value === 'string') {
      return value
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[UUID]')
        .replace(/[A-Za-z0-9-_]{24,}/g, '[TOKEN]')
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]')
        .replace(/Bearer\s+[^\s]+/gi, 'Bearer [TOKEN]')
        .replace(/password['":]?\s*['"]\w+['"]/gi, 'password: "[REDACTED]"');
    }
    return value;
  }

  /**
   * Formats log message with timestamp and context
   */
  private format(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  /**
   * Debug level logging - only in development with debug flag
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment && this.isDebugEnabled) {
      console.info(this.format('debug', message, context));
    }
  }

  /**
   * Info level logging - general information
   */
  info(message: string, context?: LogContext): void {
    if (this.isDevelopment || this.isDebugEnabled) {
      console.info(this.format('info', message, context));
    }
  }

  /**
   * Warning level logging - non-critical issues
   */
  warn(message: string, context?: LogContext): void {
    const sanitizedContext = context ? this.sanitize(context) : undefined;
    console.warn(this.format('warn', message, sanitizedContext as LogContext));
  }

  /**
   * Error level logging - critical issues
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorInfo: LogContext = { ...context };

    if (error instanceof Error) {
      errorInfo.error = {
        name: error.name,
        message: this.sanitize(error.message),
        stack: this.isDevelopment ? error.stack : undefined,
      };
    } else if (error) {
      errorInfo.error = this.sanitize(error);
    }

    console.error(this.format('error', message, errorInfo));
  }

  /**
   * Performance logging - tracks execution time
   */
  performance(label: string, startTime: number): void {
    if (this.isDevelopment) {
      const duration = performance.now() - startTime;
      this.debug(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * API logging - tracks API calls
   */
  api(method: string, endpoint: string, status?: number, duration?: number): void {
    const statusEmoji = status && status < 400 ? '✅' : '❌';
    const durationStr = duration ? ` (${duration.toFixed(2)}ms)` : '';
    this.info(`${statusEmoji} ${method} ${endpoint}${durationStr}`, { status });
  }
}

// Export singleton instance
export const logger = new Logger();
