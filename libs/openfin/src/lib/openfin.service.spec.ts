import { TestBed } from '@angular/core/testing';
import { OpenFinService, OpenFinConnectionStatus } from './openfin.service';
import { DEFAULT_OPENFIN_CONFIG } from './openfin-config.interface';
import { LoggerService, RemoteLoggerService } from '@rates-trading/logger';
import { WorkspaceStorageService } from '@rates-trading/shared-utils';
import { firstValueFrom } from 'rxjs';

// Mock @openfin/core-web — all mock objects MUST be defined INSIDE the factory
vi.mock('@openfin/core-web', () => ({
  connect: vi.fn(),
}));

/**
 * Helper: get the mocked `connect` function from the mocked module.
 * Must be called AFTER the mock is in effect (inside tests).
 */
async function getMockConnect() {
  const mod = await import('@openfin/core-web');
  return mod.connect as ReturnType<typeof vi.fn>;
}

describe('OpenFinService', () => {
  let service: OpenFinService;
  let mockLogger: any;
  let mockRemoteLogger: any;
  let mockWorkspaceStorage: any;
  let childLogger: any;

  beforeEach(() => {
    // Clean up any window.fin from previous tests
    delete (window as any).fin;

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

    mockRemoteLogger = {
      initialized: false,
      flush: vi.fn(),
      push: vi.fn(),
    };

    mockWorkspaceStorage = {
      saveState: vi.fn(),
      loadState: vi.fn(),
      removeState: vi.fn(),
      collectAllStates: vi.fn().mockReturnValue({}),
      restoreAllStates: vi.fn(),
      clearAllStates: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        OpenFinService,
        { provide: LoggerService, useValue: mockLogger },
        { provide: RemoteLoggerService, useValue: mockRemoteLogger },
        { provide: WorkspaceStorageService, useValue: mockWorkspaceStorage },
      ],
    });

    service = TestBed.inject(OpenFinService);
    childLogger = mockLogger.child.mock.results[0].value;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    delete (window as any).fin;
  });

  // ────────────────────────────────────────────────────────
  // Helper to build a mock fin API object
  // ────────────────────────────────────────────────────────
  function buildMockFinApi(overrides?: any) {
    return {
      Platform: {
        Layout: {
          init: vi.fn().mockResolvedValue(undefined),
          getCurrentSync: vi.fn().mockReturnValue({
            addView: vi.fn().mockResolvedValue(undefined),
            getConfig: vi.fn().mockResolvedValue({ content: [] }),
            replace: vi.fn().mockResolvedValue(undefined),
          }),
        },
      },
      Interop: {
        init: vi.fn().mockResolvedValue(undefined),
      },
      me: {
        interop: {
          setContext: vi.fn().mockResolvedValue(undefined),
          addContextHandler: vi.fn().mockResolvedValue(undefined),
        },
      },
      InterApplicationBus: {
        Channel: {
          connect: vi.fn().mockResolvedValue({ id: 'mock-channel' }),
        },
      },
      ...overrides,
    };
  }

  // ────────────────────────────────────────────────────────
  // Initial state
  // ────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should not be connected initially', () => {
      expect(service.isConnected).toBe(false);
    });

    it('should have null fin API initially', () => {
      expect(service.fin).toBeNull();
    });

    it('should have disabled config by default', () => {
      expect(service.isEnabled).toBe(false);
    });

    it('should start with disconnected connection status', async () => {
      const status = await firstValueFrom(service.connectionStatus$);
      expect(status).toBe(OpenFinConnectionStatus.Disconnected);
    });
  });

  // ────────────────────────────────────────────────────────
  // initialize
  // ────────────────────────────────────────────────────────

  describe('initialize', () => {
    it('should update config with provided values', () => {
      service.initialize({
        enabled: true,
        brokerUrl: '/broker.html',
        providerId: 'test-provider',
      });

      expect(service.isEnabled).toBe(true);
    });

    it('should merge with default config', () => {
      service.initialize({ enabled: true });
      expect(service.isEnabled).toBe(true);
    });

    it('should log initialization with providerId', () => {
      service.initialize({ enabled: true, providerId: 'my-provider' });
      expect(childLogger.info).toHaveBeenCalledWith(
        { providerId: 'my-provider' },
        'OpenFin service initialized',
      );
    });
  });

  // ────────────────────────────────────────────────────────
  // environment detection
  // ────────────────────────────────────────────────────────

  describe('environment detection', () => {
    it('should return "browser" when config is disabled', () => {
      expect(service.environment).toBe('browser');
    });

    it('should return "web" when config is enabled and no window.fin', () => {
      service.initialize({ enabled: true });
      expect(service.environment).toBe('web');
    });

    it('should detect inside layout (iframe check)', () => {
      expect(service.isInsideLayout).toBe(false);
    });

    it('should return false for isContainer when in browser mode', () => {
      expect(service.isContainer).toBe(false);
    });

    it('should return false for isPlatform when in browser mode', () => {
      expect(service.isPlatform).toBe(false);
    });

    it('should return "container" when window.fin exists without platform mode', () => {
      (window as any).fin = { Window: { create: vi.fn() }, me: {} };
      expect(service.environment).toBe('container');
    });

    it('should return "platform" when fin.me.isView is true', () => {
      (window as any).fin = { Window: { create: vi.fn() }, me: { isView: true } };
      expect(service.environment).toBe('platform');
    });

    it('should return true for isContainer when in container mode', () => {
      (window as any).fin = { Window: { create: vi.fn() }, me: {} };
      expect(service.isContainer).toBe(true);
    });

    it('should return true for isContainer when in platform mode', () => {
      (window as any).fin = { Window: { create: vi.fn() }, me: { isView: true } };
      expect(service.isContainer).toBe(true);
    });

    it('should return true for isPlatform when in platform mode', () => {
      (window as any).fin = { Window: { create: vi.fn() }, me: { isView: true } };
      expect(service.isPlatform).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────
  // connectToBroker
  // ────────────────────────────────────────────────────────

  describe('connectToBroker', () => {
    it('should return null when OpenFin is disabled', async () => {
      const container = document.createElement('div');
      const result = await service.connectToBroker(container);
      expect(result).toBeNull();
    });

    it('should return existing fin API when already connected', async () => {
      service.initialize({ enabled: true });

      const mockFin = buildMockFinApi();
      (service as any).finApi = mockFin;
      (service as any).connectionStatusSubject.next(OpenFinConnectionStatus.Connected);

      const container = document.createElement('div');
      const result = await service.connectToBroker(container);
      expect(result).toBe(mockFin);
    });

    it('should connect successfully with empty layout when no saved layouts', async () => {
      service.initialize({ enabled: true, brokerUrl: 'https://broker.test/broker.html', providerId: 'test' });

      const mockFin = buildMockFinApi();
      const mockConnect = await getMockConnect();
      mockConnect.mockResolvedValue(mockFin);

      const container = document.createElement('div');
      const result = await service.connectToBroker(container);

      expect(result).toBe(mockFin);
      expect(service.isConnected).toBe(true);
      expect(service.fin).toBe(mockFin);
      expect(mockConnect).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionInheritance: 'enabled',
          options: expect.objectContaining({
            brokerUrl: 'https://broker.test/broker.html',
            interopConfig: expect.objectContaining({
              providerId: 'test',
            }),
          }),
        }),
      );
    });

    it('should restore a pending layout from localStorage', async () => {
      service.initialize({ enabled: true, brokerUrl: 'https://broker.test/broker.html' });

      const pendingLayout = { name: 'my-layout', snapshot: { content: [{ type: 'row' }] } };
      localStorage.setItem('openfin-pending-restore', JSON.stringify(pendingLayout));

      const mockFin = buildMockFinApi();
      const mockConnect = await getMockConnect();
      mockConnect.mockResolvedValue(mockFin);

      const container = document.createElement('div');
      await service.connectToBroker(container);

      // Pending restore key should be cleared
      expect(localStorage.getItem('openfin-pending-restore')).toBeNull();

      // connect should have been called with the restored layout
      expect(mockConnect).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: {
            layoutSnapshot: {
              layouts: { default: pendingLayout.snapshot },
            },
          },
        }),
      );
    });

    it('should fall back to default layout when pending restore JSON is invalid', async () => {
      service.initialize({ enabled: true, brokerUrl: 'https://broker.test/broker.html' });

      localStorage.setItem('openfin-pending-restore', 'INVALID JSON');

      const mockFin = buildMockFinApi();
      const mockConnect = await getMockConnect();
      mockConnect.mockResolvedValue(mockFin);

      const container = document.createElement('div');
      await service.connectToBroker(container);

      // Should still connect (falling back to empty layout)
      expect(service.isConnected).toBe(true);
      expect(childLogger.warn).toHaveBeenCalledWith(
        'Failed to parse pending layout restore, falling back to default',
      );
    });

    it('should auto-restore the last-used layout on startup', async () => {
      service.initialize({ enabled: true, brokerUrl: 'https://broker.test/broker.html' });

      // Set up a saved layout and a last-used reference
      const savedLayouts = [
        { name: 'AutoRestore', timestamp: Date.now(), snapshot: { content: [{ type: 'column' }] }, env: 'web' },
      ];
      localStorage.setItem('openfin-saved-layouts', JSON.stringify(savedLayouts));
      localStorage.setItem('openfin-last-layout', JSON.stringify({ web: 'AutoRestore' }));

      const mockFin = buildMockFinApi();
      const mockConnect = await getMockConnect();
      mockConnect.mockResolvedValue(mockFin);

      const container = document.createElement('div');
      await service.connectToBroker(container);

      expect(mockConnect).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: {
            layoutSnapshot: {
              layouts: { default: savedLayouts[0].snapshot },
            },
          },
        }),
      );
    });

    it('should restore componentStates when auto-restoring last-used layout', async () => {
      service.initialize({ enabled: true, brokerUrl: 'https://broker.test/broker.html' });

      const savedLayouts = [
        {
          name: 'WithStates',
          timestamp: Date.now(),
          snapshot: { content: [] },
          env: 'web',
          componentStates: { 'blotter-1': { columns: ['a', 'b'] } },
        },
      ];
      localStorage.setItem('openfin-saved-layouts', JSON.stringify(savedLayouts));
      localStorage.setItem('openfin-last-layout', JSON.stringify({ web: 'WithStates' }));

      const mockFin = buildMockFinApi();
      const mockConnect = await getMockConnect();
      mockConnect.mockResolvedValue(mockFin);

      const container = document.createElement('div');
      await service.connectToBroker(container);

      expect(mockWorkspaceStorage.restoreAllStates).toHaveBeenCalledWith({
        'blotter-1': { columns: ['a', 'b'] },
      });
    });

    it('should clear stale last-layout reference if the saved layout was deleted', async () => {
      service.initialize({ enabled: true, brokerUrl: 'https://broker.test/broker.html' });

      // last-layout references a layout that no longer exists in saved layouts
      localStorage.setItem('openfin-saved-layouts', JSON.stringify([]));
      localStorage.setItem('openfin-last-layout', JSON.stringify({ web: 'Deleted Layout' }));

      const mockFin = buildMockFinApi();
      const mockConnect = await getMockConnect();
      mockConnect.mockResolvedValue(mockFin);

      const container = document.createElement('div');
      await service.connectToBroker(container);

      // The stale reference should be cleared
      const lastMap = JSON.parse(localStorage.getItem('openfin-last-layout')!);
      expect(lastMap.web).toBeUndefined();
    });

    it('should fetch the default layout from config URL when no saved layout', async () => {
      service.initialize({
        enabled: true,
        brokerUrl: 'https://broker.test/broker.html',
        layoutUrl: '/assets/layout.json',
      });

      const fetchedLayout = { layouts: { default: { content: [{ type: 'stack' }] } } };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(fetchedLayout),
      } as any);

      const mockFin = buildMockFinApi();
      const mockConnect = await getMockConnect();
      mockConnect.mockResolvedValue(mockFin);

      const container = document.createElement('div');
      await service.connectToBroker(container);

      expect(mockConnect).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: { layoutSnapshot: fetchedLayout },
        }),
      );
    });

    it('should use empty layout when fetch fails', async () => {
      service.initialize({
        enabled: true,
        brokerUrl: 'https://broker.test/broker.html',
        layoutUrl: '/assets/layout.json',
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
      } as any);

      const mockFin = buildMockFinApi();
      const mockConnect = await getMockConnect();
      mockConnect.mockResolvedValue(mockFin);

      const container = document.createElement('div');
      await service.connectToBroker(container);

      // Should connect with empty layout
      expect(mockConnect).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: {
            layoutSnapshot: { layouts: { default: { content: [] } } },
          },
        }),
      );
    });

    it('should use empty layout when fetch throws a network error', async () => {
      service.initialize({
        enabled: true,
        brokerUrl: 'https://broker.test/broker.html',
        layoutUrl: '/assets/layout.json',
      });

      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

      const mockFin = buildMockFinApi();
      const mockConnect = await getMockConnect();
      mockConnect.mockResolvedValue(mockFin);

      const container = document.createElement('div');
      await service.connectToBroker(container);

      expect(service.isConnected).toBe(true);
    });

    it('should handle Interop.init failure gracefully', async () => {
      service.initialize({ enabled: true, brokerUrl: 'https://broker.test/broker.html' });

      const mockFin = buildMockFinApi();
      mockFin.Interop.init.mockRejectedValue(new Error('Channel already exists'));

      const mockConnect = await getMockConnect();
      mockConnect.mockResolvedValue(mockFin);

      const container = document.createElement('div');
      const result = await service.connectToBroker(container);

      // Should still succeed despite Interop.init failure
      expect(result).toBe(mockFin);
      expect(service.isConnected).toBe(true);
      expect(childLogger.warn).toHaveBeenCalledWith(
        'Interop.init failed (broker channel may already exist from previous session), continuing...',
      );
    });

    it('should set error status and throw when connect() fails', async () => {
      service.initialize({ enabled: true, brokerUrl: 'https://broker.test/broker.html' });

      const mockConnect = await getMockConnect();
      mockConnect.mockRejectedValue(new Error('Connection refused'));

      const container = document.createElement('div');
      await expect(service.connectToBroker(container)).rejects.toThrow('Connection refused');

      const status = await firstValueFrom(service.connectionStatus$);
      expect(status).toBe(OpenFinConnectionStatus.Error);
    });

    it('should set status to Connecting before attempting connection', async () => {
      service.initialize({ enabled: true, brokerUrl: 'https://broker.test/broker.html' });

      const statuses: OpenFinConnectionStatus[] = [];
      service.connectionStatus$.subscribe((s) => statuses.push(s));

      const mockFin = buildMockFinApi();
      const mockConnect = await getMockConnect();
      mockConnect.mockResolvedValue(mockFin);

      const container = document.createElement('div');
      await service.connectToBroker(container);

      expect(statuses).toContain(OpenFinConnectionStatus.Connecting);
      expect(statuses).toContain(OpenFinConnectionStatus.Connected);
    });

    it('should resolve relative broker URL to absolute', async () => {
      service.initialize({ enabled: true, brokerUrl: '/broker.html' });

      const mockFin = buildMockFinApi();
      const mockConnect = await getMockConnect();
      mockConnect.mockResolvedValue(mockFin);

      const container = document.createElement('div');
      await service.connectToBroker(container);

      const callArgs = mockConnect.mock.calls[0][0];
      expect(callArgs.options.brokerUrl).toMatch(/^https?:\/\//);
      expect(callArgs.options.brokerUrl).toContain('/broker.html');
    });
  });

  // ────────────────────────────────────────────────────────
  // connectAsView
  // ────────────────────────────────────────────────────────

  describe('connectAsView', () => {
    it('should return null when OpenFin is disabled', async () => {
      const result = await service.connectAsView();
      expect(result).toBeNull();
    });

    it('should return existing fin API when already connected', async () => {
      service.initialize({ enabled: true });
      const mockFin = {};
      (service as any).finApi = mockFin;
      (service as any).connectionStatusSubject.next(OpenFinConnectionStatus.Connected);

      const result = await service.connectAsView();
      expect(result).toBe(mockFin);
    });

    it('should connect successfully as a view', async () => {
      service.initialize({ enabled: true });

      const mockFin = buildMockFinApi();
      const mockConnect = await getMockConnect();
      mockConnect.mockResolvedValue(mockFin);

      const result = await service.connectAsView();

      expect(result).toBe(mockFin);
      expect(service.isConnected).toBe(true);
      expect(mockConnect).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionInheritance: 'enabled',
        }),
      );
    });

    it('should set error status and throw when view connect fails', async () => {
      service.initialize({ enabled: true });

      const mockConnect = await getMockConnect();
      mockConnect.mockRejectedValue(new Error('View connect failed'));

      await expect(service.connectAsView()).rejects.toThrow('View connect failed');

      const status = await firstValueFrom(service.connectionStatus$);
      expect(status).toBe(OpenFinConnectionStatus.Error);
    });

    it('should transition through Connecting status', async () => {
      service.initialize({ enabled: true });

      const statuses: OpenFinConnectionStatus[] = [];
      service.connectionStatus$.subscribe((s) => statuses.push(s));

      const mockFin = buildMockFinApi();
      const mockConnect = await getMockConnect();
      mockConnect.mockResolvedValue(mockFin);

      await service.connectAsView();

      expect(statuses).toContain(OpenFinConnectionStatus.Connecting);
      expect(statuses).toContain(OpenFinConnectionStatus.Connected);
    });
  });

  // ────────────────────────────────────────────────────────
  // addView
  // ────────────────────────────────────────────────────────

  describe('addView', () => {
    it('should log error when not initialized', async () => {
      await service.addView('test-view', '/test.html');
      expect(childLogger.error).toHaveBeenCalledWith('Cannot add view: OpenFin not initialized');
    });

    it('should add a view when connected', async () => {
      const mockFin = buildMockFinApi();
      (service as any).finApi = mockFin;

      await service.addView('my-view', 'https://example.com/view.html');

      const layout = mockFin.Platform.Layout.getCurrentSync();
      expect(layout.addView).toHaveBeenCalledWith({
        name: 'my-view',
        url: 'https://example.com/view.html',
      });
      expect(childLogger.info).toHaveBeenCalledWith(
        { name: 'my-view', url: 'https://example.com/view.html' },
        'View added to layout',
      );
    });

    it('should resolve relative URLs when adding a view', async () => {
      const mockFin = buildMockFinApi();
      (service as any).finApi = mockFin;

      await service.addView('my-view', '/view.html');

      const layout = mockFin.Platform.Layout.getCurrentSync();
      const call = layout.addView.mock.calls[0][0];
      expect(call.url).toMatch(/^https?:\/\//);
      expect(call.url).toContain('/view.html');
    });

    it('should handle addView errors gracefully', async () => {
      const mockFin = buildMockFinApi();
      const layout = mockFin.Platform.Layout.getCurrentSync();
      layout.addView.mockRejectedValue(new Error('Layout error'));
      (service as any).finApi = mockFin;

      await service.addView('my-view', '/view.html');

      expect(childLogger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Failed to add view to layout',
      );
    });
  });

  // ────────────────────────────────────────────────────────
  // disconnect
  // ────────────────────────────────────────────────────────

  describe('disconnect', () => {
    it('should set status to disconnected', async () => {
      await service.disconnect();
      expect(service.isConnected).toBe(false);
    });

    it('should clear fin API', async () => {
      (service as any).finApi = { something: true };
      await service.disconnect();
      expect(service.fin).toBeNull();
    });

    it('should emit disconnected status', async () => {
      await service.disconnect();
      const status = await firstValueFrom(service.connectionStatus$);
      expect(status).toBe(OpenFinConnectionStatus.Disconnected);
    });
  });

  // ────────────────────────────────────────────────────────
  // markContainerConnected
  // ────────────────────────────────────────────────────────

  describe('markContainerConnected', () => {
    it('should set status to connected', () => {
      service.markContainerConnected();
      expect(service.isConnected).toBe(true);
    });

    it('should emit connected status', async () => {
      service.markContainerConnected();
      const status = await firstValueFrom(service.connectionStatus$);
      expect(status).toBe(OpenFinConnectionStatus.Connected);
    });
  });

  // ────────────────────────────────────────────────────────
  // setContext
  // ────────────────────────────────────────────────────────

  describe('setContext', () => {
    it('should warn when not connected', async () => {
      await service.setContext({ type: 'fdc3.instrument' });
      expect(childLogger.warn).toHaveBeenCalledWith('Cannot set context: not connected to OpenFin');
    });

    it('should set context when connected', async () => {
      const mockFin = buildMockFinApi();
      (service as any).finApi = mockFin;

      const ctx = { type: 'fdc3.instrument', id: { ticker: '10Y' } };
      await service.setContext(ctx);

      expect(mockFin.me.interop.setContext).toHaveBeenCalledWith(ctx);
      expect(childLogger.debug).toHaveBeenCalledWith(
        { context: ctx },
        'Interop context set',
      );
    });

    it('should handle setContext errors gracefully', async () => {
      const mockFin = buildMockFinApi();
      mockFin.me.interop.setContext.mockRejectedValue(new Error('Interop error'));
      (service as any).finApi = mockFin;

      await service.setContext({ type: 'fdc3.instrument' });

      expect(childLogger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Failed to set interop context',
      );
    });
  });

  // ────────────────────────────────────────────────────────
  // addContextListener
  // ────────────────────────────────────────────────────────

  describe('addContextListener', () => {
    it('should warn when not connected', async () => {
      await service.addContextListener(vi.fn());
      expect(childLogger.warn).toHaveBeenCalledWith('Cannot add context listener: not connected to OpenFin');
    });

    it('should add a context handler when connected', async () => {
      const mockFin = buildMockFinApi();
      (service as any).finApi = mockFin;

      const handler = vi.fn();
      await service.addContextListener(handler, 'fdc3.instrument');

      expect(mockFin.me.interop.addContextHandler).toHaveBeenCalledWith(handler, 'fdc3.instrument');
      expect(childLogger.debug).toHaveBeenCalledWith(
        { contextType: 'fdc3.instrument' },
        'Interop context listener added',
      );
    });

    it('should add a context handler without contextType', async () => {
      const mockFin = buildMockFinApi();
      (service as any).finApi = mockFin;

      const handler = vi.fn();
      await service.addContextListener(handler);

      expect(mockFin.me.interop.addContextHandler).toHaveBeenCalledWith(handler, undefined);
    });

    it('should handle addContextHandler errors gracefully', async () => {
      const mockFin = buildMockFinApi();
      mockFin.me.interop.addContextHandler.mockRejectedValue(new Error('Handler error'));
      (service as any).finApi = mockFin;

      await service.addContextListener(vi.fn());

      expect(childLogger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Failed to add context listener',
      );
    });
  });

  // ────────────────────────────────────────────────────────
  // getChannel
  // ────────────────────────────────────────────────────────

  describe('getChannel', () => {
    it('should throw when not connected', async () => {
      await expect(service.getChannel('test-channel')).rejects.toThrow(
        'Not connected to OpenFin',
      );
    });

    it('should return a channel when connected', async () => {
      const mockFin = buildMockFinApi();
      (service as any).finApi = mockFin;

      const channel = await service.getChannel('my-channel');

      expect(mockFin.InterApplicationBus.Channel.connect).toHaveBeenCalledWith('my-channel');
      expect(channel).toEqual({ id: 'mock-channel' });
    });
  });

  // ────────────────────────────────────────────────────────
  // layout persistence
  // ────────────────────────────────────────────────────────

  describe('layout persistence', () => {
    it('should return empty array when no layouts are saved', () => {
      const layouts = service.getSavedLayouts();
      expect(layouts).toEqual([]);
    });

    it('should return empty array when localStorage contains invalid JSON', () => {
      localStorage.setItem('openfin-saved-layouts', 'NOT VALID JSON');
      const layouts = service.getSavedLayouts();
      expect(layouts).toEqual([]);
    });

    it('should delete a layout by name', () => {
      localStorage.setItem(
        'openfin-saved-layouts',
        JSON.stringify([{ name: 'test', timestamp: Date.now(), snapshot: {}, env: 'browser' }]),
      );

      service.deleteLayout('test');

      const raw = localStorage.getItem('openfin-saved-layouts');
      const parsed = JSON.parse(raw!);
      expect(parsed.find((l: any) => l.name === 'test' && l.env === 'browser')).toBeUndefined();
    });

    it('should clear last layout reference when deleting the last-used layout', () => {
      localStorage.setItem(
        'openfin-saved-layouts',
        JSON.stringify([{ name: 'MyLayout', timestamp: Date.now(), snapshot: {}, env: 'browser' }]),
      );
      service.setLastLayout('MyLayout');
      expect(service.getLastLayoutName()).toBe('MyLayout');

      service.deleteLayout('MyLayout');

      expect(service.getLastLayoutName()).toBeNull();
    });

    it('should not clear last layout reference when deleting a different layout', () => {
      localStorage.setItem(
        'openfin-saved-layouts',
        JSON.stringify([
          { name: 'Layout1', timestamp: Date.now(), snapshot: {}, env: 'browser' },
          { name: 'Layout2', timestamp: Date.now(), snapshot: {}, env: 'browser' },
        ]),
      );
      service.setLastLayout('Layout1');

      service.deleteLayout('Layout2');

      expect(service.getLastLayoutName()).toBe('Layout1');
    });

    it('should only return layouts for the current environment', () => {
      localStorage.setItem(
        'openfin-saved-layouts',
        JSON.stringify([
          { name: 'web-layout', timestamp: 1, snapshot: {}, env: 'web' },
          { name: 'browser-layout', timestamp: 2, snapshot: {}, env: 'browser' },
          { name: 'container-layout', timestamp: 3, snapshot: {}, env: 'container' },
        ]),
      );

      // In test environment (no window.fin, config disabled) => browser
      const layouts = service.getSavedLayouts();
      expect(layouts).toHaveLength(1);
      expect(layouts[0].name).toBe('browser-layout');
    });
  });

  // ────────────────────────────────────────────────────────
  // saveLayout
  // ────────────────────────────────────────────────────────

  describe('saveLayout', () => {
    it('should save a core-web layout when finApi is set', async () => {
      const mockFin = buildMockFinApi();
      (service as any).finApi = mockFin;

      await service.saveLayout('Test Layout');

      const raw = localStorage.getItem('openfin-saved-layouts');
      expect(raw).not.toBeNull();
      const layouts = JSON.parse(raw!);
      expect(layouts).toHaveLength(1);
      expect(layouts[0].name).toBe('Test Layout');
      expect(layouts[0].env).toBe('browser');
      expect(layouts[0].componentStates).toEqual({});
    });

    it('should replace an existing layout with the same name and env', async () => {
      const mockFin = buildMockFinApi();
      (service as any).finApi = mockFin;

      await service.saveLayout('MyLayout');
      await service.saveLayout('MyLayout');

      const raw = localStorage.getItem('openfin-saved-layouts');
      const layouts = JSON.parse(raw!);
      expect(layouts.filter((l: any) => l.name === 'MyLayout' && l.env === 'browser')).toHaveLength(1);
    });

    it('should record as last-used layout after saving', async () => {
      const mockFin = buildMockFinApi();
      (service as any).finApi = mockFin;

      await service.saveLayout('My Saved Layout');

      expect(service.getLastLayoutName()).toBe('My Saved Layout');
    });

    it('should log error when not initialized in any mode', async () => {
      // finApi is null, and no window.fin
      await service.saveLayout('Test');

      expect(childLogger.error).toHaveBeenCalledWith('Cannot save layout: OpenFin not initialized');
    });

    it('should save a container layout via captureContainerSnapshot', async () => {
      const mockChildWin = {
        getOptions: vi.fn().mockResolvedValue({ name: 'child1', url: 'https://example.com/child' }),
        getBounds: vi.fn().mockResolvedValue({ top: 10, left: 20, width: 800, height: 600 }),
        identity: { name: 'child1' },
      };
      (window as any).fin = {
        Window: { create: vi.fn() },
        me: {},
        Application: {
          getCurrentSync: vi.fn().mockReturnValue({
            getChildWindows: vi.fn().mockResolvedValue([mockChildWin]),
          }),
        },
      };

      await service.saveLayout('Container Layout');

      const raw = localStorage.getItem('openfin-saved-layouts');
      const layouts = JSON.parse(raw!);
      expect(layouts).toHaveLength(1);
      expect(layouts[0].name).toBe('Container Layout');
      expect(layouts[0].env).toBe('container');
      expect(layouts[0].snapshot).toEqual([
        { name: 'child1', url: 'https://example.com/child', top: 10, left: 20, width: 800, height: 600 },
      ]);
    });

    it('should save a platform layout via getSnapshot', async () => {
      const mockSnapshot = { windows: [{ name: 'main' }] };
      (window as any).fin = {
        Window: { create: vi.fn() },
        me: { isView: true },
        Platform: {
          getCurrentSync: vi.fn().mockReturnValue({
            getSnapshot: vi.fn().mockResolvedValue(mockSnapshot),
          }),
        },
      };

      await service.saveLayout('Platform Layout');

      const raw = localStorage.getItem('openfin-saved-layouts');
      const layouts = JSON.parse(raw!);
      expect(layouts).toHaveLength(1);
      expect(layouts[0].name).toBe('Platform Layout');
      expect(layouts[0].env).toBe('platform');
      expect(layouts[0].snapshot).toEqual(mockSnapshot);
    });

    it('should handle captureContainerSnapshot errors for individual windows', async () => {
      const goodWin = {
        getOptions: vi.fn().mockResolvedValue({ name: 'good', url: 'https://example.com' }),
        getBounds: vi.fn().mockResolvedValue({ top: 0, left: 0, width: 400, height: 300 }),
        identity: { name: 'good' },
      };
      const badWin = {
        getOptions: vi.fn().mockRejectedValue(new Error('Window closed')),
        getBounds: vi.fn().mockRejectedValue(new Error('Window closed')),
      };
      (window as any).fin = {
        Window: { create: vi.fn() },
        me: {},
        Application: {
          getCurrentSync: vi.fn().mockReturnValue({
            getChildWindows: vi.fn().mockResolvedValue([goodWin, badWin]),
          }),
        },
      };

      await service.saveLayout('Partial');

      const raw = localStorage.getItem('openfin-saved-layouts');
      const layouts = JSON.parse(raw!);
      // Only the good window should be captured
      expect(layouts[0].snapshot).toHaveLength(1);
      expect(layouts[0].snapshot[0].name).toBe('good');
    });

    it('should handle save errors gracefully', async () => {
      const mockFin = buildMockFinApi();
      const layout = mockFin.Platform.Layout.getCurrentSync();
      layout.getConfig.mockRejectedValue(new Error('getConfig failed'));
      (service as any).finApi = mockFin;

      await service.saveLayout('Fail');

      expect(childLogger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Failed to save layout',
      );
    });
  });

  // ────────────────────────────────────────────────────────
  // restoreLayout
  // ────────────────────────────────────────────────────────

  describe('restoreLayout', () => {
    it('should warn if no layout found with that name', async () => {
      await service.restoreLayout('nonexistent');

      expect(childLogger.warn).toHaveBeenCalledWith(
        { name: 'nonexistent' },
        'No saved layout found with this name',
      );
    });

    it('should restore a container layout by closing and recreating windows', async () => {
      const existingWin = { close: vi.fn().mockResolvedValue(undefined) };
      (window as any).fin = {
        Window: {
          create: vi.fn().mockResolvedValue({}),
        },
        me: {},
        Application: {
          getCurrentSync: vi.fn().mockReturnValue({
            getChildWindows: vi.fn().mockResolvedValue([existingWin]),
          }),
        },
      };

      const entries = [
        { name: 'win1', url: 'https://example.com/win1', top: 0, left: 0, width: 800, height: 600 },
      ];
      localStorage.setItem(
        'openfin-saved-layouts',
        JSON.stringify([
          { name: 'ContainerLayout', timestamp: Date.now(), snapshot: entries, env: 'container' },
        ]),
      );

      await service.restoreLayout('ContainerLayout');

      // Existing windows should be closed
      expect(existingWin.close).toHaveBeenCalledWith(true);
      // New window should be created
      expect((window as any).fin.Window.create).toHaveBeenCalled();
    });

    it('should warn when container snapshot has no entries', async () => {
      (window as any).fin = {
        Window: { create: vi.fn() },
        me: {},
        Application: {
          getCurrentSync: vi.fn().mockReturnValue({
            getChildWindows: vi.fn().mockResolvedValue([]),
          }),
        },
      };

      localStorage.setItem(
        'openfin-saved-layouts',
        JSON.stringify([
          { name: 'Empty', timestamp: Date.now(), snapshot: [], env: 'container' },
        ]),
      );

      await service.restoreLayout('Empty');

      expect(childLogger.warn).toHaveBeenCalledWith('No windows in saved container snapshot');
    });

    it('should restore a platform layout via applySnapshot', async () => {
      const mockApplySnapshot = vi.fn().mockResolvedValue(undefined);
      (window as any).fin = {
        Window: { create: vi.fn() },
        me: { isView: true },
        Platform: {
          getCurrentSync: vi.fn().mockReturnValue({
            applySnapshot: mockApplySnapshot,
          }),
        },
      };

      const snap = { windows: [{ name: 'main' }] };
      localStorage.setItem(
        'openfin-saved-layouts',
        JSON.stringify([
          { name: 'PlatformLayout', timestamp: Date.now(), snapshot: snap, env: 'platform' },
        ]),
      );

      await service.restoreLayout('PlatformLayout');

      expect(mockApplySnapshot).toHaveBeenCalledWith(snap, { closeExistingWindows: true });
    });

    it('should handle platform applySnapshot errors', async () => {
      const mockApplySnapshot = vi.fn().mockRejectedValue(new Error('Snapshot failed'));
      (window as any).fin = {
        Window: { create: vi.fn() },
        me: { isView: true },
        Platform: {
          getCurrentSync: vi.fn().mockReturnValue({
            applySnapshot: mockApplySnapshot,
          }),
        },
      };

      localStorage.setItem(
        'openfin-saved-layouts',
        JSON.stringify([
          { name: 'BadSnap', timestamp: Date.now(), snapshot: {}, env: 'platform' },
        ]),
      );

      await service.restoreLayout('BadSnap');

      expect(childLogger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Failed to restore platform snapshot',
      );
    });

    it('should handle restoreContainerSnapshot errors for individual windows', async () => {
      (window as any).fin = {
        Window: {
          create: vi.fn()
            .mockResolvedValueOnce({})
            .mockRejectedValueOnce(new Error('Create failed')),
        },
        me: {},
        Application: {
          getCurrentSync: vi.fn().mockReturnValue({
            getChildWindows: vi.fn().mockResolvedValue([]),
          }),
        },
      };

      const entries = [
        { name: 'win1', url: 'https://example.com/1', top: 0, left: 0, width: 800, height: 600 },
        { name: 'win2', url: 'https://example.com/2', top: 0, left: 0, width: 800, height: 600 },
      ];
      localStorage.setItem(
        'openfin-saved-layouts',
        JSON.stringify([
          { name: 'MultiWin', timestamp: Date.now(), snapshot: entries, env: 'container' },
        ]),
      );

      await service.restoreLayout('MultiWin');

      // Should have attempted to create both windows
      expect((window as any).fin.Window.create).toHaveBeenCalledTimes(2);
      // Error logged for the second window
      expect(childLogger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Failed to recreate window',
      );
    });
  });

  // ────────────────────────────────────────────────────────
  // last layout tracking
  // ────────────────────────────────────────────────────────

  describe('last layout tracking', () => {
    it('should return null when no last layout is set', () => {
      expect(service.getLastLayoutName()).toBeNull();
    });

    it('should set and get last layout name', () => {
      service.setLastLayout('My Layout');
      expect(service.getLastLayoutName()).toBe('My Layout');
    });

    it('should clear last layout', () => {
      service.setLastLayout('My Layout');
      service.clearLastLayout();
      expect(service.getLastLayoutName()).toBeNull();
    });

    it('should scope last layout by environment', () => {
      // browser env
      service.setLastLayout('Browser Layout');
      expect(service.getLastLayoutName()).toBe('Browser Layout');

      // Verify the map stores per-environment
      const raw = localStorage.getItem('openfin-last-layout');
      const map = JSON.parse(raw!);
      expect(map.browser).toBe('Browser Layout');
    });

    it('should return null when localStorage contains invalid JSON for last-layout', () => {
      localStorage.setItem('openfin-last-layout', 'INVALID');
      expect(service.getLastLayoutName()).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────
  // registerLifecycleListeners
  // ────────────────────────────────────────────────────────

  describe('registerLifecycleListeners', () => {
    it('should not throw in browser mode', () => {
      expect(() => service.registerLifecycleListeners()).not.toThrow();
    });

    it('should register platform lifecycle listeners when in platform mode', () => {
      const mockPlatform = {
        on: vi.fn(),
      };
      (window as any).fin = {
        Window: { create: vi.fn() },
        me: { isView: true },
        Platform: {
          getCurrentSync: vi.fn().mockReturnValue(mockPlatform),
        },
      };

      service.registerLifecycleListeners();

      expect(mockPlatform.on).toHaveBeenCalledWith('view-created', expect.any(Function));
      expect(mockPlatform.on).toHaveBeenCalledWith('view-destroyed', expect.any(Function));
      expect(mockPlatform.on).toHaveBeenCalledWith('window-closing', expect.any(Function));
      expect(mockPlatform.on).toHaveBeenCalledWith('window-closed', expect.any(Function));
      expect(mockPlatform.on).toHaveBeenCalledWith('platform-api-ready', expect.any(Function));
    });

    it('should invoke platform event handlers correctly', () => {
      const handlers: Record<string, Function> = {};
      const mockPlatform = {
        on: vi.fn((event: string, handler: Function) => {
          handlers[event] = handler;
        }),
      };
      (window as any).fin = {
        Window: { create: vi.fn() },
        me: { isView: true },
        Platform: {
          getCurrentSync: vi.fn().mockReturnValue(mockPlatform),
        },
      };

      service.registerLifecycleListeners();

      // Trigger view-created
      handlers['view-created']({ view: { identity: { name: 'my-view' } }, target: {} });
      expect(childLogger.info).toHaveBeenCalledWith(
        { action: 'view_created', view: 'my-view' },
        expect.stringContaining('my-view'),
      );

      // Trigger view-destroyed
      handlers['view-destroyed']({ view: { identity: { name: 'old-view' } }, target: {} });
      expect(childLogger.info).toHaveBeenCalledWith(
        { action: 'view_closed', view: 'old-view' },
        expect.stringContaining('old-view'),
      );

      // Trigger window-closing
      handlers['window-closing']({ name: 'main-win', uuid: 'uuid1' });
      expect(childLogger.info).toHaveBeenCalledWith(
        { action: 'window_closing', window: 'main-win' },
        expect.stringContaining('main-win'),
      );

      // Trigger window-closed
      handlers['window-closed']({ name: 'main-win', uuid: 'uuid1' });
      expect(childLogger.info).toHaveBeenCalledWith(
        { action: 'window_closed', window: 'main-win' },
        expect.stringContaining('main-win'),
      );

      // Trigger platform-api-ready
      handlers['platform-api-ready']();
      expect(childLogger.info).toHaveBeenCalledWith(
        { action: 'platform_ready' },
        'Platform API ready',
      );
    });

    it('should handle platform event with missing view identity', () => {
      const handlers: Record<string, Function> = {};
      const mockPlatform = {
        on: vi.fn((event: string, handler: Function) => {
          handlers[event] = handler;
        }),
      };
      (window as any).fin = {
        Window: { create: vi.fn() },
        me: { isView: true },
        Platform: {
          getCurrentSync: vi.fn().mockReturnValue(mockPlatform),
        },
      };

      service.registerLifecycleListeners();

      // Trigger view-created with missing identity
      handlers['view-created']({ view: {}, target: {} });
      expect(childLogger.info).toHaveBeenCalledWith(
        { action: 'view_created', view: 'unknown' },
        expect.stringContaining('unknown'),
      );
    });

    it('should register container lifecycle listeners when in container mode', () => {
      const mockApp = { on: vi.fn() };
      const mockWin = { on: vi.fn() };
      (window as any).fin = {
        Window: {
          create: vi.fn(),
          getCurrentSync: vi.fn().mockReturnValue(mockWin),
        },
        me: {},
        Application: {
          getCurrentSync: vi.fn().mockReturnValue(mockApp),
        },
      };

      service.registerLifecycleListeners();

      expect(mockApp.on).toHaveBeenCalledWith('window-created', expect.any(Function));
      expect(mockApp.on).toHaveBeenCalledWith('window-closed', expect.any(Function));
      expect(mockWin.on).toHaveBeenCalledWith('close-requested', expect.any(Function));
    });

    it('should invoke container event handlers correctly', () => {
      const appHandlers: Record<string, Function> = {};
      const winHandlers: Record<string, Function> = {};
      const mockApp = {
        on: vi.fn((event: string, handler: Function) => {
          appHandlers[event] = handler;
        }),
      };
      const mockWin = {
        on: vi.fn((event: string, handler: Function) => {
          winHandlers[event] = handler;
        }),
        close: vi.fn(),
      };
      (window as any).fin = {
        Window: {
          create: vi.fn(),
          getCurrentSync: vi.fn().mockReturnValue(mockWin),
        },
        me: {},
        Application: {
          getCurrentSync: vi.fn().mockReturnValue(mockApp),
        },
      };

      service.registerLifecycleListeners();

      // Trigger window-created
      appHandlers['window-created']({ name: 'child-win', uuid: 'u1' });
      expect(childLogger.info).toHaveBeenCalledWith(
        { action: 'child_window_created', window: 'child-win' },
        expect.stringContaining('child-win'),
      );

      // Trigger window-closed
      appHandlers['window-closed']({ name: 'child-win', uuid: 'u1' });
      expect(childLogger.info).toHaveBeenCalledWith(
        { action: 'child_window_closed', window: 'child-win' },
        expect.stringContaining('child-win'),
      );
    });

    it('should handle container close-requested by flushing logger and closing', async () => {
      const winHandlers: Record<string, Function> = {};
      const mockWin = {
        on: vi.fn((event: string, handler: Function) => {
          winHandlers[event] = handler;
        }),
        close: vi.fn(),
      };
      (window as any).fin = {
        Window: {
          create: vi.fn(),
          getCurrentSync: vi.fn().mockReturnValue(mockWin),
        },
        me: {},
        Application: {
          getCurrentSync: vi.fn().mockReturnValue({ on: vi.fn() }),
        },
      };

      service.registerLifecycleListeners();

      // Trigger close-requested
      await winHandlers['close-requested']();

      expect(mockRemoteLogger.flush).toHaveBeenCalled();
      expect(mockWin.close).toHaveBeenCalledWith(true);
    });

    it('should handle registerPlatformLifecycleListeners error gracefully', () => {
      (window as any).fin = {
        Window: { create: vi.fn() },
        me: { isView: true },
        Platform: {
          getCurrentSync: vi.fn().mockImplementation(() => {
            throw new Error('Platform error');
          }),
        },
      };

      expect(() => service.registerLifecycleListeners()).not.toThrow();
      expect(childLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Failed to register platform lifecycle listeners',
      );
    });

    it('should not register platform listeners when Platform is not available', () => {
      (window as any).fin = {
        Window: { create: vi.fn() },
        me: { isView: true },
        // no Platform property
      };

      expect(() => service.registerLifecycleListeners()).not.toThrow();
    });

    it('should handle registerContainerLifecycleListeners error gracefully', () => {
      (window as any).fin = {
        Window: { create: vi.fn() },
        me: {},
        Application: {
          getCurrentSync: vi.fn().mockImplementation(() => {
            throw new Error('App error');
          }),
        },
      };

      expect(() => service.registerLifecycleListeners()).not.toThrow();
      expect(childLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Failed to register container lifecycle listeners',
      );
    });

    it('should not register container listeners when Application is not available', () => {
      (window as any).fin = {
        Window: { create: vi.fn() },
        me: {},
        // no Application property
      };

      expect(() => service.registerLifecycleListeners()).not.toThrow();
    });
  });

  // ────────────────────────────────────────────────────────
  // initPlatformLayout
  // ────────────────────────────────────────────────────────

  describe('initPlatformLayout', () => {
    it('should log error when Platform.Layout.init is not available', async () => {
      // No window.fin
      await service.initPlatformLayout();
      expect(childLogger.error).toHaveBeenCalledWith('Cannot init platform layout: fin.Platform.Layout.init not available');
    });

    it('should initialize the platform layout successfully', async () => {
      const mockLayoutInit = vi.fn().mockResolvedValue(undefined);
      const mockWin = { on: vi.fn() };
      (window as any).fin = {
        Window: {
          create: vi.fn(),
          getCurrentSync: vi.fn().mockReturnValue(mockWin),
        },
        me: {},
        Platform: {
          Layout: {
            init: mockLayoutInit,
          },
          getCurrentSync: vi.fn().mockReturnValue({
            quit: vi.fn().mockResolvedValue(undefined),
          }),
        },
      };

      await service.initPlatformLayout();

      expect(mockLayoutInit).toHaveBeenCalledWith({ containerId: 'layout-container' });
      expect(service.isConnected).toBe(true);
      expect(childLogger.info).toHaveBeenCalledWith('Platform layout initialized in #layout-container');
    });

    it('should set error status when layout init fails', async () => {
      (window as any).fin = {
        Window: { create: vi.fn() },
        me: {},
        Platform: {
          Layout: {
            init: vi.fn().mockRejectedValue(new Error('Init failed')),
          },
        },
      };

      await service.initPlatformLayout();

      const status = await firstValueFrom(service.connectionStatus$);
      expect(status).toBe(OpenFinConnectionStatus.Error);
      expect(childLogger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Failed to initialize platform layout',
      );
    });

    it('should register a platform close handler on success', async () => {
      const mockWin = { on: vi.fn() };
      (window as any).fin = {
        Window: {
          create: vi.fn(),
          getCurrentSync: vi.fn().mockReturnValue(mockWin),
        },
        me: {},
        Platform: {
          Layout: {
            init: vi.fn().mockResolvedValue(undefined),
          },
          getCurrentSync: vi.fn().mockReturnValue({
            quit: vi.fn().mockResolvedValue(undefined),
          }),
        },
      };

      await service.initPlatformLayout();

      expect(mockWin.on).toHaveBeenCalledWith('close-requested', expect.any(Function));
      expect(childLogger.info).toHaveBeenCalledWith('Platform close handler registered');
    });

    it('should call platform.quit when close-requested is triggered', async () => {
      const mockQuit = vi.fn().mockResolvedValue(undefined);
      const winHandlers: Record<string, Function> = {};
      const mockWin = {
        on: vi.fn((event: string, handler: Function) => {
          winHandlers[event] = handler;
        }),
        close: vi.fn(),
      };
      (window as any).fin = {
        Window: {
          create: vi.fn(),
          getCurrentSync: vi.fn().mockReturnValue(mockWin),
        },
        me: {},
        Platform: {
          Layout: {
            init: vi.fn().mockResolvedValue(undefined),
          },
          getCurrentSync: vi.fn().mockReturnValue({
            quit: mockQuit,
          }),
        },
      };

      await service.initPlatformLayout();
      await winHandlers['close-requested']();

      expect(mockRemoteLogger.flush).toHaveBeenCalled();
      expect(mockQuit).toHaveBeenCalled();
    });

    it('should fall back to win.close if platform.quit fails', async () => {
      const winHandlers: Record<string, Function> = {};
      const mockWin = {
        on: vi.fn((event: string, handler: Function) => {
          winHandlers[event] = handler;
        }),
        close: vi.fn(),
      };
      (window as any).fin = {
        Window: {
          create: vi.fn(),
          getCurrentSync: vi.fn().mockReturnValue(mockWin),
        },
        me: {},
        Platform: {
          Layout: {
            init: vi.fn().mockResolvedValue(undefined),
          },
          getCurrentSync: vi.fn().mockReturnValue({
            quit: vi.fn().mockRejectedValue(new Error('Quit failed')),
          }),
        },
      };

      await service.initPlatformLayout();
      await winHandlers['close-requested']();

      expect(mockWin.close).toHaveBeenCalledWith(true);
    });

    it('should handle registerPlatformCloseHandler error gracefully', async () => {
      (window as any).fin = {
        Window: {
          create: vi.fn(),
          getCurrentSync: vi.fn().mockImplementation(() => {
            throw new Error('Window error');
          }),
        },
        me: {},
        Platform: {
          Layout: {
            init: vi.fn().mockResolvedValue(undefined),
          },
        },
      };

      await service.initPlatformLayout();

      expect(childLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Failed to register platform close handler',
      );
    });
  });

  // ────────────────────────────────────────────────────────
  // setPlatformViewsVisible
  // ────────────────────────────────────────────────────────

  describe('setPlatformViewsVisible', () => {
    it('should not throw when no window.fin', async () => {
      await expect(service.setPlatformViewsVisible(true)).resolves.not.toThrow();
    });

    it('should show all views when visible is true', async () => {
      const mockView1 = { show: vi.fn().mockResolvedValue(undefined), hide: vi.fn() };
      const mockView2 = { show: vi.fn().mockResolvedValue(undefined), hide: vi.fn() };
      (window as any).fin = {
        Window: {
          getCurrentSync: vi.fn().mockReturnValue({
            getCurrentViews: vi.fn().mockResolvedValue([mockView1, mockView2]),
          }),
        },
      };

      await service.setPlatformViewsVisible(true);

      expect(mockView1.show).toHaveBeenCalled();
      expect(mockView2.show).toHaveBeenCalled();
      expect(mockView1.hide).not.toHaveBeenCalled();
    });

    it('should hide all views when visible is false', async () => {
      const mockView1 = { show: vi.fn(), hide: vi.fn().mockResolvedValue(undefined) };
      const mockView2 = { show: vi.fn(), hide: vi.fn().mockResolvedValue(undefined) };
      (window as any).fin = {
        Window: {
          getCurrentSync: vi.fn().mockReturnValue({
            getCurrentViews: vi.fn().mockResolvedValue([mockView1, mockView2]),
          }),
        },
      };

      await service.setPlatformViewsVisible(false);

      expect(mockView1.hide).toHaveBeenCalled();
      expect(mockView2.hide).toHaveBeenCalled();
      expect(mockView1.show).not.toHaveBeenCalled();
    });

    it('should silently handle errors', async () => {
      (window as any).fin = {
        Window: {
          getCurrentSync: vi.fn().mockReturnValue({
            getCurrentViews: vi.fn().mockRejectedValue(new Error('Views error')),
          }),
        },
      };

      await expect(service.setPlatformViewsVisible(true)).resolves.not.toThrow();
    });
  });

  // ────────────────────────────────────────────────────────
  // closeAllChildWindows
  // ────────────────────────────────────────────────────────

  describe('closeAllChildWindows', () => {
    it('should not throw when no window.fin', async () => {
      await expect(service.closeAllChildWindows()).resolves.not.toThrow();
    });

    it('should close all child windows', async () => {
      const win1 = { close: vi.fn().mockResolvedValue(undefined) };
      const win2 = { close: vi.fn().mockResolvedValue(undefined) };
      (window as any).fin = {
        Application: {
          getCurrentSync: vi.fn().mockReturnValue({
            getChildWindows: vi.fn().mockResolvedValue([win1, win2]),
          }),
        },
      };

      await service.closeAllChildWindows();

      expect(win1.close).toHaveBeenCalledWith(true);
      expect(win2.close).toHaveBeenCalledWith(true);
      expect(childLogger.info).toHaveBeenCalledWith('All child windows closed');
    });

    it('should handle individual window close errors silently', async () => {
      const win1 = { close: vi.fn().mockRejectedValue(new Error('Already closed')) };
      const win2 = { close: vi.fn().mockResolvedValue(undefined) };
      (window as any).fin = {
        Application: {
          getCurrentSync: vi.fn().mockReturnValue({
            getChildWindows: vi.fn().mockResolvedValue([win1, win2]),
          }),
        },
      };

      await service.closeAllChildWindows();

      // Should still attempt to close the second window
      expect(win2.close).toHaveBeenCalledWith(true);
    });

    it('should handle getChildWindows error', async () => {
      (window as any).fin = {
        Application: {
          getCurrentSync: vi.fn().mockReturnValue({
            getChildWindows: vi.fn().mockRejectedValue(new Error('App error')),
          }),
        },
      };

      await service.closeAllChildWindows();

      expect(childLogger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Failed to close child windows',
      );
    });
  });

  // ────────────────────────────────────────────────────────
  // createWindow
  // ────────────────────────────────────────────────────────

  describe('createWindow', () => {
    it('should log error when not in OpenFin container', async () => {
      await service.createWindow('my-win', '/page.html');
      expect(childLogger.error).toHaveBeenCalledWith('Cannot create window: not running in OpenFin container');
    });

    it('should create a window with default options', async () => {
      const mockCreate = vi.fn().mockResolvedValue({});
      (window as any).fin = {
        Window: { create: mockCreate },
      };

      await service.createWindow('my-win', 'https://example.com/page');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'my-win',
          url: 'https://example.com/page',
          defaultWidth: 1200,
          defaultHeight: 800,
          defaultCentered: true,
          frame: true,
          autoShow: true,
          contextMenu: true,
          backgroundColor: '#0f172a',
          saveWindowState: true,
        }),
      );
      expect(childLogger.info).toHaveBeenCalledWith(
        { name: 'my-win', url: 'https://example.com/page' },
        'Native OpenFin window created',
      );
    });

    it('should create a window with custom options', async () => {
      const mockCreate = vi.fn().mockResolvedValue({});
      (window as any).fin = {
        Window: { create: mockCreate },
      };

      await service.createWindow('my-win', '/page.html', {
        width: 600,
        height: 400,
        frame: false,
        center: false,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultWidth: 600,
          defaultHeight: 400,
          frame: false,
          defaultCentered: false,
        }),
      );
    });

    it('should resolve relative URLs', async () => {
      const mockCreate = vi.fn().mockResolvedValue({});
      (window as any).fin = {
        Window: { create: mockCreate },
      };

      await service.createWindow('my-win', '/page.html');

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.url).toMatch(/^https?:\/\//);
      expect(callArgs.url).toContain('/page.html');
    });

    it('should handle createWindow errors gracefully', async () => {
      (window as any).fin = {
        Window: { create: vi.fn().mockRejectedValue(new Error('Create failed')) },
      };

      await service.createWindow('my-win', '/page.html');

      expect(childLogger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Failed to create OpenFin window',
      );
    });
  });

  // ────────────────────────────────────────────────────────
  // addPlatformView
  // ────────────────────────────────────────────────────────

  describe('addPlatformView', () => {
    it('should log error when not in platform mode', async () => {
      await service.addPlatformView('my-view', '/view.html');
      expect(childLogger.error).toHaveBeenCalledWith('Cannot add platform view: not running in OpenFin Platform');
    });

    it('should add view to existing non-status-bar stack', async () => {
      const mockAddView = vi.fn().mockResolvedValue(undefined);
      const mockStack = {
        type: 'stack',
        getViews: vi.fn().mockResolvedValue([{ name: 'some-view' }]),
        addView: mockAddView,
      };
      const mockRootItem = {
        type: 'column',
        getContent: vi.fn().mockResolvedValue([mockStack]),
      };
      (window as any).fin = {
        Window: { create: vi.fn() },
        me: {},
        Platform: {
          Layout: {
            getCurrentSync: vi.fn().mockReturnValue({
              getRootItem: vi.fn().mockResolvedValue(mockRootItem),
            }),
          },
        },
      };

      await service.addPlatformView('new-view', 'https://example.com/view');

      expect(mockAddView).toHaveBeenCalledWith({
        name: 'new-view',
        url: 'https://example.com/view',
      });
    });

    it('should create adjacent stack below status bar when no non-status-bar stack exists', async () => {
      const mockCreateAdjacentStack = vi.fn().mockResolvedValue(undefined);
      const statusBarStack = {
        type: 'stack',
        getViews: vi.fn().mockResolvedValue([{ name: 'status-bar' }]),
        createAdjacentStack: mockCreateAdjacentStack,
      };
      const mockRootItem = {
        type: 'column',
        getContent: vi.fn().mockResolvedValue([statusBarStack]),
      };
      (window as any).fin = {
        Window: { create: vi.fn() },
        me: {},
        Platform: {
          Layout: {
            getCurrentSync: vi.fn().mockReturnValue({
              getRootItem: vi.fn().mockResolvedValue(mockRootItem),
            }),
          },
        },
      };

      await service.addPlatformView('new-view', '/view.html');

      expect(mockCreateAdjacentStack).toHaveBeenCalledWith(
        [expect.objectContaining({ name: 'new-view' })],
        { position: 'bottom' },
      );
    });

    it('should fall back to platform.createView when no stacks found (isWindow)', async () => {
      const mockCreateView = vi.fn().mockResolvedValue(undefined);
      // Root item with no stacks at all
      const mockRootItem = {
        type: 'column',
        getContent: vi.fn().mockResolvedValue([]),
      };
      (window as any).fin = {
        Window: { create: vi.fn() },
        me: { isWindow: true, identity: { uuid: 'u1', name: 'main' } },
        Platform: {
          Layout: {
            getCurrentSync: vi.fn().mockReturnValue({
              getRootItem: vi.fn().mockResolvedValue(mockRootItem),
            }),
          },
          getCurrentSync: vi.fn().mockReturnValue({
            createView: mockCreateView,
          }),
        },
      };

      await service.addPlatformView('new-view', '/view.html');

      expect(mockCreateView).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'new-view' }),
        { uuid: 'u1', name: 'main' },
      );
    });

    it('should fall back to platform.createView when no stacks found (isView)', async () => {
      const mockCreateView = vi.fn().mockResolvedValue(undefined);
      const mockParentWin = { identity: { uuid: 'u1', name: 'parent' } };
      const mockRootItem = {
        type: 'column',
        getContent: vi.fn().mockResolvedValue([]),
      };
      (window as any).fin = {
        Window: { create: vi.fn() },
        me: {
          isView: true,
          isWindow: false,
          getCurrentWindow: vi.fn().mockResolvedValue(mockParentWin),
        },
        Platform: {
          Layout: {
            getCurrentSync: vi.fn().mockReturnValue({
              getRootItem: vi.fn().mockResolvedValue(mockRootItem),
            }),
          },
          getCurrentSync: vi.fn().mockReturnValue({
            createView: mockCreateView,
          }),
        },
      };

      await service.addPlatformView('new-view', '/view.html');

      expect(mockCreateView).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'new-view' }),
        { uuid: 'u1', name: 'parent' },
      );
    });

    it('should handle addPlatformView errors gracefully', async () => {
      (window as any).fin = {
        Window: { create: vi.fn() },
        me: {},
        Platform: {
          Layout: {
            getCurrentSync: vi.fn().mockReturnValue({
              getRootItem: vi.fn().mockRejectedValue(new Error('Layout error')),
            }),
          },
        },
      };

      await service.addPlatformView('new-view', '/view.html');

      expect(childLogger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Failed to add platform view',
      );
    });

    it('should detect status bar by identity.name', async () => {
      const mockAddView = vi.fn().mockResolvedValue(undefined);
      const statusStack = {
        type: 'stack',
        getViews: vi.fn().mockResolvedValue([{ identity: { name: 'status-bar' } }]),
        createAdjacentStack: vi.fn().mockResolvedValue(undefined),
      };
      const normalStack = {
        type: 'stack',
        getViews: vi.fn().mockResolvedValue([{ identity: { name: 'trade-blotter' } }]),
        addView: mockAddView,
      };
      const mockRootItem = {
        type: 'column',
        getContent: vi.fn().mockResolvedValue([statusStack, normalStack]),
      };
      (window as any).fin = {
        Window: { create: vi.fn() },
        me: {},
        Platform: {
          Layout: {
            getCurrentSync: vi.fn().mockReturnValue({
              getRootItem: vi.fn().mockResolvedValue(mockRootItem),
            }),
          },
        },
      };

      await service.addPlatformView('new-view', '/view.html');

      // Should add to the normal stack, not the status-bar stack
      expect(mockAddView).toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────
  // restoreDefaultPlatformLayout
  // ────────────────────────────────────────────────────────

  describe('restoreDefaultPlatformLayout', () => {
    it('should log error when not in platform mode', async () => {
      await service.restoreDefaultPlatformLayout();
      expect(childLogger.error).toHaveBeenCalledWith('Cannot restore default platform layout: not in Platform mode');
    });

    it('should restore layout from manifest snapshot', async () => {
      const mockApplySnapshot = vi.fn().mockResolvedValue(undefined);
      (window as any).fin = {
        Window: { create: vi.fn() },
        me: {},
        Platform: {
          getCurrentSync: vi.fn().mockReturnValue({
            applySnapshot: mockApplySnapshot,
          }),
        },
      };

      const manifestData = { snapshot: { windows: [{ name: 'main' }] } };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(manifestData),
      } as any);

      await service.restoreDefaultPlatformLayout();

      expect(mockApplySnapshot).toHaveBeenCalledWith(
        manifestData.snapshot,
        { closeExistingWindows: true },
      );
    });

    it('should log error when manifest has no snapshot', async () => {
      (window as any).fin = {
        Window: { create: vi.fn() },
        me: {},
        Platform: {
          getCurrentSync: vi.fn().mockReturnValue({}),
        },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      } as any);

      await service.restoreDefaultPlatformLayout();

      expect(childLogger.error).toHaveBeenCalledWith('Platform manifest does not contain a snapshot');
    });

    it('should handle fetch failure', async () => {
      (window as any).fin = {
        Window: { create: vi.fn() },
        me: {},
        Platform: {
          getCurrentSync: vi.fn().mockReturnValue({}),
        },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      } as any);

      await service.restoreDefaultPlatformLayout();

      expect(childLogger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Failed to restore default platform layout',
      );
    });

    it('should handle network errors', async () => {
      (window as any).fin = {
        Window: { create: vi.fn() },
        me: {},
        Platform: {
          getCurrentSync: vi.fn().mockReturnValue({}),
        },
      };

      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

      await service.restoreDefaultPlatformLayout();

      expect(childLogger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Failed to restore default platform layout',
      );
    });
  });

  // ────────────────────────────────────────────────────────
  // flushRemoteLoggerBeforeExit (indirectly tested via lifecycle)
  // ────────────────────────────────────────────────────────

  describe('flushRemoteLoggerBeforeExit', () => {
    it('should handle flush errors silently', async () => {
      mockRemoteLogger.flush.mockImplementation(() => {
        throw new Error('Flush error');
      });

      // Trigger via container close-requested
      const winHandlers: Record<string, Function> = {};
      const mockWin = {
        on: vi.fn((event: string, handler: Function) => {
          winHandlers[event] = handler;
        }),
        close: vi.fn(),
      };
      (window as any).fin = {
        Window: {
          create: vi.fn(),
          getCurrentSync: vi.fn().mockReturnValue(mockWin),
        },
        me: {},
        Application: {
          getCurrentSync: vi.fn().mockReturnValue({ on: vi.fn() }),
        },
      };

      service.registerLifecycleListeners();

      // Should not throw even if flush fails
      await expect(winHandlers['close-requested']()).resolves.not.toThrow();
    });
  });
});

