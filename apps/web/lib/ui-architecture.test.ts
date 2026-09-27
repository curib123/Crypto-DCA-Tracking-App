import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  APP_NAVIGATION,
  CONTROL_NAVIGATION,
  MOBILE_NAVIGATION,
} from "../config/navigation";

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
    "../styles/mobile-app.css",
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
      "/app/transactions",
      "/app/market",
      "/app/insights",
      "/app/settings",
    ],
  );

  assert.deepEqual(
    MOBILE_NAVIGATION.map((item) => item.href),
    ["/app", "/app/transactions", "/app/market", "/app/insights"],
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

test("mobile app shell uses four destinations plus a central add action", async () => {
  const mobileStyles = await readFile(
    new URL("../styles/mobile-app.css", import.meta.url),
    "utf8",
  );
  const appShell = await readFile(
    new URL("../components/app-shell.tsx", import.meta.url),
    "utf8",
  );

  assert.equal(
    mobileStyles.includes("grid-template-columns: 1fr 1fr 64px 1fr 1fr;"),
    true,
  );
  assert.equal(appShell.includes('href="/app/transactions?new=1"'), true);
  assert.equal(appShell.includes("app-drawer"), true);
});

test("customer mutations use shared application dialogs", async () => {
  const transactions = await readFile(
    new URL("../components/transactions-client.tsx", import.meta.url),
    "utf8",
  );
  const settings = await readFile(
    new URL("../components/settings-client.tsx", import.meta.url),
    "utf8",
  );

  assert.equal(transactions.includes("AppDialog"), true);
  assert.equal(transactions.includes("useDialog"), true);
  assert.equal(settings.includes("AppDialog"), true);
  assert.equal(settings.includes("useDialog"), true);
  assert.equal(transactions.includes('confirm("Delete this transaction?'), false);
});
