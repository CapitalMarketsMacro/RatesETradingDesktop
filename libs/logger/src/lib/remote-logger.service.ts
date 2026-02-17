import { Injectable, OnDestroy } from '@angular/core';
import { wsconnect, NatsConnection, ConnectionOptions } from '@nats-io/nats-core';
import type {
  LogEntry,
  MainToWorkerMessage,
  WorkerToMainMessage,
} from './remote-logger-worker-protocol';

/**
 * Remote logger configuration
 */
export interface RemoteLoggerConfig {
  /** Whether remote logging is enabled */
  enabled: boolean;
  /** NATS server URL (WebSocket) */
  natsUrl: string;
  /** NATS topic/subject to publish log entries to */
  topic: string;
  /** Client name for identification */
  clientName?: string;
  /** Minimum log level to send remotely (numeric Pino level) */
  minLevel?: number;
  /** Maximum buffer size before flushing */
  bufferSize?: number;
  /** Flush interval in milliseconds */
  flushIntervalMs?: number;
  /** NATS authentication token */
  token?: string;
  /** NATS user for authentication */
  user?: string;
  /** NATS password for authentication */
  password?: string;
  /** Application metadata to include in every log entry */
  metadata?: Record<string, unknown>;
}

/**
 * RemoteLoggerService
 *
 * Publishes application log entries to a NATS topic for centralised
 * log collection. Designed to be used alongside the Pino-based
 * `LoggerService` — the local logger's `write` callback pushes raw
 * log objects into this service, which buffers and flushes them in
 * batches over a lightweight NATS WebSocket connection.
 *
 * ## Key design decisions
 *
 * - **Web Worker offloading** — NATS connection management, JSON
 *   serialization, and publishing are offloaded to a dedicated Web
 *   Worker, keeping the main thread free from any blocking I/O.
 *   If `Worker` is unavailable, the service falls back to managing
 *   the NATS connection directly on the main thread.
 *
 * - **Own NATS connection** — The remote logger maintains its own
 *   dedicated NATS connection rather than sharing the application's
 *   transport. This avoids circular dependencies (transport depends
 *   on logger) and ensures logging remains available even if the main
 *   transport disconnects.
 *
 * - **Buffered publishing** — Log entries are buffered and flushed
 *   either when the buffer reaches a configurable size or on a
 *   periodic interval. This reduces per-message overhead.
 *
 * - **Fire-and-forget** — Publishing failures are silently swallowed.
 *   Logging should never crash the application.
 *
 * - **Auto-reconnect** — If the NATS connection drops or hasn't been
 *   established yet, the service will retry on each flush cycle.
 *
 * ## Usage
 *
 * ```typescript
 * const remoteLogger = inject(RemoteLoggerService);
 * await remoteLogger.initialize({
 *   enabled: true,
 *   natsUrl: 'ws://localhost:8224',
 *   topic: 'logs.rates-desktop',
 *   clientName: 'rates-desktop',
 *   metadata: { app: 'rates-desktop', env: 'dev' },
 * });
 *
 * // Then push log objects (called from LoggerService's write callback):
 * remoteLogger.push(logObject);
 * ```
 */
@Injectable({ providedIn: 'root' })
export class RemoteLoggerService implements OnDestroy {
  private config: RemoteLoggerConfig | null = null;
  private buffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private _initialized = false;
  private connected = false;
  private publishedCount = 0;
  private droppedCount = 0;

  // Worker mode
  private worker: Worker | null = null;
  private useWorker = false;

  // Fallback (direct NATS on main thread)
  private connection: NatsConnection | null = null;
  private encoder = new TextEncoder();
  private connecting = false;

  /** Whether the service has been initialized and is ready to accept logs. */
  get initialized(): boolean {
    return this._initialized;
  }

  /** Whether the NATS connection is currently active. */
  get isConnected(): boolean {
    return this.connected;
  }

  /** The NATS URL the remote logger is connected to (null if not initialized). */
  get natsUrl(): string | null {
    return this.config?.natsUrl ?? null;
  }

  /** The NATS topic logs are published to (null if not initialized). */
  get topic(): string | null {
    return this.config?.topic ?? null;
  }

  /** Total number of log entries published to NATS. */
  get totalPublished(): number {
    return this.publishedCount;
  }

  /** Number of entries currently waiting in the buffer. */
  get pendingCount(): number {
    return this.buffer.length;
  }

