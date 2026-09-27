import {
  AdOverride,
  DcaFrequency,
  TransactionType,
  UserRole,
  UserStatus,
} from "@prisma/client";
import {
  calculateAssetPosition,
  percentageChange,
  validateAssetLedger,
} from "@crypto-dca/core";
import { prisma } from "@/lib/server/db";
import {
  HttpError,
  asNumber,
  asString,
  optionalString,
} from "@/lib/server/http";

export const SUPPORTED_CURRENCIES = [
  "USD",
  "PHP",
  "EUR",
  "GBP",
  "AUD",
  "CAD",
  "SGD",
  "JPY",
  "KRW",
  "MYR",
  "IDR",
  "THB",
  "USDT",
  "USDC",
] as const;

const SUPPORTED_CURRENCY_SET = new Set<string>(SUPPORTED_CURRENCIES);

const SUPPORTED_ASSETS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  LINK: "chainlink",
  HYPE: "hyperliquid",
  XLM: "stellar",
};

const TRANSACTION_TYPES = new Set<string>(Object.values(TransactionType));

type RateState = { count: number; resetAt: number };
const rateStates = new Map<string, RateState>();

export function assertRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const existing = rateStates.get(key);

  if (!existing || existing.resetAt <= now) {
    rateStates.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (existing.count >= limit) {
    throw new HttpError(429, "Too many requests. Please try again later.");
  }

  existing.count += 1;
}

function currency(value: unknown, name = "Currency") {
  const clean = asString(value, name, 12).toUpperCase();
  if (!SUPPORTED_CURRENCY_SET.has(clean)) {
    throw new HttpError(400, "Unsupported " + name.toLowerCase() + ".");
  }
  return clean;
}

function transactionType(value: unknown) {
  const clean = asString(value, "Transaction type", 40).toUpperCase();
  if (!TRANSACTION_TYPES.has(clean)) {
    throw new HttpError(400, "Unsupported transaction type.");
  }
  return clean as TransactionType;
}

function uuidOrNull(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new HttpError(400, "Invalid client reference.");
  const clean = value.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean)) {
    throw new HttpError(400, "Client reference must be a UUID.");
  }
  return clean;
}

export async function listTransactions(userId: string) {
  return prisma.transaction.findMany({
    where: { userId },
    orderBy: { occurredAt: "desc" },
  });
}

export async function createTransaction(userId: string, input: Record<string, unknown>) {
  const assetSymbol = asString(input.assetSymbol, "Asset symbol", 12).toUpperCase();
  const type = transactionType(input.type);
  const quantity = asNumber(input.quantity, "Quantity", 0);
  const unitPrice = asNumber(input.unitPrice, "Unit price", 0);
  const amountSpent = asNumber(input.amountSpent, "Amount spent", 0);
  const quoteCurrency = currency(input.quoteCurrency, "Quote currency");
  const feeBase = input.feeBase === undefined ? 0 : asNumber(input.feeBase, "Fee", 0);
  const fxRateRaw = input.fxRateToBase;
  const exchange = optionalString(input.exchange, 80);
  const wallet = optionalString(input.wallet, 80);
  const notes = optionalString(input.notes, 500);
  const clientReference = uuidOrNull(input.clientReference);
  const occurredAt = new Date(asString(input.occurredAt, "Occurred at", 80));

  if (Number.isNaN(occurredAt.getTime())) {
    throw new HttpError(400, "Occurred at must be a valid date.");
  }

  if (occurredAt.getTime() > Date.now() + 5 * 60 * 1000) {
    throw new HttpError(
      400,
      "Ledger transactions cannot be future-dated. Use a DCA plan/reminder for future purchases.",
    );
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { baseCurrency: true },
  });

  const sameCurrency = quoteCurrency === user.baseCurrency.toUpperCase();
  if (!sameCurrency && fxRateRaw === undefined) {
    throw new HttpError(
      400,
      "FX rate is required when " + quoteCurrency + " differs from base currency " + user.baseCurrency + ".",
    );
  }

  const fxRateToBase = sameCurrency ? 1 : asNumber(fxRateRaw, "FX rate", Number.EPSILON);

  if (clientReference) {
    const existing = await prisma.transaction.findFirst({
      where: { userId, clientReference },
    });
    if (existing) return existing;
  }

  const quantityRequired =
    type !== TransactionType.FEE;

  if (quantityRequired && quantity <= 0) {
    throw new HttpError(400, "Quantity must be greater than zero for this transaction type.");
  }

  if (
    (type === TransactionType.BUY || type === TransactionType.SELL) &&
    amountSpent <= 0
  ) {
    throw new HttpError(400, "Buy and sell transactions require an amount greater than zero.");
  }

  if (type === TransactionType.FEE && quantity <= 0 && feeBase <= 0) {
    throw new HttpError(
      400,
      "A fee transaction requires either asset quantity or a base-currency fee.",
    );
  }

  const existingAssetLedger = await prisma.transaction.findMany({
    where: { userId, assetSymbol },
    orderBy: { occurredAt: "asc" },
  });

  const ledgerValidation = validateAssetLedger([
    ...existingAssetLedger.map((row) => ({
      id: row.id,
      type: row.type,
      quantity: Number(row.quantity),
      amountBase: Number(row.amountSpent) * Number(row.fxRateToBase),
      feeBase: Number(row.feeBase),
      occurredAt: row.occurredAt,
    })),
    {
      type,
      quantity,
      amountBase: amountSpent * fxRateToBase,
      feeBase,
      occurredAt,
    },
  ]);

  if (!ledgerValidation.valid) {
    throw new HttpError(
      400,
      ledgerValidation.reason || "This transaction would make the asset ledger invalid.",
    );
  }

  return prisma.transaction.create({
    data: {
      userId,
      assetSymbol,
      type,
      quantity: String(quantity),
      unitPrice: String(
        unitPrice > 0
          ? unitPrice
          : quantity > 0
            ? amountSpent / quantity
            : 0,
      ),
      amountSpent: String(amountSpent),
      quoteCurrency,
      fxRateToBase: String(fxRateToBase),
      feeBase: String(feeBase),
      exchange,
      wallet,
      notes,
      clientReference,
      occurredAt,
    },
  });
}

