import { Injectable, inject } from '@angular/core';
import {
  ITransportService,
  ConnectionStatus,
  Subscription,
  SubscriptionOptions,
  PublishOptions,
  MessageCallback,
  TransportMessage,
} from '../../interfaces/transport.interface';
import { NatsConfig } from '../../interfaces/transport-config.interface';
import { BaseTransportService } from '../base-transport.service';
import { LoggerService } from '@rates-trading/logger';

// Import NATS client - using WebSocket transport for browser/Angular
import { wsconnect, NatsConnection, ConnectionOptions, Subscription as NatsSubscription } from '@nats-io/nats-core';

/**
 * NATS Transport Service Implementation
 *
 * This service provides messaging capabilities using NATS (NATS Messaging System).
 * NATS is a lightweight, high-performance messaging system with features like:
 * - Pub/Sub messaging
 * - Request/Reply patterns
 * - Subject-based routing
 * - Clustering support
 *
 * Based on NATS.js: https://github.com/nats-io/nats.js
 */
@Injectable()
export class NatsTransportService extends BaseTransportService implements ITransportService {
  private logger = inject(LoggerService).child({ service: 'NatsTransport' });
  private connection: NatsConnection | null = null;
  private subscriptions = new Map<
    string,
    { topic: string; callback: MessageCallback; natsSub: NatsSubscription; messageLoop: Promise<void> }
  >();
  private config: NatsConfig | null = null;
  private statusLoop: Promise<void> | null = null;

  constructor() {
    super();
  }

  /**
   * Initializes the service with NATS configuration
   */
  initialize(config: NatsConfig): void {
    this.config = config;
  }

  /**
   * Establishes a connection to the NATS server
   */
  async connect(): Promise<void> {
    if (!this.config) {
      throw new Error('NATS configuration not initialized. Call initialize() first.');
    }

    if (this.isConnected()) {
      this.logger.warn('Already connected');
      return;
    }

    this.updateConnectionStatus(ConnectionStatus.Connecting, 'Connecting to NATS server');

    try {
      // Build connection options
      const connectionOptions: ConnectionOptions = {
        servers: Array.isArray(this.config.url) ? this.config.url : [this.config.url],
        name: this.config.name || `rates-desktop-${Date.now()}`,
      };

      // Add authentication if provided
      if (this.config.token) {
        connectionOptions.token = this.config.token;
      } else if (this.config.user && this.config.password) {
        connectionOptions.user = this.config.user;
        connectionOptions.pass = this.config.password;
      }

      // Add TLS if configured
      if (this.config.tls) {
        connectionOptions.tls = {};
      }

      // Configure reconnection
      const reconnect = this.config.reconnect || { enabled: true };
      if (reconnect.enabled) {
        connectionOptions.reconnect = true;
        connectionOptions.maxReconnectAttempts = reconnect.maxAttempts || this.config.maxReconnectAttempts || 10;
        connectionOptions.reconnectTimeWait = reconnect.initialDelay || this.config.reconnectTimeWait || 2000;
      } else {
        connectionOptions.reconnect = false;
      }

      // Connection timeout
      if (this.config.timeout) {
        connectionOptions.timeout = this.config.timeout;
      }

      // Ping interval
      if (this.config.pingInterval) {
        connectionOptions.pingInterval = this.config.pingInterval;
      }

      // Max ping out
      if (this.config.maxPingOut) {
        connectionOptions.maxPingOut = this.config.maxPingOut;
      }

      // Merge additional options
      if (this.config.options) {
        Object.assign(connectionOptions, this.config.options);
      }

      // Connect to NATS server via WebSocket (for browser/Angular)
      this.logger.info({ servers: connectionOptions.servers }, 'Connecting to NATS server via WebSocket');
      this.connection = await wsconnect(connectionOptions);

      // Set up event handlers
      this.setupEventHandlers();

      // Wait for connection to be established
      const server = this.connection.getServer();
      
      this.updateConnectionStatus(
        ConnectionStatus.Connected,
        `Connected to NATS at ${server}`
      );
      this.logger.info({ server }, 'Successfully connected to NATS');
    } catch (error) {
      this.logger.error(error as Error, 'Connection failed');
      const transportError = this.createTransportError(
        error,
        'NATS_CONNECTION_ERROR',
        true
      );
      this.updateConnectionStatus(ConnectionStatus.Error, 'Failed to connect to NATS', transportError);
      this.notifyError(transportError);
      throw error;
    }
  }

