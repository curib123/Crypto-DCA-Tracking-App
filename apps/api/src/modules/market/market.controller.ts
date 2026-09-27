import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { MarketService } from "./market.service";

@Controller("market")
@UseGuards(JwtAuthGuard)
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
