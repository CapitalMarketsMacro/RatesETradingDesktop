/**
 * Transport type supported by the application
 */
export type TransportType = 'amps' | 'solace' | 'websocket' | 'nats';

/**
 * AMPS-specific configuration
 */
export interface AmpsConfig {
  /** AMPS server URL (e.g., ws://localhost:9000/amps/json) */
  url: string;
  /** Username for authentication */
  user?: string;
  /** Password for authentication */
  password?: string;
  /** Message type (json, fix, nvfix, etc.) */
  messageType?: 'json' | 'fix' | 'nvfix' | 'binary';
  /** Client name for identification */
  clientName?: string;
  /** Heartbeat interval in seconds */
  heartbeatInterval?: number;
  /** Reconnection settings */
  reconnect?: {
    /** Whether to automatically reconnect */
    enabled: boolean;
    /** Initial delay before reconnecting in ms */
    initialDelay?: number;
    /** Maximum delay between reconnection attempts in ms */
    maxDelay?: number;
    /** Maximum number of reconnection attempts */
    maxAttempts?: number;
  };
  /** Additional AMPS-specific options */
  options?: Record<string, unknown>;
}

/**
 * Solace-specific configuration
 */
export interface SolaceConfig {
  /** Solace broker URL */
  url: string;
  /** VPN name */
  vpnName: string;
  /** Username for authentication */
  userName: string;
  /** Password for authentication */
  password?: string;
  /** Client name for identification */
  clientName?: string;
  /** Connect timeout in milliseconds */
  connectTimeout?: number;
  /** Reconnection settings */
  reconnect?: {
    /** Whether to automatically reconnect */
    enabled: boolean;
    /** Reconnect retry wait time in milliseconds */
    retryWaitMs?: number;
    /** Maximum number of reconnection attempts */
    maxAttempts?: number;
  };
  /** Keep-alive interval in milliseconds */
  keepAliveInterval?: number;
  /** Keep-alive interval limit */
  keepAliveIntervalLimit?: number;
  /** Generate send timestamps */
  generateSendTimestamps?: boolean;
  /** Generate receive timestamps */
  generateReceiveTimestamps?: boolean;
  /** Include sender ID in messages */
  includeSenderId?: boolean;
  /** Additional Solace-specific options */
  options?: Record<string, unknown>;
}

/**
 * WebSocket-specific configuration (for basic WebSocket transport)
 */
export interface WebSocketConfig {
  /** WebSocket server URL */
  url: string;
  /** Reconnect interval in milliseconds */
  reconnectInterval?: number;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  /** Ping interval in milliseconds */
  pingInterval?: number;
}

/**
 * NATS-specific configuration
 */
export interface NatsConfig {
  /** NATS server URL(s) - can be a single URL or array of URLs for clustering */
  url: string | string[];
  /** Username for authentication */
  user?: string;
  /** Password or token for authentication */
  password?: string;
  /** Token for authentication (alternative to user/password) */
  token?: string;
  /** Client name for identification */
  name?: string;
  /** Whether to use TLS/SSL */
  tls?: boolean;
  /** Reconnection settings */
  reconnect?: {
    /** Whether to automatically reconnect */
    enabled: boolean;
    /** Initial delay before reconnecting in ms */
    initialDelay?: number;
    /** Maximum delay between reconnection attempts in ms */
    maxDelay?: number;
    /** Maximum number of reconnection attempts */
    maxAttempts?: number;
  };
  /** Maximum number of reconnection attempts */
  maxReconnectAttempts?: number;
  /** Reconnect time wait in milliseconds */
  reconnectTimeWait?: number;
  /** Connection timeout in milliseconds */
  timeout?: number;
  /** Ping interval in milliseconds */
  pingInterval?: number;
  /** Maximum number of ping failures before considering connection lost */
  maxPingOut?: number;
  /** Additional NATS-specific options */
  options?: Record<string, unknown>;
}

/**
 * Complete transport configuration
 */
export interface TransportConfig {
  /** Type of transport to use */
  type: TransportType;
  /** AMPS configuration (required when type is 'amps') */
  amps?: AmpsConfig;
  /** Solace configuration (required when type is 'solace') */
  solace?: SolaceConfig;
  /** WebSocket configuration (required when type is 'websocket') */
  websocket?: WebSocketConfig;
  /** NATS configuration (required when type is 'nats') */
  nats?: NatsConfig;
}
