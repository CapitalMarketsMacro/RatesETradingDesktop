import { Component, inject, OnInit, OnDestroy, AfterViewInit, NgZone, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { MenubarModule } from 'primeng/menubar';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { RatesData } from '@rates-trading/data-access';
import { ConfigurationService, RatesAppConfiguration } from '@rates-trading/configuration';
import { TRANSPORT_SERVICE, ConnectionStatus } from '@rates-trading/transports';
import { LoggerService, RemoteLoggerService } from '@rates-trading/logger';
import { OpenFinService, OpenFinConnectionStatus } from '@rates-trading/openfin';
import { StatusBarComponent } from './d2d/status-bar/status-bar.component';

export interface TreasurySecurity {
  cusip: string;
  security: string;
  maturityDate: string;
  coupon: number;
  price: string;
  yield: number;
  change: string;
  changeBps: number;
  bid: string;
  ask: string;
  spread: string;
  volume: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MenubarModule, ButtonModule, DialogModule, InputTextModule, StatusBarComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, AfterViewInit, OnDestroy {
  private ratesData = inject(RatesData);
  private configService = inject(ConfigurationService);
  private transport = inject(TRANSPORT_SERVICE);
  readonly openfinService = inject(OpenFinService);
  private remoteLoggerService = inject(RemoteLoggerService);
  private logger = inject(LoggerService).child({ component: 'App' });
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('layoutContainer') layoutContainer?: ElementRef;

  title = 'Rates E-Trading Desktop';
  config?: RatesAppConfiguration;
  protected rates: { symbol: string; rate: number; change: number }[] = [];

  menuItems: MenuItem[] = [];
  isDarkTheme = false;

  // AMPS connection state
  connectionStatus: ConnectionStatus = ConnectionStatus.Disconnected;

  // OpenFin state
  openfinStatus: OpenFinConnectionStatus = OpenFinConnectionStatus.Disconnected;
  private pendingOpenFinConfig?: RatesAppConfiguration;

  // Save-layout dialog
  showSaveDialog = false;
  saveLayoutName = '';

  /** Name of the currently active layout (shown in menubar) */
  currentLayoutName: string | null = null;

  /**
   * True on the default route (host page with layout), false on sub-routes (iframe views).
   * Uses window.location.pathname directly — this is synchronous and immediately correct,
   * unlike router events which may fire after lifecycle hooks.
   */
  isDefaultRoute = window.location.pathname === '/' || window.location.pathname === '';

  private router = inject(Router);

  constructor() {
    this.rates = this.ratesData.getRates();
  }

  ngOnInit() {
    // Initialize menu items — commands add views to the OpenFin layout
    this.menuItems = [
      {
        label: 'Market Data',
        icon: 'pi pi-chart-line',
        items: [
          {
            label: 'Top of the Book',
            icon: 'pi pi-list',
            command: () => this.addViewFromMenu('top-of-book', '/market-data/top-of-book'),
          },
          {
            label: 'Market Data Blotter',
            icon: 'pi pi-table',
            command: () => this.addViewFromMenu('market-data-blotter', '/market-data/blotter'),
          },
        ],
      },
      {
        label: 'Executions',
        icon: 'pi pi-check-circle',
        command: () => this.addViewFromMenu('executions-blotter', '/executions'),
      },
      {
        label: 'Trading',
        icon: 'pi pi-briefcase',
        command: () => this.addViewFromMenu('trading', '/trading'),
      },
      {
        label: 'Preferences',
        icon: 'pi pi-cog',
        items: [
          {
            label: 'Save Layout',
            icon: 'pi pi-save',
            command: () => this.showSaveLayoutDialog(),
          },
          {
            label: 'Restore Layout',
            icon: 'pi pi-replay',
            items: this.buildRestoreLayoutMenuItems(),
          },
          {
            label: 'Delete Layout',
            icon: 'pi pi-trash',
            items: this.buildDeleteLayoutMenuItems(),
          },
          { separator: true },
          {
            label: 'Restore Default Layout',
            icon: 'pi pi-refresh',
            command: () => this.restoreDefaultLayout(),
          },
        ],
      },
    ];

    // Load configuration
    this.configService.loadConfiguration().subscribe((config) => {
      this.config = config;
      // Set title from configuration
      this.title = config.app.name;

      // Initialize remote logger if configured
      this.initializeRemoteLogger(config);

      // Connect to AMPS and subscribe to market data
      this.connectToTransport();

      // Defer OpenFin init until AfterViewInit (layout container must be in DOM)
      this.pendingOpenFinConfig = config;
    });

    // Subscribe to connection status changes
    this.transport.connectionStatus$.subscribe((status) => {
      this.ngZone.run(() => {
        this.connectionStatus = status;
        this.logger.debug({ status }, 'Transport connection status changed');
        this.cdr.detectChanges();
      });
    });

    // Subscribe to OpenFin connection status
    this.openfinService.connectionStatus$.subscribe((status) => {
      this.ngZone.run(() => {
        this.openfinStatus = status;
        this.logger.debug({ status }, 'OpenFin connection status changed');
        this.cdr.detectChanges();
      });
    });

    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      this.isDarkTheme = true;
      document.documentElement.classList.add('app-dark');
    }
  }

  ngAfterViewInit() {
    // Layout container is now in the DOM — initialize OpenFin if config is ready
    if (this.pendingOpenFinConfig) {
      this.initializeOpenFin(this.pendingOpenFinConfig);
      this.pendingOpenFinConfig = undefined;
    }
  }

  ngOnDestroy() {
    // Cleanup subscriptions
    this.disconnectFromTransport();
    // Shutdown remote logger
    this.remoteLoggerService.shutdown();
    // Disconnect OpenFin
    this.openfinService.disconnect();
  }

  /**
   * Initialize OpenFin based on the detected runtime environment.
   *
   * - **Platform** : Running inside an OpenFin Platform manifest.
   *   The Angular app is the platform window URL — the platform runtime
   *   auto-manages the layout in `#layout-container`. Menu clicks use
   *   `platform.createView()` to add views as tabs.
   * - **Container** : The native `fin` API is already available (startup_app).
   *   Menu commands use `fin.Window.create()` to open separate windows.
   * - **Web (core-web)** :
   *   - Host page → `connectToBroker()` + layout engine
   *   - Iframe view → `connectAsView()` (inherits broker)
   * - **Browser** : No OpenFin at all — skipped.
   */
  private async initializeOpenFin(config: RatesAppConfiguration): Promise<void> {
    if (!config.openfin?.enabled) {
      this.logger.info('OpenFin is not enabled in configuration');
      return;
    }

    try {
      this.openfinService.initialize(config.openfin);
      const env = this.openfinService.environment;
      this.logger.info({ env }, 'Detected OpenFin environment');

      if (env === 'platform') {
        // OpenFin Platform — we must call Layout.init() to register the
        // layout channel actions (add-view, etc.) and bind GoldenLayout
        // to the #layout-container element. The layout content comes from
        // the manifest snapshot.
        if (this.isDefaultRoute) {
          await this.openfinService.initPlatformLayout();
          this.logger.info('OpenFin Platform layout initialized — views will be added via platform.createView()');

          // Auto-restore the last-used layout (if any)
          await this.autoRestoreLastLayout();
        } else {
          // Sub-route loaded as a platform view — just mark connected
          this.openfinService.markContainerConnected();
          this.logger.info('Connected as platform view');
        }
      } else if (env === 'container') {
        // Native container (startup_app) — fin is already on window.
        // Each view opens in its own native window via fin.Window.create().
        this.openfinService.markContainerConnected();
        this.logger.info('Running inside OpenFin container — views will open as native windows');

        // Only auto-restore from the MAIN window, not from child windows
        // (child windows also detect as 'container' and would cause a loop)
        if (this.isDefaultRoute) {
          await this.autoRestoreLastLayout();
        }
      } else if (env === 'web') {
        if (this.isDefaultRoute) {
          // Host page — connect to broker and initialize the layout engine
          const container = this.layoutContainer?.nativeElement;
          if (!container) {
            this.logger.error('Layout container element not found, cannot init OpenFin layout');
            return;
          }
          await this.openfinService.connectToBroker(container);
          this.logger.info('OpenFin Web Broker connected with layout');

          // If a last-used layout was auto-restored during connectToBroker,
          // reflect its name in the menubar.
          const webLastLayout = this.openfinService.getLastLayoutName();
          if (webLastLayout) {
            this.currentLayoutName = webLastLayout;
          }
        } else {
          // Sub-route (loaded in an OpenFin layout iframe) — inherit broker connection
          await this.openfinService.connectAsView();
          this.logger.info('Connected as OpenFin view (inherited broker)');
        }
      }
      // Now that the environment is known, rebuild Preferences menu
      // so saved layouts are filtered to the correct mode.
      this.refreshPreferencesMenu();
    } catch (error) {
      this.logger.error(error as Error, 'Failed to initialize OpenFin');
    }
  }

  /**
   * Add a view to the OpenFin layout.
   * @param name Unique view name.
   * @param url  URL to load (can be relative, e.g. '/market-data/blotter').
   */
  async addViewToLayout(name: string, url: string): Promise<void> {
    await this.openfinService.addView(name, url);
  }

  /**
   * Called by PrimeNG menu commands — opens the view using the best
   * available mechanism based on the runtime environment:
   *
   *  1. **OpenFin Platform** → `platform.createView()` (tab in platform window layout)
   *  2. **OpenFin Container** → `fin.Window.create()` (new native window)
   *  3. **OpenFin Web (core-web)** → `layout.addView()` (iframe tab in GoldenLayout)
   *  4. **Plain browser** → Angular `router.navigate()` (SPA routing)
   */
  private async addViewFromMenu(baseName: string, url: string): Promise<void> {
    const env = this.openfinService.environment;
    const viewName = `${baseName}-${Date.now()}`;

    // Append viewId to the URL so each view instance has a unique
    // identifier for per-instance state persistence.
    const separator = url.includes('?') ? '&' : '?';
    const urlWithViewId = `${url}${separator}viewId=${encodeURIComponent(viewName)}`;

    if (env === 'platform') {
      // OpenFin Platform — add view as a tab in the platform window's layout
      this.logger.info({ viewName, url: urlWithViewId, env }, 'Adding view to platform layout');
      await this.openfinService.addPlatformView(viewName, urlWithViewId);
    } else if (env === 'container') {
      // Native OpenFin container (startup_app) — open each view in its own native window
      this.logger.info({ viewName, url: urlWithViewId, env }, 'Opening view in new OpenFin window');
      await this.openfinService.createWindow(viewName, urlWithViewId);
    } else if (env === 'web' && this.openfinService.isConnected) {
      // core-web mode — add as a tab in the GoldenLayout
      this.logger.info({ viewName, url: urlWithViewId, env }, 'Adding view to layout');
      await this.addViewToLayout(viewName, urlWithViewId);
    } else {
      // Plain browser fallback — use stateKey (route path) as instance ID
      this.router.navigate([url]);
    }
  }

  // ────────────────────────────────────────────────────────
  // Layout save / restore / delete
  // ────────────────────────────────────────────────────────

  /** Open the save-layout dialog */
  showSaveLayoutDialog(): void {
    this.saveLayoutName = '';
    this.showSaveDialog = true;
    // Hide platform views so the dialog is visible
    if (this.openfinService.isPlatform) {
      this.openfinService.setPlatformViewsVisible(false);
    }
  }

  /** Called when the user confirms the save dialog */
  async confirmSaveLayout(): Promise<void> {
    const name = this.saveLayoutName.trim();
    if (!name) return;

    await this.openfinService.saveLayout(name);
    this.currentLayoutName = name;
    this.showSaveDialog = false;
    this.refreshPreferencesMenu();
    this.logger.info({ name }, 'Layout saved from menu');
    // Restore view visibility
    if (this.openfinService.isPlatform) {
      this.openfinService.setPlatformViewsVisible(true);
    }
  }

  /** Called when the save dialog is cancelled or closed */
  onSaveDialogHide(): void {
    if (this.openfinService.isPlatform) {
      this.viewsHiddenForMenu = false;
      this.openfinService.setPlatformViewsVisible(true);
    }
  }

  /** Restore a saved layout by name */
  private async restoreSavedLayout(name: string): Promise<void> {
    await this.openfinService.restoreLayout(name);
    this.currentLayoutName = name;
    this.cdr.detectChanges();
  }

  /** Delete a saved layout by name and refresh the menu */
  private deleteSavedLayout(name: string): void {
    this.openfinService.deleteLayout(name);
    this.refreshPreferencesMenu();
    this.logger.info({ name }, 'Layout deleted from menu');
  }

  /**
   * Restore the default layout.
   *
   * - **Container** → close all child windows (back to bare main window)
   * - **Platform** → fetch original manifest and re-apply the default snapshot
   * - **Web** → reload the page to load the default snapshot
   *
   * Clears the last-used layout so the next launch starts with the default.
   */
  private async restoreDefaultLayout(): Promise<void> {
    if (!this.openfinService.isConnected) return;

    // Clear the last-used layout so next app launch starts fresh
    this.openfinService.clearLastLayout();
    this.currentLayoutName = null;
    this.cdr.detectChanges();

    const env = this.openfinService.environment;
    if (env === 'container') {
      this.logger.info('Restoring default layout (closing all child windows)...');
      await this.openfinService.closeAllChildWindows();
    } else if (env === 'platform') {
      this.logger.info('Restoring default platform layout from manifest...');
      await this.openfinService.restoreDefaultPlatformLayout();
    } else {
      this.logger.info('Restoring default layout (reloading page)...');
      window.location.reload();
    }
  }

  /**
   * Auto-restore the last-used layout on application startup.
   *
   * Checks if there's a recorded last-used layout for the current environment.
   * If found and the layout still exists, restores it silently.
   *
   * Uses a timestamp guard to prevent infinite loops:
   * - In **Platform mode**, `applySnapshot({ closeExistingWindows: true })`
   *   destroys and recreates the window, which reloads the app and triggers
   *   `initializeOpenFin()` again. The guard detects this and skips.
   * - In **Container mode**, child windows must NOT call this (guarded by
   *   `isDefaultRoute` in the caller).
   *
   * Web mode handles last-layout auto-restore directly in `connectToBroker()`.
   */
  private static readonly AUTO_RESTORE_GUARD_KEY = 'openfin-auto-restore-guard';
  private static readonly AUTO_RESTORE_GUARD_WINDOW_MS = 30_000; // 30 seconds

  private async autoRestoreLastLayout(): Promise<void> {
    // ── Guard against infinite loops ──
    // If we recently auto-restored (< 30s ago), the current startup is
    // likely caused by that restore (e.g. Platform applySnapshot recreated
    // the window). Clear the guard and skip.
    const guardTimestamp = localStorage.getItem(App.AUTO_RESTORE_GUARD_KEY);
    if (guardTimestamp) {
      const elapsed = Date.now() - parseInt(guardTimestamp, 10);
      if (elapsed < App.AUTO_RESTORE_GUARD_WINDOW_MS) {
        localStorage.removeItem(App.AUTO_RESTORE_GUARD_KEY);
        this.logger.info('Skipping auto-restore (recently restored, preventing loop)');
        // Still show the layout name — we're running inside the restored layout
        const lastName = this.openfinService.getLastLayoutName();
        if (lastName) {
          this.currentLayoutName = lastName;
          this.cdr.detectChanges();
        }
        return;
      }
      // Guard is stale (> 30s) — remove it and proceed normally
      localStorage.removeItem(App.AUTO_RESTORE_GUARD_KEY);
    }

    const lastLayoutName = this.openfinService.getLastLayoutName();
    if (!lastLayoutName) return;

    // Verify the layout still exists
    const saved = this.openfinService.getSavedLayouts();
    const entry = saved.find((l) => l.name === lastLayoutName);
    if (!entry) {
      // Layout was deleted — clear the stale reference
      this.openfinService.clearLastLayout();
      return;
    }

    // Set the guard BEFORE restoring — if the restore recreates the window,
    // the next startup will see this guard and skip.
    localStorage.setItem(App.AUTO_RESTORE_GUARD_KEY, Date.now().toString());

    this.logger.info({ name: lastLayoutName }, 'Auto-restoring last-used layout on startup');
    try {
      await this.openfinService.restoreLayout(lastLayoutName);
      this.currentLayoutName = lastLayoutName;
      this.cdr.detectChanges();
    } catch (error) {
      // Clear the guard on failure so the next launch can try again
      localStorage.removeItem(App.AUTO_RESTORE_GUARD_KEY);
      this.logger.error(error as Error, 'Failed to auto-restore last layout');
    }
  }

  /** Build PrimeNG MenuItem[] for the Restore Layout submenu from localStorage */
  private buildRestoreLayoutMenuItems(): MenuItem[] {
    const saved = this.openfinService.getSavedLayouts();
    if (saved.length === 0) {
      return [{ label: '(no saved layouts)', disabled: true }];
    }
    return saved.map((entry) => ({
      label: entry.name,
      icon: 'pi pi-clone',
      command: () => this.restoreSavedLayout(entry.name),
    }));
  }

  /** Build PrimeNG MenuItem[] for the Delete Layout submenu from localStorage */
  private buildDeleteLayoutMenuItems(): MenuItem[] {
    const saved = this.openfinService.getSavedLayouts();
    if (saved.length === 0) {
      return [{ label: '(no saved layouts)', disabled: true }];
    }
    return saved.map((entry) => ({
      label: entry.name,
      icon: 'pi pi-times',
      command: () => this.deleteSavedLayout(entry.name),
    }));
  }

  /** Rebuild the Preferences sub-menu so Restore / Delete reflect current localStorage */
  private refreshPreferencesMenu(): void {
    const prefsMenu = this.menuItems.find((m) => m.label === 'Preferences');
    if (prefsMenu?.items) {
      const restoreItem = prefsMenu.items.find((i) => (i as MenuItem).label === 'Restore Layout') as MenuItem | undefined;
      const deleteItem = prefsMenu.items.find((i) => (i as MenuItem).label === 'Delete Layout') as MenuItem | undefined;
      if (restoreItem) restoreItem.items = this.buildRestoreLayoutMenuItems();
      if (deleteItem) deleteItem.items = this.buildDeleteLayoutMenuItems();
    }
    // PrimeNG Menubar needs a new array reference to detect changes
    this.menuItems = [...this.menuItems];
    this.cdr.detectChanges();
  }

  /**
   * Initialize the remote logger (NATS-based) from configuration.
   * Logs will be published to a NATS topic for centralised collection.
   */
  private initializeRemoteLogger(config: RatesAppConfiguration): void {
    const logging = config.logging;
    if (!logging?.enableRemote || !logging.remote) {
      return;
    }

    const remote = logging.remote;
    const levelMap: Record<string, number> = {
      trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60,
    };

    this.remoteLoggerService.initialize({
      enabled: true,
      natsUrl: remote.natsUrl,
      topic: remote.topic,
      clientName: config.app.name || 'rates-desktop',
      minLevel: levelMap[remote.minLevel ?? 'info'] ?? 30,
      bufferSize: remote.bufferSize,
      flushIntervalMs: remote.flushIntervalMs,
      token: remote.token,
      user: remote.user,
      password: remote.password,
      metadata: {
        app: config.app.name,
        version: config.app.version,
        env: config.app.environment,
        hostname: window.location.hostname,
      },
    });

    this.logger.info(
      { topic: remote.topic, natsUrl: remote.natsUrl },
      'Remote logger initialized — logs will be published to NATS',
    );
  }

  /**
   * Connect to AMPS transport
   */
  private async connectToTransport(): Promise<void> {
    try {
      this.logger.info('Connecting to AMPS transport...');
      await this.transport.connect();
      this.logger.info('Connected to AMPS transport');
    } catch (error) {
      this.logger.error(error as Error, 'Failed to connect to AMPS');
    }
  }

  /**
   * Disconnect from transport and cleanup
   */
  private async disconnectFromTransport(): Promise<void> {
    try {
      await this.transport.disconnect();
      this.logger.info('Disconnected from AMPS transport');
    } catch (error) {
      this.logger.error(error as Error, 'Error disconnecting from transport');
    }
  }

  /**
   * Manually reconnect to transport
   */
  async reconnect(): Promise<void> {
    await this.disconnectFromTransport();
    await this.connectToTransport();
  }

  /**
   * Get connection status label for display
   */
  get connectionStatusLabel(): string {
    switch (this.connectionStatus) {
      case ConnectionStatus.Connected:
        return 'Connected';
      case ConnectionStatus.Connecting:
        return 'Connecting...';
      case ConnectionStatus.Disconnected:
        return 'Disconnected';
      case ConnectionStatus.Reconnecting:
        return 'Reconnecting...';
      case ConnectionStatus.Error:
        return 'Error';
      default:
        return 'Unknown';
    }
  }

  /**
   * Get connection status CSS class
   */
  get connectionStatusClass(): string {
    switch (this.connectionStatus) {
      case ConnectionStatus.Connected:
        return 'status-connected';
      case ConnectionStatus.Connecting:
      case ConnectionStatus.Reconnecting:
        return 'status-connecting';
      case ConnectionStatus.Disconnected:
      case ConnectionStatus.Error:
        return 'status-disconnected';
      default:
        return '';
    }
  }

  toggleTheme(): void {
    this.isDarkTheme = !this.isDarkTheme;
    const html = document.documentElement;
    if (this.isDarkTheme) {
      html.classList.add('app-dark');
      localStorage.setItem('theme', 'dark');
    } else {
      html.classList.remove('app-dark');
      localStorage.setItem('theme', 'light');
    }
  }

  get themeLabel(): string {
    return this.isDarkTheme ? 'Light Mode' : 'Dark Mode';
  }

  get themeIcon(): string {
    return this.isDarkTheme ? 'pi pi-sun' : 'pi pi-moon';
  }

  // ────────────────────────────────────────────────────────
  // Platform menu workaround: hide views while menu is open
  // ────────────────────────────────────────────────────────

  /** Track whether views are currently hidden for menu interaction */
  private viewsHiddenForMenu = false;

  /**
   * Called when the user clicks on a menubar root item.
   * In platform mode, hides all views so the dropdown is visible.
   */
  onMenubarItemClick(): void {
    if (this.openfinService.isPlatform && !this.viewsHiddenForMenu) {
      this.viewsHiddenForMenu = true;
      this.openfinService.setPlatformViewsVisible(false);
    }
  }

  /**
   * Called when the mouse leaves the menubar area.
   * Restores view visibility after a short delay — but NOT if a dialog is open.
   */
  onMenubarLeave(): void {
    if (this.openfinService.isPlatform && this.viewsHiddenForMenu) {
      // Don't restore views if a dialog is currently showing
      if (this.showSaveDialog) return;

      // Small delay so the menu can close before views reappear
      setTimeout(() => {
        // Re-check: dialog may have opened during the delay
        if (this.showSaveDialog) return;
        this.viewsHiddenForMenu = false;
        this.openfinService.setPlatformViewsVisible(true);
      }, 150);
    }
  }
}
