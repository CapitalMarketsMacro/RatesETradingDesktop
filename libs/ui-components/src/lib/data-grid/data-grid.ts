import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  ViewChild,
  AfterViewInit,
  signal,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular, AgGridModule } from 'ag-grid-angular';
import {
  ColDef,
  GridApi,
  GridOptions,
  GridReadyEvent,
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
  colorSchemeDarkBlue,
} from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { Subject, Subscription } from 'rxjs';

// Register ag-Grid modules
ModuleRegistry.registerModules([AllCommunityModule, AllEnterpriseModule]);

export interface RowOperation<T = any> {
  type: 'add' | 'update' | 'delete';
  data?: T;
  rowIndex?: number;
}

@Component({
  selector: 'lib-data-grid',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  templateUrl: './data-grid.html',
  styleUrl: './data-grid.css',
})
export class DataGrid<T = any> implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(AgGridAngular) agGrid!: AgGridAngular;

  @Input() columns: ColDef[] | string = [];
  @Input() rowData: T[] = [];
  @Input() gridOptions: GridOptions = {};
  @Input() height = '600px';
  @Input() theme: 'light' | 'dark' = 'light';

  // RxJS Subjects for row operations
  addRow$ = new Subject<T>();
  updateRow$ = new Subject<{ rowIndex: number; data: T }>();
  deleteRow$ = new Subject<number>();

  private subscriptions = new Subscription();
  private gridApi?: GridApi;
  private parsedColumns: ColDef[] = [];

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
        console.error('Error parsing columns JSON:', error);
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

    // Subscribe to row operations
    this.subscriptions.add(
      this.addRow$.subscribe((data) => {
        if (this.gridApi) {
          this.gridApi.applyTransaction({ add: [data] });
        }
      })
    );

    this.subscriptions.add(
      this.updateRow$.subscribe(({ rowIndex, data }) => {
        if (this.gridApi) {
          const rowNode = this.gridApi.getDisplayedRowAtIndex(rowIndex);
          if (rowNode) {
            Object.assign(rowNode.data, data);
            this.gridApi.applyTransaction({ update: [rowNode.data] });
          }
        }
      })
    );

    this.subscriptions.add(
      this.deleteRow$.subscribe((rowIndex) => {
        if (this.gridApi) {
          const rowNode = this.gridApi.getDisplayedRowAtIndex(rowIndex);
          if (rowNode) {
            this.gridApi.applyTransaction({ remove: [rowNode.data] });
          }
        }
      })
    );
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
  }

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
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
}
