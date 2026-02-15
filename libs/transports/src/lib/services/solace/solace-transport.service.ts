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
import { SolaceConfig } from '../../interfaces/transport-config.interface';
import { BaseTransportService } from '../base-transport.service';
import { LoggerService } from '@rates-trading/logger';

// Solace JavaScript API - package.json "browser" field resolves to lib-browser for Angular
import solace from 'solclientjs';

/** Solace session type (EventEmitter with connect, disconnect, subscribe, etc.) */
type SolaceSession = ReturnType<typeof solace.SolclientFactory.createSession>;

/** Event names for Session (EventEmitter expects string | symbol) */
const SessionEvent = {
  MESSAGE: solace.SessionEventCode.MESSAGE as unknown as string,
  UP_NOTICE: solace.SessionEventCode.UP_NOTICE as unknown as string,
  CONNECT_FAILED_ERROR: solace.SessionEventCode.CONNECT_FAILED_ERROR as unknown as string,
  DISCONNECTED: solace.SessionEventCode.DISCONNECTED as unknown as string,
  RECONNECTING_NOTICE: solace.SessionEventCode.RECONNECTING_NOTICE as unknown as string,
  RECONNECTED_NOTICE: solace.SessionEventCode.RECONNECTED_NOTICE as unknown as string,
  SUBSCRIPTION_OK: solace.SessionEventCode.SUBSCRIPTION_OK as unknown as string,
  SUBSCRIPTION_ERROR: solace.SessionEventCode.SUBSCRIPTION_ERROR as unknown as string,
  DOWN_ERROR: solace.SessionEventCode.DOWN_ERROR as unknown as string,
};

/** Minimal Solace message shape for parsing (API may return string | Uint8Array | null) */
interface SolaceMessageLike {
  getBinaryAttachment(): string | Uint8Array | ArrayBuffer | null;
  getDestination?(): { getName?(): string };
  getSenderTimestamp?(): number;
}

/** One-time Solace factory initialization */
let solaceFactoryInitialized = false;

function initSolaceFactory(): void {
  if (solaceFactoryInitialized) {
    return;
  }
  const factoryProps = new solace.SolclientFactoryProperties();
  factoryProps.profile = solace.SolclientFactoryProfiles.version10;
  solace.SolclientFactory.init(factoryProps);
  solaceFactoryInitialized = true;
}

/**
 * Solace Transport Service Implementation
 *
 * Provides messaging using Solace PubSub+ via the solclientjs library.
 * Supports topic subscribe/unsubscribe, publish, and request/reply.
 */
@Injectable()
export class SolaceTransportService extends BaseTransportService implements ITransportService {
  private logger = inject(LoggerService).child({ service: 'SolaceTransport' });
  private session: SolaceSession | null = null;
  private subscriptions = new Map<
    string,
    { topic: string; callback: MessageCallback; correlationKey: string }
  >();
  private config: SolaceConfig | null = null;
  private messageHandler = (message: SolaceMessageLike): void => {
    this.handleSolaceMessage(message);
  };

  constructor() {
    super();
  }

  initialize(config: SolaceConfig): void {
    this.config = config;
  }

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
      initSolaceFactory();

      const sessionProperties = {
        url: this.config.url,
        vpnName: this.config.vpnName,
        userName: this.config.userName,
        password: this.config.password ?? '',
        clientName: this.config.clientName ?? 'rates-desktop',
        connectTimeoutInMsecs: this.config.connectTimeout ?? 10000,
        keepAliveIntervalInMsecs: this.config.keepAliveInterval ?? 3000,
        keepAliveIntervalsLimit: this.config.keepAliveIntervalLimit ?? 3,
        generateSendTimestamps: this.config.generateSendTimestamps ?? false,
        generateReceiveTimestamps: this.config.generateReceiveTimestamps ?? false,
        includeSenderId: this.config.includeSenderId ?? false,
        reconnectRetries: this.config.reconnect?.maxAttempts ?? 10,
        reconnectRetryWaitInMsecs: this.config.reconnect?.retryWaitMs ?? 3000,
      };

      const session = solace.SolclientFactory.createSession(sessionProperties);
      this.session = session;

      await new Promise<void>((resolve, reject) => {
        session.on(SessionEvent.UP_NOTICE, () => {
          this.logger.info('Solace session connected');
          resolve();
        });
        session.on(SessionEvent.CONNECT_FAILED_ERROR, (event: { infoStr?: string }) => {
          reject(new Error(event?.infoStr ?? 'Solace connection failed'));
        });
        session.on(SessionEvent.DISCONNECTED, () => {
          this.updateConnectionStatus(ConnectionStatus.Disconnected, 'Disconnected from Solace');
        });
        session.on(SessionEvent.RECONNECTING_NOTICE, () => {
          this.updateConnectionStatus(ConnectionStatus.Reconnecting, 'Reconnecting to Solace');
        });
        session.on(SessionEvent.RECONNECTED_NOTICE, () => {
          this.updateConnectionStatus(ConnectionStatus.Connected, 'Reconnected to Solace');
        });
        session.on(SessionEvent.MESSAGE, this.messageHandler);

        try {
          session.connect();
        } catch (err) {
          reject(err);
        }
      });

