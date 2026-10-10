import dotenv from 'dotenv';
dotenv.config({ override: true });
import pg from 'pg';
import crypto from 'crypto';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

async function run() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const defaultHash = hashPassword('DropZone@2026');
  
  await pool.query('UPDATE "User" SET "passwordHash" = $1 WHERE "passwordHash" IS NULL', [defaultHash]);
  const res = await pool.query('SELECT id, email, role, ("passwordHash" IS NOT NULL) as has_pass FROM "User"');
  console.log('Seeded users:', res.rows);
  await pool.end();
}

run();
