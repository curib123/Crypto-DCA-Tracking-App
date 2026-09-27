import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  SUPPORTED_ASSETS,
  SUPPORTED_MARKET_CURRENCIES,
  providerCurrency,
} from "./market.constants";
import { MarketProvider } from "./market.provider";
import { MarketMatrix } from "./market.types";

@Injectable()
export class CoinGeckoMarketProvider implements MarketProvider {
  readonly sourceName = "CoinGecko";
  private readonly demoKey: string;

  constructor(config: ConfigService) {
    this.demoKey = String(config.get("COINGECKO_DEMO_API_KEY") || "").trim();
  }

  async fetchSnapshot(): Promise<MarketMatrix> {
    const providerCurrencies = [
      ...new Set(SUPPORTED_MARKET_CURRENCIES.map((currency) => providerCurrency(currency).toLowerCase())),
    ];

    const endpoint = new URL("https://api.coingecko.com/api/v3/simple/price");
    endpoint.searchParams.set("ids", Object.values(SUPPORTED_ASSETS).join(","));
    endpoint.searchParams.set("vs_currencies", providerCurrencies.join(","));
    endpoint.searchParams.set("include_24hr_change", "true");
    endpoint.searchParams.set("include_last_updated_at", "true");

    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(5000),
      headers: {
        accept: "application/json",
        "user-agent": "Crypto-DCA-Tracking-App/1.0",
        ...(this.demoKey ? { "x-cg-demo-api-key": this.demoKey } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`CoinGecko returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as Record<string, Record<string, number>>;
    const matrix: MarketMatrix = {};

    for (const [symbol, coinId] of Object.entries(SUPPORTED_ASSETS)) {
      const row = data[coinId] || {};
      matrix[symbol] = {};

      for (const currency of SUPPORTED_MARKET_CURRENCIES) {
        const providerCode = providerCurrency(currency).toLowerCase();

        matrix[symbol][currency] = {
          symbol,
          price: Number(row[providerCode] || 0),
          change24h: Number(row[`${providerCode}_24h_change`] || 0),
          currency,
          lastUpdatedAt: Number(row.last_updated_at || 0),
        };
      }
    }

    return matrix;
  }
}
