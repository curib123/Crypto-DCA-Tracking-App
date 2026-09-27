ALTER TABLE "User"
ADD COLUMN "googleSubject" TEXT,
ADD COLUMN "name" TEXT,
ADD COLUMN "pictureUrl" TEXT;

UPDATE "User"
SET "googleSubject" = 'legacy:' || "id"
WHERE "googleSubject" IS NULL;

ALTER TABLE "User"
ALTER COLUMN "googleSubject" SET NOT NULL;

DROP INDEX IF EXISTS "User_googleSubject_key";
CREATE UNIQUE INDEX "User_googleSubject_key" ON "User"("googleSubject");

ALTER TABLE "User"
DROP COLUMN "passwordHash";
