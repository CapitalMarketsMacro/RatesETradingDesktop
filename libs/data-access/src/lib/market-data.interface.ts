/**
 * Represents a single bid or ask level in the order book
 */
export interface BidAskLevel {
  /** Price at this level */
  Price: number;
  /** Quantity available at this price */
  Qty: number;
  /** Source information for this level */
  Source?: any[];
  /** Status code */
  Status?: number;
}

/**
 * Market data interface for rates/marketData topic
 */
export interface MarketData {
  /** Unique identifier for this market data record (e.g., "2Y", "5Y", "10Y") */
  Id: string;
  /** Market identifier */
  MarketId: number;
  /** Description of the instrument */
  Desc?: string;
  /** Bid levels (buy orders) */
  Bid?: BidAskLevel[];
  /** Ask levels (sell orders) */
  Ask?: BidAskLevel[];
  /** Number of bid prices used in aggregation */
  BidPricesUsed?: number;
  /** Number of ask prices used in aggregation */
  AskPricesUsed?: number;
  /** Timestamp of the market data */
  Time?: number;
  /** Last trade price */
  LastTradeprice?: number;
  /** Allow additional properties */
  [key: string]: any;
}

/**
 * Flattened market data for grid display
 */
export interface MarketDataGridRow {
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
}

/**
 * Transforms raw MarketData to a flattened grid row format
 */
export function transformMarketDataToGridRow(data: MarketData): MarketDataGridRow {
  const bestBid = data.Bid?.[0];
  const bestAsk = data.Ask?.[0];
  
  return {
    Id: data.Id,
    MarketId: data.MarketId,
    Desc: data.Desc || `Market ${data.MarketId}`,
    BestBidPrice: bestBid?.Price ?? null,
    BestBidQty: bestBid?.Qty ?? null,
    BestAskPrice: bestAsk?.Price ?? null,
    BestAskQty: bestAsk?.Qty ?? null,
    Spread: bestBid && bestAsk ? bestAsk.Price - bestBid.Price : null,
    BidPricesUsed: data.BidPricesUsed ?? 0,
    AskPricesUsed: data.AskPricesUsed ?? 0,
    LastTradePrice: data.LastTradeprice ?? null,
    Time: data.Time ? new Date(data.Time) : null,
    BidLevels: data.Bid?.length ?? 0,
    AskLevels: data.Ask?.length ?? 0,
  };
}