export async function removeTransaction(userId: string, id: string) {
  const row = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!row) return { deleted: false };

  const remaining = await prisma.transaction.findMany({
    where: {
      userId,
      assetSymbol: row.assetSymbol,
      id: { not: id },
    },
    orderBy: { occurredAt: "asc" },
  });

  const ledgerValidation = validateAssetLedger(
    remaining.map((item) => ({
      id: item.id,
      type: item.type,
      quantity: Number(item.quantity),
      amountBase: Number(item.amountSpent) * Number(item.fxRateToBase),
      feeBase: Number(item.feeBase),
      occurredAt: item.occurredAt,
    })),
  );

  if (!ledgerValidation.valid) {
    throw new HttpError(
      400,
      (
        "Cannot delete this transaction because a later ledger entry depends on it. " +
        (ledgerValidation.reason || "")
      ).trim(),
    );
  }

  await prisma.transaction.delete({ where: { id } });
  return { deleted: true };
}

type MarketPrice = {
  symbol: string;
  price: number;
  change24h: number;
  currency: string;
  lastUpdatedAt: number;
};

type MarketMatrix = Record<string, Record<string, MarketPrice>>;

type MarketSnapshot = {
  matrix: MarketMatrix;
  fetchedAt: number;
  expiresAt: number;
};

let marketSnapshot: MarketSnapshot | null = null;
let marketRefreshPromise: Promise<MarketSnapshot> | null = null;
let marketFailures = 0;
let marketCircuitOpenUntil = 0;

function providerCurrency(value: string) {
  const upper = value.toUpperCase();
  return upper === "USDT" || upper === "USDC" ? "USD" : upper;
}

