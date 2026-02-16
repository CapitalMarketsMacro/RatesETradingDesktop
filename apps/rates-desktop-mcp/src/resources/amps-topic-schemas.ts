import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TOPIC_SCHEMAS } from '../knowledge';

export function registerAmpsTopicSchemasResource(server: McpServer): void {
  server.resource(
    'topics',
    'rates://topics',
    {
      description: 'All 9 AMPS topic schemas with JSON schemas, sample messages, and GridRow interfaces',
      mimeType: 'text/markdown',
    },
    async () => {
      const sections: string[] = ['# AMPS Topic Schemas', ''];

      const active = TOPIC_SCHEMAS.filter((t) => t.status === 'active');
      const planned = TOPIC_SCHEMAS.filter((t) => t.status === 'planned');

      sections.push(`## Active Topics (${active.length})`, '');
      for (const t of active) {
        appendTopicSection(sections, t);
      }

      sections.push(`## Planned Topics (${planned.length})`, '');
      for (const t of planned) {
        appendTopicSection(sections, t);
      }

      return { contents: [{ uri: 'rates://topics', text: sections.join('\n'), mimeType: 'text/markdown' }] };
    },
  );
}

function appendTopicSection(sections: string[], t: (typeof TOPIC_SCHEMAS)[number]): void {
  sections.push(`### \`${t.topic}\``);
  sections.push(`${t.description}`);
  sections.push(`- **ID Field**: \`${t.idField}\``);
  sections.push('');
  sections.push('**JSON Schema:**');
  sections.push('```json');
  sections.push(JSON.stringify(t.jsonSchema, null, 2));
  sections.push('```');
  sections.push('');
  sections.push('**Sample Message:**');
  sections.push('```json');
  sections.push(JSON.stringify(t.sampleMessage, null, 2));
  sections.push('```');
  sections.push('');
  sections.push('**GridRow Interface:**');
  sections.push('```typescript');
  sections.push(t.gridRowInterface);
  sections.push('```');
  sections.push('');
}
