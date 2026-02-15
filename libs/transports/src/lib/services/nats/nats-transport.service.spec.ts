import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NatsTransportService } from './nats-transport.service';
import { ConnectionStatus } from '../../interfaces/transport.interface';
import { NatsConfig } from '../../interfaces/transport-config.interface';

// Mock NATS client
vi.mock('nats', () => ({
  connect: vi.fn(),
}));

describe('NatsTransportService', () => {
  let service: NatsTransportService;
  let mockConnection: {
    subscribe: ReturnType<typeof vi.fn>;
    publish: ReturnType<typeof vi.fn>;
    request: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
    headers: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = new NatsTransportService();
    
    mockConnection = {
      subscribe: vi.fn(),
      publish: vi.fn(),
      request: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
      status: vi.fn(),
      headers: vi.fn().mockReturnValue({
        set: vi.fn(),
      }),
    };
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

  it('should throw error when connecting without initialization', async () => {
    await expect(service.connect()).rejects.toThrow('NATS configuration not initialized');
  });

  it('should connect successfully with valid config', async () => {
    const { connect } = await import('nats');
    vi.mocked(connect).mockResolvedValue(mockConnection as any);
    
    const config: NatsConfig = {
      url: 'nats://localhost:4222',
    };
    service.initialize(config);
    
    // Mock status async iterator
    mockConnection.status.mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        // Empty iterator for now
      },
    });

    await service.connect();
    
    expect(connect).toHaveBeenCalled();
    expect(service.getConnectionStatus()).toBe(ConnectionStatus.Connected);
  });
});
