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
  Execution,
  ExecutionGridRow,
  transformExecutionToGridRow,
} from '../models';

/**
 * ExecutionService
 *
 * Centralised service that subscribes to the AMPS `rates/executions` topic
 * once and multicasts updates to all consumers (Executions Blotter, etc.).
 *
 * The service:
 *  - Waits for the injected transport (AMPS) to be connected.
 *  - Uses sowAndSubscribe to get the full SOW snapshot first, then live updates.
 *  - Falls back to plain subscribe for non-AMPS transports.
 *  - Maintains an in-memory `Map<ExecutionIdString, ExecutionGridRow>` for efficient upserts.
 *  - Exposes an `Observable<ExecutionGridRow>` that emits every individual row update.
 *  - Exposes an `Observable<ExecutionGridRow[]>` that emits the full snapshot array.
 *  - Cleans up subscription on destroy.
 */
@Injectable({ providedIn: 'root' })
export class ExecutionService implements OnDestroy {
  private transport = inject(TRANSPORT_SERVICE);
  private configService = inject(ConfigurationService);
  private logger = inject(LoggerService).child({ component: 'ExecutionService' });
  private ngZone = inject(NgZone);

  /** Internal transport subscription handle */
  private executionSub?: TransportSubscription;

  /** RxJS subscription used while waiting for connection */
  private connectionSub?: RxSubscription;

  /** Map of ExecutionIdString → latest grid row (single source of truth) */
  private dataMap = new Map<string, ExecutionGridRow>();

  /** Emits individual row updates (for high-frequency grid patching) */
  private rowUpdateSubject = new Subject<ExecutionGridRow>();
  readonly rowUpdate$: Observable<ExecutionGridRow> = this.rowUpdateSubject.asObservable();

  /** Emits the full snapshot array whenever any row is updated */
  private snapshotSubject = new BehaviorSubject<ExecutionGridRow[]>([]);
  readonly snapshot$: Observable<ExecutionGridRow[]> = this.snapshotSubject.asObservable();

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
      this.subscribeToExecutions();
    } else {
      // Wait for transport to become connected
      this.connectionSub = this.transport.connectionStatus$
        .pipe(
          filter((s) => s === ConnectionStatus.Connected),
          take(1),
        )
        .subscribe(() => this.subscribeToExecutions());
    }
  }

  ngOnDestroy(): void {
    this.connectionSub?.unsubscribe();
    this.unsubscribe();
  }

  /** Look up a single execution by ExecutionIdString */
  getRow(id: string): ExecutionGridRow | undefined {
    return this.dataMap.get(id);
  }

  /** Current full snapshot (synchronous) */
  getSnapshot(): ExecutionGridRow[] {
    return Array.from(this.dataMap.values());
  }

  // ── Private ────────────────────────────────────────────

  private async subscribeToExecutions(): Promise<void> {
    const config = this.configService.getConfiguration();
    const topic = config?.ampsTopics?.executions || 'rates/executions';

    try {
      // Prefer sowAndSubscribe (AMPS) — delivers all existing executions first,
      // then streams live fills through the same callback.
      if (this.transport.sowAndSubscribe) {
        this.executionSub = await this.transport.sowAndSubscribe<Execution>(
          topic,
          (message) => this.handleMessage(message.data),
        );
        this.logger.info({ topic }, 'SOW and subscribed to executions');
      } else {
        // Fallback for transports that don't support SOW (NATS, Solace, etc.)
        this.executionSub = await this.transport.subscribe<Execution>(
          topic,
          (message) => this.handleMessage(message.data),
        );
        this.logger.info({ topic }, 'Subscribed to executions (no SOW)');
      }
    } catch (error) {
      this.logger.error(error as Error, `Failed to subscribe to ${topic}`);
    }
  }

  private handleMessage(data: Execution): void {
    if (!data?.ExecutionIdString) return;

    const gridRow = transformExecutionToGridRow(data);

    // Run inside Angular zone so consumers using async pipe / detectChanges
    // are notified properly.
    this.ngZone.run(() => {
      this.dataMap.set(data.ExecutionIdString, gridRow);
      this.rowUpdateSubject.next(gridRow);
      this.snapshotSubject.next(Array.from(this.dataMap.values()));
    });
  }

  private async unsubscribe(): Promise<void> {
    if (this.executionSub) {
      await this.executionSub.unsubscribe();
      this.executionSub = undefined;
    }
  }
}