async function fetchMarketSnapshot(): Promise<MarketSnapshot> {
  const providerCurrencies = [
    ...new Set(SUPPORTED_CURRENCIES.map((item) => providerCurrency(item).toLowerCase())),
  ];

  const endpoint = new URL("https://api.coingecko.com/api/v3/simple/price");
  endpoint.searchParams.set("ids", Object.values(SUPPORTED_ASSETS).join(","));
  endpoint.searchParams.set("vs_currencies", providerCurrencies.join(","));
  endpoint.searchParams.set("include_24hr_change", "true");
  endpoint.searchParams.set("include_last_updated_at", "true");

  const demoKey = String(process.env.COINGECKO_DEMO_API_KEY || "").trim();
  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(7000),
    headers: {
      accept: "application/json",
      "user-agent": "NextFi/1.0",
      ...(demoKey ? { "x-cg-demo-api-key": demoKey } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("CoinGecko returned HTTP " + response.status);
  }

  const data = (await response.json()) as Record<string, Record<string, number>>;
  const matrix: MarketMatrix = {};

  for (const [symbol, coinId] of Object.entries(SUPPORTED_ASSETS)) {
    const row = data[coinId] || {};
    matrix[symbol] = {};

    for (const item of SUPPORTED_CURRENCIES) {
      const providerCode = providerCurrency(item).toLowerCase();
      matrix[symbol][item] = {
        symbol,
        price: Number(row[providerCode] || 0),
        change24h: Number(row[providerCode + "_24h_change"] || 0),
        currency: item,
        lastUpdatedAt: Number(row.last_updated_at || 0),
      };
    }
  }

  const now = Date.now();
  const snapshot = {
    matrix,
    fetchedAt: now,
    expiresAt: now + 15 * 60 * 1000,
  };

  marketSnapshot = snapshot;
  marketFailures = 0;
  marketCircuitOpenUntil = 0;
  return snapshot;
}

async function refreshMarket() {
  if (marketRefreshPromise) return marketRefreshPromise;

  marketRefreshPromise = fetchMarketSnapshot();
  try {
    return await marketRefreshPromise;
  } catch (error) {
    marketFailures += 1;
    if (marketFailures >= 3) {
      marketCircuitOpenUntil = Date.now() + 2 * 60 * 1000;
    }

    if (marketSnapshot && Date.now() - marketSnapshot.fetchedAt <= 24 * 60 * 60 * 1000) {
      return marketSnapshot;
    }

    throw error;
  } finally {
    marketRefreshPromise = null;
  }
}

export async function getMarketPrices(symbolsRaw: string[], currencyRaw: string) {
  const symbols = [...new Set(symbolsRaw.map((item) => item.trim().toUpperCase()))].filter(
    (symbol) => Boolean(SUPPORTED_ASSETS[symbol]),
  );
  const displayCurrency = currency(currencyRaw, "Market currency");

  if (!symbols.length) throw new HttpError(400, "No supported assets requested.");

  const now = Date.now();
  let snapshot = marketSnapshot;
  let stale = false;

  if (!snapshot || snapshot.expiresAt <= now) {
    if (snapshot && now - snapshot.fetchedAt <= 24 * 60 * 60 * 1000) {
      stale = true;
      if (now >= marketCircuitOpenUntil) void refreshMarket().catch(() => undefined);
    } else {
      if (now < marketCircuitOpenUntil) {
        throw new HttpError(503, "Market provider circuit is temporarily open.");
      }
      try {
        snapshot = await refreshMarket();
      } catch (error) {
        throw new HttpError(
          503,
          error instanceof Error ? error.message : "Market provider unavailable.",
        );
      }
    }
  }

  if (!snapshot) throw new HttpError(503, "Market provider unavailable.");

  const prices = Object.fromEntries(
    symbols
      .map((symbol) => [symbol, snapshot!.matrix[symbol]?.[displayCurrency]] as const)
      .filter((entry) => Boolean(entry[1])),
  );

  return {
    prices,
    stale,
    fetchedAt: new Date(snapshot.fetchedAt).toISOString(),
    source: "CoinGecko",
  };
}

export async function portfolioSummary(userId: string) {
  const [user, transactions] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, baseCurrency: true },
    }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { occurredAt: "asc" },
    }),
  ]);

  const symbols = [...new Set(transactions.map((row) => row.assetSymbol))];
  let live: Record<string, MarketPrice> = {};
  let marketStale = false;

  if (symbols.length) {
    try {
      const market = await getMarketPrices(symbols, user.baseCurrency);
      live = market.prices;
      marketStale = market.stale;
    } catch {
      live = {};
    }
  }

  const assets = symbols.map((symbol) => {
    const rows = transactions.filter((row) => row.assetSymbol === symbol);

    const position = calculateAssetPosition(
      rows.map((row) => ({
        id: row.id,
        type: row.type,
        quantity: Number(row.quantity),
        amountBase: Number(row.amountSpent) * Number(row.fxRateToBase),
        feeBase: Number(row.feeBase),
        occurredAt: row.occurredAt,
      })),
    );

    const lastBuy = [...rows].reverse().find((row) => row.type === "BUY");
    const fallbackPrice = lastBuy
      ? Number(lastBuy.unitPrice) * Number(lastBuy.fxRateToBase)
      : 0;
    const currentPrice = Number(live[symbol]?.price || fallbackPrice);
    const currentValue = currentPrice * position.quantity;
    const unrealizedPnl = currentValue - position.remainingCostBasis;

    return {
      symbol,
      ...position,
      currentPrice,
      currentValue,
      unrealizedPnl,
      returnPct: percentageChange(currentValue, position.remainingCostBasis),
      marketSource: live[symbol]
        ? marketStale
          ? "stale-market-cache"
          : "live"
        : "last-entry-fallback",
    };
  });

  const totals = assets.reduce(
    (acc, asset) => {
      acc.invested += asset.totalBuyContributions;
      acc.currentValue += asset.currentValue;
      acc.unrealizedPnl += asset.unrealizedPnl;
      acc.realizedPnl += asset.realizedPnl;
      acc.fees += asset.totalFees;
      return acc;
    },
    { invested: 0, currentValue: 0, unrealizedPnl: 0, realizedPnl: 0, fees: 0 },
  );

  return {
    currency: user.baseCurrency,
    user: { email: user.email },
    totals: {
      ...totals,
      lifetimePnl: totals.unrealizedPnl + totals.realizedPnl,
      returnPct: totals.invested
        ? ((totals.unrealizedPnl + totals.realizedPnl) / totals.invested) * 100
        : 0,
    },
    assets,
  };
}