  /**
   * Initialize and connect to the NATS server.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  async initialize(config: RemoteLoggerConfig): Promise<void> {
    if (this._initialized || !config.enabled) {
      return;
    }

    this.config = {
      minLevel: 30,       // info by default
      bufferSize: 50,
      flushIntervalMs: 5000,
      ...config,
    };

    this._initialized = true;

    // eslint-disable-next-line no-console
    console.info(
      `[RemoteLogger] Initialized — natsUrl=${this.config.natsUrl}, topic="${this.config.topic}", ` +
      `minLevel=${this.config.minLevel}, bufferSize=${this.config.bufferSize}, flushMs=${this.config.flushIntervalMs}`,
    );

    // Try to use a Web Worker for NATS, fall back to main thread
    const worker = this.createWorker();
    if (worker) {
      this.worker = worker;
      this.worker.onmessage = (event: MessageEvent<WorkerToMainMessage>) =>
        this.onWorkerMessage(event.data);
      this.worker.onerror = (err) => {
        // eslint-disable-next-line no-console
        console.warn('[RemoteLogger] Worker error, falling back to main thread', err);
        this.worker?.terminate();
        this.worker = null;
        this.useWorker = false;
        this.fallbackConnect();
      };

      this.useWorker = true;

      const initMsg: MainToWorkerMessage = {
        type: 'init',
        config: {
          natsUrl: this.config.natsUrl,
          topic: this.config.topic,
          clientName: this.config.clientName,
          token: this.config.token,
          user: this.config.user,
          password: this.config.password,
        },
      };
      this.worker.postMessage(initMsg);

      // eslint-disable-next-line no-console
      console.info('[RemoteLogger] Using Web Worker for NATS publishing');
    } else {
      this.fallbackConnect();
    }

    // Start periodic flush
    this.flushTimer = setInterval(
      () => this.flush(),
      this.config.flushIntervalMs,
    );
  }

  /**
   * Push a raw Pino log object for remote publishing.
   * This is the hot path — must be fast and never throw.
   */
  push(logObj: Record<string, unknown>): void {
    if (!this._initialized || !this.config) return;

    const level = (logObj['level'] as number) ?? 30;

    // Drop entries below the configured minimum level
    if (level < (this.config.minLevel ?? 0)) return;

    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level,
      levelName: RemoteLoggerService.levelName(level),
      msg: (logObj['msg'] as string) ?? '',
      logger:
        (logObj['component'] as string) ??
        (logObj['service'] as string) ??
        (logObj['module'] as string) ??
        'App',
      data: this.extractData(logObj),
      meta: this.config.metadata ?? {},
    };

    this.buffer.push(entry);

