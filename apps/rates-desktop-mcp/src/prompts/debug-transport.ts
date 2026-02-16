import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerDebugTransportPrompt(server: McpServer): void {
  server.prompt(
    'debug_transport',
    'Guided debugging for AMPS/Solace/NATS transport connection issues.',
    {
      symptom: z
        .string()
        .optional()
        .describe('Description of the issue (e.g., "no data in grid", "connection drops")'),
    },
    async ({ symptom }) => {
      const messages: Array<{ role: 'user' | 'assistant'; content: { type: 'text'; text: string } }> = [];

      messages.push({
        role: 'user',
        content: {
          type: 'text',
          text: `I'm having issues with the transport/messaging layer in the Rates E-Trading Desktop.${symptom ? ` Symptom: ${symptom}` : ''}

Please help me debug this. Here's context about the transport architecture:

**Transport Layer** (libs/transports/):
- Abstract ITransportService interface with AMPS, Solace, and NATS implementations
- TRANSPORT_SERVICE injection token selects the implementation at startup
- Configuration in assets/config.json under "transport" key
- AMPS is the primary transport (sowAndSubscribe, delta publish, SOW)

**Common Issues & Solutions:**

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| No data in grid | Transport not connected | Check status bar, verify server is running, check config URL |
| Stale data | SOW works but subscription failed | Check server logs, verify topic name |
| Grid not updating | NgZone issue | Ensure ngZone.run() wraps message handler |
| Partial updates | Delta subscribe without SOW | Use sowAndSubscribe instead of subscribe |
| Memory leak | Subscription not cleaned up | Call sub.unsubscribe() in ngOnDestroy() |
| Connection drops | Network/firewall | Check heartbeatInterval, reconnect settings |
| Wrong data | Topic mismatch | Verify topic name in config vs actual topic |

**Debugging Steps:**
1. Check the Status Bar component for connection status
2. Look at browser console for transport errors (Pino logger output)
3. Verify the config.json transport settings
4. Check if the AMPS/Solace/NATS server is reachable
5. Test with a simple subscribe before sowAndSubscribe
6. Enable debug logging in the transport service

Use the get_project_architecture and get_amps_topic_schema tools to understand the current setup.`,
        },
      });

      return { messages };
    },
  );
}
