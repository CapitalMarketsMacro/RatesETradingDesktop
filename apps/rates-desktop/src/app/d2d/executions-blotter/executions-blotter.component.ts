import { Component, inject, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataGrid, ColDef } from '@rates-trading/ui-components';
import { TRANSPORT_SERVICE, Subscription as TransportSubscription, ConnectionStatus } from '@rates-trading/transports';
import { ConfigurationService } from '@rates-trading/configuration';
import { LoggerService } from '@rates-trading/logger';
import { formatTreasury32nds, WorkspaceComponent } from '@rates-trading/shared-utils';
import { ValueFormatterParams, CellClassParams, GridOptions } from 'ag-grid-community';
import { Subscription, filter, take } from 'rxjs';
import { Execution, ExecutionGridRow, transformExecutionToGridRow } from '../models';

/**
 * Executions Blotter Component
 * 
 * Displays trade executions/fills in an ag-Grid.
 * Data is received from the rates/executions AMPS topic.
 *
 * Extends WorkspaceComponent to persist grid state (column widths,
 * column order, sort, filters) across layout save/restore.
 */
@Component({
  selector: 'app-executions-blotter',
  standalone: true,
  imports: [CommonModule, DataGrid],
  templateUrl: './executions-blotter.component.html',
  styleUrl: './executions-blotter.component.css',
})
export class ExecutionsBlotterComponent extends WorkspaceComponent implements OnInit, OnDestroy {
  readonly stateKey = 'executions/blotter';

  @ViewChild('executionsGrid') executionsGrid!: DataGrid<ExecutionGridRow>;
  
  private transport = inject(TRANSPORT_SERVICE);
  private configService = inject(ConfigurationService);
  private logger = inject(LoggerService).child({ component: 'ExecutionsBlotter' });
  private executionsSubscription?: TransportSubscription;
  private connectionSubscription?: Subscription;
  private pendingGridState: Record<string, unknown> | null = null;

  // Grid options - disable row selection checkboxes
  gridOptions: GridOptions = {
    rowSelection: {
      mode: 'multiRow',
      checkboxes: false,
      headerCheckbox: false,
      enableClickSelection: true,
    },
  };

  // Executions grid columns
  columns: ColDef[] = [
    {
      field: 'ExecutionIdString',
      headerName: 'Exec ID',
      width: 160,
      pinned: 'left',
    },
    {
      field: 'Side',
      headerName: 'Side',
      width: 80,
      cellClass: (params: CellClassParams) => {
        return params.value === 'BUY' ? 'side-buy' : 'side-sell';
      },
    },
    {
      field: 'ExecutedQty',
      headerName: 'Exec Qty',
      width: 100,
      valueFormatter: (params: ValueFormatterParams) => 
        params.value != null ? params.value.toLocaleString() : '-',
      cellStyle: { textAlign: 'right' },
    },
    {
      field: 'Price',
      headerName: 'Price',
      width: 120,
      valueFormatter: (params: ValueFormatterParams) => formatTreasury32nds(params.value),
      cellStyle: { textAlign: 'right', fontWeight: 'bold' },
    },
    {
      field: 'Qty',
      headerName: 'Order Qty',
      width: 100,
      valueFormatter: (params: ValueFormatterParams) => 
        params.value != null ? params.value.toLocaleString() : '-',
      cellStyle: { textAlign: 'right' },
    },
    {
      field: 'LeavesQty',
      headerName: 'Leaves',
      width: 90,
      valueFormatter: (params: ValueFormatterParams) => 
        params.value != null ? params.value.toLocaleString() : '-',
      cellStyle: { textAlign: 'right' },
    },
    {
      field: 'ProductId',
      headerName: 'Product',
      width: 100,
    },
    {
      field: 'DstEE',
      headerName: 'Dest',
      width: 80,
    },
    {
      field: 'Venue',
      headerName: 'Venue',
      width: 100,
    },
    {
      field: 'UserId',
      headerName: 'User',
      width: 100,
    },
    {
      field: 'CounterParty',
      headerName: 'Counterparty',
      width: 120,
    },
    {
      field: 'OrderIdString',
      headerName: 'Order ID',
      width: 160,
    },
    {
      field: 'TransactionTime',
      headerName: 'Time',
      width: 150,
      valueFormatter: (params: ValueFormatterParams) => {
        if (!params.value) return '-';
        // TransactionTime is in microseconds, convert to milliseconds
        const ms = params.value;
        return new Date(ms).toLocaleTimeString();
      },
    },
    {
      field: 'Comment',
      headerName: 'Comment',
      width: 150,
    },
  ];

