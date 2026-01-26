import { Component, inject, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarketData, MarketDataGridRow, transformMarketDataToGridRow } from '@rates-trading/data-access';
import { DataGrid, ColDef } from '@rates-trading/ui-components';
import { TRANSPORT_SERVICE, Subscription as TransportSubscription, ConnectionStatus } from '@rates-trading/transports';
import { ConfigurationService } from '@rates-trading/configuration';
import { formatTreasury32nds, formatSpread32nds } from '@rates-trading/shared-utils';
import { ValueFormatterParams } from 'ag-grid-community';
import { Subscription, filter, take } from 'rxjs';

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
  
  private transport = inject(TRANSPORT_SERVICE);
  private configService = inject(ConfigurationService);
  private marketDataSubscription?: TransportSubscription;
  private connectionSubscription?: Subscription;

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
    // Wait for transport to be connected before subscribing
    this.connectionSubscription = this.transport.connectionStatus$
      .pipe(
        filter(status => status === ConnectionStatus.Connected),
        take(1)
      )
      .subscribe(() => {
        this.subscribeToMarketData();
      });
  }

  ngOnDestroy(): void {
    this.connectionSubscription?.unsubscribe();
    this.unsubscribe();
  }

  /**
   * Subscribe to market data topic
   */
  private async subscribeToMarketData(): Promise<void> {
    const config = this.configService.getConfiguration();
    const topic = config?.ampsTopics?.marketData || 'rates/marketData';
    
    try {
      this.marketDataSubscription = await this.transport.subscribe<MarketData>(
        topic,
        (message) => {
          this.handleMarketDataMessage(message.data);
        }
      );
      console.log(`MarketDataBlotter: Subscribed to market data topic: ${topic}`);
    } catch (error) {
      console.error(`MarketDataBlotter: Failed to subscribe to ${topic}:`, error);
    }
  }

  /**
   * Handle incoming market data messages
   * Uses ag-Grid's applyTransactionAsync for high-frequency updates
   */
  private handleMarketDataMessage(data: MarketData): void {
    if (!data.Id) {
      return;
    }
    
    const gridRow = transformMarketDataToGridRow(data);
    
    if (this.marketDataGrid) {
      this.marketDataGrid.updateRow(gridRow);
    }
  }

  /**
   * Unsubscribe from market data
   */
  private async unsubscribe(): Promise<void> {
    if (this.marketDataSubscription) {
      await this.marketDataSubscription.unsubscribe();
      this.marketDataSubscription = undefined;
    }
  }
}
