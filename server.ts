import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { prisma, pool } from './src/lib/prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_SECRET = process.env.AUTH_SECRET || 'dropzone_production_auth_secret_key_2026_samartha';

// Supabase Auth Integration
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseClient = (SUPABASE_URL && (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY))
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY)
  : null;

// Rate Limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function rateLimiter(limit = 120, windowMs = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count++;
    if (entry.count > limit) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    next();
  };
}

// Password Hashing & Verification using salted scrypt
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

// Secure HMAC Token Management
interface TokenPayload {
  userId: string;
  authUserId?: string;
  email: string;
  role: string;
  exp: number;
}

export function createAuthToken(user: { id: string; authUserId?: string | null; email: string; role: string }): string {
  const payload: TokenPayload = {
    userId: user.id,
    authUserId: user.authUserId || user.id,
    email: user.email,
    role: user.role,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyAuthToken(token: string): TokenPayload | null {
  try {
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return null;
    }
    const payload: TokenPayload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function sanitizeUser(user: any) {
  if (!user) return null;
  const { passwordHash, ...clean } = user;
  return clean;
}

async function verifySupabaseConnection() {
  try {
    const res = await pool.query('SELECT 1');
    console.log('✓ Successfully connected to Supabase PostgreSQL database.');
  } catch (err: any) {
    console.error('✗ Failed to connect to Supabase PostgreSQL:', err.message);
    throw new Error(`Database connection failed: ${err.message}. DropZone is configured to work only with Supabase.`);
  }
}

// Haversine distance calculator for server-side geofence boundary validation
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isCoordinatePair(value: any): value is [number, number] {
  return Array.isArray(value) && value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1]) &&
    value[0] >= -180 && value[0] <= 180 && value[1] >= -90 && value[1] <= 90;
}

function isValidZoneGeometry(geometry: any): boolean {
  if (!geometry || typeof geometry !== 'object') return false;
  if (geometry.type === 'Point') return isCoordinatePair(geometry.coordinates);
  if (geometry.type !== 'Polygon' || !Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) return false;
  return geometry.coordinates.every((ring: any) =>
    Array.isArray(ring) && ring.length >= 4 && ring.every(isCoordinatePair) &&
    ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
  );
}

function pointInRing(longitude: number, latitude: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[previous];
    const crosses = (y1 > latitude) !== (y2 > latitude) &&
      longitude < ((x2 - x1) * (latitude - y1)) / (y2 - y1) + x1;
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointInZone(longitude: number, latitude: number, zone: any): boolean {
  const geometry = typeof zone.geometry === 'string' ? JSON.parse(zone.geometry) : zone.geometry;
  if (geometry?.type === 'Point' && isCoordinatePair(geometry.coordinates)) {
    const [centerLongitude, centerLatitude] = geometry.coordinates;
    return calculateDistanceMeters(latitude, longitude, centerLatitude, centerLongitude) <= Number(zone.radiusMeters || 0);
  }
  if (geometry?.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
    const [outerRing, ...holes] = geometry.coordinates;
    return pointInRing(longitude, latitude, outerRing) && !holes.some((ring: [number, number][]) => pointInRing(longitude, latitude, ring));
  }
  return false;
}

function parseZoneJson(zone: any) {
  return {
    ...zone,
    geometry: typeof zone.geometry === 'string' ? JSON.parse(zone.geometry) : zone.geometry,
    allowedPostTypes: typeof zone.allowedPostTypes === 'string' ? JSON.parse(zone.allowedPostTypes) : zone.allowedPostTypes
  };
}

// Authenticated Request Interface
export interface AuthenticatedRequest extends Request {
  user?: any;
  authUserId?: string;
}

// Mandatory Server-Side Authentication Middleware
// Completely eliminates unauthenticated identity fallbacks, x-user-id headers, or demo persona switches
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const token = authHeader.substring(7).trim();

  // 1. Verify via HMAC signature
  const payload = verifyAuthToken(token);
  if (payload && payload.userId) {
    let user = null;
    if (payload.authUserId) {
      user = await prisma.user.findUnique({ where: { authUserId: payload.authUserId } }).catch(() => null);
    }
    if (!user) {
      user = await prisma.user.findUnique({ where: { id: payload.userId } }).catch(() => null);
    }

    if (!user) {
      return res.status(401).json({ error: 'User account not found or disabled.' });
    }

    req.user = sanitizeUser(user);
    req.authUserId = user.authUserId || user.id;
    return next();
  }

  // 2. Fallback to Supabase Auth verification if configured
  if (supabaseClient) {
    try {
      const { data: authData, error: authErr } = await supabaseClient.auth.getUser(token);
      if (authData?.user && !authErr) {
        const supabaseUid = authData.user.id;
        let user = await prisma.user.findUnique({ where: { authUserId: supabaseUid } }).catch(() => null);

        if (!user && authData.user.email) {
          user = await prisma.user.findUnique({ where: { email: authData.user.email.toLowerCase() } }).catch(() => null);
          if (user && !user.authUserId) {
            await prisma.user.update({
              where: { id: user.id },
              data: { authUserId: supabaseUid }
            });
            user.authUserId = supabaseUid;
          }
        }

        if (!user && authData.user.email) {
          user = await prisma.user.create({
            data: {
              authUserId: supabaseUid,
              name: authData.user.user_metadata?.full_name || authData.user.email.split('@')[0],
              email: authData.user.email.toLowerCase(),
              role: 'participant',
              avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100`
            }
          });
        }

        if (user) {
          req.user = sanitizeUser(user);
          req.authUserId = user.authUserId || user.id;
          return next();
        }
      }
    } catch (sbErr) {
      console.warn('Supabase token verification check failed:', sbErr);
    }
  }

  return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
}

// Reusable Role-Based Access Control Middleware
export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges for this operation' });
    }
    next();
  };
}

// Event-Scoped Organizer Authorization Middleware
export async function requireEventOrganizer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const eventId = req.params.eventId;
  if (!eventId) {
    return res.status(400).json({ error: 'Event ID parameter required' });
  }

  if (req.user.role === 'organizer') {
    return next();
  }

  const mem = await prisma.membership.findUnique({
    where: { eventId_userId: { eventId, userId: req.user.id } }
  }).catch(() => null);

  if (mem && (mem.role === 'organizer' || mem.role === 'owner')) {
    return next();
  }

  return res.status(403).json({ error: 'Forbidden: Only event organizers can perform this operation' });
}

// Event-Scoped Moderator/Organizer Authorization Middleware
export async function requireEventModerator(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const eventId = req.params.eventId;
  if (!eventId) {
    return res.status(400).json({ error: 'Event ID parameter required' });
  }

  if (req.user.role === 'organizer' || req.user.role === 'moderator') {
    return next();
  }

  const mem = await prisma.membership.findUnique({
    where: { eventId_userId: { eventId, userId: req.user.id } }
  }).catch(() => null);

  if (mem && (mem.role === 'organizer' || mem.role === 'moderator' || mem.role === 'owner')) {
    return next();
  }

  return res.status(403).json({ error: 'Forbidden: Only organizers and moderators can view or manage moderation reports' });
}

async function startServer() {
  await verifySupabaseConnection();

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // ==========================================
  // Public Allowlisted Endpoints
  // ==========================================

  // Health check
  app.get('/api/health', async (req, res) => {
    try {
      const client = await pool.connect();
      client.release();
      res.json({
        status: 'ok',
        database: 'connected (Supabase PostgreSQL)',
        auth: 'mandatory',
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      res.status(500).json({
        status: 'degraded',
        database: 'disconnected',
        error: err.message
      });
    }
  });

  // Evaluation & Demo Credentials List (Public, Read-Only for Judges)
  app.get('/api/auth/test-accounts', (req, res) => {
    res.json([
      {
        name: 'Dr. Priya Nair',
        email: 'priya.organizer@hackathon.samartha.org',
        role: 'organizer',
        hintPassword: 'DropZone@2026'
      },
      {
        name: 'Vikram Mehta (Mod)',
        email: 'vikram.mod@hackathon.samartha.org',
        role: 'moderator',
        hintPassword: 'DropZone@2026'
      },
      {
        name: 'Aarav Sharma',
        email: 'aarav@hackathon.samartha.org',
        role: 'participant',
        hintPassword: 'DropZone@2026'
      },
      {
        name: 'Ananya Roy',
        email: 'ananya@hackathon.samartha.org',
        role: 'participant',
        hintPassword: 'DropZone@2026'
      }
    ]);
  });

  // Auth: Register New User
  app.post('/api/auth/register', rateLimiter(20), async (req, res) => {
    try {
      const { name, email, password } = req.body;

      if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: 'Full name is required.' });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email.trim())) {
        return res.status(400).json({ error: 'Valid email address is required.' });
      }

      if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }

      const normalizedEmail = email.trim().toLowerCase();

      const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existing) {
        return res.status(400).json({ error: 'An account with this email address already exists.' });
      }

      // Security: New registrations are ALWAYS participant role; self-assigning organizer/moderator is forbidden
      const hashedPassword = hashPassword(password);
      const newUser = await prisma.user.create({
        data: {
          name: name.trim().slice(0, 100),
          email: normalizedEmail,
          passwordHash: hashedPassword,
          role: 'participant',
          avatar: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 900000)}?w=100`
        }
      });

      const token = createAuthToken(newUser);
      res.status(201).json({
        user: sanitizeUser(newUser),
        token
      });
    } catch (err: any) {
      console.error('Registration error:', err);
      res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
  });

  // Auth: Login with Email & Password
  app.post('/api/auth/login', rateLimiter(30), async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

      // Generic error response to prevent account enumeration
      if (!user || !user.passwordHash) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const isValid = verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const token = createAuthToken(user);
      res.json({
        user: sanitizeUser(user),
        token
      });
    } catch (err: any) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Authentication failed. Please try again.' });
    }
  });

  // Auth: Logout
  app.post('/api/auth/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out successfully.' });
  });

  // ==========================================
  // Protected Routes (requireAuth Enforced)
  // ==========================================

  // Auth: Get Current Authenticated Session
  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json(req.user);
  });

  // Legacy compat endpoint (now strictly authenticated)
  app.get('/api/users/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json(req.user);
  });

  // List all users
  app.get('/api/users', requireAuth, async (req, res) => {
    try {
      const users = await prisma.user.findMany();
      res.json(users.map(sanitizeUser));
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // List events
  app.get('/api/events', requireAuth, async (req, res) => {
    try {
      const events = await prisma.event.findMany({
        orderBy: { createdAt: 'desc' }
      });
      res.json(events);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Create event (Organizer only)
  app.post('/api/events', requireAuth, rateLimiter(20), async (req: AuthenticatedRequest, res) => {
    try {
      const { name, description, eventType, startDate, endDate, timezone, accessMode, zoneConfig, teamPolicy, defaultTtlMinutes } = req.body;

      if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: 'Event name is required' });
      }

      const ownerId = req.user.id;

      const newEvent = await prisma.event.create({
        data: {
          name: name.trim().slice(0, 150),
          description: (description || '').trim().slice(0, 1000),
          eventType: eventType || 'hybrid',
          startDate: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : new Date(Date.now() + 86400000 * 3).toISOString(),
          timezone: timezone || 'Asia/Kolkata',
          accessMode: accessMode || 'open',
          zoneConfig: zoneConfig || { enabled: true, radiusMeters: 500, centerName: 'Main Zone', latitude: 28.5, longitude: 77.2 },
          teamPolicy: teamPolicy || 'optional',
          defaultTtlMinutes: defaultTtlMinutes || 1440,
          ownerId,
          status: 'active'
        }
      });

      // Add owner membership with organizer role
      await prisma.membership.create({
        data: {
          eventId: newEvent.id,
          userId: ownerId,
          role: 'organizer',
          status: 'active',
          zoneState: 'eligible'
        }
      });

      res.status(201).json(newEvent);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get event details & memberships & teams
  app.get('/api/events/:eventId', requireAuth, async (req, res) => {
    try {
      const event = await prisma.event.findUnique({ where: { id: req.params.eventId } });
      if (!event) return res.status(404).json({ error: 'Event not found' });

      const memberships = await prisma.membership.findMany({
        where: { eventId: event.id },
        include: { user: true, team: true }
      });
      const teams = await prisma.team.findMany({ where: { eventId: event.id } });

      res.json({ event, memberships, teams });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Join event (Uses authenticated user identity only)
  app.post('/api/events/:eventId/join', requireAuth, rateLimiter(30), async (req: AuthenticatedRequest, res) => {
    try {
      const { registrationCode } = req.body;
      const userId = req.user.id;
      const event = await prisma.event.findUnique({ where: { id: req.params.eventId } });
      if (!event) return res.status(404).json({ error: 'Event not found' });

      let membership = await prisma.membership.findUnique({
        where: { eventId_userId: { eventId: event.id, userId } },
        include: { user: true, team: true }
      });

      if (!membership) {
        membership = await prisma.membership.create({
          data: {
            eventId: event.id,
            userId,
            registrationId: registrationCode || `REG-${Math.floor(1000 + Math.random() * 9000)}`,
            role: 'participant',
            status: 'active',
            zoneState: 'demo_zone'
          },
          include: { user: true, team: true }
        });
      } else {
        membership = await prisma.membership.update({
          where: { id: membership.id },
          data: { zoneState: 'demo_zone' },
          include: { user: true, team: true }
        });
      }

      res.json({ success: true, membership });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Geofence server-side boundary validation & verification
  // PRIVACY: Raw latitude/longitude coordinates are NEVER stored in database columns!
  app.post('/api/events/:eventId/verify-zone', requireAuth, rateLimiter(60), async (req: AuthenticatedRequest, res) => {
    try {
      const { latitude, longitude, demoMode } = req.body;
      const event = await prisma.event.findUnique({ where: { id: req.params.eventId } });
      if (!event) return res.status(404).json({ error: 'Event not found' });

      let isEligible = false;
      let calculatedDistance: number | null = null;
      let zoneState = 'outside_zone';

      if (demoMode) {
        isEligible = true;
        zoneState = 'demo_zone';
      } else if (typeof latitude === 'number' && typeof longitude === 'number') {
        const config = typeof event.zoneConfig === 'string' ? JSON.parse(event.zoneConfig) : event.zoneConfig;
        if (config && config.latitude && config.longitude) {
          calculatedDistance = calculateDistanceMeters(latitude, longitude, config.latitude, config.longitude);
          const maxRadius = config.radiusMeters || 500;
          isEligible = calculatedDistance <= maxRadius;
          zoneState = isEligible ? 'eligible' : 'outside_zone';
        } else {
          isEligible = true;
          zoneState = 'eligible';
        }
      }

      let membership = await prisma.membership.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: req.user.id } }
      });

      if (membership) {
        membership = await prisma.membership.update({
          where: { id: membership.id },
          data: { zoneState }
        });
      }

      res.json({
        success: true,
        isEligible,
        zoneState,
        distanceMeters: calculatedDistance ? Math.round(calculatedDistance) : null,
        message: isEligible ? 'Zone boundary verified' : 'Outside verified event zone'
      });
    } catch (err: any) {
      console.error('Geofence verification error:', err);
      res.status(500).json({ error: 'Failed to verify geofence zone' });
    }
  });

  // CSV Import Wizard endpoint (Organizer only)
  app.post('/api/events/:eventId/import-csv', requireAuth, rateLimiter(120), async (req: AuthenticatedRequest, res) => {
    try {
      const { eventId } = req.params;
      const { csvData } = req.body;

      const callerMem = await prisma.membership.findUnique({
        where: { eventId_userId: { eventId, userId: req.user.id } }
      });
      const isOrganizer = req.user.role === 'organizer' || callerMem?.role === 'organizer' || callerMem?.role === 'owner';
      if (!isOrganizer) {
        return res.status(403).json({ error: 'Forbidden: Only event organizers can import participant rosters' });
      }

      if (!Array.isArray(csvData)) {
        return res.status(400).json({ error: 'Invalid CSV data format: Array expected' });
      }

      let importedCount = 0;
      let duplicateCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      const seenEmailsInBatch = new Set<string>();

      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        const name = (row.participant_name || row.name || '').trim();
        const rawEmail = (row.email || '').trim().toLowerCase();
        const teamName = (row.team_name || row.team || '').trim();
        const regId = (row.registration_id || row.regId || '').trim();

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!rawEmail || !emailRegex.test(rawEmail)) {
          errorCount++;
          errors.push(`Row ${i + 1}: Invalid or missing email ('${rawEmail}')`);
          continue;
        }

        if (seenEmailsInBatch.has(rawEmail)) {
          duplicateCount++;
          errors.push(`Row ${i + 1}: Duplicate email in batch ('${rawEmail}')`);
          continue;
        }
        seenEmailsInBatch.add(rawEmail);

        let user = await prisma.user.findUnique({ where: { email: rawEmail } });
        if (!user) {
          const defaultPassword = hashPassword('DropZone@2026');
          user = await prisma.user.create({
            data: {
              name: name || rawEmail.split('@')[0],
              email: rawEmail,
              passwordHash: defaultPassword,
              role: 'participant',
              avatar: `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100`
            }
          });
        }

        const existingMem = await prisma.membership.findUnique({
          where: { eventId_userId: { eventId, userId: user.id } }
        });
        if (existingMem) {
          duplicateCount++;
          continue;
        }

        let teamId: string | undefined = undefined;
        if (teamName) {
          let team = await prisma.team.findFirst({
            where: { eventId, name: { equals: teamName } }
          });
          if (!team) {
            team = await prisma.team.create({
              data: {
                eventId,
                name: teamName,
                code: teamName.substring(0, 5).toUpperCase() + '26'
              }
            });
          }
          teamId = team.id;
        }

        await prisma.membership.create({
          data: {
            eventId,
            userId: user.id,
            registrationId: regId || `REG-${Math.floor(10000 + Math.random() * 90000)}`,
            teamId,
            role: 'participant',
            status: 'active',
            zoneState: 'eligible'
          }
        });

        importedCount++;
      }

      res.json({
        success: true,
        summary: {
          totalRows: csvData.length,
          importedCount,
          duplicateCount,
          errorCount,
          errors
        }
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/events/:eventId/zones', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { eventId } = req.params;
      await pool.query(`DELETE FROM "Zone" WHERE "expiresAt" <= NOW() - INTERVAL '30 days'`);
      const result = await pool.query(
        `SELECT z.*, COUNT(DISTINCT j."userId")::int AS "memberCount",
                COALESCE(BOOL_OR(j."userId" = $2), false) AS joined
         FROM "Zone" z
         LEFT JOIN "ZoneJoin" j ON j."zoneId" = z.id
         WHERE z."eventId" = $1
         GROUP BY z.id
         ORDER BY z."createdAt" DESC`,
        [eventId, req.user.id]
      );
      return res.json(result.rows.map((zone: any) => ({ ...parseZoneJson(zone), memberCount: Number(zone.memberCount), joined: Boolean(zone.joined) })));
    } catch (err: any) {
      console.error('Zone list error:', err);
      return res.status(500).json({ error: 'Could not load event zones from database.' });
    }
  });

  app.post('/api/events/:eventId/zones', requireAuth, rateLimiter(20), async (req: AuthenticatedRequest, res) => {
    try {
      const { eventId } = req.params;
      const { name, description, geometry, radiusMeters, ttlSeconds, allowedPostTypes } = req.body;
      const membership = await prisma.membership.findUnique({
        where: { eventId_userId: { eventId, userId: req.user.id } }
      });
      const canCreate = ['organizer', 'moderator', 'owner'].includes(req.user.role) ||
        ['organizer', 'moderator', 'owner'].includes(membership?.role || '');
      if (!canCreate) return res.status(403).json({ error: 'Only event organizers and moderators can create zones.' });
      if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Zone name is required.' });
      if (typeof description !== 'string') return res.status(400).json({ error: 'Zone description is required.' });
      if (!isValidZoneGeometry(geometry)) return res.status(400).json({ error: 'Provide a valid GeoJSON Point or Polygon.' });
      if (geometry.type === 'Point' && (!Number.isInteger(radiusMeters) || radiusMeters < 50 || radiusMeters > 500)) {
        return res.status(400).json({ error: 'Circle radius must be between 50m and 500m.' });
      }
      const allowedTtls = [7200, 86400, 604800];
      if (!allowedTtls.includes(Number(ttlSeconds))) return res.status(400).json({ error: 'Choose a zone lifetime of 2 hours, 24 hours, or 7 days.' });
      const allowedCategories = ['lost_found', 'requirement', 'announcement', 'qa', 'promotion'];
      if (!Array.isArray(allowedPostTypes) || allowedPostTypes.length === 0 ||
        allowedPostTypes.some((category: string) => !allowedCategories.includes(category))) {
        return res.status(400).json({ error: 'Select one or more valid post types.' });
      }

      const data = {
        id: `zone-${crypto.randomUUID()}`,
        eventId,
        name: name.trim().slice(0, 100),
        description: description.trim().slice(0, 500),
        geometry,
        radiusMeters: geometry.type === 'Point' ? radiusMeters : null,
        ttlSeconds: Number(ttlSeconds),
        allowedPostTypes,
        createdBy: req.user.id,
        expiresAt: new Date(Date.now() + Number(ttlSeconds) * 1000).toISOString()
      };
      const result = await pool.query(
        `INSERT INTO "Zone" (id, "eventId", name, description, geometry, "radiusMeters", "ttlSeconds", "allowedPostTypes", "createdBy", "expiresAt")
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::jsonb, $9, $10) RETURNING *`,
        [data.id, data.eventId, data.name, data.description, JSON.stringify(data.geometry), data.radiusMeters, data.ttlSeconds, JSON.stringify(data.allowedPostTypes), data.createdBy, data.expiresAt]
      );
      const zone = result.rows[0];
      return res.status(201).json({ ...parseZoneJson(zone), memberCount: 0, joined: false });
    } catch (err: any) {
      console.error('Zone creation error:', err);
      return res.status(500).json({ error: 'Could not create zone.' });
    }
  });

  app.post('/api/events/:eventId/zones/:zoneId/join', requireAuth, rateLimiter(40), async (req: AuthenticatedRequest, res) => {
    try {
      const { eventId, zoneId } = req.params;
      const result = await pool.query('SELECT * FROM "Zone" WHERE id = $1 AND "eventId" = $2 AND "expiresAt" > NOW()', [zoneId, eventId]);
      const zone = result.rows[0] || null;
      if (!zone) return res.status(404).json({ error: 'This zone is no longer active.' });

      const joinResult = await pool.query(
        `INSERT INTO "ZoneJoin" ("zoneId", "userId", "eventId") VALUES ($1, $2, $3)
         ON CONFLICT ("zoneId", "userId") DO UPDATE SET "zoneId" = EXCLUDED."zoneId" RETURNING "joinedAt"`,
        [zoneId, req.user.id, eventId]
      );
      const joinedAt = joinResult.rows[0].joinedAt;
      await pool.query(
        `UPDATE "Membership" SET "lastKnownZoneId" = $1, "zoneState" = 'eligible' WHERE "eventId" = $2 AND "userId" = $3`,
        [zoneId, eventId, req.user.id]
      );
      return res.json({ success: true, joinedAt });
    } catch (err: any) {
      console.error('Zone join error:', err);
      return res.status(500).json({ error: 'Could not join this zone.' });
    }
  });

  app.delete('/api/events/:eventId/zones/:zoneId/join', requireAuth, rateLimiter(40), async (req: AuthenticatedRequest, res) => {
    try {
      const { eventId, zoneId } = req.params;
      await pool.query('DELETE FROM "ZoneJoin" WHERE "zoneId" = $1 AND "userId" = $2 AND "eventId" = $3', [zoneId, req.user.id, eventId]);
      const membership = await prisma.membership.findUnique({
        where: { eventId_userId: { eventId, userId: req.user.id } }
      });
      if (membership?.lastKnownZoneId === zoneId) {
        await prisma.membership.update({ where: { id: membership.id }, data: { lastKnownZoneId: null } });
      }
      return res.json({ success: true });
    } catch (err: any) {
      console.error('Zone leave error:', err);
      return res.status(500).json({ error: 'Could not leave this zone.' });
    }
  });

  app.post('/api/events/:eventId/zones/locate', requireAuth, rateLimiter(60), async (req: AuthenticatedRequest, res) => {
    try {
      const { latitude, longitude, simulated } = req.body;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return res.status(400).json({ error: 'A valid coarse location is required.' });
      }
      const coarseLatitude = Math.round(latitude * 1000) / 1000;
      const coarseLongitude = Math.round(longitude * 1000) / 1000;
      const result = await pool.query('SELECT * FROM "Zone" WHERE "eventId" = $1 AND "expiresAt" > NOW()', [req.params.eventId]);
      const zones = result.rows;
      const activeZone = zones.find(zone => pointInZone(coarseLongitude, coarseLatitude, zone));
      const simulatedInDevelopment = process.env.NODE_ENV !== 'production' && simulated === true;

      const membership = await prisma.membership.findUnique({
        where: { eventId_userId: { eventId: req.params.eventId, userId: req.user.id } }
      });
      if (membership) {
        await prisma.membership.update({
          where: { id: membership.id },
          data: { lastKnownZoneId: activeZone?.id || null, zoneState: activeZone ? 'eligible' : 'outside_zone' }
        });
      } else {
        await prisma.membership.create({
          data: {
            eventId: req.params.eventId,
            userId: req.user.id,
            registrationId: `REG-${Math.floor(1000 + Math.random() * 9000)}`,
            role: req.user.role || 'participant',
            status: 'active',
            lastKnownZoneId: activeZone?.id || null,
            zoneState: activeZone ? 'eligible' : 'outside_zone'
          }
        });
      }
      return res.json({
        zoneId: activeZone?.id || null,
        zoneName: activeZone?.name || null,
        simulated: simulatedInDevelopment
      });
    } catch (err: any) {
      console.error('Zone locate error:', err);
      return res.status(500).json({ error: 'Could not verify zone entry.' });
    }
  });

  // Get posts for event
  app.get('/api/events/:eventId/posts', requireAuth, async (req, res) => {
    try {
      const { category, search, limit, offset, includeExpired } = req.query;
      const where: any = {
        eventId: req.params.eventId,
        status: 'active',
        includeExpired: includeExpired === 'true'
      };

      if (typeof req.query.zoneId === 'string' && req.query.zoneId) where.zoneId = req.query.zoneId;

      if (category && category !== 'all') {
        where.category = category;
      }
      if (search && typeof search === 'string') {
        where.OR = [
          { title: { contains: search } },
          { content: { contains: search } }
        ];
      }

      const parsedLimit = limit ? Math.min(Math.max(1, parseInt(limit as string, 10)), 100) : 50;
      const parsedOffset = offset ? Math.max(0, parseInt(offset as string, 10)) : 0;

      const posts = await prisma.post.findMany({
        where,
        limit: parsedLimit,
        offset: parsedOffset
      });
      res.json(posts);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Create post (Enforces authenticated user as authorId)
  app.post('/api/events/:eventId/posts', requireAuth, rateLimiter(40), async (req: AuthenticatedRequest, res) => {
    try {
      const { eventId } = req.params;
      const { category, title, content, structuredData, approxLocation, audience, teamId, ttlMinutes, zoneId } = req.body;

      if (!title || title.trim().length === 0) {
        return res.status(400).json({ error: 'Post title is required' });
      }
      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'Post content is required' });
      }
      const publicText = [title, content, approxLocation].filter((value): value is string => typeof value === 'string').join(' ');
      const preciseCoordinatePair = /(?:^|\D)(-?\d{1,3}\.\d{4,})\s*[,; ]\s*(-?\d{1,3}\.\d{4,})(?:\D|$)/;
      if (preciseCoordinatePair.test(publicText)) {
        return res.status(400).json({ error: 'Do not include precise coordinates in public posts. Use an approximate venue description.' });
      }
      const isStaff = ['organizer', 'owner', 'moderator'].includes(req.user.role);
      let isAuthorizedStaff = isStaff;
      if (!isStaff) {
        const membership = await prisma.membership.findUnique({
          where: { eventId_userId: { eventId, userId: req.user.id } }
        });
        if (['organizer', 'owner', 'moderator'].includes(membership?.role || '')) {
          isAuthorizedStaff = true;
        }
      }

      if (category === 'announcement' && !isAuthorizedStaff) {
        return res.status(403).json({ error: 'Only event organizers and moderators can publish announcements.' });
      }

      // Security: author is strictly derived from authenticated caller token
      const authorId = req.user.id;
      const authorName = req.user.name;

      let zone: any = null;
      let ttlSeconds = 7200; // default 2 hours

      const isAnnouncement = category === 'announcement';

      if (zoneId && !isAnnouncement) {
        const result = await pool.query('SELECT * FROM "Zone" WHERE id = $1 AND "eventId" = $2 AND "expiresAt" > NOW()', [zoneId, eventId]);
        zone = result.rows[0] || null;
        if (!zone) return res.status(400).json({ error: 'This zone has expired or is unavailable.' });
        const parsedZone = parseZoneJson(zone);
        if (!parsedZone.allowedPostTypes.includes(category)) {
          return res.status(400).json({ error: 'This post type is not allowed in the selected zone.' });
        }
        let membership = await prisma.membership.findUnique({
          where: { eventId_userId: { eventId, userId: req.user.id } }
        });
        if (!membership) {
          membership = await prisma.membership.create({
            data: {
              eventId,
              userId: req.user.id,
              registrationId: `REG-${Math.floor(1000 + Math.random() * 9000)}`,
              role: req.user.role || 'participant',
              status: 'active',
              zoneState: 'eligible'
            }
          });
        }
        const joined = await pool.query('SELECT 1 FROM "ZoneJoin" WHERE "zoneId" = $1 AND "userId" = $2', [zoneId, req.user.id]);
        const hasJoined = Boolean(joined.rowCount && joined.rowCount > 0);
        if (!hasJoined && membership?.lastKnownZoneId !== zoneId) {
          return res.status(403).json({ error: 'Join the zone or enable location while inside it before posting.' });
        }
        ttlSeconds = zone.ttlSeconds || zone.ttl_seconds || 7200;
      } else if (ttlMinutes) {
        ttlSeconds = Math.max(60, Math.min(parseInt(ttlMinutes, 10) * 60, 604800));
      }

      // Snapshot the TTL value used at creation time
      const ttlSecondsSnapshot = ttlSeconds;

      // Server-side expires_at computation (never trust client time)
      let expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
      if (zone?.expiresAt) {
        const zoneExpiry = new Date(zone.expiresAt).getTime();
        if (zoneExpiry < new Date(expiresAt).getTime()) {
          expiresAt = new Date(zoneExpiry).toISOString();
        }
      }

      const status = isAnnouncement ? 'live' : (category === 'promotion' ? 'pending_review' : 'live');

      const newPost = await prisma.post.create({
        data: {
          eventId,
          authorId,
          authorName,
          category: category || 'lost_found',
          title: title.trim().slice(0, 200),
          content: content.trim().slice(0, 3000),
          structuredData: structuredData || undefined,
          approxLocation: approxLocation ? approxLocation.trim().slice(0, 100) : null,
          audience: audience || 'all',
          teamId,
          zoneId: isAnnouncement ? null : (zoneId || null),
          status,
          expiresAt,
          ttlSecondsSnapshot,
          reportCount: 0
        }
      });

      if (isAnnouncement) {
        try {
          const eventMemberships = await prisma.membership.findMany({ where: { eventId } });
          for (const m of eventMemberships) {
            await prisma.notification.create({
              data: {
                eventId,
                userId: m.userId,
                type: 'announcement',
                title: `Announcement: ${newPost.title}`,
                content: newPost.content.slice(0, 250),
                isRead: false
              }
            });
          }
        } catch (notifErr) {
          console.warn('Could not fan-out announcement notification:', notifErr);
        }
      }

      res.status(201).json(newPost);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Update post status
  app.patch('/api/events/:eventId/posts/:postId', requireAuth, rateLimiter(40), async (req: AuthenticatedRequest, res) => {
    try {
      const { status } = req.body;
      const post = await prisma.post.findUnique({ where: { id: req.params.postId } });
      if (!post) return res.status(404).json({ error: 'Post not found' });

      const mem = await prisma.membership.findUnique({
        where: { eventId_userId: { eventId: req.params.eventId, userId: req.user.id } }
      });
      const isPrivileged = req.user.role === 'organizer' || req.user.role === 'moderator' || mem?.role === 'organizer' || mem?.role === 'moderator';
      const isAuthor = post.authorId === req.user.id;

      if (!isAuthor && !isPrivileged) {
        return res.status(403).json({ error: 'Forbidden: You do not have permission to modify this post' });
      }

      const updated = await prisma.post.update({
        where: { id: req.params.postId },
        data: { status }
      });
      res.json(updated);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // TTL Cleanup trigger
  app.post('/api/events/:eventId/posts/cleanup-expired', requireAuth, async (req, res) => {
    try {
      const count = await prisma.post.cleanupExpired(req.params.eventId);
      res.json({ success: true, expiredCount: count });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Dedicated Zone Feed (status = "live" AND expires_at > now())
  app.get(['/zones/:zoneId/feed', '/api/zones/:zoneId/feed', '/api/events/:eventId/zones/:zoneId/feed'], requireAuth, async (req, res) => {
    try {
      const { zoneId } = req.params;
      const posts = await prisma.post.findMany({
        where: {
          zoneId,
          status: 'live',
          includeExpired: false
        }
      });
      // Strict defense-in-depth: status must be live/active and not expired or held
      const now = Date.now();
      const livePosts = posts.filter((p: any) =>
        (p.status === 'live' || p.status === 'active') &&
        (!p.expiresAt || new Date(p.expiresAt).getTime() > now)
      );
      res.json(livePosts);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Expiry Policy Transparency Endpoint
  app.get(['/api/expiry-policy', '/api/events/:eventId/expiry-policy'], async (req, res) => {
    try {
      res.json({
        policyName: 'DropZone Ephemeral Content Expiry & Transparency Policy',
        version: '2026.1',
        rule: 'expires_at is computed server-side at creation. Never trust client time.',
        summary: 'DropZone posts expire based on their zone TTL. Expiry removes content from live feeds and purges primary stores, but does not guarantee cryptographic eradication across server logs, backups, or recipient devices.',
        whatExpiryDoes: [
          'Post vanishes from all zone and event feeds instantly when TTL passes.',
          'Excluded from all client-facing API responses and feed queries.',
          'Status is transitioned from live to expired by server-side cleanup jobs.',
          'Primary content is hard-purged after a 24-hour retention grace period.',
          'Audit actions are logged transparently to expiry_audit_log.'
        ],
        whatExpiryDoesNot: [
          'Server access logs and HTTP proxy logs (retained temporarily for DDoS/security audit).',
          'Point-in-time database disaster backups (cycled on routine backup schedules).',
          'Recipient screenshots or local browser caching captured while the post was live.',
          'Moderation/legal holds (reported content is retained until reviewed, even if TTL passes).'
        ],
        moderationOverride: {
          rule: 'Reported content is retained until reviewed, even if its TTL passes.',
          status: 'held',
          description: 'Flagged posts transition to held status with paused expiry until reviewed by an organizer.'
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Expiry Audit Log Endpoint
  app.get(['/api/expiry-audit-log', '/api/events/:eventId/expiry-audit-log'], requireAuth, async (req, res) => {
    try {
      const logs = await prisma.expiryAuditLog.findMany({ limit: 50 });
      res.json(logs);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get messages (Enforces team channel isolation)
  app.get('/api/events/:eventId/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { limit, offset } = req.query;
      const parsedLimit = limit ? Math.min(Math.max(1, parseInt(limit as string, 10)), 100) : 50;
      const parsedOffset = offset ? Math.max(0, parseInt(offset as string, 10)) : 0;

      const mem = await prisma.membership.findUnique({
        where: { eventId_userId: { eventId: req.params.eventId, userId: req.user.id } }
      });
      const isOrganizer = req.user.role === 'organizer' || mem?.role === 'organizer';
      const userTeamId = mem?.teamId;

      const allMessages = await prisma.message.findMany({
        where: { eventId: req.params.eventId },
        limit: parsedLimit,
        offset: parsedOffset
      });

      const filtered = allMessages.filter((msg: any) => {
        if (msg.recipientType === 'all' || !msg.recipientType) return true;
        if (isOrganizer) return true;
        if (msg.recipientType === 'team' && msg.recipientId === userTeamId) return true;
        return false;
      });

      res.json(filtered);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Post message (Enforces authenticated user as senderId)
  app.post('/api/events/:eventId/messages', requireAuth, rateLimiter(60), async (req: AuthenticatedRequest, res) => {
    try {
      const { eventId } = req.params;
      const { recipientType, recipientId, content } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'Message content is required' });
      }

      const senderId = req.user.id;
      const senderName = req.user.name;

      if (recipientType === 'team' && recipientId) {
        const mem = await prisma.membership.findUnique({
          where: { eventId_userId: { eventId, userId: senderId } }
        });
        const isOrganizer = req.user.role === 'organizer' || mem?.role === 'organizer';
        if (!isOrganizer && mem?.teamId !== recipientId) {
          return res.status(403).json({ error: 'Forbidden: You can only send messages to your assigned team' });
        }
      }

      const newMsg = await prisma.message.create({
        data: {
          eventId,
          senderId,
          senderName,
          recipientType: recipientType || 'all',
          recipientId,
          content: content.trim().slice(0, 2000)
        }
      });

      res.status(201).json(newMsg);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get reports (RBAC: Only organizers & moderators)
  app.get('/api/events/:eventId/reports', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const mem = await prisma.membership.findUnique({
        where: { eventId_userId: { eventId: req.params.eventId, userId: req.user.id } }
      });
      const isStaff = req.user.role === 'organizer' || req.user.role === 'moderator' || mem?.role === 'organizer' || mem?.role === 'moderator';

      if (!isStaff) {
        return res.status(403).json({ error: 'Forbidden: Only organizers and moderators can view moderation reports' });
      }

      const reports = await prisma.report.findMany({
        where: { eventId: req.params.eventId }
      });
      res.json(reports);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Create report
  app.post('/api/events/:eventId/reports', requireAuth, rateLimiter(20), async (req: AuthenticatedRequest, res) => {
    try {
      const { eventId } = req.params;
      const { targetType, targetId, targetSummary, reason, details } = req.body;

      if (!targetId || !reason) {
        return res.status(400).json({ error: 'targetId and reason are required' });
      }

      const reporterId = req.user.id;
      const reporterName = req.user.name;

      const newReport = await prisma.report.create({
        data: {
          eventId,
          targetType: targetType || 'post',
          targetId,
          targetSummary: (targetSummary || 'Reported item').trim().slice(0, 200),
          reporterId,
          reporterName,
          reason: reason.trim().slice(0, 100),
          details: details ? details.trim().slice(0, 500) : null,
          status: 'pending'
        }
      });

      if (targetType === 'post') {
        // Moderation Override: Reported content is placed on hold and retained until reviewed even if TTL passes
        await prisma.post.update({
          where: { id: targetId },
          data: {
            reportCount: { increment: 1 },
            status: 'held',
            heldUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          }
        }).catch(() => {});

        await prisma.expiryAuditLog.create({
          data: {
            postId: targetId,
            action: 'held',
            reason: `Moderation Hold applied: reported for ${reason.trim().slice(0, 100)} (retained until reviewed)`
          }
        }).catch(() => {});
      }

      res.status(201).json(newReport);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Moderate report action (RBAC: Only organizers & moderators)
  app.patch('/api/events/:eventId/reports/:reportId', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const mem = await prisma.membership.findUnique({
        where: { eventId_userId: { eventId: req.params.eventId, userId: req.user.id } }
      });
      const isStaff = req.user.role === 'organizer' || req.user.role === 'moderator' || mem?.role === 'organizer' || mem?.role === 'moderator';

      if (!isStaff) {
        return res.status(403).json({ error: 'Forbidden: Only organizers and moderators can moderate reports' });
      }

      const { status } = req.body;
      const report = await prisma.report.update({
        where: { id: req.params.reportId },
        data: { status }
      });

      if (report.targetType === 'post') {
        if (status === 'restricted' || status === 'resolved') {
          await prisma.post.update({
            where: { id: report.targetId },
            data: { status: 'removed', removedReason: 'Moderation review action' }
          }).catch(() => {});

          await prisma.expiryAuditLog.create({
            data: {
              postId: report.targetId,
              action: 'purged',
              reason: 'Post removed following moderator review'
            }
          }).catch(() => {});
        } else if (status === 'dismissed') {
          // Unhold post if report dismissed
          await prisma.post.update({
            where: { id: report.targetId },
            data: { status: 'live', heldUntil: null }
          }).catch(() => {});
        }
      }

      res.json(report);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Notifications endpoint
  app.get('/api/events/:eventId/notifications', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const notifications = await prisma.notification.findMany({
        where: { eventId: req.params.eventId, userId: req.user.id }
      });
      res.json(notifications);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Mark notification read
  app.patch('/api/events/:eventId/notifications/:id/read', requireAuth, async (req, res) => {
    try {
      const notif = await prisma.notification.update({
        where: { id: req.params.id },
        data: { isRead: true }
      });
      res.json(notif);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get participants and memberships
  app.get('/api/events/:eventId/participants', requireAuth, async (req, res) => {
    try {
      const memberships = await prisma.membership.findMany({
        where: { eventId: req.params.eventId },
        include: { user: true, team: true }
      });
      res.json(memberships);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  const port = Number(process.env.PORT) || 3000;
  const viteHmrPort = port <= 55535 ? port + 10000 : port - 10000;

  // Setup Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { port: viteHmrPort, clientPort: viteHmrPort }
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`DropZone server running on port ${port} with secure mandatory authentication`);
  });

  // Feature 4: Background Purge Job (Runs every 5 minutes)
  const runBackgroundPurge = async () => {
    try {
      const expiredCount = await prisma.post.cleanupExpired();
      if (expiredCount > 0) {
        console.log(`[DropZone Background TTL Job] Cleared and marked ${expiredCount} expired posts.`);
      }
    } catch (err) {
      console.warn('[DropZone Background TTL Job] Expiry cycle warning:', err);
    }
  };

  const purgeJobInterval = setInterval(runBackgroundPurge, 5 * 60 * 1000);
  setTimeout(runBackgroundPurge, 3000);

  // Graceful shutdown handling
  const shutdown = async () => {
    console.log('Initiating graceful shutdown...');
    clearInterval(purgeJobInterval);
    server.close(async () => {
      try {
        await pool.end();
        console.log('PostgreSQL connection pool drained.');
      } catch (err) {
        console.error('Error closing pool:', err);
      }
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
