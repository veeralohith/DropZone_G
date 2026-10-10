import { User, EventItem, Membership, Team, Post, Message, Report, Zone, GeoJsonPoint, GeoJsonPolygon } from '../types';
import { getAuthHeaders, setAuthToken, clearAuthToken } from './auth';

export interface AuthResponse {
  user: User;
  token: string;
}

export interface TestAccount {
  name: string;
  email: string;
  role: string;
  hintPassword: string;
}

// Authentication
export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Authentication failed. Please check your credentials.');
  }

  const data: AuthResponse = await res.json();
  if (data.token) {
    setAuthToken(data.token);
  }
  return data;
}

export async function registerUser(name: string, email: string, password: string): Promise<AuthResponse> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Registration failed. Please check your details.');
  }

  const data: AuthResponse = await res.json();
  if (data.token) {
    setAuthToken(data.token);
  }
  return data;
}

export async function logoutUser(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { ...getAuthHeaders() }
    });
  } catch (err) {
    console.warn('Logout request failed:', err);
  } finally {
    clearAuthToken();
  }
}

export async function fetchCurrentUser(): Promise<User> {
  const res = await fetch('/api/auth/me', {
    headers: { ...getAuthHeaders() }
  });
  if (!res.ok) throw new Error('Unauthenticated session');
  return res.json();
}

export async function fetchTestAccounts(): Promise<TestAccount[]> {
  const res = await fetch('/api/auth/test-accounts');
  if (!res.ok) return [];
  return res.json();
}

export async function fetchUsers(): Promise<User[]> {
  const res = await fetch('/api/users', {
    headers: { ...getAuthHeaders() }
  });
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

// Events
export async function fetchEvents(): Promise<EventItem[]> {
  const res = await fetch('/api/events', {
    headers: { ...getAuthHeaders() }
  });
  if (!res.ok) throw new Error('Failed to fetch events');
  return res.json();
}

export async function createEvent(data: Partial<EventItem>): Promise<EventItem> {
  const res = await fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create event');
  return res.json();
}

export async function fetchEventDetails(eventId: string): Promise<{ event: EventItem; memberships: Membership[]; teams: Team[] }> {
  const res = await fetch(`/api/events/${eventId}`, {
    headers: { ...getAuthHeaders() }
  });
  if (!res.ok) throw new Error('Failed to fetch event details');
  return res.json();
}

export async function joinEvent(eventId: string, registrationCode?: string): Promise<{ success: boolean; membership: Membership }> {
  const res = await fetch(`/api/events/${eventId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ registrationCode })
  });
  if (!res.ok) throw new Error('Failed to join event');
  return res.json();
}

export async function importCsvData(eventId: string, csvData: any[]): Promise<any> {
  const res = await fetch(`/api/events/${eventId}/import-csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ csvData })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to import CSV');
  }
  return res.json();
}

// Posts
export async function fetchPosts(eventId: string, category = 'all', search = '', zoneId?: string | null): Promise<Post[]> {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (search) params.append('search', search);
  if (zoneId) params.append('zoneId', zoneId);
  const res = await fetch(`/api/events/${eventId}/posts?${params.toString()}`, {
    headers: { ...getAuthHeaders() }
  });
  if (!res.ok) throw new Error('Failed to fetch posts');
  return res.json();
}

export async function fetchZones(eventId: string): Promise<Zone[]> {
  const res = await fetch(`/api/events/${eventId}/zones`, { headers: { ...getAuthHeaders() } });
  if (!res.ok) throw new Error('Failed to fetch zones');
  return res.json();
}

