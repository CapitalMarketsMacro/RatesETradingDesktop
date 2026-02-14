import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { connect, WebLayoutSnapshot } from '@openfin/core-web';
import { OpenFinConfig, DEFAULT_OPENFIN_CONFIG } from './openfin-config.interface';
import { LoggerService } from '@rates-trading/logger';

/**
 * Connection states for the OpenFin Web Broker.
 */
export enum OpenFinConnectionStatus {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Error = 'error',
}

/**
 * Runtime environment the app is running in.
 *
 * - `platform`   – Native OpenFin Platform (window.fin exists, running as platform window)
 * - `container`  – Native OpenFin container (window.fin exists at startup, startup_app mode)
 * - `web`        – Browser with @openfin/core-web (SharedWorker broker)
 * - `browser`    – Plain browser, no OpenFin at all
 */
export type OpenFinEnvironment = 'platform' | 'container' | 'web' | 'browser';

/** Minimal empty layout snapshot (no pre-loaded views) */
const EMPTY_LAYOUT_SNAPSHOT: WebLayoutSnapshot = {
  layouts: {
    default: {
      content: [],
    },
  },
};

/**
 * OpenFinService
 *
 * Manages the connection to the OpenFin Web Broker via @openfin/core-web.
 * Provides access to:
 *  - Interop (FDC3 context sharing, intents, context groups)
 *  - Platform Layout (add/remove views dynamically)
 *  - InterApplicationBus channels (pub/sub between views)
 *
 * Architecture:
 *  - The **host page** (top-level window) calls `connectToBroker()` which
 *    initializes the broker, interop, and an empty layout.
 *  - Views added via `addView()` are loaded as iframes inside the layout.
 *  - Each **iframe view** detects it is inside a layout and calls
 *    `connectAsView()` using `connectionInheritance: 'enabled'` to join
 *    the existing broker session WITHOUT re-creating the layout.
 */
@Injectable({ providedIn: 'root' })
export class OpenFinService {
  private logger = inject(LoggerService).child({ service: 'OpenFin' });

  /** The OpenFin `fin` API object, available after successful connection */
  private finApi: Awaited<ReturnType<typeof connect>> | null = null;

  /** Runtime configuration */
  private config: OpenFinConfig = DEFAULT_OPENFIN_CONFIG;

  /** Layout container element — kept so we can re-init the layout after all views are closed */
  private layoutContainerEl: HTMLElement | null = null;

  /** Connection status observable */
  private connectionStatusSubject =
    new BehaviorSubject<OpenFinConnectionStatus>(
      OpenFinConnectionStatus.Disconnected,
    );
  public connectionStatus$: Observable<OpenFinConnectionStatus> =
    this.connectionStatusSubject.asObservable();

  /**
   * Returns the OpenFin `fin` API object, or null if not connected.
   * Callers needing typed access should cast: `service.fin as OpenFin.Fin`
   */
  get fin(): unknown {
    return this.finApi;
  }

  /** Whether the service is currently connected to the broker */
  get isConnected(): boolean {
    return (
      this.connectionStatusSubject.value === OpenFinConnectionStatus.Connected
    );
  }

  /** Whether OpenFin integration is enabled in config */
  get isEnabled(): boolean {
    return this.config.enabled;
  }

  /** Whether this page is running inside an OpenFin layout iframe */
  get isInsideLayout(): boolean {
    return window.self !== window.top;
  }

  /**
   * Detect the runtime environment.
   *
   * - `platform`  : Running inside an OpenFin Platform manifest.
   *                  The window URL includes `?mode=platform` (set by the
   *                  platform manifest `app.platform.fin.json`).
   * - `container` : Native OpenFin container (startup_app manifest).
   * - `web`       : Running in a regular browser with `@openfin/core-web`.
   * - `browser`   : No OpenFin at all (config disabled or not loaded).
   */
  get environment(): OpenFinEnvironment {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalFin = (window as any).fin;
    if (globalFin?.Window?.create) {
      // Native OpenFin — distinguish platform vs. startup_app
      const isPlatform =
        new URLSearchParams(window.location.search).get('mode') === 'platform';
      return isPlatform ? 'platform' : 'container';
    }
    if (this.config.enabled) {
      return 'web';
    }
    return 'browser';
  }

  /** Convenience check — true for both `platform` and `container` */
  get isContainer(): boolean {
    const env = this.environment;
    return env === 'container' || env === 'platform';
  }

