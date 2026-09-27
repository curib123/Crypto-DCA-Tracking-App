export const SUPPORTED_CURRENCIES = [
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

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export function isSupportedCurrency(value: string): value is SupportedCurrency {
  return SUPPORTED_CURRENCIES.includes(value.toUpperCase() as SupportedCurrency);
}
