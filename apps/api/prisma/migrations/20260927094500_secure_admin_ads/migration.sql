-- CreateEnum
CREATE TYPE "AdOverride" AS ENUM ('INHERIT', 'ENABLED', 'DISABLED');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "adsOverride" "AdOverride" NOT NULL DEFAULT 'INHERIT';

-- CreateTable
CREATE TABLE "ControlPanelAdmin" (
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

-- CreateTable
CREATE TABLE "ControlPanelAuditLog" (
  "id" TEXT NOT NULL,
  "actorAdminId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ControlPanelAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ControlPanelAdmin_username_key" ON "ControlPanelAdmin"("username");
CREATE INDEX "ControlPanelAdmin_username_idx" ON "ControlPanelAdmin"("username");
CREATE INDEX "ControlPanelAuditLog_actorAdminId_createdAt_idx" ON "ControlPanelAuditLog"("actorAdminId", "createdAt");
CREATE INDEX "ControlPanelAuditLog_createdAt_idx" ON "ControlPanelAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "ControlPanelAuditLog"
ADD CONSTRAINT "ControlPanelAuditLog_actorAdminId_fkey"
FOREIGN KEY ("actorAdminId") REFERENCES "ControlPanelAdmin"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
