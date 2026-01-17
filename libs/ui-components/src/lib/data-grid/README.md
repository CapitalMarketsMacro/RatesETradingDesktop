# Data Grid Component

A standalone Angular component wrapper for ag-Grid Enterprise with automatic theme switching, RxJS Subjects for row operations, and TypeScript type safety.

## Features

- ✅ **ag-Grid Enterprise** - Full Enterprise features enabled
- ✅ **JSON Column Configuration** - Support for JSON string or TypeScript array column definitions
- ✅ **Automatic Theme Switching** - Detects and responds to light/dark theme changes
- ✅ **RxJS Subjects** - Reactive row operations (add, update, delete)
- ✅ **Default Grid Options** - Pagination, sorting, filtering enabled by default
- ✅ **TypeScript Type Safety** - Fully typed with generics
- ✅ **Standalone Component** - No NgModule required

## Installation

The component is part of the `@rates-trading/ui-components` library. ag-Grid Enterprise and ag-Charts are already installed as dependencies.

## Usage

### Basic Usage

```typescript
import { Component } from '@angular/core';
import { DataGrid, ColDef } from '@rates-trading/ui-components';

@Component({
  selector: 'app-example',
  standalone: true,
  imports: [DataGrid],
  template: `
    <lib-data-grid
      [columns]="columns"
      [rowData]="rowData"
      height="500px">
    </lib-data-grid>
  `
})
export class ExampleComponent {
  columns: ColDef[] = [
    { field: 'id', headerName: 'ID' },
    { field: 'name', headerName: 'Name' },
    { field: 'value', headerName: 'Value' }
  ];

  rowData = [
    { id: 1, name: 'Item 1', value: 100 },
    { id: 2, name: 'Item 2', value: 200 }
  ];
}
```

### JSON Column Configuration

```typescript
@Component({
  template: `
    <lib-data-grid
      [columns]="columnJson"
      [rowData]="rowData">
    </lib-data-grid>
  `
})
export class ExampleComponent {
  // Columns as JSON string
  columnJson = JSON.stringify([
    { field: 'symbol', headerName: 'Symbol' },
    { field: 'price', headerName: 'Price', type: 'numericColumn' },
    { field: 'volume', headerName: 'Volume' }
  ]);

  rowData = [
    { symbol: 'AAPL', price: 150.25, volume: 1000000 },
    { symbol: 'GOOGL', price: 2500.50, volume: 500000 }
  ];
}
```

### Using RxJS Subjects for Row Operations

```typescript
import { Component, ViewChild } from '@angular/core';
import { DataGrid } from '@rates-trading/ui-components';

@Component({
  template: `
    <lib-data-grid
      #grid
      [columns]="columns"
      [rowData]="rowData">
    </lib-data-grid>
    <button (click)="addRow()">Add Row</button>
    <button (click)="updateRow()">Update Row</button>
    <button (click)="deleteRow()">Delete Row</button>
  `
})
export class ExampleComponent {
  @ViewChild('grid') grid!: DataGrid;

  columns = [
    { field: 'id', headerName: 'ID' },
    { field: 'name', headerName: 'Name' }
  ];

  rowData = [
    { id: 1, name: 'Item 1' }
  ];

  addRow() {
    this.grid.addRow$.next({ id: 2, name: 'Item 2' });
  }

  updateRow() {
    this.grid.updateRow$.next({ rowIndex: 0, data: { id: 1, name: 'Updated Item' } });
  }

  deleteRow() {
    this.grid.deleteRow$.next(0);
  }
}
```

### Custom Grid Options

```typescript
@Component({
  template: `
    <lib-data-grid
      [columns]="columns"
      [rowData]="rowData"
      [gridOptions]="customOptions">
    </lib-data-grid>
  `
})
export class ExampleComponent {
  columns = [
    { field: 'id', headerName: 'ID' },
    { field: 'name', headerName: 'Name' }
  ];

  rowData = [
    { id: 1, name: 'Item 1' }
  ];

  customOptions = {
    pagination: true,
    paginationPageSize: 50,
    rowSelection: 'single',
    enableRangeSelection: true
  };
}
```

### Theme Support

The component automatically detects theme changes:
- Monitors `app-dark` class on `document.documentElement`
- Monitors `dark-theme` class on `document.body`
- Responds to system preference changes
- Automatically switches between `ag-theme-quartz` and `ag-theme-quartz-dark`

## API

### Inputs

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `columns` | `ColDef[] \| string` | `[]` | Column definitions (array or JSON string) |
| `rowData` | `T[]` | `[]` | Row data array |
| `gridOptions` | `GridOptions` | `{}` | Additional grid options (merged with defaults) |
| `height` | `string` | `'600px'` | Grid container height |
| `theme` | `'light' \| 'dark'` | `'light'` | Manual theme override |

### Outputs

| Property | Type | Description |
|----------|------|-------------|
| `addRow$` | `Subject<T>` | RxJS Subject for adding rows |
| `updateRow$` | `Subject<{rowIndex: number, data: T}>` | RxJS Subject for updating rows |
| `deleteRow$` | `Subject<number>` | RxJS Subject for deleting rows |

### Methods

| Method | Description |
|--------|-------------|
| `refreshData()` | Refreshes grid cells |
| `exportData()` | Exports data as CSV |
| `getSelectedRows()` | Returns selected rows |

## Default Grid Options

The component includes sensible defaults:
- Pagination enabled (20 rows per page)
- Page size selector: [10, 20, 50, 100]
- Sorting enabled on all columns
- Filtering enabled on all columns
- Column resizing enabled
- Range selection enabled
- Multiple row selection
- Row animations enabled

## TypeScript Generics

The component supports TypeScript generics for type safety:

```typescript
interface MyRowType {
  id: number;
  name: string;
  value: number;
}

@Component({
  template: `<lib-data-grid<MyRowType> [columns]="columns" [rowData]="rowData"></lib-data-grid>`
})
export class TypedExampleComponent {
  columns: ColDef[] = [
    { field: 'id', headerName: 'ID' },
    { field: 'name', headerName: 'Name' },
    { field: 'value', headerName: 'Value' }
  ];

  rowData: MyRowType[] = [
    { id: 1, name: 'Item 1', value: 100 }
  ];
}
```

## References

- [ag-Grid Documentation](https://www.ag-grid.com/)
- [ag-Grid Angular Documentation](https://www.ag-grid.com/angular-data-grid/)
- [ag-Grid Enterprise Features](https://www.ag-grid.com/enterprise/)
