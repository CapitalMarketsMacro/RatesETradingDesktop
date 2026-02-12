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

  /** Connection status observable */
  private connectionStatusSubject = new BehaviorSubject<OpenFinConnectionStatus>(
    OpenFinConnectionStatus.Disconnected
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
    return this.connectionStatusSubject.value === OpenFinConnectionStatus.Connected;
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
   * Initialize the service with runtime configuration.
   * Must be called before `connectToBroker()` or `connectAsView()`.
   */
  initialize(config: Partial<OpenFinConfig>): void {
    this.config = { ...DEFAULT_OPENFIN_CONFIG, ...config };
    this.logger.info({ providerId: this.config.providerId }, 'OpenFin service initialized');
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
      this.logger.info('OpenFin is disabled in configuration, skipping connection');
      return null;
    }

    if (this.isConnected && this.finApi) {
      this.logger.warn('Already connected to OpenFin broker');
      return this.finApi;
    }

    this.connectionStatusSubject.next(OpenFinConnectionStatus.Connecting);

    try {
      const brokerUrl = this.resolveUrl(this.config.brokerUrl);

      // Load the default layout snapshot (falls back to empty if fetch fails)
      let layoutSnapshot: WebLayoutSnapshot = EMPTY_LAYOUT_SNAPSHOT;
      if (this.config.layoutUrl) {
        const fetched = await this.fetchLayoutSnapshot(
          this.resolveUrl(this.config.layoutUrl)
        );
        if (fetched) {
          layoutSnapshot = fetched;
        }
      }

      this.logger.info(
        { brokerUrl, providerId: this.config.providerId },
        'Connecting to OpenFin Web Broker (host)...'
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

      // Initialize Interop
      await fin.Interop.init(this.config.providerId);
      this.logger.info('OpenFin Interop initialized');

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
      this.logger.error(error as Error, 'Failed to connect to OpenFin Web Broker');
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
      this.logger.info('Connecting to OpenFin Web Broker (view, inheriting from host)...');

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
      this.logger.error(error as Error, 'Failed to connect view to OpenFin Web Broker');
      throw error;
    }
  }

  /**
   * Add a view (iframe) to the current layout.
   *
   * @param name Unique name for the view.
   * @param url  URL to load inside the view iframe (can be relative).
   */
  async addView(name: string, url: string): Promise<void> {
    if (!this.finApi) {
      this.logger.error('Cannot add view: OpenFin not initialized');
      return;
    }

    try {
      const layout = this.finApi.Platform.Layout.getCurrentSync();
      await layout.addView({
        name,
        url: this.resolveUrl(url),
      } as never);
      this.logger.info({ name, url }, 'View added to layout');
    } catch (error) {
      this.logger.error(error as Error, 'Failed to add view to layout');
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
    contextType?: string
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
      throw new Error('Not connected to OpenFin. Call connectToBroker() first.');
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
  private async fetchLayoutSnapshot(url: string): Promise<WebLayoutSnapshot | undefined> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        this.logger.warn({ url, status: response.status }, 'Failed to fetch layout snapshot');
        return undefined;
      }
      return (await response.json()) as WebLayoutSnapshot;
    } catch (error) {
      this.logger.warn({ err: error }, 'Error fetching layout snapshot, using empty layout');
      return undefined;
    }
  }
}
