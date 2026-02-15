import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  inject,
  ChangeDetectorRef,
  NgZone,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import {
  AngularSlickgridModule,
  AngularGridInstance,
  Filters,
  OperatorType,
  type Column,
  type Formatter,
  type GridOption,
} from 'angular-slickgrid';
import { RemoteLoggerService } from '@rates-trading/logger';
import { wsconnect, type NatsConnection } from '@nats-io/nats-core';

/**
 * Parsed log entry from the remote logger NATS topic.
 */
interface LogEntry {
  /** SlickGrid row id */
  id: number;
  ts: string;
  /** Numeric timestamp for sorting */
  tsEpoch: number;
  level: number;
  levelName: string;
  msg: string;
  logger: string;
  data: string;
  mode: string;
  env: string;
}

// ── Custom Formatters ───────────────────────────────────

/** Format ISO timestamp to HH:mm:ss.SSS */
const timeFormatter: Formatter = (_row, _cell, _value, _colDef, dataContext: LogEntry) => {
  try {
    const d = new Date(dataContext.ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss}.${ms}`;
  } catch {
    return dataContext.ts;
  }
};

/** Render a colored level badge */
const levelFormatter: Formatter = (_row, _cell, _value, _colDef, dataContext: LogEntry) => {
  const name = dataContext.levelName;
  const colors: Record<string, { bg: string; fg: string }> = {
    trace: { bg: '#1e293b', fg: '#64748b' },
    debug: { bg: '#1e293b', fg: '#94a3b8' },
    info:  { bg: '#0c4a6e', fg: '#7dd3fc' },
    warn:  { bg: '#713f12', fg: '#fbbf24' },
    error: { bg: '#7f1d1d', fg: '#fca5a5' },
    fatal: { bg: '#991b1b', fg: '#ffffff' },
  };
  const c = colors[name] ?? colors['info'];
  return `<span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:700;letter-spacing:0.5px;background:${c.bg};color:${c.fg}">${name.toUpperCase()}</span>`;
};

/** Render a colored mode badge */
const modeFormatter: Formatter = (_row, _cell, value) => {
  const mode = (value as string) || '';
  if (!mode) return '';
  const colors: Record<string, { bg: string; fg: string }> = {
    platform:  { bg: '#312e81', fg: '#a5b4fc' },
    container: { bg: '#064e3b', fg: '#6ee7b7' },
    web:       { bg: '#1e3a5f', fg: '#7dd3fc' },
    browser:   { bg: '#3b3b3b', fg: '#a0a0a0' },
  };
  const c = colors[mode] ?? colors['browser'];
  return `<span style="display:inline-block;padding:1px 5px;border-radius:3px;font-size:10px;font-weight:600;background:${c.bg};color:${c.fg}">${mode}</span>`;
};

/** Logger name styled */
const loggerFormatter: Formatter = (_row, _cell, value) => {
  return `<span style="color:#818cf8">${value ?? ''}</span>`;
};

/**
 * RemoteLoggerViewerComponent
 *
 * Live log viewer powered by angular-slickgrid for high performance
 * virtual scrolling. Subscribes to the NATS log topic and displays
 * incoming entries in real time with sorting and column filtering.
 */
@Component({
  selector: 'app-remote-logger-viewer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TooltipModule,
    AngularSlickgridModule,
  ],
  templateUrl: './remote-logger-viewer.component.html',
  styleUrl: './remote-logger-viewer.component.css',
})
export class RemoteLoggerViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  private remoteLoggerService = inject(RemoteLoggerService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  @ViewChild('gridWrapper', { static: true }) gridWrapperRef!: ElementRef<HTMLDivElement>;

  /** SlickGrid instance ref */
  angularGrid!: AngularGridInstance;

  /** Column definitions */
  columnDefinitions: Column[] = [];

  /** Grid options */
  gridOptions: GridOption = {};

  /** Dataset bound to the grid */
  dataset: LogEntry[] = [];

  /** Auto-incrementing row id */
  private nextId = 0;

  /** Max entries to keep */
  private static readonly MAX_ENTRIES = 10000;

  /** Connection state */
  connected = false;
  connecting = false;
  errorMessage: string | null = null;

  /** Pause state */
  paused = false;
  pauseBuffer: LogEntry[] = [];

  /** Stats */
  totalReceived = 0;
  displayedCount = 0;

  private connection: NatsConnection | null = null;
  private resizeObserver: ResizeObserver | null = null;

  ngOnInit(): void {
    this.prepareGrid();
    this.connectToNats();
  }

  ngAfterViewInit(): void {
    // Use ResizeObserver to watch the grid wrapper's actual pixel size
    // and trigger SlickGrid resize whenever it changes.
    this.resizeObserver = new ResizeObserver(() => {
      this.resizeGrid();
    });
    this.resizeObserver.observe(this.gridWrapperRef.nativeElement);

    // Also trigger an initial resize after a small delay for flex layout to settle
    setTimeout(() => this.resizeGrid(), 100);
    setTimeout(() => this.resizeGrid(), 500);
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  /** Called when angular-slickgrid is ready */
  angularGridReady(event: CustomEvent<AngularGridInstance>): void {
    this.angularGrid = event.detail;

    // Trigger resize once the grid is ready so it picks up the container's actual size
    setTimeout(() => this.resizeGrid(), 50);
  }

  /** Manually resize the grid to fit the wrapper element's actual pixel size */
  private resizeGrid(): void {
    const wrapper = this.gridWrapperRef?.nativeElement;
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);

    if (width <= 0 || height <= 0) return;

    // Find the slickgrid container element inside the wrapper and set its dimensions
    const gridContainer = wrapper.querySelector('.slickgrid-container') as HTMLElement;
    if (gridContainer) {
      gridContainer.style.width = `${width}px`;
      gridContainer.style.height = `${height}px`;
    }

    // Tell SlickGrid to recalculate its viewport
    if (this.angularGrid?.slickGrid) {
      this.angularGrid.slickGrid.resizeCanvas();
    }
  }

  /** Set up column definitions and grid options */
  private prepareGrid(): void {
    this.columnDefinitions = [
      {
        id: 'tsEpoch',
        name: 'Time',
        field: 'tsEpoch',
        sortable: true,
        width: 100,
        minWidth: 80,
        formatter: timeFormatter,
        filterable: false,
      },
      {
        id: 'levelName',
        name: 'Level',
        field: 'levelName',
        sortable: true,
        width: 70,
        minWidth: 60,
        formatter: levelFormatter,
        filterable: true,
        filter: {
          model: Filters['singleSelect'],
          collection: [
            { value: '', label: 'All' },
            { value: 'trace', label: 'Trace' },
            { value: 'debug', label: 'Debug' },
            { value: 'info', label: 'Info' },
            { value: 'warn', label: 'Warn' },
            { value: 'error', label: 'Error' },
            { value: 'fatal', label: 'Fatal' },
          ],
        },
      },
      {
        id: 'mode',
        name: 'Mode',
        field: 'mode',
        sortable: true,
        width: 80,
        minWidth: 60,
        formatter: modeFormatter,
        filterable: true,
        filter: {
          model: Filters['singleSelect'],
          collection: [
            { value: '', label: 'All' },
            { value: 'platform', label: 'Platform' },
            { value: 'container', label: 'Container' },
            { value: 'web', label: 'Web' },
            { value: 'browser', label: 'Browser' },
          ],
        },
      },
      {
        id: 'logger',
        name: 'Logger',
        field: 'logger',
        sortable: true,
        width: 130,
        minWidth: 80,
        formatter: loggerFormatter,
        filterable: true,
        filter: { model: Filters['compoundInputText'] },
      },
      {
        id: 'msg',
        name: 'Message',
        field: 'msg',
        sortable: false,
        minWidth: 250,
        filterable: true,
        filter: {
          model: Filters['compoundInputText'],
          operator: OperatorType.contains,
        },
      },
      {
        id: 'data',
        name: 'Data',
        field: 'data',
        sortable: false,
        width: 200,
        minWidth: 100,
        filterable: true,
        filter: {
          model: Filters['compoundInputText'],
          operator: OperatorType.contains,
        },
        cssClass: 'log-data-cell',
      },
      {
        id: 'env',
        name: 'Env',
        field: 'env',
        sortable: true,
        width: 60,
        minWidth: 50,
        filterable: true,
        filter: {
          model: Filters['singleSelect'],
          collection: [
            { value: '', label: 'All' },
            { value: 'dev', label: 'Dev' },
            { value: 'staging', label: 'Staging' },
            { value: 'prod', label: 'Prod' },
          ],
        },
      },
    ];

    this.gridOptions = {
      // Disable autoResize — we manually manage grid dimensions via ResizeObserver
      enableAutoResize: false,
      gridHeight: 400,   // initial fallback, overridden by resizeGrid()
      gridWidth: 800,    // initial fallback, overridden by resizeGrid()
      enableCellNavigation: true,
      enableColumnReorder: true,
      enableSorting: true,
      enableFiltering: true,
      enableTextSelectionOnCells: true,
      rowHeight: 26,
      headerRowHeight: 35,
      darkMode: true,
      forceFitColumns: true,
      showHeaderRow: true,
      enableGridMenu: false,
      enableColumnPicker: false,
      sanitizer: (html: string) => html,
      // Default sort: newest first (reverse chronological)
      presets: {
        sorters: [{ columnId: 'tsEpoch', direction: 'DESC' }],
      },
    };
  }

  /**
   * Connect to NATS and subscribe to the log topic.
   */
  async connectToNats(): Promise<void> {
    const natsUrl = this.remoteLoggerService.natsUrl;
    const topic = this.remoteLoggerService.topic;

    if (!natsUrl || !topic) {
      this.errorMessage = 'Remote logger not configured — enable it in config and reload';
      this.cdr.detectChanges();
      return;
    }

    this.connecting = true;
    this.errorMessage = null;
    this.cdr.detectChanges();

    try {
      this.connection = await wsconnect({
        servers: [natsUrl],
        name: `log-viewer-${Date.now()}`,
        reconnect: true,
        maxReconnectAttempts: -1,
        reconnectTimeWait: 3000,
      });

      this.connected = true;
      this.connecting = false;
      this.cdr.detectChanges();

      // Subscribe and process messages
      const sub = this.connection.subscribe(topic);
      (async () => {
        for await (const msg of sub) {
          try {
            const raw = msg.json<Record<string, unknown>>();
            const entry = this.parseLogEntry(raw);
            this.ngZone.run(() => this.onLogReceived(entry));
          } catch {
            // skip malformed
          }
        }
      })();

      // Monitor connection status
      (async () => {
        if (!this.connection) return;
        for await (const status of this.connection.status()) {
          this.ngZone.run(() => {
            if (status.type === 'disconnect') {
              this.connected = false;
              this.cdr.detectChanges();
            } else if (status.type === 'reconnect') {
              this.connected = true;
              this.cdr.detectChanges();
            }
          });
        }
      })();
    } catch (err) {
      this.connecting = false;
      this.connected = false;
      this.errorMessage = `Failed to connect to NATS at ${natsUrl}: ${err}`;
      this.cdr.detectChanges();
    }
  }

  /** Disconnect from NATS */
  async disconnect(): Promise<void> {
    if (this.connection) {
      try { await this.connection.drain(); } catch { /* */ }
      this.connection = null;
    }
    this.connected = false;
  }

  /** Parse a raw log JSON object into a grid-friendly LogEntry */
  private parseLogEntry(raw: Record<string, unknown>): LogEntry {
    const meta = (raw['meta'] ?? {}) as Record<string, unknown>;
    const data = (raw['data'] as Record<string, unknown>) ?? {};
    const ts = (raw['ts'] as string) ?? new Date().toISOString();

    return {
      id: this.nextId++,
      ts,
      tsEpoch: new Date(ts).getTime(),
      level: (raw['level'] as number) ?? 30,
      levelName: (raw['levelName'] as string) ?? 'info',
      msg: (raw['msg'] as string) ?? '',
      logger: (raw['logger'] as string) ?? '',
      data: Object.keys(data).length > 0 ? JSON.stringify(data) : '',
      mode: (meta['mode'] as string) ?? '',
      env: (meta['env'] as string) ?? '',
    };
  }

  /** Handle a received log entry */
  private onLogReceived(entry: LogEntry): void {
    this.totalReceived++;

    if (this.paused) {
      this.pauseBuffer.push(entry);
      this.cdr.detectChanges();
      return;
    }

    this.addEntryToGrid(entry);
  }

  /** Add a single entry to the grid */
  private addEntryToGrid(entry: LogEntry): void {
    this.dataset = [...this.dataset, entry];

    // Trim if over limit (remove oldest)
    if (this.dataset.length > RemoteLoggerViewerComponent.MAX_ENTRIES) {
      const excess = this.dataset.length - RemoteLoggerViewerComponent.MAX_ENTRIES;
      this.dataset = this.dataset.slice(excess);
    }

    this.displayedCount = this.dataset.length;

    // Scroll to top and select newest row (row 0 in DESC sort)
    if (this.angularGrid?.slickGrid) {
      const grid = this.angularGrid.slickGrid;
      setTimeout(() => {
        grid.scrollRowToTop(0);
        grid.setSelectedRows([0]);
      }, 0);
    }

    this.cdr.detectChanges();
  }

  /** Toggle pause */
  togglePause(): void {
    this.paused = !this.paused;

    if (!this.paused && this.pauseBuffer.length > 0) {
      // Merge buffered entries
      this.dataset = [...this.dataset, ...this.pauseBuffer];
      this.pauseBuffer = [];

      if (this.dataset.length > RemoteLoggerViewerComponent.MAX_ENTRIES) {
        const excess = this.dataset.length - RemoteLoggerViewerComponent.MAX_ENTRIES;
        this.dataset = this.dataset.slice(excess);
      }

      this.displayedCount = this.dataset.length;

      // Scroll to top and select newest row (row 0 in DESC sort)
      if (this.angularGrid?.slickGrid) {
        const grid = this.angularGrid.slickGrid;
        setTimeout(() => {
          grid.scrollRowToTop(0);
          grid.setSelectedRows([0]);
        }, 0);
      }

      this.cdr.detectChanges();
    }
  }

  /** Clear all logs */
  clearLogs(): void {
    this.dataset = [];
    this.pauseBuffer = [];
    this.displayedCount = 0;
    this.cdr.detectChanges();
  }
}
