import { PrismaClient, TransactionType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@example.com";
  const passwordHash = await bcrypt.hash("demo12345", 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, baseCurrency: "USD" },
  });

  const count = await prisma.transaction.count({ where: { userId: user.id } });

  if (count === 0) {
    await prisma.transaction.createMany({
      data: [
        {
          userId: user.id,
          assetSymbol: "BTC",
          type: TransactionType.BUY,
          quantity: "0.0025",
          unitPrice: "88000",
          amountSpent: "220",
          quoteCurrency: "USD",
          fxRateToBase: "1",
          feeBase: "1.2",
          exchange: "Demo Exchange",
          occurredAt: new Date("2026-07-15T08:00:00Z"),
        },
        {
          userId: user.id,
          assetSymbol: "BTC",
          type: TransactionType.BUY,
          quantity: "0.0018",
          unitPrice: "94000",
          amountSpent: "169.2",
          quoteCurrency: "USD",
          fxRateToBase: "1",
          feeBase: "1",
          exchange: "Demo Exchange",
          occurredAt: new Date("2026-08-15T08:00:00Z"),
        },
        {
          userId: user.id,
          assetSymbol: "ETH",
          type: TransactionType.BUY,
          quantity: "0.08",
          unitPrice: "3600",
          amountSpent: "288",
          quoteCurrency: "USD",
          fxRateToBase: "1",
          feeBase: "1.1",
          occurredAt: new Date("2026-09-01T08:00:00Z"),
        }
      ]
    });
  }

  console.log("Demo account: demo@example.com / demo12345");
}

main().finally(() => prisma.$disconnect());
