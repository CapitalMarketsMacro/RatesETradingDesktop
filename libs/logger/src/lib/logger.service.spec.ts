import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LoggerService, LoggerConfig } from './logger.service';

describe('LoggerService', () => {
  let logger: LoggerService;

  it('should create logger with default config', () => {
    logger = new LoggerService();
    expect(logger).toBeDefined();
    expect(logger.level).toBe('info');
  });

  it('should create logger with custom config', () => {
    const config: LoggerConfig = {
      level: 'debug',
      enableConsole: true,
    };
    logger = new LoggerService(config);
    expect(logger.level).toBe('debug');
  });

  it('should log info messages without throwing', () => {
    logger = new LoggerService({ level: 'info' });
    expect(() => logger.info('Test message')).not.toThrow();
  });

  it('should log debug messages without throwing', () => {
    logger = new LoggerService({ level: 'debug' });
    expect(() => logger.debug('Debug message')).not.toThrow();
  });

  it('should log warn messages without throwing', () => {
    logger = new LoggerService({ level: 'warn' });
    expect(() => logger.warn('Warn message')).not.toThrow();
  });

  it('should log error messages with Error object', () => {
    logger = new LoggerService({ level: 'error' });
    const error = new Error('Test error');
    expect(() => logger.error(error, 'Error occurred')).not.toThrow();
  });

  it('should log error with string message', () => {
    logger = new LoggerService({ level: 'error' });
    expect(() => logger.error('Error message')).not.toThrow();
  });

  it('should log error with object context', () => {
    logger = new LoggerService({ level: 'error' });
    expect(() => logger.error({ code: 'ERR_001' }, 'Error details')).not.toThrow();
  });

  it('should log trace messages without throwing', () => {
    logger = new LoggerService({ level: 'trace' });
    expect(() => logger.trace('Trace message')).not.toThrow();
  });

  it('should log trace with object context', () => {
    logger = new LoggerService({ level: 'trace' });
    expect(() => logger.trace({ detail: 'data' }, 'Trace with context')).not.toThrow();
  });

  it('should log fatal messages without throwing', () => {
    logger = new LoggerService({ level: 'trace' });
    expect(() => logger.fatal('Fatal message')).not.toThrow();
  });

  it('should log fatal with object context', () => {
    logger = new LoggerService({ level: 'trace' });
    expect(() => logger.fatal({ severity: 'critical' }, 'Fatal error')).not.toThrow();
  });

  it('should log with object context', () => {
    logger = new LoggerService({ level: 'info' });
    expect(() =>
      logger.info({ userId: 123, action: 'login' }, 'User logged in')
    ).not.toThrow();
  });

  it('should log debug with object context', () => {
    logger = new LoggerService({ level: 'debug' });
    expect(() =>
      logger.debug({ data: [1, 2, 3] }, 'Data received')
    ).not.toThrow();
  });

  it('should log warn with object context', () => {
    logger = new LoggerService({ level: 'warn' });
    expect(() =>
      logger.warn({ latency: 5000 }, 'High latency detected')
    ).not.toThrow();
  });

  it('should create child logger with context', () => {
    logger = new LoggerService({ level: 'info' });
    const childLogger = logger.child({ component: 'TestComponent' });
    expect(childLogger).toBeDefined();
    expect(childLogger).not.toBe(logger);
    expect(childLogger).toBeInstanceOf(LoggerService);
  });

  it('should create child logger that can log', () => {
    logger = new LoggerService({ level: 'info' });
    const childLogger = logger.child({ component: 'TestComponent' });
    expect(() => childLogger.info('Child message')).not.toThrow();
  });

  it('should check if level is enabled', () => {
    logger = new LoggerService({ level: 'info' });
    expect(logger.isLevelEnabled('info')).toBe(true);
    expect(logger.isLevelEnabled('warn')).toBe(true);
    expect(logger.isLevelEnabled('error')).toBe(true);
    expect(logger.isLevelEnabled('fatal')).toBe(true);
    expect(logger.isLevelEnabled('debug')).toBe(false);
    expect(logger.isLevelEnabled('trace')).toBe(false);
  });

  it('should check level enabled for trace level', () => {
    logger = new LoggerService({ level: 'trace' });
    expect(logger.isLevelEnabled('trace')).toBe(true);
    expect(logger.isLevelEnabled('debug')).toBe(true);
    expect(logger.isLevelEnabled('info')).toBe(true);
  });

  it('should check level enabled for error level', () => {
    logger = new LoggerService({ level: 'error' });
    expect(logger.isLevelEnabled('error')).toBe(true);
    expect(logger.isLevelEnabled('fatal')).toBe(true);
    expect(logger.isLevelEnabled('warn')).toBe(false);
    expect(logger.isLevelEnabled('info')).toBe(false);
  });

  it('should set log level', () => {
    logger = new LoggerService({ level: 'info' });
    logger.level = 'debug';
    expect(logger.level).toBe('debug');
  });

  it('should set log level to trace', () => {
    logger = new LoggerService({ level: 'info' });
    logger.level = 'trace';
    expect(logger.level).toBe('trace');
  });

  it('should set log level to warn', () => {
    logger = new LoggerService({ level: 'info' });
    logger.level = 'warn';
    expect(logger.level).toBe('warn');
  });

  it('should set log level to fatal', () => {
    logger = new LoggerService({ level: 'info' });
    logger.level = 'fatal';
    expect(logger.level).toBe('fatal');
  });

  it('should return correct level for all level values', () => {
    const levels: Array<{ set: any; expected: string }> = [
      { set: 'trace', expected: 'trace' },
      { set: 'debug', expected: 'debug' },
      { set: 'info', expected: 'info' },
      { set: 'warn', expected: 'warn' },
      { set: 'error', expected: 'error' },
      { set: 'fatal', expected: 'fatal' },
    ];

    for (const { set, expected } of levels) {
      logger = new LoggerService({ level: set });
      expect(logger.level).toBe(expected);
    }
  });

  it('should handle console disabled', () => {
    logger = new LoggerService({ level: 'info', enableConsole: false });
    expect(() => logger.info('Should not console')).not.toThrow();
  });

  it('should use default enableConsole true', () => {
    logger = new LoggerService();
    expect(logger).toBeDefined();
  });

  it('should merge config with defaults', () => {
    logger = new LoggerService({ level: 'warn' });
    expect(logger.level).toBe('warn');
  });
});