export async function getSettings(userId: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      baseCurrency: true,
      themePreference: true,
    },
  });
}

export async function updateSettings(userId: string, input: Record<string, unknown>) {
  const data: {
    baseCurrency?: string;
    themePreference?: "SYSTEM" | "LIGHT" | "DARK";
  } = {};

  if (input.baseCurrency !== undefined) {
    data.baseCurrency = currency(input.baseCurrency, "Base currency");
  }

  if (input.themePreference !== undefined) {
    const theme = asString(input.themePreference, "Theme", 20).toUpperCase();
    if (theme !== "SYSTEM" && theme !== "LIGHT" && theme !== "DARK") {
      throw new HttpError(400, "Unsupported theme preference.");
    }
    data.themePreference = theme;
  }

  if (!Object.keys(data).length) {
    throw new HttpError(400, "No settings changes were provided.");
  }

  return prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      baseCurrency: true,
      themePreference: true,
    },
  });
}

export type LandingFeature = { title: string; description: string };
export type LandingFaq = { question: string; answer: string };
export type LandingContent = {
  brandName: string;
  announcement: string;
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  features: LandingFeature[];
  faq: LandingFaq[];
  footerText: string;
  seoTitle: string;
  seoDescription: string;
};

export const DEFAULT_LANDING_CONTENT: LandingContent = {
  brandName: "NextFi",
  announcement: "Installable PWA · DCA-first portfolio analytics",
  heroEyebrow: "Crypto DCA, made measurable",
  heroTitle: "Know exactly what your DCA is doing.",
  heroDescription:
    "Track real contributions, weighted average cost, break-even, fees and portfolio performance in one clean workspace.",
  primaryCtaLabel: "Continue with Google",
  secondaryCtaLabel: "Install NextFi",
  features: [
    {
      title: "Real cost basis",
      description: "Weighted calculations are rebuilt from your transaction ledger instead of editable totals.",
    },
    {
      title: "Clear performance",
      description: "Keep invested capital, current value, realized P/L and unrealized P/L separate.",
    },
    {
      title: "Multi-currency",
      description: "Preserve original quote currencies while reporting consistently in your chosen base currency.",
    },
    {
      title: "Offline-ready",
      description: "Read synchronized portfolio data and queue transactions when your connection drops.",
    },
    {
      title: "Visual analytics",
      description: "Use focused charts for allocation and performance where a visual actually adds information.",
    },
    {
      title: "Mistral AI insights",
      description: "Explain calculated portfolio analytics without giving an AI custody or trading access.",
    },
  ],
  faq: [
    {
      question: "Does NextFi hold or trade my cryptocurrency?",
      answer: "No. NextFi is a tracking and analytics application. It does not custody funds or execute trades.",
    },
    {
      question: "How is average cost calculated?",
      answer: "NextFi recalculates weighted cost basis from your transaction ledger.",
    },
    {
      question: "Does NextFi work offline?",
      answer: "Previously synchronized portfolio data can be read offline, and supported transaction entries can be queued for later synchronization.",
    },
  ],
  footerText: "Portfolio tracking and analytics only. Not financial advice.",
  seoTitle: "NextFi — Crypto DCA Tracking & Portfolio Analytics",
  seoDescription:
    "Track crypto DCA contributions, weighted average cost, break-even, portfolio value and profit/loss in an installable PWA.",
};

function safeText(value: unknown, fallback: string, max: number) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : fallback;
}

function normalizeLanding(value: unknown): LandingContent {
  const input =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const features = Array.isArray(input.features)
    ? input.features
        .slice(0, 12)
        .map((item) => {
          const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
          return {
            title: safeText(row.title, "", 80),
            description: safeText(row.description, "", 280),
          };
        })
        .filter((item) => item.title && item.description)
    : [];

  const faq = Array.isArray(input.faq)
    ? input.faq
        .slice(0, 12)
        .map((item) => {
          const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
          return {
            question: safeText(row.question, "", 120),
            answer: safeText(row.answer, "", 500),
          };
        })
        .filter((item) => item.question && item.answer)
    : [];

  return {
    brandName: safeText(input.brandName, DEFAULT_LANDING_CONTENT.brandName, 40),
    announcement: safeText(input.announcement, DEFAULT_LANDING_CONTENT.announcement, 140),
    heroEyebrow: safeText(input.heroEyebrow, DEFAULT_LANDING_CONTENT.heroEyebrow, 100),
    heroTitle: safeText(input.heroTitle, DEFAULT_LANDING_CONTENT.heroTitle, 140),
    heroDescription: safeText(input.heroDescription, DEFAULT_LANDING_CONTENT.heroDescription, 360),
    primaryCtaLabel: safeText(input.primaryCtaLabel, DEFAULT_LANDING_CONTENT.primaryCtaLabel, 60),
    secondaryCtaLabel: safeText(input.secondaryCtaLabel, DEFAULT_LANDING_CONTENT.secondaryCtaLabel, 60),
    features: features.length ? features : DEFAULT_LANDING_CONTENT.features,
    faq: faq.length ? faq : DEFAULT_LANDING_CONTENT.faq,
    footerText: safeText(input.footerText, DEFAULT_LANDING_CONTENT.footerText, 220),
    seoTitle: safeText(input.seoTitle, DEFAULT_LANDING_CONTENT.seoTitle, 120),
    seoDescription: safeText(input.seoDescription, DEFAULT_LANDING_CONTENT.seoDescription, 260),
  };
}

