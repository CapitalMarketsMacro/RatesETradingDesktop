import { NgModule, ModuleWithProviders, InjectionToken, Optional, Inject } from '@angular/core';
import { LoggerService, LoggerConfig } from './logger.service';

/**
 * Injection token for logger configuration
 */
export const LOGGER_CONFIG = new InjectionToken<LoggerConfig>('LOGGER_CONFIG');

/**
 * Logger Module
 * 
 * Provides the LoggerService for dependency injection.
 * Can be configured with LOGGER_CONFIG token.
 * 
 * @example
 * ```typescript
 * LoggerModule.forRoot({
 *   level: 'debug',
 *   enableConsole: true,
 *   prettyPrint: true
 * })
 * ```
 */
@NgModule({
  providers: [
    {
      provide: LoggerService,
      useFactory: (config?: LoggerConfig) => {
        return new LoggerService(config);
      },
      deps: [[new Optional(), new Inject(LOGGER_CONFIG)]],
    },
  ],
})
export class LoggerModule {
  /**
   * Configure the logger module with custom settings
   */
  static forRoot(config?: LoggerConfig): ModuleWithProviders<LoggerModule> {
    return {
      ngModule: LoggerModule,
      providers: [
        {
          provide: LOGGER_CONFIG,
          useValue: config,
        },
      ],
    };
  }

  /**
   * Use default configuration (no configuration needed)
   */
  static forChild(): ModuleWithProviders<LoggerModule> {
    return {
      ngModule: LoggerModule,
      providers: [],
    };
  }
}
