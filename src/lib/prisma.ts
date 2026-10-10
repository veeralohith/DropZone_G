import dotenv from 'dotenv';
dotenv.config({ override: true });
import pg from 'pg';
import { dbStore } from './db.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on('error', (err) => {
  const sanitized = (err?.message || '').replace(/(postgres(?:ql)?:\/\/[^:]+:)[^@]+(@)/i, '$1****$2');
  console.warn('Unexpected error on idle PostgreSQL client:', sanitized);
});

async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}

export const prisma = {
  $transaction: async <T>(fn: (tx: { query: (text: string, params?: any[]) => Promise<any> }) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn({
        query: (text: string, params?: any[]) => client.query(text, params)
      });
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  user: {
    async findMany() {
      try {
        const res = await query('SELECT * FROM "User" ORDER BY "createdAt" ASC');
        return res.rows;
      } catch (err) {
        console.warn('Postgres query fallback to dbStore for user.findMany');
        return dbStore.users.findMany();
      }
    },
    async findUnique(args: { where: { id?: string; email?: string; authUserId?: string } }) {
      try {
        if (args.where.authUserId) {
          const res = await query('SELECT * FROM "User" WHERE "authUserId" = $1 LIMIT 1', [args.where.authUserId]);
          return res.rows[0] || null;
        }
        if (args.where.id) {
          const res = await query('SELECT * FROM "User" WHERE id = $1 LIMIT 1', [args.where.id]);
          return res.rows[0] || null;
        }
        if (args.where.email) {
          const res = await query('SELECT * FROM "User" WHERE LOWER(email) = LOWER($1) LIMIT 1', [args.where.email]);
          return res.rows[0] || null;
        }
        return null;
      } catch (err) {
        return dbStore.users.findUnique(args);
      }
    },
    async findFirst() {
      try {
        const res = await query('SELECT * FROM "User" ORDER BY "createdAt" ASC LIMIT 1');
        return res.rows[0] || null;
      } catch (err) {
        return dbStore.users.findFirst();
      }
    },
    async create(args: { data: any }) {
      try {
        const id = args.data.id || `usr-${Date.now()}`;
        const authUserId = args.data.authUserId || id;
        const res = await query(
          'INSERT INTO "User" (id, "authUserId", name, email, "passwordHash", role, avatar, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *',
          [id, authUserId, args.data.name, args.data.email.toLowerCase(), args.data.passwordHash || null, args.data.role || 'participant', args.data.avatar || null]
        );
        return res.rows[0];
      } catch (err) {
        return dbStore.users.create(args);
      }
    },
    async update(args: { where: { id?: string; authUserId?: string }; data: any }) {
      try {
        const updates: string[] = ['"updatedAt" = NOW()'];
        const params: any[] = [];
        let pIndex = 1;

        if (args.data.name !== undefined) {
          updates.push(`name = $${pIndex++}`);
          params.push(args.data.name);
        }
        if (args.data.avatar !== undefined) {
          updates.push(`avatar = $${pIndex++}`);
          params.push(args.data.avatar);
        }
        if (args.data.authUserId !== undefined) {
          updates.push(`"authUserId" = $${pIndex++}`);
          params.push(args.data.authUserId);
        }

        let whereClause = '';
        if (args.where.id) {
          whereClause = `id = $${pIndex++}`;
          params.push(args.where.id);
        } else if (args.where.authUserId) {
          whereClause = `"authUserId" = $${pIndex++}`;
          params.push(args.where.authUserId);
        }

        const sql = `UPDATE "User" SET ${updates.join(', ')} WHERE ${whereClause} RETURNING *`;
        const res = await query(sql, params);
        return res.rows[0] || null;
      } catch (err) {
        return null;
      }
    },
    async upsert(args: { where: { email: string }; update: any; create: any }) {
      try {
        const existing = await this.findUnique({ where: { email: args.where.email } });
        if (existing) return existing;
        return await this.create({ data: args.create });
      } catch (err) {
        return dbStore.users.upsert(args);
      }
    }
  },

  event: {
    async findMany(args?: any) {
      try {
        const res = await query('SELECT * FROM "Event" ORDER BY "createdAt" DESC');
        return res.rows;
      } catch (err) {
        return dbStore.events.findMany(args);
      }
    },
    async findUnique(args: { where: { id: string } }) {
      try {
        const res = await query('SELECT * FROM "Event" WHERE id = $1 LIMIT 1', [args.where.id]);
        return res.rows[0] || null;
      } catch (err) {
        return dbStore.events.findUnique(args);
      }
    },
    async create(args: { data: any }) {
      try {
        const id = args.data.id || `evt-${Date.now()}`;
        const res = await query(
          `INSERT INTO "Event" (id, name, description, "eventType", "startDate", "endDate", timezone, "accessMode", "zoneConfig", "teamPolicy", "defaultTtlMinutes", "ownerId", status, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW()) RETURNING *`,
          [
            id,
            args.data.name,
            args.data.description,
            args.data.eventType || 'hybrid',
            args.data.startDate,
            args.data.endDate,
            args.data.timezone || 'Asia/Kolkata',
            args.data.accessMode || 'open',
            typeof args.data.zoneConfig === 'object' ? JSON.stringify(args.data.zoneConfig) : args.data.zoneConfig,
            args.data.teamPolicy || 'optional',
            args.data.defaultTtlMinutes || 1440,
            args.data.ownerId,
            args.data.status || 'active'
          ]
        );
        return res.rows[0];
      } catch (err) {
        return dbStore.events.create(args);
      }
    }
  },

  membership: {
    async findMany(args: { where?: { eventId?: string; userId?: string; teamId?: string }; include?: any }) {
      try {
        let sql = `
          SELECT m.*,
                 json_build_object('id', u.id, 'name', u.name, 'email', u.email, 'role', u.role, 'avatar', u.avatar) as user,
                 CASE WHEN t.id IS NOT NULL THEN json_build_object('id', t.id, 'name', t.name, 'code', t.code) ELSE NULL END as team
          FROM "Membership" m
          LEFT JOIN "User" u ON m."userId" = u.id
          LEFT JOIN "Team" t ON m."teamId" = t.id
          WHERE 1=1
        `;
        const params: any[] = [];
        let pIndex = 1;
        if (args?.where?.eventId) {
          sql += ` AND m."eventId" = $${pIndex++}`;
          params.push(args.where.eventId);
        }
        if (args?.where?.userId) {
          sql += ` AND m."userId" = $${pIndex++}`;
          params.push(args.where.userId);
        }
        if (args?.where?.teamId) {
          sql += ` AND m."teamId" = $${pIndex++}`;
          params.push(args.where.teamId);
        }
        sql += ' ORDER BY m."createdAt" ASC';
        const res = await query(sql, params);
        return res.rows;
      } catch (err) {
        return dbStore.memberships.findMany(args);
      }
    },
    async findUnique(args: { where: { eventId_userId?: { eventId: string; userId: string }; id?: string }; include?: any }) {
      try {
        let sql = `
          SELECT m.*,
                 json_build_object('id', u.id, 'name', u.name, 'email', u.email, 'role', u.role, 'avatar', u.avatar) as user,
                 CASE WHEN t.id IS NOT NULL THEN json_build_object('id', t.id, 'name', t.name, 'code', t.code) ELSE NULL END as team
          FROM "Membership" m
          LEFT JOIN "User" u ON m."userId" = u.id
          LEFT JOIN "Team" t ON m."teamId" = t.id
        `;
        if (args.where.eventId_userId) {
          sql += ' WHERE m."eventId" = $1 AND m."userId" = $2 LIMIT 1';
          const res = await query(sql, [args.where.eventId_userId.eventId, args.where.eventId_userId.userId]);
          return res.rows[0] || null;
        }
        if (args.where.id) {
          sql += ' WHERE m.id = $1 LIMIT 1';
          const res = await query(sql, [args.where.id]);
          return res.rows[0] || null;
        }
        return null;
      } catch (err) {
        return dbStore.memberships.findUnique(args);
      }
    },
    async create(args: { data: any; include?: any }) {
      try {
        const id = args.data.id || `mem-${Date.now()}`;
        const res = await query(
          `INSERT INTO "Membership" (id, "eventId", "userId", "registrationId", "teamId", role, status, "zoneState", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *`,
          [
            id,
            args.data.eventId,
            args.data.userId,
            args.data.registrationId || null,
            args.data.teamId || null,
            args.data.role || 'participant',
            args.data.status || 'active',
            args.data.zoneState || 'demo_zone'
          ]
        );
        if (args.include) {
          return await this.findUnique({ where: { id }, include: args.include });
        }
        return res.rows[0];
      } catch (err) {
        return dbStore.memberships.create(args);
      }
    },
    async update(args: { where: { id: string }; data: any; include?: any }) {
      try {
        const updates: string[] = ['"updatedAt" = NOW()'];
        const params: any[] = [args.where.id];
        let pIndex = 2;

        if (args.data.zoneState !== undefined) {
          updates.push(`"zoneState" = $${pIndex++}`);
          params.push(args.data.zoneState);
        }
        if (args.data.lastKnownZoneId !== undefined) {
          updates.push(`"lastKnownZoneId" = $${pIndex++}`);
          params.push(args.data.lastKnownZoneId);
        }
        if (args.data.role !== undefined) {
          updates.push(`role = $${pIndex++}`);
          params.push(args.data.role);
        }
        if (args.data.status !== undefined) {
          updates.push(`status = $${pIndex++}`);
          params.push(args.data.status);
        }
        if (args.data.teamId !== undefined) {
          updates.push(`"teamId" = $${pIndex++}`);
          params.push(args.data.teamId);
        }

        const sql = `UPDATE "Membership" SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
        await query(sql, params);
        if (args.include) {
          return await this.findUnique({ where: { id: args.where.id }, include: args.include });
        }
        const res = await query('SELECT * FROM "Membership" WHERE id = $1', [args.where.id]);
        return res.rows[0];
      } catch (err) {
        return dbStore.memberships.update(args);
      }
    }
  },

  team: {
    async findMany(args: { where?: { eventId?: string } }) {
      try {
        let sql = 'SELECT * FROM "Team"';
        const params: any[] = [];
        if (args?.where?.eventId) {
          sql += ' WHERE "eventId" = $1';
          params.push(args.where.eventId);
        }
        sql += ' ORDER BY "createdAt" ASC';
        const res = await query(sql, params);
        return res.rows;
      } catch (err) {
        return dbStore.teams.findMany(args);
      }
    },
    async findFirst(args: { where: { eventId?: string; name?: any; id?: string } }) {
      try {
        let sql = 'SELECT * FROM "Team" WHERE 1=1';
        const params: any[] = [];
        let pIndex = 1;
        if (args.where.id) {
          sql += ` AND id = $${pIndex++}`;
          params.push(args.where.id);
        }
        if (args.where.eventId) {
          sql += ` AND "eventId" = $${pIndex++}`;
          params.push(args.where.eventId);
        }
        if (args.where.name?.equals) {
          sql += ` AND LOWER(name) = LOWER($${pIndex++})`;
          params.push(args.where.name.equals);
        }
        sql += ' LIMIT 1';
        const res = await query(sql, params);
        return res.rows[0] || null;
      } catch (err) {
        return dbStore.teams.findFirst(args);
      }
    },
    async create(args: { data: any }) {
      try {
        const id = args.data.id || `team-${Date.now()}`;
        const res = await query(
          'INSERT INTO "Team" (id, "eventId", name, code, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *',
          [id, args.data.eventId, args.data.name, args.data.code]
        );
        return res.rows[0];
      } catch (err) {
        return dbStore.teams.create(args);
      }
    },
    async upsert(args: { where: { id: string }; create: any }) {
      try {
        const existing = await query('SELECT * FROM "Team" WHERE id = $1', [args.where.id]);
        if (existing.rows[0]) return existing.rows[0];
        return await this.create({ data: args.create });
      } catch (err) {
        return dbStore.teams.upsert(args);
      }
    }
  },

  post: {
    async findMany(args: { where?: any; limit?: number; offset?: number }) {
      try {
        let sql = 'SELECT * FROM "Post" WHERE 1=1';
        const params: any[] = [];
        let pIndex = 1;

        if (args?.where?.eventId) {
          sql += ` AND "eventId" = $${pIndex++}`;
          params.push(args.where.eventId);
        }
        if (args?.where?.status) {
          sql += ` AND status = $${pIndex++}`;
          params.push(args.where.status);
          // By default, filter out expired posts for active queries unless explicitly bypassed
          if (args.where.status === 'active' && !args.where.includeExpired) {
            sql += ` AND ("expiresAt" IS NULL OR "expiresAt" > NOW())`;
          }
        }
        if (args?.where?.category) {
          sql += ` AND category = $${pIndex++}`;
          params.push(args.where.category);
        }
        if (args?.where?.zoneId) {
          sql += ` AND "zoneId" = $${pIndex++}`;
          params.push(args.where.zoneId);
        }
        if (args?.where?.OR && Array.isArray(args.where.OR)) {
          const orClauses: string[] = [];
          for (const clause of args.where.OR) {
            if (clause.title?.contains) {
              orClauses.push(`title ILIKE $${pIndex++}`);
              params.push(`%${clause.title.contains}%`);
            }
            if (clause.content?.contains) {
              orClauses.push(`content ILIKE $${pIndex++}`);
              params.push(`%${clause.content.contains}%`);
            }
          }
          if (orClauses.length > 0) {
            sql += ` AND (${orClauses.join(' OR ')})`;
          }
        }

        sql += ' ORDER BY "createdAt" DESC';

        if (args?.limit) {
          sql += ` LIMIT $${pIndex++}`;
          params.push(args.limit);
        }
        if (args?.offset) {
          sql += ` OFFSET $${pIndex++}`;
          params.push(args.offset);
        }

        const res = await query(sql, params);
        return res.rows;
      } catch (err) {
        return dbStore.posts.findMany(args);
      }
    },
    async findUnique(args: { where: { id: string } }) {
      try {
        const res = await query('SELECT * FROM "Post" WHERE id = $1 LIMIT 1', [args.where.id]);
        return res.rows[0] || null;
      } catch (err) {
        return dbStore.posts.findUnique(args);
      }
    },
    async create(args: { data: any }) {
      try {
        const id = args.data.id || `pst-${Date.now()}`;
        const structData = typeof args.data.structuredData === 'object' && args.data.structuredData !== null
          ? JSON.stringify(args.data.structuredData)
          : (args.data.structuredData || null);

        const res = await query(
          `INSERT INTO "Post" (id, "eventId", "authorId", "authorName", category, title, content, "structuredData", "approxLocation", audience, "teamId", "zoneId", status, "expiresAt", "reportCount", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 0, NOW(), NOW()) RETURNING *`,
          [
            id,
            args.data.eventId,
            args.data.authorId,
            args.data.authorName,
            args.data.category,
            args.data.title,
            args.data.content,
            structData,
            args.data.approxLocation || null,
            args.data.audience || 'all',
            args.data.teamId || null,
            args.data.zoneId || null,
            args.data.status || 'active',
            args.data.expiresAt
          ]
        );
        return res.rows[0];
      } catch (err) {
        return dbStore.posts.create(args);
      }
    },
    async update(args: { where: { id: string }; data: any }) {
      try {
        const updates: string[] = ['"updatedAt" = NOW()'];
        const params: any[] = [args.where.id];
        let pIndex = 2;

        if (args.data.status !== undefined) {
          updates.push(`status = $${pIndex++}`);
          params.push(args.data.status);
        }
        if (args.data.reportCount?.increment) {
          updates.push('"reportCount" = "reportCount" + 1');
        }

        const sql = `UPDATE "Post" SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
        const res = await query(sql, params);
        return res.rows[0];
      } catch (err) {
        return dbStore.posts.update(args);
      }
    },
    async cleanupExpired(eventId?: string) {
      try {
        let sql = 'UPDATE "Post" SET status = \'expired\', "updatedAt" = NOW() WHERE status = \'active\' AND "expiresAt" <= NOW()';
        const params: any[] = [];
        if (eventId) {
          sql += ' AND "eventId" = $1';
          params.push(eventId);
        }
        const res = await query(sql, params);
        return res.rowCount || 0;
      } catch (err) {
        return 0;
      }
    }
  },

  message: {
    async findMany(args: { where?: { eventId?: string; recipientType?: string; recipientId?: string }; limit?: number; offset?: number }) {
      try {
        let sql = 'SELECT * FROM "Message" WHERE 1=1';
        const params: any[] = [];
        let pIndex = 1;
        if (args?.where?.eventId) {
          sql += ` AND "eventId" = $${pIndex++}`;
          params.push(args.where.eventId);
        }
        if (args?.where?.recipientType) {
          sql += ` AND "recipientType" = $${pIndex++}`;
          params.push(args.where.recipientType);
        }
        if (args?.where?.recipientId) {
          sql += ` AND "recipientId" = $${pIndex++}`;
          params.push(args.where.recipientId);
        }
        sql += ' ORDER BY "createdAt" ASC';

        if (args?.limit) {
          sql += ` LIMIT $${pIndex++}`;
          params.push(args.limit);
        }
        if (args?.offset) {
          sql += ` OFFSET $${pIndex++}`;
          params.push(args.offset);
        }

        const res = await query(sql, params);
        return res.rows;
      } catch (err) {
        return dbStore.messages.findMany(args);
      }
    },
    async create(args: { data: any }) {
      try {
        const id = args.data.id || `msg-${Date.now()}`;
        const res = await query(
          'INSERT INTO "Message" (id, "eventId", "senderId", "senderName", "recipientType", "recipientId", content, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *',
          [id, args.data.eventId, args.data.senderId, args.data.senderName, args.data.recipientType || 'all', args.data.recipientId || null, args.data.content]
        );
        return res.rows[0];
      } catch (err) {
        return dbStore.messages.create(args);
      }
    }
  },

  report: {
    async findMany(args: { where?: { eventId?: string } }) {
      try {
        let sql = 'SELECT * FROM "Report"';
        const params: any[] = [];
        if (args?.where?.eventId) {
          sql += ' WHERE "eventId" = $1';
          params.push(args.where.eventId);
        }
        sql += ' ORDER BY "createdAt" DESC';
        const res = await query(sql, params);
        return res.rows;
      } catch (err) {
        return dbStore.reports.findMany(args);
      }
    },
    async create(args: { data: any }) {
      try {
        const id = args.data.id || `rep-${Date.now()}`;
        const res = await query(
          `INSERT INTO "Report" (id, "eventId", "targetType", "targetId", "targetSummary", "reporterId", "reporterName", reason, details, status, "createdAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) RETURNING *`,
          [
            id,
            args.data.eventId,
            args.data.targetType || 'post',
            args.data.targetId,
            args.data.targetSummary,
            args.data.reporterId,
            args.data.reporterName,
            args.data.reason,
            args.data.details || null,
            args.data.status || 'pending'
          ]
        );
        return res.rows[0];
      } catch (err) {
        return dbStore.reports.create(args);
      }
    },
    async update(args: { where: { id: string }; data: any }) {
      try {
        const updates: string[] = [];
        const params: any[] = [args.where.id];
        let pIndex = 2;

        if (args.data.status !== undefined) {
          updates.push(`status = $${pIndex++}`);
          params.push(args.data.status);
        }

        const sql = `UPDATE "Report" SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
        const res = await query(sql, params);
        return res.rows[0];
      } catch (err) {
        return dbStore.reports.update(args);
      }
    }
  },

  notification: {
    async findMany(args: { where?: { eventId?: string; userId?: string } }) {
      try {
        let sql = 'SELECT * FROM "Notification" WHERE 1=1';
        const params: any[] = [];
        let pIndex = 1;
        if (args?.where?.eventId) {
          sql += ` AND "eventId" = $${pIndex++}`;
          params.push(args.where.eventId);
        }
        if (args?.where?.userId) {
          sql += ` AND "userId" = $${pIndex++}`;
          params.push(args.where.userId);
        }
        sql += ' ORDER BY "createdAt" DESC';
        const res = await query(sql, params);
        return res.rows;
      } catch (err) {
        return dbStore.notifications.findMany(args);
      }
    },
    async create(args: { data: any }) {
      try {
        const id = args.data.id || `notif-${Date.now()}`;
        const res = await query(
          'INSERT INTO "Notification" (id, "eventId", "userId", type, title, content, "isRead", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *',
          [id, args.data.eventId, args.data.userId, args.data.type, args.data.title, args.data.content, args.data.isRead || false]
        );
        return res.rows[0];
      } catch (err) {
        return dbStore.notifications.create(args);
      }
    },
    async update(args: { where: { id: string }; data: { isRead?: boolean } }) {
      try {
        const res = await query('UPDATE "Notification" SET "isRead" = $1 WHERE id = $2 RETURNING *', [args.data.isRead ?? true, args.where.id]);
        return res.rows[0];
      } catch (err) {
        return null;
      }
    }
  }
};
