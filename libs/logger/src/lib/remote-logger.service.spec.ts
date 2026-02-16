import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RemoteLoggerService, RemoteLoggerConfig } from './remote-logger.service';

// Mock @nats-io/nats-core
vi.mock('@nats-io/nats-core', () => ({
  wsconnect: vi.fn(),
}));

describe('RemoteLoggerService', () => {
  let service: RemoteLoggerService;

  beforeEach(() => {
    service = new RemoteLoggerService();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(async () => {
    if (service.initialized) {
      await service.shutdown();
    }
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should not be initialized', () => {
      expect(service.initialized).toBe(false);
    });

    it('should not be connected', () => {
      expect(service.isConnected).toBe(false);
    });

    it('should have null natsUrl', () => {
      expect(service.natsUrl).toBeNull();
    });

    it('should have null topic', () => {
      expect(service.topic).toBeNull();
    });

    it('should have 0 totalPublished', () => {
      expect(service.totalPublished).toBe(0);
    });

    it('should have 0 pendingCount', () => {
      expect(service.pendingCount).toBe(0);
    });
  });

  describe('initialize', () => {
    it('should not initialize when disabled', async () => {
      await service.initialize({
        enabled: false,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
      });

      expect(service.initialized).toBe(false);
    });

    it('should initialize when enabled', async () => {
      vi.useFakeTimers();
      const { wsconnect } = await import('@nats-io/nats-core');
      vi.mocked(wsconnect).mockRejectedValue(new Error('connection refused'));

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
      });

      expect(service.initialized).toBe(true);
      expect(service.natsUrl).toBe('ws://localhost:8224');
      expect(service.topic).toBe('test-logs');

      vi.useRealTimers();
    });

    it('should not initialize twice', async () => {
      vi.useFakeTimers();
      const { wsconnect } = await import('@nats-io/nats-core');
      vi.mocked(wsconnect).mockRejectedValue(new Error('refused'));

      const config: RemoteLoggerConfig = {
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
      };

      await service.initialize(config);
      await service.initialize(config); // second call is no-op

      expect(service.initialized).toBe(true);
      vi.useRealTimers();
    });

    it('should use default values for optional config', async () => {
      vi.useFakeTimers();
      const { wsconnect } = await import('@nats-io/nats-core');
      vi.mocked(wsconnect).mockRejectedValue(new Error('refused'));

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
      });

      expect(service.initialized).toBe(true);
      vi.useRealTimers();
    });

    it('should connect with token authentication when token is provided', async () => {
      vi.useFakeTimers();
      const { wsconnect } = await import('@nats-io/nats-core');
      const mockConnection = {
        publish: vi.fn(),
        status: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {},
        }),
        closed: vi.fn().mockReturnValue(new Promise(() => {})),
      };
      vi.mocked(wsconnect).mockResolvedValue(mockConnection as any);

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
        token: 'my-secret-token',
        clientName: 'test-client',
      });

      await vi.advanceTimersByTimeAsync(100);

      expect(wsconnect).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'my-secret-token',
          name: 'test-client-logger',
        }),
      );

      vi.useRealTimers();
    });

    it('should connect with user/password authentication', async () => {
      vi.useFakeTimers();
      const { wsconnect } = await import('@nats-io/nats-core');
      const mockConnection = {
        publish: vi.fn(),
        status: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {},
        }),
        closed: vi.fn().mockReturnValue(new Promise(() => {})),
      };
      vi.mocked(wsconnect).mockResolvedValue(mockConnection as any);

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
        user: 'admin',
        password: 'secret',
      });

      await vi.advanceTimersByTimeAsync(100);

      expect(wsconnect).toHaveBeenCalledWith(
        expect.objectContaining({
          user: 'admin',
          pass: 'secret',
        }),
      );

      vi.useRealTimers();
    });

    it('should use default logger name when clientName is not provided', async () => {
      vi.useFakeTimers();
      const { wsconnect } = await import('@nats-io/nats-core');
      vi.mocked(wsconnect).mockRejectedValue(new Error('refused'));

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
      });

      await vi.advanceTimersByTimeAsync(100);

      expect(wsconnect).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.stringMatching(/^logger-\d+$/),
        }),
      );

      vi.useRealTimers();
    });

    it('should start periodic flush timer on initialization', async () => {
      vi.useFakeTimers();
      const { wsconnect } = await import('@nats-io/nats-core');
      vi.mocked(wsconnect).mockRejectedValue(new Error('refused'));

      const flushSpy = vi.spyOn(service, 'flush');

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
        flushIntervalMs: 1000,
        bufferSize: 100,
      });

      // Push an entry so flush has something to do
      service.push({ level: 30, msg: 'test' });

      // Advance past the flush interval
      await vi.advanceTimersByTimeAsync(1000);

      expect(flushSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('push', () => {
    it('should not push when not initialized', () => {
      service.push({ level: 30, msg: 'test' });
      expect(service.pendingCount).toBe(0);
    });

    it('should buffer log entries when initialized', async () => {
      vi.useFakeTimers();
      const { wsconnect } = await import('@nats-io/nats-core');
      vi.mocked(wsconnect).mockRejectedValue(new Error('refused'));

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
        bufferSize: 100,
      });

      service.push({ level: 30, msg: 'test info' });
      expect(service.pendingCount).toBe(1);

      service.push({ level: 50, msg: 'test error' });
      expect(service.pendingCount).toBe(2);

      vi.useRealTimers();
    });

    it('should drop entries below minimum level', async () => {
      vi.useFakeTimers();
      const { wsconnect } = await import('@nats-io/nats-core');
      vi.mocked(wsconnect).mockRejectedValue(new Error('refused'));

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
        minLevel: 40, // warn
        bufferSize: 100,
      });

      service.push({ level: 20, msg: 'debug msg' }); // below 40 - dropped
      service.push({ level: 30, msg: 'info msg' }); // below 40 - dropped
      service.push({ level: 40, msg: 'warn msg' }); // at 40 - kept
      service.push({ level: 50, msg: 'error msg' }); // above 40 - kept

      expect(service.pendingCount).toBe(2);
      vi.useRealTimers();
    });

    it('should extract component/service/module from log object', async () => {
      vi.useFakeTimers();
      const { wsconnect } = await import('@nats-io/nats-core');
      vi.mocked(wsconnect).mockRejectedValue(new Error('refused'));

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
        bufferSize: 100,
      });

      service.push({ level: 30, msg: 'test', component: 'MyComponent' });
      expect(service.pendingCount).toBe(1);

      vi.useRealTimers();
    });

    it('should use default level 30 when level is not provided', async () => {
      vi.useFakeTimers();
      const { wsconnect } = await import('@nats-io/nats-core');
      vi.mocked(wsconnect).mockRejectedValue(new Error('refused'));

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
        bufferSize: 100,
      });

      service.push({ msg: 'no level specified' });
      expect(service.pendingCount).toBe(1);

      vi.useRealTimers();
    });

    it('should auto-flush when buffer reaches bufferSize', async () => {
      vi.useFakeTimers();
      const { wsconnect } = await import('@nats-io/nats-core');
      vi.mocked(wsconnect).mockRejectedValue(new Error('refused'));

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
        bufferSize: 3,
      });

      const flushSpy = vi.spyOn(service, 'flush');

      service.push({ level: 30, msg: 'msg1' });
      service.push({ level: 30, msg: 'msg2' });
      expect(flushSpy).not.toHaveBeenCalled();

      // The 3rd push should trigger a flush (buffer reaches bufferSize)
      service.push({ level: 30, msg: 'msg3' });
      expect(flushSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should use "service" fallback for logger name in log entry', async () => {
      vi.useFakeTimers();
      const mockPublish = vi.fn();
      const mockConnection = {
        publish: mockPublish,
        status: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {},
        }),
        closed: vi.fn().mockReturnValue(new Promise(() => {})),
      };
      const { wsconnect } = await import('@nats-io/nats-core');
      vi.mocked(wsconnect).mockResolvedValue(mockConnection as any);

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
        bufferSize: 100,
      });

      await vi.advanceTimersByTimeAsync(100);

      service.push({ level: 30, msg: 'test', service: 'OrderService' });
      service.flush();

      expect(mockPublish).toHaveBeenCalled();
      const payload = mockPublish.mock.calls[0][1];
      const decoded = new TextDecoder().decode(payload);
      const entry = JSON.parse(decoded);
      expect(entry.logger).toBe('OrderService');

      vi.useRealTimers();
    });

    it('should use "module" fallback for logger name in log entry', async () => {
      vi.useFakeTimers();
      const mockPublish = vi.fn();
      const mockConnection = {
        publish: mockPublish,
        status: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {},
        }),
        closed: vi.fn().mockReturnValue(new Promise(() => {})),
      };
      const { wsconnect } = await import('@nats-io/nats-core');
      vi.mocked(wsconnect).mockResolvedValue(mockConnection as any);

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
        bufferSize: 100,
      });

      await vi.advanceTimersByTimeAsync(100);

      service.push({ level: 30, msg: 'test', module: 'CoreModule' });
      service.flush();

      const payload = mockPublish.mock.calls[0][1];
      const decoded = new TextDecoder().decode(payload);
      const entry = JSON.parse(decoded);
      expect(entry.logger).toBe('CoreModule');

      vi.useRealTimers();
    });

    it('should use "App" as default logger name when no component/service/module', async () => {
      vi.useFakeTimers();
      const mockPublish = vi.fn();
      const mockConnection = {
        publish: mockPublish,
        status: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {},
        }),
        closed: vi.fn().mockReturnValue(new Promise(() => {})),
      };
      const { wsconnect } = await import('@nats-io/nats-core');
      vi.mocked(wsconnect).mockResolvedValue(mockConnection as any);

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
        bufferSize: 100,
      });

      await vi.advanceTimersByTimeAsync(100);

      service.push({ level: 30, msg: 'test' });
      service.flush();

      const payload = mockPublish.mock.calls[0][1];
      const decoded = new TextDecoder().decode(payload);
      const entry = JSON.parse(decoded);
      expect(entry.logger).toBe('App');

      vi.useRealTimers();
    });

    it('should include metadata in published entries', async () => {
      vi.useFakeTimers();
      const mockPublish = vi.fn();
      const mockConnection = {
        publish: mockPublish,
        status: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {},
        }),
        closed: vi.fn().mockReturnValue(new Promise(() => {})),
      };
      const { wsconnect } = await import('@nats-io/nats-core');
      vi.mocked(wsconnect).mockResolvedValue(mockConnection as any);

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
        bufferSize: 100,
        metadata: { app: 'rates-desktop', env: 'test' },
      });

      await vi.advanceTimersByTimeAsync(100);

      service.push({ level: 30, msg: 'with meta' });
      service.flush();

      const payload = mockPublish.mock.calls[0][1];
      const decoded = new TextDecoder().decode(payload);
      const entry = JSON.parse(decoded);
      expect(entry.meta).toEqual({ app: 'rates-desktop', env: 'test' });

      vi.useRealTimers();
    });

    it('should strip internal keys from data in published entry', async () => {
      vi.useFakeTimers();
      const mockPublish = vi.fn();
      const mockConnection = {
        publish: mockPublish,
        status: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {},
        }),
        closed: vi.fn().mockReturnValue(new Promise(() => {})),
      };
      const { wsconnect } = await import('@nats-io/nats-core');
      vi.mocked(wsconnect).mockResolvedValue(mockConnection as any);

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
        bufferSize: 100,
      });

      await vi.advanceTimersByTimeAsync(100);

      service.push({
        level: 30,
        time: 12345,
        msg: 'test',
        component: 'Comp',
        service: 'Svc',
        module: 'Mod',
        customField: 'preserved',
      });
      service.flush();

      const payload = mockPublish.mock.calls[0][1];
      const decoded = new TextDecoder().decode(payload);
      const entry = JSON.parse(decoded);
      // Internal keys should be stripped from data
      expect(entry.data).not.toHaveProperty('level');
      expect(entry.data).not.toHaveProperty('time');
      expect(entry.data).not.toHaveProperty('msg');
      expect(entry.data).not.toHaveProperty('component');
      expect(entry.data).not.toHaveProperty('service');
      expect(entry.data).not.toHaveProperty('module');
      // Custom fields should be preserved
      expect(entry.data.customField).toBe('preserved');

      vi.useRealTimers();
    });
  });

  describe('flush', () => {
    it('should do nothing when buffer is empty', () => {
      expect(() => service.flush()).not.toThrow();
    });

    it('should publish buffered entries when connected', async () => {
      vi.useFakeTimers();
      const mockPublish = vi.fn();
      const mockConnection = {
        publish: mockPublish,
        status: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {},
        }),
        closed: vi.fn().mockReturnValue(new Promise(() => {})),
      };
      const { wsconnect } = await import('@nats-io/nats-core');
      vi.mocked(wsconnect).mockResolvedValue(mockConnection as any);

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
        bufferSize: 100,
      });

      // Wait for background connection
      await vi.advanceTimersByTimeAsync(100);

      service.push({ level: 30, msg: 'test message' });
      service.flush();

      expect(mockPublish).toHaveBeenCalled();
      expect(service.totalPublished).toBe(1);
      expect(service.pendingCount).toBe(0);

      vi.useRealTimers();
    });

    it('should publish multiple buffered entries', async () => {
      vi.useFakeTimers();
      const mockPublish = vi.fn();
      const mockConnection = {
        publish: mockPublish,
        status: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {},
        }),
        closed: vi.fn().mockReturnValue(new Promise(() => {})),
      };
      const { wsconnect } = await import('@nats-io/nats-core');
      vi.mocked(wsconnect).mockResolvedValue(mockConnection as any);

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
        bufferSize: 100,
      });

      await vi.advanceTimersByTimeAsync(100);

      service.push({ level: 30, msg: 'msg1' });
      service.push({ level: 40, msg: 'msg2' });
      service.push({ level: 50, msg: 'msg3' });
      service.flush();

      expect(mockPublish).toHaveBeenCalledTimes(3);
      expect(service.totalPublished).toBe(3);
      expect(service.pendingCount).toBe(0);

      vi.useRealTimers();
    });

    it('should handle publish errors gracefully and drop entries', async () => {
      vi.useFakeTimers();
      const mockPublish = vi.fn().mockImplementation(() => {
        throw new Error('Connection lost');
      });
      const mockConnection = {
        publish: mockPublish,
        status: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {},
        }),
        closed: vi.fn().mockReturnValue(new Promise(() => {})),
      };
      const { wsconnect } = await import('@nats-io/nats-core');
      vi.mocked(wsconnect).mockResolvedValue(mockConnection as any);

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
        bufferSize: 100,
      });

      await vi.advanceTimersByTimeAsync(100);

      service.push({ level: 30, msg: 'will be dropped' });
      service.push({ level: 30, msg: 'also dropped' });

      // flush should not throw even when publish fails
      expect(() => service.flush()).not.toThrow();

      // Entries are dropped, not re-buffered
      expect(service.pendingCount).toBe(0);
      // totalPublished should remain 0 since publish threw
      expect(service.totalPublished).toBe(0);
      // connected should be set to false after publish error
      expect(service.isConnected).toBe(false);

      vi.useRealTimers();
    });

    it('should attempt reconnect when flushing while not connected', async () => {
      vi.useFakeTimers();
      const { wsconnect } = await import('@nats-io/nats-core');
      vi.mocked(wsconnect).mockRejectedValue(new Error('refused'));

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
        bufferSize: 100,
      });

      // Wait for initial connection attempt to fail
      await vi.advanceTimersByTimeAsync(100);

      service.push({ level: 30, msg: 'pending entry' });

      // Clear the call count after initial connect
      vi.mocked(wsconnect).mockClear();
      vi.mocked(wsconnect).mockRejectedValue(new Error('still refused'));

      // Calling flush when not connected should trigger reconnect
      service.flush();
      await vi.advanceTimersByTimeAsync(100);

      // wsconnect should have been called again (reconnect attempt)
      expect(wsconnect).toHaveBeenCalled();
      // Buffer should still be intact since we couldn't connect
      expect(service.pendingCount).toBe(1);

      vi.useRealTimers();
    });

    it('should flush remaining entries on shutdown', async () => {
      vi.useFakeTimers();
      const mockPublish = vi.fn();
      const mockDrain = vi.fn().mockResolvedValue(undefined);
      const mockConnection = {
        publish: mockPublish,
        drain: mockDrain,
        status: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {},
        }),
        closed: vi.fn().mockReturnValue(new Promise(() => {})),
      };
      const { wsconnect } = await import('@nats-io/nats-core');
      vi.mocked(wsconnect).mockResolvedValue(mockConnection as any);

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
        bufferSize: 100,
      });

      await vi.advanceTimersByTimeAsync(100);

      service.push({ level: 30, msg: 'final message' });
      expect(service.pendingCount).toBe(1);

      await service.shutdown();

      // The shutdown calls flush which should publish the buffered entry
      expect(mockPublish).toHaveBeenCalled();
      expect(mockDrain).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should publish correct JSON payload format', async () => {
      vi.useFakeTimers();
      const mockPublish = vi.fn();
      const mockConnection = {
        publish: mockPublish,
        status: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {},
        }),
        closed: vi.fn().mockReturnValue(new Promise(() => {})),
      };
      const { wsconnect } = await import('@nats-io/nats-core');
      vi.mocked(wsconnect).mockResolvedValue(mockConnection as any);

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
        bufferSize: 100,
        metadata: { app: 'test' },
      });

      await vi.advanceTimersByTimeAsync(100);

      service.push({ level: 50, msg: 'error msg', component: 'TestComp', extra: 'data' });
      service.flush();

      expect(mockPublish).toHaveBeenCalledWith('test-logs', expect.any(Uint8Array));

      const payload = mockPublish.mock.calls[0][1];
      const decoded = new TextDecoder().decode(payload);
      const entry = JSON.parse(decoded);

      expect(entry).toHaveProperty('ts');
      expect(entry.level).toBe(50);
      expect(entry.levelName).toBe('error');
      expect(entry.msg).toBe('error msg');
      expect(entry.logger).toBe('TestComp');
      expect(entry.data).toHaveProperty('extra', 'data');
      expect(entry.meta).toEqual({ app: 'test' });
      // ts should be ISO format
      expect(new Date(entry.ts).toISOString()).toBe(entry.ts);

      vi.useRealTimers();
    });
  });

  describe('shutdown', () => {
    it('should clear initialization flag', async () => {
      vi.useFakeTimers();
      const { wsconnect } = await import('@nats-io/nats-core');
      vi.mocked(wsconnect).mockRejectedValue(new Error('refused'));

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
      });

      expect(service.initialized).toBe(true);
      await service.shutdown();
      expect(service.initialized).toBe(false);

      vi.useRealTimers();
    });

    it('should drain connection on shutdown', async () => {
      vi.useFakeTimers();
      const mockDrain = vi.fn().mockResolvedValue(undefined);
      const mockConnection = {
        publish: vi.fn(),
        drain: mockDrain,
        status: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {},
        }),
        closed: vi.fn().mockReturnValue(new Promise(() => {})),
      };
      const { wsconnect } = await import('@nats-io/nats-core');
      vi.mocked(wsconnect).mockResolvedValue(mockConnection as any);

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
      });

      await vi.advanceTimersByTimeAsync(100);
      await service.shutdown();

      expect(mockDrain).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should handle shutdown when not connected', async () => {
      await expect(service.shutdown()).resolves.not.toThrow();
    });

    it('should handle drain error gracefully on shutdown', async () => {
      vi.useFakeTimers();
      const mockDrain = vi.fn().mockRejectedValue(new Error('drain failed'));
      const mockConnection = {
        publish: vi.fn(),
        drain: mockDrain,
        status: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {},
        }),
        closed: vi.fn().mockReturnValue(new Promise(() => {})),
      };
      const { wsconnect } = await import('@nats-io/nats-core');
      vi.mocked(wsconnect).mockResolvedValue(mockConnection as any);

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
      });

      await vi.advanceTimersByTimeAsync(100);

      // shutdown should not throw even when drain fails
      await expect(service.shutdown()).resolves.not.toThrow();
      expect(service.initialized).toBe(false);
      expect(service.isConnected).toBe(false);

      vi.useRealTimers();
    });

    it('should clear flush timer on shutdown', async () => {
      vi.useFakeTimers();
      const { wsconnect } = await import('@nats-io/nats-core');
      vi.mocked(wsconnect).mockRejectedValue(new Error('refused'));

      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
      });

      await service.shutdown();

      expect(clearIntervalSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('connectInBackground', () => {
    it('should not attempt connection when already connecting', async () => {
      vi.useFakeTimers();
      const { wsconnect } = await import('@nats-io/nats-core');
      let resolveConnect: (value: any) => void;
      const connectPromise = new Promise((resolve) => {
        resolveConnect = resolve;
      });
      vi.mocked(wsconnect).mockReturnValue(connectPromise as any);

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
        bufferSize: 100,
      });

      // The initial call starts a connection — calling flush while connecting
      // should not trigger another wsconnect call
      const callCountAfterInit = vi.mocked(wsconnect).mock.calls.length;

      // Push and flush while still connecting
      service.push({ level: 30, msg: 'test' });
      service.flush();

      // wsconnect should NOT have been called again
      expect(vi.mocked(wsconnect).mock.calls.length).toBe(callCountAfterInit);

      // Resolve the connect promise to clean up
      resolveConnect!({
        publish: vi.fn(),
        drain: vi.fn().mockResolvedValue(undefined),
        status: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {},
        }),
        closed: vi.fn().mockReturnValue(new Promise(() => {})),
      });
      await vi.advanceTimersByTimeAsync(100);

      vi.useRealTimers();
    });

    it('should not reconnect when already connected', async () => {
      vi.useFakeTimers();
      const { wsconnect } = await import('@nats-io/nats-core');
      const mockConnection = {
        publish: vi.fn(),
        status: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {},
        }),
        closed: vi.fn().mockReturnValue(new Promise(() => {})),
      };
      vi.mocked(wsconnect).mockResolvedValue(mockConnection as any);

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
        bufferSize: 100,
      });

      await vi.advanceTimersByTimeAsync(100);
      expect(service.isConnected).toBe(true);

      const callCount = vi.mocked(wsconnect).mock.calls.length;

      // Force a flush — should NOT trigger another connect since already connected
      service.push({ level: 30, msg: 'test' });
      service.flush();

      expect(vi.mocked(wsconnect).mock.calls.length).toBe(callCount);

      vi.useRealTimers();
    });

    it('should flush buffered entries after successful connection', async () => {
      vi.useFakeTimers();
      const mockPublish = vi.fn();
      const { wsconnect } = await import('@nats-io/nats-core');

      // First call fails, second succeeds
      vi.mocked(wsconnect)
        .mockRejectedValueOnce(new Error('refused'))
        .mockResolvedValueOnce({
          publish: mockPublish,
          status: vi.fn().mockReturnValue({
            [Symbol.asyncIterator]: async function* () {},
          }),
          closed: vi.fn().mockReturnValue(new Promise(() => {})),
        } as any);

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
        bufferSize: 100,
      });

      // Wait for first (failed) connection attempt
      await vi.advanceTimersByTimeAsync(100);
      expect(service.isConnected).toBe(false);

      // Buffer some entries
      service.push({ level: 30, msg: 'buffered1' });
      service.push({ level: 30, msg: 'buffered2' });

      // Trigger reconnection by calling flush (which calls connectInBackground)
      service.flush();
      await vi.advanceTimersByTimeAsync(100);

      // After reconnection, buffered entries should have been flushed
      expect(service.isConnected).toBe(true);
      expect(mockPublish).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('monitorConnection', () => {
    it('should handle disconnect status event', async () => {
      vi.useFakeTimers();
      const { wsconnect } = await import('@nats-io/nats-core');

      let statusIteratorYield: (value: any) => void;
      const statusEvents: any[] = [];
      const mockConnection = {
        publish: vi.fn(),
        status: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]() {
            return {
              next() {
                return new Promise((resolve) => {
                  statusIteratorYield = (value: any) => {
                    statusEvents.push(value);
                    resolve({ value, done: false });
                  };
                });
              },
              return() {
                return Promise.resolve({ value: undefined, done: true });
              },
            };
          },
        }),
        closed: vi.fn().mockReturnValue(new Promise(() => {})),
      };
      vi.mocked(wsconnect).mockResolvedValue(mockConnection as any);

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
        bufferSize: 100,
      });

      await vi.advanceTimersByTimeAsync(100);
      expect(service.isConnected).toBe(true);

      // Emit disconnect status
      statusIteratorYield!({ type: 'disconnect' });
      await vi.advanceTimersByTimeAsync(0);

      expect(service.isConnected).toBe(false);

      vi.useRealTimers();
    });

    it('should handle reconnect status event and flush buffer', async () => {
      vi.useFakeTimers();
      const { wsconnect } = await import('@nats-io/nats-core');

      const statusQueue: Array<(v: { value: any; done: boolean }) => void> = [];
      const mockPublish = vi.fn();
      const mockConnection = {
        publish: mockPublish,
        status: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]() {
            return {
              next() {
                return new Promise((resolve) => {
                  statusQueue.push(resolve);
                });
              },
              return() {
                return Promise.resolve({ value: undefined, done: true });
              },
            };
          },
        }),
        closed: vi.fn().mockReturnValue(new Promise(() => {})),
      };
      vi.mocked(wsconnect).mockResolvedValue(mockConnection as any);

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
        bufferSize: 100,
      });

      await vi.advanceTimersByTimeAsync(100);

      // Simulate disconnect
      statusQueue[0]({ value: { type: 'disconnect' }, done: false });
      await vi.advanceTimersByTimeAsync(0);
      expect(service.isConnected).toBe(false);

      // Buffer an entry while disconnected
      service.push({ level: 30, msg: 'reconnect test' });

      // Simulate reconnect
      statusQueue[1]({ value: { type: 'reconnect' }, done: false });
      await vi.advanceTimersByTimeAsync(0);

      expect(service.isConnected).toBe(true);
      // Should have flushed the buffered entry
      expect(mockPublish).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should handle reconnecting status event', async () => {
      vi.useFakeTimers();
      const { wsconnect } = await import('@nats-io/nats-core');

      const statusQueue: Array<(v: { value: any; done: boolean }) => void> = [];
      const mockConnection = {
        publish: vi.fn(),
        status: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]() {
            return {
              next() {
                return new Promise((resolve) => {
                  statusQueue.push(resolve);
                });
              },
              return() {
                return Promise.resolve({ value: undefined, done: true });
              },
            };
          },
        }),
        closed: vi.fn().mockReturnValue(new Promise(() => {})),
      };
      vi.mocked(wsconnect).mockResolvedValue(mockConnection as any);

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
        bufferSize: 100,
      });

      await vi.advanceTimersByTimeAsync(100);

      // Emit reconnecting status — should just log debug, not change state
      statusQueue[0]({ value: { type: 'reconnecting' }, done: false });
      await vi.advanceTimersByTimeAsync(0);

      // isConnected should not change for 'reconnecting' event
      expect(service.isConnected).toBe(true);

      vi.useRealTimers();
    });

    it('should handle connection closed with error', async () => {
      vi.useFakeTimers();
      const { wsconnect } = await import('@nats-io/nats-core');

      let resolveClosedPromise: (err: any) => void;
      const closedPromise = new Promise<any>((resolve) => {
        resolveClosedPromise = resolve;
      });

      const mockConnection = {
        publish: vi.fn(),
        status: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {},
        }),
        closed: vi.fn().mockReturnValue(closedPromise),
      };
      vi.mocked(wsconnect).mockResolvedValue(mockConnection as any);

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
        bufferSize: 100,
      });

      await vi.advanceTimersByTimeAsync(100);
      expect(service.isConnected).toBe(true);

      // Simulate connection closed with error
      resolveClosedPromise!(new Error('unexpected close'));
      await vi.advanceTimersByTimeAsync(0);

      expect(service.isConnected).toBe(false);

      vi.useRealTimers();
    });

    it('should handle connection closed without error', async () => {
      vi.useFakeTimers();
      const { wsconnect } = await import('@nats-io/nats-core');

      let resolveClosedPromise: (err: any) => void;
      const closedPromise = new Promise<any>((resolve) => {
        resolveClosedPromise = resolve;
      });

      const mockConnection = {
        publish: vi.fn(),
        status: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {},
        }),
        closed: vi.fn().mockReturnValue(closedPromise),
      };
      vi.mocked(wsconnect).mockResolvedValue(mockConnection as any);

      await service.initialize({
        enabled: true,
        natsUrl: 'ws://localhost:8224',
        topic: 'test-logs',
        bufferSize: 100,
      });

      await vi.advanceTimersByTimeAsync(100);
      expect(service.isConnected).toBe(true);

      // Simulate connection closed without error (null/undefined)
      resolveClosedPromise!(null);
      await vi.advanceTimersByTimeAsync(0);

      expect(service.isConnected).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('ngOnDestroy', () => {
    it('should call shutdown', async () => {
      const shutdownSpy = vi.spyOn(service, 'shutdown').mockResolvedValue();
      service.ngOnDestroy();
      expect(shutdownSpy).toHaveBeenCalled();
    });
  });

  describe('levelName (static)', () => {
    // Access the private static method
    const levelName = (level: number): string =>
      (RemoteLoggerService as any).levelName(level);

    it('should return "fatal" for level >= 60', () => {
      expect(levelName(60)).toBe('fatal');
      expect(levelName(70)).toBe('fatal');
    });

    it('should return "error" for level 50-59', () => {
      expect(levelName(50)).toBe('error');
      expect(levelName(59)).toBe('error');
    });

    it('should return "warn" for level 40-49', () => {
      expect(levelName(40)).toBe('warn');
      expect(levelName(49)).toBe('warn');
    });

    it('should return "info" for level 30-39', () => {
      expect(levelName(30)).toBe('info');
      expect(levelName(39)).toBe('info');
    });

    it('should return "debug" for level 20-29', () => {
      expect(levelName(20)).toBe('debug');
      expect(levelName(29)).toBe('debug');
    });

    it('should return "trace" for level < 20', () => {
      expect(levelName(10)).toBe('trace');
      expect(levelName(0)).toBe('trace');
      expect(levelName(19)).toBe('trace');
    });
  });
});
