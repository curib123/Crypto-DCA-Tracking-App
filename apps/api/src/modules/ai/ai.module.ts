import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PortfolioModule } from "../portfolio/portfolio.module";
import { AiInsightsController, AiInsightsService } from "./ai";

@Module({
  imports: [AuthModule, PortfolioModule],
  controllers: [AiInsightsController],
  providers: [AiInsightsService],
})
export class AiModule {}
