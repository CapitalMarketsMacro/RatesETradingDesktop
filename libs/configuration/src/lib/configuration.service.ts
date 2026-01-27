import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { RatesAppConfiguration } from './rates-app-configuration';
import { LoggerService } from '@rates-trading/logger';

@Injectable({
  providedIn: 'root',
})
export class ConfigurationService {
  private logger = inject(LoggerService).child({ service: 'ConfigurationService' });
  private configCache$?: Observable<RatesAppConfiguration>;
  private currentConfig?: RatesAppConfiguration;
  private currentEnvironment?: string;

  constructor(private http: HttpClient) {}

  /**
   * Gets the current environment from URL query parameters
   * @returns The environment string (defaults to 'dev')
   */
  getEnvironmentFromUrl(): string {
    if (typeof window === 'undefined') {
      return 'dev';
    }

    const urlParams = new URLSearchParams(window.location.search);
    const env = urlParams.get('env') || 'dev';
    return env.toLowerCase();
  }

  /**
   * Loads configuration from the appropriate config file based on environment
   * @param environment Optional environment override. If not provided, reads from URL query parameter
   * @returns Observable of the configuration
   */
  loadConfiguration(environment?: string): Observable<RatesAppConfiguration> {
    const env = environment || this.getEnvironmentFromUrl();

    // Return cached config if environment hasn't changed
    if (this.configCache$ && this.currentEnvironment === env && this.currentConfig) {
      return of(this.currentConfig);
    }

    // Load new configuration
    const configPath = `assets/config-${env}.json`;
    this.currentEnvironment = env;

    this.configCache$ = this.http.get<RatesAppConfiguration>(configPath).pipe(
      map((config) => {
        // Inject environment into config
        config.app = {
          ...config.app,
          environment: env,
        };
        this.currentConfig = config;
        return config;
      }),
      catchError((error) => {
        this.logger.error(error as Error, `Failed to load configuration from ${configPath}`);
        // Fallback to dev config if available
        if (env !== 'dev') {
          return this.http.get<RatesAppConfiguration>('assets/config-dev.json').pipe(
            map((config) => {
              config.app = {
                ...config.app,
                environment: 'dev',
              };
              this.currentConfig = config;
              return config;
            }),
            catchError((fallbackError) => {
              this.logger.error(fallbackError as Error, 'Failed to load fallback configuration');
              return throwError(
                () =>
                  new Error(
                    `Unable to load configuration. Tried ${configPath} and assets/config-dev.json`
                  )
              );
            })
          );
        }
        return throwError(() => error);
      }),
      shareReplay(1)
    );

    return this.configCache$;
  }

  /**
   * Gets the current configuration synchronously
   * @returns The current configuration or undefined if not loaded
   */
  getConfiguration(): RatesAppConfiguration | undefined {
    return this.currentConfig;
  }

  /**
   * Gets the current configuration as an Observable
   * If configuration hasn't been loaded, it will be loaded automatically
   * @returns Observable of the configuration
   */
  getConfiguration$(): Observable<RatesAppConfiguration> {
    if (this.currentConfig) {
      return of(this.currentConfig);
    }
    return this.loadConfiguration();
  }

  /**
   * Clears the configuration cache
   */
  clearCache(): void {
    this.configCache$ = undefined;
    this.currentConfig = undefined;
    this.currentEnvironment = undefined;
  }

  /**
   * Gets the current environment
   * @returns The current environment string
   */
  getCurrentEnvironment(): string {
    return this.currentEnvironment || this.getEnvironmentFromUrl();
  }
}
