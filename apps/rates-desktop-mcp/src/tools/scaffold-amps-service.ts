import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CODE_PATTERNS } from '../knowledge';

export function registerScaffoldAmpsService(server: McpServer): void {
  server.tool(
    'scaffold_amps_service',
    'Generate an AMPS service + model following the established pattern. Produces ready-to-use TypeScript code.',
    {
      name: z.string().describe('Service name in kebab-case (e.g., "rfq", "order", "position")'),
      ampsTopic: z.string().describe('AMPS topic (e.g., "rates/rfq")'),
      idField: z.string().describe('Unique ID field (e.g., "RfqId")'),
      fields: z.array(z.string()).describe('All field names in the message'),
    },
    async ({ name, ampsTopic, idField, fields }) => {
      const pascalName = name
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join('');
      const serviceClassName = pascalName + 'Service';
      const modelName = pascalName;
      const gridRowName = pascalName + 'GridRow';

      const serviceCode = CODE_PATTERNS.serviceTemplate({
        name,
        className: serviceClassName,
        ampsTopic,
        idField,
        fields,
        modelName,
        gridRowName,
      });

      const output = `# Generated AMPS Service: ${serviceClassName}

## File: \`apps/rates-desktop/src/app/d2d/services/${name}.service.ts\`

\`\`\`typescript
${serviceCode}
\`\`\`

## Registration

Add to \`apps/rates-desktop/src/app/d2d/services/index.ts\`:
\`\`\`typescript
export * from './${name}.service';
\`\`\`

## Usage in a component

\`\`\`typescript
import { ${serviceClassName} } from '../services/${name}.service';
import { ${gridRowName} } from '../services/${name}.service';

// In component class:
private service = inject(${serviceClassName});

ngOnInit(): void {
  this.service.connect();

  // For grid components (high-frequency updates):
  this.service.rowUpdate$.subscribe((row) => {
    this.dataGrid.updateRow(row);
  });

  // For non-grid components (full snapshot):
  this.service.snapshot$.subscribe((rows) => {
    this.items = rows;
  });
}
\`\`\`
`;

      return { content: [{ type: 'text' as const, text: output }] };
    },
  );
}
