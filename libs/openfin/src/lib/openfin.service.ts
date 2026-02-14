import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { connect, WebLayoutSnapshot } from '@openfin/core-web';
import { OpenFinConfig, DEFAULT_OPENFIN_CONFIG } from './openfin-config.interface';
import { LoggerService } from '@rates-trading/logger';
import { WorkspaceStorageService } from '@rates-trading/shared-utils';

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

/**
 * Describes a single child window in a container-mode (startup_app) snapshot.
 */
export interface ContainerWindowEntry {
  name: string;
  url: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

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
  private workspaceStorage = inject(WorkspaceStorageService);

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
      let restoredFromSaved = false;
      const pendingRestore = localStorage.getItem(OpenFinService.PENDING_RESTORE_KEY);
      if (pendingRestore) {
        // Clear the flag immediately so it doesn't loop on next reload
        localStorage.removeItem(OpenFinService.PENDING_RESTORE_KEY);
        try {
          const pending = JSON.parse(pendingRestore) as { name: string; snapshot: unknown };
          // Wrap the saved GoldenLayout config inside the WebLayoutSnapshot envelope
          layoutSnapshot = { layouts: { default: pending.snapshot } } as WebLayoutSnapshot;
          restoredFromSaved = true;
          this.logger.info({ name: pending.name }, 'Restoring saved layout on startup');
        } catch {
          this.logger.warn('Failed to parse pending layout restore, falling back to default');
        }
      }

      // If no pending restore, check for a last-used layout to auto-restore
      if (!restoredFromSaved) {
        const lastLayoutName = this.getLastLayoutName();
        if (lastLayoutName) {
          const allLayouts = this.getSavedLayouts();
          const lastEntry = allLayouts.find((l) => l.name === lastLayoutName);
          if (lastEntry) {
            try {
              layoutSnapshot = { layouts: { default: lastEntry.snapshot } } as WebLayoutSnapshot;
              restoredFromSaved = true;

              // Restore bundled component states (column widths, filters, etc.)
              const componentStates = (lastEntry as Record<string, unknown>)['componentStates'] as Record<string, unknown> | undefined;
              if (componentStates && typeof componentStates === 'object') {
                this.workspaceStorage.restoreAllStates(componentStates);
              }

              this.logger.info({ name: lastLayoutName }, 'Auto-restoring last-used layout on startup');
            } catch {
              this.logger.warn({ name: lastLayoutName }, 'Failed to parse last-used layout, falling back to default');
            }
          } else {
            // The referenced layout was deleted — clear the stale reference
            this.clearLastLayout();
          }
        }
      }

