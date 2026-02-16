/**
 * Code patterns and templates for generating new components and services.
 * These match the exact patterns used in the existing codebase.
 */

export const CODE_PATTERNS = {
  /**
   * Service pattern — follows MarketDataService / ExecutionService pattern.
   * Key characteristics:
   * - providedIn: 'root' singleton
   * - Injects TRANSPORT_SERVICE, ConfigurationService, LoggerService, NgZone
   * - Map<id, row> as single source of truth
   * - Exposes rowUpdate$ (Subject) and snapshot$ (BehaviorSubject) observables
   * - Lazy connect() method (safe to call multiple times)
   * - sowAndSubscribe with fallback to subscribe
   * - NgZone.run() for change detection
   */
  serviceTemplate: (params: { name: string; className: string; ampsTopic: string; idField: string; fields: string[]; modelName: string; gridRowName: string }) => `
import { Injectable, OnDestroy, NgZone, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription, filter, take } from 'rxjs';
import { TRANSPORT_SERVICE, ConnectionStatus } from '@rates-trading/transports';
import { ConfigurationService } from '@rates-trading/configuration';
import { LoggerService } from '@rates-trading/logger';

/**
 * Raw message interface from AMPS topic: ${params.ampsTopic}
 */
export interface ${params.modelName} {
  ${params.idField}: string;
${params.fields.filter(f => f !== params.idField).map(f => `  ${f}: any;`).join('\n')}
}

/**
 * Flattened grid row for ag-Grid display
 */
export interface ${params.gridRowName} {
  ${params.idField}: string;
${params.fields.filter(f => f !== params.idField).map(f => `  ${f}: any;`).join('\n')}
}

/**
 * Transform raw message to grid row
 */
export function transform${params.modelName}ToGridRow(data: ${params.modelName}): ${params.gridRowName} {
  return {
${params.fields.map(f => `    ${f}: data.${f},`).join('\n')}
  };
}

@Injectable({ providedIn: 'root' })
export class ${params.className} implements OnDestroy {
  private transport = inject(TRANSPORT_SERVICE);
  private configService = inject(ConfigurationService);
  private logger = inject(LoggerService).child({ component: '${params.className}' });
  private ngZone = inject(NgZone);

  private dataMap = new Map<string, ${params.gridRowName}>();

  private rowUpdateSubject = new Subject<${params.gridRowName}>();
  readonly rowUpdate$: Observable<${params.gridRowName}> = this.rowUpdateSubject.asObservable();

  private snapshotSubject = new BehaviorSubject<${params.gridRowName}[]>([]);
  readonly snapshot$: Observable<${params.gridRowName}[]> = this.snapshotSubject.asObservable();

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
        .pipe(
          filter((s) => s === ConnectionStatus.Connected),
          take(1),
        )
        .subscribe(() => this.subscribeToData());
    }
  }

  getRow(id: string): ${params.gridRowName} | undefined {
    return this.dataMap.get(id);
  }

  getSnapshot(): ${params.gridRowName}[] {
    return Array.from(this.dataMap.values());
  }

  private async subscribeToData(): Promise<void> {
    const topic = '${params.ampsTopic}';

    try {
      if (this.transport.sowAndSubscribe) {
        this.dataSub = await this.transport.sowAndSubscribe<${params.modelName}>(
          topic,
          (message) => this.handleMessage(message.data),
        );
      } else {
        this.dataSub = await this.transport.subscribe<${params.modelName}>(
          topic,
          (message) => this.handleMessage(message.data),
        );
      }
      this.logger.info('Subscribed to ' + topic);
    } catch (error) {
      this.logger.error(error as Error, \`Failed to subscribe to \${topic}\`);
    }
  }

  private handleMessage(data: ${params.modelName}): void {
    if (!data?.${params.idField}) return;

    const gridRow = transform${params.modelName}ToGridRow(data);

    this.ngZone.run(() => {
      this.dataMap.set(data.${params.idField}, gridRow);
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
`.trim(),

  /**
   * Component pattern — follows MarketDataBlotterComponent pattern.
   * Key characteristics:
   * - Standalone component with CommonModule + DataGrid imports
   * - Extends WorkspaceComponent for state persistence
   * - stateKey matching the route path
   * - Deferred grid state via pendingGridState
   * - Subscribes to service.rowUpdate$ for high-frequency updates
   * - Column definitions as ColDef[] array
   */
  componentTemplate: (params: { name: string; className: string; serviceName: string; serviceClassName: string; gridRowName: string; stateKey: string; fields: string[]; idField: string }) => `
import { Component, OnInit, OnDestroy, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ColDef, DataGrid } from '@rates-trading/ui-components';
import { LoggerService } from '@rates-trading/logger';
import { WorkspaceComponent } from '@rates-trading/shared-utils';
import { ${params.serviceClassName} } from '../services/${params.serviceName}.service';
import { ${params.gridRowName} } from '../models/${params.name}';

@Component({
  selector: 'app-${params.name}',
  standalone: true,
  imports: [CommonModule, DataGrid],
  templateUrl: './${params.name}.component.html',
  styleUrl: './${params.name}.component.css',
})
export class ${params.className} extends WorkspaceComponent implements OnInit, OnDestroy {
  readonly stateKey = '${params.stateKey}';

  @ViewChild('dataGrid') dataGrid!: DataGrid<${params.gridRowName}>;

  private service = inject(${params.serviceClassName});
  private logger = inject(LoggerService).child({ component: '${params.className}' });
  private rowUpdateSub?: Subscription;
  private pendingGridState: Record<string, unknown> | null = null;

  columns: ColDef[] = [
${params.fields.map((f, i) => `    { field: '${f}', headerName: '${f}'${i === 0 ? ", pinned: 'left'" : ''}, width: ${i === 0 ? 100 : 120} },`).join('\n')}
  ];

  getState(): Record<string, unknown> {
    if (!this.dataGrid) return {};
    return this.dataGrid.getGridState() ?? {};
  }

  setState(state: Record<string, unknown>): void {
    if (this.dataGrid?.getGridApi()) {
      this.dataGrid.applyGridState(state);
    } else {
      this.pendingGridState = state;
    }
  }

  ngOnInit(): void {
    this.loadPersistedState();
    this.service.connect();

    this.rowUpdateSub = this.service.rowUpdate$.subscribe((row) => {
      if (this.dataGrid) {
        this.dataGrid.updateRow(row);
      }
    });
  }

  onDataGridReady(): void {
    if (this.pendingGridState) {
      this.dataGrid.applyGridState(this.pendingGridState);
      this.pendingGridState = null;
    }
  }

  onGridStateChanged(): void {
    this.persistState();
  }

  ngOnDestroy(): void {
    this.rowUpdateSub?.unsubscribe();
  }
}
`.trim(),

  componentHtmlTemplate: (params: { name: string; gridRowName: string }) => `
<div class="${params.name}-container" style="height: 100%; width: 100%;">
  <lib-data-grid
    #dataGrid
    [columns]="columns"
    [rowData]="[]"
    rowIdField="${params.name.includes('-') ? params.name.split('-')[0] : 'Id'}"
    [highFrequencyMode]="true"
    height="100%"
    (gridInitialized)="onDataGridReady()"
    (stateChanged)="onGridStateChanged()"
  ></lib-data-grid>
</div>
`.trim(),

  componentCssTemplate: () => `
:host {
  display: block;
  height: 100%;
  width: 100%;
}
`.trim(),

  /**
   * Route registration pattern — add to app.routes.ts
   */
  routeTemplate: (params: { routePath: string; title: string; className: string; importPath: string }) =>
    `  { path: '${params.routePath.replace(/^\//, '')}', title: '${params.title}', component: ${params.className} },`,

  /**
   * Menu item registration pattern — add to app.ts menuItems array
   */
  menuItemTemplate: (params: { label: string; icon: string; routePath: string; viewBaseName: string }) =>
    `{
  label: '${params.label}',
  icon: '${params.icon}',
  command: () => this.addViewFromMenu('${params.viewBaseName}', '${params.routePath}'),
}`,
};
