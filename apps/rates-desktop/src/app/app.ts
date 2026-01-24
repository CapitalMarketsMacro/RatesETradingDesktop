import { Component, inject, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { MenubarModule } from 'primeng/menubar';
import { ButtonModule } from 'primeng/button';
import { RatesData } from '@rates-trading/data-access';
import { ConfigurationService, RatesAppConfiguration } from '@rates-trading/configuration';
import { TRANSPORT_SERVICE, ConnectionStatus } from '@rates-trading/transports';
import { TopOfTheBookViewComponent, MarketDataBlotterComponent } from './d2d';

/** Available D2D views */
export type D2DView = 'top-of-book' | 'market-data-blotter';

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
    TopOfTheBookViewComponent,
    MarketDataBlotterComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  private ratesData = inject(RatesData);
  private configService = inject(ConfigurationService);
  private transport = inject(TRANSPORT_SERVICE);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  
  title = 'Rates E-Trading Desktop';
  config?: RatesAppConfiguration;
  protected rates: { symbol: string; rate: number; change: number }[] = [];
  
  /** Currently selected D2D view */
  currentView: D2DView = 'top-of-book';
  
  menuItems: MenuItem[] = [];
  isDarkTheme = false;

  // AMPS connection state
  connectionStatus: ConnectionStatus = ConnectionStatus.Disconnected;


  constructor() {
    this.rates = this.ratesData.getRates();
  }

  ngOnInit() {
    // Initialize menu items with proper binding
    this.menuItems = [
      { 
        label: 'Market Data', 
        icon: 'pi pi-chart-line',
        items: [
          { 
            label: 'Top of the Book', 
            icon: 'pi pi-list',
            command: () => this.selectView('top-of-book')
          },
          { 
            label: 'Market Data Blotter', 
            icon: 'pi pi-table',
            command: () => this.selectView('market-data-blotter')
          },
        ]
      },
      { label: 'Trading', icon: 'pi pi-briefcase', routerLink: ['/trading'] },
      { label: 'Preferences', icon: 'pi pi-cog', routerLink: ['/preferences'] },
    ];

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
   * Select a D2D view to display
   */
  selectView(view: D2DView): void {
    console.log('Selecting view:', view);
    this.currentView = view;
    this.cdr.detectChanges();
  }

  /**
   * Connect to AMPS transport
   */
  private async connectToTransport(): Promise<void> {
    try {
      console.log('Connecting to AMPS transport...');
      await this.transport.connect();
      console.log('Connected to AMPS transport');
    } catch (error) {
      console.error('Failed to connect to AMPS:', error);
    }
  }

  /**
   * Disconnect from transport and cleanup
   */
  private async disconnectFromTransport(): Promise<void> {
    try {
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
