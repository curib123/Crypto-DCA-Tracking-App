import { Controller, Get, Injectable, Req, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PortfolioService } from "../portfolio/portfolio";

type Insight = {
  id: string;
  title: string;
  body: string;
  kind: "info" | "attention" | "positive";
};

@Injectable()
export class AiInsightsService {
  private readonly cache = new Map<string, { expiresAt: number; value: any }>();

  constructor(
    private readonly portfolio: PortfolioService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private deterministic(summary: any, buyDates: Date[]): Insight[] {
    const insights: Insight[] = [];
    const totalValue = Number(summary.totals.currentValue || 0);
    const assets = [...summary.assets].sort((a: any, b: any) => b.currentValue - a.currentValue);

    if (assets.length && totalValue > 0) {
      const top = assets[0];
      const allocation = (Number(top.currentValue) / totalValue) * 100;
      insights.push({
        id: "allocation",
        title: allocation >= 60 ? "Portfolio concentration is high" : "Largest portfolio allocation",
        body: `${top.symbol} represents ${allocation.toFixed(1)}% of your tracked portfolio value. This is a concentration observation, not a buy or sell recommendation.`,
        kind: allocation >= 60 ? "attention" : "info",
      });
    }

    if (buyDates.length >= 2) {
      const sorted = [...buyDates].sort((a, b) => a.getTime() - b.getTime());
      const gaps = sorted.slice(1).map((date, index) =>
        (date.getTime() - sorted[index].getTime()) / (24 * 60 * 60 * 1000),
      );
      const averageDays = gaps.reduce((sum, value) => sum + value, 0) / gaps.length;
      insights.push({
        id: "cadence",
        title: "Your recent DCA cadence",
        body: `Your recorded buys are about ${averageDays.toFixed(1)} days apart on average. Use this as a consistency check against your intended DCA schedule.`,
        kind: "info",
      });
    }

    const invested = Number(summary.totals.invested || 0);
    const fees = Number(summary.totals.fees || 0);
    if (invested > 0) {
      const feeRate = (fees / invested) * 100;
      insights.push({
        id: "fees",
        title: "Tracked fee impact",
        body: `Recorded fees equal about ${feeRate.toFixed(2)}% of total buy contributions in your ledger.`,
        kind: feeRate > 2 ? "attention" : "info",
      });
    }

    const profitable = summary.assets.filter((asset: any) => Number(asset.unrealizedPnl) >= 0).length;
    if (summary.assets.length) {
      insights.push({
        id: "positions",
        title: "Position snapshot",
        body: `${profitable} of ${summary.assets.length} tracked positions currently have non-negative unrealized P/L based on the latest available market snapshot.`,
        kind: profitable === summary.assets.length ? "positive" : "info",
      });
    }

    return insights.slice(0, 4);
  }

  private async aiNarrative(summary: any, insights: Insight[]) {
    const url = String(this.config.get("AI_API_URL") || "").trim();
    const model = String(this.config.get("AI_MODEL") || "").trim();
    if (!url || !model) return null;

    const key = String(this.config.get("AI_API_KEY") || "").trim();
    const context = {
      currency: summary.currency,
      totals: summary.totals,
      assets: summary.assets.map((asset: any) => ({
        symbol: asset.symbol,
        allocationValue: asset.currentValue,
        averageEntry: asset.averageEntry,
        currentPrice: asset.currentPrice,
        returnPct: asset.returnPct,
        buyCount: asset.buyCount,
      })),
      deterministicObservations: insights.map(({ title, body }) => ({ title, body })),
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(key ? { Authorization: `Bearer ${key}` } : {}),
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "You are NextFi Insights. Explain the user's supplied portfolio analytics in plain language. Never predict prices, promise returns, or tell the user to buy, sell, or hold. Focus on concentration, DCA consistency, fees, data quality, and what the numbers mean. Keep the response under 140 words.",
            },
            {
              role: "user",
              content: JSON.stringify(context),
            },
          ],
        }),
        signal: AbortSignal.timeout(12_000),
      });

      if (!response.ok) return null;
      const payload: any = await response.json();
      const value = payload?.choices?.[0]?.message?.content;
      return typeof value === "string" && value.trim() ? value.trim() : null;
    } catch {
      return null;
    }
  }

  async get(userId: string) {
    const cached = this.cache.get(userId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const [summary, buys] = await Promise.all([
      this.portfolio.summary(userId),
      this.prisma.transaction.findMany({
        where: { userId, type: "BUY" },
        orderBy: { occurredAt: "asc" },
        select: { occurredAt: true },
      }),
    ]);

    const insights = this.deterministic(summary, buys.map((row) => row.occurredAt));
    const narrative = await this.aiNarrative(summary, insights);
    const value = {
      generatedAt: new Date().toISOString(),
      mode: narrative ? "ai-assisted" : "analytics-only",
      narrative,
      insights,
      disclaimer:
        "These observations describe your tracked data. They are not financial advice, price predictions, or trade instructions.",
    };

    this.cache.set(userId, { expiresAt: Date.now() + 10 * 60 * 1000, value });
    return value;
  }
}

@Controller("ai")
@UseGuards(JwtAuthGuard)
export class AiInsightsController {
  constructor(private readonly insights: AiInsightsService) {}

  @Get("insights")
  @Throttle({ default: { limit: 12, ttl: 60 * 60 * 1000 } })
  get(@Req() req: any) {
    return this.insights.get(req.user.id);
  }
}
