import { themeQuartz } from 'ag-grid-community';

/**
 * Macro-themed AG Grid theme.
 *
 * Maps Macro Design System tokens to AG Grid theme parameters so every
 * blotter inherits the same dark, dense, Cerulean-accented look as the
 * rest of the app.
 *
 * Density anchor: 22px row / 26px header / 12px body / 11px in-grid numbers.
 * Fonts: Roboto (sans) + IBM Plex Mono (mono, tabular nums) for numeric cells
 * via the `.ag-cell-num` class on numeric columns.
 */
export const macroGridTheme = themeQuartz.withParams({
  // Surfaces
  backgroundColor: '#12141a',         // --bg-grid-row (slate-900)
  foregroundColor: '#e6e8ec',         // --fg-1
  oddRowBackgroundColor: '#181b22',   // --bg-grid-alt (slate-850)
  rowHoverColor: '#22262f',           // --bg-grid-hover
  selectedRowBackgroundColor: '#1a2a3f', // --bg-grid-selected

  // Header
  headerBackgroundColor: '#181b22',   // --bg-panel
  headerTextColor: '#6f7687',         // --fg-3
  headerFontWeight: 500,
  headerFontSize: 10,
  headerColumnResizeHandleColor: '#2aa6e6',  // --brand (Cerulean)
  headerColumnBorder: false,

  // Borders
  borderColor: '#2a2f39',             // --border-1
  rowBorder: { color: '#1c2029', width: 1 },  // --border-grid (barely visible)

  // Brand accents
  accentColor: '#2aa6e6',             // --brand
  rangeSelectionBackgroundColor: 'rgba(42, 166, 230, 0.14)', // --brand-soft
  rangeSelectionBorderColor: '#2aa6e6',
  chromeBackgroundColor: '#1e222a',   // --bg-raised

  // Density — Macro 22px row / 26px header
  fontSize: 12,
  rowHeight: 22,
  headerHeight: 26,
  cellHorizontalPadding: 8,
  spacing: 4,

  // Typography
  fontFamily: '"Roboto", system-ui, -apple-system, "Segoe UI", sans-serif',

  // Focus ring — Cerulean
  focusShadow: '0 0 0 2px rgba(42, 166, 230, 0.4)',

  // Input / control
  inputBackgroundColor: '#0b0d12',    // --bg-app
  inputBorder: { color: '#363c48', width: 1 }, // --border-2
  inputFocusBorder: { color: '#2aa6e6', width: 1 },
  inputTextColor: '#e6e8ec',

  // Menu / popover (filter menus, column menu, etc.)
  menuBackgroundColor: '#1e222a',     // --bg-raised
  menuBorder: { color: '#363c48', width: 1 },
  menuTextColor: '#e6e8ec',
  menuShadow: { radius: 32, spread: 0, offsetY: 12, color: 'rgba(0,0,0,0.55)' },

  // Tooltip
  tooltipBackgroundColor: '#1e222a',
  tooltipTextColor: '#e6e8ec',
  tooltipBorder: { color: '#363c48', width: 1 },
});
