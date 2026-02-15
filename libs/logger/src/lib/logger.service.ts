import { Injectable, Optional, Inject, inject } from '@angular/core';
import pino from 'pino';
import type { Logger as PinoLogger, LoggerOptions } from 'pino';
import { RemoteLoggerService } from './remote-logger.service';

/**
 * Log levels supported by the logger
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Logger configuration interface
 */
export interface LoggerConfig {
  level?: LogLevel;
  enableConsole?: boolean;
  enableRemote?: boolean;
  prettyPrint?: boolean;
  base?: Record<string, unknown>;
}

/**
 * Logger Service
 * 
 * High-performance logging service using Pino as the underlying logger.
 * Provides Angular-friendly API while maintaining Pino's performance benefits.
 * 
 * @example
 * ```typescript
 * constructor(private logger: LoggerService) {}
 * 
 * ngOnInit() {
 *   this.logger.info('Component initialized');
 *   this.logger.debug({ userId: 123 }, 'User data loaded');
 *   this.logger.error(new Error('Error'), 'Failed to load');
 * }
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class LoggerService {
  private readonly logger: PinoLogger;
  private readonly config: LoggerConfig;
  private remoteLogger: RemoteLoggerService | null = null;

  constructor(@Optional() @Inject('LOGGER_CONFIG') config?: LoggerConfig) {
    // Try to inject RemoteLoggerService — may be null in test environments
    try {
      this.remoteLogger = inject(RemoteLoggerService);
    } catch {
      this.remoteLogger = null;
    }
    this.config = {
      level: 'info',
      enableConsole: true,
      enableRemote: false,
      prettyPrint: false,
      ...config,
    };

    // Build Pino options
    const pinoOptions: LoggerOptions = {
      level: this.config.level || 'info',
      base: this.config.base || {},
    };

    // Browser-specific configuration — spdlog-style formatted output
    if (typeof window !== 'undefined') {
      pinoOptions.browser = {
        asObject: true,
        write: (o: object) => {
          if (this.config.enableConsole) {
            const logObj = o as Record<string, unknown>;
            const level = (logObj['level'] as number) || 30;
            const message = (logObj['msg'] as string) || '';

            // ── Build spdlog-style level tag ──
            const levelTag = LoggerService.levelName(level);

            // ── Build timestamp  YYYY-MM-DD HH:mm:ss.SSS ──
            const now = new Date();
            const ts =
              now.getFullYear() + '-' +
              String(now.getMonth() + 1).padStart(2, '0') + '-' +
              String(now.getDate()).padStart(2, '0') + ' ' +
              String(now.getHours()).padStart(2, '0') + ':' +
              String(now.getMinutes()).padStart(2, '0') + ':' +
              String(now.getSeconds()).padStart(2, '0') + '.' +
              String(now.getMilliseconds()).padStart(3, '0');

            // ── Extract logger name from bindings ──
            const name =
              (logObj['component'] as string) ||
              (logObj['service'] as string) ||
              (logObj['module'] as string) ||
              'App';

            // ── Collect remaining contextual data ──
            const data: Record<string, unknown> = { ...logObj };
            // Remove standard/internal keys so only user context remains
            for (const k of ['level', 'time', 'msg', 'component', 'service', 'module']) {
              delete data[k];
            }

            // ── Format: [timestamp] [name] [level] message  {extra} ──
            const hasExtra = Object.keys(data).length > 0;
            const prefix = `[${ts}] [${name}] [${levelTag}]`;
            const formatted = hasExtra
              ? `${prefix} ${message}`
              : `${prefix} ${message}`;

            // Use the correct console method for DevTools filtering
            const consoleFn =
              level >= 50 ? console.error :
              level >= 40 ? console.warn :
              level >= 30 ? console.info :
              level >= 20 ? console.debug :
              console.trace;

            if (hasExtra) {
              consoleFn(formatted, data);
            } else {
              consoleFn(formatted);
            }
          }

          // Push to remote logger (NATS) if initialized
          // The RemoteLoggerService.initialized flag is the sole gate —
          // it is only true after explicit initialization with config.
          if (this.remoteLogger?.initialized) {
            this.remoteLogger.push(o as Record<string, unknown>);
          }
        },
      };
    }

    // Pretty print is disabled in browser builds to avoid bundling Node.js modules
    // Pretty print can be enabled in Node.js environments (e.g., SSR, tests)
    // by setting prettyPrint: true in the config, but it won't work in browser bundles
    // For browser builds, logs will use the browser console formatter above

    this.logger = pino(pinoOptions);
  }

  /**
   * Create a child logger with additional context
   * 
   * @param bindings - Additional context to include in all logs
   * @returns A new LoggerService instance with the additional context
   * 
   * @example
   * ```typescript
   * const componentLogger = this.logger.child({ component: 'MyComponent' });
   * componentLogger.info('Message'); // Will include component: 'MyComponent'
   * ```
   */
  child(bindings: Record<string, unknown>): LoggerService {
    const childLogger = this.logger.child(bindings);
    const childService = new LoggerService(this.config);
    // Replace the internal logger with the child logger
    (childService as any).logger = childLogger;
    // Share the remote logger reference with the child
    (childService as any).remoteLogger = this.remoteLogger;
    return childService;
  }

  /**
   * Log a trace level message
   */
  trace(obj: Record<string, unknown>, msg?: string): void;
  trace(msg: string): void;
  trace(objOrMsg: Record<string, unknown> | string, msg?: string): void {
    if (typeof objOrMsg === 'string') {
      this.logger.trace(objOrMsg);
    } else {
      this.logger.trace(objOrMsg, msg);
    }
  }

  /**
   * Log a debug level message
   */
  debug(obj: Record<string, unknown>, msg?: string): void;
  debug(msg: string): void;
  debug(objOrMsg: Record<string, unknown> | string, msg?: string): void {
    if (typeof objOrMsg === 'string') {
      this.logger.debug(objOrMsg);
    } else {
      this.logger.debug(objOrMsg, msg);
    }
  }

  /**
   * Log an info level message
   */
  info(obj: Record<string, unknown>, msg?: string): void;
  info(msg: string): void;
  info(objOrMsg: Record<string, unknown> | string, msg?: string): void {
    if (typeof objOrMsg === 'string') {
      this.logger.info(objOrMsg);
    } else {
      this.logger.info(objOrMsg, msg);
    }
  }

  /**
   * Log a warn level message
   */
  warn(obj: Record<string, unknown>, msg?: string): void;
  warn(msg: string): void;
  warn(objOrMsg: Record<string, unknown> | string, msg?: string): void {
    if (typeof objOrMsg === 'string') {
      this.logger.warn(objOrMsg);
    } else {
      this.logger.warn(objOrMsg, msg);
    }
  }

  /**
   * Log an error level message
   */
  error(err: Error, msg?: string): void;
  error(obj: Record<string, unknown>, msg?: string): void;
  error(msg: string): void;
  error(errOrObjOrMsg: Error | Record<string, unknown> | string, msg?: string): void {
    if (errOrObjOrMsg instanceof Error) {
      this.logger.error({ err: errOrObjOrMsg }, msg || errOrObjOrMsg.message);
    } else if (typeof errOrObjOrMsg === 'string') {
      this.logger.error(errOrObjOrMsg);
    } else {
      this.logger.error(errOrObjOrMsg, msg);
    }
  }

  /**
   * Log a fatal level message
   */
  fatal(obj: Record<string, unknown>, msg?: string): void;
  fatal(msg: string): void;
  fatal(objOrMsg: Record<string, unknown> | string, msg?: string): void {
    if (typeof objOrMsg === 'string') {
      this.logger.fatal(objOrMsg);
    } else {
      this.logger.fatal(objOrMsg, msg);
    }
  }

  /**
   * Map numeric Pino level to spdlog-style tag
   */
  private static levelName(level: number): string {
    if (level >= 60) return 'fatal';
    if (level >= 50) return 'error';
    if (level >= 40) return 'warn';
    if (level >= 30) return 'info';
    if (level >= 20) return 'debug';
    return 'trace';
  }

  /**
   * Check if a log level is enabled
   */
  isLevelEnabled(level: LogLevel): boolean {
    return this.logger.levelVal <= this.getLevelValue(level);
  }

  /**
   * Get the numeric value for a log level
   */
  private getLevelValue(level: LogLevel): number {
    const levels: Record<LogLevel, number> = {
      trace: 10,
      debug: 20,
      info: 30,
      warn: 40,
      error: 50,
      fatal: 60,
    };
    return levels[level] || 30;
  }

  /**
   * Get the current log level
   */
  get level(): LogLevel {
    const levelVal = this.logger.levelVal;
    if (levelVal <= 10) return 'trace';
    if (levelVal <= 20) return 'debug';
    if (levelVal <= 30) return 'info';
    if (levelVal <= 40) return 'warn';
    if (levelVal <= 50) return 'error';
    return 'fatal';
  }

  /**
   * Set the log level
   */
  set level(level: LogLevel) {
    this.logger.level = level;
  }
}
