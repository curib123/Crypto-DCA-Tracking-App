import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test from "node:test";
import {
  cacheUserResource,
  clearActiveUser,
  clearUserOfflineData,
  getActiveUser,
  getCachedUserResource,
  pendingTransactions,
  queueTransaction,
  removePending,
  setActiveUser,
} from "./offline";

test("offline cache stays isolated per user and sign-out cleanup is scoped", async () => {
  const userA = { id: "user-a", email: "a@example.com", baseCurrency: "USD" };
  const userB = { id: "user-b", email: "b@example.com", baseCurrency: "PHP" };

  await setActiveUser(userA);
  assert.deepEqual(await getActiveUser(), userA);

  await cacheUserResource(userA.id, "portfolio", { total: 100 });
  await cacheUserResource(userB.id, "portfolio", { total: 200 });

  const cachedA = await getCachedUserResource<{ total: number }>(userA.id, "portfolio");
  const cachedB = await getCachedUserResource<{ total: number }>(userB.id, "portfolio");

  assert.equal(cachedA?.value.total, 100);
  assert.equal(cachedB?.value.total, 200);

  const pendingA = await queueTransaction(userA.id, {
    clientReference: "11111111-1111-4111-8111-111111111111",
    assetSymbol: "BTC",
    type: "BUY",
    quantity: 0.001,
  });
  await queueTransaction(userB.id, {
    clientReference: "22222222-2222-4222-8222-222222222222",
    assetSymbol: "ETH",
    type: "BUY",
    quantity: 0.01,
  });

  assert.equal((await pendingTransactions(userA.id)).length, 1);
  assert.equal((await pendingTransactions(userB.id)).length, 1);

  await removePending(String(pendingA._offlineId));
  assert.equal((await pendingTransactions(userA.id)).length, 0);

  await queueTransaction(userA.id, {
    clientReference: "33333333-3333-4333-8333-333333333333",
    assetSymbol: "SOL",
    type: "BUY",
    quantity: 1,
  });

  await clearUserOfflineData(userA.id);
  await clearActiveUser();

  assert.equal(await getActiveUser(), null);
  assert.equal(await getCachedUserResource(userA.id, "portfolio"), null);
  assert.equal((await pendingTransactions(userA.id)).length, 0);

  assert.equal((await getCachedUserResource<{ total: number }>(userB.id, "portfolio"))?.value.total, 200);
  assert.equal((await pendingTransactions(userB.id)).length, 1);
});
