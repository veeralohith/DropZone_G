UPDATE "Event"
SET
  description = 'Zone-based collaboration for SAMARTHA National Hackathon in Visakhapatnam, Andhra Pradesh.',
  "zoneConfig" = COALESCE("zoneConfig", '{}'::jsonb) || jsonb_build_object(
    'enabled', true,
    'radiusMeters', 500,
    'centerName', 'SAMARTHA Hackathon, Visakhapatnam',
    'latitude', 17.6868,
    'longitude', 83.2185
  ),
  "updatedAt" = NOW()
WHERE id = 'evt-samartha-2026';
