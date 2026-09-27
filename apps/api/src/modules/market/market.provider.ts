import { MarketMatrix } from "./market.types";

export const MARKET_PROVIDER = Symbol("MARKET_PROVIDER");

export interface MarketProvider {
  fetchSnapshot(): Promise<MarketMatrix>;
  readonly sourceName: string;
}
