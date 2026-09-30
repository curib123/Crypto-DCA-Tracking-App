import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { APP_NAVIGATION, CONTROL_NAVIGATION, MOBILE_NAVIGATION } from "../config/navigation";

test("presentation styles are split by responsibility", async () => {
  const globals = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  const expected = [
    "../styles/tokens.css",
    "../styles/base.css",
    "../styles/marketing.css",
    "../styles/product.css",
    "../styles/admin.css",
    "../styles/responsive.css",
  ];

  for (const file of expected) {
    assert.equal(globals.includes(file), true, "Missing style import: " + file);
  }

  const nonImports = globals
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("@import"));

  assert.deepEqual(
    nonImports,
    [],
    "globals.css should stay an import-only composition entry point",
  );
});

test("customer and control-panel navigation are centralized", () => {
  assert.deepEqual(
    APP_NAVIGATION.map((item) => item.href),
    [
      "/app",
      "/app/portfolio",
      "/app/transactions",
      "/app/dca-plans",
      "/app/settings",
    ],
  );

  assert.deepEqual(
    CONTROL_NAVIGATION.map((item) => item.href),
    [
      "/admin",
      "/admin/users",
      "/admin/ads",
      "/admin/content",
      "/admin/audit",
    ],
  );

  assert.equal(
    new Set(APP_NAVIGATION.map((item) => item.href)).size,
    APP_NAVIGATION.length,
  );
  assert.equal(
    new Set(CONTROL_NAVIGATION.map((item) => item.href)).size,
    CONTROL_NAVIGATION.length,
  );
});

test("mobile PWA navigation keeps four destinations plus the primary add action", async () => {
  assert.deepEqual(
    MOBILE_NAVIGATION.map((item) => item.href),
    ["/app", "/app/portfolio", "/app/transactions", "/app/settings"],
  );

  const [responsive, shell] = await Promise.all([
    readFile(new URL("../styles/responsive.css", import.meta.url), "utf8"),
    readFile(new URL("../components/app-shell.tsx", import.meta.url), "utf8"),
  ]);

  assert.equal(
    responsive.includes("grid-template-columns: repeat(5, minmax(0, 1fr));"),
    true,
  );
  assert.equal(shell.includes("mobile-add-action"), true);
  assert.equal(shell.includes("nextfi-open-transaction"), true);
});


test("mobile shell uses a left drawer and transaction type select", async () => {
  const [product, responsive, transactionForm] = await Promise.all([
    readFile(new URL("../styles/product.css", import.meta.url), "utf8"),
    readFile(new URL("../styles/responsive.css", import.meta.url), "utf8"),
    readFile(new URL("../components/transaction-form-modal.tsx", import.meta.url), "utf8"),
  ]);

  assert.equal(product.includes("transform: translateX(-100%);"), true);
  assert.equal(product.includes("border-radius: 0 24px 24px 0;"), true);
  assert.equal(responsive.includes("border-radius: 24px 24px 0 0;"), true);
  assert.equal(transactionForm.includes("transaction-type-select"), true);
  assert.equal(transactionForm.includes("More activity types"), false);
});
