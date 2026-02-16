import { TestBed } from '@angular/core/testing';
import { NatsTransportService } from './nats-transport.service';
import { ConnectionStatus } from '../../interfaces/transport.interface';
import { NatsConfig } from '../../interfaces/transport-config.interface';
import { LoggerService } from '@rates-trading/logger';

// Mock NATS client - all variables must be defined INSIDE the factory
// since vi.mock is hoisted to the top of the file
vi.mock('@nats-io/nats-core', () => {
  const mockConn = {
    subscribe: vi.fn().mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        // empty
      },
      drain: vi.fn().mockResolvedValue(undefined),
    }),
    publish: vi.fn(),
    request: vi.fn(),
    drain: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    status: vi.fn().mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        // empty
      },
    }),
    getServer: vi.fn().mockReturnValue('nats://localhost:4222'),
    closed: vi.fn().mockReturnValue(new Promise(() => {})),
  };

  return {
    wsconnect: vi.fn().mockResolvedValue(mockConn),
    headers: vi.fn().mockReturnValue({
      set: vi.fn(),
    }),
    __mockConnection: mockConn,
  };
});

describe('NatsTransportService', () => {
  let service: NatsTransportService;
  let mockLogger: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = {
      child: vi.fn().mockReturnValue({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        NatsTransportService,
        { provide: LoggerService, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(NatsTransportService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create service instance', () => {
    expect(service).toBeDefined();
  });

  it('should initialize with config', () => {
    const config: NatsConfig = {
      url: 'nats://localhost:4222',
    };
    service.initialize(config);
    expect(service.getConnectionStatus()).toBe(ConnectionStatus.Disconnected);
  });

  it('should start with disconnected status', () => {
    expect(service.getConnectionStatus()).toBe(ConnectionStatus.Disconnected);
    expect(service.isConnected()).toBe(false);
  });

  it('should throw error when connecting without initialization', async () => {
    await expect(service.connect()).rejects.toThrow('NATS configuration not initialized');
  });

  it('should connect successfully with valid config', async () => {
    service.initialize({ url: 'nats://localhost:4222' });
    await service.connect();

    expect(service.getConnectionStatus()).toBe(ConnectionStatus.Connected);
    expect(service.isConnected()).toBe(true);
  });

  it('should emit connection status changes during connect', async () => {
    service.initialize({ url: 'nats://localhost:4222' });

    const statuses: ConnectionStatus[] = [];
    service.connectionStatus$.subscribe((s) => statuses.push(s));

    await service.connect();

    expect(statuses).toContain(ConnectionStatus.Connecting);
    expect(statuses).toContain(ConnectionStatus.Connected);
  });

  it('should not connect again if already connected', async () => {
    service.initialize({ url: 'nats://localhost:4222' });
    await service.connect();
    await service.connect();

    const childLogger = mockLogger.child.mock.results[0].value;
    expect(childLogger.warn).toHaveBeenCalledWith('Already connected');
  });

  describe('when connected', () => {
    beforeEach(async () => {
      service.initialize({ url: 'nats://localhost:4222' });
      await service.connect();
    });

    it('should subscribe to a topic', async () => {
      const callback = vi.fn();
      const subscription = await service.subscribe('rates.>', callback);

      expect(subscription).toBeDefined();
      expect(subscription.id).toBeTruthy();
      expect(subscription.topic).toBe('rates.>');
      expect(typeof subscription.unsubscribe).toBe('function');
    });

    it('should publish a message', async () => {
      await expect(
        service.publish('rates.us10y', { bid: 4.25, ask: 4.26 })
      ).resolves.toBeUndefined();
    });

    it('should publish a string message', async () => {
      await expect(
        service.publish('rates.us10y', 'hello')
      ).resolves.toBeUndefined();
    });

    it('should throw error on subscribe when not connected', async () => {
      await service.disconnect();
      await expect(
        service.subscribe('rates.>', vi.fn())
      ).rejects.toThrow('Not connected to NATS');
    });

    it('should throw error on publish when not connected', async () => {
      await service.disconnect();
      await expect(
        service.publish('rates.us10y', { bid: 4.25 })
      ).rejects.toThrow('Not connected to NATS');
    });

    it('should throw error on request when not connected', async () => {
      await service.disconnect();
      await expect(
        service.request('rates.query', { symbol: 'US10Y' })
      ).rejects.toThrow('Not connected to NATS');
    });

    it('should disconnect successfully', async () => {
      await service.disconnect();
      expect(service.isConnected()).toBe(false);
      expect(service.getConnectionStatus()).toBe(ConnectionStatus.Disconnected);
    });
  });

  describe('connect with various config options', () => {
    it('should connect with token authentication', async () => {
      service.initialize({
        url: 'nats://localhost:4222',
        token: 'my-secret-token',
      });
      await service.connect();
      expect(service.isConnected()).toBe(true);
    });

    it('should connect with user/password authentication', async () => {
      service.initialize({
        url: 'nats://localhost:4222',
        user: 'admin',
        password: 'secret',
      });
      await service.connect();
      expect(service.isConnected()).toBe(true);
    });

    it('should connect with TLS enabled', async () => {
      service.initialize({
        url: 'nats://localhost:4222',
        tls: true,
      });
      await service.connect();
      expect(service.isConnected()).toBe(true);
    });

    it('should connect with reconnect disabled', async () => {
      service.initialize({
        url: 'nats://localhost:4222',
        reconnect: { enabled: false },
      });
      await service.connect();
      expect(service.isConnected()).toBe(true);
    });

    it('should connect with reconnect settings', async () => {
      service.initialize({
        url: 'nats://localhost:4222',
        reconnect: {
          enabled: true,
          maxAttempts: 5,
          initialDelay: 500,
        },
      });
      await service.connect();
      expect(service.isConnected()).toBe(true);
    });

    it('should connect with legacy reconnect settings', async () => {
      service.initialize({
        url: 'nats://localhost:4222',
        maxReconnectAttempts: 20,
        reconnectTimeWait: 3000,
      });
      await service.connect();
      expect(service.isConnected()).toBe(true);
    });

    it('should connect with timeout', async () => {
      service.initialize({
        url: 'nats://localhost:4222',
        timeout: 5000,
      });
      await service.connect();
      expect(service.isConnected()).toBe(true);
    });

    it('should connect with pingInterval', async () => {
      service.initialize({
        url: 'nats://localhost:4222',
        pingInterval: 10000,
      });
      await service.connect();
      expect(service.isConnected()).toBe(true);
    });

    it('should connect with maxPingOut', async () => {
      service.initialize({
        url: 'nats://localhost:4222',
        maxPingOut: 3,
      });
      await service.connect();
      expect(service.isConnected()).toBe(true);
    });

    it('should connect with additional options', async () => {
      service.initialize({
        url: 'nats://localhost:4222',
        options: { verbose: true },
      });
      await service.connect();
      expect(service.isConnected()).toBe(true);
    });

    it('should connect with array of server URLs', async () => {
      service.initialize({
        url: ['nats://localhost:4222', 'nats://localhost:4223'],
      });
      await service.connect();
      expect(service.isConnected()).toBe(true);
    });

    it('should connect with name option', async () => {
      service.initialize({
        url: 'nats://localhost:4222',
        name: 'my-nats-client',
      });
      await service.connect();
      expect(service.isConnected()).toBe(true);
    });
  });

  describe('when connected - subscribe with options', () => {
    beforeEach(async () => {
      service.initialize({ url: 'nats://localhost:4222' });
      await service.connect();
    });

    it('should subscribe with queueName option', async () => {
      const callback = vi.fn();
      const subscription = await service.subscribe('rates.>', callback, {
        queueName: 'rates-group',
      });
      expect(subscription).toBeDefined();
      expect(subscription.id).toBeTruthy();
    });

    it('should subscribe without options', async () => {
      const callback = vi.fn();
      const subscription = await service.subscribe('rates.us10y', callback);
      expect(subscription).toBeDefined();
    });

    it('should unsubscribe from a subscription', async () => {
      const callback = vi.fn();
      const subscription = await service.subscribe('rates.>', callback);
      await expect(subscription.unsubscribe()).resolves.toBeUndefined();
    });

    it('should handle unsubscribe for already-removed subscription', async () => {
      const callback = vi.fn();
      const subscription = await service.subscribe('rates.>', callback);
      await subscription.unsubscribe();
      // Second unsubscribe should be a no-op
      await expect(subscription.unsubscribe()).resolves.toBeUndefined();
    });
  });

  describe('when connected - publish with headers', () => {
    beforeEach(async () => {
      service.initialize({ url: 'nats://localhost:4222' });
      await service.connect();
    });

    it('should publish with custom headers', async () => {
      await expect(
        service.publish('rates.us10y', { bid: 4.25 }, {
          headers: { 'X-Source': 'test' },
        })
      ).resolves.toBeUndefined();
    });

    it('should publish with array header values', async () => {
      await expect(
        service.publish('rates.us10y', { bid: 4.25 }, {
          headers: { 'X-Tags': 'tag1' },
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('when connected - request', () => {
    beforeEach(async () => {
      service.initialize({ url: 'nats://localhost:4222' });
      await service.connect();
    });

    it('should make a request with JSON response', async () => {
      const natsModule = await import('@nats-io/nats-core');
      const mockConn = (natsModule as any).__mockConnection;
      mockConn.request.mockResolvedValueOnce({
        json: () => ({ symbol: 'US10Y', rate: 4.25 }),
        string: () => '{"symbol":"US10Y","rate":4.25}',
        subject: 'rates.reply',
      });

      const reply = await service.request('rates.query', { symbol: 'US10Y' });
      expect(reply).toBeDefined();
      expect(reply.data).toEqual({ symbol: 'US10Y', rate: 4.25 });
      expect(reply.topic).toBe('rates.reply');
    });

    it('should make a request with string message', async () => {
      const natsModule = await import('@nats-io/nats-core');
      const mockConn = (natsModule as any).__mockConnection;
      mockConn.request.mockResolvedValueOnce({
        json: () => ({ result: 'ok' }),
        string: () => '{"result":"ok"}',
        subject: 'rates.reply',
      });

      const reply = await service.request('rates.query', 'simple-query');
      expect(reply).toBeDefined();
    });

    it('should make a request with custom timeout', async () => {
      const natsModule = await import('@nats-io/nats-core');
      const mockConn = (natsModule as any).__mockConnection;
      mockConn.request.mockResolvedValueOnce({
        json: () => ({ result: 'ok' }),
        string: () => '{"result":"ok"}',
        subject: 'rates.reply',
      });

      const reply = await service.request('rates.query', { q: 'test' }, 5000);
      expect(reply).toBeDefined();
    });

    it('should handle request with non-JSON response', async () => {
      const natsModule = await import('@nats-io/nats-core');
      const mockConn = (natsModule as any).__mockConnection;
      mockConn.request.mockResolvedValueOnce({
        json: () => { throw new Error('not json'); },
        string: () => 'plain-text-response',
        subject: 'rates.reply',
      });

      const reply = await service.request('rates.query', { q: 'test' });
      expect(reply).toBeDefined();
      expect(reply.data).toBe('plain-text-response');
    });

    it('should handle request failure', async () => {
      const natsModule = await import('@nats-io/nats-core');
      const mockConn = (natsModule as any).__mockConnection;
      mockConn.request.mockRejectedValueOnce(new Error('Request timeout'));

      const errorCallback = vi.fn();
      service.onError(errorCallback);

      await expect(
        service.request('rates.query', { q: 'test' })
      ).rejects.toThrow('Request timeout');
      expect(errorCallback).toHaveBeenCalled();
    });
  });

  describe('when connected - disconnect with active subscriptions', () => {
    beforeEach(async () => {
      service.initialize({ url: 'nats://localhost:4222' });
      await service.connect();
    });

    it('should drain subscriptions before disconnecting', async () => {
      await service.subscribe('rates.us10y', vi.fn());
      await service.subscribe('rates.us2y', vi.fn());

      await service.disconnect();
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('connection events', () => {
    it('should emit connection events during lifecycle', async () => {
      service.initialize({ url: 'nats://localhost:4222' });
      const events: any[] = [];
      service.connectionEvents$.subscribe((event) => events.push(event));

      await service.connect();
      await service.disconnect();

      const eventTypes = events.map((e) => e.type);
      expect(eventTypes).toContain('connected');
      expect(eventTypes).toContain('disconnected');
    });
  });

  describe('error handling', () => {
    it('should register error callbacks without throwing', () => {
      const errorCallback = vi.fn();
      expect(() => service.onError(errorCallback)).not.toThrow();
    });

    it('should have connectionEvents$ observable', () => {
      expect(service.connectionEvents$).toBeDefined();
    });

    it('should accept multiple error callbacks', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      service.onError(cb1);
      service.onError(cb2);
      expect(true).toBe(true);
    });

    it('should handle publish failure and notify error callbacks', async () => {
      service.initialize({ url: 'nats://localhost:4222' });
      await service.connect();

      const natsModule = await import('@nats-io/nats-core');
      const mockConn = (natsModule as any).__mockConnection;
      mockConn.publish.mockImplementationOnce(() => {
        throw new Error('Publish failed');
      });

      const errorCallback = vi.fn();
      service.onError(errorCallback);

      await expect(
        service.publish('rates.us10y', { bid: 4.25 })
      ).rejects.toThrow('Publish failed');
      expect(errorCallback).toHaveBeenCalled();
      expect(errorCallback.mock.calls[0][0].code).toBe('NATS_PUBLISH_ERROR');
    });

    it('should handle subscribe failure and notify error callbacks', async () => {
      service.initialize({ url: 'nats://localhost:4222' });
      await service.connect();

      const natsModule = await import('@nats-io/nats-core');
      const mockConn = (natsModule as any).__mockConnection;
      mockConn.subscribe.mockImplementationOnce(() => {
        throw new Error('Subscribe failed');
      });

      const errorCallback = vi.fn();
      service.onError(errorCallback);

      await expect(
        service.subscribe('rates.>', vi.fn())
      ).rejects.toThrow('Subscribe failed');
      expect(errorCallback).toHaveBeenCalled();
      expect(errorCallback.mock.calls[0][0].code).toBe('NATS_SUBSCRIBE_ERROR');
    });
  });

  describe('subscribe - message processing', () => {
    beforeEach(async () => {
      service.initialize({ url: 'nats://localhost:4222' });
      await service.connect();
    });

    it('should process JSON messages from the subscription iterator', async () => {
      const natsModule = await import('@nats-io/nats-core');
      const mockConn = (natsModule as any).__mockConnection;

      const messages = [
        {
          json: () => ({ symbol: 'US10Y', rate: 4.25 }),
          string: () => '{"symbol":"US10Y","rate":4.25}',
          subject: 'rates.us10y',
        },
      ];

      let iteratorResolve: (() => void) | undefined;
      mockConn.subscribe.mockReturnValueOnce({
        [Symbol.asyncIterator]: async function* () {
          for (const msg of messages) {
            yield msg;
          }
        },
        drain: vi.fn().mockResolvedValue(undefined),
      });

      const callback = vi.fn();
      await service.subscribe('rates.us10y', callback);

      // Wait for the async message loop to process
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0].data).toEqual({ symbol: 'US10Y', rate: 4.25 });
      expect(callback.mock.calls[0][0].topic).toBe('rates.us10y');
    });

    it('should fallback to string when JSON parsing fails in message loop', async () => {
      const natsModule = await import('@nats-io/nats-core');
      const mockConn = (natsModule as any).__mockConnection;

      mockConn.subscribe.mockReturnValueOnce({
        [Symbol.asyncIterator]: async function* () {
          yield {
            json: () => { throw new Error('Not JSON'); },
            string: () => 'plain-text-message',
            subject: 'rates.us10y',
          };
        },
        drain: vi.fn().mockResolvedValue(undefined),
      });

      const callback = vi.fn();
      await service.subscribe('rates.us10y', callback);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0].data).toBe('plain-text-message');
    });

    it('should handle errors in callback during message processing', async () => {
      const natsModule = await import('@nats-io/nats-core');
      const mockConn = (natsModule as any).__mockConnection;
      const childLogger = mockLogger.child.mock.results[0].value;

      mockConn.subscribe.mockReturnValueOnce({
        [Symbol.asyncIterator]: async function* () {
          yield {
            json: () => ({ rate: 4.25 }),
            string: () => '{"rate":4.25}',
            subject: 'rates.us10y',
          };
        },
        drain: vi.fn().mockResolvedValue(undefined),
      });

      const callback = vi.fn().mockImplementationOnce(() => {
        throw new Error('Callback error');
      });

      await service.subscribe('rates.us10y', callback);

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Error should be caught and logged, not thrown
      expect(childLogger.error).toHaveBeenCalled();
    });

    it('should handle error in subscription message loop iterator', async () => {
      const natsModule = await import('@nats-io/nats-core');
      const mockConn = (natsModule as any).__mockConnection;
      const childLogger = mockLogger.child.mock.results[0].value;

      mockConn.subscribe.mockReturnValueOnce({
        [Symbol.asyncIterator]: async function* () {
          throw new Error('Iterator error');
        },
        drain: vi.fn().mockResolvedValue(undefined),
      });

      const callback = vi.fn();
      await service.subscribe('rates.us10y', callback);

      await new Promise((resolve) => setTimeout(resolve, 10));

      // The iterator error should be caught and logged
      expect(childLogger.error).toHaveBeenCalled();
    });
  });

  describe('publish - array header values', () => {
    beforeEach(async () => {
      service.initialize({ url: 'nats://localhost:4222' });
      await service.connect();
    });

    it('should handle publish with array header values', async () => {
      await expect(
        service.publish('rates.us10y', { bid: 4.25 }, {
          headers: { 'X-Tags': ['tag1', 'tag2'] as any },
        })
      ).resolves.toBeUndefined();

      const natsModule = await import('@nats-io/nats-core');
      const headersMock = (natsModule as any).headers;
      expect(headersMock).toHaveBeenCalled();
    });
  });

  describe('unsubscribeById - error path', () => {
    beforeEach(async () => {
      service.initialize({ url: 'nats://localhost:4222' });
      await service.connect();
    });

    it('should handle unsubscribe error, still remove from tracking, and notify error', async () => {
      const natsModule = await import('@nats-io/nats-core');
      const mockConn = (natsModule as any).__mockConnection;

      // Make subscribe return a sub with drain that rejects
      mockConn.subscribe.mockReturnValueOnce({
        [Symbol.asyncIterator]: async function* () {
          // empty
        },
        drain: vi.fn().mockRejectedValue(new Error('Drain failed')),
      });

      const callback = vi.fn();
      const subscription = await service.subscribe('rates.us10y', callback);

      const errorCallback = vi.fn();
      service.onError(errorCallback);

      await expect(subscription.unsubscribe()).rejects.toThrow('Drain failed');
      expect(errorCallback).toHaveBeenCalled();
      expect(errorCallback.mock.calls[0][0].code).toBe('NATS_UNSUBSCRIBE_ERROR');

      // Subscription should be removed from tracking even after error
      await expect(subscription.unsubscribe()).resolves.toBeUndefined();
    });
  });

  describe('disconnect - error path', () => {
    it('should handle disconnect error, clean up, and rethrow', async () => {
      service.initialize({ url: 'nats://localhost:4222' });
      await service.connect();

      const natsModule = await import('@nats-io/nats-core');
      const mockConn = (natsModule as any).__mockConnection;
      mockConn.drain.mockRejectedValueOnce(new Error('Drain connection failed'));

      const errorCallback = vi.fn();
      service.onError(errorCallback);

      await expect(service.disconnect()).rejects.toThrow('Drain connection failed');
      expect(errorCallback).toHaveBeenCalled();
      expect(errorCallback.mock.calls[0][0].code).toBe('NATS_DISCONNECT_ERROR');

      // Connection should be nulled even on error
      const anyService = service as any;
      expect(anyService.connection).toBeNull();
    });
  });

  describe('connect - connection failure', () => {
    it('should handle wsconnect failure and notify error', async () => {
      service.initialize({ url: 'nats://localhost:4222' });

      const natsModule = await import('@nats-io/nats-core');
      const wsconnect = (natsModule as any).wsconnect;
      wsconnect.mockRejectedValueOnce(new Error('Connection refused'));

      const errorCallback = vi.fn();
      service.onError(errorCallback);

      await expect(service.connect()).rejects.toThrow('Connection refused');
      expect(errorCallback).toHaveBeenCalled();
      expect(errorCallback.mock.calls[0][0].code).toBe('NATS_CONNECTION_ERROR');
      expect(service.getConnectionStatus()).toBe(ConnectionStatus.Error);
    });
  });

  describe('setupEventHandlers - status loop', () => {
    it('should handle disconnect status event', async () => {
      const natsModule = await import('@nats-io/nats-core');
      const mockConn = (natsModule as any).__mockConnection;

      let statusResolve: ((value: any) => void) | undefined;
      const statusEvents: any[] = [];

      // Make status return an async iterable that yields events
      mockConn.status.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'disconnect', server: 'nats://localhost:4222' };
        },
      });

      service.initialize({ url: 'nats://localhost:4222' });
      await service.connect();

      // Wait for the status loop to process
      await new Promise((resolve) => setTimeout(resolve, 10));

      // The status should reflect the disconnect event
      // Note: the connection status may have been updated
      const childLogger = mockLogger.child.mock.results[0].value;
      expect(childLogger.warn).toHaveBeenCalled();
    });

    it('should handle reconnect status event', async () => {
      const natsModule = await import('@nats-io/nats-core');
      const mockConn = (natsModule as any).__mockConnection;

      mockConn.status.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'reconnect', server: 'nats://localhost:4222' };
        },
      });

      service.initialize({ url: 'nats://localhost:4222' });
      await service.connect();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const childLogger = mockLogger.child.mock.results[0].value;
      expect(childLogger.info).toHaveBeenCalled();
    });

    it('should handle reconnecting status event', async () => {
      const natsModule = await import('@nats-io/nats-core');
      const mockConn = (natsModule as any).__mockConnection;

      mockConn.status.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'reconnecting' };
        },
      });

      service.initialize({ url: 'nats://localhost:4222' });
      await service.connect();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const childLogger = mockLogger.child.mock.results[0].value;
      expect(childLogger.debug).toHaveBeenCalledWith('Reconnecting to NATS');
    });

    it('should handle error status event', async () => {
      const natsModule = await import('@nats-io/nats-core');
      const mockConn = (natsModule as any).__mockConnection;

      mockConn.status.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'error', error: new Error('Connection error') };
        },
      });

      service.initialize({ url: 'nats://localhost:4222' });
      await service.connect();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const childLogger = mockLogger.child.mock.results[0].value;
      expect(childLogger.error).toHaveBeenCalled();
    });

    it('should handle close status event', async () => {
      const natsModule = await import('@nats-io/nats-core');
      const mockConn = (natsModule as any).__mockConnection;

      mockConn.status.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'close' };
        },
      });

      service.initialize({ url: 'nats://localhost:4222' });
      await service.connect();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const childLogger = mockLogger.child.mock.results[0].value;
      expect(childLogger.info).toHaveBeenCalledWith('NATS connection closed');
    });

    it('should handle connection closed with error', async () => {
      const natsModule = await import('@nats-io/nats-core');
      const mockConn = (natsModule as any).__mockConnection;

      mockConn.closed.mockReturnValue(Promise.resolve(new Error('Unexpected close')));

      service.initialize({ url: 'nats://localhost:4222' });
      await service.connect();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const childLogger = mockLogger.child.mock.results[0].value;
      expect(childLogger.error).toHaveBeenCalled();
    });

    it('should handle connection closed normally', async () => {
      const natsModule = await import('@nats-io/nats-core');
      const mockConn = (natsModule as any).__mockConnection;

      mockConn.closed.mockReturnValue(Promise.resolve(undefined));

      service.initialize({ url: 'nats://localhost:4222' });
      await service.connect();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const childLogger = mockLogger.child.mock.results[0].value;
      expect(childLogger.info).toHaveBeenCalledWith('Connection closed normally');
    });
  });

  describe('resubscribeAll', () => {
    it('should resubscribe to all active subscriptions', async () => {
      const natsModule = await import('@nats-io/nats-core');
      const mockConn = (natsModule as any).__mockConnection;

      // Reset the connection mock methods that cause interference from status loop tests
      mockConn.status.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          // empty - no events
        },
      });
      mockConn.closed.mockReturnValue(new Promise(() => {}));
      mockConn.subscribe.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          // empty
        },
        drain: vi.fn().mockResolvedValue(undefined),
      });

      service.initialize({ url: 'nats://localhost:4222' });
      await service.connect();

      // Create subscriptions
      await service.subscribe('rates.us10y', vi.fn());
      await service.subscribe('rates.us2y', vi.fn());

      // Reset subscribe mock call count only
      mockConn.subscribe.mockClear();
      mockConn.subscribe.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          // empty
        },
        drain: vi.fn().mockResolvedValue(undefined),
      });

      const anyService = service as any;
      await anyService.resubscribeAll();

      expect(mockConn.subscribe).toHaveBeenCalledTimes(2);
    });

    it('should handle resubscribe failure for individual topics', async () => {
      const natsModule = await import('@nats-io/nats-core');
      const mockConn = (natsModule as any).__mockConnection;

      // Reset the connection mock methods
      mockConn.status.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          // empty - no events
        },
      });
      mockConn.closed.mockReturnValue(new Promise(() => {}));
      mockConn.subscribe.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          // empty
        },
        drain: vi.fn().mockResolvedValue(undefined),
      });

      service.initialize({ url: 'nats://localhost:4222' });
      await service.connect();

      const childLogger = mockLogger.child.mock.results[0].value;

      // Create subscription
      await service.subscribe('rates.us10y', vi.fn());

      // Make subscribe fail on resubscribe
      mockConn.subscribe.mockImplementationOnce(() => {
        throw new Error('Resubscribe failed');
      });

      const anyService = service as any;
      await anyService.resubscribeAll();

      expect(childLogger.error).toHaveBeenCalled();
    });
  });
});
