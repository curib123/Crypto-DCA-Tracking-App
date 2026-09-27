import {
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
} from "../../common/currency.constants";

export const SUPPORTED_ASSETS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  LINK: "chainlink",
  HYPE: "hyperliquid",
  XLM: "stellar",
};

export const SUPPORTED_MARKET_CURRENCIES = SUPPORTED_CURRENCIES;
export type SupportedMarketCurrency = SupportedCurrency;

export function providerCurrency(currency: string) {
  const upper = currency.toUpperCase();
  return upper === "USDT" || upper === "USDC" ? "USD" : upper;
}
