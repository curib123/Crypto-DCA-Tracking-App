-- Add user-owned DCA planning/reminder records.
-- These plans never execute trades; they only track intended contribution cadence.

DO $$
BEGIN
  CREATE TYPE public."DcaFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public."DcaPlan" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "assetSymbol" TEXT NOT NULL,
  "amount" DECIMAL(36,8) NOT NULL,
  "quoteCurrency" TEXT NOT NULL,
  "frequency" public."DcaFrequency" NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DcaPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DcaPlan_userId_enabled_idx"
  ON public."DcaPlan"("userId", "enabled");
CREATE INDEX IF NOT EXISTS "DcaPlan_userId_assetSymbol_idx"
  ON public."DcaPlan"("userId", "assetSymbol");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DcaPlan_userId_fkey'
  ) THEN
    ALTER TABLE public."DcaPlan"
      ADD CONSTRAINT "DcaPlan_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES public."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

ALTER TABLE public."DcaPlan" ENABLE ROW LEVEL SECURITY;
