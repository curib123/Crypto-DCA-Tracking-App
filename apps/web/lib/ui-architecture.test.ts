import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { APP_NAVIGATION, CONTROL_NAVIGATION } from "../config/navigation";

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
      "/app/transactions",
      "/app/market",
      "/app/insights",
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

test("mobile PWA navigation exposes all five primary destinations", async () => {
  const responsive = await readFile(
    new URL("../styles/responsive.css", import.meta.url),
    "utf8",
  );

  assert.equal(
    responsive.includes(
      "grid-template-columns: repeat(5, minmax(0, 1fr));",
    ),
    true,
  );
});
