# Rates E-Trading Desktop

A real-time rates trading desktop application built as an **Nx monorepo** with **Angular 21**, **OpenFin** desktop containerization, and multi-transport messaging (AMPS, Solace, NATS).

The platform displays live US Treasury market data (2Y, 3Y, 5Y, 7Y, 10Y, 30Y), execution blotters, and supports multi-window layouts managed via OpenFin.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Architecture Overview](#architecture-overview)
- [Applications](#applications)
- [Libraries](#libraries)
- [Configuration](#configuration)
- [Messaging Transports](#messaging-transports)
- [OpenFin Integration](#openfin-integration)
- [Routing & Views](#routing--views)
- [Development Workflow](#development-workflow)
- [Nx Commands Reference](#nx-commands-reference)
- [Technology Stack](#technology-stack)
- [Import Aliases](#import-aliases)

---

## Prerequisites

- **Node.js** 20.x or higher
- **npm** 10.x or higher
- **OpenFin CLI** (optional, for desktop mode): `npm install -g openfin-cli`

## Getting Started

```bash
# Clone the repository
git clone <repo-url>
cd RatesETradingDesktop

# Install dependencies
npm install

# Start the development server
npm start
```

The application will be available at `http://localhost:4200/`.

### Running with OpenFin

```bash
# Start dev server + launch in OpenFin container
npm run openfin:start

# Start dev server + launch in OpenFin platform mode (multi-window layouts)
npm run openfin:start:platform

# Launch OpenFin against an already-running dev server
npm run openfin:launch
npm run openfin:launch:platform
```

---

## Project Structure

```
RatesETradingDesktop/
├── apps/
│   ├── rates-desktop/              # Main Angular application
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── app.ts          # Root component (menubar, layout, routing)
│   │   │   │   ├── app.config.ts   # Angular providers & DI setup
│   │   │   │   ├── app.routes.ts   # Route definitions
│   │   │   │   ├── d2d/            # Dealer-to-dealer trading views
│   │   │   │   │   ├── market-data-blotter/
│   │   │   │   │   ├── top-of-the-book-view/
│   │   │   │   │   ├── executions-blotter/
│   │   │   │   │   ├── remote-logger-viewer/
│   │   │   │   │   ├── status-bar/
│   │   │   │   │   ├── services/   # MarketDataService, ExecutionService
│   │   │   │   │   └── models/     # Domain models (Execution, etc.)
│   │   │   │   └── d2c/            # Dealer-to-customer views (future)
│   │   │   ├── main.ts
│   │   │   └── styles.css
│   │   └── public/
│   │       └── assets/
│   │           ├── config-dev.json
│   │           ├── config-prod.json
│   │           ├── config-staging.json
│   │           └── openfin/        # OpenFin manifests & layout files
│   └── rates-desktop-e2e/          # Playwright E2E tests
│
├── libs/
│   ├── configuration/              # App configuration management
│   ├── data-access/                # Data layer & domain models
│   ├── logger/                     # Pino-based structured logging
│   ├── openfin/                    # OpenFin desktop integration
│   ├── shared-utils/               # Shared utilities & helpers
│   ├── transports/                 # Multi-transport messaging layer
│   └── ui-components/              # Reusable UI components
│
├── nx.json                         # Nx workspace configuration
├── tsconfig.base.json              # Root TypeScript config with path aliases
└── package.json                    # Scripts & dependencies
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     rates-desktop (App)                         │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│   │ Top of   │ │ Market   │ │Executions│ │ Remote Log       │  │
│   │ Book     │ │ Data     │ │ Blotter  │ │ Viewer           │  │
│   │ View     │ │ Blotter  │ │          │ │                  │  │
│   └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────────────┘  │
│        │             │            │             │               │
│   ┌────▼─────────────▼────────────▼─────────────▼────────────┐  │
│   │              Services (MarketData, Execution)            │  │
│   └────┬────────────────────────────────┬────────────────────┘  │
│        │                                │                       │
├────────▼────────────────────────────────▼───────────────────────┤
│   Shared Libraries                                              │
│                                                                 │
│  ┌──────────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ transports   │  │ openfin  │  │  logger  │  │configuration│ │
│  │ (AMPS/Solace │  │ (layout, │  │  (Pino + │  │ (JSON-based │ │
│  │  /NATS)      │  │  windows)│  │   NATS)  │  │  configs)   │ │
│  └──────────────┘  └──────────┘  └──────────┘  └────────────┘  │
│                                                                 │
│  ┌──────────────┐  ┌────────────┐  ┌──────────────────────┐    │
│  │ data-access  │  │ ui-comps   │  │   shared-utils       │    │
│  │ (RatesData,  │  │ (ag-grid,  │  │   (formatters,       │    │
│  │  MarketData) │  │  RateCard) │  │    workspace storage) │    │
│  └──────────────┘  └────────────┘  └──────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Applications

### rates-desktop

The main Angular application. It provides:

- **Menubar** (PrimeNG) for navigating views: Market Data, Executions, Trading, Support
- **OpenFin layout management** with save/restore/delete of custom layouts
- **Real-time transport connection** to AMPS, Solace, or NATS
- **Dark/Light theme toggle** persisted to localStorage
- **Status bar** showing transport and OpenFin connection state
- **Remote logging** published to a NATS topic for centralized collection

### rates-desktop-e2e

Playwright-based end-to-end tests for the main application.

```bash
nx e2e rates-desktop-e2e
```

---

## Libraries

Each library is imported via a `@rates-trading/` path alias (see [Import Aliases](#import-aliases)).

### configuration (`@rates-trading/configuration`)

Loads environment-specific JSON configuration from `/assets/config-{env}.json`. Provides `ConfigurationService` and the `RatesAppConfiguration` interface covering app metadata, transport endpoints, market data symbols, feature flags, logging, OpenFin, and UI settings.

### transports (`@rates-trading/transports`)

Pluggable messaging transport layer. Supports three backends selectable via config:

| Transport | Protocol | Library |
|-----------|----------|---------|
| **AMPS** | WebSocket | `amps` |
| **Solace** | WebSocket (SMF) | `solclientjs` |
| **NATS** | WebSocket | `@nats-io/nats-core` |

All transports implement `ITransportService` (connect, disconnect, subscribe, publish, `connectionStatus$` observable). The active transport is selected at runtime via `TRANSPORT_FACTORY` based on `config.transport.type`.

### logger (`@rates-trading/logger`)

Structured logging built on **Pino**. Provides:

- `LoggerService` -- local console logging with child logger support
- `RemoteLoggerService` -- publishes logs to a NATS topic with buffering and batch flush

### openfin (`@rates-trading/openfin`)

Wraps OpenFin desktop APIs. Handles three runtime environments:

| Environment | Description | View mechanism |
|-------------|-------------|----------------|
| **Platform** | OpenFin Platform manifest | `platform.createView()` -- tabbed views |
| **Container** | OpenFin `startup_app` (native `fin` API) | `fin.Window.create()` -- native windows |
| **Web** | OpenFin `core-web` (browser-based) | GoldenLayout iframes via broker |
| **Browser** | No OpenFin (plain browser) | Angular router fallback |

Also manages layout save/restore to localStorage, view lifecycle, and inter-window communication.

### data-access (`@rates-trading/data-access`)

Data access layer exposing `RatesData` service and the `MarketData` interface (bid, ask, yield, spread, volume, etc.).

### ui-components (`@rates-trading/ui-components`)

Reusable Angular components:

- `DataGridComponent` -- ag-grid wrapper with common configuration
- `RateCardComponent` -- card display for rate information

### shared-utils (`@rates-trading/shared-utils`)

Common utilities:

- `PriceFormatters` -- decimal formatting, currency symbols
- `WorkspaceStorageService` -- localStorage state management
- `WorkspaceComponent` -- base component with workspace persistence

---

## Configuration

Environment configs live in `apps/rates-desktop/public/assets/`:

| File | Purpose |
|------|---------|
| `config-dev.json` | Local development endpoints |
| `config-staging.json` | Staging environment |
| `config-prod.json` | Production environment |

### Key configuration sections

```jsonc
{
  "app":        { "name", "version", "environment" },
  "api":        { "baseUrl", "timeout", "retryAttempts" },
  "transport":  { "type": "amps|solace|nats", "amps": {...}, "solace": {...}, "nats": {...} },
  "marketData": { "updateInterval", "maxHistorySize", "symbols": ["2Y","3Y","5Y","7Y","10Y","30Y"] },
  "trading":    { "enabled", "maxOrderSize", "defaultCurrency" },
  "features":   { "advancedCharts", "realTimeUpdates", "orderManagement" },
  "logging":    { "level", "enableConsole", "enableRemote", "remote": { "natsUrl", "topic", ... } },
  "ui":         { "theme", "defaultPageSize", "refreshInterval" },
  "openfin":    { "enabled", "brokerUrl", "layoutUrl", "providerId", ... },
  "ampsTopics": { "marketData", "executions" },
  "natsTopics": { "marketData", "executions" },
  "solaceTopics": { "marketData", "executions" }
}
```

---

## Messaging Transports

The application receives real-time market data and execution events over messaging middleware. The active transport is set by `transport.type` in the config file.

**Topics used:**

| Data | AMPS topic | NATS subject | Solace topic |
|------|-----------|-------------|-------------|
| Market Data | `rates/marketData` | `rates.marketData` | `rates/marketData/treasury` |
| Executions | `rates/executions` | `rates.executions` | `rates/executions` |

To switch transports, change `transport.type` in the config to `"amps"`, `"solace"`, or `"nats"`.

---

## OpenFin Integration

OpenFin provides desktop containerization -- multi-window layouts, native window management, and inter-application communication.

### Manifests (in `public/assets/openfin/`)

| File | Mode |
|------|------|
| `app.fin.json` | Container mode (`startup_app`) |
| `app.platform.fin.json` | Platform mode (multi-window with GoldenLayout) |
| `default.layout.fin.json` | Default layout definition |

### Layout Management

Users can save, restore, and delete custom window layouts via the **Preferences** menu. Layouts are persisted to `localStorage` and the last-used layout auto-restores on next launch.

---

## Routing & Views

Defined in `apps/rates-desktop/src/app/app.routes.ts`:

| Route | Component | Description |
|-------|-----------|-------------|
| `/status-bar` | `StatusBarComponent` | Connection status indicator |
| `/market-data/top-of-book` | `TopOfTheBookViewComponent` | Best bid/ask summary for each tenor |
| `/market-data/blotter` | `MarketDataBlotterComponent` | Full market data grid |
| `/executions` | `ExecutionsBlotterComponent` | Trade execution history |
| `/support/logs` | `RemoteLoggerViewerComponent` | Real-time log viewer (via NATS) |

In OpenFin mode, each view is loaded as a separate window/tab. In browser mode, standard Angular routing is used.

---

## Development Workflow

### Serve (dev server)

```bash
npm start                     # or: nx serve rates-desktop
```

### Build

```bash
npm run build                 # Build main app
npm run build:all             # Build all projects
```

Build output goes to `dist/apps/rates-desktop/`.

### Test

```bash
npm test                      # Unit tests for rates-desktop
npm run test:all              # Unit tests for all projects
npm run e2e                   # E2E tests (Playwright)
```

### Lint

```bash
npm run lint                  # Lint rates-desktop
npm run lint:all              # Lint all projects
```

### Affected commands (CI-optimized)

Only run tasks for projects affected by your changes:

```bash
nx affected -t test
nx affected -t build
nx affected -t lint
```

### Visualize dependencies

```bash
nx graph
```

---

## Nx Commands Reference

| Command | Description |
|---------|-------------|
| `nx serve rates-desktop` | Start dev server on port 4200 |
| `nx build rates-desktop` | Production build |
| `nx test rates-desktop` | Run unit tests (Vitest) |
| `nx lint rates-desktop` | Run ESLint |
| `nx e2e rates-desktop-e2e` | Run Playwright E2E tests |
| `nx graph` | Open dependency graph visualization |
| `nx show project rates-desktop` | Show project details and targets |
| `nx run-many -t build` | Build all projects |
| `nx affected -t test` | Test only changed projects |
| `nx reset` | Clear Nx cache |

### Generating new code

```bash
# New library
nx g @nx/angular:library my-lib

# New component in a library
nx g @nx/angular:component my-component --project=ui-components

# New service
nx g @nx/angular:service my-service --project=data-access
```

---

## Technology Stack

| Category | Technology | Version |
|----------|-----------|---------|
| **Framework** | Angular | 21.1.1 |
| **Language** | TypeScript | 5.9.2 |
| **Build System** | Nx | 22.4.0 |
| **Bundler** | Vite | 7.0.0 |
| **UI Components** | PrimeNG | 21.0.3 |
| **Data Grids** | ag-grid Enterprise | 35.0.0 |
| **Log Grid** | angular-slickgrid | 9.13.0 |
| **Charts** | ag-charts | 13.0.0 |
| **Desktop** | OpenFin (core-web) | 0.42.103 |
| **Messaging** | AMPS / Solace / NATS | 5.3.4 / 10.18.2 / 3.3.0 |
| **Logging** | Pino | 9.5.0 |
| **Reactive** | RxJS | 7.8.0 |
| **Unit Testing** | Vitest | 4.0.8 |
| **E2E Testing** | Playwright | 1.36.0 |
| **Linting** | ESLint | 9.8.0 |
| **Formatting** | Prettier | 3.6.2 |

---

## Import Aliases

Defined in `tsconfig.base.json`. Use these when importing from libraries:

```typescript
import { ConfigurationService } from '@rates-trading/configuration';
import { RatesData, MarketData }  from '@rates-trading/data-access';
import { LoggerService }          from '@rates-trading/logger';
import { OpenFinService }         from '@rates-trading/openfin';
import { PriceFormatters }        from '@rates-trading/shared-utils';
import { TRANSPORT_SERVICE }      from '@rates-trading/transports';
import { DataGridComponent }      from '@rates-trading/ui-components';
```

---

## Learn More

- [Nx Documentation](https://nx.dev)
- [Angular Documentation](https://angular.dev)
- [OpenFin Developer Docs](https://developers.openfin.co)
- [PrimeNG Components](https://primeng.org)
- [ag-Grid Documentation](https://www.ag-grid.com/angular-data-grid/)
- [AMPS Documentation](https://www.crankuptheamps.com/documentation)
- [Solace PubSub+](https://docs.solace.com)
- [NATS.io](https://nats.io/about/)
