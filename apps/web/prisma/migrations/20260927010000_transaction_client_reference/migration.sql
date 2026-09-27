ALTER TABLE "Transaction"
ADD COLUMN "clientReference" TEXT;

CREATE UNIQUE INDEX "Transaction_userId_clientReference_key"
ON "Transaction"("userId", "clientReference");