export async function getLandingContent() {
  const row = await prisma.siteSetting.findUnique({ where: { key: "landing" } });
  return normalizeLanding(row?.value);
}

export async function saveLandingContent(value: unknown) {
  const normalized = normalizeLanding(value);
  await prisma.siteSetting.upsert({
    where: { key: "landing" },
    update: { value: normalized as never },
    create: { key: "landing", value: normalized as never },
  });
  return normalized;
}

export type AdSenseSettings = {
  masterEnabled: boolean;
  landingEnabled: boolean;
  appEnabled: boolean;
  defaultForUsers: boolean;
};

const DEFAULT_AD_SETTINGS: AdSenseSettings = {
  masterEnabled: false,
  landingEnabled: false,
  appEnabled: false,
  defaultForUsers: false,
};

function normalizeAdSettings(value: unknown): AdSenseSettings {
  const input =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return {
    masterEnabled:
      typeof input.masterEnabled === "boolean"
        ? input.masterEnabled
        : DEFAULT_AD_SETTINGS.masterEnabled,
    landingEnabled:
      typeof input.landingEnabled === "boolean"
        ? input.landingEnabled
        : DEFAULT_AD_SETTINGS.landingEnabled,
    appEnabled:
      typeof input.appEnabled === "boolean"
        ? input.appEnabled
        : DEFAULT_AD_SETTINGS.appEnabled,
    defaultForUsers:
      typeof input.defaultForUsers === "boolean"
        ? input.defaultForUsers
        : DEFAULT_AD_SETTINGS.defaultForUsers,
  };
}

async function adSettings() {
  const row = await prisma.siteSetting.findUnique({ where: { key: "adsense" } });
  return normalizeAdSettings(row?.value);
}

function validAdClient(value: string) {
  return /^ca-pub-\d{16}$/.test(value);
}

function validAdSlot(value: string) {
  return /^\d{6,20}$/.test(value);
}

function maskClientId(value: string) {
  if (!value) return null;
  if (value.length < 10) return "configured";
  return value.slice(0, 7) + "••••••" + value.slice(-4);
}

export async function publicAdConfig() {
  const settings = await adSettings();
  const clientId = String(process.env.ADSENSE_CLIENT_ID || "").trim();
  const slotId = String(process.env.ADSENSE_LANDING_SLOT_ID || "").trim();

  const enabled =
    settings.masterEnabled &&
    settings.landingEnabled &&
    validAdClient(clientId) &&
    validAdSlot(slotId);

  return enabled
    ? { enabled: true, clientId, slotId, placement: "landing" }
    : { enabled: false, placement: "landing" };
}

export async function appAdConfig(userId: string) {
  const [settings, user] = await Promise.all([
    adSettings(),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { adsOverride: true },
    }),
  ]);

  const clientId = String(process.env.ADSENSE_CLIENT_ID || "").trim();
  const slotId = String(process.env.ADSENSE_APP_SLOT_ID || "").trim();

  const userEnabled =
    user.adsOverride === AdOverride.ENABLED ||
    (user.adsOverride === AdOverride.INHERIT && settings.defaultForUsers);

  const enabled =
    settings.masterEnabled &&
    settings.appEnabled &&
    userEnabled &&
    validAdClient(clientId) &&
    validAdSlot(slotId);

  return enabled
    ? { enabled: true, clientId, slotId, placement: "app" }
    : { enabled: false, placement: "app" };
}

export async function adminAdsView() {
  const clientId = String(process.env.ADSENSE_CLIENT_ID || "").trim();
  const appSlotId = String(process.env.ADSENSE_APP_SLOT_ID || "").trim();
  const landingSlotId = String(process.env.ADSENSE_LANDING_SLOT_ID || "").trim();

  return {
    settings: await adSettings(),
    credentials: {
      clientConfigured: validAdClient(clientId),
      appSlotConfigured: validAdSlot(appSlotId),
      landingSlotConfigured: validAdSlot(landingSlotId),
      clientIdMasked: maskClientId(clientId),
    },
    note:
      "AdSense identifiers come from server environment variables. They are not editable in the control panel.",
  };
}

