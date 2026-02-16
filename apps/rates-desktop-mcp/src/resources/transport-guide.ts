import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerTransportGuideResource(server: McpServer): void {
  server.resource(
    'transports',
    'rates://transports',
    {
      description: 'AMPS, Solace, and NATS transport layer documentation',
      mimeType: 'text/markdown',
    },
    async () => {
      const content = `# Transport Layer Guide

## Overview

The Rates E-Trading Desktop uses an abstract transport layer (\`ITransportService\`) that supports
three messaging backends: **AMPS** (primary), **Solace**, and **NATS**. The transport is selected
at startup via configuration and injected via the \`TRANSPORT_SERVICE\` token.

## Architecture

\`\`\`
ITransportService (interface)
├── BaseTransportService (abstract base)
├── AmpsTransportService   ← Primary, production use
├── SolaceTransportService ← Alternative enterprise messaging
└── NatsTransportService   ← Cloud-native alternative
\`\`\`

All implementations live in \`libs/transports/src/\`.

## AMPS (Advanced Message Processing System)

### Key Features
- **SOW (State of the World)**: Query for current state of all records on a topic, then receive live updates
- **sowAndSubscribe**: Combines SOW query + subscription in one call — delivers full snapshot first, then streams
- **Delta Publish/Subscribe**: Only send/receive changed fields, reducing bandwidth
- **Content Filtering**: Server-side filtering of messages using AMPS expression language
- **Bookmark**: Resume subscriptions from a point in time for guaranteed delivery
- **High Throughput**: Designed for millions of messages/second

### Usage Pattern
\`\`\`typescript
// Preferred: sowAndSubscribe for full state + live updates
const sub = await transport.sowAndSubscribe<MarketData>(
  'rates/marketData',
  (message) => handleUpdate(message.data),
);

// Fallback: subscribe only (no initial state)
const sub = await transport.subscribe<MarketData>(
  'rates/marketData',
  (message) => handleUpdate(message.data),
);

// Query only (no subscription)
const messages = await transport.sowQuery<MarketData>('rates/marketData');

// Publish
await transport.publish('rates/orders', orderData);

// Cleanup
await sub.unsubscribe();
\`\`\`

### Configuration
\`\`\`json
{
  "transport": {
    "type": "amps",
    "url": "ws://amps-server:9007/amps/json",
    "messageType": "json",
    "heartbeatInterval": 5000,
    "reconnect": { "maxRetries": -1, "delayMs": 1000, "maxDelayMs": 30000 }
  },
  "ampsTopics": {
    "marketData": "rates/marketData",
    "executions": "rates/executions"
  }
}
\`\`\`

## Solace PubSub+

### Key Features
- **Guaranteed Messaging**: Queue-based delivery with acknowledgements
- **Topic Hierarchy**: Wildcard subscriptions (e.g., \`rates/>\`, \`rates/*/orders\`)
- **Multiple Protocols**: AMQP, MQTT, JMS, REST
- **Direct + Persistent**: Choose between fast direct or guaranteed persistent delivery

### When to Use
- When AMPS is not available or not suitable
- For cross-datacenter messaging
- When guaranteed delivery is more important than throughput

## NATS

### Key Features
- **Cloud Native**: Lightweight, easy to deploy
- **JetStream**: Persistence layer for guaranteed delivery
- **Request/Reply**: Built-in request-reply pattern
- **Subject Hierarchy**: Wildcard subscriptions

### When to Use
- Development and testing (easy local setup: \`nats-server\`)
- Cloud-native deployments
- When simplicity is prioritized over AMPS-specific features (SOW, delta publish)

## Transport Token & Factory

The transport is provided via Angular dependency injection:

\`\`\`typescript
// Token definition (libs/transports/src/lib/transport.tokens.ts)
export const TRANSPORT_SERVICE = new InjectionToken<ITransportService>('TRANSPORT_SERVICE');

// Factory (libs/transports/src/lib/transport.factory.ts)
// Reads config.transport.type and returns the appropriate implementation

// Usage in services
private transport = inject(TRANSPORT_SERVICE);
\`\`\`

## Connection Management

All transports implement:
- \`connectionStatus$\`: Observable<ConnectionStatus> — Disconnected | Connecting | Connected | Reconnecting | Error
- \`connectionEvents$\`: Observable<ConnectionEvent> — detailed connection lifecycle events
- Automatic reconnection with exponential backoff
- \`connect()\` / \`disconnect()\` lifecycle methods
- \`isConnected()\` for synchronous status check

## Common Debugging

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| No data in grid | Transport not connected | Check status bar, verify AMPS server is running |
| Stale data | SOW working but subscription failed | Check AMPS logs, verify topic name in config |
| Grid not updating | NgZone issue | Ensure \`ngZone.run()\` wraps the message handler |
| Partial updates | Delta subscribe without SOW | Use \`sowAndSubscribe\` instead of \`subscribe\` |
| Memory leak | Subscription not cleaned up | Call \`sub.unsubscribe()\` in \`ngOnDestroy()\` |
`;

      return { contents: [{ uri: 'rates://transports', text: content, mimeType: 'text/markdown' }] };
    },
  );
}
