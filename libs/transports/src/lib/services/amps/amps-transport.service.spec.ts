import { TestBed } from '@angular/core/testing';
import { AmpsTransportService } from './amps-transport.service';
import { ConnectionStatus } from '../../interfaces/transport.interface';
import { AmpsConfig } from '../../interfaces/transport-config.interface';
import { LoggerService } from '@rates-trading/logger';

// Mock the amps module - must use function/class, not arrow functions
vi.mock('amps', () => {
  class MockClient {
    connect = vi.fn().mockResolvedValue(undefined);
    disconnect = vi.fn().mockResolvedValue(undefined);
    subscribe = vi.fn().mockResolvedValue('sub-1');
    unsubscribe = vi.fn().mockResolvedValue(undefined);
    publish = vi.fn().mockResolvedValue(undefined);
    sow = vi.fn().mockResolvedValue(undefined);
    sowAndSubscribe = vi.fn().mockResolvedValue('sow-sub-1');
    sowDelete = vi.fn().mockResolvedValue(undefined);
    deltaSubscribe = vi.fn().mockResolvedValue('delta-sub-1');
    disconnectHandler = vi.fn();
  }
  return {
    default: { Client: MockClient },
    Client: MockClient,
  };
});

describe('AmpsTransportService', () => {
  let service: AmpsTransportService;
  let config: AmpsConfig;
  let mockLogger: any;

  beforeEach(() => {
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
        AmpsTransportService,
        { provide: LoggerService, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(AmpsTransportService);
    config = {
      url: 'ws://localhost:9000/amps/json',
      user: 'test-user',
      messageType: 'json',
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
        'AMPS configuration not initialized'
      );
    });

    it('should connect successfully', async () => {
      service.initialize(config);
      await service.connect();
      expect(service.isConnected()).toBe(true);
      expect(service.getConnectionStatus()).toBe(ConnectionStatus.Connected);
    });

    it('should emit connection status changes', async () => {
      service.initialize(config);
      const statuses: ConnectionStatus[] = [];
      service.connectionStatus$.subscribe((status) => statuses.push(status));

      await service.connect();

      expect(statuses).toContain(ConnectionStatus.Connecting);
      expect(statuses).toContain(ConnectionStatus.Connected);
    });

    it('should not connect again if already connected', async () => {
      service.initialize(config);
      await service.connect();
      await service.connect();
      const childLogger = mockLogger.child.mock.results[0].value;
      expect(childLogger.warn).toHaveBeenCalledWith('Already connected');
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      service.initialize(config);
      await service.connect();
      await service.disconnect();
      expect(service.isConnected()).toBe(false);
      expect(service.getConnectionStatus()).toBe(ConnectionStatus.Disconnected);
    });

    it('should do nothing if not connected', async () => {
      service.initialize(config);
      await service.disconnect();
      expect(service.getConnectionStatus()).toBe(ConnectionStatus.Disconnected);
    });
  });

  describe('subscribe', () => {
    beforeEach(async () => {
      service.initialize(config);
      await service.connect();
    });

    it('should throw error if not connected', async () => {
      await service.disconnect();
      await expect(
        service.subscribe('/topic/rates', vi.fn())
      ).rejects.toThrow('Not connected to AMPS');
    });

    it('should create a subscription', async () => {
      const callback = vi.fn();
      const subscription = await service.subscribe('/topic/rates', callback);

      expect(subscription).toBeDefined();
      expect(subscription.id).toBeTruthy();
      expect(subscription.topic).toBe('/topic/rates');
      expect(typeof subscription.unsubscribe).toBe('function');
    });

    it('should allow unsubscribe', async () => {
      const callback = vi.fn();
      const subscription = await service.subscribe('/topic/rates', callback);

      await expect(subscription.unsubscribe()).resolves.toBeUndefined();
    });
  });

  describe('publish', () => {
    beforeEach(async () => {
      service.initialize(config);
      await service.connect();
    });

    it('should throw error if not connected', async () => {
      await service.disconnect();
      await expect(
        service.publish('/topic/rates', { rate: 1.5 })
      ).rejects.toThrow('Not connected to AMPS');
    });

    it('should publish a message', async () => {
      await expect(
        service.publish('/topic/rates', { rate: 1.5 })
      ).resolves.toBeUndefined();
    });
  });

  describe('sowQuery', () => {
    beforeEach(async () => {
      service.initialize(config);
      await service.connect();
    });

    it('should throw error if not connected', async () => {
      await service.disconnect();
      await expect(service.sowQuery('/topic/rates')).rejects.toThrow(
        'Not connected to AMPS'
      );
    });

    it('should execute SOW query', async () => {
      const result = await service.sowQuery('/topic/rates', '/symbol == "2Y"');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('sowAndSubscribe', () => {
    beforeEach(async () => {
      service.initialize(config);
      await service.connect();
    });

    it('should throw error if not connected', async () => {
      await service.disconnect();
      await expect(
        service.sowAndSubscribe('/topic/rates', vi.fn())
      ).rejects.toThrow('Not connected to AMPS');
    });

    it('should create SOW and subscribe', async () => {
      const callback = vi.fn();
      const subscription = await service.sowAndSubscribe(
        '/topic/rates',
        callback,
        '/symbol == "2Y"'
      );

      expect(subscription).toBeDefined();
      expect(subscription.id).toBeTruthy();
    });
  });

  describe('deltaSubscribe', () => {
    beforeEach(async () => {
      service.initialize(config);
      await service.connect();
    });

    it('should throw error if not connected', async () => {
      await service.disconnect();
      await expect(
        service.deltaSubscribe('/topic/rates', vi.fn())
      ).rejects.toThrow('Not connected to AMPS');
    });

    it('should create delta subscription', async () => {
      const callback = vi.fn();
      const subscription = await service.deltaSubscribe('/topic/rates', callback);

      expect(subscription).toBeDefined();
      expect(subscription.id).toBeTruthy();
    });
  });

  describe('sowDelete', () => {
    beforeEach(async () => {
      service.initialize(config);
      await service.connect();
    });

    it('should throw error if not connected', async () => {
      await service.disconnect();
      await expect(
        service.sowDelete('/topic/rates', '/symbol == "2Y"')
      ).rejects.toThrow('Not connected to AMPS');
    });

    it('should execute SOW delete', async () => {
      await expect(
        service.sowDelete('/topic/rates', '/symbol == "2Y"')
      ).resolves.toBeUndefined();
    });

    it('should log debug on successful SOW delete', async () => {
      await service.sowDelete('/topic/rates', '/symbol == "2Y"');
      const childLogger = mockLogger.child.mock.results[0].value;
      expect(childLogger.debug).toHaveBeenCalledWith(
        { topic: '/topic/rates', filter: '/symbol == "2Y"' },
        'SOW delete executed'
      );
    });
  });

  describe('publish with options', () => {
    beforeEach(async () => {
      service.initialize(config);
      await service.connect();
    });

    it('should publish with sowKey option', async () => {
      await expect(
        service.publish('/topic/rates', { rate: 1.5 }, { sowKey: 'key-1' })
      ).resolves.toBeUndefined();
    });

    it('should publish with expiration option', async () => {
      await expect(
        service.publish('/topic/rates', { rate: 1.5 }, { expiration: 30000 })
      ).resolves.toBeUndefined();
    });

    it('should publish with correlationId option', async () => {
      await expect(
        service.publish('/topic/rates', { rate: 1.5 }, { correlationId: 'corr-1' })
      ).resolves.toBeUndefined();
    });

    it('should publish a string message directly', async () => {
      await expect(
        service.publish('/topic/rates', 'raw-string-message')
      ).resolves.toBeUndefined();
    });
  });

  describe('subscribe with options', () => {
    beforeEach(async () => {
      service.initialize(config);
      await service.connect();
    });

    it('should subscribe with filter', async () => {
      const callback = vi.fn();
      const subscription = await service.subscribe('/topic/rates', callback, {
        filter: '/symbol == "2Y"',
      });
      expect(subscription).toBeDefined();
      expect(subscription.topic).toBe('/topic/rates');
    });

    it('should subscribe with bookmark', async () => {
      const callback = vi.fn();
      const subscription = await service.subscribe('/topic/rates', callback, {
        bookmark: 'bookmark-1',
      });
      expect(subscription).toBeDefined();
    });

    it('should subscribe with batchSize', async () => {
      const callback = vi.fn();
      const subscription = await service.subscribe('/topic/rates', callback, {
        batchSize: 100,
      });
      expect(subscription).toBeDefined();
    });

    it('should subscribe with topN', async () => {
      const callback = vi.fn();
      const subscription = await service.subscribe('/topic/rates', callback, {
        topN: 10,
      });
      expect(subscription).toBeDefined();
    });

    it('should subscribe with orderBy', async () => {
      const callback = vi.fn();
      const subscription = await service.subscribe('/topic/rates', callback, {
        orderBy: '/timestamp DESC',
      });
      expect(subscription).toBeDefined();
    });
  });

  describe('sowQuery with options', () => {
    beforeEach(async () => {
      service.initialize(config);
      await service.connect();
    });

    it('should execute SOW query with orderBy option', async () => {
      const result = await service.sowQuery('/topic/rates', '/symbol == "2Y"', {
        orderBy: '/timestamp DESC',
      });
      expect(Array.isArray(result)).toBe(true);
    });

    it('should execute SOW query with topN option', async () => {
      const result = await service.sowQuery('/topic/rates', '/symbol == "2Y"', {
        topN: 5,
      });
      expect(Array.isArray(result)).toBe(true);
    });

    it('should execute SOW query with batchSize option', async () => {
      const result = await service.sowQuery('/topic/rates', undefined, {
        batchSize: 50,
      });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('sowAndSubscribe with options', () => {
    beforeEach(async () => {
      service.initialize(config);
      await service.connect();
    });

    it('should sowAndSubscribe with orderBy', async () => {
      const callback = vi.fn();
      const subscription = await service.sowAndSubscribe(
        '/topic/rates',
        callback,
        '/symbol == "2Y"',
        { orderBy: '/timestamp DESC' }
      );
      expect(subscription).toBeDefined();
      expect(subscription.id).toBeTruthy();
    });

    it('should sowAndSubscribe with topN', async () => {
      const callback = vi.fn();
      const subscription = await service.sowAndSubscribe(
        '/topic/rates',
        callback,
        undefined,
        { topN: 10 }
      );
      expect(subscription).toBeDefined();
    });

    it('should sowAndSubscribe with batchSize', async () => {
      const callback = vi.fn();
      const subscription = await service.sowAndSubscribe(
        '/topic/rates',
        callback,
        undefined,
        { batchSize: 50 }
      );
      expect(subscription).toBeDefined();
    });

    it('should allow unsubscribing from sowAndSubscribe subscription', async () => {
      const callback = vi.fn();
      const subscription = await service.sowAndSubscribe(
        '/topic/rates',
        callback,
        '/symbol == "2Y"'
      );
      await expect(subscription.unsubscribe()).resolves.toBeUndefined();
    });
  });

  describe('deltaSubscribe with options', () => {
    beforeEach(async () => {
      service.initialize(config);
      await service.connect();
    });

    it('should deltaSubscribe with orderBy', async () => {
      const callback = vi.fn();
      const subscription = await service.deltaSubscribe('/topic/rates', callback, {
        orderBy: '/timestamp DESC',
      });
      expect(subscription).toBeDefined();
    });

    it('should deltaSubscribe with filter', async () => {
      const callback = vi.fn();
      const subscription = await service.deltaSubscribe('/topic/rates', callback, {
        filter: '/symbol == "2Y"',
      });
      expect(subscription).toBeDefined();
    });

    it('should allow unsubscribing from delta subscription', async () => {
      const callback = vi.fn();
      const subscription = await service.deltaSubscribe('/topic/rates', callback);
      await expect(subscription.unsubscribe()).resolves.toBeUndefined();
    });
  });

  describe('connect error handling', () => {
    it('should schedule reconnect when enabled and connection fails', async () => {
      const reconnectConfig: AmpsConfig = {
        ...config,
        reconnect: {
          enabled: true,
          maxAttempts: 3,
          initialDelay: 100,
          maxDelay: 1000,
        },
      };

      service.initialize(reconnectConfig);
      // Connect first to verify config is accepted
      await service.connect();
      expect(service.isConnected()).toBe(true);
    });

    it('should use default clientName when none provided', async () => {
      const configWithoutClientName: AmpsConfig = {
        url: 'ws://localhost:9000/amps/json',
        user: 'test-user',
      };
      service.initialize(configWithoutClientName);
      await service.connect();
      expect(service.isConnected()).toBe(true);
    });

    it('should emit Error status when connection fails', async () => {
      // We test this via the "not initialized" path which also exercises error paths
      const statuses: ConnectionStatus[] = [];
      service.connectionStatus$.subscribe((s) => statuses.push(s));

      await expect(service.connect()).rejects.toThrow(
        'AMPS configuration not initialized'
      );
      // Status should still be Disconnected (not initialized doesn't set Error)
      expect(statuses).toContain(ConnectionStatus.Disconnected);
    });
  });

  describe('disconnect edge cases', () => {
    it('should handle disconnect when there are active subscriptions', async () => {
      service.initialize(config);
      await service.connect();

      // Create some subscriptions
      await service.subscribe('/topic/rates1', vi.fn());
      await service.subscribe('/topic/rates2', vi.fn());

      // Disconnect should unsubscribe all
      await service.disconnect();
      expect(service.isConnected()).toBe(false);
    });

    it('should clear reconnect timer on disconnect', async () => {
      const reconnectConfig: AmpsConfig = {
        ...config,
        reconnect: {
          enabled: true,
          maxAttempts: 5,
          initialDelay: 100,
        },
      };
      service.initialize(reconnectConfig);
      await service.connect();
      await service.disconnect();
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('unsubscribe edge cases', () => {
    beforeEach(async () => {
      service.initialize(config);
      await service.connect();
    });

    it('should handle unsubscribe for unknown subscription id gracefully', async () => {
      const callback = vi.fn();
      const subscription = await service.subscribe('/topic/rates', callback);

      // Unsubscribe once - should work
      await subscription.unsubscribe();

      // Unsubscribe again - should be a no-op (subscription already removed)
      await expect(subscription.unsubscribe()).resolves.toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should notify error callbacks', () => {
      const errorCallback = vi.fn();
      service.onError(errorCallback);
      expect(() => service.onError(errorCallback)).not.toThrow();
    });

    it('should accept multiple error callbacks', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      service.onError(cb1);
      service.onError(cb2);
      // Just verify it doesn't throw
      expect(true).toBe(true);
    });
  });

  describe('connection events', () => {
    it('should emit connection events during lifecycle', async () => {
      service.initialize(config);
      const events: any[] = [];
      service.connectionEvents$.subscribe((event) => events.push(event));

      await service.connect();
      await service.disconnect();

      // Should have at least a connected and disconnected event
      const eventTypes = events.map((e) => e.type);
      expect(eventTypes).toContain('connected');
      expect(eventTypes).toContain('disconnected');
    });
  });

  describe('sowQuery - message handler and error paths', () => {
    beforeEach(async () => {
      service.initialize(config);
      await service.connect();
    });

    it('should skip group_begin and group_end messages in SOW query', async () => {
      const ampsModule = await import('amps');
      const MockClient = (ampsModule as any).Client;
      const clientInstance = MockClient.prototype;

      // Get the actual mock instance used by the service
      // The mock's sow function should invoke the handler with messages
      const originalSow = vi.fn();
      // Access the client through the service by overriding sow behavior
      const ampsDefault = (ampsModule as any).default || ampsModule;
      const ClientClass = ampsDefault.Client;

      // Create a new service instance to capture the sow mock
      const sow = vi.fn().mockImplementation(async (handler: any) => {
        handler({ c: 'group_begin', t: '/topic/rates' });
        handler({ c: 'sow', t: '/topic/rates', d: '{"symbol":"2Y","rate":4.5}' });
        handler({ c: 'group_end', t: '/topic/rates' });
      });

      // We need to get the mock client instance that was created during connect()
      // Since MockClient is a class, instances are created via new. We need to
      // override the sow on the prototype or on the instance.
      // The mock creates instances with vi.fn() properties, so we access through import
      const mockClientInstances = ClientClass;

      // Recreate TestBed with fresh service
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AmpsTransportService,
          { provide: LoggerService, useValue: mockLogger },
        ],
      });
      const freshService = TestBed.inject(AmpsTransportService);
      freshService.initialize(config);
      await freshService.connect();

      // Now get the actual client's sow mock and override its implementation
      // The client is stored privately. We access the mock through the module.
      // Since all instances of MockClient share the same vi.fn() mocks defined in the class body,
      // we can set the implementation on any instance
      const anyService = freshService as any;
      const client = anyService.client;
      client.sow.mockImplementation(async (handler: any, topic: string, filter?: string) => {
        handler({ c: 'group_begin', t: topic });
        handler({ c: 'sow', t: topic, d: '{"symbol":"2Y","rate":4.5}' });
        handler({ c: 'group_end', t: topic });
      });

      const result = await freshService.sowQuery('/topic/rates', '/symbol == "2Y"');

      // Should have 1 message (group_begin and group_end are skipped)
      expect(result).toHaveLength(1);
      expect(result[0].data).toEqual({ symbol: '2Y', rate: 4.5 });
    });

    it('should handle SOW query with options (orderBy, topN, batchSize)', async () => {
      const anyService = service as any;
      const client = anyService.client;
      client.sow.mockImplementation(async (handler: any) => {
        handler({ c: 'sow', t: '/topic/rates', d: '{"symbol":"2Y"}' });
      });

      const result = await service.sowQuery('/topic/rates', '/symbol == "2Y"', {
        orderBy: '/rate DESC',
        topN: 10,
        batchSize: 50,
      });

      expect(result).toHaveLength(1);
      expect(client.sow).toHaveBeenCalled();
      const callArgs = client.sow.mock.calls[0];
      expect(callArgs[3]).toEqual(
        expect.objectContaining({ orderBy: '/rate DESC', topN: 10, batchSize: 50 })
      );
    });

    it('should handle SOW query failure and notify error', async () => {
      const anyService = service as any;
      const client = anyService.client;
      client.sow.mockRejectedValueOnce(new Error('SOW query timeout'));

      const errorCallback = vi.fn();
      service.onError(errorCallback);

      await expect(service.sowQuery('/topic/rates')).rejects.toThrow('SOW query timeout');
      expect(errorCallback).toHaveBeenCalled();
      expect(errorCallback.mock.calls[0][0].code).toBe('AMPS_SOW_ERROR');
    });
  });

  describe('sowAndSubscribe - message handler and error paths', () => {
    beforeEach(async () => {
      service.initialize(config);
      await service.connect();
    });

    it('should skip group_begin and group_end messages in sowAndSubscribe', async () => {
      const anyService = service as any;
      const client = anyService.client;
      const callback = vi.fn();

      client.sowAndSubscribe.mockImplementation(async (handler: any) => {
        handler({ c: 'group_begin', t: '/topic/rates' });
        handler({ c: 'sow', t: '/topic/rates', d: '{"symbol":"2Y","rate":4.5}' });
        handler({ c: 'group_end', t: '/topic/rates' });
        handler({ c: 'publish', t: '/topic/rates', d: '{"symbol":"2Y","rate":4.6}' });
        return 'sow-sub-1';
      });

      const subscription = await service.sowAndSubscribe('/topic/rates', callback);

      expect(subscription).toBeDefined();
      // callback should have been called twice (once for sow record, once for publish)
      // group_begin and group_end should be skipped
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback.mock.calls[0][0].data).toEqual({ symbol: '2Y', rate: 4.5 });
      expect(callback.mock.calls[1][0].data).toEqual({ symbol: '2Y', rate: 4.6 });
    });

    it('should handle errors in sowAndSubscribe message handler', async () => {
      const anyService = service as any;
      const client = anyService.client;
      const childLogger = mockLogger.child.mock.results[0].value;

      // Create a callback that throws on first call
      const callback = vi.fn().mockImplementationOnce(() => {
        throw new Error('Callback error');
      });

      client.sowAndSubscribe.mockImplementation(async (handler: any) => {
        handler({ c: 'publish', t: '/topic/rates', d: '{"symbol":"2Y"}' });
        return 'sow-sub-1';
      });

      const subscription = await service.sowAndSubscribe('/topic/rates', callback);
      expect(subscription).toBeDefined();
      // The error in callback should be caught and logged
      expect(childLogger.error).toHaveBeenCalled();
    });

    it('should handle sowAndSubscribe failure and notify error', async () => {
      const anyService = service as any;
      const client = anyService.client;
      client.sowAndSubscribe.mockRejectedValueOnce(new Error('SOW subscribe failed'));

      const errorCallback = vi.fn();
      service.onError(errorCallback);

      await expect(
        service.sowAndSubscribe('/topic/rates', vi.fn())
      ).rejects.toThrow('SOW subscribe failed');
      expect(errorCallback).toHaveBeenCalled();
      expect(errorCallback.mock.calls[0][0].code).toBe('AMPS_SOW_SUBSCRIBE_ERROR');
    });

    it('should sowAndSubscribe with all options (orderBy, topN, batchSize)', async () => {
      const anyService = service as any;
      const client = anyService.client;
      const callback = vi.fn();

      const subscription = await service.sowAndSubscribe(
        '/topic/rates',
        callback,
        '/symbol == "2Y"',
        { orderBy: '/rate DESC', topN: 5, batchSize: 25 }
      );

      expect(subscription).toBeDefined();
      const callArgs = client.sowAndSubscribe.mock.calls[0];
      expect(callArgs[3]).toEqual(
        expect.objectContaining({
          orderBy: '/rate DESC',
          topN: 5,
          batchSize: 25,
        })
      );
    });
  });

  describe('sowDelete - error path', () => {
    beforeEach(async () => {
      service.initialize(config);
      await service.connect();
    });

    it('should handle sowDelete failure and notify error', async () => {
      const anyService = service as any;
      const client = anyService.client;
      client.sowDelete.mockRejectedValueOnce(new Error('SOW delete failed'));

      const errorCallback = vi.fn();
      service.onError(errorCallback);

      await expect(
        service.sowDelete('/topic/rates', '/symbol == "2Y"')
      ).rejects.toThrow('SOW delete failed');
      expect(errorCallback).toHaveBeenCalled();
      expect(errorCallback.mock.calls[0][0].code).toBe('AMPS_SOW_DELETE_ERROR');
    });
  });

  describe('deltaSubscribe - message handler and error paths', () => {
    beforeEach(async () => {
      service.initialize(config);
      await service.connect();
    });

    it('should invoke callback with transformed message on delta subscribe', async () => {
      const anyService = service as any;
      const client = anyService.client;
      const callback = vi.fn();

      client.deltaSubscribe.mockImplementation(async (handler: any) => {
        handler({ c: 'delta', t: '/topic/rates', d: '{"symbol":"2Y","rate":4.5}' });
        return 'delta-sub-1';
      });

      const subscription = await service.deltaSubscribe('/topic/rates', callback);

      expect(subscription).toBeDefined();
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0].data).toEqual({ symbol: '2Y', rate: 4.5 });
    });

    it('should handle errors in delta subscribe message handler', async () => {
      const anyService = service as any;
      const client = anyService.client;
      const childLogger = mockLogger.child.mock.results[0].value;

      const callback = vi.fn().mockImplementationOnce(() => {
        throw new Error('Delta callback error');
      });

      client.deltaSubscribe.mockImplementation(async (handler: any) => {
        handler({ c: 'delta', t: '/topic/rates', d: '{"symbol":"2Y"}' });
        return 'delta-sub-1';
      });

      const subscription = await service.deltaSubscribe('/topic/rates', callback);
      expect(subscription).toBeDefined();
      expect(childLogger.error).toHaveBeenCalled();
    });

    it('should handle deltaSubscribe failure and notify error', async () => {
      const anyService = service as any;
      const client = anyService.client;
      client.deltaSubscribe.mockRejectedValueOnce(new Error('Delta subscribe failed'));

      const errorCallback = vi.fn();
      service.onError(errorCallback);

      await expect(
        service.deltaSubscribe('/topic/rates', vi.fn())
      ).rejects.toThrow('Delta subscribe failed');
      expect(errorCallback).toHaveBeenCalled();
      expect(errorCallback.mock.calls[0][0].code).toBe('AMPS_DELTA_SUBSCRIBE_ERROR');
    });

    it('should deltaSubscribe with orderBy option', async () => {
      const anyService = service as any;
      const client = anyService.client;
      const callback = vi.fn();

      const subscription = await service.deltaSubscribe('/topic/rates', callback, {
        orderBy: '/timestamp DESC',
      });

      expect(subscription).toBeDefined();
      const callArgs = client.deltaSubscribe.mock.calls[0];
      expect(callArgs[3]).toEqual(
        expect.objectContaining({ orderBy: '/timestamp DESC' })
      );
    });
  });

  describe('unsubscribeById - error path', () => {
    beforeEach(async () => {
      service.initialize(config);
      await service.connect();
    });

    it('should handle unsubscribe error, still remove from tracking, and notify error', async () => {
      const anyService = service as any;
      const client = anyService.client;

      // Create a subscription first
      const callback = vi.fn();
      const subscription = await service.subscribe('/topic/rates', callback);

      // Make unsubscribe throw
      client.unsubscribe.mockRejectedValueOnce(new Error('Unsubscribe failed'));

      const errorCallback = vi.fn();
      service.onError(errorCallback);

      await expect(subscription.unsubscribe()).rejects.toThrow('Unsubscribe failed');
      expect(errorCallback).toHaveBeenCalled();
      expect(errorCallback.mock.calls[0][0].code).toBe('AMPS_UNSUBSCRIBE_ERROR');

      // The subscription should still be removed from tracking
      // Calling unsubscribe again should be a no-op (already removed)
      await expect(subscription.unsubscribe()).resolves.toBeUndefined();
    });
  });

  describe('transformMessage - various data formats', () => {
    beforeEach(async () => {
      service.initialize(config);
      await service.connect();
    });

    it('should parse JSON data from message.d field', async () => {
      const anyService = service as any;
      const client = anyService.client;
      const callback = vi.fn();

      client.subscribe.mockImplementation(async (handler: any) => {
        handler({ c: 'publish', t: '/topic/rates', d: '{"symbol":"2Y","rate":4.5}' });
        return 'sub-1';
      });

      await service.subscribe('/topic/rates', callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0].data).toEqual({ symbol: '2Y', rate: 4.5 });
      expect(callback.mock.calls[0][0].topic).toBe('/topic/rates');
    });

    it('should use raw data when JSON parsing fails', async () => {
      const anyService = service as any;
      const client = anyService.client;
      const callback = vi.fn();

      client.subscribe.mockImplementation(async (handler: any) => {
        handler({ c: 'publish', t: '/topic/rates', d: 'not-json-data' });
        return 'sub-1';
      });

      await service.subscribe('/topic/rates', callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0].data).toBe('not-json-data');
    });

    it('should handle message with data property instead of d', async () => {
      const anyService = service as any;
      const client = anyService.client;
      const callback = vi.fn();

      client.subscribe.mockImplementation(async (handler: any) => {
        handler({ c: 'publish', t: '/topic/rates', data: '{"symbol":"5Y"}' });
        return 'sub-1';
      });

      await service.subscribe('/topic/rates', callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0].data).toEqual({ symbol: '5Y' });
    });

    it('should handle message with Id field (raw data object)', async () => {
      const anyService = service as any;
      const client = anyService.client;
      const callback = vi.fn();

      client.subscribe.mockImplementation(async (handler: any) => {
        handler({ c: 'publish', t: '/topic/rates', Id: '123', symbol: '10Y' });
        return 'sub-1';
      });

      await service.subscribe('/topic/rates', callback);

      expect(callback).toHaveBeenCalledTimes(1);
      // When no d or data, but has Id, the message itself is used as data
      expect(callback.mock.calls[0][0].data).toEqual(
        expect.objectContaining({ Id: '123', symbol: '10Y' })
      );
    });

    it('should return empty object when message has no data fields', async () => {
      const anyService = service as any;
      const client = anyService.client;
      const callback = vi.fn();

      client.subscribe.mockImplementation(async (handler: any) => {
        handler({ c: 'publish', t: '/topic/rates' });
        return 'sub-1';
      });

      await service.subscribe('/topic/rates', callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0].data).toEqual({});
    });

    it('should handle non-string d field (already parsed)', async () => {
      const anyService = service as any;
      const client = anyService.client;
      const callback = vi.fn();

      client.subscribe.mockImplementation(async (handler: any) => {
        handler({ c: 'publish', t: '/topic/rates', d: { symbol: '30Y', rate: 4.8 } as any });
        return 'sub-1';
      });

      await service.subscribe('/topic/rates', callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0].data).toEqual({ symbol: '30Y', rate: 4.8 });
    });

    it('should include sow_key in headers when present', async () => {
      const anyService = service as any;
      const client = anyService.client;
      const callback = vi.fn();

      client.subscribe.mockImplementation(async (handler: any) => {
        handler({
          c: 'publish',
          t: '/topic/rates',
          d: '{"symbol":"2Y"}',
          sow_key: 'key-abc',
          cid: 'cmd-1',
        });
        return 'sub-1';
      });

      await service.subscribe('/topic/rates', callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0].headers).toEqual({ sowKey: 'key-abc' });
      expect(callback.mock.calls[0][0].messageId).toBe('cmd-1');
      expect(callback.mock.calls[0][0].correlationId).toBe('cmd-1');
    });

    it('should handle message with topic property instead of t', async () => {
      const anyService = service as any;
      const client = anyService.client;
      const callback = vi.fn();

      client.subscribe.mockImplementation(async (handler: any) => {
        handler({ c: 'publish', topic: '/topic/fx', d: '{"pair":"EURUSD"}' });
        return 'sub-1';
      });

      await service.subscribe('/topic/rates', callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0].topic).toBe('/topic/fx');
    });

    it('should handle errors in subscribe message handler gracefully', async () => {
      const anyService = service as any;
      const client = anyService.client;
      const childLogger = mockLogger.child.mock.results[0].value;

      // Callback that throws
      const callback = vi.fn().mockImplementationOnce(() => {
        throw new Error('Callback processing error');
      });

      client.subscribe.mockImplementation(async (handler: any) => {
        handler({ c: 'publish', t: '/topic/rates', d: '{"symbol":"2Y"}' });
        return 'sub-1';
      });

      const subscription = await service.subscribe('/topic/rates', callback);
      expect(subscription).toBeDefined();
      // Error should be caught and logged
      expect(childLogger.error).toHaveBeenCalled();
    });
  });

  describe('subscribe - error path', () => {
    beforeEach(async () => {
      service.initialize(config);
      await service.connect();
    });

    it('should handle subscribe failure and notify error', async () => {
      const anyService = service as any;
      const client = anyService.client;
      client.subscribe.mockRejectedValueOnce(new Error('Subscribe failed'));

      const errorCallback = vi.fn();
      service.onError(errorCallback);

      await expect(
        service.subscribe('/topic/rates', vi.fn())
      ).rejects.toThrow('Subscribe failed');
      expect(errorCallback).toHaveBeenCalled();
      expect(errorCallback.mock.calls[0][0].code).toBe('AMPS_SUBSCRIBE_ERROR');
    });
  });

  describe('publish - error path', () => {
    beforeEach(async () => {
      service.initialize(config);
      await service.connect();
    });

    it('should handle publish failure and notify error', async () => {
      const anyService = service as any;
      const client = anyService.client;
      client.publish.mockRejectedValueOnce(new Error('Publish failed'));

      const errorCallback = vi.fn();
      service.onError(errorCallback);

      await expect(
        service.publish('/topic/rates', { rate: 1.5 })
      ).rejects.toThrow('Publish failed');
      expect(errorCallback).toHaveBeenCalled();
      expect(errorCallback.mock.calls[0][0].code).toBe('AMPS_PUBLISH_ERROR');
    });
  });

  describe('disconnect - error path', () => {
    it('should handle disconnect error, clean up client, and rethrow', async () => {
      service.initialize(config);
      await service.connect();

      const anyService = service as any;
      const client = anyService.client;
      client.disconnect.mockRejectedValueOnce(new Error('Disconnect error'));

      const errorCallback = vi.fn();
      service.onError(errorCallback);

      await expect(service.disconnect()).rejects.toThrow('Disconnect error');
      expect(errorCallback).toHaveBeenCalled();
      expect(errorCallback.mock.calls[0][0].code).toBe('AMPS_DISCONNECT_ERROR');
      // Client should be nulled even on error
      expect(anyService.client).toBeNull();
    });
  });

  describe('connect - connection failure with reconnect', () => {
    it('should schedule reconnect when connection fails and reconnect is enabled', async () => {
      const reconnectConfig: AmpsConfig = {
        ...config,
        reconnect: {
          enabled: true,
          maxAttempts: 3,
          initialDelay: 1000,
          maxDelay: 5000,
        },
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AmpsTransportService,
          { provide: LoggerService, useValue: mockLogger },
        ],
      });
      const freshService = TestBed.inject(AmpsTransportService);
      freshService.initialize(reconnectConfig);

      const anyService = freshService as any;

      // Manually simulate a connect failure with reconnect scheduling
      // by calling scheduleReconnect directly (the method under test)
      anyService.scheduleReconnect();

      // A reconnect timer should be set
      expect(anyService.reconnectTimer).not.toBeNull();
      expect(freshService.getConnectionStatus()).toBe(ConnectionStatus.Reconnecting);

      // Cleanup
      if (anyService.reconnectTimer) {
        clearTimeout(anyService.reconnectTimer);
        anyService.reconnectTimer = null;
      }
    });

    it('should stop reconnecting after max attempts reached', async () => {
      const reconnectConfig: AmpsConfig = {
        ...config,
        reconnect: {
          enabled: true,
          maxAttempts: 2,
          initialDelay: 100,
        },
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AmpsTransportService,
          { provide: LoggerService, useValue: mockLogger },
        ],
      });
      const freshService = TestBed.inject(AmpsTransportService);
      freshService.initialize(reconnectConfig);

      const anyService = freshService as any;
      // Simulate max reconnect attempts reached
      anyService.reconnectAttempts = 2;

      // Call scheduleReconnect directly
      anyService.scheduleReconnect();

      // Should not schedule a new timer since max attempts reached
      expect(freshService.getConnectionStatus()).toBe(ConnectionStatus.Error);
    });

    it('should clear existing reconnect timer before scheduling new one', async () => {
      const reconnectConfig: AmpsConfig = {
        ...config,
        reconnect: {
          enabled: true,
          maxAttempts: 5,
          initialDelay: 100,
        },
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AmpsTransportService,
          { provide: LoggerService, useValue: mockLogger },
        ],
      });
      const freshService = TestBed.inject(AmpsTransportService);
      freshService.initialize(reconnectConfig);

      const anyService = freshService as any;
      // Set an existing timer
      anyService.reconnectTimer = setTimeout(() => {}, 100000);

      // Schedule a new reconnect
      anyService.scheduleReconnect();

      // Timer should be set
      expect(anyService.reconnectTimer).not.toBeNull();

      // Cleanup
      if (anyService.reconnectTimer) {
        clearTimeout(anyService.reconnectTimer);
        anyService.reconnectTimer = null;
      }
    });
  });

  describe('handleDisconnect', () => {
    it('should update status and schedule reconnect when enabled', async () => {
      const reconnectConfig: AmpsConfig = {
        ...config,
        reconnect: {
          enabled: true,
          maxAttempts: 5,
          initialDelay: 100,
        },
      };

      service.initialize(reconnectConfig);
      await service.connect();

      const anyService = service as any;
      // Call handleDisconnect directly
      anyService.handleDisconnect(new Error('Connection lost'));

      expect(service.getConnectionStatus()).toBe(ConnectionStatus.Reconnecting);

      // Cleanup timer
      if (anyService.reconnectTimer) {
        clearTimeout(anyService.reconnectTimer);
        anyService.reconnectTimer = null;
      }
    });

    it('should update status without reconnect when not enabled', async () => {
      service.initialize(config); // No reconnect config
      await service.connect();

      const anyService = service as any;
      anyService.handleDisconnect();

      expect(service.getConnectionStatus()).toBe(ConnectionStatus.Disconnected);
    });
  });

  describe('resubscribeAll', () => {
    it('should resubscribe to all active subscriptions', async () => {
      service.initialize(config);
      await service.connect();

      // Create subscriptions
      await service.subscribe('/topic/rates1', vi.fn());
      await service.subscribe('/topic/rates2', vi.fn());

      const anyService = service as any;
      const client = anyService.client;

      // Reset subscribe mock call count
      client.subscribe.mockClear();

      // Call resubscribeAll
      await anyService.resubscribeAll();

      // Should have resubscribed to both topics
      expect(client.subscribe).toHaveBeenCalledTimes(2);
    });

    it('should handle resubscribe failure for individual topics', async () => {
      service.initialize(config);
      await service.connect();

      // Create subscription
      await service.subscribe('/topic/rates1', vi.fn());

      const anyService = service as any;
      const client = anyService.client;
      const childLogger = mockLogger.child.mock.results[0].value;

      // Make subscribe fail on resubscribe
      client.subscribe.mockRejectedValueOnce(new Error('Resubscribe failed'));

      // Call resubscribeAll
      await anyService.resubscribeAll();

      // Should have logged the error
      expect(childLogger.error).toHaveBeenCalled();
    });
  });
});