      this.updateConnectionStatus(
        ConnectionStatus.Connected,
        `Connected to Solace at ${this.config.url}`
      );
    } catch (error) {
      this.session = null;
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

  async disconnect(): Promise<void> {
    if (!this.isConnected() || !this.session) {
      return;
    }

    const sessionToDisconnect = this.session;
    this.updateConnectionStatus(ConnectionStatus.Disconnected, 'Disconnecting from Solace');

    try {
      sessionToDisconnect.removeListener(SessionEvent.MESSAGE, this.messageHandler);

      const unsubscribePromises = Array.from(this.subscriptions.keys()).map((id) =>
        this.unsubscribeById(id)
      );
      await Promise.all(unsubscribePromises);

      await new Promise<void>((resolve, reject) => {
        const onDisconnected = () => {
          sessionToDisconnect.removeListener(SessionEvent.DISCONNECTED, onDisconnected);
          sessionToDisconnect.removeListener(SessionEvent.DOWN_ERROR, onError);
          try {
            sessionToDisconnect.dispose();
          } catch (e) {
            this.logger.warn({ err: e }, 'Error disposing Solace session');
          }
          this.session = null;
          resolve();
        };
        const onError = (event: { infoStr?: string }) => {
          sessionToDisconnect.removeListener(SessionEvent.DISCONNECTED, onDisconnected);
          sessionToDisconnect.removeListener(SessionEvent.DOWN_ERROR, onError);
          try {
            sessionToDisconnect.dispose();
          } catch (e) {
            this.logger.warn({ err: e }, 'Error disposing Solace session');
          }
          this.session = null;
          reject(new Error(event?.infoStr ?? 'Solace disconnect error'));
        };
        sessionToDisconnect.on(SessionEvent.DISCONNECTED, onDisconnected);
        sessionToDisconnect.on(SessionEvent.DOWN_ERROR, onError);
        sessionToDisconnect.disconnect();
      });
    } catch (error) {
      this.session = null;
      const transportError = this.createTransportError(
        error,
        'SOLACE_DISCONNECT_ERROR',
        false
      );
      this.notifyError(transportError);
      throw error;
    }
  }

  async subscribe<T = unknown>(
    topic: string,
    callback: MessageCallback<T>,
    options?: SubscriptionOptions
  ): Promise<Subscription> {
    const session = this.session;
    if (!session || !this.isConnected()) {
      throw new Error('Not connected to Solace. Call connect() first.');
    }

    const subscriptionId = this.generateSubscriptionId();
    const requestTimeout = options?.timeout ?? 10000;

    try {
      const topicDestination = solace.SolclientFactory.createTopicDestination(topic);

      this.subscriptions.set(subscriptionId, {
        topic,
        callback: callback as MessageCallback,
        correlationKey: subscriptionId,
      });

      await new Promise<void>((resolve, reject) => {
        const onSubOk = (event: { correlationKey?: string }) => {
          if (event?.correlationKey === subscriptionId) {
            session.removeListener(SessionEvent.SUBSCRIPTION_OK, onSubOk);
            session.removeListener(SessionEvent.SUBSCRIPTION_ERROR, onSubErr);
            resolve();
          }
        };
        const onSubErr = (event: { reason?: string; correlationKey?: string }) => {
          if (event?.correlationKey === subscriptionId) {
            session.removeListener(SessionEvent.SUBSCRIPTION_OK, onSubOk);
            session.removeListener(SessionEvent.SUBSCRIPTION_ERROR, onSubErr);
            reject(new Error(event?.reason ?? 'Subscribe failed'));
          }
        };
        session.on(SessionEvent.SUBSCRIPTION_OK, onSubOk);
        session.on(SessionEvent.SUBSCRIPTION_ERROR, onSubErr);
        session.subscribe(topicDestination, true, subscriptionId, requestTimeout);
      });

      this.logger.info({ topic, subscriptionId }, 'Subscribed to topic');

      return {
        id: subscriptionId,
        topic,
        unsubscribe: () => this.unsubscribeById(subscriptionId),
      };
    } catch (error) {
      this.subscriptions.delete(subscriptionId);
      const transportError = this.createTransportError(
        error,
        'SOLACE_SUBSCRIBE_ERROR',
        true
      );
      this.notifyError(transportError);
      throw error;
    }
  }

  async publish<T = unknown>(
    topic: string,
    message: T,
    options?: PublishOptions
  ): Promise<void> {
    const session = this.session;
    if (!session || !this.isConnected()) {
      throw new Error('Not connected to Solace. Call connect() first.');
    }

    try {
      const solaceMessage = solace.SolclientFactory.createMessage();
      solaceMessage.setDestination(solace.SolclientFactory.createTopicDestination(topic));
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      solaceMessage.setBinaryAttachment(payload);
      solaceMessage.setDeliveryMode(
        options?.deliveryMode === 'persistent'
          ? solace.MessageDeliveryModeType.PERSISTENT
          : solace.MessageDeliveryModeType.DIRECT
      );
      if (options?.correlationId) {
        solaceMessage.setCorrelationId(options.correlationId);
      }
      if (options?.ttl) {
        solaceMessage.setTimeToLive(options.ttl);
      }

      session.send(solaceMessage);
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

  async request<TRequest, TResponse>(
    topic: string,
    message: TRequest,
    timeout = 10000
  ): Promise<TransportMessage<TResponse>> {
    const session = this.session;
    if (!session || !this.isConnected()) {
      throw new Error('Not connected to Solace. Call connect() first.');
    }

    return new Promise((resolve, reject) => {
      const solaceMessage = solace.SolclientFactory.createMessage();
      solaceMessage.setDestination(solace.SolclientFactory.createTopicDestination(topic));
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      solaceMessage.setBinaryAttachment(payload);
      solaceMessage.setDeliveryMode(solace.MessageDeliveryModeType.DIRECT);

      session.sendRequest(
        solaceMessage,
        timeout,
        (_session: unknown, replyMessage: unknown) => {
          resolve(this.transformSolaceMessage(replyMessage as SolaceMessageLike));
        },
        (_session: unknown, error: unknown) => {
          const msg =
            error != null && typeof error === 'object' && 'infoStr' in error
              ? String((error as { infoStr?: string }).infoStr)
              : error != null
                ? String(error)
                : 'Request failed';
          reject(new Error(msg || 'Request failed'));
        },
        undefined
      );
    });
  }

  private handleSolaceMessage(solaceMessage: SolaceMessageLike): void {
    const topicName = solaceMessage.getDestination?.()?.getName?.() ?? '';
    for (const sub of this.subscriptions.values()) {
      if (this.topicMatches(sub.topic, topicName)) {
        try {
          const transportMsg = this.transformSolaceMessage(solaceMessage);
          sub.callback(transportMsg);
        } catch (err) {
          this.logger.error(err as Error, 'Error in Solace message callback');
        }
        return;
      }
    }
  }

  /** Simple topic match: exact or prefix (e.g. "rates/>" or "rates/marketData") */
  private topicMatches(subTopic: string, receivedTopic: string): boolean {
    if (subTopic === receivedTopic) {
      return true;
    }
    if (subTopic.endsWith('>')) {
      const prefix = subTopic.slice(0, -1);
      return receivedTopic === prefix || receivedTopic.startsWith(prefix);
    }
    return false;
  }

  private transformSolaceMessage<T>(solaceMessage: SolaceMessageLike): TransportMessage<T> {
    const raw = solaceMessage.getBinaryAttachment();
    const str =
      raw == null
        ? ''
        : typeof raw === 'string'
          ? raw
          : new TextDecoder().decode(raw as ArrayBuffer | Uint8Array);
    let data: T;
    try {
      data = (str ? JSON.parse(str) : {}) as T;
    } catch {
      data = str as unknown as T;
    }
    const topic = solaceMessage.getDestination?.()?.getName?.() ?? '';
    const ts = solaceMessage.getSenderTimestamp?.();
    const timestamp = ts != null ? new Date(ts) : new Date();
    return {
      data,
      topic,
      timestamp,
      raw: solaceMessage,
    };
  }

  private async unsubscribeById(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    const session = this.session;
    if (!subscription || !session) {
      return;
    }

    try {
      const topicDestination = solace.SolclientFactory.createTopicDestination(subscription.topic);

      await new Promise<void>((resolve) => {
        const timeoutMs = 10000;
        const onOk = (event: { correlationKey?: string }) => {
          if (event?.correlationKey === subscriptionId) {
            clearTimeout(timer);
            session.removeListener(SessionEvent.SUBSCRIPTION_OK, onOk);
            session.removeListener(SessionEvent.SUBSCRIPTION_ERROR, onErr);
            resolve();
          }
        };
        const onErr = (event: { correlationKey?: string }) => {
          if (event?.correlationKey === subscriptionId) {
            clearTimeout(timer);
            session.removeListener(SessionEvent.SUBSCRIPTION_OK, onOk);
            session.removeListener(SessionEvent.SUBSCRIPTION_ERROR, onErr);
            resolve();
          }
        };
        const timer = setTimeout(() => {
          session.removeListener(SessionEvent.SUBSCRIPTION_OK, onOk);
          session.removeListener(SessionEvent.SUBSCRIPTION_ERROR, onErr);
          resolve();
        }, timeoutMs);
        session.on(SessionEvent.SUBSCRIPTION_OK, onOk);
        session.on(SessionEvent.SUBSCRIPTION_ERROR, onErr);
        session.unsubscribe(topicDestination, true, subscriptionId, timeoutMs);
      });

      this.subscriptions.delete(subscriptionId);
      this.logger.debug({ subscriptionId }, 'Unsubscribed from topic');
    } catch (error) {
      this.subscriptions.delete(subscriptionId);
      const transportError = this.createTransportError(
        error,
        'SOLACE_UNSUBSCRIBE_ERROR',
        false
      );
      this.notifyError(transportError);
      throw error;
    }
  }
}
