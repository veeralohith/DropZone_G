import React, { useState, useEffect } from 'react';
import { EventItem, User } from '../types';
import { fetchNotifications, markNotificationAsRead } from '../services/api';
import { Bell, ShieldCheck, MapPin, CheckCircle2, Clock, Check, Filter } from 'lucide-react';

interface NotificationsViewProps {
  currentEvent: EventItem | null;
  currentUser: User;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({ currentEvent, currentUser }) => {
  const [filter, setFilter] = useState<'all' | 'zone' | 'announcements'>('all');
  const [isAllRead, setIsAllRead] = useState(false);
  const [liveNotifications, setLiveNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (currentEvent) {
      loadNotifications();
    }
  }, [currentEvent]);

  const loadNotifications = async () => {
    if (!currentEvent) return;
    try {
      const data = await fetchNotifications(currentEvent.id);
      if (Array.isArray(data) && data.length > 0) {
        setLiveNotifications(data);
      }
    } catch (err) {
      console.warn('Could not load live notifications, using local notices:', err);
    }
  };

  const defaultNotifications = [
    {
      id: 'notif-1',
      type: 'zone',
      title: 'Zone Proximity Verified',
      time: '10m ago',
      content: `You are verified inside ${currentEvent?.zoneConfig.centerName || 'IIT Delhi Pavilion'} (500m radius). Active posting privileges enabled.`,
      icon: CheckCircle2,
      color: 'bg-emerald-50 text-emerald-600'
    },
    {
      id: 'notif-2',
      type: 'announcements',
      title: 'Official Announcement Published',
      time: '2h ago',
      content: 'Dr. Priya Nair posted: "Welcome to SAMARTHA 2026! Wi-Fi SSID is Hackathon-5G, key available at mentor desk."',
      icon: Bell,
      color: 'bg-blue-50 text-blue-600'
    },
    {
      id: 'notif-3',
      type: 'zone',
      title: 'Team Allocation Confirmed',
      time: 'Yesterday',
      content: 'You have been assigned to team "Alpha Geofence Innovators". Your private channel #team-alpha is now unlocked.',
      icon: ShieldCheck,
      color: 'bg-purple-50 text-purple-600'
    }
  ];

  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return 'Just now';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    const hrs = Math.floor(diff / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const mappedLive = liveNotifications.map((n) => {
    const isAnnounce = n.type === 'announcement' || n.type === 'announcements';
    return {
      id: n.id,
      type: isAnnounce ? 'announcements' : (n.type === 'zone_verified' ? 'zone' : n.type),
      title: n.title,
      time: formatTimeAgo(n.createdAt),
      content: n.content,
      icon: isAnnounce ? Bell : (n.type === 'team_assigned' ? ShieldCheck : CheckCircle2),
      color: isAnnounce ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600',
      isRead: n.isRead
    };
  });

  const allDisplayNotifications = mappedLive.length > 0 ? mappedLive : defaultNotifications;

  const handleMarkAllRead = async () => {
    setIsAllRead(true);
    if (currentEvent && liveNotifications.length > 0) {
      for (const n of liveNotifications) {
        if (!n.isRead) {
          markNotificationAsRead(currentEvent.id, n.id).catch(() => {});
        }
      }
    }
  };

  const filtered = allDisplayNotifications.filter((n) => {
    if (filter === 'all') return true;
    return n.type === filter;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Notifications & Alerts</h1>
          <p className="text-xs text-slate-500">Real-time geofence proximity alerts, team updates, and event broadcasts</p>
        </div>

        <button
          onClick={handleMarkAllRead}
          className="self-start sm:self-auto px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5" />
          <span>{isAllRead ? 'All caught up' : 'Mark all as read'}</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2">
        {[
          { id: 'all', label: 'All Alerts' },
          { id: 'zone', label: 'Zone & Proximity' },
          { id: 'announcements', label: 'Announcements' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as any)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              filter === tab.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className={`bg-white rounded-xl border border-slate-200/80 p-4.5 flex items-start gap-4 shadow-xs transition-colors ${
                isAllRead ? 'opacity-85' : ''
              }`}
            >
              <div className={`w-9 h-9 rounded-lg ${item.color} flex items-center justify-center shrink-0`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                  <span className="text-[11px] text-slate-400 tabular-nums">{item.time}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{item.content}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
