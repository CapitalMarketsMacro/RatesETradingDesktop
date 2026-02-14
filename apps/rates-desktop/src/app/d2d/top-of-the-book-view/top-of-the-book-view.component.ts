import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, NgZone, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarketDataGridRow } from '@rates-trading/data-access';
import { LoggerService } from '@rates-trading/logger';
import { formatTreasury32nds } from '@rates-trading/shared-utils';
import { Subscription } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { PopoverModule, Popover } from 'primeng/popover';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { MarketDataService } from '../services/market-data.service';

/**
 * Trading book option for dropdown
 */
interface TradingBook {
  name: string;
  code: string;
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
  private marketDataService = inject(MarketDataService);
  private logger = inject(LoggerService).child({ component: 'TopOfTheBookView' });
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private messageService = inject(MessageService);
  
  @ViewChild('tradingPopover') tradingPopover!: Popover;
  
  private snapshotSub?: Subscription;

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

  // Expose formatter for template
  formatPrice = formatTreasury32nds;

  // ── Column resize state ──
  /** Column widths as fr values; order: Desc, BidSize, Bid, Ask, AskSize */
  columnWidths = [0.5, 1, 1, 1, 1];
  private resizeIndex = -1;
  private resizeStartX = 0;
  private resizeStartWidthLeft = 0;
  private resizeStartWidthRight = 0;
  private resizing = false;
  private resizeSolo = false; // true when resizing a single column (right edge of last col)
  private static readonly MIN_COL_FR = 0.2;

  /** Dynamic grid-template-columns binding */
  get gridTemplateColumns(): string {
    return this.columnWidths.map(w => `${w}fr`).join(' ');
  }

  /**
   * Get live row data for the trading popover
   * Returns the current market data row referenced by tradingData.instrumentId
   */
  get liveRow(): MarketDataGridRow | null {
    if (!this.tradingData) {
      return null;
    }
    return this.marketDataService.getRow(this.tradingData.instrumentId) || null;
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
    // Ensure the shared market data service is connected
    this.marketDataService.connect();

    // Subscribe to the full snapshot stream for template binding
    this.snapshotSub = this.marketDataService.snapshot$.subscribe((rows) => {
      this.marketDataRows = rows;
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.snapshotSub?.unsubscribe();
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

  // ── Column resize handlers ──

  /**
   * Start column resize between two adjacent columns.
   * @param event  MouseEvent from the handle
   * @param index  Column index (left column of the divider)
   */
  onResizeStart(event: MouseEvent, index: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.resizing = true;
    this.resizeSolo = false;
    this.resizeIndex = index;
    this.resizeStartX = event.clientX;
    this.resizeStartWidthLeft = this.columnWidths[index];
    this.resizeStartWidthRight = this.columnWidths[index + 1];
  }

  /**
   * Start solo column resize (right edge of the last column).
   * Grows/shrinks only that column without affecting neighbours.
   */
  onResizeSoloStart(event: MouseEvent, index: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.resizing = true;
    this.resizeSolo = true;
    this.resizeIndex = index;
    this.resizeStartX = event.clientX;
    this.resizeStartWidthLeft = this.columnWidths[index];
  }

  @HostListener('document:mousemove', ['$event'])
  onResizeMove(event: MouseEvent): void {
    if (!this.resizing) return;
    event.preventDefault();

    const gridEl = (event.target as HTMLElement).closest('.tob-grid') ??
                   document.querySelector('.tob-grid');
    const gridWidth = gridEl ? gridEl.clientWidth : 800;
    const totalFr = this.columnWidths.reduce((a, b) => a + b, 0);
    const pxPerFr = gridWidth / totalFr;
    const deltaFr = (event.clientX - this.resizeStartX) / pxPerFr;

    if (this.resizeSolo) {
      // Solo mode — adjust only the target column
      const newWidth = this.resizeStartWidthLeft + deltaFr;
      if (newWidth >= TopOfTheBookViewComponent.MIN_COL_FR) {
        this.columnWidths[this.resizeIndex] = Math.round(newWidth * 1000) / 1000;
        this.cdr.detectChanges();
      }
    } else {
      // Paired mode — trade width between adjacent columns
      const newLeft = this.resizeStartWidthLeft + deltaFr;
      const newRight = this.resizeStartWidthRight - deltaFr;

      if (newLeft >= TopOfTheBookViewComponent.MIN_COL_FR &&
          newRight >= TopOfTheBookViewComponent.MIN_COL_FR) {
        this.columnWidths[this.resizeIndex] = Math.round(newLeft * 1000) / 1000;
        this.columnWidths[this.resizeIndex + 1] = Math.round(newRight * 1000) / 1000;
        this.cdr.detectChanges();
      }
    }
  }

  @HostListener('document:mouseup')
  onResizeEnd(): void {
    if (this.resizing) {
      this.resizing = false;
      this.resizeSolo = false;
      this.resizeIndex = -1;
    }
  }
}
