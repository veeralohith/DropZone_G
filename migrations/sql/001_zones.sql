CREATE TABLE IF NOT EXISTS "Zone" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "eventId" TEXT NOT NULL REFERENCES "Event"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  geometry JSONB NOT NULL,
  "radiusMeters" INTEGER,
  "ttlSeconds" INTEGER NOT NULL DEFAULT 86400 CHECK ("ttlSeconds" > 0),
  "allowedPostTypes" JSONB NOT NULL DEFAULT '["lost_found", "requirement", "announcement", "qa", "promotion"]'::jsonb,
  "createdBy" TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Zone_radiusMeters_check" CHECK ("radiusMeters" IS NULL OR "radiusMeters" BETWEEN 50 AND 500)
);

CREATE INDEX IF NOT EXISTS "Zone_eventId_idx" ON "Zone"("eventId");
CREATE INDEX IF NOT EXISTS "Zone_expiresAt_idx" ON "Zone"("expiresAt");

CREATE TABLE IF NOT EXISTS "ZoneJoin" (
  "zoneId" TEXT NOT NULL REFERENCES "Zone"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "eventId" TEXT NOT NULL REFERENCES "Event"(id) ON DELETE CASCADE,
  "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("zoneId", "userId")
);

CREATE INDEX IF NOT EXISTS "ZoneJoin_eventId_userId_idx" ON "ZoneJoin"("eventId", "userId");

ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "zoneId" TEXT;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "approxLocation" TEXT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Post_zoneId_fkey') THEN
    ALTER TABLE "Post" ADD CONSTRAINT "Post_zoneId_fkey"
      FOREIGN KEY ("zoneId") REFERENCES "Zone"(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "Post_zoneId_idx" ON "Post"("zoneId");

ALTER TABLE "Membership" ADD COLUMN IF NOT EXISTS "lastKnownZoneId" TEXT;

ALTER TABLE "Zone" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ZoneJoin" ENABLE ROW LEVEL SECURITY;