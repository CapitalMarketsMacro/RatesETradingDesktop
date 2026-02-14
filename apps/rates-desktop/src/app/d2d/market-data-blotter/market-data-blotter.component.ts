import { Component, inject, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarketDataGridRow } from '@rates-trading/data-access';
import { DataGrid, ColDef } from '@rates-trading/ui-components';
import { LoggerService } from '@rates-trading/logger';
import { formatTreasury32nds, formatSpread32nds, WorkspaceComponent } from '@rates-trading/shared-utils';
import { ValueFormatterParams } from 'ag-grid-community';
import { Subscription } from 'rxjs';
import { MarketDataService } from '../services/market-data.service';

/**
 * Market Data Blotter Component
 * 
 * Displays full market data in an ag-Grid with all available columns:
 * - ID, Market ID, Description
 * - Bid/Ask prices and quantities
 * - Spread, Last Trade, Depth levels, Time
 *
 * Extends WorkspaceComponent to persist grid state (column widths,
 * column order, sort, filters) across layout save/restore.
 */
@Component({
  selector: 'app-market-data-blotter',
  standalone: true,
  imports: [CommonModule, DataGrid],
  templateUrl: './market-data-blotter.component.html',
  styleUrl: './market-data-blotter.component.css',
})
export class MarketDataBlotterComponent extends WorkspaceComponent implements OnInit, OnDestroy {
  readonly stateKey = 'market-data/blotter';

  @ViewChild('marketDataGrid') marketDataGrid!: DataGrid<MarketDataGridRow>;
  
  private marketDataService = inject(MarketDataService);
  private logger = inject(LoggerService).child({ component: 'MarketDataBlotter' });
  private rowUpdateSub?: Subscription;
  private pendingGridState: Record<string, unknown> | null = null;

  // Market data grid columns
  columns: ColDef[] = [
    {
      field: 'Id',
      headerName: 'ID',
      width: 80,
      pinned: 'left',
    },
    {
      field: 'MarketId',
      headerName: 'Market ID',
      width: 100,
    },
    {
      field: 'Desc',
      headerName: 'Description',
      width: 180,
      cellStyle: { fontWeight: 'bold' },
    },
    {
      field: 'BestBidPrice',
      headerName: 'Bid',
      width: 120,
      valueFormatter: (params: ValueFormatterParams) => formatTreasury32nds(params.value),
      cellStyle: { textAlign: 'right', color: '#2e7d32', fontWeight: 'bold' },
    },
    {
      field: 'BestBidQty',
      headerName: 'Bid Qty',
      width: 100,
      valueFormatter: (params: ValueFormatterParams) => 
        params.value != null ? params.value.toLocaleString() : '-',
      cellStyle: { textAlign: 'right' },
    },
    {
      field: 'BestAskPrice',
      headerName: 'Ask',
      width: 120,
      valueFormatter: (params: ValueFormatterParams) => formatTreasury32nds(params.value),
      cellStyle: { textAlign: 'right', color: '#d32f2f', fontWeight: 'bold' },
    },
    {
      field: 'BestAskQty',
      headerName: 'Ask Qty',
      width: 100,
      valueFormatter: (params: ValueFormatterParams) => 
        params.value != null ? params.value.toLocaleString() : '-',
      cellStyle: { textAlign: 'right' },
    },
    {
      field: 'Spread',
      headerName: 'Spread',
      width: 100,
      valueFormatter: (params: ValueFormatterParams) => formatSpread32nds(params.value),
      cellStyle: { textAlign: 'right' },
    },
    {
      field: 'LastTradePrice',
      headerName: 'Last Trade',
      width: 120,
      valueFormatter: (params: ValueFormatterParams) => formatTreasury32nds(params.value),
      cellStyle: { textAlign: 'right' },
    },
    {
      field: 'BidLevels',
      headerName: 'Bid Depth',
      width: 100,
      cellStyle: { textAlign: 'right' },
    },
    {
      field: 'AskLevels',
      headerName: 'Ask Depth',
      width: 100,
      cellStyle: { textAlign: 'right' },
    },
    {
      field: 'Time',
      headerName: 'Time',
      width: 150,
      valueFormatter: (params: ValueFormatterParams) => 
        params.value ? new Date(params.value).toLocaleTimeString() : '-',
    },
  ];

  // ── WorkspaceComponent contract ──

  getState(): Record<string, unknown> {
    if (!this.marketDataGrid) return {};
    return this.marketDataGrid.getGridState() ?? {};
  }

  setState(state: Record<string, unknown>): void {
    // Grid may not be ready yet; stash state and apply when grid fires gridInitialized.
    if (this.marketDataGrid?.getGridApi()) {
      this.marketDataGrid.applyGridState(state);
      this.logger.info('Restored grid state (column + filter) from saved layout');
    } else {
      this.pendingGridState = state;
    }
  }

  // ── Lifecycle ──

  ngOnInit(): void {
    // Load persisted state; may stash for deferred apply.
    this.loadPersistedState();

    // Ensure the shared market data service is connected
    this.marketDataService.connect();

    // Subscribe to individual row updates for high-frequency ag-Grid patching
    this.rowUpdateSub = this.marketDataService.rowUpdate$.subscribe((row) => {
      if (this.marketDataGrid) {
        this.marketDataGrid.updateRow(row);
      }
    });
  }

  /**
   * Called by lib-data-grid (gridInitialized) when the AG Grid API is ready.
   * Apply any pending grid state that was loaded before the grid existed.
   */
  onDataGridReady(): void {
    if (this.pendingGridState) {
      this.marketDataGrid.applyGridState(this.pendingGridState);
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
    this.rowUpdateSub?.unsubscribe();
  }
}
