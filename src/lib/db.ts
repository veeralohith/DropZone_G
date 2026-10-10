import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '../../data.json');

interface DbSchema {
  users: any[];
  events: any[];
  memberships: any[];
  teams: any[];
  posts: any[];
  messages: any[];
  reports: any[];
  notifications: any[];
  zones: any[];
  zoneJoins: any[];
  expiryAuditLogs: any[];
}

const defaultData: DbSchema = {
  users: [],
  events: [],
  memberships: [],
  teams: [],
  posts: [],
  messages: [],
  reports: [],
  notifications: [],
  zones: [],
  zoneJoins: [],
  expiryAuditLogs: []
};

function readDb(): DbSchema {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      writeDb(defaultData);
      return defaultData;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return { ...defaultData, ...JSON.parse(raw) };
  } catch (err) {
    console.error('Error reading DB:', err);
    return defaultData;
  }
}

function writeDb(data: DbSchema) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing DB:', err);
  }
}

const usersRepo = {
  async findMany(args?: any) {
    return readDb().users;
  },
  async findUnique(args?: { where?: { id?: string; email?: string } }) {
    const db = readDb();
    const where = args?.where;
    if (where?.id) return db.users.find(u => u.id === where.id) || null;
    if (where?.email) return db.users.find(u => u.email?.toLowerCase() === where?.email?.toLowerCase()) || null;
    return null;
  },
  async findFirst(args?: any) {
    const db = readDb();
    return db.users[0] || null;
  },
  async create(args?: { data: any }) {
    const db = readDb();
    const newUser = { id: `usr-${Date.now()}`, createdAt: new Date().toISOString(), ...args?.data };
    db.users.push(newUser);
    writeDb(db);
    return newUser;
  },
  async upsert(args?: { where: { email: string }; update?: any; create: any }) {
    const db = readDb();
    const where = args?.where;
    const existingIndex = db.users.findIndex(u => u.email?.toLowerCase() === where?.email?.toLowerCase());
    if (existingIndex !== -1) {
      db.users[existingIndex] = { ...db.users[existingIndex], ...args?.update };
      writeDb(db);
      return db.users[existingIndex];
    }
    const newUser = { id: `usr-${Date.now()}`, createdAt: new Date().toISOString(), ...args?.create };
    db.users.push(newUser);
    writeDb(db);
    return newUser;
  }
};

const eventsRepo = {
  async findMany(args?: any) {
    return readDb().events;
  },
  async findUnique(args?: { where?: { id: string } }) {
    const db = readDb();
    const where = args?.where;
    return db.events.find(e => e.id === where?.id) || null;
  },
  async create(args?: { data: any }) {
    const db = readDb();
    const newEvt = { id: `evt-${Date.now()}`, createdAt: new Date().toISOString(), ...args?.data };
    db.events.push(newEvt);
    writeDb(db);
    return newEvt;
  },
  async update(args?: { where?: { id: string }; data: any }) {
    const db = readDb();
    const eventIndex = db.events.findIndex(event => event.id === args?.where?.id);
    if (eventIndex < 0) return null;
    db.events[eventIndex] = { ...db.events[eventIndex], ...args?.data, updatedAt: new Date().toISOString() };
    writeDb(db);
    return db.events[eventIndex];
  }
};

const membershipsRepo = {
  async findMany(args?: { where?: { eventId?: string }; include?: any }) {
    const db = readDb();
    const where = args?.where;
    const include = args?.include;
    let list = db.memberships;
    if (where?.eventId) list = list.filter(m => m.eventId === where.eventId);
    if (include) {
      return list.map(m => ({
        ...m,
        user: db.users.find(u => u.id === m.userId) || null,
        team: db.teams.find(t => t.id === m.teamId) || null
      }));
    }
    return list;
  },
  async findUnique(args?: { where?: { eventId_userId?: { eventId: string; userId: string } }; include?: any }) {
    const db = readDb();
    const where = args?.where;
    const include = args?.include;
    let mem: any = null;
    if (where?.eventId_userId) {
      mem = db.memberships.find(m => m.eventId === where.eventId_userId?.eventId && m.userId === where.eventId_userId?.userId) || null;
    }
    if (mem && include) {
      return {
        ...mem,
        user: db.users.find(u => u.id === mem.userId) || null,
        team: db.teams.find(t => t.id === mem.teamId) || null
      };
    }
    return mem;
  },
  async create(args?: { data: any; include?: any }) {
    const db = readDb();
    const data = args?.data;
    const include = args?.include;
    const newMem = { id: `mem-${Date.now()}`, createdAt: new Date().toISOString(), ...data };
    db.memberships.push(newMem);
    writeDb(db);
    if (include) {
      return {
        ...newMem,
        user: db.users.find(u => u.id === newMem.userId) || null,
        team: db.teams.find(t => t.id === newMem.teamId) || null
      };
    }
    return newMem;
  },
  async update(args?: { where?: { id: string }; data: any; include?: any }) {
    const db = readDb();
    const where = args?.where;
    const data = args?.data;
    const include = args?.include;
    const idx = db.memberships.findIndex(m => m.id === where?.id);
    if (idx !== -1) {
      db.memberships[idx] = { ...db.memberships[idx], ...data };
      writeDb(db);
      const mem = db.memberships[idx];
      if (include) {
        return {
          ...mem,
          user: db.users.find(u => u.id === mem.userId) || null,
          team: db.teams.find(t => t.id === mem.teamId) || null
        };
      }
      return mem;
    }
    return null;
  }
};