// ────────────────────────────────────────────────────────
// OpenFinConnectionStatus enum
// ────────────────────────────────────────────────────────

describe('OpenFinConnectionStatus', () => {
  it('should have correct enum values', () => {
    expect(OpenFinConnectionStatus.Disconnected).toBe('disconnected');
    expect(OpenFinConnectionStatus.Connecting).toBe('connecting');
    expect(OpenFinConnectionStatus.Connected).toBe('connected');
    expect(OpenFinConnectionStatus.Error).toBe('error');
  });
});

// ────────────────────────────────────────────────────────
// DEFAULT_OPENFIN_CONFIG
// ────────────────────────────────────────────────────────

describe('DEFAULT_OPENFIN_CONFIG', () => {
  it('should have correct defaults', () => {
    expect(DEFAULT_OPENFIN_CONFIG.enabled).toBe(false);
    expect(DEFAULT_OPENFIN_CONFIG.brokerUrl).toBe('');
    expect(DEFAULT_OPENFIN_CONFIG.sharedWorkerUrl).toBe('');
    expect(DEFAULT_OPENFIN_CONFIG.layoutUrl).toBe('');
    expect(DEFAULT_OPENFIN_CONFIG.providerId).toBe('rates-desktop');
    expect(DEFAULT_OPENFIN_CONFIG.defaultContextGroup).toBe('green');
    expect(DEFAULT_OPENFIN_CONFIG.logLevel).toBe('info');
  });
});
