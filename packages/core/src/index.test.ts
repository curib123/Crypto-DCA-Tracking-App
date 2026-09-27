import assert from "node:assert/strict";
import test from "node:test";
import { calculateAssetPosition } from "./index";

test("weighted average uses contribution and quantity", () => {
  const result = calculateAssetPosition([
    { type: "BUY", quantity: 1, amountBase: 100, feeBase: 0, occurredAt: "2026-01-01" },
    { type: "BUY", quantity: 1, amountBase: 200, feeBase: 0, occurredAt: "2026-01-02" },
  ]);
  assert.equal(result.quantity, 2);
  assert.equal(result.averageEntry, 150);
});

test("sell realizes pnl and removes cost at weighted average", () => {
  const result = calculateAssetPosition([
    { type: "BUY", quantity: 2, amountBase: 200, feeBase: 0, occurredAt: "2026-01-01" },
    { type: "SELL", quantity: 1, amountBase: 150, feeBase: 0, occurredAt: "2026-01-02" },
  ]);
  assert.equal(result.quantity, 1);
  assert.equal(result.remainingCostBasis, 100);
  assert.equal(result.realizedPnl, 50);
});


test("wallet transfers do not change aggregate quantity or cost basis", () => {
  const result = calculateAssetPosition([
    { type: "BUY", quantity: 1, amountBase: 100, feeBase: 0, occurredAt: "2026-01-01" },
    { type: "TRANSFER_OUT", quantity: 1, amountBase: 0, feeBase: 0, occurredAt: "2026-01-02" },
    { type: "TRANSFER_IN", quantity: 1, amountBase: 0, feeBase: 0, occurredAt: "2026-01-03" },
  ]);
  assert.equal(result.quantity, 1);
  assert.equal(result.remainingCostBasis, 100);
  assert.equal(result.averageEntry, 100);
});


test("oversized sell data cannot inflate realized pnl", () => {
  const result = calculateAssetPosition([
    { type: "BUY", quantity: 1, amountBase: 100, feeBase: 0, occurredAt: "2026-01-01" },
    { type: "SELL", quantity: 2, amountBase: 300, feeBase: 0, occurredAt: "2026-01-02" },
  ]);
  assert.equal(result.quantity, 0);
  assert.equal(result.realizedPnl, 50);
});


test("positive adjustment adds corrected quantity and historical basis without a DCA buy", () => {
  const result = calculateAssetPosition([
    { type: "ADJUSTMENT", quantity: 0.5, amountBase: 50, feeBase: 0, occurredAt: "2026-01-01" },
  ]);
  assert.equal(result.quantity, 0.5);
  assert.equal(result.remainingCostBasis, 50);
  assert.equal(result.averageEntry, 100);
  assert.equal(result.buyCount, 0);
});
