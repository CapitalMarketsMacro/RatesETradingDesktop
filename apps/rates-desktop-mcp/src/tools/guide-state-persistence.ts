import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerGuideStatePersistence(server: McpServer): void {
  server.tool(
    'guide_state_persistence',
    'Guide for implementing WorkspaceComponent state persistence — save/restore grid state, component state, and layout.',
    {},
    async () => {
      const guide = `# Guide: State Persistence with WorkspaceComponent

## Overview

The Rates Desktop uses a \`WorkspaceComponent\` base class to persist component state
(grid column widths, sort order, filter settings, etc.) across navigation and app restarts.
Each component has a \`stateKey\` for type-level state and an optional \`viewId\` URL parameter
for per-instance state in multi-window OpenFin layouts.

## Architecture

\`\`\`
WorkspaceComponent (abstract base class)
  └── uses WorkspaceStorageService (localStorage wrapper)
      └── stores state as JSON keyed by instanceId

instanceId = URL param "viewId" || stateKey
\`\`\`

**Source files:**
- \`libs/shared-utils/src/lib/workspace-component.ts\`
- \`libs/shared-utils/src/lib/workspace-storage.service.ts\`

## WorkspaceComponent Contract

\`\`\`typescript
export abstract class WorkspaceComponent {
  // Injected automatically
  protected readonly storageService = inject(WorkspaceStorageService);

  // Must be set by subclass — identifies the component TYPE
  abstract readonly stateKey: string;

  // Unique instance ID (from URL ?viewId= or falls back to stateKey)
  get instanceId(): string;

  // Subclass must implement
  abstract getState(): Record<string, unknown>;
  abstract setState(state: Record<string, unknown>): void;

  // Call these from your component
  persistState(): void;       // Saves current state to storage
  loadPersistedState(): boolean;  // Restores state from storage (returns true if found)
}
\`\`\`

## Implementation Pattern

### 1. Extend WorkspaceComponent

\`\`\`typescript
@Component({ ... })
export class MyBlotterComponent extends WorkspaceComponent implements OnInit, OnDestroy {
  readonly stateKey = 'my-category/my-blotter';

  @ViewChild('dataGrid') dataGrid!: DataGrid<MyGridRow>;
  private pendingGridState: Record<string, unknown> | null = null;
\`\`\`

### 2. Implement getState() and setState()

\`\`\`typescript
  getState(): Record<string, unknown> {
    if (!this.dataGrid) return {};
    return this.dataGrid.getGridState() ?? {};
  }

  setState(state: Record<string, unknown>): void {
    if (this.dataGrid?.getGridApi()) {
      this.dataGrid.applyGridState(state);
    } else {
      // Grid not ready yet — defer until gridInitialized
      this.pendingGridState = state;
    }
  }
\`\`\`

### 3. Load state on init

\`\`\`typescript
  ngOnInit(): void {
    this.loadPersistedState();  // Calls setState() if state exists
    // ... other init
  }
\`\`\`

### 4. Handle deferred grid state

\`\`\`typescript
  onDataGridReady(): void {
    if (this.pendingGridState) {
      this.dataGrid.applyGridState(this.pendingGridState);
      this.pendingGridState = null;
    }
  }
\`\`\`

### 5. Persist on state change

\`\`\`typescript
  onGridStateChanged(): void {
    this.persistState();  // Calls getState() and saves to storage
  }
\`\`\`

### 6. Wire up in template

\`\`\`html
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
\`\`\`

## State Key Conventions

| Component | stateKey |
|-----------|----------|
| Market Data Blotter | \`market-data/blotter\` |
| Top of the Book | \`market-data/top-of-book\` |
| Executions Blotter | \`executions\` |
| RFQ Blotter (planned) | \`trading/rfq\` |
| Order Blotter (planned) | \`trading/orders\` |

**Convention**: Use forward-slash-separated path matching the route path.

## Multi-Instance Support (OpenFin)

In OpenFin Platform mode, multiple instances of the same component can exist.
Each gets a unique \`viewId\` URL parameter:

\`\`\`
/market-data/blotter?viewId=market-data-blotter-1
/market-data/blotter?viewId=market-data-blotter-2
\`\`\`

The \`instanceId\` getter automatically uses the \`viewId\` param when present,
so each instance persists its own state independently.

## What Gets Persisted

For DataGrid components, \`getGridState()\` returns:
- Column widths and order
- Sort state (column + direction)
- Filter state (column filters)
- Column visibility
- Column pinning (left/right)

## WorkspaceStorageService

The storage service is a simple localStorage wrapper:

\`\`\`typescript
@Injectable({ providedIn: 'root' })
export class WorkspaceStorageService {
  saveState(key: string, state: Record<string, unknown>): void;
  loadState(key: string): Record<string, unknown> | null;
  clearState(key: string): void;
  clearAllState(): void;
}
\`\`\`

Storage key format: \`rates-workspace-state:{instanceId}\`
`;

      return { content: [{ type: 'text' as const, text: guide }] };
    },
  );
}
