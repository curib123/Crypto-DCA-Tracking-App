import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  SUPPORTED_ASSETS,
  SUPPORTED_MARKET_CURRENCIES,
} from "./market.constants";
import { MARKET_PROVIDER, MarketProvider } from "./market.provider";
import { MarketMatrix, MarketSelection } from "./market.types";

type Snapshot = {
  matrix: MarketMatrix;
  fetchedAt: number;
  expiresAt: number;
};

@Injectable()
export class MarketService {
  private readonly ttlMs = 15 * 60_000;
  private readonly maxStaleMs = 24 * 60 * 60_000;
  private readonly circuitBreakMs = 2 * 60_000;

  private snapshot: Snapshot | null = null;
  private refreshPromise: Promise<Snapshot> | null = null;
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;

  constructor(
    @Inject(MARKET_PROVIDER)
    private readonly provider: MarketProvider,
  ) {}

  async getPrices(symbols: string[], currency: string): Promise<MarketSelection> {
    const cleanSymbols = [...new Set(symbols.map((value) => value.trim().toUpperCase()))].filter(
      (symbol) => SUPPORTED_ASSETS[symbol],
    );
    const cleanCurrency = currency.trim().toUpperCase();

    if (!cleanSymbols.length) {
      throw new BadRequestException("No supported assets requested.");
    }

    if (!SUPPORTED_MARKET_CURRENCIES.includes(cleanCurrency as any)) {
      throw new BadRequestException("Unsupported market currency.");
    }

    const now = Date.now();

    if (this.snapshot && this.snapshot.expiresAt > now) {
      return this.select(this.snapshot, cleanSymbols, cleanCurrency, false);
    }

    if (this.snapshot && now - this.snapshot.fetchedAt <= this.maxStaleMs) {
      if (now >= this.circuitOpenUntil) {
        void this.refresh().catch(() => undefined);
      }

      return this.select(this.snapshot, cleanSymbols, cleanCurrency, true);
    }

    if (now < this.circuitOpenUntil) {
      throw new ServiceUnavailableException("Market provider circuit is temporarily open.");
    }

    const fresh = await this.refresh();
    return this.select(fresh, cleanSymbols, cleanCurrency, false);
  }

  private async refresh() {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = this.fetchAndStore();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async fetchAndStore(): Promise<Snapshot> {
    try {
      const matrix = await this.provider.fetchSnapshot();
      const now = Date.now();

      const snapshot: Snapshot = {
        matrix,
        fetchedAt: now,
        expiresAt: now + this.ttlMs,
      };

      this.snapshot = snapshot;
      this.consecutiveFailures = 0;
      this.circuitOpenUntil = 0;

      return snapshot;
    } catch (error) {
      this.consecutiveFailures += 1;

      if (this.consecutiveFailures >= 3) {
        this.circuitOpenUntil = Date.now() + this.circuitBreakMs;
      }

      if (
        this.snapshot &&
        Date.now() - this.snapshot.fetchedAt <= this.maxStaleMs
      ) {
        return this.snapshot;
      }

      throw new ServiceUnavailableException(
        error instanceof Error ? error.message : "Market provider unavailable.",
      );
    }
  }

  private select(
    snapshot: Snapshot,
    symbols: string[],
    currency: string,
    stale: boolean,
  ): MarketSelection {
    const prices = Object.fromEntries(
      symbols
        .map((symbol) => [symbol, snapshot.matrix[symbol]?.[currency]])
        .filter(([, price]) => Boolean(price)),
    );

    return {
      prices,
      stale,
      fetchedAt: new Date(snapshot.fetchedAt).toISOString(),
      source: this.provider.sourceName,
    };
  }
}
