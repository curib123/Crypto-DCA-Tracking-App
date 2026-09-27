import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerModule } from "@nestjs/throttler";
import { HealthController } from "./health";
import { DatabaseModule } from "./infrastructure/database/database.module";
import { SessionAwareThrottlerGuard } from "./infrastructure/rate-limit/session-aware-throttler.guard";
import { AuthModule } from "./modules/auth/auth.module";
import { MarketModule } from "./modules/market/market.module";
import { PortfolioModule } from "./modules/portfolio/portfolio.module";
import { TransactionsModule } from "./modules/transactions/transactions.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { ContentModule } from "./modules/content/content.module";
import { AdminModule } from "./modules/admin/admin.module";
import { AiModule } from "./modules/ai/ai.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>("JWT_SECRET");
        const production = config.get<string>("NODE_ENV") === "production";

        if (production && (!secret || secret.length < 32)) {
          throw new Error("JWT_SECRET must be set to at least 32 characters in production.");
        }

        return {
          secret: secret || "dev-only-change-me",
          signOptions: { expiresIn: "7d" },
        };
      },
    }),
    AuthModule,
    MarketModule,
    PortfolioModule,
    TransactionsModule,
    SettingsModule,
    ContentModule,
    AdminModule,
    AiModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: SessionAwareThrottlerGuard },
  ],
})
export class AppModule {}
