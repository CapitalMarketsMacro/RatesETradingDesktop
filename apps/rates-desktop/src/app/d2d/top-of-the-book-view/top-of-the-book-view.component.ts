import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, NgZone, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarketData, MarketDataGridRow, transformMarketDataToGridRow } from '@rates-trading/data-access';
import { TRANSPORT_SERVICE, Subscription as TransportSubscription, ConnectionStatus, AmpsTransportService, NatsTransportService, ITransportService } from '@rates-trading/transports';
import { ConfigurationService } from '@rates-trading/configuration';
import { LoggerService } from '@rates-trading/logger';
import { formatTreasury32nds } from '@rates-trading/shared-utils';
import { Subscription, filter, take } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { PopoverModule, Popover } from 'primeng/popover';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';

/**
 * Trading book option for dropdown
 */
interface TradingBook {
  name: string;
  code: string;
}

/**
 * Transport type option for dropdown
 */
interface TransportOption {
  label: string;
  value: 'amps' | 'nats';
}

/**
 * Trading popover data structure
 * Uses instrumentId to reference live data instead of a static snapshot
 */
interface TradingPopoverData {
  instrumentId: string;
  side: 'buy' | 'sell';
  quantity: number;
  book: TradingBook;
}

/**
 * Top of the Book View Component
 * 
 * Displays a simplified view of market data using CSS Grid showing:
 * - Description
 * - Bid Size (light green) - Hover to Sell
 * - Best Bid
 * - Best Ask
 * - Ask Size (salmon) - Hover to Buy
 */
@Component({
  selector: 'app-top-of-the-book-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ToastModule,
    PopoverModule,
    ButtonModule,
    SelectModule,
  ],
  providers: [MessageService],
  templateUrl: './top-of-the-book-view.component.html',
  styleUrl: './top-of-the-book-view.component.css',
})
export class TopOfTheBookViewComponent implements OnInit, OnDestroy {
  private transport = inject(TRANSPORT_SERVICE);
  private ampsTransport = inject(AmpsTransportService);
  private natsTransport = inject(NatsTransportService);
  private configService = inject(ConfigurationService);
  private logger = inject(LoggerService).child({ component: 'TopOfTheBookView' });
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private messageService = inject(MessageService);
  
  @ViewChild('tradingPopover') tradingPopover!: Popover;
  
  private marketDataSubscription?: TransportSubscription;
  private connectionSubscription?: Subscription;
  private currentTransport: 'amps' | 'nats' = 'amps';

  // Market data rows stored in a Map for efficient updates
  private marketDataMap = new Map<string, MarketDataGridRow>();
  
  // Array for template binding
  marketDataRows: MarketDataGridRow[] = [];

  // Trading popover state
  tradingData: TradingPopoverData | null = null;

  // Available trading books
  tradingBooks: TradingBook[] = [
    { name: 'Flow Trading', code: 'FLOW' },
    { name: 'Prop Trading', code: 'PROP' },
    { name: 'Customer Facilitation', code: 'CUST' },
    { name: 'Hedge Book', code: 'HEDGE' },
    { name: 'Market Making', code: 'MM' },
  ];

  // Available transport options
  transportOptions: TransportOption[] = [
    { label: 'AMPS', value: 'amps' },
    { label: 'NATS', value: 'nats' },
  ];

  selectedTransport: TransportOption = this.transportOptions[0];

  // Expose formatter for template
  formatPrice = formatTreasury32nds;

  /**
   * Get live row data for the trading popover
   * Returns the current market data row referenced by tradingData.instrumentId
   */
  get liveRow(): MarketDataGridRow | null {
    if (!this.tradingData) {
      return null;
    }
    return this.marketDataMap.get(this.tradingData.instrumentId) || null;
  }

  /**
   * Get the current live price for the trading side
   */
  get livePrice(): number | null {
    const row = this.liveRow;
    if (!row || !this.tradingData) {
      return null;
    }
    return this.tradingData.side === 'sell' ? row.BestBidPrice : row.BestAskPrice;
  }

  /**
   * Get the current live size for the trading side
   */
  get liveSize(): number | null {
    const row = this.liveRow;
    if (!row || !this.tradingData) {
      return null;
    }
    return this.tradingData.side === 'sell' ? row.BestBidQty : row.BestAskQty;
  }

  ngOnInit(): void {
    // Initialize both transports
    this.initializeTransports();
    
    // Wait for current transport to be connected before subscribing
    this.connectAndSubscribe();
  }

  /**
   * Initialize both AMPS and NATS transports
   */
  private async initializeTransports(): Promise<void> {
    const config = this.configService.getConfiguration();
    
    // Initialize AMPS transport
    if (config?.transport?.amps) {
      this.ampsTransport.initialize(config.transport.amps);
    }
    
    // Initialize NATS transport
    if (config?.transport?.nats) {
      this.natsTransport.initialize(config.transport.nats);
    }
  }

  /**
   * Connect to the current transport and subscribe
   */
  private async connectAndSubscribe(): Promise<void> {
    const activeTransport = this.getActiveTransport();
    
    // Wait for transport to be connected before subscribing
    this.connectionSubscription?.unsubscribe();
    this.connectionSubscription = activeTransport.connectionStatus$
      .pipe(
        filter(status => status === ConnectionStatus.Connected),
        take(1)
      )
      .subscribe(async () => {
        await this.subscribeToMarketData();
      });

    // Connect if not already connected
    if (!activeTransport.isConnected()) {
      try {
        await activeTransport.connect();
      } catch (error) {
        this.logger.error(error as Error, `Failed to connect to ${this.currentTransport}`);
      }
    } else {
      // Already connected, subscribe immediately
      await this.subscribeToMarketData();
    }
  }

