import { Component, inject, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { MenubarModule } from 'primeng/menubar';
import { ButtonModule } from 'primeng/button';
import { RatesData } from '@rates-trading/data-access';
import { ConfigurationService, RatesAppConfiguration } from '@rates-trading/configuration';
import { TRANSPORT_SERVICE, ConnectionStatus } from '@rates-trading/transports';
import { LoggerService } from '@rates-trading/logger';

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
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  private ratesData = inject(RatesData);
  private configService = inject(ConfigurationService);
  private transport = inject(TRANSPORT_SERVICE);
  private logger = inject(LoggerService).child({ component: 'App' });
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  
  title = 'Rates E-Trading Desktop';
  config?: RatesAppConfiguration;
  protected rates: { symbol: string; rate: number; change: number }[] = [];
  
  menuItems: MenuItem[] = [];
  isDarkTheme = false;

  // AMPS connection state
  connectionStatus: ConnectionStatus = ConnectionStatus.Disconnected;


  constructor() {
    this.rates = this.ratesData.getRates();
  }

  ngOnInit() {
    // Initialize menu items with routing
    this.menuItems = [
      { 
        label: 'Market Data', 
        icon: 'pi pi-chart-line',
        items: [
          { 
            label: 'Top of the Book', 
            icon: 'pi pi-list',
            routerLink: ['/market-data/top-of-book']
          },
          { 
            label: 'Market Data Blotter', 
            icon: 'pi pi-table',
            routerLink: ['/market-data/blotter']
          },
        ]
      },
      { 
        label: 'Executions', 
        icon: 'pi pi-check-circle',
        routerLink: ['/executions']
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
        this.logger.debug({ status }, 'Transport connection status changed');
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
   * Connect to AMPS transport
   */
  private async connectToTransport(): Promise<void> {
    try {
      this.logger.info('Connecting to AMPS transport...');
      await this.transport.connect();
      this.logger.info('Connected to AMPS transport');
    } catch (error) {
      this.logger.error(error as Error, 'Failed to connect to AMPS');
    }
  }

  /**
   * Disconnect from transport and cleanup
   */
  private async disconnectFromTransport(): Promise<void> {
    try {
      await this.transport.disconnect();
      this.logger.info('Disconnected from AMPS transport');
    } catch (error) {
      this.logger.error(error as Error, 'Error disconnecting from transport');
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
