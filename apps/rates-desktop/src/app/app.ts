import { Component, inject, OnInit, OnDestroy, NgZone, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { MenubarModule } from 'primeng/menubar';
import { ButtonModule } from 'primeng/button';
import { RatesData, MarketData, MarketDataGridRow, transformMarketDataToGridRow } from '@rates-trading/data-access';
import { RateCard, DataGrid, ColDef } from '@rates-trading/ui-components';
import { ConfigurationService, RatesAppConfiguration } from '@rates-trading/configuration';
import { TRANSPORT_SERVICE, Subscription as TransportSubscription, ConnectionStatus } from '@rates-trading/transports';
import { formatTreasury32nds, formatSpread32nds } from '@rates-trading/shared-utils';
import { ValueFormatterParams } from 'ag-grid-community';

export interface TreasurySecurity {
  cusip: string;
  security: string;
  maturityDate: string;
  coupon: number;
  price: string;
  yield: number;
  change: string;
  changeBps: number;
  bid: string;
  ask: string;
  spread: string;
  volume: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MenubarModule,
    ButtonModule,
    RateCard,
    DataGrid,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  @ViewChild('marketDataGrid') marketDataGrid!: DataGrid<MarketDataGridRow>;
  
  private ratesData = inject(RatesData);
  private configService = inject(ConfigurationService);
  private transport = inject(TRANSPORT_SERVICE);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  
  title = 'Rates E-Trading Desktop';
  config?: RatesAppConfiguration;
  protected rates: { symbol: string; rate: number; change: number }[] = [];
  menuItems: MenuItem[] = [
    { label: 'Market Data', icon: 'pi pi-chart-line', routerLink: ['/market-data'] },
    { label: 'Trading', icon: 'pi pi-briefcase', routerLink: ['/trading'] },
    { label: 'Preferences', icon: 'pi pi-cog', routerLink: ['/preferences'] },
  ];
  isDarkTheme = false;

  // AMPS connection state
  connectionStatus: ConnectionStatus = ConnectionStatus.Disconnected;
  private marketDataSubscription?: TransportSubscription;

  // Market data grid columns (from AMPS)
  marketDataColumns: ColDef[] = [
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


  constructor() {
    this.rates = this.ratesData.getRates();
  }

  ngOnInit() {
    // Load configuration
    this.configService.loadConfiguration().subscribe((config) => {
      this.config = config;
      // Set title from configuration
      this.title = config.app.name;
      
      // Connect to AMPS and subscribe to market data
      this.connectToTransport();
    });

    // Subscribe to connection status changes
    this.transport.connectionStatus$.subscribe((status) => {
      this.ngZone.run(() => {
        this.connectionStatus = status;
        console.log('Transport connection status:', status);
        this.cdr.detectChanges();
      });
    });

    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      this.isDarkTheme = true;
      document.documentElement.classList.add('app-dark');
    }
  }

  ngOnDestroy() {
    // Cleanup subscriptions
    this.disconnectFromTransport();
  }

  /**
   * Connect to AMPS and subscribe to market data topic
   */
  private async connectToTransport(): Promise<void> {
    try {
      console.log('Connecting to AMPS transport...');
      await this.transport.connect();
      console.log('Connected to AMPS transport');
      
      // Subscribe to market data topic
      await this.subscribeToMarketData();
    } catch (error) {
      console.error('Failed to connect to AMPS:', error);
    }
  }

  /**
   * Subscribe to market data topic
   */
  private async subscribeToMarketData(): Promise<void> {
    const topic = 'rates/marketData';
    
    try {
      console.log(`Subscribing to topic: ${topic}`);
      
      this.marketDataSubscription = await this.transport.subscribe<MarketData>(
        topic,
        (message) => {
          this.handleMarketDataMessage(message.data);
        }
      );
      
      console.log(`Subscribed to ${topic} with subscription ID: ${this.marketDataSubscription.id}`);
    } catch (error) {
      console.error(`Failed to subscribe to ${topic}:`, error);
    }
  }

  /**
   * Handle incoming market data messages
   * Uses ag-Grid's applyTransactionAsync for high-frequency updates
   */
  private handleMarketDataMessage(data: MarketData): void {
    if (!data.Id) {
      console.warn('Market data missing Id:', data);
      return;
    }
    
    // Transform to grid row format
    const gridRow = transformMarketDataToGridRow(data);
    
    // Use the grid's high-frequency update API directly
    if (this.marketDataGrid) {
      this.marketDataGrid.updateRow(gridRow);
    } else {
      console.warn('Market data grid not ready yet');
    }
  }
  
  /**
   * Disconnect from transport and cleanup
   */
  private async disconnectFromTransport(): Promise<void> {
    try {
      if (this.marketDataSubscription) {
        await this.marketDataSubscription.unsubscribe();
        this.marketDataSubscription = undefined;
      }
      
      await this.transport.disconnect();
      console.log('Disconnected from AMPS transport');
    } catch (error) {
      console.error('Error disconnecting from transport:', error);
    }
  }

  /**
   * Manually reconnect to transport
   */
  async reconnect(): Promise<void> {
    await this.disconnectFromTransport();
    await this.connectToTransport();
  }

  /**
   * Get connection status label for display
   */
  get connectionStatusLabel(): string {
    switch (this.connectionStatus) {
      case ConnectionStatus.Connected:
        return 'Connected';
      case ConnectionStatus.Connecting:
        return 'Connecting...';
      case ConnectionStatus.Disconnected:
        return 'Disconnected';
      case ConnectionStatus.Reconnecting:
        return 'Reconnecting...';
      case ConnectionStatus.Error:
        return 'Error';
      default:
        return 'Unknown';
    }
  }

  /**
   * Get connection status CSS class
   */
  get connectionStatusClass(): string {
    switch (this.connectionStatus) {
      case ConnectionStatus.Connected:
        return 'status-connected';
      case ConnectionStatus.Connecting:
      case ConnectionStatus.Reconnecting:
        return 'status-connecting';
      case ConnectionStatus.Disconnected:
      case ConnectionStatus.Error:
        return 'status-disconnected';
      default:
        return '';
    }
  }

  toggleTheme(): void {
    this.isDarkTheme = !this.isDarkTheme;
    const html = document.documentElement;
    if (this.isDarkTheme) {
      html.classList.add('app-dark');
      localStorage.setItem('theme', 'dark');
    } else {
      html.classList.remove('app-dark');
      localStorage.setItem('theme', 'light');
    }
  }

  get themeLabel(): string {
    return this.isDarkTheme ? 'Light Mode' : 'Dark Mode';
  }

  get themeIcon(): string {
    return this.isDarkTheme ? 'pi pi-sun' : 'pi pi-moon';
  }
}
