import type { NextRequest, NextResponse } from "next/server";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { OAuth2Client, type TokenPayload } from "google-auth-library";
import { prisma } from "@/lib/server/db";
import { HttpError } from "@/lib/server/http";

export const APP_SESSION_COOKIE = "crypto_dca_session";
export const CONTROL_SESSION_COOKIE = "nextfi_control_session";

const APP_SESSION_SECONDS = 7 * 24 * 60 * 60;
const CONTROL_SESSION_SECONDS = 30 * 60;
const MAX_CONTROL_ATTEMPTS = 5;
const CONTROL_LOCK_MS = 15 * 60 * 1000;

type SignedPayload = Record<string, unknown> & {
  exp?: number;
};

function base64url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signPart(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function issueSignedToken(payload: Record<string, unknown>, secret: string, ttlSeconds: number) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(
    JSON.stringify({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    }),
  );
  const unsigned = header + "." + body;
  return unsigned + "." + signPart(unsigned, secret);
}

function verifySignedToken(token: string, secret: string): SignedPayload {
  const parts = token.split(".");
  if (parts.length !== 3) throw new HttpError(401, "Your session is invalid or expired.");

  const unsigned = parts[0] + "." + parts[1];
  const expected = Buffer.from(signPart(unsigned, secret));
  const actual = Buffer.from(parts[2]);

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new HttpError(401, "Your session is invalid or expired.");
  }

  let payload: SignedPayload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as SignedPayload;
  } catch {
    throw new HttpError(401, "Your session is invalid or expired.");
  }

  if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new HttpError(401, "Your session is invalid or expired.");
  }

  return payload;
}

function appSecret() {
  const secret = String(process.env.JWT_SECRET || "");
  if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new HttpError(500, "JWT_SECRET must be at least 32 characters in production.");
  }
  return secret || "nextfi-development-session-secret";
}

function controlSecret() {
  const configured = String(process.env.CONTROL_PANEL_JWT_SECRET || "");
  const userSecret = String(process.env.JWT_SECRET || "");
  const secret = configured || userSecret || "nextfi-development-control-secret";

  if (
    process.env.NODE_ENV === "production" &&
    (!configured || configured.length < 32 || configured === userSecret)
  ) {
    throw new HttpError(
      500,
      "CONTROL_PANEL_JWT_SECRET must be a separate secret of at least 32 characters in production.",
    );
  }

  return secret;
}

function defaultBaseCurrency() {
  const allowed = new Set([
    "USD", "PHP", "EUR", "GBP", "AUD", "CAD", "SGD", "JPY",
    "KRW", "MYR", "IDR", "THB", "USDT", "USDC",
  ]);
  const configured = String(process.env.DEFAULT_BASE_CURRENCY || "USD").toUpperCase();
  return allowed.has(configured) ? configured : "USD";
}

function normalizeGooglePayload(payload?: TokenPayload) {
  if (!payload?.sub || !payload.email) {
    throw new HttpError(401, "Google account identity is incomplete.");
  }

  return {
    subject: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: Boolean(payload.email_verified),
    name: payload.name || undefined,
    pictureUrl: payload.picture || undefined,
    hostedDomain: payload.hd || undefined,
  };
}

