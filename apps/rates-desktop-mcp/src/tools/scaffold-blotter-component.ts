import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CODE_PATTERNS } from '../knowledge';

export function registerScaffoldBlotterComponent(server: McpServer): void {
  server.tool(
    'scaffold_blotter_component',
    'Generate complete blotter code: service + model + component + route + menu item. Follows exact existing patterns.',
    {
      name: z.string().describe('Component name in kebab-case (e.g., "rfq-blotter")'),
      ampsTopic: z.string().describe('AMPS topic (e.g., "rates/rfq")'),
      idField: z.string().describe('Unique ID field name (e.g., "RfqId")'),
      fields: z.array(z.string()).describe('All field names for the grid row'),
      routePath: z.string().describe('Route path (e.g., "/trading/rfq")'),
      menuLabel: z.string().describe('Label for the menu item (e.g., "RFQ Blotter")'),
      menuIcon: z.string().describe('PrimeNG icon class (e.g., "pi pi-comments")'),
    },
    async ({ name, ampsTopic, idField, fields, routePath, menuLabel, menuIcon }) => {
      const pascalName = name
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join('');
      const className = pascalName + 'Component';
      const serviceClassName = pascalName.replace(/Blotter$/, '').replace(/Component$/, '') + 'Service';
      const serviceName = name.replace(/-blotter$/, '');
      const modelName = pascalName.replace(/Blotter$/, '').replace(/Component$/, '');
      const gridRowName = modelName + 'GridRow';

      // Generate service code
      const serviceCode = CODE_PATTERNS.serviceTemplate({
        name: serviceName,
        className: serviceClassName,
        ampsTopic,
        idField,
        fields,
        modelName,
        gridRowName,
      });

      // Generate component code
      const componentCode = CODE_PATTERNS.componentTemplate({
        name,
        className,
        serviceName,
        serviceClassName,
        gridRowName,
        stateKey: routePath.replace(/^\//, ''),
        fields,
        idField,
      });

      const htmlCode = CODE_PATTERNS.componentHtmlTemplate({ name, gridRowName });
      const cssCode = CODE_PATTERNS.componentCssTemplate();
      const routeCode = CODE_PATTERNS.routeTemplate({
        routePath,
        title: menuLabel,
        className,
        importPath: `./d2d/${name}/${name}.component`,
      });
      const menuCode = CODE_PATTERNS.menuItemTemplate({
        label: menuLabel,
        icon: menuIcon,
        routePath,
        viewBaseName: name,
      });

      const output = `# Generated Blotter: ${menuLabel}

## Files to create

### 1. Service: \`apps/rates-desktop/src/app/d2d/services/${serviceName}.service.ts\`

\`\`\`typescript
${serviceCode}
\`\`\`

### 2. Component: \`apps/rates-desktop/src/app/d2d/${name}/${name}.component.ts\`

\`\`\`typescript
${componentCode}
\`\`\`

### 3. Template: \`apps/rates-desktop/src/app/d2d/${name}/${name}.component.html\`

\`\`\`html
${htmlCode}
\`\`\`

### 4. Styles: \`apps/rates-desktop/src/app/d2d/${name}/${name}.component.css\`

\`\`\`css
${cssCode}
\`\`\`

## Registration changes

### 5. Add to route table (\`apps/rates-desktop/src/app/app.routes.ts\`)

\`\`\`typescript
${routeCode}
\`\`\`

### 6. Add menu item (\`apps/rates-desktop/src/app/app.ts\`)

\`\`\`typescript
${menuCode}
\`\`\`

### 7. Update barrel exports

**\`apps/rates-desktop/src/app/d2d/services/index.ts\`** — add:
\`\`\`typescript
export * from './${serviceName}.service';
\`\`\`

**\`apps/rates-desktop/src/app/d2d/index.ts\`** — add:
\`\`\`typescript
export * from './${name}/${name}.component';
\`\`\`

### 8. Import in route file

Add to imports in \`app.routes.ts\`:
\`\`\`typescript
import { ${className} } from './d2d';
\`\`\`
`;

      return { content: [{ type: 'text' as const, text: output }] };
    },
  );
}
