export const SUPPORTED_ASSETS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  LINK: "chainlink",
  HYPE: "hyperliquid",
  XLM: "stellar",
};

export const SUPPORTED_MARKET_CURRENCIES = [
  "USD",
  "PHP",
  "EUR",
  "GBP",
  "AUD",
  "CAD",
  "SGD",
  "JPY",
  "KRW",
  "MYR",
  "IDR",
  "THB",
  "USDT",
  "USDC",
] as const;

export type SupportedMarketCurrency = (typeof SUPPORTED_MARKET_CURRENCIES)[number];

export function providerCurrency(currency: string) {
  const upper = currency.toUpperCase();
  return upper === "USDT" || upper === "USDC" ? "USD" : upper;
}