const teamsRepo = {
  async findMany(args?: { where?: { eventId?: string } }) {
    const db = readDb();
    const where = args?.where;
    if (where?.eventId) return db.teams.filter(t => t.eventId === where.eventId);
    return db.teams;
  },
  async findFirst(args?: { where?: { eventId?: string; name?: any } }) {
    const db = readDb();
    const where = args?.where;
    return db.teams.find(t => {
      if (where?.eventId && t.eventId !== where.eventId) return false;
      if (where?.name?.equals && t.name.toLowerCase() !== where.name.equals.toLowerCase()) return false;
      return true;
    }) || null;
  },
  async create(args?: { data: any }) {
    const db = readDb();
    const newTeam = { id: `team-${Date.now()}`, ...args?.data };
    db.teams.push(newTeam);
    writeDb(db);
    return newTeam;
  },
  async upsert(args?: { where?: { id: string }; create: any }) {
    const db = readDb();
    const where = args?.where;
    let t = db.teams.find(x => x.id === where?.id);
    if (t) return t;
    db.teams.push(args?.create);
    writeDb(db);
    return args?.create;
  }
};

const postsRepo = {
  async findUnique(args?: { where?: { id: string } }) {
    const postId = args?.where?.id;
    return readDb().posts.find(post => post.id === postId) || null;
  },
  async findMany(args?: { where?: any; limit?: number; offset?: number }) {
    const db = readDb();
    const where = args?.where;
    let list = db.posts;
    if (where?.eventId) list = list.filter(p => p.eventId === where.eventId);

    if (where?.status) {
      if (where.status === 'active' || where.status === 'live') {
        list = list.filter(p => p.status === 'active' || p.status === 'live');
        if (!where.includeExpired) {
          list = list.filter(p => !p.expiresAt || new Date(p.expiresAt).getTime() > Date.now());
        }
      } else {
        list = list.filter(p => p.status === where.status);
      }
    } else if (!where?.includeExpired) {
      // By default in standard feed, filter out expired and held/removed posts
      list = list.filter(p => (p.status === 'live' || p.status === 'active' || !p.status) && (!p.expiresAt || new Date(p.expiresAt).getTime() > Date.now()));
    }

    if (where?.category) list = list.filter(p => p.category === where.category);
    if (where?.zoneId) list = list.filter(p => p.zoneId === where.zoneId);
    if (where?.OR) {
      list = list.filter(p => {
        return where.OR.some((cond: any) => {
          if (cond.title?.contains) {
            return p.title.toLowerCase().includes(cond.title.contains.toLowerCase());
          }
          if (cond.content?.contains) {
            return p.content.toLowerCase().includes(cond.content.contains.toLowerCase());
          }
          return false;
        });
      });
    }

    list = list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (typeof args?.offset === 'number') {
      list = list.slice(args.offset);
    }
    if (typeof args?.limit === 'number') {
      list = list.slice(0, args.limit);
    }
    return list;
  },
  async create(args?: { data: any }) {
    const db = readDb();
    const data = args?.data || {};
    const newPost = {
      id: data.id || `pst-${Date.now()}`,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
      reportCount: data.reportCount || 0,
      status: data.status || 'live',
      ttlSecondsSnapshot: data.ttlSecondsSnapshot ?? null,
      removedReason: data.removedReason ?? null,
      heldUntil: data.heldUntil ?? null,
      ...data
    };
    db.posts.unshift(newPost);
    writeDb(db);
    return newPost;
  },
  async update(args?: { where?: { id: string }; data: any }) {
    const db = readDb();
    const where = args?.where;
    const data = args?.data;
    const idx = db.posts.findIndex(p => p.id === where?.id);
    if (idx !== -1) {
      if (data?.reportCount?.increment) {
        db.posts[idx].reportCount = (db.posts[idx].reportCount || 0) + data.reportCount.increment;
      } else {
        db.posts[idx] = { ...db.posts[idx], ...data, updatedAt: new Date().toISOString() };
      }
      writeDb(db);
      return db.posts[idx];
    }
    return null;
  },
  async cleanupExpired(eventId?: string, graceMs = 24 * 60 * 60 * 1000) {
    const db = readDb();
    const now = Date.now();
    let expiredCount = 0;
    if (!db.expiryAuditLogs) db.expiryAuditLogs = [];

    db.posts = db.posts.map(p => {
      if (eventId && p.eventId !== eventId) return p;

      // Moderation override: skip posts that are held
      if (p.status === 'held') {
        return p;
      }

      const expiresAtMs = p.expiresAt ? new Date(p.expiresAt).getTime() : 0;

      // 1. Mark expired if active/live and past expiresAt
      if ((p.status === 'active' || p.status === 'live') && expiresAtMs <= now) {
        p.status = 'expired';
        p.updatedAt = new Date().toISOString();
        expiredCount++;
        db.expiryAuditLogs.unshift({
          id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          postId: p.id,
          action: 'expired',
          reason: 'TTL elapsed and post transitioned to expired',
          performedAt: new Date().toISOString()
        });
      }

      // 2. Hard-purge content after grace period (e.g., 24h)
      if (p.status === 'expired' && expiresAtMs <= (now - graceMs) && !p.isPurged) {
        p.isPurged = true;
        p.content = '[Purged following TTL expiry and grace retention]';
        p.structuredData = null;
        p.updatedAt = new Date().toISOString();
        db.expiryAuditLogs.unshift({
          id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          postId: p.id,
          action: 'purged',
          reason: 'Hard-purged from primary store after grace period',
          performedAt: new Date().toISOString()
        });
      }

      return p;
    });

    writeDb(db);
    return expiredCount;
  }
};