export async function saveAdminAds(value: unknown) {
  const current = await adSettings();
  const input =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const next = normalizeAdSettings({ ...current, ...input });
  await prisma.siteSetting.upsert({
    where: { key: "adsense" },
    update: { value: next as never },
    create: { key: "adsense", value: next as never },
  });

  return adminAdsView();
}

export async function adminOverview() {
  const now = new Date();
  const since30 = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
  const since7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [users, transactions] = await Promise.all([
    prisma.user.findMany({
      select: {
        createdAt: true,
        lastLoginAt: true,
        status: true,
        role: true,
      },
    }),
    prisma.transaction.findMany({
      where: { createdAt: { gte: since30 } },
      select: { createdAt: true, assetSymbol: true },
    }),
  ]);

  const dayKeys = Array.from({ length: 30 }, (_, index) => {
    const day = new Date(since30.getTime() + index * 24 * 60 * 60 * 1000);
    return day.toISOString().slice(0, 10);
  });

  const signups = Object.fromEntries(dayKeys.map((key) => [key, 0]));
  const txByDay = Object.fromEntries(dayKeys.map((key) => [key, 0]));
  const assetCounts: Record<string, number> = {};

  for (const user of users) {
    const key = user.createdAt.toISOString().slice(0, 10);
    if (key in signups) signups[key] += 1;
  }

  for (const tx of transactions) {
    const key = tx.createdAt.toISOString().slice(0, 10);
    if (key in txByDay) txByDay[key] += 1;
    assetCounts[tx.assetSymbol] = (assetCounts[tx.assetSymbol] || 0) + 1;
  }

  return {
    totals: {
      users: users.length,
      activeUsers7d: users.filter(
        (user) => user.lastLoginAt && user.lastLoginAt >= since7,
      ).length,
      appAdmins: users.filter((user) => user.role === UserRole.ADMIN).length,
      suspendedUsers: users.filter((user) => user.status === UserStatus.SUSPENDED).length,
      transactions30d: transactions.length,
    },
    userGrowth: dayKeys.map((date) => ({ date, value: signups[date] })),
    transactionActivity: dayKeys.map((date) => ({ date, value: txByDay[date] })),
    topAssets: Object.entries(assetCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([asset, value]) => ({ asset, value })),
  };
}

export async function adminUsers(
  searchRaw?: string,
  pageRaw?: string,
  limitRaw?: string,
) {
  const search = String(searchRaw || "").trim();
  const page = Math.max(1, Number(pageRaw) || 1);
  const limit = Math.min(100, Math.max(10, Number(limitRaw) || 25));
  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: "insensitive" as const } },
          { name: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        email: true,
        name: true,
        pictureUrl: true,
        baseCurrency: true,
        role: true,
        status: true,
        themePreference: true,
        adsOverride: true,
        lastLoginAt: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function updateAdminUser(
  actorAdminId: string,
  userId: string,
  input: Record<string, unknown>,
) {
  const data: {
    role?: UserRole;
    status?: UserStatus;
    adsOverride?: AdOverride;
  } = {};

  if (input.role !== undefined) {
    const value = asString(input.role, "Role", 20).toUpperCase();
    if (!(value in UserRole)) throw new HttpError(400, "Unsupported user role.");
    data.role = value as UserRole;
  }

  if (input.status !== undefined) {
    const value = asString(input.status, "Status", 20).toUpperCase();
    if (!(value in UserStatus)) throw new HttpError(400, "Unsupported user status.");
    data.status = value as UserStatus;
  }

  if (input.adsOverride !== undefined) {
    const value = asString(input.adsOverride, "Ad override", 20).toUpperCase();
    if (!(value in AdOverride)) throw new HttpError(400, "Unsupported ad override.");
    data.adsOverride = value as AdOverride;
  }

  if (!Object.keys(data).length) {
    throw new HttpError(400, "No user changes were provided.");
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      adsOverride: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  await prisma.controlPanelAuditLog.create({
    data: {
      actorAdminId,
      action: "user.update",
      targetType: "User",
      targetId: userId,
      metadata: data as never,
    },
  });

  return updated;
}

export function adminAuditLog() {
  return prisma.controlPanelAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      actor: {
        select: { username: true },
      },
    },
  });
}

export async function auditAdminAction(
  actorAdminId: string,
  action: string,
  targetType: string,
  targetId?: string,
  metadata?: Record<string, unknown>,
) {
  await prisma.controlPanelAuditLog.create({
    data: {
      actorAdminId,
      action,
      targetType,
      targetId,
      metadata: metadata as never,
    },
  });
}

