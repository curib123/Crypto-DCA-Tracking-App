import { Controller, Get, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { MarketService } from "./market.service";

@Controller("market")
export class MarketController {
  constructor(private readonly market: MarketService) {}

  @Get("prices")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  prices(
    @Query("symbols") symbols = "BTC,ETH,SOL,BNB,LINK,HYPE,XLM",
    @Query("currency") currency = "USD",
  ) {
    return this.market.getPrices(symbols.split(","), currency);
  }
}