export async function signInWithGoogle(credential: string) {
  const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
  if (!clientId) throw new HttpError(500, "GOOGLE_CLIENT_ID is not configured.");
  if (!credential) throw new HttpError(400, "Google credential is required.");

  let identity: ReturnType<typeof normalizeGooglePayload>;
  try {
    const ticket = await new OAuth2Client().verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    identity = normalizeGooglePayload(ticket.getPayload());
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, "Google sign-in could not be verified.");
  }

  let user = await prisma.user.findUnique({
    where: { googleSubject: identity.subject },
  });

  if (!user) {
    const existingByEmail = await prisma.user.findUnique({
      where: { email: identity.email },
    });

    if (existingByEmail) {
      const isLegacy = existingByEmail.googleSubject.startsWith("legacy:");
      const googleAuthoritative =
        identity.email.endsWith("@gmail.com") ||
        (identity.emailVerified && Boolean(identity.hostedDomain));

      if (!isLegacy || !googleAuthoritative) {
        throw new HttpError(
          409,
          "An account already exists for this email and cannot be linked automatically.",
        );
      }

      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          googleSubject: identity.subject,
          name: identity.name,
          pictureUrl: identity.pictureUrl,
          lastLoginAt: new Date(),
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          googleSubject: identity.subject,
          email: identity.email,
          name: identity.name,
          pictureUrl: identity.pictureUrl,
          baseCurrency: defaultBaseCurrency(),
          lastLoginAt: new Date(),
        },
      });
    }
  } else {
    const emailOwner = await prisma.user.findUnique({
      where: { email: identity.email },
    });

    if (emailOwner && emailOwner.id !== user.id) {
      throw new HttpError(409, "This Google email is already associated with another account.");
    }

    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        email: identity.email,
        name: identity.name,
        pictureUrl: identity.pictureUrl,
        lastLoginAt: new Date(),
      },
    });
  }

  if (user.status !== "ACTIVE") {
    throw new HttpError(403, "This account is suspended.");
  }

  return {
    token: issueSignedToken({ sub: user.id, email: user.email }, appSecret(), APP_SESSION_SECONDS),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      pictureUrl: user.pictureUrl,
      baseCurrency: user.baseCurrency,
      role: user.role,
      status: user.status,
      themePreference: user.themePreference,
    },
  };
}

export async function requireUser(request: NextRequest) {
  const token = request.cookies.get(APP_SESSION_COOKIE)?.value || "";
  if (!token) throw new HttpError(401, "Sign in required.");

  const payload = verifySignedToken(token, appSecret());
  const userId = typeof payload.sub === "string" ? payload.sub : "";
  if (!userId) throw new HttpError(401, "Your session is invalid or expired.");

  const user = await prisma.user.findUnique({
    where: { id: userId },
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
    },
  });

  if (!user || user.status !== "ACTIVE") {
    throw new HttpError(401, "This account is not active.");
  }

  return user;
}

export function setAppSession(response: NextResponse, token: string) {
  response.cookies.set(APP_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: APP_SESSION_SECONDS,
    path: "/",
  });
}