  /** True only when running in OpenFin Platform mode */
  get isPlatform(): boolean {
    return this.environment === 'platform';
  }

  /**
   * Mark the service as connected when running inside the native OpenFin
   * container. The container injects `window.fin` automatically — no
   * broker connection or layout init is needed.
   */
  markContainerConnected(): void {
    this.connectionStatusSubject.next(OpenFinConnectionStatus.Connected);
  }

  // ────────────────────────────────────────────────────────
  // Platform view visibility (for menu overlay workaround)
  // ────────────────────────────────────────────────────────

  /**
   * In native OpenFin Platform mode, views are separate BrowserViews
   * composited ABOVE the window's DOM. DOM dropdown menus cannot appear
   * on top of them via CSS z-index. The workaround is to temporarily
   * hide all platform views while a menu is open, then show them again.
   */
  async setPlatformViewsVisible(visible: boolean): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalFin = (window as any).fin;
    if (!globalFin?.Window?.getCurrentSync) return;

    try {
      const win = globalFin.Window.getCurrentSync();
      const views = await win.getCurrentViews();
      for (const view of views) {
        if (visible) {
          await view.show();
        } else {
          await view.hide();
        }
      }
    } catch {
      // Silently ignore — views may not be ready yet
    }
  }

  /**
   * Initialize the OpenFin Platform Layout inside the platform window.
   *
   * When a platform window uses a custom `url`, the page must call
   * `fin.Platform.Layout.init()` to register the layout channel actions
   * (add-view, remove-view, etc.) and bind GoldenLayout to a container
   * element. The layout *content* comes from the manifest snapshot —
   * we only need to tell the runtime WHERE to render it.
   *
   * Must be called after the `#layout-container` element is in the DOM.
   */
  async initPlatformLayout(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalFin = (window as any).fin;
    if (!globalFin?.Platform?.Layout?.init) {
      this.logger.error('Cannot init platform layout: fin.Platform.Layout.init not available');
      return;
    }

    this.connectionStatusSubject.next(OpenFinConnectionStatus.Connecting);

    try {
      await globalFin.Platform.Layout.init({
        containerId: 'layout-container',
      });

      this.connectionStatusSubject.next(OpenFinConnectionStatus.Connected);
      this.logger.info('Platform layout initialized in #layout-container');
    } catch (error) {
      this.connectionStatusSubject.next(OpenFinConnectionStatus.Error);
      this.logger.error(error as Error, 'Failed to initialize platform layout');
    }
  }

  /**
   * Initialize the service with runtime configuration.
   * Must be called before `connectToBroker()` or `connectAsView()`.
   */
  initialize(config: Partial<OpenFinConfig>): void {
    this.config = { ...DEFAULT_OPENFIN_CONFIG, ...config };
    this.logger.info(
      { providerId: this.config.providerId },
      'OpenFin service initialized',
    );
  }

  /**
   * Connect to the OpenFin Web Broker as the **host page**.
   *
   * Loads the default layout from config (or uses an empty one) and
   * initializes Interop + Layout. Views in the layout are loaded as
   * iframes; they call `connectAsView()` instead of re-creating the layout.
   *
   * @param layoutContainer DOM element to bind the layout engine to.
   * @returns The `fin` API object.
   */
  async connectToBroker(layoutContainer: HTMLElement): Promise<unknown> {
    if (!this.config.enabled) {
      this.logger.info(
        'OpenFin is disabled in configuration, skipping connection',
      );
      return null;
    }

    if (this.isConnected && this.finApi) {
      this.logger.warn('Already connected to OpenFin broker');
      return this.finApi;
    }

    this.connectionStatusSubject.next(OpenFinConnectionStatus.Connecting);

    try {
      const brokerUrl = this.resolveUrl(this.config.brokerUrl);

      // Check if there is a pending restore request (set by restoreLayout)
      let layoutSnapshot: WebLayoutSnapshot = EMPTY_LAYOUT_SNAPSHOT;
      const pendingRestore = localStorage.getItem(OpenFinService.PENDING_RESTORE_KEY);
      if (pendingRestore) {
        // Clear the flag immediately so it doesn't loop on next reload
        localStorage.removeItem(OpenFinService.PENDING_RESTORE_KEY);
        try {
          const pending = JSON.parse(pendingRestore) as { name: string; snapshot: unknown };
          // Wrap the saved GoldenLayout config inside the WebLayoutSnapshot envelope
          layoutSnapshot = { layouts: { default: pending.snapshot } } as WebLayoutSnapshot;
          this.logger.info({ name: pending.name }, 'Restoring saved layout on startup');
        } catch {
          this.logger.warn('Failed to parse pending layout restore, falling back to default');
        }
      }

      // If no pending restore, load the default layout from config
      if (!pendingRestore && this.config.layoutUrl) {
        const fetched = await this.fetchLayoutSnapshot(
          this.resolveUrl(this.config.layoutUrl),
        );
        if (fetched) {
          layoutSnapshot = fetched;
        }
      }

      this.logger.info(
        { brokerUrl, providerId: this.config.providerId },
        'Connecting to OpenFin Web Broker (host)...',
      );

      const fin = await connect({
        connectionInheritance: 'enabled',
        options: {
          brokerUrl,
          interopConfig: {
            providerId: this.config.providerId,
            currentContextGroup: this.config.defaultContextGroup,
          },
        },
        platform: { layoutSnapshot },
        logLevel: this.config.logLevel,
      });

      this.finApi = fin;
      this.layoutContainerEl = layoutContainer;


      // Initialize Interop — may fail on page reload if the SharedWorker
      // still holds the channel from the previous session. Treat as non-fatal.
      try {
        await fin.Interop.init(this.config.providerId);
        this.logger.info('OpenFin Interop initialized');
      } catch (_interopError) {
        this.logger.warn(
          'Interop.init failed (broker channel may already exist from previous session), continuing...',
        );
      }

      // Initialize the Layout engine and bind to the container element
      await fin.Platform.Layout.init({
        container: layoutContainer,
      });
      this.logger.info('OpenFin Layout initialized with default snapshot');

      this.connectionStatusSubject.next(OpenFinConnectionStatus.Connected);
      this.logger.info('Successfully connected to OpenFin Web Broker');

      return fin;
    } catch (error) {
      this.connectionStatusSubject.next(OpenFinConnectionStatus.Error);
      this.logger.error(
        error as Error,
        'Failed to connect to OpenFin Web Broker',
      );
      throw error;
    }
  }

  /**
   * Connect as a **view** inside an OpenFin layout iframe.
   *
   * Uses `connectionInheritance: 'enabled'` so the broker URL and identity
   * are inherited from the host page. Does NOT create a layout.
   *
   * Call this from components loaded as layout views.
   *
   * @returns The `fin` API object.
   */
  async connectAsView(): Promise<unknown> {
    if (!this.config.enabled) {
      return null;
    }

    if (this.isConnected && this.finApi) {
      return this.finApi;
    }

    this.connectionStatusSubject.next(OpenFinConnectionStatus.Connecting);

    try {
      this.logger.info(
        'Connecting to OpenFin Web Broker (view, inheriting from host)...',
      );

      const fin = await connect({
        connectionInheritance: 'enabled',
        logLevel: this.config.logLevel,
      });

      this.finApi = fin;
      this.connectionStatusSubject.next(OpenFinConnectionStatus.Connected);
      this.logger.info('View connected to OpenFin Web Broker via inheritance');

      return fin;
    } catch (error) {
      this.connectionStatusSubject.next(OpenFinConnectionStatus.Error);
      this.logger.error(
        error as Error,
        'Failed to connect view to OpenFin Web Broker',
      );
      throw error;
    }
  }


  /**
   * Add a view (iframe) to the current layout.
   *
   * When only the status bar remains (all closable views removed), uses
   * `layout.replace()` to rebuild the layout with the status bar row and
   * the new view below it. Otherwise adds the view to the existing layout.
   *
   * @param name Unique name for the view.
   * @param url  URL to load inside the view iframe (can be relative).
   */
  async addView(name: string, url: string): Promise<void> {
    if (!this.finApi) {
      this.logger.error('Cannot add view: OpenFin not initialized');
      return;
    }

    const resolvedUrl = this.resolveUrl(url);

    try {
      const layout = this.finApi.Platform.Layout.getCurrentSync();
      await layout.addView({ name, url: resolvedUrl });
      this.logger.info({ name, url }, 'View added to layout');
    } catch (error) {
      this.logger.error(error as Error, 'Failed to add view to layout');
    }
  }

  // ────────────────────────────────────────────────────────
  // Container window / view management (native OpenFin runtime)
  // ────────────────────────────────────────────────────────

  /**
   * Add a view to the current OpenFin **Platform** window's layout.
   *
   * Uses `fin.Platform.getCurrentSync().createView()` so the view appears
   * as a tab inside the existing platform window. Users can then pop it
   * out, rearrange, or close it via the standard OpenFin tab UI.
   *
   * Only works when running in OpenFin Platform mode (environment === 'platform').
   *
   * @param name Unique view name.
   * @param url  URL to load (can be relative).
   */
  async addPlatformView(name: string, url: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalFin = (window as any).fin;
    if (!globalFin?.Platform) {
      this.logger.error('Cannot add platform view: not running in OpenFin Platform');
      return;
    }

    const resolvedUrl = this.resolveUrl(url);

    try {
      const platform = globalFin.Platform.getCurrentSync();

      // Determine the target window identity so the view is added to THIS window
      let windowIdentity: { uuid: string; name: string } | undefined;
      if (globalFin.me.isWindow) {
        windowIdentity = globalFin.me.identity;
      } else if (globalFin.me.isView) {
        const parentWin = await globalFin.me.getCurrentWindow();
        windowIdentity = parentWin.identity;
      }

      await platform.createView(
        { name, url: resolvedUrl },
        windowIdentity,
      );

      this.logger.info({ name, url, windowIdentity }, 'View added to platform layout');
    } catch (error) {
      this.logger.error(error as Error, 'Failed to add platform view');
    }
  }

  /**
   * Create a new native OpenFin window (standalone, outside the layout).
   *
   * Only works when running inside the OpenFin container (`isContainer === true`).
   * Uses the `fin.Window.create()` API as shown in the
   * [container-starter create-window example](https://github.com/built-on-openfin/container-starter/tree/main/how-to/create-window).
   *
   * @param name   Unique window name.
   * @param url    URL to load (can be relative).
   * @param options Optional overrides (width, height, etc.).
   */
  async createWindow(
    name: string,
    url: string,
    options?: {
      width?: number;
      height?: number;
      frame?: boolean;
      center?: boolean;
    },
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalFin = (window as any).fin;
    if (!globalFin?.Window?.create) {
      this.logger.error('Cannot create window: not running in OpenFin container');
      return;
    }

    const resolvedUrl = this.resolveUrl(url);

    try {
      const winOption = {
        name,
        url: resolvedUrl,
        defaultWidth: options?.width ?? 1200,
        defaultHeight: options?.height ?? 800,
        defaultCentered: options?.center ?? true,
        frame: options?.frame ?? true,
        autoShow: true,
        contextMenu: true,
        backgroundColor: '#0f172a',
        saveWindowState: true,
        icon: this.resolveUrl('/favicon.ico'),
      };

      await globalFin.Window.create(winOption);
      this.logger.info({ name, url }, 'Native OpenFin window created');
    } catch (error) {
      this.logger.error(error as Error, 'Failed to create OpenFin window');
    }
  }

  // ────────────────────────────────────────────────────────
  // Layout persistence (localStorage)
  // ────────────────────────────────────────────────────────

  private static readonly LAYOUT_STORAGE_KEY = 'openfin-saved-layouts';
  private static readonly PENDING_RESTORE_KEY = 'openfin-pending-restore';

  /**
   * Saved-layout entry stored in localStorage.
   */
  static readonly LAYOUT_ENTRY_KEYS = ['name', 'timestamp', 'snapshot'] as const;

  /**
   * Save the current layout under a user-provided name.
   * Overwrites any existing layout with the same name.
   */
  async saveLayout(name: string): Promise<void> {
    if (!this.finApi) {
      this.logger.error('Cannot save layout: OpenFin not initialized');
      return;
    }

    try {
      const layout = this.finApi.Platform.Layout.getCurrentSync();
      const config = await (layout as unknown as { getConfig(): Promise<unknown> }).getConfig();

      const entry = {
        name,
        timestamp: Date.now(),
        snapshot: config,
      };

      const all = this.getSavedLayouts();
      // Replace existing entry with same name, or append
      const idx = all.findIndex((l) => l.name === name);
      if (idx >= 0) {
        all[idx] = entry;
      } else {
        all.push(entry);
      }

      localStorage.setItem(
        OpenFinService.LAYOUT_STORAGE_KEY,
        JSON.stringify(all),
      );
      this.logger.info({ name }, 'Layout saved');
    } catch (error) {
      this.logger.error(error as Error, 'Failed to save layout');
    }
  }

  /**
   * Restore a previously-saved layout by name.
   *
   * Because `@openfin/core-web` does not implement `layout.replace()`,
   * we store the target layout in localStorage and reload the page.
   * `connectToBroker()` picks up the pending restore flag on startup and
   * passes the saved snapshot to `connect()` instead of the default layout.
   */
  restoreLayout(name: string): void {
    const all = this.getSavedLayouts();
    const entry = all.find((l) => l.name === name);
    if (!entry) {
      this.logger.warn({ name }, 'No saved layout found with this name');
      return;
    }

    // Stash the layout to restore, then reload
    localStorage.setItem(
      OpenFinService.PENDING_RESTORE_KEY,
      JSON.stringify({ name: entry.name, snapshot: entry.snapshot }),
    );
    this.logger.info({ name }, 'Pending layout restore set, reloading page...');
    window.location.reload();
  }

  /**
   * Return the list of all saved layouts (name + timestamp).
   */
  getSavedLayouts(): { name: string; timestamp: number; snapshot: unknown }[] {
    try {
      const raw = localStorage.getItem(OpenFinService.LAYOUT_STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  /**
   * Delete a saved layout by name.
   */
  deleteLayout(name: string): void {
    const all = this.getSavedLayouts();
    const filtered = all.filter((l) => l.name !== name);
    localStorage.setItem(
      OpenFinService.LAYOUT_STORAGE_KEY,
      JSON.stringify(filtered),
    );
    this.logger.info({ name }, 'Saved layout deleted');
  }

  /**
   * Disconnect from the OpenFin Web Broker and clean up.
   */
  async disconnect(): Promise<void> {
    if (this.finApi) {
      this.finApi = null;
    }
    this.connectionStatusSubject.next(OpenFinConnectionStatus.Disconnected);
    this.logger.info('Disconnected from OpenFin Web Broker');
  }

  /**
   * Share an Interop context (e.g. instrument context for FDC3).
   *
   * @param context The context object (e.g. { type: 'fdc3.instrument', id: { ticker: '10Y' } })
   */
  async setContext(context: Record<string, unknown>): Promise<void> {
    if (!this.finApi) {
      this.logger.warn('Cannot set context: not connected to OpenFin');
      return;
    }
    try {
      const interopClient = this.finApi.me.interop;
      await interopClient.setContext(context as never);
      this.logger.debug({ context }, 'Interop context set');
    } catch (error) {
      this.logger.error(error as Error, 'Failed to set interop context');
    }
  }

  /**
   * Add a listener for Interop context changes.
   *
   * @param handler Callback invoked when context changes.
   * @param contextType Optional FDC3 context type filter (e.g. 'fdc3.instrument').
   */
  async addContextListener(
    handler: (context: Record<string, unknown>) => void,
    contextType?: string,
  ): Promise<void> {
    if (!this.finApi) {
      this.logger.warn('Cannot add context listener: not connected to OpenFin');
      return;
    }
    try {
      const interopClient = this.finApi.me.interop;
      await interopClient.addContextHandler(handler as never, contextType);
      this.logger.debug({ contextType }, 'Interop context listener added');
    } catch (error) {
      this.logger.error(error as Error, 'Failed to add context listener');
    }
  }

  /**
   * Get a Channel client for pub/sub messaging between components.
   *
   * @param channelName Name of the channel to connect to.
   * @returns The Channel client.
   */
  async getChannel(channelName: string): Promise<unknown> {
    if (!this.finApi) {
      throw new Error(
        'Not connected to OpenFin. Call connectToBroker() first.',
      );
    }
    return this.finApi.InterApplicationBus.Channel.connect(channelName);
  }

  /**
   * Resolve a potentially relative URL to an absolute URL.
   * The OpenFin `connect()` API requires absolute URLs for brokerUrl.
   */
  private resolveUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return new URL(url, window.location.origin).href;
  }

  /**
   * Fetch a layout snapshot JSON from a URL.
   */
  private async fetchLayoutSnapshot(
    url: string,
  ): Promise<WebLayoutSnapshot | undefined> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        this.logger.warn(
          { url, status: response.status },
          'Failed to fetch layout snapshot',
        );
        return undefined;
      }
      return (await response.json()) as WebLayoutSnapshot;
    } catch (error) {
      this.logger.warn(
        { err: error },
        'Error fetching layout snapshot, using empty layout',
      );
      return undefined;
    }
  }
}
