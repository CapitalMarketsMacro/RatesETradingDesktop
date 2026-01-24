import { Provider, EnvironmentProviders, makeEnvironmentProviders, inject } from '@angular/core';
import { ConfigurationService } from '@rates-trading/configuration';
import { ITransportService } from './interfaces/transport.interface';
import { TransportConfig } from './interfaces/transport-config.interface';
import { AmpsTransportService } from './services/amps-transport.service';
import { SolaceTransportService } from './services/solace-transport.service';
import { TRANSPORT_SERVICE, TRANSPORT_CONFIG } from './transport.tokens';

/**
 * Creates the appropriate transport service based on configuration
 */
function transportServiceFactory(config: TransportConfig): ITransportService {
  switch (config.type) {
    case 'amps': {
      if (!config.amps) {
        throw new Error('AMPS configuration is required when transport type is "amps"');
      }
      const ampsService = new AmpsTransportService();
      ampsService.initialize(config.amps);
      return ampsService;
    }

    case 'solace': {
      if (!config.solace) {
        throw new Error('Solace configuration is required when transport type is "solace"');
      }
      const solaceService = new SolaceTransportService();
      solaceService.initialize(config.solace);
      return solaceService;
    }

    case 'websocket': {
      // WebSocket implementation can be added later
      throw new Error('WebSocket transport is not yet implemented');
    }

    default:
      throw new Error(`Unknown transport type: ${config.type}`);
  }
}

/**
 * Factory function that creates transport service from ConfigurationService
 * This is used when configuration is loaded dynamically
 */
function transportServiceFromConfigFactory(): ITransportService {
  const configService = inject(ConfigurationService);
  const appConfig = configService.getConfiguration();

  if (!appConfig?.transport) {
    throw new Error(
      'Transport configuration not found. Ensure configuration is loaded before providing transport.'
    );
  }

  return transportServiceFactory(appConfig.transport);
}

/**
 * Options for configuring the transport module
 */
export interface TransportModuleConfig {
  /**
   * Static transport configuration
   * Use this when configuration is known at compile time
   */
  config?: TransportConfig;

  /**
   * Whether to use the ConfigurationService for dynamic configuration
   * Default: true if config is not provided
   */
  useConfigurationService?: boolean;
}

/**
 * Provides transport services for the application
 *
 * @example Static configuration:
 * ```typescript
 * bootstrapApplication(AppComponent, {
 *   providers: [
 *     provideTransport({
 *       config: {
 *         type: 'amps',
 *         amps: {
 *           url: 'ws://localhost:9000/amps/json',
 *           user: 'rates-user'
 *         }
 *       }
 *     })
 *   ]
 * });
 * ```
 *
 * @example Dynamic configuration from ConfigurationService:
 * ```typescript
 * bootstrapApplication(AppComponent, {
 *   providers: [
 *     provideHttpClient(),
 *     provideTransport() // Uses ConfigurationService automatically
 *   ]
 * });
 * ```
 */
export function provideTransport(options?: TransportModuleConfig): EnvironmentProviders {
  const providers: Provider[] = [];

  if (options?.config) {
    // Static configuration provided
    const config = options.config;
    providers.push({
      provide: TRANSPORT_CONFIG,
      useValue: config,
    });
    providers.push({
      provide: TRANSPORT_SERVICE,
      useFactory: () => transportServiceFactory(config),
    });
  } else {
    // Use ConfigurationService for dynamic configuration
    providers.push({
      provide: TRANSPORT_SERVICE,
      useFactory: transportServiceFromConfigFactory,
    });
  }

  // Also provide the concrete implementations for direct injection if needed
  providers.push(AmpsTransportService);
  providers.push(SolaceTransportService);

  return makeEnvironmentProviders(providers);
}

/**
 * Provides transport with a specific configuration
 * Useful for testing or when you need explicit control
 */
export function provideTransportWithConfig(config: TransportConfig): EnvironmentProviders {
  return provideTransport({ config });
}

/**
 * Creates providers for transport services (for use in NgModule.providers or component providers)
 */
export function createTransportProviders(options?: TransportModuleConfig): Provider[] {
  if (options?.config) {
    const config = options.config;
    return [
      {
        provide: TRANSPORT_CONFIG,
        useValue: config,
      },
      {
        provide: TRANSPORT_SERVICE,
        useFactory: () => transportServiceFactory(config),
      },
      AmpsTransportService,
      SolaceTransportService,
    ];
  }

  return [
    {
      provide: TRANSPORT_SERVICE,
      useFactory: transportServiceFromConfigFactory,
    },
    AmpsTransportService,
    SolaceTransportService,
  ];
}