export function clearAppSession(response: NextResponse) {
  response.cookies.set(APP_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

function hashPassword(password: string) {
  const salt = randomBytes(16);
  const digest = scryptSync(password, salt, 64);
  return "scrypt$" + salt.toString("hex") + "$" + digest.toString("hex");
}

function verifyPassword(password: string, stored: string) {
  const [algorithm, saltHex, digestHex] = stored.split("$");
  if (algorithm !== "scrypt" || !saltHex || !digestHex) return false;

  try {
    const expected = Buffer.from(digestHex, "hex");
    const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function strongPassword(password: string) {
  return (
    password.length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

async function ensureControlAdmin() {
  const username = String(process.env.CONTROL_PANEL_USERNAME || "admin").trim();
  const password = String(process.env.CONTROL_PANEL_PASSWORD || "pass");

  if (
    process.env.NODE_ENV === "production" &&
    (!username || password === "pass" || password.length < 12)
  ) {
    throw new HttpError(
      500,
      "Configure a non-default CONTROL_PANEL_USERNAME and a CONTROL_PANEL_PASSWORD of at least 12 characters.",
    );
  }

  let admin = await prisma.controlPanelAdmin.findUnique({ where: { username } });
  if (!admin) {
    admin = await prisma.controlPanelAdmin.create({
      data: {
        username,
        passwordHash: hashPassword(password),
        mustChangePassword: true,
      },
    });
  }

  return admin;
}

async function controlAudit(adminId: string, action: string, metadata?: Record<string, unknown>) {
  await prisma.controlPanelAuditLog.create({
    data: {
      actorAdminId: adminId,
      action,
      targetType: "ControlPanelAdmin",
      targetId: adminId,
      metadata: metadata as never,
    },
  });
}

export async function controlLogin(usernameRaw: string, password: string) {
  await ensureControlAdmin();
  const username = usernameRaw.trim();
  const admin = await prisma.controlPanelAdmin.findUnique({ where: { username } });

  if (!admin) {
    scryptSync(password || "invalid", Buffer.alloc(16), 64);
    throw new HttpError(401, "Invalid control-panel credentials.");
  }

  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    throw new HttpError(401, "Control-panel login is temporarily locked. Try again later.");
  }

  if (!verifyPassword(password, admin.passwordHash)) {
    const failedAttempts = admin.failedAttempts + 1;
    const lockedUntil =
      failedAttempts >= MAX_CONTROL_ATTEMPTS
        ? new Date(Date.now() + CONTROL_LOCK_MS)
        : null;

    await prisma.controlPanelAdmin.update({
      where: { id: admin.id },
      data: {
        failedAttempts: lockedUntil ? 0 : failedAttempts,
        lockedUntil,
      },
    });

    throw new HttpError(401, "Invalid control-panel credentials.");
  }

  const updated = await prisma.controlPanelAdmin.update({
    where: { id: admin.id },
    data: {
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  await controlAudit(updated.id, "control.login");

  return {
    token: issueSignedToken(
      { sub: updated.id, username: updated.username, scope: "control-panel" },
      controlSecret(),
      CONTROL_SESSION_SECONDS,
    ),
    admin: {
      id: updated.id,
      username: updated.username,
      mustChangePassword: updated.mustChangePassword,
    },
  };
}

export async function requireControlAdmin(request: NextRequest, ready = false) {
  const token = request.cookies.get(CONTROL_SESSION_COOKIE)?.value || "";
  if (!token) throw new HttpError(401, "Control-panel login required.");

  const payload = verifySignedToken(token, controlSecret());
  if (payload.scope !== "control-panel" || typeof payload.sub !== "string") {
    throw new HttpError(401, "Invalid control-panel session.");
  }

  const admin = await prisma.controlPanelAdmin.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      username: true,
      mustChangePassword: true,
      lastLoginAt: true,
    },
  });

  if (!admin) throw new HttpError(401, "Invalid control-panel session.");
  if (ready && admin.mustChangePassword) {
    throw new HttpError(403, "Change the bootstrap control-panel password before continuing.");
  }

  return admin;
}

export async function changeControlPassword(
  adminId: string,
  currentPassword: string,
  newPassword: string,
) {
  const admin = await prisma.controlPanelAdmin.findUniqueOrThrow({
    where: { id: adminId },
  });

  if (!verifyPassword(currentPassword, admin.passwordHash)) {
    throw new HttpError(401, "Current password is incorrect.");
  }

  if (!strongPassword(newPassword)) {
    throw new HttpError(
      403,
      "New password must be at least 12 characters and include uppercase, lowercase, number, and symbol.",
    );
  }

  if (verifyPassword(newPassword, admin.passwordHash)) {
    throw new HttpError(403, "New password must be different from the current password.");
  }

  const updated = await prisma.controlPanelAdmin.update({
    where: { id: admin.id },
    data: {
      passwordHash: hashPassword(newPassword),
      mustChangePassword: false,
      failedAttempts: 0,
      lockedUntil: null,
    },
    select: {
      id: true,
      username: true,
      mustChangePassword: true,
    },
  });

  await controlAudit(admin.id, "control.password.change");
  return updated;
}

export function setControlSession(response: NextResponse, token: string) {
  response.cookies.set(CONTROL_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: CONTROL_SESSION_SECONDS,
    path: "/",
  });
}

export function clearControlSession(response: NextResponse) {
  response.cookies.set(CONTROL_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
}
