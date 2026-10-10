import { User, EventItem, Membership, Team, Post, Message, Report } from '../types';

export async function fetchCurrentUser(userId = 'usr-1'): Promise<User> {
  const res = await fetch('/api/users/me', {
    headers: { 'x-user-id': userId }
  });
  if (!res.ok) throw new Error('Failed to fetch current user');
  return res.json();
}

export async function fetchUsers(): Promise<User[]> {
  const res = await fetch('/api/users');
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function switchUser(userId: string): Promise<User> {
  const res = await fetch('/api/users/switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
  });
  if (!res.ok) throw new Error('Failed to switch user');
  return res.json();
}

export async function fetchEvents(): Promise<EventItem[]> {
  const res = await fetch('/api/events');
  if (!res.ok) throw new Error('Failed to fetch events');
  return res.json();
}

export async function createEvent(data: Partial<EventItem>): Promise<EventItem> {
  const res = await fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create event');
  return res.json();
}

export async function fetchEventDetails(eventId: string): Promise<{ event: EventItem; memberships: Membership[]; teams: Team[] }> {
  const res = await fetch(`/api/events/${eventId}`);
  if (!res.ok) throw new Error('Failed to fetch event details');
  return res.json();
}

export async function joinEvent(eventId: string, userId: string, registrationCode?: string): Promise<{ success: boolean; membership: Membership }> {
  const res = await fetch(`/api/events/${eventId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, registrationCode })
  });
  if (!res.ok) throw new Error('Failed to join event');
  return res.json();
}

export async function importCsvData(eventId: string, csvData: any[]): Promise<any> {
  const res = await fetch(`/api/events/${eventId}/import-csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csvData })
  });
  if (!res.ok) throw new Error('Failed to import CSV');
  return res.json();
}

export async function fetchPosts(eventId: string, category = 'all', search = ''): Promise<Post[]> {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (search) params.append('search', search);
  const res = await fetch(`/api/events/${eventId}/posts?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch posts');
  return res.json();
}

export async function createPost(eventId: string, data: Partial<Post>): Promise<Post> {
  const res = await fetch(`/api/events/${eventId}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create post');
  return res.json();
}

export async function updatePostStatus(eventId: string, postId: string, status: string): Promise<Post> {
  const res = await fetch(`/api/events/${eventId}/posts/${postId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error('Failed to update post status');
  return res.json();
}

export async function fetchMessages(eventId: string): Promise<Message[]> {
  const res = await fetch(`/api/events/${eventId}/messages`);
  if (!res.ok) throw new Error('Failed to fetch messages');
  return res.json();
}

export async function createMessage(eventId: string, data: Partial<Message>): Promise<Message> {
  const res = await fetch(`/api/events/${eventId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to send message');
  return res.json();
}

export async function fetchReports(eventId: string): Promise<Report[]> {
  const res = await fetch(`/api/events/${eventId}/reports`);
  if (!res.ok) throw new Error('Failed to fetch reports');
  return res.json();
}

export async function createReport(eventId: string, data: Partial<Report>): Promise<Report> {
  const res = await fetch(`/api/events/${eventId}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to submit report');
  return res.json();
}

export async function updateReportStatus(eventId: string, reportId: string, status: string): Promise<Report> {
  const res = await fetch(`/api/events/${eventId}/reports/${reportId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error('Failed to update report status');
  return res.json();
}

export async function fetchParticipants(eventId: string): Promise<Membership[]> {
  const res = await fetch(`/api/events/${eventId}/participants`);
  if (!res.ok) throw new Error('Failed to fetch participants');
  return res.json();
}
