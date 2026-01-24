/**
 * Main configuration interface for the Rates E-Trading Desktop application
 */
export interface RatesAppConfiguration {
  /** Application metadata */
  app: {
    name: string;
    version: string;
    environment: string;
  };

  /** API endpoints configuration */
  api: {
    baseUrl: string;
    timeout: number;
    retryAttempts?: number;
  };

  /** Messaging/Transport configuration */
  transport?: {
    type: 'solace' | 'amps' | 'websocket';
    solace?: {
      url: string;
      vpnName: string;
      userName: string;
      password?: string;
      clientName?: string;
      connectTimeout?: number;
      reconnect?: {
        enabled: boolean;
        retryWaitMs?: number;
        maxAttempts?: number;
      };
      keepAliveInterval?: number;
      keepAliveIntervalLimit?: number;
      generateSendTimestamps?: boolean;
      generateReceiveTimestamps?: boolean;
      includeSenderId?: boolean;
      options?: Record<string, unknown>;
    };
    amps?: {
      url: string;
      user?: string;
      password?: string;
      messageType?: 'json' | 'fix' | 'nvfix' | 'binary';
      clientName?: string;
      heartbeatInterval?: number;
      reconnect?: {
        enabled: boolean;
        initialDelay?: number;
        maxDelay?: number;
        maxAttempts?: number;
      };
      options?: Record<string, unknown>;
    };
    websocket?: {
      url: string;
      reconnectInterval?: number;
      maxReconnectAttempts?: number;
      pingInterval?: number;
    };
  };

  /** Market data configuration */
  marketData?: {
    updateInterval: number;
    maxHistorySize?: number;
    symbols?: string[];
  };

  /** Trading configuration */
  trading?: {
    enabled: boolean;
    maxOrderSize?: number;
    defaultCurrency?: string;
  };

  /** Feature flags */
  features?: {
    [key: string]: boolean;
  };

  /** Logging configuration */
  logging?: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableConsole?: boolean;
    enableRemote?: boolean;
  };

  /** UI configuration */
  ui?: {
    theme?: 'light' | 'dark' | 'auto';
    defaultPageSize?: number;
    refreshInterval?: number;
  };
}
