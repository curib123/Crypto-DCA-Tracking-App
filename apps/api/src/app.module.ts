import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthController, AuthService, JwtAuthGuard } from "./auth";
import { HealthController } from "./health";
import { MarketController, MarketService } from "./market";
import { PortfolioController, PortfolioService } from "./portfolio";
import { PrismaService } from "./prisma.service";
import { TransactionsController, TransactionsService } from "./transactions";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
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
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
