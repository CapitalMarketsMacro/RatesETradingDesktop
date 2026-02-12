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
    type: 'solace' | 'amps' | 'websocket' | 'nats';
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
    nats?: {
      url: string | string[];
      user?: string;
      password?: string;
      token?: string;
      name?: string;
      tls?: boolean;
      reconnect?: {
        enabled: boolean;
        initialDelay?: number;
        maxDelay?: number;
        maxAttempts?: number;
      };
      maxReconnectAttempts?: number;
      reconnectTimeWait?: number;
      timeout?: number;
      pingInterval?: number;
      maxPingOut?: number;
      options?: Record<string, unknown>;
    };
  };

  /** Market data configuration */
  marketData?: {
    updateInterval: number;
    maxHistorySize?: number;
    symbols?: string[];
  };

  /** AMPS topics configuration */
  ampsTopics?: {
    marketData?: string;
    executions?: string;
  };

  /** NATS topics configuration */
  natsTopics?: {
    marketData?: string;
    executions?: string;
  };

  /** Solace topics configuration */
  solaceTopics?: {
    marketData?: string;
    executions?: string;
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

  /** OpenFin core-web configuration */
  openfin?: {
    enabled: boolean;
    brokerUrl: string;
    sharedWorkerUrl: string;
    layoutUrl: string;
    providerId: string;
    defaultContextGroup: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error' | 'none';
  };
}
