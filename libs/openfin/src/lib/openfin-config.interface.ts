/**
 * Configuration for OpenFin core-web connection.
 * Loaded from the application's runtime config (config-dev.json, etc.).
 */
export interface OpenFinConfig {
  /** Whether OpenFin integration is enabled */
  enabled: boolean;

  /** URL of the iframe-broker HTML page (serves the Web Broker) */
  brokerUrl: string;

  /** URL of the shared-worker.js used by the broker */
  sharedWorkerUrl: string;

  /** URL of the default layout JSON snapshot */
  layoutUrl: string;

  /** Interop provider ID for this application */
  providerId: string;

  /** Default interop context group to join on connection */
  defaultContextGroup: string;

  /** Log level for the OpenFin connection ('debug' | 'info' | 'warn' | 'error' | 'none') */
  logLevel: 'debug' | 'info' | 'warn' | 'error' | 'none';
}

/** Default OpenFin configuration (disabled) */
export const DEFAULT_OPENFIN_CONFIG: OpenFinConfig = {
  enabled: false,
  brokerUrl: '',
  sharedWorkerUrl: '',
  layoutUrl: '',
  providerId: 'rates-desktop',
  defaultContextGroup: 'green',
  logLevel: 'info',
};
