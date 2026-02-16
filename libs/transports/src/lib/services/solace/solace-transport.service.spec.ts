import { TestBed } from '@angular/core/testing';
import { SolaceTransportService } from './solace-transport.service';
import { ConnectionStatus } from '../../interfaces/transport.interface';
import { SolaceConfig } from '../../interfaces/transport-config.interface';
import { LoggerService } from '@rates-trading/logger';

// Mock solclientjs - all mock objects must be defined INSIDE the factory
// since vi.mock is hoisted to the top of the file
vi.mock('solclientjs', () => {
  const session = {
    on: vi.fn().mockReturnThis(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    send: vi.fn(),
    sendRequest: vi.fn(),
    removeListener: vi.fn(),
  };

  const SessionEventCode = {
    MESSAGE: 0,
    UP_NOTICE: 1,
    CONNECT_FAILED_ERROR: 2,
    DISCONNECTED: 3,
    RECONNECTING_NOTICE: 4,
    RECONNECTED_NOTICE: 5,
    SUBSCRIPTION_OK: 6,
    SUBSCRIPTION_ERROR: 7,
    DOWN_ERROR: 8,
  };

  const MessageDeliveryModeType = {
    DIRECT: 0,
    PERSISTENT: 1,
  };

  const SolclientFactoryProfiles = {
    version10: 'version10',
  };

  const mockMessage = {
    setDestination: vi.fn(),
    setBinaryAttachment: vi.fn(),
    setDeliveryMode: vi.fn(),
    setCorrelationId: vi.fn(),
    setTimeToLive: vi.fn(),
  };

  const factory = {
    init: vi.fn(),
    createSession: vi.fn().mockReturnValue(session),
    createTopicDestination: vi.fn().mockReturnValue({}),
    createMessage: vi.fn().mockReturnValue(mockMessage),
  };

  return {
    default: {
      SessionEventCode,
      MessageDeliveryModeType,
      SolclientFactoryProfiles,
      SolclientFactory: factory,
      SolclientFactoryProperties: vi.fn(),
    },
    SessionEventCode,
    MessageDeliveryModeType,
    SolclientFactoryProfiles,
    SolclientFactory: factory,
    SolclientFactoryProperties: vi.fn(),
  };
});

describe('SolaceTransportService', () => {
  let service: SolaceTransportService;
  let config: SolaceConfig;
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
        SolaceTransportService,
        { provide: LoggerService, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(SolaceTransportService);
    config = {
      url: 'ws://localhost:8008',
      vpnName: 'dev-vpn',
      userName: 'test-user',
      clientName: 'test-client',
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should create an instance', () => {
      expect(service).toBeTruthy();
    });

    it('should start with disconnected status', () => {
      expect(service.getConnectionStatus()).toBe(ConnectionStatus.Disconnected);
      expect(service.isConnected()).toBe(false);
    });

    it('should have connectionStatus$ observable', () => {
      expect(service.connectionStatus$).toBeDefined();
    });

    it('should have connectionEvents$ observable', () => {
      expect(service.connectionEvents$).toBeDefined();
    });
  });

  describe('connect', () => {
    it('should throw error if not initialized', async () => {
      await expect(service.connect()).rejects.toThrow(
        'Solace configuration not initialized'
      );
    });

    it('should initialize config', () => {
      service.initialize(config);
      expect(service.getConnectionStatus()).toBe(ConnectionStatus.Disconnected);
    });

    it('should emit connecting status on connect attempt', () => {
      service.initialize(config);
      const statuses: ConnectionStatus[] = [];
      service.connectionStatus$.subscribe((s) => statuses.push(s));

      // Start connect - will hang on the mock Promise so don't await
      service.connect().catch(() => {});

      expect(statuses).toContain(ConnectionStatus.Connecting);
    });
  });

  describe('disconnect', () => {
    it('should do nothing if not connected', async () => {
      service.initialize(config);
      await service.disconnect();
      expect(service.getConnectionStatus()).toBe(ConnectionStatus.Disconnected);
    });
  });

  describe('subscribe', () => {
    it('should throw error if not connected', async () => {
      service.initialize(config);
      await expect(
        service.subscribe('/topic/rates', vi.fn())
      ).rejects.toThrow('Not connected to Solace');
    });
  });

  describe('publish', () => {
    it('should throw error if not connected', async () => {
      service.initialize(config);
      await expect(
        service.publish('/topic/rates', { rate: 1.5 })
      ).rejects.toThrow('Not connected to Solace');
    });
  });

  describe('request', () => {
    it('should throw error if not connected', async () => {
      service.initialize(config);
      await expect(
        service.request('/topic/rates', { query: 'test' })
      ).rejects.toThrow('Not connected to Solace');
    });
  });

  describe('connect - simulated session events', () => {
    it('should connect successfully when UP_NOTICE fires', async () => {
      service.initialize(config);

      // Get the mock session to simulate events
      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();

      // Capture the event handlers registered via session.on()
      const handlers: Record<string, any[]> = {};
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      // Start connect (it will block on the Promise)
      const connectPromise = service.connect();

      // Wait a tick for the session.on calls to be registered
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate UP_NOTICE (event code 1)
      const upNoticeHandlers = handlers['1'];
      if (upNoticeHandlers) {
        upNoticeHandlers.forEach((h: any) => h());
      }

      await connectPromise;

      expect(service.isConnected()).toBe(true);
      expect(service.getConnectionStatus()).toBe(ConnectionStatus.Connected);
    });

    it('should handle connection failure when CONNECT_FAILED fires', async () => {
      service.initialize(config);

      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();

      const handlers: Record<string, any[]> = {};
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      const errorCallback = vi.fn();
      service.onError(errorCallback);

      const connectPromise = service.connect();

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate CONNECT_FAILED_ERROR (event code 2)
      const failedHandlers = handlers['2'];
      if (failedHandlers) {
        failedHandlers.forEach((h: any) => h({ infoStr: 'Connection refused' }));
      }

      await expect(connectPromise).rejects.toThrow('Connection refused');
      expect(errorCallback).toHaveBeenCalled();
    });

    it('should handle connect() throwing synchronously', async () => {
      service.initialize(config);

      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();

      mockSession.connect.mockImplementationOnce(() => {
        throw new Error('Socket creation failed');
      });

      const errorCallback = vi.fn();
      service.onError(errorCallback);

      await expect(service.connect()).rejects.toThrow('Socket creation failed');
      expect(errorCallback).toHaveBeenCalled();
    });

    it('should not connect if already connected', async () => {
      service.initialize(config);

      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();

      const handlers: Record<string, any[]> = {};
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      // First connect
      const connectPromise = service.connect();
      await new Promise((resolve) => setTimeout(resolve, 0));
      const upNoticeHandlers = handlers['1'];
      if (upNoticeHandlers) {
        upNoticeHandlers.forEach((h: any) => h());
      }
      await connectPromise;

      // Second connect - should warn
      await service.connect();
      const childLogger = mockLogger.child.mock.results[0].value;
      expect(childLogger.warn).toHaveBeenCalledWith('Already connected');
    });
  });

  describe('connected-state operations', () => {
    let handlers: Record<string, any[]>;

    beforeEach(async () => {
      service.initialize(config);

      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();

      handlers = {};
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      // Connect
      const connectPromise = service.connect();
      await new Promise((resolve) => setTimeout(resolve, 0));
      const upNoticeHandlers = handlers['1'];
      if (upNoticeHandlers) {
        upNoticeHandlers.forEach((h: any) => h());
      }
      await connectPromise;
    });

    it('should subscribe to a topic', async () => {
      // Reset handlers for the subscribe events
      handlers = {};
      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      const callback = vi.fn();
      const subPromise = service.subscribe('/topic/rates', callback);

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate SUBSCRIPTION_OK (event code 6)
      const subOkHandlers = handlers['6'];
      if (subOkHandlers) {
        // We need to find the correlationKey that was used
        // The subscribe call passes subscriptionId as correlationKey
        subOkHandlers.forEach((h: any) => {
          // Try calling with any correlationKey - it checks for match
          h({ correlationKey: mockSession.subscribe.mock.calls[0]?.[2] });
        });
      }

      const subscription = await subPromise;
      expect(subscription).toBeDefined();
      expect(subscription.topic).toBe('/topic/rates');
      expect(typeof subscription.unsubscribe).toBe('function');
    });

    it('should publish a message', async () => {
      await expect(
        service.publish('/topic/rates', { rate: 1.5 })
      ).resolves.toBeUndefined();
    });

    it('should publish a string message', async () => {
      await expect(
        service.publish('/topic/rates', 'raw-string')
      ).resolves.toBeUndefined();
    });

    it('should publish with persistent delivery mode', async () => {
      await expect(
        service.publish('/topic/rates', { rate: 1.5 }, { deliveryMode: 'persistent' })
      ).resolves.toBeUndefined();
    });

    it('should publish with correlationId', async () => {
      await expect(
        service.publish('/topic/rates', { rate: 1.5 }, { correlationId: 'corr-1' })
      ).resolves.toBeUndefined();
    });

    it('should publish with ttl', async () => {
      await expect(
        service.publish('/topic/rates', { rate: 1.5 }, { ttl: 30000 })
      ).resolves.toBeUndefined();
    });

    it('should handle publish error', async () => {
      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();
      mockSession.send.mockImplementationOnce(() => {
        throw new Error('Send failed');
      });

      const errorCallback = vi.fn();
      service.onError(errorCallback);

      await expect(
        service.publish('/topic/rates', { rate: 1.5 })
      ).rejects.toThrow('Send failed');
      expect(errorCallback).toHaveBeenCalled();
    });

    it('should handle disconnect', async () => {
      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();

      // Set up disconnect handlers
      const disconnectHandlers: Record<string, any[]> = {};
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!disconnectHandlers[event]) disconnectHandlers[event] = [];
        disconnectHandlers[event].push(handler);
        return mockSession;
      });

      const disconnectPromise = service.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate DISCONNECTED event (event code 3)
      const discHandlers = disconnectHandlers['3'];
      if (discHandlers) {
        discHandlers.forEach((h: any) => h());
      }

      await disconnectPromise;
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should register error callbacks without throwing', () => {
      const errorCallback = vi.fn();
      expect(() => service.onError(errorCallback)).not.toThrow();
    });

    it('should accept multiple error callbacks', () => {
      expect(() => {
        service.onError(vi.fn());
        service.onError(vi.fn());
      }).not.toThrow();
    });
  });

  describe('connection events', () => {
    it('should emit events during connect lifecycle', async () => {
      service.initialize(config);
      const events: any[] = [];
      service.connectionEvents$.subscribe((event) => events.push(event));

      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();

      const handlers: Record<string, any[]> = {};
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      const connectPromise = service.connect();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate UP_NOTICE
      const upHandlers = handlers['1'];
      if (upHandlers) upHandlers.forEach((h: any) => h());

      await connectPromise;

      const eventTypes = events.map((e) => e.type);
      expect(eventTypes).toContain('connected');
    });
  });

  describe('subscribe - error path', () => {
    let handlers: Record<string, any[]>;

    beforeEach(async () => {
      service.initialize(config);

      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();

      handlers = {};
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      // Connect
      const connectPromise = service.connect();
      await new Promise((resolve) => setTimeout(resolve, 0));
      const upNoticeHandlers = handlers['1'];
      if (upNoticeHandlers) upNoticeHandlers.forEach((h: any) => h());
      await connectPromise;
    });

    it('should handle subscription error and notify error callbacks', async () => {
      // Reset handlers for subscribe events
      handlers = {};
      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      const errorCallback = vi.fn();
      service.onError(errorCallback);

      const callback = vi.fn();
      const subPromise = service.subscribe('/topic/rates', callback);

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate SUBSCRIPTION_ERROR (event code 7) with matching correlationKey
      const subErrHandlers = handlers['7'];
      if (subErrHandlers) {
        const correlationKey = mockSession.subscribe.mock.calls[0]?.[2];
        subErrHandlers.forEach((h: any) => {
          h({ correlationKey, reason: 'Topic not authorized' });
        });
      }

      await expect(subPromise).rejects.toThrow('Topic not authorized');
      expect(errorCallback).toHaveBeenCalled();
      expect(errorCallback.mock.calls[0][0].code).toBe('SOLACE_SUBSCRIBE_ERROR');
    });

    it('should handle subscription error with default reason', async () => {
      handlers = {};
      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      const callback = vi.fn();
      const subPromise = service.subscribe('/topic/rates', callback);

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate SUBSCRIPTION_ERROR with no reason
      const subErrHandlers = handlers['7'];
      if (subErrHandlers) {
        const correlationKey = mockSession.subscribe.mock.calls[0]?.[2];
        subErrHandlers.forEach((h: any) => {
          h({ correlationKey });
        });
      }

      await expect(subPromise).rejects.toThrow('Subscribe failed');
    });

    it('should subscribe with custom timeout option', async () => {
      handlers = {};
      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      const callback = vi.fn();
      const subPromise = service.subscribe('/topic/rates', callback, { timeout: 5000 });

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate SUBSCRIPTION_OK
      const subOkHandlers = handlers['6'];
      if (subOkHandlers) {
        const correlationKey = mockSession.subscribe.mock.calls[0]?.[2];
        subOkHandlers.forEach((h: any) => {
          h({ correlationKey });
        });
      }

      const subscription = await subPromise;
      expect(subscription).toBeDefined();

      // Verify that subscribe was called with the custom timeout
      expect(mockSession.subscribe).toHaveBeenCalledWith(
        expect.anything(),
        true,
        expect.any(String),
        5000
      );
    });
  });

  describe('request - success and error paths', () => {
    let handlers: Record<string, any[]>;

    beforeEach(async () => {
      service.initialize(config);

      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();

      handlers = {};
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      const connectPromise = service.connect();
      await new Promise((resolve) => setTimeout(resolve, 0));
      const upHandlers = handlers['1'];
      if (upHandlers) upHandlers.forEach((h: any) => h());
      await connectPromise;
    });

    it('should send request and resolve with reply', async () => {
      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();

      // Mock sendRequest to invoke the success callback
      mockSession.sendRequest.mockImplementation(
        (msg: any, timeout: number, onSuccess: any, onError: any, correlationKey: any) => {
          const replyMessage = {
            getBinaryAttachment: () => '{"result":"ok","value":42}',
            getDestination: () => ({ getName: () => '/topic/reply' }),
            getSenderTimestamp: () => 1700000000000,
          };
          onSuccess(null, replyMessage);
        }
      );

      const reply = await service.request('/topic/query', { query: 'test' });

      expect(reply).toBeDefined();
      expect(reply.data).toEqual({ result: 'ok', value: 42 });
      expect(reply.topic).toBe('/topic/reply');
    });

    it('should send request with string message', async () => {
      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();

      mockSession.sendRequest.mockImplementation(
        (msg: any, timeout: number, onSuccess: any) => {
          const replyMessage = {
            getBinaryAttachment: () => '{"result":"ok"}',
            getDestination: () => ({ getName: () => '/topic/reply' }),
            getSenderTimestamp: () => null,
          };
          onSuccess(null, replyMessage);
        }
      );

      const reply = await service.request('/topic/query', 'simple-query');
      expect(reply).toBeDefined();
      expect(reply.data).toEqual({ result: 'ok' });
    });

    it('should reject request on error callback with infoStr', async () => {
      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();

      mockSession.sendRequest.mockImplementation(
        (msg: any, timeout: number, onSuccess: any, onError: any) => {
          onError(null, { infoStr: 'Request timeout' });
        }
      );

      await expect(
        service.request('/topic/query', { query: 'test' })
      ).rejects.toThrow('Request timeout');
    });

    it('should reject request on error callback with string error', async () => {
      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();

      mockSession.sendRequest.mockImplementation(
        (msg: any, timeout: number, onSuccess: any, onError: any) => {
          onError(null, 'Some error occurred');
        }
      );

      await expect(
        service.request('/topic/query', { query: 'test' })
      ).rejects.toThrow('Some error occurred');
    });

    it('should reject request on null error with default message', async () => {
      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();

      mockSession.sendRequest.mockImplementation(
        (msg: any, timeout: number, onSuccess: any, onError: any) => {
          onError(null, null);
        }
      );

      await expect(
        service.request('/topic/query', { query: 'test' })
      ).rejects.toThrow('Request failed');
    });

    it('should request with custom timeout', async () => {
      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();

      mockSession.sendRequest.mockImplementation(
        (msg: any, timeout: number, onSuccess: any) => {
          const replyMessage = {
            getBinaryAttachment: () => '{"result":"ok"}',
            getDestination: () => ({ getName: () => '/topic/reply' }),
            getSenderTimestamp: () => null,
          };
          onSuccess(null, replyMessage);
        }
      );

      const reply = await service.request('/topic/query', { query: 'test' }, 5000);
      expect(reply).toBeDefined();
      expect(mockSession.sendRequest).toHaveBeenCalledWith(
        expect.anything(),
        5000,
        expect.any(Function),
        expect.any(Function),
        undefined
      );
    });
  });

  describe('handleSolaceMessage and topicMatches', () => {
    let handlers: Record<string, any[]>;

    beforeEach(async () => {
      service.initialize(config);

      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();

      handlers = {};
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      const connectPromise = service.connect();
      await new Promise((resolve) => setTimeout(resolve, 0));
      const upHandlers = handlers['1'];
      if (upHandlers) upHandlers.forEach((h: any) => h());
      await connectPromise;
    });

    it('should route message to matching subscription callback', async () => {
      // First subscribe
      handlers = {};
      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      const callback = vi.fn();
      const subPromise = service.subscribe('/topic/rates', callback);

      await new Promise((resolve) => setTimeout(resolve, 0));

      const subOkHandlers = handlers['6'];
      if (subOkHandlers) {
        const correlationKey = mockSession.subscribe.mock.calls[0]?.[2];
        subOkHandlers.forEach((h: any) => h({ correlationKey }));
      }

      await subPromise;

      // Now invoke the message handler directly
      const anyService = service as any;
      anyService.handleSolaceMessage({
        getBinaryAttachment: () => '{"symbol":"2Y","rate":4.5}',
        getDestination: () => ({ getName: () => '/topic/rates' }),
        getSenderTimestamp: () => 1700000000000,
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0].data).toEqual({ symbol: '2Y', rate: 4.5 });
      expect(callback.mock.calls[0][0].topic).toBe('/topic/rates');
    });

    it('should match wildcard topics (ending with >)', async () => {
      handlers = {};
      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      const callback = vi.fn();
      const subPromise = service.subscribe('rates/>', callback);

      await new Promise((resolve) => setTimeout(resolve, 0));

      const subOkHandlers = handlers['6'];
      if (subOkHandlers) {
        const correlationKey = mockSession.subscribe.mock.calls[0]?.[2];
        subOkHandlers.forEach((h: any) => h({ correlationKey }));
      }

      await subPromise;

      const anyService = service as any;

      // Should match 'rates/us10y' against 'rates/>'
      anyService.handleSolaceMessage({
        getBinaryAttachment: () => '{"symbol":"10Y"}',
        getDestination: () => ({ getName: () => 'rates/us10y' }),
        getSenderTimestamp: () => null,
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should match wildcard prefix exactly (without trailing slash)', async () => {
      const anyService = service as any;

      // topicMatches('rates/>', 'rates/') => should match (prefix is 'rates/')
      expect(anyService.topicMatches('rates/>', 'rates/')).toBe(true);

      // topicMatches('rates/>', 'rates') => should match (receivedTopic === prefix without >)
      // prefix = 'rates/', receivedTopic = 'rates' => 'rates' !== 'rates/' and doesn't startWith 'rates/'
      // Actually: prefix is 'rates/' (from 'rates/>' slicing off '>'), so 'rates' does NOT start with 'rates/'
      // Let's verify the actual behavior
      const result = anyService.topicMatches('rates/>', 'rates');
      // 'rates' does not equal 'rates/' and does not start with 'rates/'
      expect(result).toBe(false);
    });

    it('should not match non-matching topic', async () => {
      const anyService = service as any;
      expect(anyService.topicMatches('/topic/rates', '/topic/fx')).toBe(false);
    });

    it('should not invoke callback for non-matching topics', async () => {
      handlers = {};
      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      const callback = vi.fn();
      const subPromise = service.subscribe('/topic/rates', callback);

      await new Promise((resolve) => setTimeout(resolve, 0));

      const subOkHandlers = handlers['6'];
      if (subOkHandlers) {
        const correlationKey = mockSession.subscribe.mock.calls[0]?.[2];
        subOkHandlers.forEach((h: any) => h({ correlationKey }));
      }

      await subPromise;

      const anyService = service as any;
      anyService.handleSolaceMessage({
        getBinaryAttachment: () => '{"pair":"EURUSD"}',
        getDestination: () => ({ getName: () => '/topic/fx' }),
        getSenderTimestamp: () => null,
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle errors in callback during message processing', async () => {
      handlers = {};
      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      const childLogger = mockLogger.child.mock.results[0].value;
      const callback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });

      const subPromise = service.subscribe('/topic/rates', callback);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const subOkHandlers = handlers['6'];
      if (subOkHandlers) {
        const correlationKey = mockSession.subscribe.mock.calls[0]?.[2];
        subOkHandlers.forEach((h: any) => h({ correlationKey }));
      }

      await subPromise;

      const anyService = service as any;
      anyService.handleSolaceMessage({
        getBinaryAttachment: () => '{"symbol":"2Y"}',
        getDestination: () => ({ getName: () => '/topic/rates' }),
        getSenderTimestamp: () => null,
      });

      expect(childLogger.error).toHaveBeenCalled();
    });

    it('should handle message with no destination', async () => {
      const anyService = service as any;

      // When getDestination returns undefined
      anyService.handleSolaceMessage({
        getBinaryAttachment: () => '{}',
        getDestination: () => undefined,
        getSenderTimestamp: () => null,
      });

      // Should not crash - no matching subscription
    });
  });

  describe('transformSolaceMessage', () => {
    let handlers: Record<string, any[]>;

    beforeEach(async () => {
      service.initialize(config);

      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();

      handlers = {};
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      const connectPromise = service.connect();
      await new Promise((resolve) => setTimeout(resolve, 0));
      const upHandlers = handlers['1'];
      if (upHandlers) upHandlers.forEach((h: any) => h());
      await connectPromise;
    });

    it('should handle null binary attachment', () => {
      const anyService = service as any;
      const result = anyService.transformSolaceMessage({
        getBinaryAttachment: () => null,
        getDestination: () => ({ getName: () => '/topic/test' }),
        getSenderTimestamp: () => null,
      });

      expect(result.data).toEqual({});
      expect(result.topic).toBe('/topic/test');
    });

    it('should handle Uint8Array binary attachment', () => {
      const anyService = service as any;
      const encoder = new TextEncoder();
      const result = anyService.transformSolaceMessage({
        getBinaryAttachment: () => encoder.encode('{"value":123}'),
        getDestination: () => ({ getName: () => '/topic/test' }),
        getSenderTimestamp: () => null,
      });

      expect(result.data).toEqual({ value: 123 });
    });

    it('should handle ArrayBuffer binary attachment', () => {
      const anyService = service as any;
      const encoder = new TextEncoder();
      const buffer = encoder.encode('{"key":"val"}').buffer;
      const result = anyService.transformSolaceMessage({
        getBinaryAttachment: () => buffer,
        getDestination: () => ({ getName: () => '/topic/test' }),
        getSenderTimestamp: () => null,
      });

      expect(result.data).toEqual({ key: 'val' });
    });

    it('should handle non-JSON string data gracefully', () => {
      const anyService = service as any;
      const result = anyService.transformSolaceMessage({
        getBinaryAttachment: () => 'not-json-data',
        getDestination: () => ({ getName: () => '/topic/test' }),
        getSenderTimestamp: () => null,
      });

      expect(result.data).toBe('not-json-data');
    });

    it('should use sender timestamp when available', () => {
      const anyService = service as any;
      const ts = 1700000000000;
      const result = anyService.transformSolaceMessage({
        getBinaryAttachment: () => '{"a":1}',
        getDestination: () => ({ getName: () => '/topic/test' }),
        getSenderTimestamp: () => ts,
      });

      expect(result.timestamp).toEqual(new Date(ts));
    });

    it('should use current timestamp when sender timestamp is null', () => {
      const anyService = service as any;
      const before = Date.now();
      const result = anyService.transformSolaceMessage({
        getBinaryAttachment: () => '{"a":1}',
        getDestination: () => ({ getName: () => '/topic/test' }),
        getSenderTimestamp: () => null,
      });
      const after = Date.now();

      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(after);
    });

    it('should handle empty string binary attachment', () => {
      const anyService = service as any;
      const result = anyService.transformSolaceMessage({
        getBinaryAttachment: () => '',
        getDestination: () => ({ getName: () => '/topic/test' }),
        getSenderTimestamp: () => null,
      });

      expect(result.data).toEqual({});
    });

    it('should handle missing getDestination', () => {
      const anyService = service as any;
      const result = anyService.transformSolaceMessage({
        getBinaryAttachment: () => '{"a":1}',
        getDestination: undefined,
        getSenderTimestamp: () => null,
      });

      expect(result.topic).toBe('');
    });

    it('should include raw message in result', () => {
      const anyService = service as any;
      const msg = {
        getBinaryAttachment: () => '{"a":1}',
        getDestination: () => ({ getName: () => '/topic/test' }),
        getSenderTimestamp: () => null,
      };
      const result = anyService.transformSolaceMessage(msg);

      expect(result.raw).toBe(msg);
    });
  });

  describe('unsubscribeById', () => {
    let handlers: Record<string, any[]>;

    beforeEach(async () => {
      service.initialize(config);

      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();

      handlers = {};
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      const connectPromise = service.connect();
      await new Promise((resolve) => setTimeout(resolve, 0));
      const upHandlers = handlers['1'];
      if (upHandlers) upHandlers.forEach((h: any) => h());
      await connectPromise;
    });

    it('should unsubscribe successfully with SUBSCRIPTION_OK', async () => {
      // First subscribe
      handlers = {};
      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      const callback = vi.fn();
      const subPromise = service.subscribe('/topic/rates', callback);

      await new Promise((resolve) => setTimeout(resolve, 0));

      const subOkHandlers = handlers['6'];
      if (subOkHandlers) {
        const correlationKey = mockSession.subscribe.mock.calls[0]?.[2];
        subOkHandlers.forEach((h: any) => h({ correlationKey }));
      }

      const subscription = await subPromise;

      // Now unsubscribe
      handlers = {};
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      const unsubPromise = subscription.unsubscribe();

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate SUBSCRIPTION_OK for unsubscribe
      const unsubOkHandlers = handlers['6'];
      if (unsubOkHandlers) {
        const correlationKey = mockSession.unsubscribe.mock.calls[0]?.[2];
        unsubOkHandlers.forEach((h: any) => h({ correlationKey }));
      }

      await unsubPromise;

      // After unsubscribe, calling again should be a no-op
      await expect(subscription.unsubscribe()).resolves.toBeUndefined();
    });

    it('should handle unsubscribe SUBSCRIPTION_ERROR gracefully', async () => {
      handlers = {};
      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      const callback = vi.fn();
      const subPromise = service.subscribe('/topic/rates', callback);

      await new Promise((resolve) => setTimeout(resolve, 0));

      const subOkHandlers = handlers['6'];
      if (subOkHandlers) {
        const correlationKey = mockSession.subscribe.mock.calls[0]?.[2];
        subOkHandlers.forEach((h: any) => h({ correlationKey }));
      }

      const subscription = await subPromise;

      // Now unsubscribe with error
      handlers = {};
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      const unsubPromise = subscription.unsubscribe();

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate SUBSCRIPTION_ERROR for unsubscribe
      const unsubErrHandlers = handlers['7'];
      if (unsubErrHandlers) {
        const correlationKey = mockSession.unsubscribe.mock.calls[0]?.[2];
        unsubErrHandlers.forEach((h: any) => h({ correlationKey }));
      }

      // Should still resolve (errors in unsubscribe resolve, not reject)
      await unsubPromise;
    });

    it('should handle unsubscribe timeout', async () => {
      vi.useFakeTimers();

      try {
        handlers = {};
        const solaceModule = await import('solclientjs');
        const mockSession = (solaceModule as any).default.SolclientFactory.createSession();
        mockSession.on.mockImplementation((event: string, handler: any) => {
          if (!handlers[event]) handlers[event] = [];
          handlers[event].push(handler);
          return mockSession;
        });

        const callback = vi.fn();
        const subPromise = service.subscribe('/topic/rates', callback);

        await vi.advanceTimersByTimeAsync(0);

        const subOkHandlers = handlers['6'];
        if (subOkHandlers) {
          const correlationKey = mockSession.subscribe.mock.calls[0]?.[2];
          subOkHandlers.forEach((h: any) => h({ correlationKey }));
        }

        const subscription = await subPromise;

        // Now unsubscribe without any response
        handlers = {};
        mockSession.on.mockImplementation((event: string, handler: any) => {
          if (!handlers[event]) handlers[event] = [];
          handlers[event].push(handler);
          return mockSession;
        });

        const unsubPromise = subscription.unsubscribe();

        // Advance timer past the timeout (10000ms)
        await vi.advanceTimersByTimeAsync(10001);

        // Should resolve after timeout
        await unsubPromise;
      } finally {
        vi.useRealTimers();
      }
    });

    it('should handle unsubscribe when session throws and notify error', async () => {
      handlers = {};
      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      const callback = vi.fn();
      const subPromise = service.subscribe('/topic/rates', callback);

      await new Promise((resolve) => setTimeout(resolve, 0));

      const subOkHandlers = handlers['6'];
      if (subOkHandlers) {
        const correlationKey = mockSession.subscribe.mock.calls[0]?.[2];
        subOkHandlers.forEach((h: any) => h({ correlationKey }));
      }

      const subscription = await subPromise;

      // Make createTopicDestination throw
      const factory = (solaceModule as any).default.SolclientFactory;
      factory.createTopicDestination.mockImplementationOnce(() => {
        throw new Error('Invalid topic');
      });

      const errorCallback = vi.fn();
      service.onError(errorCallback);

      await expect(subscription.unsubscribe()).rejects.toThrow('Invalid topic');
      expect(errorCallback).toHaveBeenCalled();
      expect(errorCallback.mock.calls[0][0].code).toBe('SOLACE_UNSUBSCRIBE_ERROR');
    });
  });

  describe('disconnect - error path', () => {
    let handlers: Record<string, any[]>;

    beforeEach(async () => {
      service.initialize(config);

      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();

      handlers = {};
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      const connectPromise = service.connect();
      await new Promise((resolve) => setTimeout(resolve, 0));
      const upHandlers = handlers['1'];
      if (upHandlers) upHandlers.forEach((h: any) => h());
      await connectPromise;
    });

    it('should handle DOWN_ERROR during disconnect', async () => {
      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();

      const disconnectHandlers: Record<string, any[]> = {};
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!disconnectHandlers[event]) disconnectHandlers[event] = [];
        disconnectHandlers[event].push(handler);
        return mockSession;
      });

      const errorCallback = vi.fn();
      service.onError(errorCallback);

      const disconnectPromise = service.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate DOWN_ERROR event (event code 8)
      const downErrHandlers = disconnectHandlers['8'];
      if (downErrHandlers) {
        downErrHandlers.forEach((h: any) => h({ infoStr: 'Connection down' }));
      }

      await expect(disconnectPromise).rejects.toThrow('Connection down');
      expect(errorCallback).toHaveBeenCalled();
      expect(errorCallback.mock.calls[0][0].code).toBe('SOLACE_DISCONNECT_ERROR');
    });

    it('should handle DOWN_ERROR with default message during disconnect', async () => {
      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();

      const disconnectHandlers: Record<string, any[]> = {};
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!disconnectHandlers[event]) disconnectHandlers[event] = [];
        disconnectHandlers[event].push(handler);
        return mockSession;
      });

      const disconnectPromise = service.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const downErrHandlers = disconnectHandlers['8'];
      if (downErrHandlers) {
        downErrHandlers.forEach((h: any) => h({}));
      }

      await expect(disconnectPromise).rejects.toThrow('Solace disconnect error');
    });

    it('should handle dispose error during disconnect gracefully', async () => {
      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();
      const childLogger = mockLogger.child.mock.results[0].value;

      // Make dispose throw
      mockSession.dispose.mockImplementationOnce(() => {
        throw new Error('Dispose error');
      });

      const disconnectHandlers: Record<string, any[]> = {};
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!disconnectHandlers[event]) disconnectHandlers[event] = [];
        disconnectHandlers[event].push(handler);
        return mockSession;
      });

      const disconnectPromise = service.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate DISCONNECTED event
      const discHandlers = disconnectHandlers['3'];
      if (discHandlers) {
        discHandlers.forEach((h: any) => h());
      }

      await disconnectPromise;

      // Should have warned about dispose error
      expect(childLogger.warn).toHaveBeenCalled();
    });

    it('should unsubscribe all subscriptions during disconnect', async () => {
      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();

      // First subscribe
      handlers = {};
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      const callback = vi.fn();
      const subPromise = service.subscribe('/topic/rates', callback);

      await new Promise((resolve) => setTimeout(resolve, 0));

      const subOkHandlers = handlers['6'];
      if (subOkHandlers) {
        const correlationKey = mockSession.subscribe.mock.calls[0]?.[2];
        subOkHandlers.forEach((h: any) => h({ correlationKey }));
      }

      await subPromise;

      // Now disconnect - this should unsubscribe all
      const disconnectHandlers: Record<string, any[]> = {};
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!disconnectHandlers[event]) disconnectHandlers[event] = [];
        disconnectHandlers[event].push(handler);
        return mockSession;
      });

      const disconnectPromise = service.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Handle unsubscribe OK
      const unsubOkHandlers = disconnectHandlers['6'];
      if (unsubOkHandlers) {
        const correlationKey = mockSession.unsubscribe.mock.calls[0]?.[2];
        unsubOkHandlers.forEach((h: any) => h({ correlationKey }));
      }

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate DISCONNECTED
      const discHandlers = disconnectHandlers['3'];
      if (discHandlers) {
        discHandlers.forEach((h: any) => h());
      }

      await disconnectPromise;
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('session events during connection', () => {
    it('should handle DISCONNECTED session event', async () => {
      service.initialize(config);

      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();

      const handlers: Record<string, any[]> = {};
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      const connectPromise = service.connect();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate DISCONNECTED (event code 3) during connect
      const disconnectedHandlers = handlers['3'];
      if (disconnectedHandlers) {
        disconnectedHandlers.forEach((h: any) => h());
      }

      expect(service.getConnectionStatus()).toBe(ConnectionStatus.Disconnected);

      // Now fire UP_NOTICE to complete connection
      const upHandlers = handlers['1'];
      if (upHandlers) upHandlers.forEach((h: any) => h());
      await connectPromise;
    });

    it('should handle RECONNECTING_NOTICE session event', async () => {
      service.initialize(config);

      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();

      const handlers: Record<string, any[]> = {};
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      const connectPromise = service.connect();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate RECONNECTING_NOTICE (event code 4)
      const reconnectingHandlers = handlers['4'];
      if (reconnectingHandlers) {
        reconnectingHandlers.forEach((h: any) => h());
      }

      expect(service.getConnectionStatus()).toBe(ConnectionStatus.Reconnecting);

      // Complete connection
      const upHandlers = handlers['1'];
      if (upHandlers) upHandlers.forEach((h: any) => h());
      await connectPromise;
    });

    it('should handle RECONNECTED_NOTICE session event', async () => {
      service.initialize(config);

      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();

      const handlers: Record<string, any[]> = {};
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      const connectPromise = service.connect();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate RECONNECTED_NOTICE (event code 5)
      const reconnectedHandlers = handlers['5'];
      if (reconnectedHandlers) {
        reconnectedHandlers.forEach((h: any) => h());
      }

      expect(service.getConnectionStatus()).toBe(ConnectionStatus.Connected);

      // Complete connection
      const upHandlers = handlers['1'];
      if (upHandlers) upHandlers.forEach((h: any) => h());
      await connectPromise;
    });

    it('should handle CONNECT_FAILED_ERROR with default message', async () => {
      service.initialize(config);

      const solaceModule = await import('solclientjs');
      const mockSession = (solaceModule as any).default.SolclientFactory.createSession();

      const handlers: Record<string, any[]> = {};
      mockSession.on.mockImplementation((event: string, handler: any) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockSession;
      });

      const connectPromise = service.connect();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate CONNECT_FAILED_ERROR with no infoStr
      const failedHandlers = handlers['2'];
      if (failedHandlers) {
        failedHandlers.forEach((h: any) => h({}));
      }

      await expect(connectPromise).rejects.toThrow('Solace connection failed');
    });
  });
});
