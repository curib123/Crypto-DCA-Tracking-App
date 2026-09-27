import { Module } from "@nestjs/common";
import { MarketModule } from "../market/market.module";
import { PortfolioController, PortfolioService } from "./portfolio";

@Module({
  imports: [MarketModule],
  controllers: [PortfolioController],
  providers: [PortfolioService],
})
export class PortfolioModule {}
