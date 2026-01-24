import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarketData, MarketDataGridRow, transformMarketDataToGridRow } from '@rates-trading/data-access';
import { TRANSPORT_SERVICE, Subscription as TransportSubscription, ConnectionStatus } from '@rates-trading/transports';
import { formatTreasury32nds } from '@rates-trading/shared-utils';
import { Subscription, filter, take } from 'rxjs';

/**
 * Top of the Book View Component
 * 
 * Displays a simplified view of market data using CSS Grid showing:
 * - Description
 * - Bid Size (light green)
 * - Best Bid
 * - Best Ask
 * - Ask Size (salmon)
 */
@Component({
  selector: 'app-top-of-the-book-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './top-of-the-book-view.component.html',
  styleUrl: './top-of-the-book-view.component.css',
})
export class TopOfTheBookViewComponent implements OnInit, OnDestroy {
  private transport = inject(TRANSPORT_SERVICE);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  
  private marketDataSubscription?: TransportSubscription;
  private connectionSubscription?: Subscription;

  // Market data rows stored in a Map for efficient updates
  private marketDataMap = new Map<string, MarketDataGridRow>();
  
  // Array for template binding
  marketDataRows: MarketDataGridRow[] = [];

  // Expose formatter for template
  formatPrice = formatTreasury32nds;

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
   * Unsubscribe from market data
   */
  private async unsubscribe(): Promise<void> {
    if (this.marketDataSubscription) {
      await this.marketDataSubscription.unsubscribe();
      this.marketDataSubscription = undefined;
    }
  }
}
