import { Injectable, inject } from '@angular/core';
import {
  ITransportService,
  ConnectionStatus,
  Subscription,
  SubscriptionOptions,
  PublishOptions,
  MessageCallback,
  TransportMessage,
} from '../interfaces/transport.interface';
import { SolaceConfig } from '../interfaces/transport-config.interface';
import { BaseTransportService } from './base-transport.service';
import { LoggerService } from '@rates-trading/logger';

/**
 * Solace Transport Service Implementation
 *
 * This service provides messaging capabilities using Solace PubSub+.
 * Solace is an enterprise messaging platform with features like:
 * - Guaranteed messaging
 * - Topic-based pub/sub
 * - Request/reply patterns
 * - Queue-based messaging
 *
 * Note: This implementation uses a mock/stub approach. In production, you would integrate
 * with the actual Solace JavaScript client library (solclientjs).
 */
@Injectable()
export class SolaceTransportService extends BaseTransportService implements ITransportService {
  private logger = inject(LoggerService).child({ service: 'SolaceTransport' });
  private session: unknown = null;
  private subscriptions = new Map<
    string,
    { topic: string; callback: MessageCallback; subscriber: unknown }
  >();
  private config: SolaceConfig | null = null;

  constructor() {
    super();
  }

  /**
   * Initializes the service with Solace configuration
   */
  initialize(config: SolaceConfig): void {
    this.config = config;
  }

  /**
   * Establishes a connection to the Solace broker
   */
  async connect(): Promise<void> {
    if (!this.config) {
      throw new Error('Solace configuration not initialized. Call initialize() first.');
    }

    if (this.isConnected()) {
      this.logger.warn('Already connected');
      return;
    }

    this.updateConnectionStatus(ConnectionStatus.Connecting, 'Connecting to Solace broker');

    try {
      // In production, this would use the actual Solace client:
      // import * as solace from 'solclientjs';
      //
      // const factoryProps = new solace.SolclientFactoryProperties();
      // factoryProps.profile = solace.SolclientFactoryProfiles.version10;
      // solace.SolclientFactory.init(factoryProps);
      //
      // const sessionProperties = {
      //   url: this.config.url,
      //   vpnName: this.config.vpnName,
      //   userName: this.config.userName,
      //   password: this.config.password,
      //   clientName: this.config.clientName,
      //   connectTimeoutInMsecs: this.config.connectTimeout,
      //   keepAliveIntervalInMsecs: this.config.keepAliveInterval,
      //   keepAliveIntervalsLimit: this.config.keepAliveIntervalLimit,
      //   generateSendTimestamps: this.config.generateSendTimestamps,
      //   generateReceiveTimestamps: this.config.generateReceiveTimestamps,
      //   includeSenderId: this.config.includeSenderId,
      //   reconnectRetries: this.config.reconnect?.maxAttempts,
      //   reconnectRetryWaitInMsecs: this.config.reconnect?.retryWaitMs,
      // };
      //
      // this.session = solace.SolclientFactory.createSession(sessionProperties);
      // this.setupSessionEventHandlers();
      // await new Promise((resolve, reject) => {
      //   this.session.on(solace.SessionEventCode.UP_NOTICE, resolve);
      //   this.session.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, reject);
      //   this.session.connect();
      // });

      // Mock connection for development
      await this.mockConnect();

      this.updateConnectionStatus(
        ConnectionStatus.Connected,
        `Connected to Solace at ${this.config.url}`
      );
    } catch (error) {
      const transportError = this.createTransportError(
        error,
        'SOLACE_CONNECTION_ERROR',
        true
      );
      this.updateConnectionStatus(
        ConnectionStatus.Error,
        'Failed to connect to Solace',
        transportError
      );
      this.notifyError(transportError);
      throw error;
    }
  }

