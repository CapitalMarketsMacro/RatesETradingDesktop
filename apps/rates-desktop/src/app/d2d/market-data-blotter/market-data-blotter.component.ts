import { Component, inject, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarketDataGridRow } from '@rates-trading/data-access';
import { DataGrid, ColDef } from '@rates-trading/ui-components';
import { LoggerService } from '@rates-trading/logger';
import { formatTreasury32nds, formatSpread32nds } from '@rates-trading/shared-utils';
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
 */
@Component({
  selector: 'app-market-data-blotter',
  standalone: true,
  imports: [CommonModule, DataGrid],
  templateUrl: './market-data-blotter.component.html',
  styleUrl: './market-data-blotter.component.css',
})
export class MarketDataBlotterComponent implements OnInit, OnDestroy {
  @ViewChild('marketDataGrid') marketDataGrid!: DataGrid<MarketDataGridRow>;
  
  private marketDataService = inject(MarketDataService);
  private logger = inject(LoggerService).child({ component: 'MarketDataBlotter' });
  private rowUpdateSub?: Subscription;

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

  ngOnInit(): void {
    // Ensure the shared market data service is connected
    this.marketDataService.connect();

    // Subscribe to individual row updates for high-frequency ag-Grid patching
    this.rowUpdateSub = this.marketDataService.rowUpdate$.subscribe((row) => {
      if (this.marketDataGrid) {
        this.marketDataGrid.updateRow(row);
      }
    });
  }

  ngOnDestroy(): void {
    this.rowUpdateSub?.unsubscribe();
  }
}