  /**
   * Sets up NATS connection event handlers
   */
  private setupEventHandlers(): void {
    if (!this.connection) {
      return;
    }

    // Handle connection status events
    this.statusLoop = (async () => {
      try {
        if (!this.connection) {
          return;
        }
        for await (const status of this.connection.status()) {
          switch (status.type) {
            case 'disconnect':
              this.logger.warn({ server: status.server }, 'Disconnected from NATS');
              this.updateConnectionStatus(ConnectionStatus.Disconnected, 'Disconnected from NATS');
              break;
            case 'reconnect':
              this.logger.info({ server: status.server }, 'Reconnected to NATS');
              this.updateConnectionStatus(ConnectionStatus.Connected, 'Reconnected to NATS');
              // Resubscribe to all topics after reconnection
              await this.resubscribeAll();
              break;
            case 'reconnecting':
              this.logger.debug('Reconnecting to NATS');
              this.updateConnectionStatus(ConnectionStatus.Reconnecting, 'Reconnecting to NATS');
              break;
            case 'error':
              this.logger.error(status.error, 'NATS connection error');
              this.updateConnectionStatus(ConnectionStatus.Error, 'NATS connection error');
              break;
            case 'close':
              this.logger.info('NATS connection closed');
              this.updateConnectionStatus(ConnectionStatus.Disconnected, 'Connection closed');
              break;
          }
        }
      } catch (error) {
        this.logger.error(error as Error, 'Error in status loop');
      }
    })();

    // Handle connection closed promise
    this.connection.closed().then((err) => {
      if (err) {
        this.logger.error(err, 'Connection closed with error');
      } else {
        this.logger.info('Connection closed normally');
      }
      this.updateConnectionStatus(ConnectionStatus.Disconnected, 'Connection closed');
    });
  }

  /**
   * Resubscribes to all active subscriptions after reconnection
   */
  private async resubscribeAll(): Promise<void> {
    const subscriptionsCopy = new Map(this.subscriptions);
    this.subscriptions.clear();

    for (const [, sub] of subscriptionsCopy) {
      try {
        // Stop the old message loop
        // The subscription will be automatically cleaned up
        
        // Resubscribe
        await this.subscribe(sub.topic, sub.callback);
        this.logger.info({ topic: sub.topic }, 'Resubscribed to subject');
      } catch (error) {
        this.logger.error(error as Error, `Failed to resubscribe to ${sub.topic}`);
      }
    }
  }

  /**
   * Disconnects from the NATS server
   */
  async disconnect(): Promise<void> {
    try {
      // Drain all subscriptions first
      const drainPromises: Promise<void>[] = [];
      for (const [, sub] of this.subscriptions) {
        try {
          drainPromises.push(sub.natsSub.drain());
        } catch {
          // Ignore drain errors
        }
      }

      // Wait for all subscriptions to drain
      await Promise.all(drainPromises);

      // Close the connection
      if (this.connection) {
        await this.connection.drain();
        this.connection = null;
      }

      // Clear subscriptions
      this.subscriptions.clear();

      this.updateConnectionStatus(ConnectionStatus.Disconnected, 'Disconnected from NATS');
      this.logger.info('Disconnected from NATS');
    } catch (error) {
      const transportError = this.createTransportError(
        error,
        'NATS_DISCONNECT_ERROR',
        false
      );
      this.notifyError(transportError);
      // Force cleanup even on error
      this.connection = null;
      this.subscriptions.clear();
      throw error;
    }
  }

