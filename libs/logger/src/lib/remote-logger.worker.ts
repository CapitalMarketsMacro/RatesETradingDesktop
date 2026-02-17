/// <reference lib="webworker" />

import { wsconnect, NatsConnection, ConnectionOptions } from '@nats-io/nats-core';
import {
  MainToWorkerMessage,
  WorkerToMainMessage,
  WorkerNatsConfig,
  LogEntry,
} from './remote-logger-worker-protocol';

let connection: NatsConnection | null = null;
let config: WorkerNatsConfig | null = null;
const encoder = new TextEncoder();
let publishedCount = 0;
let droppedCount = 0;

function post(msg: WorkerToMainMessage): void {
  postMessage(msg);
}

async function handleInit(cfg: WorkerNatsConfig): Promise<void> {
  config = cfg;

  const opts: ConnectionOptions = {
    servers: [cfg.natsUrl],
    name: cfg.clientName
      ? `${cfg.clientName}-logger-worker`
      : `logger-worker-${Date.now()}`,
    reconnect: true,
    maxReconnectAttempts: -1,
    reconnectTimeWait: 3000,
  };

  if (cfg.token) {
    opts.token = cfg.token;
  } else if (cfg.user && cfg.password) {
    opts.user = cfg.user;
    opts.pass = cfg.password;
  }

  try {
    connection = await wsconnect(opts);
    post({ type: 'status', connected: true, status: 'connected' });
    monitorConnection();
  } catch (err) {
    post({
      type: 'error',
      error: `Failed to connect to NATS: ${err}`,
    });
    post({ type: 'status', connected: false, status: 'disconnected' });
  }
}

function handleFlush(entries: LogEntry[]): void {
  if (!connection || !config) {
    droppedCount += entries.length;
    post({ type: 'stats', publishedCount, droppedCount });
    return;
  }

  const topic = config.topic;

  try {
    for (const entry of entries) {
      const payload = encoder.encode(JSON.stringify(entry));
      connection.publish(topic, payload);
      publishedCount++;
    }
  } catch {
    droppedCount += entries.length;
    post({
      type: 'error',
      error: `Publish failed, dropped ${entries.length} entries`,
    });
  }

  post({ type: 'stats', publishedCount, droppedCount });
}

async function handleShutdown(): Promise<void> {
  if (connection) {
    try {
      await connection.drain();
    } catch {
      // ignore drain errors
    }
    connection = null;
  }
  post({ type: 'shutdown-complete' });
}

function monitorConnection(): void {
  if (!connection) return;

  (async () => {
    try {
      if (!connection) return;
      for await (const status of connection.status()) {
        switch (status.type) {
          case 'disconnect':
            post({ type: 'status', connected: false, status: 'disconnected' });
            break;
          case 'reconnect':
            post({ type: 'status', connected: true, status: 'connected' });
            break;
          case 'reconnecting':
            post({ type: 'status', connected: false, status: 'reconnecting' });
            break;
        }
      }
    } catch {
      // connection closing
    }
  })();

  connection.closed().then((err) => {
    post({
      type: 'status',
      connected: false,
      status: 'disconnected',
    });
    if (err) {
      post({ type: 'error', error: `Connection closed: ${err.message}` });
    }
  });
}

addEventListener('message', (event: MessageEvent<MainToWorkerMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'init':
      handleInit(msg.config);
      break;
    case 'flush':
      handleFlush(msg.entries);
      break;
    case 'shutdown':
      handleShutdown();
      break;
  }
});
