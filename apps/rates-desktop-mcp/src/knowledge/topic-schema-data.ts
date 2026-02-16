/**
 * AMPS topic schemas — 9 topics with JSON schema, sample message, and GridRow interface.
 */

export interface TopicSchema {
  topic: string;
  status: 'active' | 'planned';
  description: string;
  idField: string;
  jsonSchema: Record<string, unknown>;
  sampleMessage: Record<string, unknown>;
  gridRowInterface: string;
}

export const TOPIC_SCHEMAS: TopicSchema[] = [
  // ── Active Topics ──
  {
    topic: 'rates/marketData',
    status: 'active',
    description: 'Aggregated top-of-book market data for US Treasury benchmarks. Published by the pricing engine with best bid/ask from all D2D venues.',
    idField: 'Id',
    jsonSchema: {
      type: 'object',
      required: ['Id', 'MarketId'],
      properties: {
        Id: { type: 'string', description: 'Benchmark identifier (e.g., "2Y", "5Y", "10Y")' },
        MarketId: { type: 'number', description: 'Numeric market identifier' },
        Desc: { type: 'string', description: 'Instrument description' },
        Bid: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              Price: { type: 'number' },
              Qty: { type: 'number' },
              Source: { type: 'array' },
              Status: { type: 'number' },
            },
          },
        },
        Ask: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              Price: { type: 'number' },
              Qty: { type: 'number' },
              Source: { type: 'array' },
              Status: { type: 'number' },
            },
          },
        },
        BidPricesUsed: { type: 'number' },
        AskPricesUsed: { type: 'number' },
        Time: { type: 'number', description: 'Epoch timestamp' },
        LastTradeprice: { type: 'number' },
      },
    },
    sampleMessage: {
      Id: '10Y',
      MarketId: 912828,
      Desc: '10 Year Note',
      Bid: [{ Price: 99.515625, Qty: 50, Source: ['BrokerTec'], Status: 1 }],
      Ask: [{ Price: 99.53125, Qty: 25, Source: ['BrokerTec'], Status: 1 }],
      BidPricesUsed: 3,
      AskPricesUsed: 2,
      Time: 1708099200000,
      LastTradeprice: 99.515625,
    },
    gridRowInterface: `export interface MarketDataGridRow {
  Id: string;
  MarketId: number;
  Desc: string;
  BestBidPrice: number | null;
  BestBidQty: number | null;
  BestAskPrice: number | null;
  BestAskQty: number | null;
  Spread: number | null;
  BidPricesUsed: number;
  AskPricesUsed: number;
  LastTradePrice: number | null;
  Time: Date | null;
  BidLevels: number;
  AskLevels: number;
}`,
  },
  {
    topic: 'rates/executions',
    status: 'active',
    description: 'Trade execution/fill notifications. Published by the execution engine when an order is filled.',
    idField: 'ExecutionIdString',
    jsonSchema: {
      type: 'object',
      required: ['ExecutionIdString', 'OrderIdString', 'Price', 'Qty', 'Side'],
      properties: {
        clientKey: { type: 'number' },
        DeskId: { type: 'number' },
        DstEE: { type: 'string', description: 'Destination execution engine' },
        ExchangeExecutionId: { type: 'string' },
        ExecutedQty: { type: 'number' },
        ExecutionId: { type: 'number' },
        ExecutionIdString: { type: 'string' },
        LeavesQty: { type: 'number' },
        OrderId: { type: 'number' },
        OrderIdString: { type: 'string' },
        ParentOrderId: { type: 'number' },
        ParentOrderIdString: { type: 'string' },
        Price: { type: 'number' },
        ProductId: { type: 'number' },
        Qty: { type: 'number' },
        Side: { type: 'string', enum: ['BUY', 'SELL'] },
        TransactionTime: { type: 'number' },
        UserId: { type: 'string' },
        Comment: { type: 'string' },
        CounterParty: { type: 'string' },
        Venue: { type: 'string' },
      },
    },
    sampleMessage: {
      ExecutionIdString: 'EX-2024-001234',
      OrderIdString: 'ORD-2024-005678',
      Side: 'BUY',
      Qty: 10000000,
      ExecutedQty: 10000000,
      LeavesQty: 0,
      Price: 99.515625,
      ProductId: 912828,
      DstEE: 'BTEC',
      Venue: 'BrokerTec',
      UserId: 'jsmith',
      CounterParty: 'GS',
      TransactionTime: 1708099200000,
      Comment: 'Auto-hedge fill',
      DeskId: 42,
    },
    gridRowInterface: `export interface ExecutionGridRow {
  ExecutionIdString: string;
  OrderIdString: string;
  Side: string;
  Qty: number;
  ExecutedQty: number;
  LeavesQty: number;
  Price: number;
  ProductId: number;
  DstEE: string;
  Venue: string;
  UserId: string;
  CounterParty: string;
  TransactionTime: number;
  Comment: string;
}`,
  },

  // ── Planned Topics ──
  {
    topic: 'rates/rfq',
    status: 'planned',
    description: 'Request-for-Quote messages from D2C clients. Contains client identity, security, side, qty, and auto-priced levels.',
    idField: 'RfqId',
    jsonSchema: {
      type: 'object',
      required: ['RfqId', 'ClientName', 'Security', 'Side', 'Qty'],
      properties: {
        RfqId: { type: 'string' },
        ClientName: { type: 'string' },
        Security: { type: 'string' },
        CUSIP: { type: 'string' },
        Side: { type: 'string', enum: ['BUY', 'SELL', 'TWO_WAY'] },
        Qty: { type: 'number' },
        RequestedPrice: { type: 'number' },
        SuggestedPrice: { type: 'number' },
        QuotedPrice: { type: 'number' },
        Status: { type: 'string', enum: ['PENDING', 'QUOTED', 'ACCEPTED', 'REJECTED', 'EXPIRED'] },
        TimeRemaining: { type: 'number', description: 'Seconds until RFQ expires' },
        Venue: { type: 'string' },
        Timestamp: { type: 'number' },
      },
    },
    sampleMessage: {
      RfqId: 'RFQ-2024-000123',
      ClientName: 'BlackRock',
      Security: '10Y',
      CUSIP: '912828YK1',
      Side: 'BUY',
      Qty: 25000000,
      RequestedPrice: null,
      SuggestedPrice: 99.515625,
      QuotedPrice: null,
      Status: 'PENDING',
      TimeRemaining: 45,
      Venue: 'TradeWeb',
      Timestamp: 1708099200000,
    },
    gridRowInterface: `export interface RfqGridRow {
  RfqId: string;
  ClientName: string;
  Security: string;
  Side: string;
  Qty: number;
  RequestedPrice: number | null;
  SuggestedPrice: number | null;
  QuotedPrice: number | null;
  Status: string;
  TimeRemaining: number;
  Venue: string;
  Timestamp: number;
}`,
  },
  {
    topic: 'rates/orders',
    status: 'planned',
    description: 'Order lifecycle messages. Tracks orders from creation through fill/cancel across all venues.',
    idField: 'OrderId',
    jsonSchema: {
      type: 'object',
      required: ['OrderId', 'Security', 'Side', 'OrderQty', 'Price'],
      properties: {
        OrderId: { type: 'string' },
        Security: { type: 'string' },
        Side: { type: 'string', enum: ['BUY', 'SELL'] },
        OrderQty: { type: 'number' },
        FilledQty: { type: 'number' },
        RemainingQty: { type: 'number' },
        Price: { type: 'number' },
        OrderType: { type: 'string', enum: ['LIMIT', 'MARKET', 'IOC', 'FOK'] },
        Status: { type: 'string', enum: ['NEW', 'PARTIAL', 'FILLED', 'CANCELLED', 'REJECTED'] },
        Venue: { type: 'string' },
        CreateTime: { type: 'number' },
        LastUpdateTime: { type: 'number' },
      },
    },
    sampleMessage: {
      OrderId: 'ORD-2024-005678',
      Security: '10Y',
      Side: 'BUY',
      OrderQty: 10000000,
      FilledQty: 5000000,
      RemainingQty: 5000000,
      Price: 99.515625,
      OrderType: 'LIMIT',
      Status: 'PARTIAL',
      Venue: 'BrokerTec',
      CreateTime: 1708099100000,
      LastUpdateTime: 1708099200000,
    },
    gridRowInterface: `export interface OrderGridRow {
  OrderId: string;
  Security: string;
  Side: string;
  OrderQty: number;
  FilledQty: number;
  RemainingQty: number;
  Price: number;
  OrderType: string;
  Status: string;
  Venue: string;
  CreateTime: number;
  LastUpdateTime: number;
}`,
  },
  {
    topic: 'rates/serviceStatus',
    status: 'planned',
    description: 'Health and status of backend services (pricing engines, execution engines, market data adapters).',
    idField: 'ServiceId',
    jsonSchema: {
      type: 'object',
      required: ['ServiceId', 'ServiceName', 'Status'],
      properties: {
        ServiceId: { type: 'string' },
        ServiceName: { type: 'string' },
        Status: { type: 'string', enum: ['UP', 'DOWN', 'DEGRADED'] },
        Host: { type: 'string' },
        Port: { type: 'number' },
        Uptime: { type: 'number' },
        LastHeartbeat: { type: 'number' },
        Version: { type: 'string' },
        Details: { type: 'string' },
      },
    },
    sampleMessage: {
      ServiceId: 'pricing-engine-01',
      ServiceName: 'Rates Pricing Engine',
      Status: 'UP',
      Host: 'prod-rates-pe-01',
      Port: 9200,
      Uptime: 864000,
      LastHeartbeat: 1708099200000,
      Version: '2.4.1',
      Details: 'All feeds connected',
    },
    gridRowInterface: `export interface ServiceStatusGridRow {
  ServiceId: string;
  ServiceName: string;
  Status: string;
  Host: string;
  Port: number;
  Uptime: number;
  LastHeartbeat: number;
  Version: string;
  Details: string;
}`,
  },
  {
    topic: 'rates/positions',
    status: 'planned',
    description: 'Real-time position data by security showing current holdings, average cost, and P&L.',
    idField: 'SecurityId',
    jsonSchema: {
      type: 'object',
      required: ['SecurityId', 'NetPosition'],
      properties: {
        SecurityId: { type: 'string' },
        Security: { type: 'string' },
        NetPosition: { type: 'number' },
        AvgCost: { type: 'number' },
        CurrentPrice: { type: 'number' },
        UnrealizedPnL: { type: 'number' },
        RealizedPnL: { type: 'number' },
        DV01: { type: 'number' },
        LastUpdateTime: { type: 'number' },
      },
    },
    sampleMessage: {
      SecurityId: '10Y',
      Security: '10 Year Note',
      NetPosition: 50000000,
      AvgCost: 99.48,
      CurrentPrice: 99.515625,
      UnrealizedPnL: 17812.50,
      RealizedPnL: 45000.00,
      DV01: 850.00,
      LastUpdateTime: 1708099200000,
    },
    gridRowInterface: `export interface PositionGridRow {
  SecurityId: string;
  Security: string;
  NetPosition: number;
  AvgCost: number;
  CurrentPrice: number;
  UnrealizedPnL: number;
  RealizedPnL: number;
  DV01: number;
  LastUpdateTime: number;
}`,
  },
  {
    topic: 'rates/pnl',
    status: 'planned',
    description: 'Aggregated P&L data by desk, trader, and security. Updated in real-time as positions and prices change.',
    idField: 'DeskId',
    jsonSchema: {
      type: 'object',
      required: ['DeskId', 'TotalPnL'],
      properties: {
        DeskId: { type: 'string' },
        DeskName: { type: 'string' },
        TraderId: { type: 'string' },
        TotalPnL: { type: 'number' },
        RealizedPnL: { type: 'number' },
        UnrealizedPnL: { type: 'number' },
        TotalDV01: { type: 'number' },
        TradeCount: { type: 'number' },
        LastUpdateTime: { type: 'number' },
      },
    },
    sampleMessage: {
      DeskId: 'RATES-D2D',
      DeskName: 'Rates D2D Trading',
      TraderId: 'jsmith',
      TotalPnL: 125000.00,
      RealizedPnL: 95000.00,
      UnrealizedPnL: 30000.00,
      TotalDV01: 2500.00,
      TradeCount: 147,
      LastUpdateTime: 1708099200000,
    },
    gridRowInterface: `export interface PnLGridRow {
  DeskId: string;
  DeskName: string;
  TraderId: string;
  TotalPnL: number;
  RealizedPnL: number;
  UnrealizedPnL: number;
  TotalDV01: number;
  TradeCount: number;
  LastUpdateTime: number;
}`,
  },
  {
    topic: 'rates/hedging',
    status: 'planned',
    description: 'Auto-hedging engine status and configuration. Shows current hedge parameters and execution status per security.',
    idField: 'SecurityId',
    jsonSchema: {
      type: 'object',
      required: ['SecurityId', 'HedgeRatio', 'Status'],
      properties: {
        SecurityId: { type: 'string' },
        HedgeRatio: { type: 'number' },
        MaxNotional: { type: 'number' },
        Status: { type: 'string', enum: ['ACTIVE', 'PAUSED', 'DISABLED'] },
        PendingHedges: { type: 'number' },
        ExecutedHedges: { type: 'number' },
        NetPosition: { type: 'number' },
        LastHedgeTime: { type: 'number' },
      },
    },
    sampleMessage: {
      SecurityId: '10Y',
      HedgeRatio: 0.85,
      MaxNotional: 100000000,
      Status: 'ACTIVE',
      PendingHedges: 2,
      ExecutedHedges: 34,
      NetPosition: -5000000,
      LastHedgeTime: 1708099150000,
    },
    gridRowInterface: `export interface HedgingGridRow {
  SecurityId: string;
  HedgeRatio: number;
  MaxNotional: number;
  Status: string;
  PendingHedges: number;
  ExecutedHedges: number;
  NetPosition: number;
  LastHedgeTime: number;
}`,
  },
  {
    topic: 'rates/offerings',
    status: 'planned',
    description: 'Dealer offerings/axes published to D2C venues. Tracks active offerings and their hit rates.',
    idField: 'OfferingId',
    jsonSchema: {
      type: 'object',
      required: ['OfferingId', 'Security', 'Side', 'Qty', 'Price'],
      properties: {
        OfferingId: { type: 'string' },
        Security: { type: 'string' },
        Side: { type: 'string', enum: ['BUY', 'SELL'] },
        Qty: { type: 'number' },
        Price: { type: 'number' },
        Venue: { type: 'string' },
        Status: { type: 'string', enum: ['ACTIVE', 'FILLED', 'CANCELLED', 'EXPIRED'] },
        PublishTime: { type: 'number' },
        Hits: { type: 'number' },
        ExpiryTime: { type: 'number' },
      },
    },
    sampleMessage: {
      OfferingId: 'OFF-2024-000456',
      Security: '5Y',
      Side: 'SELL',
      Qty: 15000000,
      Price: 100.125,
      Venue: 'TradeWeb',
      Status: 'ACTIVE',
      PublishTime: 1708098000000,
      Hits: 3,
      ExpiryTime: 1708113600000,
    },
    gridRowInterface: `export interface OfferingGridRow {
  OfferingId: string;
  Security: string;
  Side: string;
  Qty: number;
  Price: number;
  Venue: string;
  Status: string;
  PublishTime: number;
  Hits: number;
  ExpiryTime: number;
}`,
  },
];

export const TOPIC_NAMES = TOPIC_SCHEMAS.map((t) => t.topic);
