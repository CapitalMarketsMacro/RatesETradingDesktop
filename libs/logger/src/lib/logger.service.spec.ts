import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoggerService, LoggerConfig } from './logger.service';

describe('LoggerService', () => {
  let logger: LoggerService;
  let consoleSpy: {
    trace: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    consoleSpy = {
      trace: vi.spyOn(console, 'trace').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

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

  it('should log info messages', () => {
    logger = new LoggerService({ level: 'info' });
    logger.info('Test message');
    expect(consoleSpy.info).toHaveBeenCalled();
  });

  it('should log debug messages when level allows', () => {
    logger = new LoggerService({ level: 'debug' });
    logger.debug('Debug message');
    expect(consoleSpy.debug).toHaveBeenCalled();
  });

  it('should not log debug messages when level is info', () => {
    logger = new LoggerService({ level: 'info' });
    logger.debug('Debug message');
    // Debug should not be called when level is info
    expect(consoleSpy.debug).not.toHaveBeenCalled();
  });

  it('should log error messages', () => {
    logger = new LoggerService({ level: 'error' });
    const error = new Error('Test error');
    logger.error(error, 'Error occurred');
    expect(consoleSpy.error).toHaveBeenCalled();
  });

  it('should log error with string message', () => {
    logger = new LoggerService({ level: 'error' });
    logger.error('Error message');
    expect(consoleSpy.error).toHaveBeenCalled();
  });

  it('should log with object context', () => {
    logger = new LoggerService({ level: 'info' });
    logger.info({ userId: 123, action: 'login' }, 'User logged in');
    expect(consoleSpy.info).toHaveBeenCalled();
  });

  it('should create child logger with context', () => {
    logger = new LoggerService({ level: 'info' });
    const childLogger = logger.child({ component: 'TestComponent' });
    expect(childLogger).toBeDefined();
    expect(childLogger).not.toBe(logger);
  });

  it('should check if level is enabled', () => {
    logger = new LoggerService({ level: 'info' });
    expect(logger.isLevelEnabled('info')).toBe(true);
    expect(logger.isLevelEnabled('warn')).toBe(true);
    expect(logger.isLevelEnabled('debug')).toBe(false);
  });

  it('should set log level', () => {
    logger = new LoggerService({ level: 'info' });
    logger.level = 'debug';
    expect(logger.level).toBe('debug');
  });
});