// ── Tests for the static levelName method ──
// The method is private static so we access it via the class prototype for testing.
describe('LoggerService.levelName (static)', () => {
  // Access the private static method for direct unit testing
  const levelName = (level: number): string =>
    (LoggerService as any).levelName(level);

  it('should return "fatal" for level >= 60', () => {
    expect(levelName(60)).toBe('fatal');
    expect(levelName(70)).toBe('fatal');
    expect(levelName(100)).toBe('fatal');
  });

  it('should return "error" for level 50-59', () => {
    expect(levelName(50)).toBe('error');
    expect(levelName(55)).toBe('error');
    expect(levelName(59)).toBe('error');
  });

  it('should return "warn" for level 40-49', () => {
    expect(levelName(40)).toBe('warn');
    expect(levelName(45)).toBe('warn');
    expect(levelName(49)).toBe('warn');
  });

  it('should return "info" for level 30-39', () => {
    expect(levelName(30)).toBe('info');
    expect(levelName(35)).toBe('info');
    expect(levelName(39)).toBe('info');
  });

  it('should return "debug" for level 20-29', () => {
    expect(levelName(20)).toBe('debug');
    expect(levelName(25)).toBe('debug');
    expect(levelName(29)).toBe('debug');
  });

  it('should return "trace" for level < 20', () => {
    expect(levelName(10)).toBe('trace');
    expect(levelName(0)).toBe('trace');
    expect(levelName(19)).toBe('trace');
  });
});

// ── Tests for getLevelValue (private) via isLevelEnabled ──
describe('LoggerService level edge cases', () => {
  it('should handle child logger level inheritance', () => {
    const logger = new LoggerService({ level: 'debug' });
    const child = logger.child({ component: 'Test' });
    expect(child.isLevelEnabled('debug')).toBe(true);
    expect(child.isLevelEnabled('trace')).toBe(false);
  });

  it('should handle child logger can log at all levels', () => {
    const logger = new LoggerService({ level: 'trace' });
    const child = logger.child({ component: 'TestComponent' });
    expect(() => child.info('info msg')).not.toThrow();
    expect(() => child.debug('debug msg')).not.toThrow();
    expect(() => child.warn('warn msg')).not.toThrow();
    expect(() => child.error('error msg')).not.toThrow();
    expect(() => child.trace('trace msg')).not.toThrow();
    expect(() => child.fatal('fatal msg')).not.toThrow();
  });

  it('should handle error with Error and message', () => {
    const logger = new LoggerService({ level: 'error' });
    const err = new Error('test error');
    expect(() => logger.error(err, 'Custom message')).not.toThrow();
  });

  it('should handle error with Error without message', () => {
    const logger = new LoggerService({ level: 'error' });
    const err = new Error('test error');
    expect(() => logger.error(err)).not.toThrow();
  });

  it('should handle all log methods with object context', () => {
    const logger = new LoggerService({ level: 'trace' });
    expect(() => logger.trace({ key: 'val' }, 'trace ctx')).not.toThrow();
    expect(() => logger.debug({ key: 'val' }, 'debug ctx')).not.toThrow();
    expect(() => logger.info({ key: 'val' }, 'info ctx')).not.toThrow();
    expect(() => logger.warn({ key: 'val' }, 'warn ctx')).not.toThrow();
    expect(() => logger.error({ key: 'val' }, 'error ctx')).not.toThrow();
    expect(() => logger.fatal({ key: 'val' }, 'fatal ctx')).not.toThrow();
  });

  it('should handle base config option', () => {
    const logger = new LoggerService({ level: 'info', base: { pid: 1234 } });
    expect(logger).toBeDefined();
    expect(() => logger.info('with base')).not.toThrow();
  });
});
