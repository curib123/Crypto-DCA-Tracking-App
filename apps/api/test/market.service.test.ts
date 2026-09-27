import assert from "node:assert/strict";
import test from "node:test";
import { MarketService } from "../src/modules/market/market.service";
import type { MarketProvider } from "../src/modules/market/market.provider";

class FakeProvider implements MarketProvider {
  readonly sourceName = "Fake";
  calls = 0;

  async fetchSnapshot() {
    this.calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));

    return {
      BTC: {
        USD: {
          symbol: "BTC",
          price: 100_000,
          change24h: 1.5,
          currency: "USD",
          lastUpdatedAt: 1_700_000_000,
        },
      },
    };
  }
}

test("concurrent market reads share one upstream refresh", async () => {
  const provider = new FakeProvider();
  const service = new MarketService(provider);

  const results = await Promise.all(
    Array.from({ length: 250 }, () => service.getPrices(["BTC"], "USD")),
  );

  assert.equal(provider.calls, 1);
  assert.equal(results.length, 250);
  assert.equal(results[0].prices.BTC.price, 100_000);
  assert.equal(results[249].prices.BTC.price, 100_000);
});

test("fresh snapshot is reused without another provider request", async () => {
  const provider = new FakeProvider();
  const service = new MarketService(provider);

  await service.getPrices(["BTC"], "USD");
  await service.getPrices(["BTC"], "USD");
  await service.getPrices(["BTC"], "USD");

  assert.equal(provider.calls, 1);
});
