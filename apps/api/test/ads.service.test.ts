import assert from "node:assert/strict";
import test from "node:test";
import type { ConfigService } from "@nestjs/config";
import { AdSenseService } from "../src/modules/ads/ads";

function config(values: Record<string, string>) {
  return {
    get(key: string) {
      return values[key];
    },
  } as ConfigService;
}

function prisma(
  settings: Record<string, unknown>,
  adsOverride: "INHERIT" | "ENABLED" | "DISABLED",
) {
  return {
    siteSetting: {
      findUnique: async () => ({ key: "adsense", value: settings }),
      upsert: async () => ({ key: "adsense", value: settings }),
    },
    user: {
      findUniqueOrThrow: async () => ({ adsOverride }),
    },
  } as any;
}

const credentials = {
  ADSENSE_CLIENT_ID: "ca-pub-1234567890123456",
  ADSENSE_APP_SLOT_ID: "1234567890",
  ADSENSE_LANDING_SLOT_ID: "9876543210",
};

test("AdSense remains off when the master switch is disabled", async () => {
  const service = new AdSenseService(
    prisma(
      {
        masterEnabled: false,
        appEnabled: true,
        landingEnabled: true,
        defaultForUsers: true,
      },
      "INHERIT",
    ),
    config(credentials),
  );

  assert.deepEqual(await service.appConfig("user-1"), {
    enabled: false,
    placement: "app",
  });
  assert.deepEqual(await service.publicConfig(), {
    enabled: false,
    placement: "landing",
  });
});

test("selected-user mode only enables explicitly selected accounts", async () => {
  const settings = {
    masterEnabled: true,
    appEnabled: true,
    landingEnabled: false,
    defaultForUsers: false,
  };

  const inherited = new AdSenseService(
    prisma(settings, "INHERIT"),
    config(credentials),
  );
  const selected = new AdSenseService(
    prisma(settings, "ENABLED"),
    config(credentials),
  );

  assert.equal((await inherited.appConfig("user-1")).enabled, false);
  assert.equal((await selected.appConfig("user-2")).enabled, true);
});

test("all-user mode still honors a per-user force-off override", async () => {
  const settings = {
    masterEnabled: true,
    appEnabled: true,
    landingEnabled: false,
    defaultForUsers: true,
  };

  const inherited = new AdSenseService(
    prisma(settings, "INHERIT"),
    config(credentials),
  );
  const disabled = new AdSenseService(
    prisma(settings, "DISABLED"),
    config(credentials),
  );

  assert.equal((await inherited.appConfig("user-1")).enabled, true);
  assert.equal((await disabled.appConfig("user-2")).enabled, false);
});

test("missing publisher credentials prevents ad serving even when enabled", async () => {
  const service = new AdSenseService(
    prisma(
      {
        masterEnabled: true,
        appEnabled: true,
        landingEnabled: true,
        defaultForUsers: true,
      },
      "INHERIT",
    ),
    config({}),
  );

  assert.equal((await service.appConfig("user-1")).enabled, false);
  assert.equal((await service.publicConfig()).enabled, false);
});
