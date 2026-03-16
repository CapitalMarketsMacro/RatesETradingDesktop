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

  /** Snap SDK configuration for window docking/snapping (container & platform modes only) */
  snap?: SnapConfig;
}

/**
 * Configuration for OpenFin Snap SDK (window docking/snapping).
 * Only active in container and platform modes where native windows exist.
 */
export interface SnapConfig {
  /** Whether snap/docking is enabled */
  enabled: boolean;
  /** Unique server ID for the snap server (defaults to providerId + '-snap') */
  serverId?: string;
  /** Show snap debug overlay */
  showDebug?: boolean;
  /** Require holding a key (e.g. Ctrl) to stick windows */
  keyToStick?: boolean;
  /** Disable the blur effect on drop previews */
  disableBlurDropPreview?: boolean;
  /** Disable GPU-accelerated dragging (use fallback) */
  disableGPUAcceleratedDragging?: boolean;
  /** Prevent users from unsticking windows (e.g. with Shift) */
  disableUserUnstick?: boolean;
  /** Custom taskbar icon (.ico URL) */
  taskbarIcon?: string;
  /** Windows taskbar grouping ID */
  taskbarIconGroup?: string;
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
