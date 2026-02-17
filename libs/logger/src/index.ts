/**
 * Logger Library
 * 
 * High-performance logging library for Angular applications using Pino.
 */

export * from './lib/logger.service';
export * from './lib/logger-module';
export * from './lib/remote-logger.service';
export type {
  LogEntry,
  WorkerNatsConfig,
  MainToWorkerMessage,
  WorkerToMainMessage,
} from './lib/remote-logger-worker-protocol';
