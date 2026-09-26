import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { AuthController, AuthService, JwtAuthGuard } from "./auth";
import { HealthController } from "./health";
import { MarketController, MarketService } from "./market";
import { PortfolioController, PortfolioService } from "./portfolio";
import { PrismaService } from "./prisma.service";
import { TransactionsController, TransactionsService } from "./transactions";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET") || "dev-only-change-me",
        signOptions: { expiresIn: "7d" },
      }),
    }),
  ],
  controllers: [
    HealthController,
    AuthController,
    TransactionsController,
    PortfolioController,
    MarketController,
  ],
  providers: [
    PrismaService,
    AuthService,
    JwtAuthGuard,
    TransactionsService,
    PortfolioService,
    MarketService,
  ],
})
export class AppModule {}
