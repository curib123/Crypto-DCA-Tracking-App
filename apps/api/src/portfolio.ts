import { Controller, Get, Injectable, Req, UseGuards } from "@nestjs/common";
import { calculateAssetPosition, percentageChange } from "@crypto-dca/core";
import { JwtAuthGuard } from "./auth";
import { MarketService } from "./market";
import { PrismaService } from "./prisma.service";

@Injectable()
export class PortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly market: MarketService,
  ) {}

  async summary(userId: string) {
    const [user, transactions] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { email: true, baseCurrency: true },
      }),
      this.prisma.transaction.findMany({
        where: { userId },
        orderBy: { occurredAt: "asc" },
      }),
    ]);

    const symbols = [...new Set(transactions.map((row) => row.assetSymbol))];

    let live: Record<string, any> = {};
    try {
      live = await this.market.getPrices(symbols, user.baseCurrency);
    } catch {
      live = {};
    }

    const assets = symbols.map((symbol) => {
      const rows = transactions.filter((row) => row.assetSymbol === symbol);

      const position = calculateAssetPosition(
        rows.map((row) => ({
          id: row.id,
          type: row.type,
          quantity: Number(row.quantity),
          amountBase: Number(row.amountSpent) * Number(row.fxRateToBase),
          feeBase: Number(row.feeBase),
          occurredAt: row.occurredAt,
        })),
      );

      const lastBuy = [...rows].reverse().find((row) => row.type === "BUY");
      const fallbackPrice = lastBuy
        ? Number(lastBuy.unitPrice) * Number(lastBuy.fxRateToBase)
        : 0;
      const currentPrice = Number(live[symbol]?.price || fallbackPrice);
      const currentValue = currentPrice * position.quantity;
      const unrealizedPnl = currentValue - position.remainingCostBasis;

      return {
        symbol,
        ...position,
        currentPrice,
        currentValue,
        unrealizedPnl,
        returnPct: percentageChange(currentValue, position.remainingCostBasis),
        marketSource: live[symbol] ? "live" : "last-entry-fallback",
      };
    });

    const totals = assets.reduce(
      (acc, asset) => {
        acc.invested += asset.totalBuyContributions;
        acc.currentValue += asset.currentValue;
        acc.unrealizedPnl += asset.unrealizedPnl;
        acc.realizedPnl += asset.realizedPnl;
        acc.fees += asset.totalFees;
        return acc;
      },
      { invested: 0, currentValue: 0, unrealizedPnl: 0, realizedPnl: 0, fees: 0 },
    );

    return {
      currency: user.baseCurrency,
      user: { email: user.email },
      totals: {
        ...totals,
        lifetimePnl: totals.unrealizedPnl + totals.realizedPnl,
        returnPct: percentageChange(totals.currentValue, totals.invested),
      },
      assets,
    };
  }
}

@Controller("portfolio")
@UseGuards(JwtAuthGuard)
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get("summary")
  summary(@Req() req: any) {
    return this.portfolio.summary(req.user.id);
  }
}
