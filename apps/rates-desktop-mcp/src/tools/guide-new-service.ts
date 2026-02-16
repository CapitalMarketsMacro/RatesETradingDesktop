import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerGuideNewService(server: McpServer): void {
  server.tool(
    'guide_new_service',
    'Step-by-step guide to create an AMPS subscription service following the established pattern.',
    {
      name: z.string().describe('Service name in kebab-case (e.g., "rfq", "order")'),
      ampsTopic: z.string().describe('AMPS topic to subscribe to (e.g., "rates/rfq")'),
      idField: z.string().describe('Unique ID field name in the message (e.g., "RfqId")'),
      fields: z.array(z.string()).describe('List of field names in the message'),
    },
    async ({ name, ampsTopic, idField, fields }) => {
      const serviceClassName =
        name
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join('') + 'Service';
      const modelName =
        name
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join('');
      const gridRowName = modelName + 'GridRow';

      const guide = `# Guide: Create ${serviceClassName}

## Overview

Create a new Angular service that subscribes to \`${ampsTopic}\` via AMPS and provides
reactive data streams for components.

**Pattern reference**: \`apps/rates-desktop/src/app/d2d/services/market-data.service.ts\`

## Step 1: Create the model file

Create \`apps/rates-desktop/src/app/d2d/models/${name}.ts\`:

\`\`\`typescript
/**
 * Raw message from AMPS topic: ${ampsTopic}
 */
export interface ${modelName} {
${fields.map((f) => `  ${f}: ${f === idField ? 'string' : 'any'};`).join('\n')}
}

/**
 * Flattened grid row for AG Grid display
 */
export interface ${gridRowName} {
${fields.map((f) => `  ${f}: ${f === idField ? 'string' : 'any'};`).join('\n')}
}

/**
 * Transform raw message to grid row format
 */
export function transform${modelName}ToGridRow(data: ${modelName}): ${gridRowName} {
  return {
${fields.map((f) => `    ${f}: data.${f},`).join('\n')}
  };
}
\`\`\`

Export from \`apps/rates-desktop/src/app/d2d/models/index.ts\`:
\`\`\`typescript
export * from './${name}';
\`\`\`

## Step 2: Create the service file

Create \`apps/rates-desktop/src/app/d2d/services/${name}.service.ts\`:

\`\`\`typescript
import { Injectable, OnDestroy, NgZone, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription, filter, take } from 'rxjs';
import { TRANSPORT_SERVICE, ConnectionStatus } from '@rates-trading/transports';
import { ConfigurationService } from '@rates-trading/configuration';
import { LoggerService } from '@rates-trading/logger';
import { ${modelName}, ${gridRowName}, transform${modelName}ToGridRow } from '../models/${name}';

@Injectable({ providedIn: 'root' })
export class ${serviceClassName} implements OnDestroy {
  private transport = inject(TRANSPORT_SERVICE);
  private configService = inject(ConfigurationService);
  private logger = inject(LoggerService).child({ component: '${serviceClassName}' });
  private ngZone = inject(NgZone);

  private dataMap = new Map<string, ${gridRowName}>();

  private rowUpdateSubject = new Subject<${gridRowName}>();
  readonly rowUpdate$: Observable<${gridRowName}> = this.rowUpdateSubject.asObservable();

  private snapshotSubject = new BehaviorSubject<${gridRowName}[]>([]);
  readonly snapshot$: Observable<${gridRowName}[]> = this.snapshotSubject.asObservable();

  private subscribed = false;
  private connectionSub?: Subscription;
  private dataSub?: { unsubscribe(): Promise<void> };

  connect(): void {
    if (this.subscribed) return;
    this.subscribed = true;

    if (this.transport.isConnected()) {
      this.subscribeToData();
    } else {
      this.connectionSub = this.transport.connectionStatus$
        .pipe(filter((s) => s === ConnectionStatus.Connected), take(1))
        .subscribe(() => this.subscribeToData());
    }
  }

  getRow(id: string): ${gridRowName} | undefined {
    return this.dataMap.get(id);
  }

  getSnapshot(): ${gridRowName}[] {
    return Array.from(this.dataMap.values());
  }

  private async subscribeToData(): Promise<void> {
    const topic = '${ampsTopic}';

    try {
      if (this.transport.sowAndSubscribe) {
        this.dataSub = await this.transport.sowAndSubscribe<${modelName}>(
          topic,
          (message) => this.handleMessage(message.data),
        );
      } else {
        this.dataSub = await this.transport.subscribe<${modelName}>(
          topic,
          (message) => this.handleMessage(message.data),
        );
      }
      this.logger.info('Subscribed to ' + topic);
    } catch (error) {
      this.logger.error(error as Error, \\\`Failed to subscribe to \\\${topic}\\\`);
    }
  }

  private handleMessage(data: ${modelName}): void {
    if (!data?.${idField}) return;

    const gridRow = transform${modelName}ToGridRow(data);

    this.ngZone.run(() => {
      this.dataMap.set(data.${idField}, gridRow);
      this.rowUpdateSubject.next(gridRow);
      this.snapshotSubject.next(Array.from(this.dataMap.values()));
    });
  }

  ngOnDestroy(): void {
    this.connectionSub?.unsubscribe();
    this.dataSub?.unsubscribe();
    this.rowUpdateSubject.complete();
    this.snapshotSubject.complete();
  }
}
\`\`\`

Export from \`apps/rates-desktop/src/app/d2d/services/index.ts\`:
\`\`\`typescript
export * from './${name}.service';
\`\`\`

## Step 3: Key patterns to follow

1. **Single source of truth**: \`Map<${idField}, ${gridRowName}>\`
2. **Lazy subscription**: \`connect()\` is safe to call multiple times
3. **SOW + Subscribe**: Prefer \`sowAndSubscribe\` for complete initial state
4. **NgZone**: Always wrap message handling in \`ngZone.run()\` for change detection
5. **Cleanup**: Unsubscribe in \`ngOnDestroy()\`
6. **Dual observables**: \`rowUpdate$\` for individual updates, \`snapshot$\` for full arrays

## Step 4: Verify

1. Inject the service in a component
2. Call \`service.connect()\` in \`ngOnInit()\`
3. Subscribe to \`service.rowUpdate$\` or \`service.snapshot$\`
4. Verify data flows when AMPS is connected
`;

      return { content: [{ type: 'text' as const, text: guide }] };
    },
  );
}