  /**
   * Disconnects from the Solace broker
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected()) {
      return;
    }

    try {
      // Unsubscribe from all subscriptions
      const unsubscribePromises = Array.from(this.subscriptions.keys()).map((id) =>
        this.unsubscribeById(id)
      );
      await Promise.all(unsubscribePromises);

      // In production: this.session.disconnect();
      this.session = null;

      this.updateConnectionStatus(ConnectionStatus.Disconnected, 'Disconnected from Solace');
    } catch (error) {
      const transportError = this.createTransportError(
        error,
        'SOLACE_DISCONNECT_ERROR',
        false
      );
      this.notifyError(transportError);
      throw error;
    }
  }

  /**
   * Subscribes to a topic on Solace
   */
  async subscribe<T = unknown>(
    topic: string,
    callback: MessageCallback<T>,
    options?: SubscriptionOptions
  ): Promise<Subscription> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Solace. Call connect() first.');
    }

    const subscriptionId = this.generateSubscriptionId();

    try {
      // In production, this would use the actual Solace client:
      // const topicDestination = solace.SolclientFactory.createTopicDestination(topic);
      //
      // const messageHandler = (message: solace.Message) => {
      //   callback(this.transformMessage(message));
      // };
      //
      // if (options?.queueName) {
      //   // Queue-based subscription for guaranteed messaging
      //   const messageConsumer = this.session.createMessageConsumer({
      //     queueDescriptor: { name: options.queueName, type: solace.QueueType.QUEUE },
      //     acknowledgeMode: options.ackMode === 'manual'
      //       ? solace.MessageConsumerAcknowledgeMode.CLIENT
      //       : solace.MessageConsumerAcknowledgeMode.AUTO,
      //   });
      //   messageConsumer.on(solace.MessageConsumerEventName.MESSAGE, messageHandler);
      //   messageConsumer.connect();
      // } else {
      //   // Direct topic subscription
      //   this.session.subscribe(
      //     topicDestination,
      //     true,
      //     subscriptionId,
      //     options?.timeout || 10000
      //   );
      //   this.session.on(solace.SessionEventCode.MESSAGE, (message) => {
      //     if (message.getDestination().getName() === topic) {
      //       messageHandler(message);
      //     }
      //   });
      // }

      this.subscriptions.set(subscriptionId, {
        topic,
        callback: callback as MessageCallback,
        subscriber: null,
      });

      this.logger.info({ topic, options }, 'Subscribed to topic');

      return {
        id: subscriptionId,
        topic,
        unsubscribe: () => this.unsubscribeById(subscriptionId),
      };
    } catch (error) {
      const transportError = this.createTransportError(
        error,
        'SOLACE_SUBSCRIBE_ERROR',
        true
      );
      this.notifyError(transportError);
      throw error;
    }
  }

  /**
   * Publishes a message to a topic on Solace
   */
  async publish<T = unknown>(
    topic: string,
    message: T,
    options?: PublishOptions
  ): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Solace. Call connect() first.');
    }

    try {
      // In production:
      // const solaceMessage = solace.SolclientFactory.createMessage();
      // solaceMessage.setDestination(
      //   solace.SolclientFactory.createTopicDestination(topic)
      // );
      // solaceMessage.setBinaryAttachment(JSON.stringify(message));
      // solaceMessage.setDeliveryMode(
      //   options?.deliveryMode === 'persistent'
      //     ? solace.MessageDeliveryModeType.PERSISTENT
      //     : solace.MessageDeliveryModeType.DIRECT
      // );
      //
      // if (options?.correlationId) {
      //   solaceMessage.setCorrelationId(options.correlationId);
      // }
      // if (options?.ttl) {
      //   solaceMessage.setTimeToLive(options.ttl);
      // }
      // if (options?.priority !== undefined) {
      //   solaceMessage.setPriority(options.priority);
      // }
      //
      // this.session.send(solaceMessage);

      this.logger.debug({ topic }, 'Published to topic');
    } catch (error) {
      const transportError = this.createTransportError(
        error,
        'SOLACE_PUBLISH_ERROR',
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
    if (!this.isConnected()) {
      throw new Error('Not connected to Solace. Call connect() first.');
    }

    try {
      // In production:
      // const solaceMessage = solace.SolclientFactory.createMessage();
      // solaceMessage.setDestination(
      //   solace.SolclientFactory.createTopicDestination(topic)
      // );
      // solaceMessage.setBinaryAttachment(JSON.stringify(message));
      // solaceMessage.setDeliveryMode(solace.MessageDeliveryModeType.DIRECT);
      //
      // return new Promise((resolve, reject) => {
      //   this.session.sendRequest(
      //     solaceMessage,
      //     timeout,
      //     (session, replyMessage) => {
      //       resolve(this.transformMessage(replyMessage));
      //     },
      //     (session, event) => {
      //       reject(new Error(`Request failed: ${event.infoStr}`));
      //     },
      //     null
      //   );
      // });

      this.logger.debug({ topic, timeout }, 'Request sent to topic');

      // Mock response
      return {
        data: {} as TResponse,
        topic,
        timestamp: new Date(),
      };
    } catch (error) {
      const transportError = this.createTransportError(
        error,
        'SOLACE_REQUEST_ERROR',
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
      // In production:
      // const topicDestination = solace.SolclientFactory.createTopicDestination(
      //   subscription.topic
      // );
      // this.session.unsubscribe(topicDestination, true, subscriptionId, 10000);
      //
      // if (subscription.subscriber) {
      //   subscription.subscriber.disconnect();
      // }

      this.subscriptions.delete(subscriptionId);
      this.logger.debug({ subscriptionId }, 'Unsubscribed from subscription');
    } catch (error) {
      const transportError = this.createTransportError(
        error,
        'SOLACE_UNSUBSCRIBE_ERROR',
        false
      );
      this.notifyError(transportError);
      throw error;
    }
  }

  /**
   * Mock connection for development
   */
  private async mockConnect(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.session = { connected: true };
        resolve();
      }, 100);
    });
  }

  /**
   * Transforms a Solace message to the common TransportMessage format
   */
  private transformMessage<T>(solaceMessage: unknown): TransportMessage<T> {
    // In production, this would transform the actual Solace message:
    // const binaryAttachment = solaceMessage.getBinaryAttachment();
    // return {
    //   data: JSON.parse(binaryAttachment),
    //   topic: solaceMessage.getDestination().getName(),
    //   messageId: solaceMessage.getApplicationMessageId(),
    //   correlationId: solaceMessage.getCorrelationId(),
    //   timestamp: new Date(solaceMessage.getSenderTimestamp()),
    //   raw: solaceMessage,
    //   acknowledge: solaceMessage.acknowledge
    //     ? () => Promise.resolve(solaceMessage.acknowledge())
    //     : undefined,
    // };

    return {
      data: solaceMessage as T,
      topic: '',
      timestamp: new Date(),
      raw: solaceMessage,
    };
  }
}
