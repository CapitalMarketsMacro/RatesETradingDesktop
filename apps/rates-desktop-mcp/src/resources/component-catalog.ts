import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { COMPONENTS } from '../knowledge';

export function registerComponentCatalogResource(server: McpServer): void {
  server.resource(
    'components',
    'rates://components',
    {
      description: 'All 12 trading components with routes, AMPS topics, fields, and implementation status',
      mimeType: 'text/markdown',
    },
    async () => {
      const sections: string[] = ['# Component Catalog', ''];

      const implemented = COMPONENTS.filter((c) => c.status === 'implemented');
      const planned = COMPONENTS.filter((c) => c.status === 'planned');

      sections.push(`## Implemented (${implemented.length})`, '');
      for (const c of implemented) {
        sections.push(`### ${c.displayName}`);
        sections.push(`- **Route**: \`${c.routePath}\``);
        sections.push(`- **State Key**: \`${c.stateKey}\``);
        sections.push(`- **Category**: ${c.category}`);
        if (c.ampsTopic) sections.push(`- **AMPS Topic**: \`${c.ampsTopic}\``);
        sections.push(`- **Menu**: ${c.menuLocation} (${c.menuIcon})`);
        sections.push(`- **Description**: ${c.description}`);
        sections.push(`- **Business Purpose**: ${c.businessPurpose}`);
        if (c.fields) sections.push(`- **Fields**: ${c.fields.join(', ')}`);
        if (c.files) {
          sections.push('- **Files**:');
          for (const f of c.files) sections.push(`  - \`${f}\``);
        }
        sections.push('');
      }

      sections.push(`## Planned (${planned.length})`, '');
      for (const c of planned) {
        sections.push(`### ${c.displayName}`);
        sections.push(`- **Route**: \`${c.routePath}\``);
        sections.push(`- **State Key**: \`${c.stateKey}\``);
        sections.push(`- **Category**: ${c.category}`);
        if (c.ampsTopic) sections.push(`- **AMPS Topic**: \`${c.ampsTopic}\``);
        sections.push(`- **Menu**: ${c.menuLocation} (${c.menuIcon})`);
        sections.push(`- **Description**: ${c.description}`);
        sections.push(`- **Business Purpose**: ${c.businessPurpose}`);
        if (c.fields) sections.push(`- **Fields**: ${c.fields.join(', ')}`);
        sections.push('');
      }

      return { contents: [{ uri: 'rates://components', text: sections.join('\n'), mimeType: 'text/markdown' }] };
    },
  );
}