export async function createZone(eventId: string, data: {
  name: string;
  description: string;
  geometry: GeoJsonPoint | GeoJsonPolygon;
  radiusMeters?: number;
  ttlSeconds: number;
  allowedPostTypes: Post['category'][];
}): Promise<Zone> {
  const res = await fetch(`/api/events/${eventId}/zones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to create zone');
  }
  return res.json();
}

export async function joinZone(eventId: string, zoneId: string): Promise<void> {
  const res = await fetch(`/api/events/${eventId}/zones/${zoneId}/join`, {
    method: 'POST',
    headers: { ...getAuthHeaders() }
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to join zone');
  }
}

export async function leaveZone(eventId: string, zoneId: string): Promise<void> {
  const res = await fetch(`/api/events/${eventId}/zones/${zoneId}/join`, {
    method: 'DELETE',
    headers: { ...getAuthHeaders() }
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to leave zone');
  }
}

export async function locateZone(eventId: string, latitude: number, longitude: number, simulated = false): Promise<{ zoneId: string | null; zoneName: string | null }> {
  const res = await fetch(`/api/events/${eventId}/zones/locate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ latitude, longitude, simulated })
  });
  if (!res.ok) throw new Error('Could not update current zone');
  return res.json();
}

export async function createPost(eventId: string, data: Partial<Post>): Promise<Post> {
  const res = await fetch(`/api/events/${eventId}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to create post');
  }
  return res.json();
}

export async function updatePostStatus(eventId: string, postId: string, status: string): Promise<Post> {
  const res = await fetch(`/api/events/${eventId}/posts/${postId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error('Failed to update post status');
  return res.json();
}

// Messages
export async function fetchMessages(eventId: string): Promise<Message[]> {
  const res = await fetch(`/api/events/${eventId}/messages`, {
    headers: { ...getAuthHeaders() }
  });
  if (!res.ok) throw new Error('Failed to fetch messages');
  return res.json();
}

export async function createMessage(eventId: string, data: Partial<Message>): Promise<Message> {
  const res = await fetch(`/api/events/${eventId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to send message');
  return res.json();
}

// Reports
export async function fetchReports(eventId: string): Promise<Report[]> {
  const res = await fetch(`/api/events/${eventId}/reports`, {
    headers: { ...getAuthHeaders() }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch reports');
  }
  return res.json();
}

export async function createReport(eventId: string, data: Partial<Report>): Promise<Report> {
  const res = await fetch(`/api/events/${eventId}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to submit report');
  return res.json();
}

export async function updateReportStatus(eventId: string, reportId: string, status: string): Promise<Report> {
  const res = await fetch(`/api/events/${eventId}/reports/${reportId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error('Failed to update report status');
  return res.json();
}

// Participants
export async function fetchParticipants(eventId: string): Promise<Membership[]> {
  const res = await fetch(`/api/events/${eventId}/participants`, {
    headers: { ...getAuthHeaders() }
  });
  if (!res.ok) throw new Error('Failed to fetch participants');
  return res.json();
}

// Notifications
export async function fetchNotifications(eventId: string): Promise<any[]> {
  const res = await fetch(`/api/events/${eventId}/notifications`, {
    headers: { ...getAuthHeaders() }
  });
  if (!res.ok) return [];
  return res.json();
}

export async function markNotificationAsRead(eventId: string, id: string): Promise<any> {
  const res = await fetch(`/api/events/${eventId}/notifications/${id}/read`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
  });
  if (!res.ok) return null;
  return res.json();
}

// TTL & Expiry Transparency APIs
export async function fetchExpiryPolicy(): Promise<any> {
  const res = await fetch('/api/expiry-policy');
  if (!res.ok) throw new Error('Failed to fetch expiry policy');
  return res.json();
}

export async function fetchExpiryAuditLogs(eventId?: string): Promise<any[]> {
  const url = eventId ? `/api/events/${eventId}/expiry-audit-log` : '/api/expiry-audit-log';
  const res = await fetch(url, {
    headers: { ...getAuthHeaders() }
  });
  if (!res.ok) throw new Error('Failed to fetch expiry audit logs');
  return res.json();
}

export async function triggerTtlCleanup(eventId: string): Promise<{ success: boolean; expiredCount: number }> {
  const res = await fetch(`/api/events/${eventId}/posts/cleanup-expired`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
  });
  if (!res.ok) throw new Error('Failed to trigger TTL cleanup');
  return res.json();
}


