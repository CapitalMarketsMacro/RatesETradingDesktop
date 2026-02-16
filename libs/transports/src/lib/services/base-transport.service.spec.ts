import { BaseTransportService } from './base-transport.service';
import { ConnectionStatus, TransportError, ErrorCallback } from '../interfaces/transport.interface';

// Create a concrete implementation for testing
class TestTransportService extends BaseTransportService {
  // Expose protected methods for testing
  public testUpdateConnectionStatus(
    status: ConnectionStatus,
    details?: string,
    error?: TransportError
  ): void {
    this.updateConnectionStatus(status, details, error);
  }

  public testNotifyError(error: TransportError): void {
    this.notifyError(error);
  }

  public testGenerateSubscriptionId(): string {
    return this.generateSubscriptionId();
  }

  public testCreateTransportError(
    error: unknown,
    code?: string,
    recoverable?: boolean
  ): TransportError {
    return this.createTransportError(error, code, recoverable);
  }
}

describe('BaseTransportService', () => {
  let service: TestTransportService;

  beforeEach(() => {
    service = new TestTransportService();
  });

  describe('initial state', () => {
    it('should start with disconnected status', () => {
      expect(service.getConnectionStatus()).toBe(ConnectionStatus.Disconnected);
    });

    it('should not be connected initially', () => {
      expect(service.isConnected()).toBe(false);
    });

    it('should expose connectionStatus$ observable', () => {
      expect(service.connectionStatus$).toBeDefined();
    });

    it('should expose connectionEvents$ observable', () => {
      expect(service.connectionEvents$).toBeDefined();
    });
  });

  describe('getConnectionStatus', () => {
    it('should return the current connection status', () => {
      expect(service.getConnectionStatus()).toBe(ConnectionStatus.Disconnected);
      service.testUpdateConnectionStatus(ConnectionStatus.Connected);
      expect(service.getConnectionStatus()).toBe(ConnectionStatus.Connected);
    });
  });

  describe('isConnected', () => {
    it('should return true only when status is Connected', () => {
      expect(service.isConnected()).toBe(false);

      service.testUpdateConnectionStatus(ConnectionStatus.Connecting);
      expect(service.isConnected()).toBe(false);

      service.testUpdateConnectionStatus(ConnectionStatus.Connected);
      expect(service.isConnected()).toBe(true);

      service.testUpdateConnectionStatus(ConnectionStatus.Reconnecting);
      expect(service.isConnected()).toBe(false);

      service.testUpdateConnectionStatus(ConnectionStatus.Error);
      expect(service.isConnected()).toBe(false);

      service.testUpdateConnectionStatus(ConnectionStatus.Disconnected);
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('updateConnectionStatus', () => {
    it('should emit status changes to connectionStatus$', () => {
      const statuses: ConnectionStatus[] = [];
      service.connectionStatus$.subscribe((s) => statuses.push(s));

      service.testUpdateConnectionStatus(ConnectionStatus.Connecting);
      service.testUpdateConnectionStatus(ConnectionStatus.Connected);

      expect(statuses).toContain(ConnectionStatus.Disconnected); // initial
      expect(statuses).toContain(ConnectionStatus.Connecting);
      expect(statuses).toContain(ConnectionStatus.Connected);
    });

    it('should emit connection events with correct type', () => {
      const events: string[] = [];
      service.connectionEvents$.subscribe((e) => events.push(e.type));

      service.testUpdateConnectionStatus(ConnectionStatus.Connected, 'Connected');
      service.testUpdateConnectionStatus(ConnectionStatus.Disconnected, 'Disconnected');
      service.testUpdateConnectionStatus(ConnectionStatus.Reconnecting, 'Reconnecting');
      service.testUpdateConnectionStatus(ConnectionStatus.Error, 'Error');

      expect(events).toContain('connected');
      expect(events).toContain('disconnected');
      expect(events).toContain('reconnecting');
      expect(events).toContain('error');
    });

    it('should include details in connection events', () => {
      let eventDetails: string | undefined;
      service.connectionEvents$.subscribe((e) => {
        eventDetails = e.details;
      });

      service.testUpdateConnectionStatus(ConnectionStatus.Connected, 'Connected to server');
      expect(eventDetails).toBe('Connected to server');
    });

    it('should include error in connection events', () => {
      const error: TransportError = {
        code: 'TEST_ERROR',
        message: 'Test error',
        recoverable: false,
      };

      let eventError: TransportError | undefined;
      service.connectionEvents$.subscribe((e) => {
        eventError = e.error;
      });

      service.testUpdateConnectionStatus(ConnectionStatus.Error, 'Error occurred', error);
      expect(eventError).toEqual(error);
    });

    it('should include timestamp in connection events', () => {
      let timestamp: Date | undefined;
      service.connectionEvents$.subscribe((e) => {
        timestamp = e.timestamp;
      });

      service.testUpdateConnectionStatus(ConnectionStatus.Connected);
      expect(timestamp).toBeInstanceOf(Date);
    });

    it('should not emit event for Connecting status', () => {
      const events: string[] = [];
      service.connectionEvents$.subscribe((e) => events.push(e.type));

      service.testUpdateConnectionStatus(ConnectionStatus.Connecting);
      expect(events.length).toBe(0);
    });
  });

  describe('onError', () => {
    it('should register error callbacks', () => {
      const callback = vi.fn();
      service.onError(callback);

      const error: TransportError = {
        code: 'TEST',
        message: 'test error',
        recoverable: false,
      };
      service.testNotifyError(error);

      expect(callback).toHaveBeenCalledWith(error);
    });

    it('should support multiple error callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      service.onError(callback1);
      service.onError(callback2);

      const error: TransportError = {
        code: 'TEST',
        message: 'test error',
        recoverable: false,
      };
      service.testNotifyError(error);

      expect(callback1).toHaveBeenCalledWith(error);
      expect(callback2).toHaveBeenCalledWith(error);
    });

    it('should not throw if an error callback itself throws', () => {
      const throwingCallback: ErrorCallback = () => {
        throw new Error('callback error');
      };
      const normalCallback = vi.fn();
      service.onError(throwingCallback);
      service.onError(normalCallback);

      const error: TransportError = {
        code: 'TEST',
        message: 'test',
        recoverable: false,
      };
      expect(() => service.testNotifyError(error)).not.toThrow();
      expect(normalCallback).toHaveBeenCalledWith(error);
    });
  });

  describe('generateSubscriptionId', () => {
    it('should generate unique subscription IDs', () => {
      const id1 = service.testGenerateSubscriptionId();
      const id2 = service.testGenerateSubscriptionId();
      expect(id1).not.toBe(id2);
    });

    it('should start with "sub_" prefix', () => {
      const id = service.testGenerateSubscriptionId();
      expect(id.startsWith('sub_')).toBe(true);
    });

    it('should increment counter', () => {
      const id1 = service.testGenerateSubscriptionId();
      const id2 = service.testGenerateSubscriptionId();
      // Extract counter portion
      const counter1 = parseInt(id1.split('_')[1], 10);
      const counter2 = parseInt(id2.split('_')[1], 10);
      expect(counter2).toBe(counter1 + 1);
    });
  });

  describe('createTransportError', () => {
    it('should create error from Error instance', () => {
      const sourceError = new Error('connection failed');
      const transportError = service.testCreateTransportError(sourceError, 'CONN_ERROR', true);

      expect(transportError.code).toBe('CONN_ERROR');
      expect(transportError.message).toBe('connection failed');
      expect(transportError.cause).toBe(sourceError);
      expect(transportError.recoverable).toBe(true);
    });

    it('should create error from string', () => {
      const transportError = service.testCreateTransportError('something broke', 'ERR', false);

      expect(transportError.code).toBe('ERR');
      expect(transportError.message).toBe('something broke');
      expect(transportError.cause).toBeUndefined();
      expect(transportError.recoverable).toBe(false);
    });

    it('should create error from number', () => {
      const transportError = service.testCreateTransportError(42);

      expect(transportError.message).toBe('42');
    });

    it('should use default code UNKNOWN_ERROR', () => {
      const transportError = service.testCreateTransportError('test');
      expect(transportError.code).toBe('UNKNOWN_ERROR');
    });

    it('should default recoverable to false', () => {
      const transportError = service.testCreateTransportError('test');
      expect(transportError.recoverable).toBe(false);
    });
  });
});
