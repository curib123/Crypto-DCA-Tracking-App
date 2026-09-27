import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MarketModule } from "../market/market.module";
import { PortfolioController, PortfolioService } from "./portfolio";

@Module({
  imports: [AuthModule, MarketModule],
  controllers: [PortfolioController],
  providers: [PortfolioService],
  exports: [PortfolioService],
})
export class PortfolioModule {}