type Insight = {
  id: string;
  title: string;
  body: string;
  kind: "info" | "attention" | "positive";
};

const insightCache = new Map<
  string,
  { expiresAt: number; fingerprint: string; value: unknown }
>();

function deterministicInsights(summary: Awaited<ReturnType<typeof portfolioSummary>>, buyDates: Date[]) {
  const insights: Insight[] = [];
  const totalValue = Number(summary.totals.currentValue || 0);
  const assets = [...summary.assets].sort((a, b) => b.currentValue - a.currentValue);

  if (assets.length && totalValue > 0) {
    const top = assets[0];
    const allocation = (Number(top.currentValue) / totalValue) * 100;
    insights.push({
      id: "allocation",
      title: allocation >= 60 ? "Portfolio concentration is high" : "Largest portfolio allocation",
      body:
        top.symbol +
        " represents " +
        allocation.toFixed(1) +
        "% of your tracked portfolio value. This is a concentration observation, not a buy or sell recommendation.",
      kind: allocation >= 60 ? "attention" : "info",
    });
  }

  if (buyDates.length >= 2) {
    const sorted = [...buyDates].sort((a, b) => a.getTime() - b.getTime());
    const gaps = sorted.slice(1).map(
      (date, index) =>
        (date.getTime() - sorted[index].getTime()) / (24 * 60 * 60 * 1000),
    );
    const averageDays = gaps.reduce((sum, value) => sum + value, 0) / gaps.length;
    insights.push({
      id: "cadence",
      title: "Your recent DCA cadence",
      body:
        "Your recorded buys are about " +
        averageDays.toFixed(1) +
        " days apart on average. Use this as a consistency check against your intended DCA schedule.",
      kind: "info",
    });
  }

  const invested = Number(summary.totals.invested || 0);
  const fees = Number(summary.totals.fees || 0);
  if (invested > 0) {
    const feeRate = (fees / invested) * 100;
    insights.push({
      id: "fees",
      title: "Tracked fee impact",
      body:
        "Recorded fees equal about " +
        feeRate.toFixed(2) +
        "% of total buy contributions in your ledger.",
      kind: feeRate > 2 ? "attention" : "info",
    });
  }

  const profitable = summary.assets.filter(
    (asset) => Number(asset.unrealizedPnl) >= 0,
  ).length;

  if (summary.assets.length) {
    insights.push({
      id: "positions",
      title: "Position snapshot",
      body:
        profitable +
        " of " +
        summary.assets.length +
        " tracked positions currently have non-negative unrealized P/L based on the latest available market snapshot.",
      kind: profitable === summary.assets.length ? "positive" : "info",
    });
  }

  return insights.slice(0, 4);
}

async function mistralNarrative(
  summary: Awaited<ReturnType<typeof portfolioSummary>>,
  insights: Insight[],
) {
  const apiKey = String(process.env.MISTRAL_API_KEY || "").trim();
  if (!apiKey) return null;

  const model = String(process.env.MISTRAL_MODEL || "mistral-small-latest");
  const endpoint = String(
    process.env.MISTRAL_API_URL || "https://api.mistral.ai/v1/chat/completions",
  );

  const context = {
    currency: summary.currency,
    totals: summary.totals,
    assets: summary.assets.map((asset) => ({
      symbol: asset.symbol,
      allocationValue: asset.currentValue,
      averageEntry: asset.averageEntry,
      currentPrice: asset.currentPrice,
      returnPct: asset.returnPct,
      buyCount: asset.buyCount,
    })),
    deterministicObservations: insights.map(({ title, body }) => ({ title, body })),
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: AbortSignal.timeout(Number(process.env.MISTRAL_TIMEOUT_MS || 12000)),
      headers: {
        authorization: "Bearer " + apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 220,
        messages: [
          {
            role: "system",
            content:
              "You are NextFi Insights powered by Mistral. Explain only supplied portfolio analytics in plain language. Never predict crypto prices, promise returns, or tell the user to buy, sell, or hold. Never invent missing portfolio data. Focus on concentration, DCA consistency, fees, data quality, and what the deterministic numbers mean. Keep the response concise, under 140 words.",
          },
          { role: "user", content: JSON.stringify(context) },
        ],
      }),
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content?.trim();
    return text ? { text, model: payload.model || model } : null;
  } catch {
    return null;
  }
}

