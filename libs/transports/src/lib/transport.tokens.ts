import { InjectionToken } from '@angular/core';
import { ITransportService } from './interfaces/transport.interface';
import { TransportConfig } from './interfaces/transport-config.interface';

/**
 * Injection token for the transport service
 * Use this token to inject the appropriate transport implementation
 *
 * @example
 * ```typescript
 * import { Component, inject } from '@angular/core';
 * import { TRANSPORT_SERVICE, ITransportService } from '@rates-trading/transports';
 *
 * @Component({...})
 * export class MyComponent {
 *   private transport = inject(TRANSPORT_SERVICE);
 * }
 * ```
 */
export const TRANSPORT_SERVICE = new InjectionToken<ITransportService>(
  'TransportService'
);

/**
 * Injection token for transport configuration
 * This is used internally by the transport factory
 */
export const TRANSPORT_CONFIG = new InjectionToken<TransportConfig>(
  'TransportConfig'
);