  // ── WorkspaceComponent contract ──

  getState(): Record<string, unknown> {
    if (!this.executionsGrid) return {};
    return this.executionsGrid.getGridState() ?? {};
  }

  setState(state: Record<string, unknown>): void {
    if (this.executionsGrid?.getGridApi()) {
      this.executionsGrid.applyGridState(state);
      this.logger.info('Restored grid state (column + filter) from saved layout');
    } else {
      this.pendingGridState = state;
    }
  }

  // ── Lifecycle ──

  ngOnInit(): void {
    // Load persisted state; may stash for deferred apply.
    this.loadPersistedState();

    // Wait for transport to be connected before subscribing
    this.connectionSubscription = this.transport.connectionStatus$
      .pipe(
        filter(status => status === ConnectionStatus.Connected),
        take(1)
      )
      .subscribe(() => {
        this.subscribeToExecutions();
      });
  }

  /**
   * Called by lib-data-grid (gridInitialized) when the AG Grid API is ready.
   * Apply any pending grid state that was loaded before the grid existed.
   */
  onDataGridReady(): void {
    if (this.pendingGridState) {
      this.executionsGrid.applyGridState(this.pendingGridState);
      this.logger.info('Applied deferred grid state after grid ready');
      this.pendingGridState = null;
    }
  }

  /**
   * Called when the user changes column widths, sort, or filter.
   * Persists the latest grid state via the WorkspaceStorageService.
   */
  onGridStateChanged(): void {
    this.persistState();
  }

  ngOnDestroy(): void {
    this.connectionSubscription?.unsubscribe();
    this.unsubscribe();
  }

  /**
   * Subscribe to executions topic using SOW and Subscribe when available.
   * SOW delivers the full historical snapshot first, then streams live updates.
   */
  private async subscribeToExecutions(): Promise<void> {
    const config = this.configService.getConfiguration();
    const topic = config?.ampsTopics?.executions || 'rates/executions';
    
    try {
      const callback = (message: { data: Execution }) => {
        this.handleExecutionMessage(message.data);
      };

      // Prefer sowAndSubscribe (AMPS) — delivers all existing executions first,
      // then streams live fills through the same callback.
      if (this.transport.sowAndSubscribe) {
        this.executionsSubscription = await this.transport.sowAndSubscribe<Execution>(
          topic,
          callback,
        );
        this.logger.info({ topic }, 'SOW and subscribed to executions');
      } else {
        // Fallback for transports that don't support SOW (NATS, Solace, etc.)
        this.executionsSubscription = await this.transport.subscribe<Execution>(
          topic,
          callback,
        );
        this.logger.info({ topic }, 'Subscribed to executions (no SOW)');
      }
    } catch (error) {
      this.logger.error(error as Error, `Failed to subscribe to ${topic}`);
    }
  }

  /**
   * Handle incoming execution messages
   * Uses ag-Grid's applyTransactionAsync for high-frequency updates
   */
  private handleExecutionMessage(data: Execution): void {
    if (!data.ExecutionIdString) {
      return;
    }
    
    const gridRow = transformExecutionToGridRow(data);
    
    if (this.executionsGrid) {
      this.executionsGrid.updateRow(gridRow);
    }
  }

  /**
   * Unsubscribe from executions
   */
  private async unsubscribe(): Promise<void> {
    if (this.executionsSubscription) {
      await this.executionsSubscription.unsubscribe();
      this.executionsSubscription = undefined;
    }
  }
}