  /**
   * Get the active transport service based on current selection
   */
  private getActiveTransport(): ITransportService {
    return this.currentTransport === 'amps' ? this.ampsTransport : this.natsTransport;
  }

  /**
   * Handle transport selection change
   */
  async onTransportChange(): Promise<void> {
    const newTransport = this.selectedTransport.value;
    
    if (newTransport === this.currentTransport) {
      return; // No change
    }

    this.logger.info({ from: this.currentTransport, to: newTransport }, 'Switching transport');

    // Unsubscribe from current transport
    await this.unsubscribe();

    // Disconnect from current transport
    const oldTransport = this.getActiveTransport();
    if (oldTransport.isConnected()) {
      try {
        await oldTransport.disconnect();
      } catch (error) {
        this.logger.error(error as Error, `Error disconnecting from ${this.currentTransport}`);
      }
    }

    // Update current transport
    this.currentTransport = newTransport;

    // Connect and subscribe to new transport
    await this.connectAndSubscribe();
  }

  async ngOnDestroy(): Promise<void> {
    this.connectionSubscription?.unsubscribe();
    await this.unsubscribe();
    
    // Disconnect from both transports
    if (this.ampsTransport.isConnected()) {
      try {
        await this.ampsTransport.disconnect();
      } catch (error) {
        this.logger.error(error as Error, 'Error disconnecting AMPS transport');
      }
    }
    
    if (this.natsTransport.isConnected()) {
      try {
        await this.natsTransport.disconnect();
      } catch (error) {
        this.logger.error(error as Error, 'Error disconnecting NATS transport');
      }
    }
  }

  /**
   * Subscribe to market data topic
   */
  private async subscribeToMarketData(): Promise<void> {
    const config = this.configService.getConfiguration();
    const activeTransport = this.getActiveTransport();
    
    // Determine topic based on transport type
    let topic: string;
    if (this.currentTransport === 'amps') {
      topic = config?.ampsTopics?.marketData || 'rates/marketData';
    } else {
      // NATS uses dot notation instead of slash
      topic = 'rates.marketData';
    }
    
    try {
      this.marketDataSubscription = await activeTransport.subscribe<MarketData>(
        topic,
        (message) => {
          this.handleMarketDataMessage(message.data);
        }
      );
      this.logger.info({ transport: this.currentTransport, topic }, 'Subscribed to market data topic');
    } catch (error) {
      this.logger.error(error as Error, `Failed to subscribe to ${topic} on ${this.currentTransport}`);
    }
  }

  /**
   * Handle incoming market data messages
   */
  private handleMarketDataMessage(data: MarketData): void {
    if (!data.Id) {
      return;
    }
    
    const gridRow = transformMarketDataToGridRow(data);
    
    // Run inside Angular zone to trigger change detection
    this.ngZone.run(() => {
      this.marketDataMap.set(data.Id, gridRow);
      this.marketDataRows = Array.from(this.marketDataMap.values());
      this.cdr.detectChanges();
    });
  }

  /**
   * Format quantity with commas
   */
  formatQuantity(value: number | null): string {
    if (value == null) {
      return '-';
    }
    return value.toLocaleString();
  }

  /**
   * Track by function for ngFor performance
   */
  trackByRow(index: number, row: MarketDataGridRow): string {
    return row.Id;
  }

  /**
   * Show trading popover on cell click
   */
  showTradingPopover(event: Event, row: MarketDataGridRow, side: 'buy' | 'sell'): void {
    // Hide any existing popover first
    if (this.tradingPopover) {
      this.tradingPopover.hide();
    }
    
    // Set up trading data with instrument ID for live updates
    this.tradingData = {
      instrumentId: row.Id,
      side,
      quantity: 1, // Default quantity
      book: this.tradingBooks[0], // Default to first book
    };
    
    // Trigger change detection to ensure popover content is rendered
    this.cdr.detectChanges();
    
    // Show popover at the event target (use setTimeout to ensure DOM is ready)
    setTimeout(() => {
      this.tradingPopover.toggle(event);
    }, 0);
  }

  /**
   * Hide trading popover
   */
  hideTradingPopover(): void {
    if (this.tradingPopover) {
      this.tradingPopover.hide();
    }
    this.tradingData = null;
  }

  /**
   * Execute trade (buy or sell)
   */
  executeTrade(): void {
    if (!this.tradingData || !this.liveRow) {
      return;
    }

    const { side, quantity, book } = this.tradingData;
    const row = this.liveRow;
    const price = this.livePrice;
    const size = this.liveSize;
    const formattedPrice = this.formatPrice(price);
    const formattedQty = quantity.toLocaleString();
    const formattedSize = size ? size.toLocaleString() : '-';
    
    // Show toast notification - using key to target the component's toast
    this.messageService.add({
      key: 'tob-toast',
      severity: side === 'buy' ? 'success' : 'info',
      summary: `${side === 'buy' ? 'Buy' : 'Sell'} Order Submitted`,
      detail: `${side === 'buy' ? 'Bought' : 'Sold'} ${formattedQty} of ${row.Desc} @ ${formattedPrice} | Book: ${book.name}`,
      life: 5000,
    });

    // Hide popover after trade
    this.hideTradingPopover();
  }

  /**
   * Increment quantity
   */
  incrementQuantity(): void {
    if (this.tradingData) {
      this.tradingData.quantity++;
    }
  }

  /**
   * Decrement quantity
   */
  decrementQuantity(): void {
    if (this.tradingData && this.tradingData.quantity > 1) {
      this.tradingData.quantity--;
    }
  }

  /**
   * Validate quantity is at least 1
   */
  validateQuantity(): void {
    if (this.tradingData && this.tradingData.quantity < 1) {
      this.tradingData.quantity = 1;
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
