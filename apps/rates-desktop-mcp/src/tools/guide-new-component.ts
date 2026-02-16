import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { COMPONENT_CATEGORIES } from '../knowledge';

export function registerGuideNewComponent(server: McpServer): void {
  server.tool(
    'guide_new_component',
    'Step-by-step guide to add a new Angular component as an OpenFin view in the Rates Desktop application.',
    {
      name: z.string().describe('Component name in kebab-case (e.g., "rfq-blotter")'),
      category: z
        .enum(COMPONENT_CATEGORIES as unknown as [string, ...string[]])
        .describe('Component category: market-data, execution, trading, risk, support'),
      hasGrid: z.boolean().describe('Whether this component uses AG Grid (DataGrid)'),
      ampsTopic: z.string().optional().describe('AMPS topic to subscribe to (e.g., "rates/rfq")'),
    },
    async ({ name, category, hasGrid, ampsTopic }) => {
      const className = name
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join('') + 'Component';
      const serviceName = name.replace(/-/g, '-') + '.service';
      const serviceClassName = name
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join('') + 'Service';

      const steps: string[] = [
        `# Guide: Add "${name}" Component`,
        '',
        `This guide walks you through adding a new **${category}** component to the Rates Desktop app.`,
        '',
        '## Step 1: Create the component directory',
        '```',
        `mkdir -p apps/rates-desktop/src/app/d2d/${name}`,
        '```',
        '',
      ];

      // Step 2: Service (if AMPS topic)
      if (ampsTopic) {
        steps.push(
          '## Step 2: Create the AMPS service',
          '',
          `Create \`apps/rates-desktop/src/app/d2d/services/${serviceName}.ts\``,
          '',
          'Follow the pattern from `market-data.service.ts`:',
          '- Inject `TRANSPORT_SERVICE`, `ConfigurationService`, `LoggerService`, `NgZone`',
          '- Use `Map<id, GridRow>` as single source of truth',
          '- Expose `rowUpdate$` (Subject) and `snapshot$` (BehaviorSubject)',
          '- Implement lazy `connect()` method',
          `- Subscribe to topic \`${ampsTopic}\` using \`sowAndSubscribe\` with \`subscribe\` fallback`,
          '- Wrap message handling in `ngZone.run()`',
          '',
          `Export from \`apps/rates-desktop/src/app/d2d/services/index.ts\`:`,
          '```typescript',
          `export * from './${serviceName.replace('.service', '')}.service';`,
          '```',
          '',
        );
      }

      // Step 3: Model (if AMPS topic)
      if (ampsTopic) {
        steps.push(
          '## Step 3: Create the data model',
          '',
          `Create \`apps/rates-desktop/src/app/d2d/models/${name}.ts\``,
          '',
          'Define:',
          `1. Raw message interface (matching AMPS topic schema)`,
          `2. GridRow interface (flattened for AG Grid)`,
          `3. Transform function: \`transformXxxToGridRow()\``,
          '',
          `Export from \`apps/rates-desktop/src/app/d2d/models/index.ts\`:`,
          '```typescript',
          `export * from './${name}';`,
          '```',
          '',
        );
      }

      // Step 4: Component
      const stepNum = ampsTopic ? 4 : 2;
      steps.push(
        `## Step ${stepNum}: Create the component`,
        '',
        `Create these files in \`apps/rates-desktop/src/app/d2d/${name}/\`:`,
        '',
        `### ${name}.component.ts`,
        '- Standalone component',
        hasGrid ? '- Import `CommonModule` and `DataGrid` from `@rates-trading/ui-components`' : '- Import `CommonModule`',
        '- Extend `WorkspaceComponent` from `@rates-trading/shared-utils`',
        `- Set \`stateKey = '${category}/${name.replace(/-/g, '/')}'\``,
        '- Implement `getState()` and `setState()` for persistence',
        '- Call `loadPersistedState()` in `ngOnInit()`',
        ampsTopic ? `- Inject \`${serviceClassName}\` and call \`connect()\` in \`ngOnInit()\`` : '',
        hasGrid ? '- Subscribe to `rowUpdate$` for high-frequency grid updates' : '',
        hasGrid ? '- Handle deferred grid state with `pendingGridState` pattern' : '',
        '',
        `### ${name}.component.html`,
        hasGrid
          ? `\`\`\`html
<div class="${name}-container" style="height: 100%; width: 100%;">
  <lib-data-grid
    #dataGrid
    [columns]="columns"
    [rowData]="[]"
    rowIdField="Id"
    [highFrequencyMode]="true"
    height="100%"
    (gridInitialized)="onDataGridReady()"
    (stateChanged)="onGridStateChanged()"
  ></lib-data-grid>
</div>
\`\`\``
          : '<!-- Add your template here -->',
        '',
        `### ${name}.component.css`,
        '```css',
        ':host { display: block; height: 100%; width: 100%; }',
        '```',
        '',
      );

      // Step 5: Barrel export
      steps.push(
        `## Step ${stepNum + 1}: Export from barrel`,
        '',
        `Add to \`apps/rates-desktop/src/app/d2d/index.ts\`:`,
        '```typescript',
        `export * from './${name}/${name}.component';`,
        '```',
        '',
      );

      // Step 6: Route
      steps.push(
        `## Step ${stepNum + 2}: Register route`,
        '',
        `Add to \`apps/rates-desktop/src/app/app.routes.ts\`:`,
        '```typescript',
        `{ path: '${category}/${name}', title: '${className.replace('Component', '')}', component: ${className} },`,
        '```',
        '',
      );

      // Step 7: Menu
      steps.push(
        `## Step ${stepNum + 3}: Add menu item`,
        '',
        `Add to \`apps/rates-desktop/src/app/app.ts\` in the appropriate menu section:`,
        '```typescript',
        '{',
        `  label: '${className.replace('Component', '').replace(/([A-Z])/g, ' $1').trim()}',`,
        `  icon: 'pi pi-table',`,
        `  command: () => this.addViewFromMenu('${name}', '/${category}/${name}'),`,
        '},',
        '```',
        '',
      );

      // Step 8: Test
      steps.push(
        `## Step ${stepNum + 4}: Verify`,
        '',
        '1. `nx serve rates-desktop`',
        '2. Open http://localhost:4200',
        `3. Navigate to \`/${category}/${name}\` or use the menu`,
        '4. Verify the component renders correctly',
        hasGrid ? '5. Verify grid loads data (requires AMPS connection)' : '',
        '6. Verify state persistence (resize columns, navigate away and back)',
      );

      return { content: [{ type: 'text' as const, text: steps.filter(Boolean).join('\n') }] };
    },
  );
}
