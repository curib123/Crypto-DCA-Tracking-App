import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CoinGeckoMarketProvider } from "./coingecko.provider";
import { MarketController } from "./market.controller";
import { MARKET_PROVIDER } from "./market.provider";
import { MarketService } from "./market.service";

@Module({
  imports: [AuthModule],
  controllers: [MarketController],
  providers: [
    CoinGeckoMarketProvider,
    {
      provide: MARKET_PROVIDER,
      useExisting: CoinGeckoMarketProvider,
    },
    MarketService,
  ],
  exports: [MarketService],
})
export class MarketModule {}