      // If no pending restore and no last-used layout, load the default layout from config
      if (!restoredFromSaved && this.config.layoutUrl) {
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
      const layout = globalFin.Platform.Layout.getCurrentSync();
      const rootItem = await layout.getRootItem();

      // Find a non-status-bar stack to add the view to.
      // If only the status bar stack remains, create a new stack below it.
      const targetStack = await this.findNonStatusBarStack(rootItem);

      if (targetStack) {
        // Add the view as a new tab in the existing non-status-bar stack
        await targetStack.addView({ name, url: resolvedUrl });
        this.logger.info({ name, url }, 'View added to existing stack in platform layout');
      } else {
        // Only the status bar stack exists — create a new stack below it
        const statusBarStack = await this.findStatusBarStack(rootItem);
        if (statusBarStack) {
          await statusBarStack.createAdjacentStack(
            [{ name, url: resolvedUrl }],
            { position: 'bottom' },
          );
          this.logger.info({ name, url }, 'New stack created below status bar in platform layout');
        } else {
          // Fallback: use platform.createView if layout traversal fails
          const platform = globalFin.Platform.getCurrentSync();
          let windowIdentity: { uuid: string; name: string } | undefined;
          if (globalFin.me.isWindow) {
            windowIdentity = globalFin.me.identity;
          } else if (globalFin.me.isView) {
            const parentWin = await globalFin.me.getCurrentWindow();
            windowIdentity = parentWin.identity;
          }
          await platform.createView({ name, url: resolvedUrl }, windowIdentity);
          this.logger.info({ name, url }, 'View added via platform.createView fallback');
        }
      }
    } catch (error) {
      this.logger.error(error as Error, 'Failed to add platform view');
    }
  }

  /**
   * Recursively search the layout tree for a non-status-bar TabStack.
   * Returns the first TabStack that does NOT contain the status-bar view.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async findNonStatusBarStack(item: any): Promise<any | null> {
    if (item.type === 'stack') {
      const views = await item.getViews();
      const isStatusBar = views.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (v: any) => v.name === 'status-bar' || (v.identity && v.identity.name === 'status-bar'),
      );
      return isStatusBar ? null : item;
    }
    // ColumnOrRow — recurse into children
    if (typeof item.getContent === 'function') {
      const children = await item.getContent();
      for (const child of children) {
        const found = await this.findNonStatusBarStack(child);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Recursively search the layout tree for the status-bar TabStack.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async findStatusBarStack(item: any): Promise<any | null> {
    if (item.type === 'stack') {
      const views = await item.getViews();
      const isStatusBar = views.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (v: any) => v.name === 'status-bar' || (v.identity && v.identity.name === 'status-bar'),
      );
      return isStatusBar ? item : null;
    }
    // ColumnOrRow — recurse into children
    if (typeof item.getContent === 'function') {
      const children = await item.getContent();
      for (const child of children) {
        const found = await this.findStatusBarStack(child);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Restore the default platform layout by fetching the original manifest
   * and re-applying its snapshot. This properly re-creates all views
   * (including the status bar) from scratch.
   */
  async restoreDefaultPlatformLayout(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalFin = (window as any).fin;
    if (!globalFin?.Platform) {
      this.logger.error('Cannot restore default platform layout: not in Platform mode');
      return;
    }

    try {
      const platform = globalFin.Platform.getCurrentSync();

      // Fetch the platform manifest to get the original snapshot
      const manifestUrl = `${window.location.origin}/assets/openfin/app.platform.fin.json`;
      const response = await fetch(manifestUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch platform manifest: ${response.statusText}`);
      }
      const manifest = await response.json();

      if (manifest?.snapshot) {
        await platform.applySnapshot(manifest.snapshot, {
          closeExistingWindows: true,
        });
        this.logger.info('Default platform layout restored from manifest snapshot');
      } else {
        this.logger.error('Platform manifest does not contain a snapshot');
      }
    } catch (error) {
      this.logger.error(error as Error, 'Failed to restore default platform layout');
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

  /**
   * Single static storage key — entries are tagged with `env` so each
   * mode (container / platform / web) only sees its own saved layouts.
   * Using a static key avoids timing issues where the environment getter
   * returns the wrong value before config is loaded.
   */
  private static readonly LAYOUT_STORAGE_KEY = 'openfin-saved-layouts';
  private static readonly PENDING_RESTORE_KEY = 'openfin-pending-restore';
  /** Stores the last-used layout name per environment: `{ web: "My Layout", platform: "Trade View", container: "Default" }` */
  private static readonly LAST_LAYOUT_KEY = 'openfin-last-layout';

  /**
   * Save the current layout under a user-provided name.
   * Delegates to the correct API depending on environment:
   *
   *  - **Container** → enumerate child windows (bounds + URLs)
   *  - **Platform**  → `fin.Platform.getCurrentSync().getSnapshot()`
   *  - **Web (core-web)** → `layout.getConfig()`
   */
  async saveLayout(name: string): Promise<void> {
    try {
      let snapshot: unknown;
      const env = this.environment;

      if (env === 'container') {
        snapshot = await this.captureContainerSnapshot();
      } else if (env === 'platform') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const globalFin = (window as any).fin;
        const platform = globalFin.Platform.getCurrentSync();
        snapshot = await platform.getSnapshot();
      } else if (this.finApi) {
        // core-web
        const layout = this.finApi.Platform.Layout.getCurrentSync();
        snapshot = await (layout as unknown as { getConfig(): Promise<unknown> }).getConfig();
      } else {
        this.logger.error('Cannot save layout: OpenFin not initialized');
        return;
      }

      // Collect all workspace component states so they are bundled
      // with the layout snapshot and can be restored later.
      const componentStates = this.workspaceStorage.collectAllStates();

      const entry = {
        name,
        timestamp: Date.now(),
        snapshot,
        /** Tag the environment so restore uses the right strategy */
        env,
        /** Bundled component states (column widths, filters, etc.) */
        componentStates,
      };

      const all = this.getAllSavedLayouts();
      // Replace existing entry with same name + env, or append
      const idx = all.findIndex((l) => l.name === name && l.env === env);
      if (idx >= 0) {
        all[idx] = entry;
      } else {
        all.push(entry);
      }

      localStorage.setItem(
        OpenFinService.LAYOUT_STORAGE_KEY,
        JSON.stringify(all),
      );

      // Record as the last-used layout for this environment
      this.setLastLayout(name);

      this.logger.info({ name, env }, 'Layout saved');
    } catch (error) {
      this.logger.error(error as Error, 'Failed to save layout');
    }
  }

  /**
   * Restore a previously-saved layout by name.
   *
   *  - **Container** → close child windows, re-create from saved bounds/URLs
   *  - **Platform**  → `platform.applySnapshot()` (live, no reload needed)
   *  - **Web (core-web)** → stash in localStorage + page reload
   */
  async restoreLayout(name: string): Promise<void> {
    const all = this.getSavedLayouts();
    const entry = all.find((l) => l.name === name);
    if (!entry) {
      this.logger.warn({ name }, 'No saved layout found with this name');
      return;
    }

    // Restore bundled component states BEFORE views load.
    // Each WorkspaceComponent reads its state via the service in ngOnInit.
    const componentStates = (entry as Record<string, unknown>)['componentStates'] as Record<string, unknown> | undefined;
    if (componentStates && typeof componentStates === 'object') {
      this.workspaceStorage.restoreAllStates(componentStates);
    }

    const env = this.environment;

    // Record as the last-used layout for this environment
    this.setLastLayout(name);

    if (env === 'container') {
      await this.restoreContainerSnapshot(
        entry.snapshot as ContainerWindowEntry[],
      );
      this.logger.info({ name }, 'Container layout restored');
    } else if (env === 'platform') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const globalFin = (window as any).fin;
        const platform = globalFin.Platform.getCurrentSync();
        await platform.applySnapshot(entry.snapshot as never, {
          closeExistingWindows: true,
        });
        this.logger.info({ name }, 'Platform snapshot restored');
      } catch (error) {
        this.logger.error(error as Error, 'Failed to restore platform snapshot');
      }
    } else {
      // core-web: stash and reload
      localStorage.setItem(
        OpenFinService.PENDING_RESTORE_KEY,
        JSON.stringify({ name: entry.name, snapshot: entry.snapshot }),
      );
      this.logger.info({ name }, 'Pending layout restore set, reloading page...');
      window.location.reload();
    }
  }

  // ────────────────────────────────────────────────────────
  // Container-mode snapshot helpers (startup_app)
  // ────────────────────────────────────────────────────────

  /**
   * Capture the positions and URLs of all child windows.
   */
  private async captureContainerSnapshot(): Promise<ContainerWindowEntry[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalFin = (window as any).fin;
    const app = globalFin.Application.getCurrentSync();
    const childWindows = await app.getChildWindows();

    const entries: ContainerWindowEntry[] = [];
    for (const win of childWindows) {
      try {
        const options = await win.getOptions();
        const bounds = await win.getBounds();
        entries.push({
          name: options.name ?? win.identity?.name,
          url: options.url,
          top: bounds.top,
          left: bounds.left,
          width: bounds.width,
          height: bounds.height,
        });
      } catch {
        // Window may have closed between enumeration and query
      }
    }

    this.logger.info(
      { windowCount: entries.length },
      'Container snapshot captured',
    );
    return entries;
  }

  /**
   * Close all existing child windows and recreate them from a saved snapshot.
   */
  private async restoreContainerSnapshot(
    entries: ContainerWindowEntry[],
  ): Promise<void> {
    if (!Array.isArray(entries) || entries.length === 0) {
      this.logger.warn('No windows in saved container snapshot');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalFin = (window as any).fin;
    const app = globalFin.Application.getCurrentSync();

    // Close existing child windows first
    const existingWindows = await app.getChildWindows();
    for (const win of existingWindows) {
      try {
        await win.close(true);
      } catch {
        // Already closed
      }
    }

    // Recreate windows from snapshot
    for (const entry of entries) {
      try {
        await globalFin.Window.create({
          name: `${entry.name}-${Date.now()}`,
          url: entry.url,
          defaultTop: entry.top,
          defaultLeft: entry.left,
          defaultWidth: entry.width,
          defaultHeight: entry.height,
          frame: true,
          autoShow: true,
          contextMenu: true,
          backgroundColor: '#0f172a',
          saveWindowState: false,
          icon: this.resolveUrl('/favicon.ico'),
        });
      } catch (error) {
        this.logger.error(error as Error, 'Failed to recreate window');
      }
    }

    this.logger.info(
      { windowCount: entries.length },
      'Container windows restored',
    );
  }

  /**
   * Close all child windows (used by "Restore Default Layout" in container mode).
   */
  async closeAllChildWindows(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalFin = (window as any).fin;
    if (!globalFin?.Application?.getCurrentSync) return;

    try {
      const app = globalFin.Application.getCurrentSync();
      const childWindows = await app.getChildWindows();
      for (const win of childWindows) {
        try {
          await win.close(true);
        } catch {
          // Already closed
        }
      }
      this.logger.info('All child windows closed');
    } catch (error) {
      this.logger.error(error as Error, 'Failed to close child windows');
    }
  }

  /**
   * Return saved layouts for the **current** environment only.
   * Used by the UI to build the Restore / Delete menus.
   */
  getSavedLayouts(): { name: string; timestamp: number; snapshot: unknown; env?: string }[] {
    const env = this.environment;
    return this.getAllSavedLayouts().filter((l) => l.env === env);
  }

  /**
   * Return ALL saved layouts across every environment (unfiltered).
   * Used internally for read-modify-write operations on localStorage.
   */
  private getAllSavedLayouts(): { name: string; timestamp: number; snapshot: unknown; env?: string }[] {
    try {
      const raw = localStorage.getItem(OpenFinService.LAYOUT_STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  /**
   * Delete a saved layout by name (scoped to the current environment).
   * If the deleted layout was the last-used one, clear that reference too.
   */
  deleteLayout(name: string): void {
    const env = this.environment;
    const all = this.getAllSavedLayouts();
    const filtered = all.filter((l) => !(l.name === name && l.env === env));
    localStorage.setItem(
      OpenFinService.LAYOUT_STORAGE_KEY,
      JSON.stringify(filtered),
    );

    // If the deleted layout was the last-used one, clear the reference
    if (this.getLastLayoutName() === name) {
      this.clearLastLayout();
    }

    this.logger.info({ name }, 'Saved layout deleted');
  }

  // ────────────────────────────────────────────────────────
  // Last-used layout tracking
  // ────────────────────────────────────────────────────────

  /**
   * Record the name of the last-used layout for the current environment.
   * Called automatically after save or restore.
   */
  setLastLayout(name: string): void {
    try {
      const env = this.environment;
      const map = this.getLastLayoutMap();
      map[env] = name;
      localStorage.setItem(OpenFinService.LAST_LAYOUT_KEY, JSON.stringify(map));
      this.logger.info({ name, env }, 'Last layout recorded');
    } catch {
      // localStorage may be full or unavailable
    }
  }

  /**
   * Get the name of the last-used layout for the current environment.
   * Returns `null` if no last-used layout is recorded or it was cleared.
   */
  getLastLayoutName(): string | null {
    try {
      const env = this.environment;
      const map = this.getLastLayoutMap();
      return map[env] ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Clear the last-used layout for the current environment
   * (e.g. when "Restore Default Layout" is selected).
   */
  clearLastLayout(): void {
    try {
      const env = this.environment;
      const map = this.getLastLayoutMap();
      delete map[env];
      localStorage.setItem(OpenFinService.LAST_LAYOUT_KEY, JSON.stringify(map));
      this.logger.info({ env }, 'Last layout cleared');
    } catch {
      // ignore
    }
  }

  /** Read the last-layout map from localStorage. */
  private getLastLayoutMap(): Record<string, string> {
    try {
      const raw = localStorage.getItem(OpenFinService.LAST_LAYOUT_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch {
      return {};
    }
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
