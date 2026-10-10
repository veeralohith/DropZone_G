import React, { useState, useEffect } from 'react';
import { User, EventItem, Membership, Post, Zone } from './types';
import { fetchCurrentUser, fetchEvents, createEvent, fetchEventDetails, joinEvent, logoutUser, AuthResponse } from './services/api';
import { getAuthToken } from './services/auth';

import { LoginPage } from './components/LoginPage';
import { Navbar } from './components/Navbar';
import { CommunityFeed } from './components/CommunityFeed';
import { InboxView } from './components/InboxView';
import { NotificationsView } from './components/NotificationsView';
import { OrganizerDashboard } from './components/OrganizerDashboard';
import { ModerationDashboard } from './components/ModerationDashboard';
import { ProfilePrivacyView } from './components/ProfilePrivacyView';
import { EventPickerModal } from './components/EventPickerModal';
import { ZoneSimulatorModal } from './components/ZoneSimulatorModal';
import { CreatePostModal } from './components/CreatePostModal';
import { PostDetailModal } from './components/PostDetailModal';
import { ZonesView } from './components/ZonesView';
import { ExpiryPolicyView } from './components/ExpiryPolicyView';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthChecked, setIsAuthChecked] = useState<boolean>(false);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [currentEvent, setCurrentEvent] = useState<EventItem | null>(null);
  const [membership, setMembership] = useState<Membership | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<string>('feed');
  const [postRefreshKey, setPostRefreshKey] = useState(0);
  const [activeZone, setActiveZone] = useState<Zone | null>(null);

  // Modals
  const [isEventPickerOpen, setIsEventPickerOpen] = useState(false);
  const [isZoneSimulatorOpen, setIsZoneSimulatorOpen] = useState(false);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isPostDetailOpen, setIsPostDetailOpen] = useState(false);

  useEffect(() => {
    restoreSession();
    if (window.location.pathname === '/expiry-policy' || window.location.hash === '#/expiry-policy') {
      setActiveTab('expiry-policy');
    }
    const handlePopState = () => {
      if (window.location.pathname === '/expiry-policy' || window.location.hash === '#/expiry-policy') {
        setActiveTab('expiry-policy');
      } else {
        setActiveTab('feed');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const restoreSession = async () => {
    const token = getAuthToken();
    if (!token) {
      setCurrentUser(null);
      setIsAuthChecked(true);
      return;
    }

    try {
      const user = await fetchCurrentUser();
      setCurrentUser(user);
      await loadEvents(user);
    } catch (err) {
      console.warn('Session expired or invalid, requiring authentication.');
      setCurrentUser(null);
    } finally {
      setIsAuthChecked(true);
    }
  };

  const loadEvents = async (user: User) => {
    try {
      const allEvents = await fetchEvents();
      setEvents(allEvents);
      if (allEvents.length > 0) {
        setCurrentEvent(allEvents[0]);
        const details = await fetchEventDetails(allEvents[0].id);
        const mem = details.memberships.find((m: Membership) => m.userId === user.id);
        setMembership(mem);
      }
    } catch (err) {
      console.error('Failed to load events:', err);
    }
  };

  const handleLoginSuccess = async (auth: AuthResponse) => {
    setCurrentUser(auth.user);
    await loadEvents(auth.user);
  };

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    setCurrentEvent(null);
    setMembership(undefined);
    setActiveZone(null);
    setActiveTab('feed');
  };

  const handleSelectEvent = async (event: EventItem) => {
    setActiveZone(null);
    setCurrentEvent(event);
    if (currentUser) {
      try {
        const res = await joinEvent(event.id);
        setMembership(res.membership);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleCreateEvent = async (data: Partial<EventItem>) => {
    try {
      const newEvt = await createEvent(data);
      setEvents([...events, newEvt]);
      handleSelectEvent(newEvt);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateZoneState = (newState: Membership['zoneState']) => {
    if (membership) {
      setMembership({ ...membership, zoneState: newState });
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'expiry-policy') {
      window.history.pushState({}, '', '/expiry-policy');
    } else if (window.location.pathname === '/expiry-policy') {
      window.history.pushState({}, '', '/');
    }
  };

  // Initial authentication check state
  if (!isAuthChecked) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-600 gap-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-sm font-semibold text-slate-800">Verifying DropZone security credentials...</div>
      </div>
    );
  }

  // Mandatory Authentication Guard: unauthenticated users must see the login page
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      <Navbar
        currentUser={currentUser}
        onLogout={handleLogout}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        currentEvent={currentEvent}
        onOpenEventPicker={() => setIsEventPickerOpen(true)}
        onOpenZoneSimulator={() => setIsZoneSimulatorOpen(true)}
        onOpenCreatePost={() => setIsCreatePostOpen(true)}
      />

      <main className="flex-1">
        {activeTab === 'feed' && (
          <CommunityFeed
            currentEvent={currentEvent}
            currentUser={currentUser}
            refreshKey={postRefreshKey}
            zoneId={activeZone?.id || null}
            allowedPostTypes={activeZone?.allowedPostTypes}
            onOpenCreatePost={() => setIsCreatePostOpen(true)}
            onSelectPost={(post) => {
              setSelectedPost(post);
              setIsPostDetailOpen(true);
            }}
            onOpenInboxWithMessage={() => {
              setActiveTab('inbox');
            }}
            onNavigateToPolicy={() => handleTabChange('expiry-policy')}
          />
        )}

        <ZonesView
          isActive={activeTab === 'zones'}
          currentEvent={currentEvent}
          currentUser={currentUser}
          onCurrentZoneChange={setActiveZone}
        />

        {activeTab === 'expiry-policy' && (
          <ExpiryPolicyView
            currentEvent={currentEvent}
            currentUser={currentUser}
            onNavigateToFeed={() => handleTabChange('feed')}
          />
        )}

        {activeTab === 'inbox' && (
          <InboxView currentEvent={currentEvent} currentUser={currentUser} />
        )}

        {activeTab === 'notifications' && (
          <NotificationsView currentEvent={currentEvent} currentUser={currentUser} />
        )}

        {activeTab === 'organizer' && (
          <OrganizerDashboard currentEvent={currentEvent} onEventUpdated={() => currentUser && loadEvents(currentUser)} />
        )}

        {activeTab === 'moderation' && (
          <ModerationDashboard currentEvent={currentEvent} />
        )}

        {activeTab === 'profile' && (
          <ProfilePrivacyView
            currentUser={currentUser}
            currentEvent={currentEvent}
            membership={membership}
            onLeaveEvent={handleLogout}
          />
        )}
      </main>

      {/* Modals */}
      <EventPickerModal
        isOpen={isEventPickerOpen}
        onClose={() => setIsEventPickerOpen(false)}
        events={events}
        currentEvent={currentEvent}
        onSelectEvent={handleSelectEvent}
        onCreateEvent={handleCreateEvent}
        currentUser={currentUser}
      />

      <ZoneSimulatorModal
        isOpen={isZoneSimulatorOpen}
        onClose={() => setIsZoneSimulatorOpen(false)}
        currentEvent={currentEvent}
        membership={membership}
        onUpdateZoneState={handleUpdateZoneState}
      />

      <CreatePostModal
        isOpen={isCreatePostOpen}
        onClose={() => setIsCreatePostOpen(false)}
        currentEvent={currentEvent}
        currentUser={currentUser}
        zoneId={activeZone?.id || null}
        allowedPostTypes={activeZone?.allowedPostTypes}
        onPostCreated={() => setPostRefreshKey((key) => key + 1)}
        onNavigateToPolicy={() => handleTabChange('expiry-policy')}
      />

      <PostDetailModal
        isOpen={isPostDetailOpen}
        onClose={() => setIsPostDetailOpen(false)}
        post={selectedPost}
        currentEvent={currentEvent}
        currentUser={currentUser}
        onPostUpdated={() => {}}
        onOpenInboxWithMessage={() => {
          setActiveTab('inbox');
        }}
      />
    </div>
  );
}
