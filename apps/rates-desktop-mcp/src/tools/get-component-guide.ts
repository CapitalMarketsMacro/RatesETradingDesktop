import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { COMPONENTS, COMPONENT_NAMES } from '../knowledge';

export function registerGetComponentGuide(server: McpServer): void {
  server.tool(
    'get_component_guide',
    'Get detailed information about a specific trading component including route, AMPS topic, fields, files, and business purpose.',
    {
      component: z
        .enum(COMPONENT_NAMES as [string, ...string[]])
        .describe('Component name (e.g., "market-data-blotter", "rfq-blotter")'),
    },
    async ({ component }) => {
      const comp = COMPONENTS.find((c) => c.name === component);
      if (!comp) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Component "${component}" not found. Available: ${COMPONENT_NAMES.join(', ')}`,
            },
          ],
        };
      }

      const lines: string[] = [
        `# ${comp.displayName}`,
        '',
        `**Status**: ${comp.status === 'implemented' ? 'Implemented' : 'Planned'}`,
        `**Category**: ${comp.category}`,
        `**Route**: \`${comp.routePath}\``,
        `**State Key**: \`${comp.stateKey}\``,
        `**Menu**: ${comp.menuLocation} (${comp.menuIcon})`,
      ];

      if (comp.ampsTopic) lines.push(`**AMPS Topic**: \`${comp.ampsTopic}\``);

      lines.push('', '## Description', comp.description, '', '## Business Purpose', comp.businessPurpose);

      if (comp.fields?.length) {
        lines.push('', '## Fields', ...comp.fields.map((f) => `- \`${f}\``));
      }

      if (comp.files?.length) {
        lines.push('', '## Source Files', ...comp.files.map((f) => `- \`${f}\``));
      }

      if (comp.status === 'planned') {
        lines.push(
          '',
          '## Implementation Notes',
          'This component is planned but not yet implemented. Use `guide_new_component` or `scaffold_blotter_component` to generate the initial code.',
        );
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );
}
