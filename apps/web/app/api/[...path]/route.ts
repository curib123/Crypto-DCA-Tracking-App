import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { HttpError, readJson } from "@/lib/server/http";
import {
  changeControlPassword,
  clearAppSession,
  clearControlSession,
  controlLogin,
  requireControlAdmin,
  requireUser,
  setAppSession,
  setControlSession,
  signInWithGoogle,
} from "@/lib/server/auth";
import {
  adminAdsView,
  adminAuditLog,
  adminOverview,
  adminUsers,
  aiInsights,
  appAdConfig,
  assertRateLimit,
  auditAdminAction,
  createTransaction,
  getLandingContent,
  getMarketPrices,
  getSettings,
  listTransactions,
  portfolioSummary,
  publicAdConfig,
  removeTransaction,
  saveAdminAds,
  saveLandingContent,
  updateAdminUser,
  updateSettings,
} from "@/lib/server/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

function json(value: unknown, init?: ResponseInit) {
  return NextResponse.json(value, init);
}

function clientKey(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return ip;
}

async function pathOf(context: RouteContext) {
  const params = await context.params;
  return params.path.join("/");
}

async function handle(request: NextRequest, context: RouteContext) {
  const path = await pathOf(context);
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  try {
    if (method === "GET" && path === "health") {
      await prisma.$queryRawUnsafe("SELECT 1");
      return json({ status: "ok", database: "ok", runtime: "nextjs" });
    }

    if (method === "POST" && path === "auth/google") {
      assertRateLimit("google:" + clientKey(request), 20, 15 * 60 * 1000);
      const body = await readJson<Record<string, unknown>>(request);
      const credential = typeof body.credential === "string" ? body.credential : "";
      const result = await signInWithGoogle(credential);
      const response = json({ user: result.user });
      setAppSession(response, result.token);
      return response;
    }

    if (method === "GET" && path === "auth/me") {
      const user = await requireUser(request);
      return json(user);
    }

    if (method === "POST" && path === "auth/logout") {
      const response = json({ signedOut: true });
      clearAppSession(response);
      return response;
    }

    if (path === "transactions" && method === "GET") {
      const user = await requireUser(request);
      return json(await listTransactions(user.id));
    }

    if (path === "transactions" && method === "POST") {
      const user = await requireUser(request);
      const body = await readJson<Record<string, unknown>>(request);
      return json(await createTransaction(user.id, body), { status: 201 });
    }

    if (path.startsWith("transactions/") && method === "DELETE") {
      const user = await requireUser(request);
      const id = path.slice("transactions/".length);
      if (!id) throw new HttpError(400, "Transaction id is required.");
      return json(await removeTransaction(user.id, id));
    }

    if (path === "portfolio/summary" && method === "GET") {
      const user = await requireUser(request);
      return json(await portfolioSummary(user.id));
    }

    if (path === "market/prices" && method === "GET") {
      const user = await requireUser(request);
      assertRateLimit("market:" + user.id, 30, 60 * 1000);
      const symbols = (url.searchParams.get("symbols") || "BTC,ETH,SOL,BNB,LINK,HYPE,XLM")
        .split(",");
      const currency = url.searchParams.get("currency") || "USD";
      return json(await getMarketPrices(symbols, currency));
    }

    if (path === "settings" && method === "GET") {
      const user = await requireUser(request);
      return json(await getSettings(user.id));
    }

    if (path === "settings" && method === "PATCH") {
      const user = await requireUser(request);
      const body = await readJson<Record<string, unknown>>(request);
      return json(await updateSettings(user.id, body));
    }

    if (path === "ai/insights" && method === "GET") {
      const user = await requireUser(request);
      assertRateLimit("ai:" + user.id, 12, 60 * 60 * 1000);
      return json(await aiInsights(user.id));
    }

    if (path === "content/landing" && method === "GET") {
      return json(await getLandingContent());
    }

    if (path === "ads/public" && method === "GET") {
      return json(await publicAdConfig());
    }

    if (path === "ads/app" && method === "GET") {
      const user = await requireUser(request);
      return json(await appAdConfig(user.id));
    }

    if (path === "admin-auth/login" && method === "POST") {
      assertRateLimit("control-login:" + clientKey(request), 5, 15 * 60 * 1000);
      const body = await readJson<Record<string, unknown>>(request);
      const username = typeof body.username === "string" ? body.username : "";
      const password = typeof body.password === "string" ? body.password : "";
      const result = await controlLogin(username, password);
      const response = json({ admin: result.admin });
      setControlSession(response, result.token);
      return response;
    }

    if (path === "admin-auth/me" && method === "GET") {
      return json(await requireControlAdmin(request));
    }

    if (path === "admin-auth/change-password" && method === "POST") {
      const admin = await requireControlAdmin(request);
      const body = await readJson<Record<string, unknown>>(request);
      const currentPassword =
        typeof body.currentPassword === "string" ? body.currentPassword : "";
      const newPassword =
        typeof body.newPassword === "string" ? body.newPassword : "";
      return json(
        await changeControlPassword(admin.id, currentPassword, newPassword),
      );
    }

    if (path === "admin-auth/logout" && method === "POST") {
      const response = json({ signedOut: true });
      clearControlSession(response);
      return response;
    }

    if (path === "admin/overview" && method === "GET") {
      await requireControlAdmin(request, true);
      return json(await adminOverview());
    }

    if (path === "admin/users" && method === "GET") {
      await requireControlAdmin(request, true);
      return json(
        await adminUsers(
          url.searchParams.get("search") || undefined,
          url.searchParams.get("page") || undefined,
          url.searchParams.get("limit") || undefined,
        ),
      );
    }

    if (path.startsWith("admin/users/") && method === "PATCH") {
      const admin = await requireControlAdmin(request, true);
      const userId = path.slice("admin/users/".length);
      const body = await readJson<Record<string, unknown>>(request);
      return json(await updateAdminUser(admin.id, userId, body));
    }

    if (path === "admin/audit" && method === "GET") {
      await requireControlAdmin(request, true);
      return json(await adminAuditLog());
    }

    if (path === "admin/content/landing" && method === "GET") {
      await requireControlAdmin(request, true);
      return json(await getLandingContent());
    }

    if (path === "admin/content/landing" && method === "PUT") {
      const admin = await requireControlAdmin(request, true);
      const body = await readJson<unknown>(request);
      const saved = await saveLandingContent(body);
      await auditAdminAction(admin.id, "landing.update", "SiteSetting", "landing");
      return json(saved);
    }

    if (path === "admin/ads" && method === "GET") {
      await requireControlAdmin(request, true);
      return json(await adminAdsView());
    }

    if (path === "admin/ads" && method === "PUT") {
      const admin = await requireControlAdmin(request, true);
      const body = await readJson<unknown>(request);
      const saved = await saveAdminAds(body);
      await auditAdminAction(
        admin.id,
        "adsense.settings.update",
        "SiteSetting",
        "adsense",
      );
      return json(saved);
    }

    throw new HttpError(404, "API route not found.");
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ message: error.message }, { status: error.status });
    }

    console.error("NextFi API error", error);
    return json(
      { message: "Unexpected server error." },
      { status: 500 },
    );
  }
}

export function GET(request: NextRequest, context: RouteContext) {
  return handle(request, context);
}

export function POST(request: NextRequest, context: RouteContext) {
  return handle(request, context);
}

export function PATCH(request: NextRequest, context: RouteContext) {
  return handle(request, context);
}

export function PUT(request: NextRequest, context: RouteContext) {
  return handle(request, context);
}

export function DELETE(request: NextRequest, context: RouteContext) {
  return handle(request, context);
}
