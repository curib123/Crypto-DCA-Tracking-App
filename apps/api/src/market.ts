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

@Injectable()
export class MarketService {
  async getPrices(symbols: string[], currency: string) {
    const cleanSymbols = [...new Set(symbols.map((value) => value.toUpperCase()))].filter(
      (symbol) => ASSETS[symbol],
    );

    if (!cleanSymbols.length) return {};

    const ids = cleanSymbols.map((symbol) => ASSETS[symbol]).join(",");
    const vs = currency.toLowerCase();
    const key = process.env.COINGECKO_API_KEY;
    const endpoint = new URL("https://api.coingecko.com/api/v3/simple/price");

    endpoint.searchParams.set("ids", ids);
    endpoint.searchParams.set("vs_currencies", vs);
    endpoint.searchParams.set("include_24hr_change", "true");

    const response = await fetch(endpoint, {
      headers: key ? { "x-cg-demo-api-key": key } : {},
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) throw new Error("Market provider unavailable");

    const data = (await response.json()) as Record<string, Record<string, number>>;

    return Object.fromEntries(
      cleanSymbols.map((symbol) => {
        const row = data[ASSETS[symbol]] || {};
        return [
          symbol,
          {
            symbol,
            price: Number(row[vs] || 0),
            change24h: Number(row[`${vs}_24h_change`] || 0),
            currency: currency.toUpperCase(),
          },
        ];
      }),
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
