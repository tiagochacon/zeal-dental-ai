ALTER TABLE "Consultations"
ADD COLUMN IF NOT EXISTS "attendanceStatus" text DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS "attendanceMarkedAt" timestamptz,
ADD COLUMN IF NOT EXISTS "attendanceMarkedByUserId" bigint;

UPDATE "Consultations"
SET "attendanceStatus" = 'unknown'
WHERE "attendanceStatus" IS NULL;
