# CLAUDE.md - Rates E-Trading Desktop

## Project Overview

NX 22.4 monorepo for a **real-time Rates E-Trading desktop application**. Built with Angular 21, OpenFin desktop containerization, and multi-transport messaging (AMPS, Solace, NATS). Displays live US Treasury market data (2Y-30Y), execution blotters, and supports multi-window layouts.

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm start` | Serve rates-desktop on http://localhost:4200 |
| `npm run build` | Build rates-desktop |
| `npm test` | Unit tests (Vitest) for rates-desktop |
| `npm run lint` | Lint rates-desktop |
| `npm run e2e` | Playwright E2E tests |
| `npm run openfin:launch` | Launch in OpenFin container (dev server must be running) |
| `npm run openfin:launch:platform` | Launch in OpenFin platform mode |
| `npm run openfin:start` | Serve + launch in OpenFin container |
| `npm run openfin:start:platform` | Serve + launch in OpenFin platform mode |
| `npm run test:all` | Test all projects |
| `npm run lint:all` | Lint all projects |
| `npm run build:all` | Build all projects |

## Repository Structure

```
RatesETradingDesktop/
├── apps/
│   ├── rates-desktop/                # Main Angular application (:4200)
│   │   ├── src/app/
│   │   │   ├── app.ts               # Root component (menubar, layout, OpenFin init)
│   │   │   ├── app.config.ts        # Providers (PrimeNG, transport, config loader)
│   │   │   ├── app.routes.ts        # Route definitions
│   │   │   ├── d2d/                  # Dealer-to-dealer trading views
│   │   │   │   ├── components/
│   │   │   │   │   ├── market-data-blotter/       # AG Grid market data
│   │   │   │   │   ├── top-of-the-book-view/      # CSS Grid bid/ask view
│   │   │   │   │   ├── executions-blotter/         # AG Grid executions
│   │   │   │   │   ├── remote-logger-viewer/       # SlickGrid NATS log viewer
│   │   │   │   │   └── status-bar/                 # Connection status bar
│   │   │   │   ├── services/
│   │   │   │   │   ├── market-data.service.ts      # MarketDataService (singleton)
│   │   │   │   │   └── execution.service.ts        # ExecutionService (singleton)
│   │   │   │   └── models/
│   │   │   │       └── execution.ts                # Execution, ExecutionGridRow
│   │   │   └── d2c/                  # Dealer-to-customer views (future)
│   │   └── public/assets/
│   │       ├── config-dev.json       # Dev environment config
│   │       ├── config-staging.json   # Staging environment config
│   │       ├── config-prod.json      # Production environment config
│   │       └── openfin/              # OpenFin manifests & layout files
│   │           ├── app.fin.json              # Container mode manifest
│   │           ├── app.platform.fin.json     # Platform mode manifest
│   │           ├── default.layout.fin.json   # Default GoldenLayout
│   │           ├── provider.html             # Platform provider (fin.Platform.init)
│   │           └── iframe-broker.html        # Core-web iframe broker
│   ├── rates-desktop-e2e/            # Playwright E2E tests
│   └── rates-desktop-mcp/            # Custom MCP server for scaffolding
├── libs/
│   ├── configuration/                # @rates-trading/configuration
│   ├── data-access/                  # @rates-trading/data-access
│   ├── logger/                       # @rates-trading/logger (Pino + NATS remote)
│   ├── transports/                   # @rates-trading/transports (AMPS/Solace/NATS)
│   ├── openfin/                      # @rates-trading/openfin (desktop integration)
│   ├── shared-utils/                 # @rates-trading/shared-utils (formatters, state)
│   └── ui-components/                # @rates-trading/ui-components (DataGrid, RateCard)
├── tsconfig.base.json                # Path aliases: @rates-trading/*
├── nx.json                           # NX config (defaultBase: master)
├── sonar-project.properties          # SonarQube analysis config
└── package.json                      # Scripts and dependencies
```

## Critical Architecture Rules

### Path Aliases

All shared libraries are imported via `@rates-trading/*` (defined in `tsconfig.base.json`):

```typescript
import { ConfigurationService, RatesAppConfiguration } from '@rates-trading/configuration';
import { RatesData, MarketData, MarketDataGridRow } from '@rates-trading/data-access';
import { LoggerService, RemoteLoggerService } from '@rates-trading/logger';
import { ITransportService, TRANSPORT_SERVICE } from '@rates-trading/transports';
import { OpenFinService } from '@rates-trading/openfin';
import { PriceFormatters, WorkspaceComponent, WorkspaceStorageService } from '@rates-trading/shared-utils';
import { DataGrid, RateCard, ColDef } from '@rates-trading/ui-components';
```

### Angular Conventions

- **All components are standalone** (`standalone: true`)
- **Zoneful** with `provideZoneChangeDetection({ eventCoalescing: true })` -- NOT zoneless
- **PrimeNG 21** with Nora preset (customized blue primary)
- **Dark mode selector**: `.app-dark` (NOT `.dark` -- different from the Macro repo)
- **APP_INITIALIZER** loads config before app bootstraps via `ConfigurationService.loadConfiguration()`
- Component files: `.ts` (class), `.html` (template), `.css` (styles)
- Use `inject()` function for DI
- `angular-slickgrid` with `ngx-translate` (required by slickgrid internals) for log viewer
- Root component selector: `app-root`

### OpenFin Runtime Modes

The app supports 4 runtime environments, detected automatically by `OpenFinService`:

| Mode | Description | View Mechanism |
|------|-------------|----------------|
| **Platform** | OpenFin Platform manifest | `platform.createView()` (GoldenLayout tabs) |
| **Container** | OpenFin `startup_app` | `fin.Window.create()` (native windows) |
| **Web** | `@openfin/core-web` in browser | GoldenLayout iframes via broker |
| **Browser** | Plain browser, no OpenFin | Angular `router.navigate()` fallback |

Manifests live in `apps/rates-desktop/public/assets/openfin/`.

### Messaging / Transport Layer

The transport is **pluggable** -- set `transport.type` in config to switch:

| Transport | Config Key | Topic Format | Special Features |
|-----------|-----------|-------------|-----------------|
| **AMPS** | `"amps"` | `rates/marketData` | SOW queries, delta subscribe |
| **Solace** | `"solace"` | `rates/marketData/treasury` | Direct/persistent delivery |
| **NATS** | `"nats"` | `rates.marketData` | Queue groups, request/reply |

All transports implement `ITransportService` and are injected via `TRANSPORT_SERVICE` token. The factory `provideTransport()` selects the implementation at runtime based on config.

### Data Flow

```
Transport (AMPS/Solace/NATS)
  └── MarketDataService (singleton, subscribes once, multicasts)
       ├── rowUpdate$  → MarketDataBlotter (patches individual ag-Grid rows)
       └── snapshot$   → TopOfTheBookView (renders full CSS Grid)

Transport (AMPS/Solace/NATS)
  └── ExecutionService (singleton, subscribes once, multicasts)
       └── rowUpdate$  → ExecutionsBlotter (patches ag-Grid rows)

RemoteLoggerService → NATS topic → RemoteLoggerViewer (SlickGrid)
```

Services use `sowAndSubscribe()` (AMPS) for state-of-world + live, falling back to `subscribe()` for other transports.

### Configuration System

Environment configs in `apps/rates-desktop/public/assets/config-{env}.json`. Environment auto-detected from `?env=` URL parameter (defaults to `dev`).

Key sections: `app`, `api`, `transport`, `marketData`, `trading`, `features`, `logging`, `ui`, `openfin`, `ampsTopics`, `natsTopics`, `solaceTopics`.

| Setting | Dev | Staging | Prod |
|---------|-----|---------|------|
| Transport | AMPS | Solace | Solace |
| Update Interval | 1000ms | 500ms | 250ms |
| Log Level | debug | info | warn |
| Console Logging | Yes | Yes | No |

### State Persistence

Components extend `WorkspaceComponent` (from `@rates-trading/shared-utils`) for state persistence:

```typescript
export class MyView extends WorkspaceComponent {
  readonly stateKey = 'my-view';
  getState() { return { columnWidths: this.widths }; }
  setState(state) { this.widths = state['columnWidths']; }
}
```

States are stored in localStorage via `WorkspaceStorageService` and bundled with OpenFin layout snapshots for save/restore.

### Treasury Price Formatting

Use `PriceFormatters` from `@rates-trading/shared-utils`:
- `formatTreasury32nds(99.515625)` → `"99-164"` (handle-32nds notation)
- `formatSpread32nds(0.0625)` → `"2.0/32"`
- `formatChange32nds(0.0625)` → `"+0-02"`
- `parseTreasury32nds("99-164")` → `99.515625`

## Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/status-bar` | StatusBarComponent | Connection status (thin bar) |
| `/market-data/top-of-book` | TopOfTheBookViewComponent | CSS Grid bid/ask view |
| `/market-data/blotter` | MarketDataBlotterComponent | Full AG Grid market data |
| `/executions` | ExecutionsBlotterComponent | Trade executions/fills |
| `/support/logs` | RemoteLoggerViewerComponent | Real-time NATS log viewer |

In OpenFin mode, each route loads as a separate window/tab. In browser mode, standard Angular routing is used.

## Shared Libraries

| Library | Key Exports | Purpose |
|---------|------------|---------|
| `@rates-trading/configuration` | `ConfigurationService`, `RatesAppConfiguration` | JSON config loading per environment |
| `@rates-trading/data-access` | `MarketData`, `MarketDataGridRow`, `transformMarketDataToGridRow` | Market data models & transforms |
| `@rates-trading/logger` | `LoggerService`, `RemoteLoggerService` | Pino logging + NATS remote publishing (Web Worker) |
| `@rates-trading/transports` | `ITransportService`, `TRANSPORT_SERVICE`, `provideTransport()` | Pluggable AMPS/Solace/NATS messaging |
| `@rates-trading/openfin` | `OpenFinService`, `OpenFinConnectionStatus` | Multi-mode desktop integration |
| `@rates-trading/shared-utils` | `PriceFormatters`, `WorkspaceComponent`, `WorkspaceStorageService` | Formatters & state persistence |
| `@rates-trading/ui-components` | `DataGrid<T>`, `RateCard`, `ColDef` | AG Grid wrapper & rate card |

## Code Style & Formatting

- **Prettier**: single quotes (`"singleQuote": true`)
- **ESLint**: NX flat config with `@nx/enforce-module-boundaries`
- **TypeScript**: 5.9, experimentalDecorators enabled
- **Style**: CSS (not SCSS) for components, SCSS configured for app generation

## Testing

- **Unit tests**: Vitest with `@analogjs/vitest-angular` for all projects
- **E2E tests**: Playwright (`nx e2e rates-desktop-e2e`)
- **Coverage**: V8 coverage via `@vitest/coverage-v8`, reports in `coverage/`
- **SonarQube**: Configured in `sonar-project.properties` (project key: `rates-etrading-desktop`)

```bash
npm test                    # Unit tests for rates-desktop
npm run test:all            # All projects
npm run e2e                 # Playwright E2E
nx affected -t test         # Only affected projects
```

## Building

```bash
npm run build               # Build rates-desktop
npm run build:all           # Build all projects
nx affected -t build        # Only affected projects
```

Output goes to `dist/apps/rates-desktop/`.

## NX Commands

```bash
nx graph                          # Dependency visualization
nx affected -t test               # Test affected projects
nx show project rates-desktop     # Project details
nx reset                          # Clear cache
```

Default base branch is `master`.

## MCP Servers Available

Configured in `.mcp.json`:
- **ag-mcp**: AG Grid documentation
- **primeng**: PrimeNG component documentation
- **nx-mcp**: NX workspace tools
- **angular-cli**: Angular CLI tools & best practices
- **tailwindcss**: Tailwind CSS utilities
- **macro-mcp**: Macro monorepo scaffolding (cross-repo)
- **rates-desktop-mcp**: Custom scaffolding for this repo

## Key Files

| File | Purpose |
|------|---------|
| `tsconfig.base.json` | All `@rates-trading/*` path aliases |
| `nx.json` | Build targets, caching, plugins, generators |
| `apps/rates-desktop/src/app/app.config.ts` | Angular providers (PrimeNG Nora, transport, config init) |
| `apps/rates-desktop/src/app/app.routes.ts` | All route definitions |
| `apps/rates-desktop/public/assets/config-dev.json` | Dev configuration (AMPS endpoints, topics, features) |
| `apps/rates-desktop/public/assets/openfin/app.fin.json` | OpenFin container manifest |
| `apps/rates-desktop/public/assets/openfin/app.platform.fin.json` | OpenFin platform manifest |
| `libs/transports/src/lib/interfaces/transport.interface.ts` | `ITransportService` interface |
| `libs/transports/src/lib/transport.factory.ts` | `provideTransport()` factory |
| `libs/shared-utils/src/lib/price-formatters.ts` | Treasury 32nds formatting |
| `libs/shared-utils/src/lib/workspace-component.ts` | `WorkspaceComponent` base class |
| `sonar-project.properties` | SonarQube analysis configuration |

## Common Pitfalls

- Dark mode selector is `.app-dark` (NOT `.dark`) -- PrimeNG Nora theme is configured with this selector
- The app uses `APP_INITIALIZER` to load config before bootstrap -- services that depend on config must wait for it
- `MarketDataService` and `ExecutionService` are singletons -- call `connect()` from components, service handles dedup
- Observable subscriptions from transport must run inside `NgZone.run()` for change detection
- `angular-slickgrid` requires `ngx-translate` (`TranslateModule.forRoot()`) even if not using i18n
- OpenFin layout restoration guards against infinite loops with a 30-second timeout
- Layout save/restore only works from the MAIN window (not child windows)
- `RemoteLoggerService` uses a Web Worker for NATS publishing -- falls back to main thread if workers unavailable
- The `DataGrid` component supports both JSON string and `ColDef[]` for columns input
- `WorkspaceComponent.instanceId` is derived from URL `viewId` query param or falls back to `stateKey`

## Adding a New View

1. Create component in `apps/rates-desktop/src/app/d2d/components/`
2. Make it standalone, extend `WorkspaceComponent` for state persistence
3. Add route in `app.routes.ts`
4. Add menu item in `app.ts` `initializeMenuItems()`
5. The component will automatically work in all 4 OpenFin modes

## Adding a New Library

```bash
nx g @nx/angular:library my-lib --directory=libs/my-lib
```

Add path alias to `tsconfig.base.json`:
```json
"@rates-trading/my-lib": ["libs/my-lib/src/index.ts"]
```

Unit test runner defaults to `vitest-analog` for Angular libraries.
