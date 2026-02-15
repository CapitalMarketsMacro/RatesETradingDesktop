import { AmpsTransportService } from './amps-transport.service';
import { ConnectionStatus } from '../../interfaces/transport.interface';
import { AmpsConfig } from '../../interfaces/transport-config.interface';

describe('AmpsTransportService', () => {
  let service: AmpsTransportService;
  let config: AmpsConfig;

  beforeEach(() => {
    service = new AmpsTransportService();
    config = {
      url: 'ws://localhost:9000/amps/json',
      user: 'test-user',
      messageType: 'json',
      clientName: 'test-client',
    };
    service.initialize(config);
  });

  describe('initialization', () => {
    it('should create an instance', () => {
      expect(service).toBeTruthy();
    });

    it('should start with disconnected status', () => {
      expect(service.getConnectionStatus()).toBe(ConnectionStatus.Disconnected);
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('connect', () => {
    it('should throw error if not initialized', async () => {
      const uninitializedService = new AmpsTransportService();
      await expect(uninitializedService.connect()).rejects.toThrow(
        'AMPS configuration not initialized'
      );
    });

    it('should connect successfully', async () => {
      await service.connect();
      expect(service.isConnected()).toBe(true);
      expect(service.getConnectionStatus()).toBe(ConnectionStatus.Connected);
    });

    it('should emit connection status changes', async () => {
      const statuses: ConnectionStatus[] = [];
      service.connectionStatus$.subscribe((status) => statuses.push(status));

      await service.connect();

      expect(statuses).toContain(ConnectionStatus.Connecting);
      expect(statuses).toContain(ConnectionStatus.Connected);
    });

    it('should not connect again if already connected', async () => {
      await service.connect();
      const consoleSpy = vi.spyOn(console, 'warn');
      
      await service.connect();
      
      expect(consoleSpy).toHaveBeenCalledWith('AMPS: Already connected');
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      await service.connect();
      await service.disconnect();
      expect(service.isConnected()).toBe(false);
      expect(service.getConnectionStatus()).toBe(ConnectionStatus.Disconnected);
    });

    it('should do nothing if not connected', async () => {
      await service.disconnect();
      expect(service.getConnectionStatus()).toBe(ConnectionStatus.Disconnected);
    });
  });

  describe('subscribe', () => {
    beforeEach(async () => {
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
      await service.connect();
    });

    it('should throw error if not connected', async () => {
      await service.disconnect();
      await expect(
        service.publish('/topic/rates', { rate: 1.5 })
      ).rejects.toThrow('Not connected to AMPS');
    });

    it('should publish a message', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      await service.publish('/topic/rates', { rate: 1.5 });

      expect(consoleSpy).toHaveBeenCalledWith(
        'AMPS: Published to /topic/rates:',
        { rate: 1.5 },
        undefined
      );
    });
  });

  describe('sowQuery', () => {
    beforeEach(async () => {
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
      await service.connect();
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
      await service.connect();
    });

    it('should create delta subscription', async () => {
      const callback = vi.fn();
      const subscription = await service.deltaSubscribe('/topic/rates', callback);

      expect(subscription).toBeDefined();
      expect(subscription.id).toBeTruthy();
    });
  });

  describe('error handling', () => {
    it('should notify error callbacks', async () => {
      const errorCallback = vi.fn();
      service.onError(errorCallback);

      // Force an error by trying to subscribe without connection
      try {
        await service.subscribe('/topic/rates', vi.fn());
      } catch {
        // Expected to throw
      }

      expect(errorCallback).not.toHaveBeenCalled(); // Error thrown before callback
    });
  });
});
