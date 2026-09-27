export type MarketPrice = {
  symbol: string;
  price: number;
  change24h: number;
  currency: string;
  lastUpdatedAt: number;
};

export type MarketMatrix = Record<string, Record<string, MarketPrice>>;

export type MarketSelection = {
  prices: Record<string, MarketPrice>;
  stale: boolean;
  fetchedAt: string;
  source: string;
};
