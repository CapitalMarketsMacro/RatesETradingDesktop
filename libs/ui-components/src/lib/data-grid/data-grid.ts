import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewInit,
  signal,
  effect,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular, AgGridModule } from 'ag-grid-angular';
import { LoggerService } from '@rates-trading/logger';
import {
  ColDef,
  GridApi,
  GridOptions,
  GridReadyEvent,
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
  colorSchemeDarkBlue,
  GetRowIdParams,
  RowDataTransaction,
  StatusPanelDef,
} from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { Subject, Subscription } from 'rxjs';
import { AccordionModule } from 'primeng/accordion';

// Register ag-Grid modules
ModuleRegistry.registerModules([AllCommunityModule, AllEnterpriseModule]);

export interface RowOperation<T = any> {
  type: 'add' | 'update' | 'delete';
  data?: T;
  rowIndex?: number;
}

/**
 * High-frequency update transaction
 */
export interface HighFrequencyUpdate<T = any> {
  add?: T[];
  update?: T[];
  remove?: T[];
}

@Component({
  selector: 'lib-data-grid',
  standalone: true,
  imports: [CommonModule, AgGridModule, AccordionModule],
  templateUrl: './data-grid.html',
  styleUrl: './data-grid.css',
})
export class DataGrid<T = any> implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  private logger = inject(LoggerService).child({ component: 'DataGrid' });
  @ViewChild(AgGridAngular) agGrid!: AgGridAngular;

  @Input() columns: ColDef[] | string = [];
  @Input() rowData: T[] = [];
  @Input() gridOptions: GridOptions = {};
  @Input() height = '600px';
  @Input() theme: 'light' | 'dark' = 'light';
  
  /**
   * Field name to use as row ID for high-frequency updates.
   * Required for efficient updates using applyTransactionAsync.
   */
  @Input() rowIdField?: string;
  
  /**
   * Wait time in ms before applying async transactions (default: 50ms).
   * Lower values = more responsive but more CPU usage.
   * Higher values = better batching but more latency.
   */
  @Input() asyncTransactionWaitMillis = 50;
  
  /**
   * Enable high-frequency update mode using applyTransactionAsync.
   * When enabled, rowData changes will use async transactions for better performance.
   */
  @Input() highFrequencyMode = false;
  
  /**
   * Show the status bar at the bottom of the grid.
   * When true, displays total row count by default.
   */
  @Input() showStatusBar = false;
  
  /**
   * Custom status bar configuration.
   * If not provided and showStatusBar is true, uses default row count panel.
   */
  @Input() statusBar?: { statusPanels: StatusPanelDef[] };

  // RxJS Subjects for row operations
  addRow$ = new Subject<T>();
  updateRow$ = new Subject<{ rowIndex: number; data: T }>();
  deleteRow$ = new Subject<number>();
  
  /**
   * Subject for high-frequency updates.
   * Push updates here for efficient batched processing.
   */
  highFrequencyUpdate$ = new Subject<HighFrequencyUpdate<T>>();

  private subscriptions = new Subscription();
  private gridApi?: GridApi;
  private parsedColumns: ColDef[] = [];
  private previousRowData: T[] = [];
  private isInitialDataSet = false;
  
  /**
   * Set of known row IDs for tracking add vs update in high-frequency mode.
   * This is more reliable than querying gridApi.getRowNode() with async transactions.
   */
  private knownRowIds = new Set<string>();

  // ── Toolbar / Quick Filter state ──
  toolbarOpen = false;
  quickFilterText = '';

  // Merged grid options exposed for template binding
  mergedGridOptions: GridOptions & { suppressPaginationPanel?: boolean } = {};

  // Dynamic theme for AG Grid - switches between light and dark
  gridTheme = themeQuartz;

  // Signal for theme detection
  private themeSignal = signal<'light' | 'dark'>('light');

  constructor() {
    // Watch for theme changes
    effect(() => {
      const currentTheme = this.themeSignal();
      this.updateGridTheme(currentTheme);
    });
  }

  ngOnInit(): void {
    // Parse columns if provided as JSON string
    if (typeof this.columns === 'string') {
      try {
        this.parsedColumns = JSON.parse(this.columns);
      } catch (error) {
        this.logger.error(error as Error, 'Error parsing columns JSON');
        this.parsedColumns = [];
      }
    } else {
      this.parsedColumns = this.columns;
    }

    // Compute merged grid options
    this.mergedGridOptions = this.computeMergedGridOptions();

    // Detect initial theme
    this.detectTheme();
    this.setupThemeObserver();

    // Subscribe to row operations (synchronous)
    this.subscriptions.add(
      this.addRow$.subscribe((data) => {
        if (this.gridApi) {
          if (this.highFrequencyMode) {
            this.gridApi.applyTransactionAsync({ add: [data] });
          } else {
            this.gridApi.applyTransaction({ add: [data] });
          }
        }
      })
    );

    this.subscriptions.add(
      this.updateRow$.subscribe(({ rowIndex, data }) => {
        if (this.gridApi) {
          const rowNode = this.gridApi.getDisplayedRowAtIndex(rowIndex);
          if (rowNode) {
            Object.assign(rowNode.data, data);
            if (this.highFrequencyMode) {
              this.gridApi.applyTransactionAsync({ update: [rowNode.data] });
            } else {
              this.gridApi.applyTransaction({ update: [rowNode.data] });
            }
          }
        }
      })
    );

    this.subscriptions.add(
      this.deleteRow$.subscribe((rowIndex) => {
        if (this.gridApi) {
          const rowNode = this.gridApi.getDisplayedRowAtIndex(rowIndex);
          if (rowNode) {
            if (this.highFrequencyMode) {
              this.gridApi.applyTransactionAsync({ remove: [rowNode.data] });
            } else {
              this.gridApi.applyTransaction({ remove: [rowNode.data] });
            }
          }
        }
      })
    );
    
    // Subscribe to high-frequency updates
    this.subscriptions.add(
      this.highFrequencyUpdate$.subscribe((transaction) => {
        this.applyHighFrequencyUpdate(transaction);
      })
    );
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    // Handle rowData changes efficiently
    if (changes['rowData'] && this.gridApi && this.isInitialDataSet) {
      const newData = changes['rowData'].currentValue as T[];
      
      if (this.highFrequencyMode && this.rowIdField) {
        // Use async transactions for high-frequency updates
        this.applyRowDataDiff(newData);
      }
      // If not in high-frequency mode, ag-grid handles rowData binding automatically
    }
    
    // Re-parse columns if they change
    if (changes['columns'] && !changes['columns'].firstChange) {
      if (typeof this.columns === 'string') {
        try {
          this.parsedColumns = JSON.parse(this.columns);
        } catch (error) {
          this.logger.error(error as Error, 'Error parsing columns JSON');
        }
      } else {
        this.parsedColumns = this.columns;
      }
    }
  }

  ngAfterViewInit(): void {
    if (this.agGrid?.api) {
      this.gridApi = this.agGrid.api;
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.addRow$.complete();
    this.updateRow$.complete();
    this.deleteRow$.complete();
    this.highFrequencyUpdate$.complete();
    this.knownRowIds.clear();
  }

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    this.isInitialDataSet = true;
    
    // Store initial row data for diff calculation
    if (this.rowData) {
      this.previousRowData = [...this.rowData];
    }
  }

  private computeMergedGridOptions(): GridOptions & { suppressPaginationPanel?: boolean } {
    const defaultOptions: GridOptions = {
      theme: themeQuartz,
      pagination: true,
      paginationPageSize: 20,
      paginationPageSizeSelector: [10, 20, 50, 100],
      defaultColDef: {
        sortable: true,
        filter: true,
        resizable: true,
        flex: 1,
        minWidth: 100,
      },
      cellSelection: true,
      rowSelection: {
        mode: 'multiRow',
        enableClickSelection: false,
      },
      animateRows: true,
    };

    // Remove any invalid nested gridOptions property from user options
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { gridOptions: _nested, ...userOptions } = (this.gridOptions || {}) as GridOptions & { gridOptions?: unknown };

    // Merge user-provided options, ensuring nested objects are properly merged
    const mergedOptions: GridOptions = {
      ...defaultOptions,
      ...userOptions,
      // Deep merge for nested objects
      defaultColDef: {
        ...defaultOptions.defaultColDef,
        ...(userOptions.defaultColDef || {}),
      },
      rowSelection: userOptions.rowSelection
        ? userOptions.rowSelection
        : defaultOptions.rowSelection,
    };
    
    // Add getRowId for high-frequency updates if rowIdField is specified
    if (this.rowIdField) {
      mergedOptions.getRowId = (params: GetRowIdParams) => {
        return String(params.data[this.rowIdField!]);
      };
    }
    
    // Configure async transaction wait time for high-frequency mode
    if (this.highFrequencyMode) {
      mergedOptions.asyncTransactionWaitMillis = this.asyncTransactionWaitMillis;
    }
    
    // Configure status bar
    if (this.statusBar) {
      mergedOptions.statusBar = this.statusBar;
    } else if (this.showStatusBar) {
      // Default status bar with row count
      mergedOptions.statusBar = {
        statusPanels: [
          { statusPanel: 'agTotalRowCountComponent', align: 'left' },
          { statusPanel: 'agFilteredRowCountComponent', align: 'left' },
          { statusPanel: 'agSelectedRowCountComponent', align: 'center' },
          { statusPanel: 'agAggregationComponent', align: 'right' },
        ],
      };
    }

    // Ensure no gridOptions property exists in the final result
    if ('gridOptions' in mergedOptions) {
      delete (mergedOptions as any).gridOptions;
    }

    return mergedOptions;
  }

  getColumns(): ColDef[] {
    return this.parsedColumns;
  }

  private detectTheme(): void {
    const isDark =
      document.documentElement.classList.contains('app-dark') ||
      document.body.classList.contains('dark-theme');
    this.themeSignal.set(isDark ? 'dark' : 'light');
    this.theme = isDark ? 'dark' : 'light';
  }

  private setupThemeObserver(): void {
    // Watch for class changes on document element
    const observer = new MutationObserver(() => {
      this.detectTheme();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    // Watch for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      this.detectTheme();
    });

    // Cleanup on destroy
    this.subscriptions.add(() => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', () => {
        this.detectTheme();
      });
    });
  }

  private updateGridTheme(theme: 'light' | 'dark'): void {
    this.theme = theme;
    // Apply AG Grid theme with appropriate color scheme
    // Using themeQuartz with colorSchemeDarkBlue for dark mode
    // See: https://www.ag-grid.com/angular-data-grid/theming-colors/
    if (theme === 'dark') {
      this.gridTheme = themeQuartz.withPart(colorSchemeDarkBlue);
    } else {
      this.gridTheme = themeQuartz;
    }
  }

  @ViewChild('quickFilterInput') private quickFilterInputRef?: ElementRef<HTMLInputElement>;

  // ── Quick Filter / Accordion ──

  /** Handle PrimeNG Accordion value change */
  onAccordionToggle(value: string | number | string[] | number[] | null | undefined): void {
    const isOpen = value === 'tools' || (Array.isArray(value) && (value as (string | number)[]).includes('tools'));
    this.toolbarOpen = isOpen;
    if (isOpen) {
      // Focus the input after Angular renders the content
      setTimeout(() => this.quickFilterInputRef?.nativeElement.focus(), 50);
    } else if (this.quickFilterText) {
      // Clear filter when collapsing
      this.clearQuickFilter();
    }
  }

  /**
   * Handle Quick Filter input changes.
   * Uses AG Grid's setGridOption('quickFilterText', ...) as documented at
   * https://www.ag-grid.com/angular-data-grid/filter-quick/
   */
  onQuickFilterChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.quickFilterText = value;
    if (this.gridApi) {
      this.gridApi.setGridOption('quickFilterText', value);
    }
  }

  /** Clear the quick filter text and reset the grid filter */
  clearQuickFilter(): void {
    this.quickFilterText = '';
    if (this.gridApi) {
      this.gridApi.setGridOption('quickFilterText', '');
    }
  }

  // Public API methods
  refreshData(): void {
    if (this.gridApi) {
      this.gridApi.refreshCells();
    }
  }

  exportData(): void {
    if (this.gridApi) {
      this.gridApi.exportDataAsCsv();
    }
  }

  getSelectedRows(): T[] {
    if (this.gridApi) {
      return this.gridApi.getSelectedRows() as T[];
    }
    return [];
  }
  
  /**
   * Apply a high-frequency update using applyTransactionAsync.
   * This batches multiple updates for better performance.
   */
  applyHighFrequencyUpdate(transaction: HighFrequencyUpdate<T>): void {
    if (!this.gridApi) {
      this.logger.warn('Grid API not ready for high-frequency update');
      return;
    }
    
    const rowTransaction: RowDataTransaction = {};
    
    if (transaction.add && transaction.add.length > 0) {
      rowTransaction.add = transaction.add;
    }
    if (transaction.update && transaction.update.length > 0) {
      rowTransaction.update = transaction.update;
    }
    if (transaction.remove && transaction.remove.length > 0) {
      rowTransaction.remove = transaction.remove;
    }
    
    // Use async transaction for high-frequency updates
    this.gridApi.applyTransactionAsync(rowTransaction);
  }
  
  /**
   * Apply updates for a batch of rows (convenience method for streaming data).
   * Uses a local map to track known row IDs to correctly determine add vs update.
   */
  updateRows(rows: T[]): void {
    if (!this.gridApi) {
      this.logger.warn('Grid API not ready for updateRows');
      return;
    }
    
    if (!this.rowIdField) {
      // Without rowIdField, just add all rows
      this.gridApi.applyTransactionAsync({ add: rows });
      return;
    }
    
    const add: T[] = [];
    const update: T[] = [];
    
    for (const row of rows) {
      const rowId = String((row as Record<string, unknown>)[this.rowIdField]);
      
      if (this.knownRowIds.has(rowId)) {
        update.push(row);
      } else {
        add.push(row);
        this.knownRowIds.add(rowId);
      }
    }
    
    const transaction: RowDataTransaction = {};
    if (add.length > 0) transaction.add = add;
    if (update.length > 0) transaction.update = update;
    
    if (add.length > 0 || update.length > 0) {
      this.gridApi.applyTransactionAsync(transaction);
    }
  }
  
  /**
   * Update a single row (convenience method for streaming data).
   * Tracks row IDs to correctly add new rows or update existing ones.
   */
  updateRow(row: T): void {
    this.updateRows([row]);
  }
  
  /**
   * Remove rows by their data objects.
   */
  removeRows(rows: T[]): void {
    if (!this.gridApi) {
      this.logger.warn('Grid API not ready for removeRows');
      return;
    }
    
    // Remove from known IDs tracking
    if (this.rowIdField) {
      for (const row of rows) {
        const rowId = String((row as Record<string, unknown>)[this.rowIdField]);
        this.knownRowIds.delete(rowId);
      }
    }
    
    this.applyHighFrequencyUpdate({ remove: rows });
  }
  
  /**
   * Flush any pending async transactions immediately.
   */
  flushAsyncTransactions(): void {
    if (this.gridApi) {
      this.gridApi.flushAsyncTransactions();
    }
  }
  
  /**
   * Get the grid API for advanced operations.
   */
  getGridApi(): GridApi | undefined {
    return this.gridApi;
  }

  // ── Column State (for WorkspaceComponent integration) ──

  /**
   * Return the current AG Grid column state (widths, order, pinned, sort, etc.)
   * Useful for persisting user customizations across layout save/restore.
   */
  getColumnState(): unknown[] | null {
    if (!this.gridApi) return null;
    return this.gridApi.getColumnState();
  }

  /**
   * Apply a previously saved column state.
   * Call this after the grid is ready (e.g. in a gridReady handler or after init).
   */
  setColumnState(state: unknown[]): void {
    if (!this.gridApi || !state) return;
    this.gridApi.applyColumnState({ state: state as any, applyOrder: true });
  }
  
  /**
   * Get the current row count.
   * In high-frequency mode, this returns the count of known row IDs.
   */
  getRowCount(): number {
    if (this.highFrequencyMode && this.rowIdField) {
      return this.knownRowIds.size;
    }
    if (this.gridApi) {
      return this.gridApi.getDisplayedRowCount();
    }
    return 0;
  }
  
  /**
   * Apply diff between previous and new row data using async transactions.
   * This is used internally when rowData input changes in high-frequency mode.
   */
  private applyRowDataDiff(newData: T[]): void {
    if (!this.gridApi || !this.rowIdField) {
      return;
    }
    
    const idField = this.rowIdField;
    const previousMap = new Map<string, T>();
    const currentMap = new Map<string, T>();
    
    // Build maps for comparison
    for (const row of this.previousRowData) {
      const id = String((row as Record<string, unknown>)[idField]);
      previousMap.set(id, row);
    }
    
    for (const row of newData) {
      const id = String((row as Record<string, unknown>)[idField]);
      currentMap.set(id, row);
    }
    
    const add: T[] = [];
    const update: T[] = [];
    const remove: T[] = [];
    
    // Find additions and updates
    for (const [id, row] of currentMap) {
      if (!previousMap.has(id)) {
        add.push(row);
      } else {
        // Check if row has changed (simple reference check)
        const prevRow = previousMap.get(id);
        if (prevRow !== row) {
          update.push(row);
        }
      }
    }
    
    // Find removals
    for (const [id, row] of previousMap) {
      if (!currentMap.has(id)) {
        remove.push(row);
      }
    }
    
    // Apply the transaction
    if (add.length > 0 || update.length > 0 || remove.length > 0) {
      this.applyHighFrequencyUpdate({ add, update, remove });
    }
    
    // Update previous data reference
    this.previousRowData = [...newData];
  }
}
