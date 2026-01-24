import { Observable } from 'rxjs';

/**
 * Connection status enum for transport services
 */
export enum ConnectionStatus {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Reconnecting = 'reconnecting',
  Error = 'error',
}

/**
 * Represents a subscription to a topic
 */
export interface Subscription {
  /** Unique identifier for the subscription */
  id: string;
  /** Topic the subscription is for */
  topic: string;
  /** Unsubscribe from the topic */
  unsubscribe(): Promise<void>;
}

/**
 * Options for subscribing to a topic
 */
export interface SubscriptionOptions {
  /** Optional filter expression (transport-specific) */
  filter?: string;
  /** Content filter for message filtering */
  contentFilter?: string;
  /** Whether to receive historical messages (AMPS-specific) */
  historical?: boolean;
  /** Bookmark for resuming subscriptions (AMPS-specific) */
  bookmark?: string;
  /** Order by clause (AMPS-specific) */
  orderBy?: string;
  /** Top N records (AMPS-specific) */
  topN?: number;
  /** Batch size for messages */
  batchSize?: number;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Queue name for competing consumers (Solace-specific) */
  queueName?: string;
  /** Acknowledgement mode */
  ackMode?: 'auto' | 'manual';
}

/**
 * Options for publishing a message
 */
export interface PublishOptions {
  /** Time-to-live for the message in milliseconds */
  ttl?: number;
  /** Correlation ID for request-reply patterns */
  correlationId?: string;
  /** Whether the message should be persisted */
  persistent?: boolean;
  /** Priority of the message (0-9, higher is more important) */
  priority?: number;
  /** Custom headers */
  headers?: Record<string, string>;
  /** SOW key for state-of-world updates (AMPS-specific) */
  sowKey?: string;
  /** Expiration time for SOW records (AMPS-specific) */
  expiration?: number;
  /** Delivery mode (Solace-specific) */
  deliveryMode?: 'direct' | 'persistent';
}

/**
 * Represents a received message
 */
export interface TransportMessage<T = unknown> {
  /** The message payload */
  data: T;
  /** Topic the message was received on */
  topic: string;
  /** Unique message identifier */
  messageId?: string;
  /** Correlation ID if present */
  correlationId?: string;
  /** Timestamp when the message was received */
  timestamp: Date;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Raw message data (transport-specific) */
  raw?: unknown;
  /** Acknowledge the message (for manual ack mode) */
  acknowledge?: () => Promise<void>;
}

/**
 * Callback function type for message handlers
 */
export type MessageCallback<T = unknown> = (message: TransportMessage<T>) => void;

/**
 * Error callback function type
 */
export type ErrorCallback = (error: TransportError) => void;

/**
 * Transport-specific error
 */
export interface TransportError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Original error if available */
  cause?: Error;
  /** Whether the error is recoverable */
  recoverable: boolean;
}

/**
 * Connection event types
 */
export interface ConnectionEvent {
  /** Event type */
  type: 'connected' | 'disconnected' | 'reconnecting' | 'error';
  /** Timestamp of the event */
  timestamp: Date;
  /** Additional details */
  details?: string;
  /** Error if applicable */
  error?: TransportError;
}

/**
 * Generic transport service interface
 * All transport implementations must implement this interface
 */
export interface ITransportService {
  /**
   * Observable that emits connection status changes
   */
  readonly connectionStatus$: Observable<ConnectionStatus>;

  /**
   * Observable that emits connection events
   */
  readonly connectionEvents$: Observable<ConnectionEvent>;

  /**
   * Establishes a connection to the messaging server
   * @throws TransportError if connection fails
   */
  connect(): Promise<void>;

  /**
   * Gracefully disconnects from the messaging server
   */
  disconnect(): Promise<void>;

  /**
   * Subscribes to a topic and receives messages
   * @param topic The topic to subscribe to
   * @param callback Function called when a message is received
   * @param options Optional subscription options
   * @returns A subscription object that can be used to unsubscribe
   */
  subscribe<T = unknown>(
    topic: string,
    callback: MessageCallback<T>,
    options?: SubscriptionOptions
  ): Promise<Subscription>;

  /**
   * Publishes a message to a topic
   * @param topic The topic to publish to
   * @param message The message payload
   * @param options Optional publish options
   */
  publish<T = unknown>(
    topic: string,
    message: T,
    options?: PublishOptions
  ): Promise<void>;

  /**
   * Checks if the transport is currently connected
   */
  isConnected(): boolean;

  /**
   * Registers an error handler for transport-level errors
   * @param callback Function called when an error occurs
   */
  onError(callback: ErrorCallback): void;

  /**
   * Gets the current connection status
   */
  getConnectionStatus(): ConnectionStatus;

  /**
   * Performs a SOW query (State of World - AMPS-specific, optional)
   * @param topic The topic to query
   * @param filter Optional filter expression
   * @param options Optional subscription options
   */
  sowQuery?<T = unknown>(
    topic: string,
    filter?: string,
    options?: SubscriptionOptions
  ): Promise<TransportMessage<T>[]>;

  /**
   * Performs a SOW query and subscribes to updates (AMPS-specific, optional)
   * @param topic The topic to query and subscribe
   * @param callback Function called for each message
   * @param filter Optional filter expression
   * @param options Optional subscription options
   */
  sowAndSubscribe?<T = unknown>(
    topic: string,
    callback: MessageCallback<T>,
    filter?: string,
    options?: SubscriptionOptions
  ): Promise<Subscription>;

  /**
   * Deletes a message from SOW (AMPS-specific, optional)
   * @param topic The topic
   * @param filter Filter to identify records to delete
   */
  sowDelete?(topic: string, filter: string): Promise<void>;

  /**
   * Performs a delta subscribe for incremental updates (AMPS-specific, optional)
   * @param topic The topic to subscribe
   * @param callback Function called for each delta update
   * @param options Optional subscription options
   */
  deltaSubscribe?<T = unknown>(
    topic: string,
    callback: MessageCallback<T>,
    options?: SubscriptionOptions
  ): Promise<Subscription>;
}
