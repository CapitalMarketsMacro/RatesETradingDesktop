import { Injectable, Optional, Inject } from '@angular/core';
import pino from 'pino';
import type { Logger as PinoLogger, LoggerOptions } from 'pino';

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

  constructor(@Optional() @Inject('LOGGER_CONFIG') config?: LoggerConfig) {
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

    // Browser-specific configuration
    if (typeof window !== 'undefined') {
      pinoOptions.browser = {
        asObject: true,
        write: (o: object) => {
          if (this.config.enableConsole) {
            // Use appropriate console method based on level
            const logObj = o as Record<string, unknown>;
            const level = (logObj['level'] as number) || 30; // Default to info
            const message = (logObj['msg'] as string) || '';
            const data: Record<string, unknown> = { ...logObj };
            delete data['level'];
            delete data['time'];
            delete data['msg'];

            if (level >= 60) {
              // fatal
              console.error(message, data);
            } else if (level >= 50) {
              // error
              console.error(message, data);
            } else if (level >= 40) {
              // warn
              console.warn(message, data);
            } else if (level >= 30) {
              // info
              console.info(message, data);
            } else if (level >= 20) {
              // debug
              console.debug(message, data);
            } else {
              // trace
              console.trace(message, data);
            }
          }

          // Remote logging can be implemented here
          if (this.config.enableRemote) {
            // TODO: Implement remote logging
          }
        },
      };
    }

    // Add pretty print for development if enabled
    if (this.config.prettyPrint && typeof window === 'undefined') {
      // Only in Node.js environment
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pinoPretty = require('pino-pretty');
        pinoOptions.transport = {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        };
      } catch (e) {
        // pino-pretty not available, continue without it
      }
    }

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