export async function aiInsights(userId: string) {
  const [summary, buys] = await Promise.all([
    portfolioSummary(userId),
    prisma.transaction.findMany({
      where: { userId, type: TransactionType.BUY },
      orderBy: { occurredAt: "asc" },
      select: { occurredAt: true },
    }),
  ]);

  const buyDates = buys.map((row) => row.occurredAt);
  const insights = deterministicInsights(summary, buyDates);
  const fingerprint = JSON.stringify({
    currency: summary.currency,
    totals: summary.totals,
    assets: summary.assets.map((asset) => ({
      symbol: asset.symbol,
      quantity: asset.quantity,
      averageEntry: asset.averageEntry,
      currentPrice: asset.currentPrice,
      currentValue: asset.currentValue,
      returnPct: asset.returnPct,
      totalFees: asset.totalFees,
      buyCount: asset.buyCount,
    })),
    buys: buyDates.map((date) => date.toISOString()),
  });

  const cached = insightCache.get(userId);
  if (
    cached &&
    cached.expiresAt > Date.now() &&
    cached.fingerprint === fingerprint
  ) {
    return cached.value;
  }

  const mistral = await mistralNarrative(summary, insights);
  const value = {
    generatedAt: new Date().toISOString(),
    mode: mistral ? "ai-assisted" : "analytics-only",
    provider: mistral ? "Mistral" : null,
    model: mistral?.model || null,
    narrative: mistral?.text || null,
    insights,
    disclaimer:
      "These observations describe your tracked data. They are not financial advice, price predictions, or trade instructions.",
  };

  insightCache.set(userId, {
    expiresAt: Date.now() + 10 * 60 * 1000,
    fingerprint,
    value,
  });

  return value;
}


const DCA_FREQUENCIES = new Set<string>(Object.values(DcaFrequency));

function dcaFrequency(value: unknown) {
  const clean = asString(value, "DCA frequency", 24).toUpperCase();
  if (!DCA_FREQUENCIES.has(clean)) {
    throw new HttpError(400, "Unsupported DCA frequency.");
  }
  return clean as DcaFrequency;
}

function dcaStartDate(value: unknown) {
  const date = new Date(asString(value, "Start date", 80));
  if (Number.isNaN(date.getTime())) throw new HttpError(400, "Start date must be a valid date.");
  return date;
}

function supportedAsset(value: unknown) {
  const symbol = asString(value, "Asset symbol", 12).toUpperCase();
  if (!SUPPORTED_ASSETS[symbol]) throw new HttpError(400, "Unsupported asset.");
  return symbol;
}

export function listDcaPlans(userId: string) {
  return prisma.dcaPlan.findMany({
    where: { userId },
    orderBy: [{ enabled: "desc" }, { createdAt: "desc" }],
  });
}

export async function createDcaPlan(userId: string, input: Record<string, unknown>) {
  const assetSymbol = supportedAsset(input.assetSymbol);
  const amount = asNumber(input.amount, "DCA amount", Number.EPSILON);
  const quoteCurrency = currency(input.quoteCurrency, "Quote currency");
  const frequency = dcaFrequency(input.frequency);
  const startDate = dcaStartDate(input.startDate);
  const notes = optionalString(input.notes, 300);

  return prisma.dcaPlan.create({
    data: {
      userId,
      assetSymbol,
      amount: String(amount),
      quoteCurrency,
      frequency,
      startDate,
      enabled: input.enabled === undefined ? true : Boolean(input.enabled),
      notes,
    },
  });
}

export async function updateDcaPlan(userId: string, id: string, input: Record<string, unknown>) {
  const row = await prisma.dcaPlan.findFirst({ where: { id, userId } });
  if (!row) throw new HttpError(404, "DCA plan not found.");

  const data: {
    assetSymbol?: string;
    amount?: string;
    quoteCurrency?: string;
    frequency?: DcaFrequency;
    startDate?: Date;
    enabled?: boolean;
    notes?: string | null;
  } = {};

  if (input.assetSymbol !== undefined) data.assetSymbol = supportedAsset(input.assetSymbol);
  if (input.amount !== undefined) data.amount = String(asNumber(input.amount, "DCA amount", Number.EPSILON));
  if (input.quoteCurrency !== undefined) data.quoteCurrency = currency(input.quoteCurrency, "Quote currency");
  if (input.frequency !== undefined) data.frequency = dcaFrequency(input.frequency);
  if (input.startDate !== undefined) data.startDate = dcaStartDate(input.startDate);
  if (input.enabled !== undefined) {
    if (typeof input.enabled !== "boolean") throw new HttpError(400, "Enabled must be true or false.");
    data.enabled = input.enabled;
  }
  if (input.notes !== undefined) data.notes = optionalString(input.notes, 300);

  if (!Object.keys(data).length) throw new HttpError(400, "No DCA plan changes were provided.");

  return prisma.dcaPlan.update({ where: { id }, data });
}

export async function removeDcaPlan(userId: string, id: string) {
  const row = await prisma.dcaPlan.findFirst({ where: { id, userId } });
  if (!row) return { deleted: false };
  await prisma.dcaPlan.delete({ where: { id } });
  return { deleted: true };
}
