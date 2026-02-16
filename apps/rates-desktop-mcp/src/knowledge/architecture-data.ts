/**
 * Project architecture knowledge — workspace structure, library graph, tech stack, data flow.
 */

export const ARCHITECTURE = {
  overview: `Rates E-Trading Desktop is an Angular 21 application running on OpenFin for multi-window desktop layout management.
It connects to AMPS (primary), Solace, or NATS messaging for real-time market data, execution feeds, and order management.
The codebase is an Nx monorepo with 7 shared libraries and uses AG Grid Enterprise for high-frequency data display.`,

  techStack: {
    framework: 'Angular 21.1.1',
    buildSystem: 'Nx 22.4.0',
    desktop: 'OpenFin (core-web v0.42.103) — supports Browser, Platform, Container, and Web modes',
    grid: 'AG Grid Enterprise 35.x with custom DataGrid wrapper',
    uiLibrary: 'PrimeNG 21.x (menubar, dialog, accordion, button)',
    messaging: 'AMPS 5.3.x (primary), Solace PubSub+ 10.18.x, NATS 3.3.x',
    logging: 'Pino 9.5.x with remote log viewer',
    styling: 'SCSS + PrimeNG themes (light/dark)',
    testing: 'Vitest for unit tests, Playwright for E2E',
    charts: 'AG Charts Enterprise 11.x',
  },

  nxWorkspace: {
    apps: [
      {
        name: 'rates-desktop',
        type: 'application',
        description: 'Main Angular trading application',
        buildExecutor: '@angular/build:application',
      },
      {
        name: 'rates-desktop-e2e',
        type: 'e2e',
        description: 'Playwright end-to-end tests',
      },
      {
        name: 'rates-desktop-mcp',
        type: 'application',
        description: 'MCP server providing developer tools and trading domain knowledge',
        buildExecutor: '@nx/esbuild:esbuild',
      },
    ],
    libs: [
      {
        name: '@rates-trading/shared-utils',
        path: 'libs/shared-utils',
        description: 'WorkspaceComponent base class, WorkspaceStorageService, price formatters (32nds)',
        exports: ['WorkspaceComponent', 'WorkspaceStorageService', 'formatTreasury32nds', 'formatSpread32nds'],
      },
      {
        name: '@rates-trading/ui-components',
        path: 'libs/ui-components',
        description: 'DataGrid component (AG Grid wrapper with high-frequency mode), RateCard component',
        exports: ['DataGrid', 'RateCard', 'ColDef', 'GridOptions', 'GridApi'],
      },
      {
        name: '@rates-trading/data-access',
        path: 'libs/data-access',
        description: 'Data models (MarketData, MarketDataGridRow), transformation functions, RatesData service',
        exports: ['MarketData', 'MarketDataGridRow', 'transformMarketDataToGridRow', 'RatesData'],
      },
      {
        name: '@rates-trading/configuration',
        path: 'libs/configuration',
        description: 'ConfigurationService, RatesAppConfiguration interface, environment config loading',
        exports: ['ConfigurationService', 'RatesAppConfiguration'],
      },
      {
        name: '@rates-trading/transports',
        path: 'libs/transports',
        description: 'Abstract ITransportService + AMPS, Solace, NATS implementations. Connection management, SOW, delta subscribe.',
        exports: ['ITransportService', 'TRANSPORT_SERVICE', 'AmpsTransportService', 'SolaceTransportService', 'NatsTransportService', 'ConnectionStatus'],
      },
      {
        name: '@rates-trading/logger',
        path: 'libs/logger',
        description: 'Pino-based LoggerService with child logger pattern, RemoteLoggerService for centralized log collection',
        exports: ['LoggerService', 'RemoteLoggerService'],
      },
      {
        name: '@rates-trading/openfin',
        path: 'libs/openfin',
        description: 'OpenFinService for platform/container/web mode detection, view creation, layout management',
        exports: ['OpenFinService', 'OpenFinConnectionStatus', 'OpenFinConfig'],
      },
    ],
  },

  libDependencyGraph: `
    rates-desktop (app)
    ├── @rates-trading/ui-components
    │   └── ag-grid-angular, ag-grid-enterprise
    ├── @rates-trading/data-access
    ├── @rates-trading/transports
    │   ├── amps (native client)
    │   ├── solclientjs
    │   └── @nats-io/nats-core
    ├── @rates-trading/configuration
    ├── @rates-trading/shared-utils
    ├── @rates-trading/logger
    │   └── pino
    └── @rates-trading/openfin
        └── @openfin/core-web
  `,

  dataFlow: `
    1. App startup → ConfigurationService loads config from assets/config.json
    2. App initializes OpenFin (Platform/Container/Web mode detection)
    3. User action or auto-connect → TRANSPORT_SERVICE.connect() → AMPS/Solace/NATS
    4. Service layer (e.g., MarketDataService) calls transport.sowAndSubscribe(topic)
       → First receives SOW snapshot (full state), then live updates
    5. Service maintains Map<id, row> as single source of truth
    6. Service emits rowUpdate$ (individual) and snapshot$ (full array) observables
    7. Component subscribes to rowUpdate$ → DataGrid.updateRow() for high-frequency patching
    8. DataGrid uses AG Grid applyTransactionAsync for batched DOM updates
    9. WorkspaceComponent persists grid state (columns, sort, filter) to localStorage
    10. OpenFin layout management handles multi-window positioning and persistence
  `,

  buildCommands: {
    buildAll: 'nx run-many -t build',
    buildApp: 'nx build rates-desktop',
    buildMcp: 'nx build rates-desktop-mcp',
    serve: 'nx serve rates-desktop',
    test: 'nx test rates-desktop',
    testAll: 'nx run-many -t test',
    lint: 'nx run-many -t lint',
    e2e: 'nx e2e rates-desktop-e2e',
    graph: 'nx graph',
  },

  keyFiles: {
    appEntry: 'apps/rates-desktop/src/main.ts',
    appComponent: 'apps/rates-desktop/src/app/app.ts',
    appRoutes: 'apps/rates-desktop/src/app/app.routes.ts',
    d2dBarrel: 'apps/rates-desktop/src/app/d2d/index.ts',
    servicesBarrel: 'apps/rates-desktop/src/app/d2d/services/index.ts',
    modelsBarrel: 'apps/rates-desktop/src/app/d2d/models/index.ts',
    configFile: 'apps/rates-desktop/src/assets/config.json',
    openfinManifest: 'apps/rates-desktop/src/assets/openfin/',
  },

  conventions: {
    componentNaming: 'kebab-case directories, PascalCase class names (e.g., market-data-blotter/ → MarketDataBlotterComponent)',
    serviceNaming: 'kebab-case files, PascalCase class names with Service suffix (e.g., market-data.service.ts → MarketDataService)',
    modelNaming: 'PascalCase interfaces, kebab-case files (e.g., execution.ts → Execution, ExecutionGridRow)',
    stateKeys: 'Forward-slash separated path matching the route (e.g., "market-data/blotter")',
    routePaths: 'Kebab-case, matching component category (e.g., /market-data/blotter, /trading/rfq)',
    menuIcons: 'PrimeIcons (pi pi-*) — see https://primeng.org/icons',
    barrelExports: 'Every directory has an index.ts re-exporting all public symbols',
    testFiles: '*.spec.ts co-located with source files',
  },
};
