export type TransactionType =
  | "BUY"
  | "SELL"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "AIRDROP"
  | "REWARD"
  | "STAKING_REWARD"
  | "FEE"
  | "ADJUSTMENT";

export interface LedgerTransaction {
  id?: string;
  type: TransactionType;
  quantity: number;
  amountBase: number;
  feeBase: number;
  occurredAt: string | Date;
}

export interface AssetPosition {
  quantity: number;
  totalBuyContributions: number;
  remainingCostBasis: number;
  averageEntry: number;
  breakEven: number;
  realizedPnl: number;
  totalFees: number;
  buyCount: number;
}

const positive = (value: number) => Number.isFinite(value) && value > 0;

export function calculateAssetPosition(input: LedgerTransaction[]): AssetPosition {
  const rows = [...input].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );

  let quantity = 0;
  let costBasis = 0;
  let realizedPnl = 0;
  let totalBuyContributions = 0;
  let totalFees = 0;
  let buyCount = 0;

  for (const row of rows) {
    const qty = Number(row.quantity) || 0;
    const amount = Number(row.amountBase) || 0;
    const fee = Number(row.feeBase) || 0;
    totalFees += Math.max(0, fee);

    if (row.type === "BUY") {
      if (!positive(qty)) continue;
      quantity += qty;
      costBasis += Math.max(0, amount) + Math.max(0, fee);
      totalBuyContributions += Math.max(0, amount) + Math.max(0, fee);
      buyCount += 1;
      continue;
    }

    if (row.type === "SELL") {
      if (!positive(qty) || quantity <= 0) continue;
      const sold = Math.min(qty, quantity);
      const averageCost = costBasis / quantity;
      const removedCost = averageCost * sold;
      const proceeds = Math.max(0, amount) - Math.max(0, fee);
      realizedPnl += proceeds - removedCost;
      quantity -= sold;
      costBasis = Math.max(0, costBasis - removedCost);
      continue;
    }

    if (
      row.type === "AIRDROP" ||
      row.type === "REWARD" ||
      row.type === "STAKING_REWARD" ||
      row.type === "TRANSFER_IN"
    ) {
      quantity += Math.max(0, qty);
      continue;
    }

    if (row.type === "TRANSFER_OUT") {
      quantity = Math.max(0, quantity - Math.max(0, qty));
      continue;
    }

    if (row.type === "FEE" && qty > 0 && quantity > 0) {
      const removed = Math.min(qty, quantity);
      const averageCost = costBasis / quantity;
      costBasis = Math.max(0, costBasis - averageCost * removed);
      quantity -= removed;
    }
  }

  const averageEntry = quantity > 0 ? costBasis / quantity : 0;

  return {
    quantity,
    totalBuyContributions,
    remainingCostBasis: costBasis,
    averageEntry,
    breakEven: averageEntry,
    realizedPnl,
    totalFees,
    buyCount,
  };
}

export function percentageChange(current: number, basis: number): number {
  if (!basis) return 0;
  return ((current - basis) / basis) * 100;
}
