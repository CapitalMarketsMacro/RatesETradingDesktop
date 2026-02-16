/**
 * Component catalog — 5 implemented + 7 planned components.
 */

export interface ComponentEntry {
  name: string;
  displayName: string;
  status: 'implemented' | 'planned';
  category: 'market-data' | 'execution' | 'trading' | 'risk' | 'support';
  description: string;
  businessPurpose: string;
  routePath: string;
  ampsTopic?: string;
  stateKey: string;
  fields?: string[];
  files?: string[];
  menuLocation: string;
  menuIcon: string;
}

export const COMPONENTS: ComponentEntry[] = [
  // ── Implemented ──
  {
    name: 'market-data-blotter',
    displayName: 'Market Data Blotter',
    status: 'implemented',
    category: 'market-data',
    description: 'Real-time aggregated market data grid showing best bid/ask, spread, and depth for all benchmark US Treasury maturities.',
    businessPurpose: 'Primary view for traders to monitor D2D market activity across all tenors. Displays BrokerTec aggregated top-of-book with depth indicators.',
    routePath: '/market-data/blotter',
    ampsTopic: 'rates/marketData',
    stateKey: 'market-data/blotter',
    fields: ['Id', 'MarketId', 'Desc', 'BestBidPrice', 'BestBidQty', 'BestAskPrice', 'BestAskQty', 'Spread', 'BidPricesUsed', 'AskPricesUsed', 'LastTradePrice', 'Time', 'BidLevels', 'AskLevels'],
    files: [
      'apps/rates-desktop/src/app/d2d/market-data-blotter/market-data-blotter.component.ts',
      'apps/rates-desktop/src/app/d2d/market-data-blotter/market-data-blotter.component.html',
      'apps/rates-desktop/src/app/d2d/market-data-blotter/market-data-blotter.component.css',
      'apps/rates-desktop/src/app/d2d/services/market-data.service.ts',
      'libs/data-access/src/lib/market-data.interface.ts',
    ],
    menuLocation: 'Market Data > Market Data Blotter',
    menuIcon: 'pi pi-table',
  },
  {
    name: 'top-of-the-book',
    displayName: 'Top of the Book',
    status: 'implemented',
    category: 'market-data',
    description: 'Card-based view showing top-of-book bid/ask for each benchmark maturity as individual rate cards with visual bid/ask indicators.',
    businessPurpose: 'Quick visual overview of where the market is. Traders use this alongside the blotter for a dashboard-style view of current levels.',
    routePath: '/market-data/top-of-book',
    ampsTopic: 'rates/marketData',
    stateKey: 'market-data/top-of-book',
    fields: ['Id', 'Desc', 'BestBidPrice', 'BestBidQty', 'BestAskPrice', 'BestAskQty', 'Spread'],
    files: [
      'apps/rates-desktop/src/app/d2d/top-of-the-book-view/top-of-the-book-view.component.ts',
      'apps/rates-desktop/src/app/d2d/top-of-the-book-view/top-of-the-book-view.component.html',
      'apps/rates-desktop/src/app/d2d/top-of-the-book-view/top-of-the-book-view.component.css',
    ],
    menuLocation: 'Market Data > Top of the Book',
    menuIcon: 'pi pi-list',
  },
  {
    name: 'executions-blotter',
    displayName: 'Executions Blotter',
    status: 'implemented',
    category: 'execution',
    description: 'Real-time blotter showing all trade executions/fills with details including side, qty, price, venue, and counterparty.',
    businessPurpose: 'Traders and operations monitor all executions in real-time. Used for trade monitoring, P&L tracking, and compliance review.',
    routePath: '/executions',
    ampsTopic: 'rates/executions',
    stateKey: 'executions',
    fields: ['ExecutionIdString', 'OrderIdString', 'Side', 'Qty', 'ExecutedQty', 'LeavesQty', 'Price', 'ProductId', 'DstEE', 'Venue', 'UserId', 'CounterParty', 'TransactionTime', 'Comment'],
    files: [
      'apps/rates-desktop/src/app/d2d/executions-blotter/executions-blotter.component.ts',
      'apps/rates-desktop/src/app/d2d/executions-blotter/executions-blotter.component.html',
      'apps/rates-desktop/src/app/d2d/executions-blotter/executions-blotter.component.css',
      'apps/rates-desktop/src/app/d2d/services/execution.service.ts',
      'apps/rates-desktop/src/app/d2d/models/execution.ts',
    ],
    menuLocation: 'Executions',
    menuIcon: 'pi pi-check-circle',
  },
  {
    name: 'status-bar',
    displayName: 'Status Bar',
    status: 'implemented',
    category: 'support',
    description: 'Bottom status bar showing AMPS connection status, OpenFin environment mode, and app version.',
    businessPurpose: 'Always-visible indicator of system health. Traders immediately know if their data feed is connected or if there are issues.',
    routePath: '/status-bar',
    stateKey: 'status-bar',
    files: [
      'apps/rates-desktop/src/app/d2d/status-bar/status-bar.component.ts',
      'apps/rates-desktop/src/app/d2d/status-bar/status-bar.component.html',
      'apps/rates-desktop/src/app/d2d/status-bar/status-bar.component.css',
    ],
    menuLocation: '(always visible)',
    menuIcon: 'pi pi-info-circle',
  },
  {
    name: 'remote-logger-viewer',
    displayName: 'Remote Logger',
    status: 'implemented',
    category: 'support',
    description: 'Real-time log viewer displaying structured Pino log entries from all application instances. Filterable by level and component.',
    businessPurpose: 'Support tool for developers and production support. View logs from any running instance without needing SSH access.',
    routePath: '/support/logs',
    stateKey: 'support/logs',
    files: [
      'apps/rates-desktop/src/app/d2d/remote-logger-viewer/remote-logger-viewer.component.ts',
      'apps/rates-desktop/src/app/d2d/remote-logger-viewer/remote-logger-viewer.component.html',
      'apps/rates-desktop/src/app/d2d/remote-logger-viewer/remote-logger-viewer.component.css',
    ],
    menuLocation: 'Support > View Real Time Logs',
    menuIcon: 'pi pi-list',
  },

  // ── Planned ──
  {
    name: 'rfq-blotter',
    displayName: 'RFQ Blotter',
    status: 'planned',
    category: 'trading',
    description: 'Request-for-Quote management blotter showing inbound D2C client RFQs with auto-pricing, manual override, and response status tracking.',
    businessPurpose: 'Core D2C workflow. Traders see incoming client RFQs, review suggested prices, optionally adjust, and respond within time limits.',
    routePath: '/trading/rfq',
    ampsTopic: 'rates/rfq',
    stateKey: 'trading/rfq',
    fields: ['RfqId', 'ClientName', 'Security', 'Side', 'Qty', 'RequestedPrice', 'SuggestedPrice', 'QuotedPrice', 'Status', 'TimeRemaining', 'Venue', 'Timestamp'],
    menuLocation: 'Trading > RFQ Blotter',
    menuIcon: 'pi pi-comments',
  },
  {
    name: 'offering-blotter',
    displayName: 'Offering Blotter',
    status: 'planned',
    category: 'trading',
    description: 'View and manage dealer offerings/axes published to D2C venues. Track which securities are being actively offered and at what levels.',
    businessPurpose: 'Sales traders use this to manage what they are showing to clients. Tracks published offerings, hits, and inventory.',
    routePath: '/trading/offerings',
    ampsTopic: 'rates/offerings',
    stateKey: 'trading/offerings',
    fields: ['OfferingId', 'Security', 'Side', 'Qty', 'Price', 'Venue', 'Status', 'PublishTime', 'Hits', 'ExpiryTime'],
    menuLocation: 'Trading > Offerings',
    menuIcon: 'pi pi-megaphone',
  },
  {
    name: 'market-watch',
    displayName: 'Market Watch',
    status: 'planned',
    category: 'market-data',
    description: 'Configurable watchlist of securities with real-time prices, yields, and change indicators. Supports custom layouts and alerts.',
    businessPurpose: 'Personalized market monitoring. Each trader configures their own watchlist of securities they are actively trading or hedging.',
    routePath: '/market-data/watch',
    ampsTopic: 'rates/marketData',
    stateKey: 'market-data/watch',
    fields: ['Id', 'Security', 'BidPrice', 'AskPrice', 'LastPrice', 'Change', 'Yield', 'Volume'],
    menuLocation: 'Market Data > Market Watch',
    menuIcon: 'pi pi-eye',
  },
  {
    name: 'market-ladder',
    displayName: 'Market Ladder',
    status: 'planned',
    category: 'market-data',
    description: 'Depth-of-market ladder view for a single security showing all bid/ask levels with quantities. Click-to-trade enabled.',
    businessPurpose: 'Detailed view of order book depth for a single security. Used when actively trading a specific maturity to see full liquidity picture.',
    routePath: '/market-data/ladder',
    ampsTopic: 'rates/marketData',
    stateKey: 'market-data/ladder',
    fields: ['Price', 'BidQty', 'AskQty', 'BidSource', 'AskSource', 'Level'],
    menuLocation: 'Market Data > Market Ladder',
    menuIcon: 'pi pi-sort-alt',
  },
  {
    name: 'order-blotter',
    displayName: 'Order Blotter',
    status: 'planned',
    category: 'execution',
    description: 'Active and historical orders view showing order lifecycle from creation through fill/cancel with real-time status updates.',
    businessPurpose: 'Order management and monitoring. Traders track pending orders, partially filled orders, and review order history.',
    routePath: '/trading/orders',
    ampsTopic: 'rates/orders',
    stateKey: 'trading/orders',
    fields: ['OrderId', 'Security', 'Side', 'OrderQty', 'FilledQty', 'RemainingQty', 'Price', 'OrderType', 'Status', 'Venue', 'CreateTime', 'LastUpdateTime'],
    menuLocation: 'Trading > Orders',
    menuIcon: 'pi pi-file-edit',
  },
  {
    name: 'auto-hedging-controls',
    displayName: 'Auto Hedging Controls',
    status: 'planned',
    category: 'risk',
    description: 'Configuration and monitoring panel for the automatic hedging engine. Set hedge ratios, thresholds, and view hedge execution status.',
    businessPurpose: 'Risk management tool. Traders configure auto-hedging parameters so that D2C fills are automatically hedged in the D2D market.',
    routePath: '/risk/hedging',
    ampsTopic: 'rates/hedging',
    stateKey: 'risk/hedging',
    fields: ['SecurityId', 'HedgeRatio', 'MaxNotional', 'Status', 'PendingHedges', 'ExecutedHedges', 'NetPosition', 'LastHedgeTime'],
    menuLocation: 'Risk > Auto Hedging',
    menuIcon: 'pi pi-shield',
  },
  {
    name: 'auto-market-making-controls',
    displayName: 'Auto Market Making Controls',
    status: 'planned',
    category: 'risk',
    description: 'Configuration panel for automated market-making. Set bid/ask spreads, position limits, and monitor quoting engine status.',
    businessPurpose: 'Market-making control panel. Traders configure the quoting engine that automatically provides two-way prices to D2C clients.',
    routePath: '/risk/market-making',
    ampsTopic: 'rates/marketMaking',
    stateKey: 'risk/market-making',
    fields: ['SecurityId', 'BidSpread', 'AskSpread', 'MaxPosition', 'CurrentPosition', 'QuoteStatus', 'ActiveVenues', 'LastQuoteTime'],
    menuLocation: 'Risk > Market Making',
    menuIcon: 'pi pi-sliders-v',
  },
];

export const COMPONENT_NAMES = COMPONENTS.map((c) => c.name);
export const COMPONENT_CATEGORIES = ['market-data', 'execution', 'trading', 'risk', 'support'] as const;
export type ComponentCategory = (typeof COMPONENT_CATEGORIES)[number];
