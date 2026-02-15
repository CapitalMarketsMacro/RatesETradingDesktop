import { Injectable, OnDestroy } from '@angular/core';
import { wsconnect, NatsConnection, ConnectionOptions } from '@nats-io/nats-core';

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
 * A single buffered log entry ready to be published.
 */
interface LogEntry {
  /** ISO-8601 timestamp */
  ts: string;
  /** Numeric Pino log level */
  level: number;
  /** Human-readable level tag */
  levelName: string;
  /** Log message */
  msg: string;
  /** Logger name / component */
  logger: string;
  /** Extra structured data */
  data: Record<string, unknown>;
  /** Application metadata (app name, version, env, hostname, etc.) */
  meta: Record<string, unknown>;
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
  private connection: NatsConnection | null = null;
  private config: RemoteLoggerConfig | null = null;
  private buffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private encoder = new TextEncoder();
  private connecting = false;
  private _initialized = false;
  private connected = false;
  private publishedCount = 0;
  private droppedCount = 0;

  /** Whether the service has been initialized and is ready to accept logs. */
  get initialized(): boolean {
    return this._initialized;
  }

  /** Whether the NATS connection is currently active. */
  get isConnected(): boolean {
    return this.connected;
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

    // Connect in the background — don't block app startup
    this.connectInBackground();

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
   * If not connected, attempts a reconnect so buffered entries
   * aren't stuck indefinitely.
   */
  flush(): void {
    if (this.buffer.length === 0 || !this.config) return;

    // If not connected, try to reconnect in background
    if (!this.connection || !this.connected) {
      this.connectInBackground();
      return; // entries stay buffered until connection succeeds
    }

    const entries = this.buffer.splice(0);
    const topic = this.config.topic;

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

  ngOnDestroy(): void {
    this.shutdown();
  }

  // ── Private helpers ──────────────────────────────────────

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

  /**
   * Monitor NATS connection lifecycle events (disconnect, reconnect, close)
   */
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
   * Extract user context data from a Pino log object,
   * stripping standard/internal keys.
   */
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
