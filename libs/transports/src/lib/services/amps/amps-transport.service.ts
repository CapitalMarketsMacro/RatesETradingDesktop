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
import { AmpsConfig } from '../../interfaces/transport-config.interface';
import { BaseTransportService } from '../base-transport.service';
import { LoggerService } from '@rates-trading/logger';

// Import AMPS client
import * as ampsModule from 'amps';

/**
 * AMPS Message interface from the amps package
 */
interface AmpsMessage {
  c: string; // command
  t?: string; // topic
  d?: string; // data
  s?: string; // subscription id
  cid?: string; // command id
  a?: string; // ack type
  sow_key?: string;
  [key: string]: unknown;
}

/**
 * AMPS Client interface - matches the actual amps package API
 */
interface AmpsClient {
  connect(url: string): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(
    handler: (message: AmpsMessage) => void,
    topic: string,
    filter?: string,
    options?: Record<string, unknown>
  ): Promise<string>;
  unsubscribe(subId: string): Promise<void>;
  publish(topic: string, data: string, options?: Record<string, unknown>): Promise<void>;
  sow(
    handler: (message: AmpsMessage) => void,
    topic: string,
    filter?: string,
    options?: Record<string, unknown>
  ): Promise<void>;
  sowAndSubscribe(
    handler: (message: AmpsMessage) => void,
    topic: string,
    filter?: string,
    options?: Record<string, unknown>
  ): Promise<string>;
  sowDelete(topic: string, filter: string, options?: Record<string, unknown>): Promise<void>;
  deltaSubscribe(
    handler: (message: AmpsMessage) => void,
    topic: string,
    filter?: string,
    options?: Record<string, unknown>
  ): Promise<string>;
  disconnectHandler(handler: (client: unknown, err: Error) => void): void;
}

// Get the AMPS client constructor
const amps = ampsModule as unknown as {
  Client: new (name: string) => AmpsClient;
};

/**
 * AMPS Transport Service Implementation
 *
 * This service provides messaging capabilities using the AMPS (Advanced Message Processing System).
 * AMPS is known for its high-performance, low-latency messaging with features like:
 * - State of World (SOW) queries
 * - Delta publish/subscribe
 * - Content filtering
 * - Message replay
 */
@Injectable()
export class AmpsTransportService extends BaseTransportService implements ITransportService {
  private logger = inject(LoggerService).child({ service: 'AmpsTransport' });
  private client: AmpsClient | null = null;
  private subscriptions = new Map<
    string,
    { topic: string; callback: MessageCallback; subId: string }
  >();
  private config: AmpsConfig | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;

  constructor() {
    super();
  }

  /**
   * Initializes the service with AMPS configuration
   */
  initialize(config: AmpsConfig): void {
    this.config = config;
  }

  /**
   * Establishes a connection to the AMPS server
   */
  async connect(): Promise<void> {
    if (!this.config) {
      throw new Error('AMPS configuration not initialized. Call initialize() first.');
    }

    if (this.isConnected()) {
      this.logger.warn('Already connected');
      return;
    }

    this.updateConnectionStatus(ConnectionStatus.Connecting, 'Connecting to AMPS server');

    try {
      // Create AMPS client with client name
      const clientName = this.config.clientName || `rates-desktop-${Date.now()}`;
      this.client = new amps.Client(clientName);

      // Set up disconnect handler for reconnection
      this.client.disconnectHandler((client: unknown, err: Error) => {
        this.logger.error(err, 'Disconnected');
        this.handleDisconnect(err);
      });

      // Connect to AMPS server
      this.logger.info({ url: this.config.url }, 'Connecting to AMPS server');
      await this.client.connect(this.config.url);
      this.logger.debug('WebSocket connection established');

      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0;

      this.updateConnectionStatus(
        ConnectionStatus.Connected,
        `Connected to AMPS at ${this.config.url}`
      );
      this.logger.info({ url: this.config.url }, 'Successfully connected');
    } catch (error) {
      this.logger.error(error as Error, 'Connection failed');
      const transportError = this.createTransportError(
        error,
        'AMPS_CONNECTION_ERROR',
        true
      );
      this.updateConnectionStatus(
        ConnectionStatus.Error,
        'Failed to connect to AMPS',
        transportError
      );
      this.notifyError(transportError);

      // Attempt to reconnect if enabled
      if (this.config.reconnect?.enabled) {
        this.scheduleReconnect();
      }

      throw error;
    }
  }