const zonesRepo = {
  async findMany(args?: { where?: { eventId?: string } }) {
    const db = readDb();
    return db.zones.filter(zone => !args?.where?.eventId || zone.eventId === args.where.eventId);
  },
  async findUnique(args?: { where?: { id: string } }) {
    return readDb().zones.find(zone => zone.id === args?.where?.id) || null;
  },
  async create(args?: { data: any }) {
    const db = readDb();
    const zone = { id: `zone-${Date.now()}`, createdAt: new Date().toISOString(), ...args?.data };
    db.zones.unshift(zone);
    writeDb(db);
    return zone;
  },
  async cleanupExpired(graceMs = 30 * 24 * 60 * 60 * 1000) {
    const db = readDb();
    const cutoff = Date.now() - graceMs;
    const expiredIds = new Set(db.zones.filter(zone => new Date(zone.expiresAt).getTime() <= cutoff).map(zone => zone.id));
    if (expiredIds.size === 0) return 0;
    const oldLength = db.zones.length;
    db.zones = db.zones.filter(zone => !expiredIds.has(zone.id));
    db.zoneJoins = db.zoneJoins.filter(join => !expiredIds.has(join.zoneId));
    db.posts = db.posts.map(post => expiredIds.has(post.zoneId) ? { ...post, zoneId: null } : post);
    writeDb(db);
    return oldLength - db.zones.length;
  }
};

const zoneJoinsRepo = {
  async findMany(args?: { where?: { zoneId?: string; userId?: string; eventId?: string } }) {
    const db = readDb();
    return db.zoneJoins.filter(join =>
      (!args?.where?.zoneId || join.zoneId === args.where.zoneId) &&
      (!args?.where?.userId || join.userId === args.where.userId) &&
      (!args?.where?.eventId || join.eventId === args.where.eventId)
    );
  },
  async upsert(args: { where: { zoneId_userId: { zoneId: string; userId: string } }; create: any }) {
    const db = readDb();
    const { zoneId, userId } = args.where.zoneId_userId;
    const existing = db.zoneJoins.find(join => join.zoneId === zoneId && join.userId === userId);
    if (existing) return existing;
    const join = { joinedAt: new Date().toISOString(), ...args.create };
    db.zoneJoins.push(join);
    writeDb(db);
    return join;
  },
  async delete(args: { where: { zoneId_userId: { zoneId: string; userId: string } } }) {
    const db = readDb();
    const { zoneId, userId } = args.where.zoneId_userId;
    const oldLength = db.zoneJoins.length;
    db.zoneJoins = db.zoneJoins.filter(join => join.zoneId !== zoneId || join.userId !== userId);
    if (db.zoneJoins.length !== oldLength) writeDb(db);
    return oldLength !== db.zoneJoins.length;
  }
};

