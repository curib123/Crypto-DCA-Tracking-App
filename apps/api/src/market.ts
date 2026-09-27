import { Controller, Get, Injectable, Query } from "@nestjs/common";

const ASSETS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  LINK: "chainlink",
  HYPE: "hyperliquid",
  XLM: "stellar",
};

type CachedMarket = {
  expiresAt: number;
  data: Record<string, unknown>;
};

@Injectable()
export class MarketService {
  private readonly cache = new Map<string, CachedMarket>();
  private readonly ttlMs = 15 * 60_000;

  async getPrices(symbols: string[], currency: string) {
    const cleanSymbols = [...new Set(symbols.map((value) => value.toUpperCase()))].filter(
      (symbol) => ASSETS[symbol],
    );

    if (!cleanSymbols.length) return {};

    const requestedCurrency = currency.toLowerCase();
    const vs = ["usdt", "usdc"].includes(requestedCurrency) ? "usd" : requestedCurrency;
    const cacheKey = requestedCurrency;
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return Object.fromEntries(
        cleanSymbols
          .filter((symbol) => cached.data[symbol])
          .map((symbol) => [symbol, cached.data[symbol]]),
      );
    }

    // Fetch all supported assets in one credit so different portfolios can
    // share the same cached market snapshot for this display currency.
    const allSymbols = Object.keys(ASSETS);
    const ids = allSymbols.map((symbol) => ASSETS[symbol]).join(",");
    const endpoint = new URL("https://api.coingecko.com/api/v3/simple/price");

    endpoint.searchParams.set("ids", ids);
    endpoint.searchParams.set("vs_currencies", vs);
    endpoint.searchParams.set("include_24hr_change", "true");
    endpoint.searchParams.set("include_last_updated_at", "true");

    // The optional Demo key is free ($0 plan). Without it, the app attempts
    // CoinGecko's public/keyless access and gracefully falls back if unavailable.
    const demoKey = process.env.COINGECKO_DEMO_API_KEY;
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(5000),
      headers: {
        "accept": "application/json",
        "user-agent": "Crypto-DCA-Tracking-App/1.0",
        ...(demoKey ? { "x-cg-demo-api-key": demoKey } : {}),
      },
    });

    if (!response.ok) throw new Error("Market provider unavailable");

    const data = (await response.json()) as Record<string, Record<string, number>>;

    const normalized = Object.fromEntries(
      allSymbols.map((symbol) => {
        const row = data[ASSETS[symbol]] || {};
        return [
          symbol,
          {
            symbol,
            price: Number(row[vs] || 0),
            change24h: Number(row[`${vs}_24h_change`] || 0),
            currency: currency.toUpperCase(),
            lastUpdatedAt: Number(row.last_updated_at || 0),
          },
        ];
      }),
    );

    this.cache.set(cacheKey, {
      expiresAt: Date.now() + this.ttlMs,
      data: normalized,
    });

    return Object.fromEntries(
      cleanSymbols
        .filter((symbol) => normalized[symbol])
        .map((symbol) => [symbol, normalized[symbol]]),
    );
  }
}

@Controller("market")
export class MarketController {
  constructor(private readonly market: MarketService) {}

  @Get("prices")
  async prices(
    @Query("symbols") symbols = "BTC,ETH,SOL,BNB,LINK,HYPE,XLM",
    @Query("currency") currency = "USD",
  ) {
    try {
      return {
        source: "CoinGecko",
        prices: await this.market.getPrices(symbols.split(","), currency),
        fetchedAt: new Date().toISOString(),
      };
    } catch {
      return {
        source: "unavailable",
        prices: {},
        fetchedAt: new Date().toISOString(),
      };
    }
  }
}
