import { SolaceTransportService } from './solace-transport.service';
import { ConnectionStatus } from '../../interfaces/transport.interface';
import { SolaceConfig } from '../../interfaces/transport-config.interface';

describe('SolaceTransportService', () => {
  let service: SolaceTransportService;
  let config: SolaceConfig;

  beforeEach(() => {
    service = new SolaceTransportService();
    config = {
      url: 'ws://localhost:8008',
      vpnName: 'dev-vpn',
      userName: 'test-user',
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
      const uninitializedService = new SolaceTransportService();
      await expect(uninitializedService.connect()).rejects.toThrow(
        'Solace configuration not initialized'
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
      
      expect(consoleSpy).toHaveBeenCalledWith('Solace: Already connected');
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
      ).rejects.toThrow('Not connected to Solace');
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
      ).rejects.toThrow('Not connected to Solace');
    });

    it('should publish a message', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      await service.publish('/topic/rates', { rate: 1.5 });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Solace: Published to /topic/rates:',
        { rate: 1.5 },
        undefined
      );
    });

    it('should publish with options', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      await service.publish('/topic/rates', { rate: 1.5 }, {
        correlationId: 'test-123',
        deliveryMode: 'persistent',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Solace: Published to /topic/rates:',
        { rate: 1.5 },
        expect.objectContaining({ correlationId: 'test-123' })
      );
    });
  });

  describe('request', () => {
    beforeEach(async () => {
      await service.connect();
    });

    it('should throw error if not connected', async () => {
      await service.disconnect();
      await expect(
        service.request('/topic/rates', { query: 'test' })
      ).rejects.toThrow('Not connected to Solace');
    });

    it('should execute request/reply', async () => {
      const response = await service.request('/topic/rates', { query: 'test' });
      expect(response).toBeDefined();
      expect(response.topic).toBe('/topic/rates');
    });
  });

  describe('connection events', () => {
    it('should emit connection events', async () => {
      const events: string[] = [];
      service.connectionEvents$.subscribe((event) => events.push(event.type));

      await service.connect();
      await service.disconnect();

      expect(events).toContain('connected');
      expect(events).toContain('disconnected');
    });
  });

  describe('error handling', () => {
    it('should register error callbacks', () => {
      const errorCallback = vi.fn();
      service.onError(errorCallback);

      // Callback should be registered without errors
      expect(() => service.onError(errorCallback)).not.toThrow();
    });
  });
});
