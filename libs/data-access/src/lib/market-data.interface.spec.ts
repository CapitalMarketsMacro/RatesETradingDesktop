import { transformMarketDataToGridRow, MarketData, MarketDataGridRow } from './market-data.interface';

describe('transformMarketDataToGridRow', () => {
  it('should transform market data with full bid and ask levels', () => {
    const data: MarketData = {
      Id: '10Y',
      MarketId: 1,
      Desc: 'US 10 Year',
      Bid: [
        { Price: 99.5, Qty: 1000 },
        { Price: 99.4, Qty: 500 },
      ],
      Ask: [
        { Price: 99.6, Qty: 800 },
        { Price: 99.7, Qty: 600 },
      ],
      BidPricesUsed: 3,
      AskPricesUsed: 2,
      LastTradeprice: 99.55,
      Time: 1700000000000,
    };

    const result = transformMarketDataToGridRow(data);

    expect(result.Id).toBe('10Y');
    expect(result.MarketId).toBe(1);
    expect(result.Desc).toBe('US 10 Year');
    expect(result.BestBidPrice).toBe(99.5);
    expect(result.BestBidQty).toBe(1000);
    expect(result.BestAskPrice).toBe(99.6);
    expect(result.BestAskQty).toBe(800);
    expect(result.Spread).toBeCloseTo(0.1, 5);
    expect(result.BidPricesUsed).toBe(3);
    expect(result.AskPricesUsed).toBe(2);
    expect(result.LastTradePrice).toBe(99.55);
    expect(result.Time).toBeInstanceOf(Date);
    expect(result.BidLevels).toBe(2);
    expect(result.AskLevels).toBe(2);
  });

  it('should handle missing bid levels', () => {
    const data: MarketData = {
      Id: '5Y',
      MarketId: 2,
      Ask: [{ Price: 100.0, Qty: 500 }],
    };

    const result = transformMarketDataToGridRow(data);

    expect(result.BestBidPrice).toBeNull();
    expect(result.BestBidQty).toBeNull();
    expect(result.BestAskPrice).toBe(100.0);
    expect(result.BestAskQty).toBe(500);
    expect(result.Spread).toBeNull();
    expect(result.BidLevels).toBe(0);
    expect(result.AskLevels).toBe(1);
  });

  it('should handle missing ask levels', () => {
    const data: MarketData = {
      Id: '2Y',
      MarketId: 3,
      Bid: [{ Price: 98.5, Qty: 2000 }],
    };

    const result = transformMarketDataToGridRow(data);

    expect(result.BestBidPrice).toBe(98.5);
    expect(result.BestBidQty).toBe(2000);
    expect(result.BestAskPrice).toBeNull();
    expect(result.BestAskQty).toBeNull();
    expect(result.Spread).toBeNull();
    expect(result.BidLevels).toBe(1);
    expect(result.AskLevels).toBe(0);
  });

  it('should handle empty bid and ask arrays', () => {
    const data: MarketData = {
      Id: '30Y',
      MarketId: 4,
      Bid: [],
      Ask: [],
    };

    const result = transformMarketDataToGridRow(data);

    expect(result.BestBidPrice).toBeNull();
    expect(result.BestAskPrice).toBeNull();
    expect(result.Spread).toBeNull();
    expect(result.BidLevels).toBe(0);
    expect(result.AskLevels).toBe(0);
  });

  it('should use default description when Desc is missing', () => {
    const data: MarketData = {
      Id: '7Y',
      MarketId: 5,
    };

    const result = transformMarketDataToGridRow(data);

    expect(result.Desc).toBe('Market 5');
  });

  it('should use provided description when available', () => {
    const data: MarketData = {
      Id: '7Y',
      MarketId: 5,
      Desc: 'Custom Description',
    };

    const result = transformMarketDataToGridRow(data);

    expect(result.Desc).toBe('Custom Description');
  });

  it('should handle missing Time', () => {
    const data: MarketData = {
      Id: '3Y',
      MarketId: 6,
    };

    const result = transformMarketDataToGridRow(data);

    expect(result.Time).toBeNull();
  });

  it('should handle missing LastTradeprice', () => {
    const data: MarketData = {
      Id: '3Y',
      MarketId: 6,
    };

    const result = transformMarketDataToGridRow(data);

    expect(result.LastTradePrice).toBeNull();
  });

  it('should default BidPricesUsed and AskPricesUsed to 0', () => {
    const data: MarketData = {
      Id: '1Y',
      MarketId: 7,
    };

    const result = transformMarketDataToGridRow(data);

    expect(result.BidPricesUsed).toBe(0);
    expect(result.AskPricesUsed).toBe(0);
  });

  it('should calculate spread correctly', () => {
    const data: MarketData = {
      Id: '10Y',
      MarketId: 1,
      Bid: [{ Price: 99.0, Qty: 100 }],
      Ask: [{ Price: 99.5, Qty: 200 }],
    };

    const result = transformMarketDataToGridRow(data);

    expect(result.Spread).toBeCloseTo(0.5, 5);
  });

  it('should convert timestamp to Date object', () => {
    const timestamp = 1700000000000;
    const data: MarketData = {
      Id: '10Y',
      MarketId: 1,
      Time: timestamp,
    };

    const result = transformMarketDataToGridRow(data);

    expect(result.Time).toEqual(new Date(timestamp));
  });
});
