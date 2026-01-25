import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, NgZone, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarketData, MarketDataGridRow, transformMarketDataToGridRow } from '@rates-trading/data-access';
import { TRANSPORT_SERVICE, Subscription as TransportSubscription, ConnectionStatus } from '@rates-trading/transports';
import { formatTreasury32nds } from '@rates-trading/shared-utils';
import { Subscription, filter, take } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { PopoverModule, Popover } from 'primeng/popover';
import { ButtonModule } from 'primeng/button';

/**
 * Trading popover data structure
 * Uses instrumentId to reference live data instead of a static snapshot
 */
interface TradingPopoverData {
  instrumentId: string;
  side: 'buy' | 'sell';
  quantity: number;
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
  ],
  providers: [MessageService],
  templateUrl: './top-of-the-book-view.component.html',
  styleUrl: './top-of-the-book-view.component.css',
})
export class TopOfTheBookViewComponent implements OnInit, OnDestroy {
  private transport = inject(TRANSPORT_SERVICE);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private messageService = inject(MessageService);
  
  @ViewChild('tradingPopover') tradingPopover!: Popover;
  
  private marketDataSubscription?: TransportSubscription;
  private connectionSubscription?: Subscription;

  // Market data rows stored in a Map for efficient updates
  private marketDataMap = new Map<string, MarketDataGridRow>();
  
  // Array for template binding
  marketDataRows: MarketDataGridRow[] = [];

  // Trading popover state
  tradingData: TradingPopoverData | null = null;

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
    const topic = 'rates/marketData';
    
    try {
      this.marketDataSubscription = await this.transport.subscribe<MarketData>(
        topic,
        (message) => {
          this.handleMarketDataMessage(message.data);
        }
      );
      console.log('TopOfTheBook: Subscribed to market data');
    } catch (error) {
      console.error(`TopOfTheBook: Failed to subscribe to ${topic}:`, error);
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

    const { side, quantity } = this.tradingData;
    const row = this.liveRow;
    const price = this.livePrice;
    const size = this.liveSize;
    const formattedPrice = this.formatPrice(price);
    const formattedQty = quantity.toLocaleString();
    const formattedSize = size ? size.toLocaleString() : '-';
    
    // Show toast notification
    this.messageService.add({
      severity: side === 'buy' ? 'success' : 'info',
      summary: `${side === 'buy' ? 'Buy' : 'Sell'} Order Submitted`,
      detail: `${side === 'buy' ? 'Bought' : 'Sold'} ${formattedQty} of ${row.Desc} @ ${formattedPrice} (Size: ${formattedSize})`,
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
