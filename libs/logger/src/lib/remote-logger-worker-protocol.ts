/**
 * Shared types for communication between the main thread
 * (RemoteLoggerService) and the remote-logger Web Worker.
 */

// ── Shared data types ────────────────────────────────────

/** A single buffered log entry ready to be published. */
export interface LogEntry {
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

/** Serializable subset of RemoteLoggerConfig sent to the worker. */
export interface WorkerNatsConfig {
  natsUrl: string;
  topic: string;
  clientName?: string;
  token?: string;
  user?: string;
  password?: string;
}

// ── Main thread → Worker messages ────────────────────────

export interface InitMessage {
  type: 'init';
  config: WorkerNatsConfig;
}

export interface FlushMessage {
  type: 'flush';
  /** JSON-encoded LogEntry[] as an ArrayBuffer (transferred, not cloned). */
  buffer: ArrayBuffer;
}

export interface ShutdownMessage {
  type: 'shutdown';
}

export type MainToWorkerMessage = InitMessage | FlushMessage | ShutdownMessage;

// ── Worker → Main thread messages ────────────────────────

export interface StatusMessage {
  type: 'status';
  connected: boolean;
  status: 'connected' | 'disconnected' | 'reconnecting';
}

export interface StatsMessage {
  type: 'stats';
  publishedCount: number;
  droppedCount: number;
}

export interface ErrorMessage {
  type: 'error';
  error: string;
}

export interface ShutdownCompleteMessage {
  type: 'shutdown-complete';
}

export type WorkerToMainMessage =
  | StatusMessage
  | StatsMessage
  | ErrorMessage
  | ShutdownCompleteMessage;
