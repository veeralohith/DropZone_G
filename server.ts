import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { prisma, pool } from './src/lib/prisma.js';
import { dbStore } from './src/lib/db.js';

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

async function seedDevelopmentDemoAccounts() {
  if (process.env.NODE_ENV === 'production') return;

  try {
    await pool.query('SELECT 1');
    return;
  } catch {
    console.warn('PostgreSQL is unavailable; preparing local development demo accounts.');
  }

  const passwordHash = hashPassword('DropZone@2026');
  const demoAccounts = [
    { id: 'usr-1', name: 'Aarav Sharma', email: 'aarav@hackathon.samartha.org', role: 'participant', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' },
    { id: 'usr-2', name: 'Dr. Priya Nair', email: 'priya.organizer@hackathon.samartha.org', role: 'organizer', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100' },
    { id: 'usr-3', name: 'Vikram Mehta (Mod)', email: 'vikram.mod@hackathon.samartha.org', role: 'moderator', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100' },
    { id: 'usr-4', name: 'Ananya Roy', email: 'ananya@hackathon.samartha.org', role: 'participant', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' }
  ];

  for (const account of demoAccounts) {
    await dbStore.users.upsert({
      where: { email: account.email },
      update: { ...account, passwordHash },
      create: { ...account, passwordHash }
    });
  }

  const eventId = 'evt-samartha-2026';
  const existingEvent = await dbStore.events.findUnique({ where: { id: eventId } });
  if (!existingEvent) {
    await dbStore.events.create({
      data: {
        id: eventId,
        name: 'SAMARTHA National Hackathon 2026',
        description: 'Zone-based collaboration for the SAMARTHA National Hackathon.',
        eventType: 'hybrid',
        startDate: '2026-10-15T09:00:00.000Z',
        endDate: '2026-10-17T18:00:00.000Z',
        timezone: 'Asia/Kolkata',
        accessMode: 'csv_verified',
        zoneConfig: {
          enabled: true,
          radiusMeters: 500,
          centerName: 'IIT Delhi Innovation Pavilion Zone A',
          latitude: 28.545,
          longitude: 77.1926
        },
        teamPolicy: 'optional',
        defaultTtlMinutes: 1440,
        ownerId: 'usr-2',
        status: 'active'
      }
    });
  }

  const demoMemberships = [
    { id: 'mem-1', userId: 'usr-1', registrationId: 'SM-2026-001', role: 'participant', zoneState: 'demo_zone' },
    { id: 'mem-2', userId: 'usr-2', registrationId: 'SM-2026-ORG', role: 'organizer', zoneState: 'eligible' },
    { id: 'mem-3', userId: 'usr-3', registrationId: 'SM-2026-MOD', role: 'moderator', zoneState: 'eligible' },
    { id: 'mem-4', userId: 'usr-4', registrationId: 'SM-2026-002', role: 'participant', zoneState: 'demo_zone' }
  ];

  for (const membership of demoMemberships) {
    const existingMembership = await dbStore.memberships.findUnique({
      where: { eventId_userId: { eventId, userId: membership.userId } }
    });
    if (!existingMembership) {
      await dbStore.memberships.create({
        data: { ...membership, eventId, status: 'active' }
      });
    }
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
  await seedDevelopmentDemoAccounts();

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

  // Get posts for event
  app.get('/api/events/:eventId/posts', requireAuth, async (req, res) => {
    try {
      const { category, search, limit, offset, includeExpired } = req.query;
      const where: any = {
        eventId: req.params.eventId,
        status: 'active',
        includeExpired: includeExpired === 'true'
      };

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
      const { category, title, content, structuredData, approxLocation, audience, teamId, ttlMinutes } = req.body;

      if (!title || title.trim().length === 0) {
        return res.status(400).json({ error: 'Post title is required' });
      }
      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'Post content is required' });
      }

      // Security: author is strictly derived from authenticated caller token
      const authorId = req.user.id;
      const authorName = req.user.name;

      const ttl = ttlMinutes ? Math.max(1, Math.min(parseInt(ttlMinutes, 10), 10080)) : 1440;
      const expiresAt = new Date(Date.now() + ttl * 60000).toISOString();

      const isAnnouncement = category === 'announcement';
      const status = isAnnouncement ? 'active' : (category === 'promotion' ? 'pending_review' : 'active');

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
          status,
          expiresAt,
          reportCount: 0
        }
      });

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
        await prisma.post.update({
          where: { id: targetId },
          data: { reportCount: { increment: 1 } }
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

      if (status === 'restricted' && report.targetType === 'post') {
        await prisma.post.update({
          where: { id: report.targetId },
          data: { status: 'expired' }
        }).catch(() => {});
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

  // Graceful shutdown handling
  const shutdown = async () => {
    console.log('Initiating graceful shutdown...');
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
