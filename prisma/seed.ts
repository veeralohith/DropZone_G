import dotenv from 'dotenv';
dotenv.config({ override: true });
import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;

function hashPassword(pwd: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pwd, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  console.log('Seeding Supabase PostgreSQL database with clean required data...');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    const defaultPasswordHash = hashPassword('DropZone@2026');

    // 1. Users (Essential accounts)
    await pool.query(`
      INSERT INTO "User" (id, name, email, role, avatar, "passwordHash", "createdAt", "updatedAt")
      VALUES
        ('usr-1', 'Aarav Sharma', 'aarav@hackathon.samartha.org', 'participant', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100', $1, NOW(), NOW()),
        ('usr-2', 'Dr. Priya Nair', 'priya.organizer@hackathon.samartha.org', 'organizer', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100', $1, NOW(), NOW()),
        ('usr-3', 'Vikram Mehta (Mod)', 'vikram.mod@hackathon.samartha.org', 'moderator', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100', $1, NOW(), NOW()),
        ('usr-4', 'Ananya Roy', 'ananya@hackathon.samartha.org', 'participant', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100', $1, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash";
    `, [defaultPasswordHash]);
    console.log('✓ Users seeded with secure password hashes');

    // 2. Event
    const zoneConfig = JSON.stringify({
      enabled: true,
      radiusMeters: 500,
      centerName: 'IIT Delhi Innovation Pavilion Zone A',
      latitude: 28.5450,
      longitude: 77.1926
    });

    await pool.query(`
      INSERT INTO "Event" (id, name, description, "eventType", "startDate", "endDate", timezone, "accessMode", "zoneConfig", "teamPolicy", "defaultTtlMinutes", "ownerId", status, "createdAt", "updatedAt")
      VALUES
        ('evt-samartha-2026', 'SAMARTHA National Hackathon 2026', 'Zone-based collaborative problem solving, rapid prototyping, and community coordination for resilient smart campuses.', 'hybrid', '2026-10-15T09:00:00Z', '2026-10-17T18:00:00Z', 'Asia/Kolkata', 'csv_verified', $1::jsonb, 'optional', 1440, 'usr-2', 'active', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `, [zoneConfig]);
    console.log('✓ Event seeded');

    // 3. Teams
    await pool.query(`
      INSERT INTO "Team" (id, "eventId", name, code, "createdAt", "updatedAt")
      VALUES
        ('team-alpha', 'evt-samartha-2026', 'Alpha Geofence Innovators', 'ALPHA26', NOW(), NOW()),
        ('team-beta', 'evt-samartha-2026', 'Beta Resilient Networks', 'BETA26', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('✓ Teams seeded');

    // 4. Memberships
    await pool.query(`
      INSERT INTO "Membership" (id, "eventId", "userId", "registrationId", "teamId", role, status, "zoneState", "createdAt", "updatedAt")
      VALUES
        ('mem-1', 'evt-samartha-2026', 'usr-1', 'SM-2026-001', 'team-alpha', 'participant', 'active', 'demo_zone', NOW(), NOW()),
        ('mem-2', 'evt-samartha-2026', 'usr-2', 'SM-2026-ORG', NULL, 'organizer', 'active', 'eligible', NOW(), NOW()),
        ('mem-3', 'evt-samartha-2026', 'usr-3', 'SM-2026-MOD', NULL, 'moderator', 'active', 'eligible', NOW(), NOW()),
        ('mem-4', 'evt-samartha-2026', 'usr-4', 'SM-2026-002', 'team-alpha', 'participant', 'active', 'demo_zone', NOW(), NOW())
      ON CONFLICT ("eventId", "userId") DO NOTHING;
    `);
    console.log('✓ Memberships seeded');

    console.log('Clean database seeding completed successfully!');
  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    await pool.end();
  }
}

main();
