-- NextFi baseline schema for Supabase PostgreSQL.
-- Schema migrations are owned by Supabase CLI. Prisma remains the server-only ORM.
-- RLS is intentionally enabled without browser policies because all portfolio/admin
-- reads and writes go through authenticated Next.js Route Handlers.

DO $$
BEGIN
  CREATE TYPE public."TransactionType" AS ENUM (
    'BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT',
    'AIRDROP', 'REWARD', 'STAKING_REWARD', 'FEE', 'ADJUSTMENT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public."UserRole" AS ENUM ('USER', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public."UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public."ThemePreference" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public."AdOverride" AS ENUM ('INHERIT', 'ENABLED', 'DISABLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public."User" (
  "id" TEXT NOT NULL,
  "googleSubject" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "pictureUrl" TEXT,
  "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
  "role" public."UserRole" NOT NULL DEFAULT 'USER',
  "status" public."UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "themePreference" public."ThemePreference" NOT NULL DEFAULT 'SYSTEM',
  "adsOverride" public."AdOverride" NOT NULL DEFAULT 'INHERIT',
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Upgrade safety for databases created by the earlier Prisma migration chain.
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "googleSubject" TEXT;
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "pictureUrl" TEXT;
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "role" public."UserRole" NOT NULL DEFAULT 'USER';
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "status" public."UserStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "themePreference" public."ThemePreference" NOT NULL DEFAULT 'SYSTEM';
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "adsOverride" public."AdOverride" NOT NULL DEFAULT 'INHERIT';
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);

UPDATE public."User"
SET "googleSubject" = 'legacy:' || "id"
WHERE "googleSubject" IS NULL;

ALTER TABLE public."User" ALTER COLUMN "googleSubject" SET NOT NULL;
ALTER TABLE public."User" DROP COLUMN IF EXISTS "passwordHash";

CREATE UNIQUE INDEX IF NOT EXISTS "User_googleSubject_key" ON public."User"("googleSubject");
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON public."User"("email");
CREATE INDEX IF NOT EXISTS "User_status_idx" ON public."User"("status");
CREATE INDEX IF NOT EXISTS "User_role_idx" ON public."User"("role");
CREATE INDEX IF NOT EXISTS "User_createdAt_idx" ON public."User"("createdAt");
CREATE INDEX IF NOT EXISTS "User_lastLoginAt_idx" ON public."User"("lastLoginAt");

CREATE TABLE IF NOT EXISTS public."Transaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "assetSymbol" TEXT NOT NULL,
  "type" public."TransactionType" NOT NULL,
  "quantity" DECIMAL(36,18) NOT NULL,
  "unitPrice" DECIMAL(36,8) NOT NULL,
  "amountSpent" DECIMAL(36,8) NOT NULL,
  "quoteCurrency" TEXT NOT NULL,
  "fxRateToBase" DECIMAL(36,12) NOT NULL DEFAULT 1,
  "feeBase" DECIMAL(36,8) NOT NULL DEFAULT 0,
  "exchange" TEXT,
  "wallet" TEXT,
  "notes" TEXT,
  "clientReference" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

ALTER TABLE public."Transaction" ADD COLUMN IF NOT EXISTS "clientReference" TEXT;

CREATE INDEX IF NOT EXISTS "Transaction_userId_occurredAt_idx" ON public."Transaction"("userId", "occurredAt");
CREATE INDEX IF NOT EXISTS "Transaction_userId_assetSymbol_idx" ON public."Transaction"("userId", "assetSymbol");
CREATE INDEX IF NOT EXISTS "Transaction_createdAt_idx" ON public."Transaction"("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_userId_clientReference_key"
  ON public."Transaction"("userId", "clientReference");

CREATE TABLE IF NOT EXISTS public."SiteSetting" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);

CREATE TABLE IF NOT EXISTS public."AdminAuditLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminAuditLog_actorUserId_createdAt_idx"
  ON public."AdminAuditLog"("actorUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx"
  ON public."AdminAuditLog"("createdAt");

CREATE TABLE IF NOT EXISTS public."ControlPanelAdmin" (
  "id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
  "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ControlPanelAdmin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ControlPanelAdmin_username_key"
  ON public."ControlPanelAdmin"("username");
CREATE INDEX IF NOT EXISTS "ControlPanelAdmin_username_idx"
  ON public."ControlPanelAdmin"("username");

CREATE TABLE IF NOT EXISTS public."ControlPanelAuditLog" (
  "id" TEXT NOT NULL,
  "actorAdminId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ControlPanelAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ControlPanelAuditLog_actorAdminId_createdAt_idx"
  ON public."ControlPanelAuditLog"("actorAdminId", "createdAt");
CREATE INDEX IF NOT EXISTS "ControlPanelAuditLog_createdAt_idx"
  ON public."ControlPanelAuditLog"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Transaction_userId_fkey'
  ) THEN
    ALTER TABLE public."Transaction"
      ADD CONSTRAINT "Transaction_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES public."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdminAuditLog_actorUserId_fkey'
  ) THEN
    ALTER TABLE public."AdminAuditLog"
      ADD CONSTRAINT "AdminAuditLog_actorUserId_fkey"
      FOREIGN KEY ("actorUserId") REFERENCES public."User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ControlPanelAuditLog_actorAdminId_fkey'
  ) THEN
    ALTER TABLE public."ControlPanelAuditLog"
      ADD CONSTRAINT "ControlPanelAuditLog_actorAdminId_fkey"
      FOREIGN KEY ("actorAdminId") REFERENCES public."ControlPanelAdmin"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SiteSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AdminAuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ControlPanelAdmin" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ControlPanelAuditLog" ENABLE ROW LEVEL SECURITY;