  /**
   * Handles disconnection and triggers reconnect if configured
   */
  private handleDisconnect(error?: Error): void {
    this.updateConnectionStatus(
      ConnectionStatus.Disconnected,
      error?.message || 'Disconnected from AMPS'
    );

    if (this.config?.reconnect?.enabled) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedules a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const maxAttempts = this.config?.reconnect?.maxAttempts || 10;
    if (this.reconnectAttempts >= maxAttempts) {
      this.logger.error(`Max reconnection attempts (${maxAttempts}) reached`);
      this.updateConnectionStatus(
        ConnectionStatus.Error,
        'Max reconnection attempts reached'
      );
      return;
    }

    const initialDelay = this.config?.reconnect?.initialDelay || 1000;
    const maxDelay = this.config?.reconnect?.maxDelay || 30000;
    const delay = Math.min(initialDelay * Math.pow(2, this.reconnectAttempts), maxDelay);

    this.logger.debug({ attempt: this.reconnectAttempts + 1, delay }, 'Scheduling reconnect attempt');
    this.updateConnectionStatus(ConnectionStatus.Reconnecting, `Reconnecting in ${delay}ms`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++;
      try {
        await this.connect();
        // Resubscribe to all topics after reconnection
        await this.resubscribeAll();
      } catch {
        // Connection attempt failed, will be handled by connect()
      }
    }, delay);
  }

  /**
   * Resubscribes to all active subscriptions after reconnection
   */
  private async resubscribeAll(): Promise<void> {
    const subscriptionsCopy = new Map(this.subscriptions);
    this.subscriptions.clear();

    for (const [, sub] of subscriptionsCopy) {
      try {
        await this.subscribe(sub.topic, sub.callback);
        this.logger.info({ topic: sub.topic }, 'Resubscribed to topic');
      } catch (error) {
        this.logger.error(error as Error, `Failed to resubscribe to ${sub.topic}`);
      }
    }
  }

  /**
   * Disconnects from the AMPS server
   */
  async disconnect(): Promise<void> {
    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (!this.client) {
      return;
    }

    try {
      // Unsubscribe from all subscriptions
      for (const [id] of this.subscriptions) {
        try {
          await this.unsubscribeById(id);
        } catch {
          // Ignore unsubscribe errors during disconnect
        }
      }

      // Disconnect the client
      await this.client.disconnect();
      this.client = null;

      this.updateConnectionStatus(ConnectionStatus.Disconnected, 'Disconnected from AMPS');
      this.logger.info('Disconnected');
    } catch (error) {
      const transportError = this.createTransportError(
        error,
        'AMPS_DISCONNECT_ERROR',
        false
      );
      this.notifyError(transportError);
      // Force cleanup even on error
      this.client = null;
      throw error;
    }
  }

  /**
   * Subscribes to a topic on AMPS
   */
  async subscribe<T = unknown>(
    topic: string,
    callback: MessageCallback<T>,
    options?: SubscriptionOptions
  ): Promise<Subscription> {
    if (!this.isConnected() || !this.client) {
      throw new Error('Not connected to AMPS. Call connect() first.');
    }

    const subscriptionId = this.generateSubscriptionId();

    try {
      // Create message handler
      const messageHandler = (message: AmpsMessage) => {
        try {
          const transformedMessage = this.transformMessage<T>(message);
          callback(transformedMessage);
        } catch (error) {
          this.logger.error(error as Error, 'Error processing message');
        }
      };

      // Build options object
      const subscribeOptions: Record<string, unknown> = {
        subId: subscriptionId,
      };
      if (options?.bookmark) {
        subscribeOptions['bookmark'] = options.bookmark;
      }
      if (options?.batchSize) {
        subscribeOptions['batchSize'] = options.batchSize;
      }
      if (options?.topN) {
        subscribeOptions['topN'] = options.topN;
      }
      if (options?.orderBy) {
        subscribeOptions['orderBy'] = options.orderBy;
      }

      // Execute subscribe using the method-based API
      const subId = await this.client.subscribe(
        messageHandler,
        topic,
        options?.filter,
        subscribeOptions
      );

      this.subscriptions.set(subscriptionId, {
        topic,
        callback: callback as MessageCallback,
        subId: subId || subscriptionId,
      });

      this.logger.info({ topic, subscriptionId }, 'Subscribed to topic');

      return {
        id: subscriptionId,
        topic,
        unsubscribe: () => this.unsubscribeById(subscriptionId),
      };
    } catch (error) {
      this.logger.error(error as Error, `Subscribe failed for ${topic}`);
      const transportError = this.createTransportError(
        error,
        'AMPS_SUBSCRIBE_ERROR',
        true
      );
      this.notifyError(transportError);
      throw error;
    }
  }

  /**
   * Publishes a message to a topic on AMPS
   */
  async publish<T = unknown>(
    topic: string,
    message: T,
    options?: PublishOptions
  ): Promise<void> {
    if (!this.isConnected() || !this.client) {
      throw new Error('Not connected to AMPS. Call connect() first.');
    }

    try {
      const data = typeof message === 'string' ? message : JSON.stringify(message);

      // Build options object
      const publishOptions: Record<string, unknown> = {};
      if (options?.sowKey) {
        publishOptions['sowKey'] = options.sowKey;
      }
      if (options?.expiration) {
        publishOptions['expiration'] = options.expiration;
      }
      if (options?.correlationId) {
        publishOptions['correlationId'] = options.correlationId;
      }

      await this.client.publish(topic, data, publishOptions);
      this.logger.debug({ topic }, 'Published to topic');
    } catch (error) {
      this.logger.error(error as Error, `Publish failed for ${topic}`);
      const transportError = this.createTransportError(
        error,
        'AMPS_PUBLISH_ERROR',
        true
      );
      this.notifyError(transportError);
      throw error;
    }
  }

  /**
   * Performs a SOW (State of World) query
   * Returns all current records matching the filter
   */
  async sowQuery<T = unknown>(
    topic: string,
    filter?: string,
    options?: SubscriptionOptions
  ): Promise<TransportMessage<T>[]> {
    if (!this.isConnected() || !this.client) {
      throw new Error('Not connected to AMPS. Call connect() first.');
    }

    try {
      const messages: TransportMessage<T>[] = [];

      // Build options object
      const sowOptions: Record<string, unknown> = {};
      if (options?.orderBy) {
        sowOptions['orderBy'] = options.orderBy;
      }
      if (options?.topN) {
        sowOptions['topN'] = options.topN;
      }
      if (options?.batchSize) {
        sowOptions['batchSize'] = options.batchSize;
      }

      await this.client.sow(
        (message: AmpsMessage) => {
          // Skip group_begin and group_end messages
          if (message.c === 'group_begin' || message.c === 'group_end') {
            return;
          }
          messages.push(this.transformMessage<T>(message));
        },
        topic,
        filter,
        sowOptions
      );

      this.logger.debug({ topic, recordCount: messages.length }, 'SOW query returned records');
      return messages;
    } catch (error) {
      this.logger.error(error as Error, `SOW query failed for ${topic}`);
      const transportError = this.createTransportError(error, 'AMPS_SOW_ERROR', true);
      this.notifyError(transportError);
      throw error;
    }
  }

  /**
   * Performs a SOW query and subscribes to updates
   * Returns current state and receives future updates
   */
  async sowAndSubscribe<T = unknown>(
    topic: string,
    callback: MessageCallback<T>,
    filter?: string,
    options?: SubscriptionOptions
  ): Promise<Subscription> {
    if (!this.isConnected() || !this.client) {
      throw new Error('Not connected to AMPS. Call connect() first.');
    }

    const subscriptionId = this.generateSubscriptionId();

    try {
      const messageHandler = (message: AmpsMessage) => {
        try {
          // Skip group_begin and group_end messages
          if (message.c === 'group_begin' || message.c === 'group_end') {
            return;
          }
          const transformedMessage = this.transformMessage<T>(message);
          callback(transformedMessage);
        } catch (error) {
          this.logger.error(error as Error, 'Error processing SOW message');
        }
      };

      // Build options object
      const sowSubOptions: Record<string, unknown> = {
        subId: subscriptionId,
      };
      if (options?.orderBy) {
        sowSubOptions['orderBy'] = options.orderBy;
      }
      if (options?.topN) {
        sowSubOptions['topN'] = options.topN;
      }
      if (options?.batchSize) {
        sowSubOptions['batchSize'] = options.batchSize;
      }

      const subId = await this.client.sowAndSubscribe(
        messageHandler,
        topic,
        filter,
        sowSubOptions
      );

      this.subscriptions.set(subscriptionId, {
        topic,
        callback: callback as MessageCallback,
        subId: subId || subscriptionId,
      });

      this.logger.info({ topic, subscriptionId }, 'SOW and subscribed to topic');

      return {
        id: subscriptionId,
        topic,
        unsubscribe: () => this.unsubscribeById(subscriptionId),
      };
    } catch (error) {
      this.logger.error(error as Error, `SOW and subscribe failed for ${topic}`);
      const transportError = this.createTransportError(
        error,
        'AMPS_SOW_SUBSCRIBE_ERROR',
        true
      );
      this.notifyError(transportError);
      throw error;
    }
  }

  /**
   * Deletes records from the SOW matching the filter
   */
  async sowDelete(topic: string, filter: string): Promise<void> {
    if (!this.isConnected() || !this.client) {
      throw new Error('Not connected to AMPS. Call connect() first.');
    }

    try {
      await this.client.sowDelete(topic, filter);
      this.logger.debug({ topic, filter }, 'SOW delete executed');
    } catch (error) {
      this.logger.error(error as Error, `SOW delete failed for ${topic}`);
      const transportError = this.createTransportError(
        error,
        'AMPS_SOW_DELETE_ERROR',
        true
      );
      this.notifyError(transportError);
      throw error;
    }
  }

  /**
   * Subscribes to delta updates (only changed fields are sent)
   */
  async deltaSubscribe<T = unknown>(
    topic: string,
    callback: MessageCallback<T>,
    options?: SubscriptionOptions
  ): Promise<Subscription> {
    if (!this.isConnected() || !this.client) {
      throw new Error('Not connected to AMPS. Call connect() first.');
    }

    const subscriptionId = this.generateSubscriptionId();

    try {
      const messageHandler = (message: AmpsMessage) => {
        try {
          const transformedMessage = this.transformMessage<T>(message);
          callback(transformedMessage);
        } catch (error) {
          this.logger.error(error as Error, 'Error processing delta message');
        }
      };

      // Build options object
      const deltaOptions: Record<string, unknown> = {
        subId: subscriptionId,
      };
      if (options?.orderBy) {
        deltaOptions['orderBy'] = options.orderBy;
      }

      const subId = await this.client.deltaSubscribe(
        messageHandler,
        topic,
        options?.filter,
        deltaOptions
      );

      this.subscriptions.set(subscriptionId, {
        topic,
        callback: callback as MessageCallback,
        subId: subId || subscriptionId,
      });

      this.logger.info({ topic, subscriptionId }, 'Delta subscribed to topic');

      return {
        id: subscriptionId,
        topic,
        unsubscribe: () => this.unsubscribeById(subscriptionId),
      };
    } catch (error) {
      this.logger.error(error as Error, `Delta subscribe failed for ${topic}`);
      const transportError = this.createTransportError(
        error,
        'AMPS_DELTA_SUBSCRIBE_ERROR',
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
      if (this.client && this.isConnected()) {
        await this.client.unsubscribe(subscription.subId);
      }

      this.subscriptions.delete(subscriptionId);
      this.logger.debug({ subscriptionId }, 'Unsubscribed from subscription');
    } catch (error) {
      this.logger.error(error as Error, `Unsubscribe failed for ${subscriptionId}`);
      // Still remove from local tracking
      this.subscriptions.delete(subscriptionId);
      const transportError = this.createTransportError(
        error,
        'AMPS_UNSUBSCRIBE_ERROR',
        false
      );
      this.notifyError(transportError);
      throw error;
    }
  }

  /**
   * Transforms an AMPS message to the common TransportMessage format
   */
  private transformMessage<T>(message: AmpsMessage): TransportMessage<T> {
    let data: T;

    // The AMPS client may return data in different formats:
    // - message.d: short form data field
    // - message.data: long form data field  
    // - message itself could be the data object
    const rawData = message.d || (message as unknown as { data?: string }).data;
    
    if (rawData) {
      try {
        // Try to parse as JSON
        data = typeof rawData === 'string' ? JSON.parse(rawData) as T : rawData as T;
      } catch {
        // If parsing fails, use the raw value
        data = rawData as unknown as T;
      }
    } else if (typeof message === 'object' && 'Id' in message) {
      // The message itself might be the data (no wrapper)
      data = message as unknown as T;
    } else {
      data = {} as T;
    }

    return {
      data,
      topic: message.t || (message as unknown as { topic?: string }).topic || '',
      messageId: message.cid,
      correlationId: message.cid,
      timestamp: new Date(),
      headers: message.sow_key ? { sowKey: message.sow_key } : undefined,
      raw: message,
    };
  }
}
