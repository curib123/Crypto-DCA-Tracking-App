-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT', 'AIRDROP', 'REWARD', 'STAKING_REWARD', 'FEE', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "assetSymbol" TEXT NOT NULL,
  "type" "TransactionType" NOT NULL,
  "quantity" DECIMAL(36,18) NOT NULL,
  "unitPrice" DECIMAL(36,8) NOT NULL,
  "amountSpent" DECIMAL(36,8) NOT NULL,
  "quoteCurrency" TEXT NOT NULL,
  "fxRateToBase" DECIMAL(36,12) NOT NULL DEFAULT 1,
  "feeBase" DECIMAL(36,8) NOT NULL DEFAULT 0,
  "exchange" TEXT,
  "wallet" TEXT,
  "notes" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "Transaction_userId_occurredAt_idx" ON "Transaction"("userId", "occurredAt");
CREATE INDEX "Transaction_userId_assetSymbol_idx" ON "Transaction"("userId", "assetSymbol");

ALTER TABLE "Transaction"
ADD CONSTRAINT "Transaction_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
