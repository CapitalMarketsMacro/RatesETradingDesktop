import { describe, it, expect } from 'vitest';
import { LoggerModule, LOGGER_CONFIG } from './logger-module';
import { LoggerConfig } from './logger.service';

describe('LoggerModule', () => {
  it('should be defined', () => {
    expect(LoggerModule).toBeDefined();
  });

  describe('forRoot', () => {
    it('should return module with providers', () => {
      const result = LoggerModule.forRoot({ level: 'debug' });
      expect(result.ngModule).toBe(LoggerModule);
      expect(result.providers).toBeDefined();
      expect(result.providers!.length).toBeGreaterThan(0);
    });

    it('should provide LOGGER_CONFIG token', () => {
      const config: LoggerConfig = { level: 'warn', enableConsole: false };
      const result = LoggerModule.forRoot(config);
      const configProvider = result.providers!.find(
        (p: any) => p.provide === LOGGER_CONFIG
      );
      expect(configProvider).toBeDefined();
      expect((configProvider as any).useValue).toEqual(config);
    });

    it('should work without config', () => {
      const result = LoggerModule.forRoot();
      expect(result.ngModule).toBe(LoggerModule);
    });
  });

  describe('forChild', () => {
    it('should return module with empty providers', () => {
      const result = LoggerModule.forChild();
      expect(result.ngModule).toBe(LoggerModule);
      expect(result.providers).toEqual([]);
    });
  });

  describe('LOGGER_CONFIG token', () => {
    it('should be defined', () => {
      expect(LOGGER_CONFIG).toBeDefined();
    });
  });
});
