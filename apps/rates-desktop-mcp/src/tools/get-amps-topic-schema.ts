import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TOPIC_SCHEMAS, TOPIC_NAMES } from '../knowledge';

export function registerGetAmpsTopicSchema(server: McpServer): void {
  server.tool(
    'get_amps_topic_schema',
    'Get the JSON schema, sample message, and GridRow TypeScript interface for an AMPS topic.',
    {
      topic: z
        .enum(TOPIC_NAMES as [string, ...string[]])
        .describe('AMPS topic name (e.g., "rates/marketData", "rates/executions")'),
    },
    async ({ topic }) => {
      const schema = TOPIC_SCHEMAS.find((t) => t.topic === topic);
      if (!schema) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Topic "${topic}" not found. Available: ${TOPIC_NAMES.join(', ')}`,
            },
          ],
        };
      }

      const text = [
        `# Topic: \`${schema.topic}\``,
        '',
        `**Status**: ${schema.status}`,
        `**ID Field**: \`${schema.idField}\``,
        `**Description**: ${schema.description}`,
        '',
        '## JSON Schema',
        '```json',
        JSON.stringify(schema.jsonSchema, null, 2),
        '```',
        '',
        '## Sample Message',
        '```json',
        JSON.stringify(schema.sampleMessage, null, 2),
        '```',
        '',
        '## GridRow Interface',
        '```typescript',
        schema.gridRowInterface,
        '```',
      ].join('\n');

      return { content: [{ type: 'text' as const, text }] };
    },
  );
}
