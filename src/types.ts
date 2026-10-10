export interface User {
  id: string;
  name: string;
  email: string;
  role: 'participant' | 'organizer' | 'moderator';
  avatar: string;
}

export interface EventItem {
  id: string;
  name: string;
  description: string;
  eventType: 'physical' | 'remote' | 'hybrid';
  startDate: string;
  endDate: string;
  timezone: string;
  accessMode: 'open' | 'invite_only' | 'csv_verified';
  zoneConfig: {
    enabled: boolean;
    radiusMeters: number;
    centerName: string;
    latitude: number;
    longitude: number;
  };
  teamPolicy: 'none' | 'optional' | 'mandatory';
  defaultTtlMinutes: number;
  ownerId: string;
  status: 'active' | 'archived';
}

export interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number];
}

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}

export interface Zone {
  id: string;
  eventId: string;
  name: string;
  description: string;
  geometry: GeoJsonPoint | GeoJsonPolygon;
  radiusMeters: number | null;
  ttlSeconds: number;
  allowedPostTypes: Post['category'][];
  createdBy: string;
  expiresAt: string;
  createdAt: string;
  memberCount: number;
  joined: boolean;
}

export interface Membership {
  id: string;
  eventId: string;
  userId: string;
  registrationId?: string;
  teamId?: string;
  role: 'participant' | 'organizer' | 'moderator' | 'owner';
  status: 'active' | 'pending' | 'suspended';
  zoneState: 'checking' | 'eligible' | 'outside_zone' | 'permission_denied' | 'demo_zone';
  user?: User;
  team?: Team;
}

export interface Team {
  id: string;
  eventId: string;
  name: string;
  code: string;
}

export interface Post {
  id: string;
  eventId: string;
  zoneId?: string | null;
  authorId: string;
  authorName: string;
  category: 'lost_found' | 'requirement' | 'announcement' | 'qa' | 'promotion';
  title: string;
  content: string;
  structuredData?: {
    itemType?: 'lost' | 'found';
    itemName?: string;
    reqType?: 'person' | 'skill' | 'equipment' | 'resource' | 'assistance';
    neededBy?: string;
    quantity?: number;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    sponsorLabel?: string;
    vendorName?: string;
  };
  approxLocation?: string;
  audience: 'all' | 'team' | 'organizers';
  teamId?: string;
  status: 'active' | 'resolved' | 'expired' | 'pending_review';
  expiresAt: string;
  createdAt: string;
  reportCount: number;
  ttlMinutes?: number;
}

export interface Message {
  id: string;
  eventId: string;
  senderId: string;
  senderName: string;
  recipientType: 'all' | 'team' | 'individual' | 'support';
  recipientId?: string;
  content: string;
  createdAt: string;
}

export interface Report {
  id: string;
  eventId: string;
  targetType: 'post' | 'message' | 'user';
  targetId: string;
  targetSummary: string;
  reporterId: string;
  reporterName: string;
  reason: string;
  details: string;
  status: 'pending' | 'dismissed' | 'resolved' | 'restricted';
  createdAt: string;
}