    // Flush immediately if buffer is full
    if (this.buffer.length >= (this.config.bufferSize ?? 50)) {
      this.flush();
    }
  }

  /**
   * Flush buffered log entries to NATS.
   * In worker mode, sends entries to the worker via postMessage.
   * In fallback mode, publishes directly on the main thread.
   */
  flush(): void {
    if (this.buffer.length === 0 || !this.config) return;

    if (this.useWorker && this.worker) {
      const entries = this.buffer.splice(0);
      const msg: MainToWorkerMessage = { type: 'flush', entries };
      this.worker.postMessage(msg);
      return;
    }

    // Fallback: direct NATS on main thread
    this.fallbackFlush();
  }

  /**
   * Graceful shutdown — flush remaining entries and close the connection.
   */
  async shutdown(): Promise<void> {
    this._initialized = false;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Final flush
    this.flush();

    if (this.useWorker && this.worker) {
      await this.shutdownWorker();
    } else {
      await this.fallbackShutdown();
    }
  }

  ngOnDestroy(): void {
    this.shutdown();
  }

  // ── Worker message handling ────────────────────────────

  private onWorkerMessage(msg: WorkerToMainMessage): void {
    switch (msg.type) {
      case 'status':
        this.connected = msg.connected;
        break;
      case 'stats':
        this.publishedCount = msg.publishedCount;
        this.droppedCount = msg.droppedCount;
        break;
      case 'error':
        // eslint-disable-next-line no-console
        console.warn(`[RemoteLogger] Worker error: ${msg.error}`);
        break;
      case 'shutdown-complete':
        // Handled by the shutdown promise
        break;
    }
  }

  private shutdownWorker(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.worker) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        // eslint-disable-next-line no-console
        console.warn('[RemoteLogger] Worker shutdown timed out, terminating');
        this.worker?.terminate();
        this.worker = null;
        this.useWorker = false;
        this.connected = false;
        resolve();
      }, 2000);

      const originalHandler = this.worker.onmessage;
      this.worker.onmessage = (event: MessageEvent<WorkerToMainMessage>) => {
        const msg = event.data;
        if (msg.type === 'shutdown-complete') {
          clearTimeout(timeout);
          this.worker?.terminate();
          this.worker = null;
          this.useWorker = false;
          this.connected = false;
          resolve();
        } else if (originalHandler) {
          originalHandler.call(this.worker!, event);
        }
      };

      const shutdownMsg: MainToWorkerMessage = { type: 'shutdown' };
      this.worker.postMessage(shutdownMsg);
    });
  }

  // ── Fallback: direct NATS on main thread ───────────────

  private fallbackConnect(): void {
    this.connectInBackground();
  }

  private fallbackFlush(): void {
    if (!this.connection || !this.connected) {
      this.connectInBackground();
      return; // entries stay buffered until connection succeeds
    }

    const entries = this.buffer.splice(0);
    const topic = this.config!.topic;

    try {
      for (const entry of entries) {
        const payload = this.encoder.encode(JSON.stringify(entry));
        this.connection.publish(topic, payload);
        this.publishedCount++;
      }
    } catch {
      // Publishing failed — connection likely dropped
      this.droppedCount += entries.length;
      this.connected = false;
      // eslint-disable-next-line no-console
      console.warn(`[RemoteLogger] Publish failed, dropped ${entries.length} entries (total dropped: ${this.droppedCount})`);
    }
  }

  private async fallbackShutdown(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.drain();
      } catch {
        // ignore
      }
      this.connection = null;
      this.connected = false;
    }
  }

  private async connectInBackground(): Promise<void> {
    if (this.connecting || !this.config || this.connected) return;
    this.connecting = true;

    try {
      const opts: ConnectionOptions = {
        servers: [this.config.natsUrl],
        name: this.config.clientName
          ? `${this.config.clientName}-logger`
          : `logger-${Date.now()}`,
        reconnect: true,
        maxReconnectAttempts: -1,   // infinite reconnect
        reconnectTimeWait: 3000,
      };

      if (this.config.token) {
        opts.token = this.config.token;
      } else if (this.config.user && this.config.password) {
        opts.user = this.config.user;
        opts.pass = this.config.password;
      }

      // eslint-disable-next-line no-console
      console.info(`[RemoteLogger] Connecting to NATS at ${this.config.natsUrl}...`);
      this.connection = await wsconnect(opts);
      this.connected = true;

      // eslint-disable-next-line no-console
      console.info(
        `[RemoteLogger] Connected to NATS at ${this.config.natsUrl}, publishing to "${this.config.topic}" ` +
        `(${this.buffer.length} entries buffered)`,
      );

      // Monitor connection status
      this.monitorConnection();

      // Flush any entries that were buffered while connecting
      if (this.buffer.length > 0) {
        this.flush();
      }
    } catch (err) {
      this.connected = false;
      // eslint-disable-next-line no-console
      console.warn(
        `[RemoteLogger] Failed to connect to NATS at ${this.config.natsUrl} — ` +
        `will retry on next flush (${this.buffer.length} entries buffered). Error: ${err}`,
      );
    } finally {
      this.connecting = false;
    }
  }

  private async monitorConnection(): Promise<void> {
    if (!this.connection) return;

    // Monitor status events
    (async () => {
      try {
        if (!this.connection) return;
        for await (const status of this.connection.status()) {
          switch (status.type) {
            case 'disconnect':
              this.connected = false;
              // eslint-disable-next-line no-console
              console.warn('[RemoteLogger] NATS disconnected');
              break;
            case 'reconnect':
              this.connected = true;
              // eslint-disable-next-line no-console
              console.info('[RemoteLogger] NATS reconnected');
              // Flush buffered entries
              if (this.buffer.length > 0) {
                this.flush();
              }
              break;
            case 'reconnecting':
              // eslint-disable-next-line no-console
              console.debug('[RemoteLogger] NATS reconnecting...');
              break;
          }
        }
      } catch {
        // ignore — connection is closing
      }
    })();

    // Monitor closed promise
    this.connection.closed().then((err) => {
      this.connected = false;
      if (err) {
        // eslint-disable-next-line no-console
        console.warn(`[RemoteLogger] NATS connection closed with error: ${err.message}`);
      }
    });
  }

  /**
   * Attempt to create a Web Worker for NATS publishing.
   * Returns null if Worker is unavailable or creation fails.
   * Protected to allow test overrides.
   */
  protected createWorker(): Worker | null {
    if (typeof Worker === 'undefined') return null;
    try {
      return new Worker(
        new URL('./remote-logger.worker', import.meta.url),
        { type: 'module' },
      );
    } catch {
      return null;
    }
  }

  // ── Shared helpers ─────────────────────────────────────

  private extractData(logObj: Record<string, unknown>): Record<string, unknown> {
    const data: Record<string, unknown> = { ...logObj };
    for (const k of ['level', 'time', 'msg', 'component', 'service', 'module']) {
      delete data[k];
    }
    return data;
  }

  private static levelName(level: number): string {
    if (level >= 60) return 'fatal';
    if (level >= 50) return 'error';
    if (level >= 40) return 'warn';
    if (level >= 30) return 'info';
    if (level >= 20) return 'debug';
    return 'trace';
  }
}