  /**
   * Subscribes to a subject on NATS
   */
  async subscribe<T = unknown>(
    topic: string,
    callback: MessageCallback<T>,
    options?: SubscriptionOptions
  ): Promise<Subscription> {
    if (!this.isConnected() || !this.connection) {
      throw new Error('Not connected to NATS. Call connect() first.');
    }

    const subscriptionId = this.generateSubscriptionId();

    try {
      // Create subscription - NATS subscribe returns a subscription object
      // Map our generic SubscriptionOptions to NATS-specific options
      const natsOptions: { max?: number; queue?: string } = {};
      if (options) {
        // NATS uses 'max' for maximum messages, but our interface doesn't have it
        // We'll leave it undefined for now, can be extended later
        // NATS uses 'queue' for queue groups, but our interface uses 'queueName'
        if (options.queueName) {
          natsOptions.queue = options.queueName;
        }
      }
      const natsSub = this.connection.subscribe(topic, natsOptions);

      // Process messages asynchronously using async iterator
      const messageLoop = (async () => {
        try {
          for await (const msg of natsSub) {
            try {
              // Parse message data
              let data: T;
              
              try {
                // Try to parse as JSON first
                data = msg.json<T>();
              } catch {
                // If not JSON, use as string
                data = msg.string() as unknown as T;
              }

              const transformedMessage: TransportMessage<T> = {
                data,
                topic: msg.subject,
                timestamp: new Date(),
              };

              callback(transformedMessage);
            } catch (error) {
              this.logger.error(error as Error, 'Error processing message');
            }
          }
        } catch (error) {
          this.logger.error(error as Error, 'Error in subscription message loop');
        }
      })();

      this.subscriptions.set(subscriptionId, {
        topic,
        callback: callback as MessageCallback,
        natsSub,
        messageLoop,
      });

      this.logger.info({ topic, subscriptionId }, 'Subscribed to subject');

      return {
        id: subscriptionId,
        topic,
        unsubscribe: () => this.unsubscribeById(subscriptionId),
      };
    } catch (error) {
      this.logger.error(error as Error, `Subscribe failed for ${topic}`);
      const transportError = this.createTransportError(
        error,
        'NATS_SUBSCRIBE_ERROR',
        true
      );
      this.notifyError(transportError);
      throw error;
    }
  }

  /**
   * Publishes a message to a subject on NATS
   */
  async publish<T = unknown>(
    topic: string,
    message: T,
    options?: PublishOptions
  ): Promise<void> {
    if (!this.isConnected() || !this.connection) {
      throw new Error('Not connected to NATS. Call connect() first.');
    }

    try {
      // Serialize message
      let payload: Uint8Array;
      if (typeof message === 'string') {
        payload = new TextEncoder().encode(message);
      } else {
        payload = new TextEncoder().encode(JSON.stringify(message));
      }

      // Publish message
      if (options?.headers) {
        // NATS v2 uses headers - need to create headers object
        const { headers } = await import('@nats-io/nats-core');
        const natsHeaders = headers();
        for (const [key, value] of Object.entries(options.headers)) {
          if (Array.isArray(value)) {
            natsHeaders.set(key, value[0] || '');
          } else {
            natsHeaders.set(key, String(value));
          }
        }
        this.connection.publish(topic, payload, { headers: natsHeaders });
      } else {
        this.connection.publish(topic, payload);
      }

      this.logger.debug({ topic }, 'Published to subject');
    } catch (error) {
      this.logger.error(error as Error, `Publish failed for ${topic}`);
      const transportError = this.createTransportError(
        error,
        'NATS_PUBLISH_ERROR',
        true
      );
      this.notifyError(transportError);
      throw error;
    }
  }

  /**
   * Sends a request and waits for a reply (request/reply pattern)
   */
  async request<TRequest, TResponse>(
    topic: string,
    message: TRequest,
    timeout = 10000
  ): Promise<TransportMessage<TResponse>> {
    if (!this.isConnected() || !this.connection) {
      throw new Error('Not connected to NATS. Call connect() first.');
    }

    try {
      // Serialize request message
      let payload: Uint8Array;
      if (typeof message === 'string') {
        payload = new TextEncoder().encode(message);
      } else {
        payload = new TextEncoder().encode(JSON.stringify(message));
      }

      // Send request and wait for reply
      const reply = await this.connection.request(topic, payload, {
        timeout,
      });

      // Parse reply
      let responseData: TResponse;
      
      try {
        responseData = reply.json<TResponse>();
      } catch {
        responseData = reply.string() as unknown as TResponse;
      }

      this.logger.debug({ topic, timeout }, 'Request/reply completed');

      return {
        data: responseData,
        topic: reply.subject,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(error as Error, `Request failed for ${topic}`);
      const transportError = this.createTransportError(
        error,
        'NATS_REQUEST_ERROR',
        true
      );
      this.notifyError(transportError);
      throw error;
    }
  }

  /**
   * Unsubscribes from a subscription by ID
   */
  private async unsubscribeById(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }

    try {
      if (this.connection && this.isConnected()) {
        // Drain the subscription to ensure all messages are processed
        await subscription.natsSub.drain();
      }

      this.subscriptions.delete(subscriptionId);
      this.logger.debug({ subscriptionId }, 'Unsubscribed from subscription');
    } catch (error) {
      this.logger.error(error as Error, `Unsubscribe failed for ${subscriptionId}`);
      // Still remove from local tracking
      this.subscriptions.delete(subscriptionId);
      const transportError = this.createTransportError(
        error,
        'NATS_UNSUBSCRIBE_ERROR',
        false
      );
      this.notifyError(transportError);
      throw error;
    }
  }
}
