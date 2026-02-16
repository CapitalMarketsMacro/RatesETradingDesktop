/**
 * Trading glossary — ~40 terms covering market types, instruments, concepts, venues, and acronyms.
 */

export interface GlossaryEntry {
  term: string;
  category: 'market-type' | 'instrument' | 'trading-concept' | 'venue' | 'acronym' | 'technology';
  definition: string;
  aliases?: string[];
  relatedTerms?: string[];
}

export const GLOSSARY: GlossaryEntry[] = [
  // ── Market Types ──
  {
    term: 'D2D',
    category: 'market-type',
    definition: 'Dealer-to-Dealer. Interbank market where primary dealers trade US Treasuries with each other, typically via electronic platforms like BrokerTec or voice brokers.',
    aliases: ['Dealer to Dealer', 'Interdealer'],
    relatedTerms: ['D2C', 'BrokerTec', 'Voice Brokered'],
  },
  {
    term: 'D2C',
    category: 'market-type',
    definition: 'Dealer-to-Client. Market segment where dealers provide liquidity to buy-side clients (asset managers, hedge funds, insurance companies) via platforms like TradeWeb or Bloomberg.',
    aliases: ['Dealer to Client', 'Client-facing'],
    relatedTerms: ['D2D', 'TradeWeb', 'RFQ'],
  },
  {
    term: 'Voice Brokered',
    category: 'market-type',
    definition: 'Trades executed through voice (phone) communication with an inter-dealer broker (IDB). Common for illiquid or large-size trades.',
    relatedTerms: ['D2D', 'IDB', 'BGC', 'GFI', 'ICAP'],
  },
  {
    term: 'Electronic Trading',
    category: 'market-type',
    definition: 'Fully automated trade execution via electronic platforms. Encompasses both D2D (BrokerTec, eSpeed) and D2C (TradeWeb, Bloomberg) venues.',
    relatedTerms: ['D2D', 'D2C', 'BrokerTec', 'TradeWeb'],
  },

  // ── Instruments ──
  {
    term: 'Treasury Bond',
    category: 'instrument',
    definition: 'US government debt security with maturity greater than 10 years (typically 20Y or 30Y). Pays semi-annual coupon. Priced in 32nds.',
    aliases: ['T-Bond', 'Long Bond'],
    relatedTerms: ['Treasury Note', 'Treasury Bill', '32nds'],
  },
  {
    term: 'Treasury Note',
    category: 'instrument',
    definition: 'US government debt security with maturity between 2 and 10 years (2Y, 3Y, 5Y, 7Y, 10Y). Pays semi-annual coupon. Most actively traded maturities.',
    aliases: ['T-Note'],
    relatedTerms: ['Treasury Bond', 'Treasury Bill', '32nds'],
  },
  {
    term: 'Treasury Bill',
    category: 'instrument',
    definition: 'US government short-term debt security with maturity of 1 year or less (4W, 8W, 13W, 26W, 52W). Sold at a discount to par; does not pay coupon.',
    aliases: ['T-Bill'],
    relatedTerms: ['Treasury Note', 'Discount Yield'],
  },
  {
    term: 'TIPS',
    category: 'instrument',
    definition: 'Treasury Inflation-Protected Securities. US government bonds whose principal adjusts with the CPI. Protects investors against inflation.',
    aliases: ['Inflation-Protected'],
    relatedTerms: ['Treasury Bond', 'CPI', 'Real Yield'],
  },
  {
    term: 'eSwap',
    category: 'instrument',
    definition: 'Electronically traded interest rate swap. Allows exchange of fixed vs floating rate payments. Traded on SEFs (Swap Execution Facilities).',
    aliases: ['Electronic Swap', 'IRS'],
    relatedTerms: ['SEF', 'Fixed Rate', 'Floating Rate', 'Spread'],
  },
  {
    term: 'FRN',
    category: 'instrument',
    definition: 'Floating Rate Note. Treasury security with a variable coupon tied to the 13-week T-Bill auction rate. 2-year maturity.',
    aliases: ['Floating Rate Note', 'Floater'],
    relatedTerms: ['Treasury Bill', 'Coupon'],
  },

  // ── Trading Concepts ──
  {
    term: 'RFQ',
    category: 'trading-concept',
    definition: 'Request for Quote. Client sends a request to one or more dealers asking for a price on a specific security. Core D2C workflow.',
    aliases: ['Request for Quote'],
    relatedTerms: ['D2C', 'IOI', 'TradeWeb'],
  },
  {
    term: 'IOI',
    category: 'trading-concept',
    definition: 'Indication of Interest. Pre-trade signal from a dealer showing willingness to trade at approximate size/price. Not a firm quote.',
    aliases: ['Indication of Interest'],
    relatedTerms: ['RFQ', 'D2C'],
  },
  {
    term: 'Hit',
    category: 'trading-concept',
    definition: 'To sell to a displayed bid price. The aggressor "hits" the bid. Opposite of "lift".',
    relatedTerms: ['Lift', 'Bid', 'Aggressor'],
  },
  {
    term: 'Lift',
    category: 'trading-concept',
    definition: 'To buy at a displayed offer/ask price. The aggressor "lifts" the offer. Opposite of "hit".',
    relatedTerms: ['Hit', 'Ask', 'Aggressor'],
  },
  {
    term: 'SOW',
    category: 'trading-concept',
    definition: 'State of the World. AMPS feature that provides the current snapshot of all records for a topic before streaming live updates. Ensures clients start with complete state.',
    aliases: ['State of World', 'State of the World'],
    relatedTerms: ['AMPS', 'Snapshot', 'sowAndSubscribe'],
  },
  {
    term: '32nds',
    category: 'trading-concept',
    definition: 'Treasury pricing convention. Prices quoted as handle + 32nds (e.g., 99-16 = 99 + 16/32 = 99.5). Half-32nds shown as "+" (99-16+ = 99 + 16.5/32). Quarter-32nds shown with trailing digit.',
    aliases: ['Thirty-seconds', '32nds Pricing'],
    relatedTerms: ['Treasury Bond', 'Treasury Note', 'Handle'],
  },
  {
    term: 'Spread',
    category: 'trading-concept',
    definition: 'The difference between bid and ask prices. Can also refer to the yield difference between two securities (e.g., 2s10s spread = 10Y yield minus 2Y yield).',
    relatedTerms: ['Bid', 'Ask', 'Yield Curve'],
  },
  {
    term: 'Yield',
    category: 'trading-concept',
    definition: 'The annualized return on a bond, expressed as a percentage. Yield moves inversely to price. Key types: current yield, yield-to-maturity (YTM).',
    relatedTerms: ['Price', 'Coupon', 'Duration'],
  },
  {
    term: 'Coupon',
    category: 'trading-concept',
    definition: 'The fixed interest payment on a bond, expressed as an annual percentage of face value. Treasury coupons are paid semi-annually.',
    relatedTerms: ['Yield', 'Par', 'Face Value'],
  },
  {
    term: 'Duration',
    category: 'trading-concept',
    definition: 'A measure of a bond\'s sensitivity to interest rate changes. Modified duration approximates the percentage price change for a 1% change in yield.',
    relatedTerms: ['DV01', 'Yield', 'Convexity'],
  },
  {
    term: 'DV01',
    category: 'trading-concept',
    definition: 'Dollar Value of 01. The dollar change in a bond\'s price for a 1 basis point (0.01%) change in yield. Key risk metric for hedging.',
    aliases: ['Dollar Value of a Basis Point', 'PVBP'],
    relatedTerms: ['Duration', 'PVBP', 'Basis Point'],
  },
  {
    term: 'PVBP',
    category: 'trading-concept',
    definition: 'Price Value of a Basis Point. Same as DV01 — the dollar change in price for a 1bp yield move. Used interchangeably with DV01.',
    aliases: ['Price Value of Basis Point'],
    relatedTerms: ['DV01', 'Duration'],
  },
  {
    term: 'Basis Point',
    category: 'trading-concept',
    definition: 'One hundredth of a percentage point (0.01%). Used to express yield changes. 100 basis points = 1%.',
    aliases: ['bp', 'bps'],
    relatedTerms: ['DV01', 'Yield'],
  },
  {
    term: 'Handle',
    category: 'trading-concept',
    definition: 'The integer portion of a Treasury price. E.g., in 99-16 the handle is 99. Traders often drop the handle when quoting ("at 16").',
    relatedTerms: ['32nds', 'Price'],
  },
  {
    term: 'On-the-Run',
    category: 'trading-concept',
    definition: 'The most recently auctioned Treasury security for a given maturity. Most liquid and actively traded. Opposite of "off-the-run".',
    aliases: ['OTR'],
    relatedTerms: ['Off-the-Run', 'Auction', 'Benchmark'],
  },
  {
    term: 'Off-the-Run',
    category: 'trading-concept',
    definition: 'Any Treasury security that is not the most recently auctioned for its maturity. Less liquid than on-the-run issues.',
    aliases: ['OFR'],
    relatedTerms: ['On-the-Run'],
  },

  // ── Venues ──
  {
    term: 'BrokerTec',
    category: 'venue',
    definition: 'Primary electronic D2D trading platform for US Treasuries, owned by CME Group. Supports central limit order book (CLOB) trading for benchmark maturities.',
    relatedTerms: ['D2D', 'CLOB', 'CME'],
  },
  {
    term: 'TradeWeb',
    category: 'venue',
    definition: 'Major D2C electronic trading platform for rates products. Supports RFQ, click-to-trade, and streaming protocols for Treasuries, swaps, and other fixed income.',
    relatedTerms: ['D2C', 'RFQ'],
  },
  {
    term: 'BGC',
    category: 'venue',
    definition: 'BGC Partners. Inter-dealer broker providing voice and electronic brokerage for rates and other fixed income products.',
    aliases: ['BGC Partners'],
    relatedTerms: ['IDB', 'Voice Brokered'],
  },
  {
    term: 'GFI',
    category: 'venue',
    definition: 'GFI Group. Inter-dealer broker for fixed income, now part of BGC Partners. Provides hybrid voice/electronic execution.',
    relatedTerms: ['IDB', 'BGC'],
  },
  {
    term: 'ICAP',
    category: 'venue',
    definition: 'TP ICAP. Largest inter-dealer broker globally. Provides voice and electronic brokerage for Treasuries, swaps, and repos.',
    aliases: ['TP ICAP'],
    relatedTerms: ['IDB', 'Voice Brokered'],
  },
  {
    term: 'Bloomberg',
    category: 'venue',
    definition: 'Bloomberg LP. Provides both market data (Bloomberg Terminal) and D2C electronic trading (Bloomberg Trade Execution) for rates products.',
    relatedTerms: ['D2C', 'Market Data'],
  },

  // ── Acronyms / Technology ──
  {
    term: 'AMPS',
    category: 'technology',
    definition: 'Advanced Message Processing System by 60East Technologies. High-performance publish-subscribe messaging with SOW (State of World), delta publish, and content filtering. Primary messaging layer for this application.',
    aliases: ['Advanced Message Processing System'],
    relatedTerms: ['SOW', 'NATS', 'Solace'],
  },
  {
    term: 'NATS',
    category: 'technology',
    definition: 'Cloud-native messaging system used as a fallback/alternative transport. Supports pub/sub, request/reply, and JetStream persistence.',
    relatedTerms: ['AMPS', 'Solace'],
  },
  {
    term: 'Solace',
    category: 'technology',
    definition: 'Solace PubSub+. Enterprise event broker supporting AMQP, MQTT, JMS, and REST. Used as an alternative transport layer.',
    aliases: ['Solace PubSub+'],
    relatedTerms: ['AMPS', 'NATS'],
  },
  {
    term: 'OMS',
    category: 'acronym',
    definition: 'Order Management System. Manages the lifecycle of trading orders from creation through execution and settlement.',
    aliases: ['Order Management System'],
    relatedTerms: ['EMS', 'FIX'],
  },
  {
    term: 'EMS',
    category: 'acronym',
    definition: 'Execution Management System. Handles the real-time execution of orders, routing to venues, and fills management.',
    aliases: ['Execution Management System'],
    relatedTerms: ['OMS', 'FIX'],
  },
  {
    term: 'FIX',
    category: 'acronym',
    definition: 'Financial Information eXchange protocol. Industry-standard messaging format for trade-related communication between financial institutions.',
    aliases: ['Financial Information eXchange'],
    relatedTerms: ['OMS', 'EMS'],
  },
  {
    term: 'CUSIP',
    category: 'acronym',
    definition: 'Committee on Uniform Securities Identification Procedures. Nine-character alphanumeric identifier for North American securities.',
    relatedTerms: ['ISIN', 'Treasury Bond'],
  },
  {
    term: 'IDB',
    category: 'acronym',
    definition: 'Inter-Dealer Broker. Intermediary that facilitates trading between dealers in the D2D market, via voice or electronic means.',
    aliases: ['Inter-Dealer Broker'],
    relatedTerms: ['D2D', 'BGC', 'ICAP', 'GFI'],
  },
  {
    term: 'SEF',
    category: 'acronym',
    definition: 'Swap Execution Facility. Regulated venue for trading swaps electronically, mandated by Dodd-Frank for standardized swaps.',
    aliases: ['Swap Execution Facility'],
    relatedTerms: ['eSwap', 'Dodd-Frank'],
  },
];

export const GLOSSARY_CATEGORIES = [
  'market-type',
  'instrument',
  'trading-concept',
  'venue',
  'acronym',
  'technology',
] as const;

export type GlossaryCategory = (typeof GLOSSARY_CATEGORIES)[number];
