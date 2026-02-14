import { Injectable, inject, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription as RxSubscription, filter, take } from 'rxjs';
import {
  TRANSPORT_SERVICE,
  Subscription as TransportSubscription,
  ConnectionStatus,
} from '@rates-trading/transports';
import { ConfigurationService } from '@rates-trading/configuration';
import { LoggerService } from '@rates-trading/logger';
import {
  MarketData,
  MarketDataGridRow,
  transformMarketDataToGridRow,
} from '@rates-trading/data-access';

/**
 * MarketDataService
 *
 * Centralised service that subscribes to the AMPS `rates/marketData` topic
 * once and multicasts updates to all consumers (Top of the Book, Market Data
 * Blotter, etc.).
 *
 * The service:
 *  - Waits for the injected transport (AMPS) to be connected.
 *  - Subscribes to the configured market-data topic.
 *  - Maintains an in-memory `Map<Id, MarketDataGridRow>` for efficient upserts.
 *  - Exposes an `Observable<MarketDataGridRow>` that emits every individual row update.
 *  - Exposes an `Observable<MarketDataGridRow[]>` that emits the full snapshot array.
 *  - Cleans up subscription on destroy.
 */
@Injectable({ providedIn: 'root' })
export class MarketDataService implements OnDestroy {
  private transport = inject(TRANSPORT_SERVICE);
  private configService = inject(ConfigurationService);
  private logger = inject(LoggerService).child({ component: 'MarketDataService' });
  private ngZone = inject(NgZone);

  /** Internal transport subscription handle */
  private marketDataSub?: TransportSubscription;

  /** RxJS subscription used while waiting for connection */
  private connectionSub?: RxSubscription;

  /** Map of Id → latest grid row (single source of truth) */
  private dataMap = new Map<string, MarketDataGridRow>();

  /** Emits individual row updates (for high-frequency grid patching) */
  private rowUpdateSubject = new Subject<MarketDataGridRow>();
  readonly rowUpdate$: Observable<MarketDataGridRow> = this.rowUpdateSubject.asObservable();

  /** Emits the full snapshot array whenever any row is updated */
  private snapshotSubject = new BehaviorSubject<MarketDataGridRow[]>([]);
  readonly snapshot$: Observable<MarketDataGridRow[]> = this.snapshotSubject.asObservable();

  /** Whether we've already kicked off subscription logic */
  private subscribed = false;

  /**
   * Call this to ensure the service is subscribed.
   * Safe to call multiple times — only the first call takes effect.
   */
  connect(): void {
    if (this.subscribed) return;
    this.subscribed = true;

    if (this.transport.isConnected()) {
      this.subscribeToMarketData();
    } else {
      // Wait for transport to become connected
      this.connectionSub = this.transport.connectionStatus$
        .pipe(
          filter((s) => s === ConnectionStatus.Connected),
          take(1),
        )
        .subscribe(() => this.subscribeToMarketData());
    }
  }

  ngOnDestroy(): void {
    this.connectionSub?.unsubscribe();
    this.unsubscribe();
  }

  /** Look up a single row by Id */
  getRow(id: string): MarketDataGridRow | undefined {
    return this.dataMap.get(id);
  }

  /** Current full snapshot (synchronous) */
  getSnapshot(): MarketDataGridRow[] {
    return Array.from(this.dataMap.values());
  }

  // ── Private ────────────────────────────────────────────

  private async subscribeToMarketData(): Promise<void> {
    const config = this.configService.getConfiguration();
    const topic = config?.ampsTopics?.marketData || 'rates/marketData';

    try {
      this.marketDataSub = await this.transport.subscribe<MarketData>(
        topic,
        (message) => this.handleMessage(message.data),
      );
      this.logger.info({ topic }, 'Subscribed to market data via AMPS');
    } catch (error) {
      this.logger.error(error as Error, `Failed to subscribe to ${topic}`);
    }
  }

  private handleMessage(data: MarketData): void {
    if (!data?.Id) return;

    const gridRow = transformMarketDataToGridRow(data);

    // Run inside Angular zone so consumers using async pipe / detectChanges
    // are notified properly.
    this.ngZone.run(() => {
      this.dataMap.set(data.Id, gridRow);
      this.rowUpdateSubject.next(gridRow);
      this.snapshotSubject.next(Array.from(this.dataMap.values()));
    });
  }

  private async unsubscribe(): Promise<void> {
    if (this.marketDataSub) {
      await this.marketDataSub.unsubscribe();
      this.marketDataSub = undefined;
    }
  }
}