const messagesRepo = {
  async findMany(args?: { where?: { eventId?: string } }) {
    const db = readDb();
    const where = args?.where;
    let list = db.messages;
    if (where?.eventId) list = list.filter(m => m.eventId === where.eventId);
    return list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  },
  async create(args?: { data: any }) {
    const db = readDb();
    const newMsg = { id: `msg-${Date.now()}`, createdAt: new Date().toISOString(), ...args?.data };
    db.messages.push(newMsg);
    writeDb(db);
    return newMsg;
  }
};

const reportsRepo = {
  async findMany(args?: { where?: { eventId?: string } }) {
    const db = readDb();
    const where = args?.where;
    let list = db.reports;
    if (where?.eventId) list = list.filter(r => r.eventId === where.eventId);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
  async create(args?: { data: any }) {
    const db = readDb();
    const newRep = { id: `rep-${Date.now()}`, createdAt: new Date().toISOString(), status: 'pending', ...args?.data };
    db.reports.unshift(newRep);
    writeDb(db);
    return newRep;
  },
  async update(args?: { where?: { id: string }; data: any }) {
    const db = readDb();
    const where = args?.where;
    const data = args?.data;
    const idx = db.reports.findIndex(r => r.id === where?.id);
    if (idx !== -1) {
      db.reports[idx] = { ...db.reports[idx], ...data };
      writeDb(db);
      return db.reports[idx];
    }
    return null;
  }
};

const notificationsRepo = {
  async findMany(args?: { where?: { eventId?: string; userId?: string } }) {
    const db = readDb();
    const where = args?.where;
    let list = db.notifications;
    if (where?.eventId) list = list.filter(n => n.eventId === where.eventId);
    if (where?.userId) list = list.filter(n => n.userId === where.userId);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
  async create(args?: { data: any }) {
    const db = readDb();
    const newNotif = { id: `notif-${Date.now()}`, createdAt: new Date().toISOString(), isRead: false, ...args?.data };
    db.notifications.unshift(newNotif);
    writeDb(db);
    return newNotif;
  },
  async update(args?: { where?: { id: string }; data: any }) {
    const db = readDb();
    const where = args?.where;
    const data = args?.data;
    const idx = db.notifications.findIndex(n => n.id === where?.id);
    if (idx !== -1) {
      db.notifications[idx] = { ...db.notifications[idx], ...data };
      writeDb(db);
      return db.notifications[idx];
    }
    return null;
  }
};

const expiryAuditLogsRepo = {
  async findMany(args?: { where?: { postId?: string; action?: string }; limit?: number; offset?: number }) {
    const db = readDb();
    let logs = db.expiryAuditLogs || [];
    const where = args?.where;
    if (where?.postId) {
      logs = logs.filter(l => l.postId === where.postId);
    }
    if (where?.action) {
      logs = logs.filter(l => l.action === where.action);
    }
    logs = logs.sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
    if (typeof args?.offset === 'number') {
      logs = logs.slice(args.offset);
    }
    if (typeof args?.limit === 'number') {
      logs = logs.slice(0, args.limit);
    }
    return logs;
  },
  async create(args: { data: any }) {
    const db = readDb();
    if (!db.expiryAuditLogs) db.expiryAuditLogs = [];
    const newLog = {
      id: args.data.id || `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      performedAt: args.data.performedAt || new Date().toISOString(),
      ...args.data
    };
    db.expiryAuditLogs.unshift(newLog);
    writeDb(db);
    return newLog;
  }
};

export const dbStore = {
  users: usersRepo,
  user: usersRepo,
  events: eventsRepo,
  event: eventsRepo,
  memberships: membershipsRepo,
  membership: membershipsRepo,
  teams: teamsRepo,
  team: teamsRepo,
  posts: postsRepo,
  post: postsRepo,
  messages: messagesRepo,
  message: messagesRepo,
  reports: reportsRepo,
  report: reportsRepo,
  notifications: notificationsRepo,
  notification: notificationsRepo,
  zones: zonesRepo,
  zone: zonesRepo,
  zoneJoins: zoneJoinsRepo,
  zoneJoin: zoneJoinsRepo,
  expiryAuditLogs: expiryAuditLogsRepo,
  expiryAuditLog: expiryAuditLogsRepo
};
