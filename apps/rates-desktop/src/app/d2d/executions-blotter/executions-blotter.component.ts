import { Component, inject, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataGrid, ColDef } from '@rates-trading/ui-components';
import { TRANSPORT_SERVICE, Subscription as TransportSubscription, ConnectionStatus } from '@rates-trading/transports';
import { ConfigurationService } from '@rates-trading/configuration';
import { formatTreasury32nds } from '@rates-trading/shared-utils';
import { ValueFormatterParams, CellClassParams, GridOptions } from 'ag-grid-community';
import { Subscription, filter, take } from 'rxjs';
import { Execution, ExecutionGridRow, transformExecutionToGridRow } from '../models';

/**
 * Executions Blotter Component
 * 
 * Displays trade executions/fills in an ag-Grid.
 * Data is received from the rates/executions AMPS topic.
 */
@Component({
  selector: 'app-executions-blotter',
  standalone: true,
  imports: [CommonModule, DataGrid],
  templateUrl: './executions-blotter.component.html',
  styleUrl: './executions-blotter.component.css',
})
export class ExecutionsBlotterComponent implements OnInit, OnDestroy {
  @ViewChild('executionsGrid') executionsGrid!: DataGrid<ExecutionGridRow>;
  
  private transport = inject(TRANSPORT_SERVICE);
  private configService = inject(ConfigurationService);
  private executionsSubscription?: TransportSubscription;
  private connectionSubscription?: Subscription;

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

  ngOnInit(): void {
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

  ngOnDestroy(): void {
    this.connectionSubscription?.unsubscribe();
    this.unsubscribe();
  }

  /**
   * Subscribe to executions topic
   */
  private async subscribeToExecutions(): Promise<void> {
    const config = this.configService.getConfiguration();
    const topic = config?.ampsTopics?.executions || 'rates/executions';
    
    try {
      this.executionsSubscription = await this.transport.subscribe<Execution>(
        topic,
        (message) => {
          this.handleExecutionMessage(message.data);
        }
      );
      console.log(`ExecutionsBlotter: Subscribed to executions topic: ${topic}`);
    } catch (error) {
      console.error(`ExecutionsBlotter: Failed to subscribe to ${topic}:`, error);
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
