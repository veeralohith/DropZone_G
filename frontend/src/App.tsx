import React, { useState, useEffect } from 'react';
import { User, EventItem, Membership, Post } from './types';
import { fetchCurrentUser, fetchUsers, switchUser, fetchEvents, createEvent, fetchEventDetails, joinEvent } from './services/api';

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

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [currentEvent, setCurrentEvent] = useState<EventItem | null>(null);
  const [membership, setMembership] = useState<Membership | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<string>('feed');

  // Modals
  const [isEventPickerOpen, setIsEventPickerOpen] = useState(false);
  const [isZoneSimulatorOpen, setIsZoneSimulatorOpen] = useState(false);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isPostDetailOpen, setIsPostDetailOpen] = useState(false);

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    try {
      const allUsers = await fetchUsers();
      setUsers(allUsers);
      const me = await fetchCurrentUser('usr-1');
      setCurrentUser(me);

      const allEvents = await fetchEvents();
      setEvents(allEvents);
      if (allEvents.length > 0) {
        setCurrentEvent(allEvents[0]);
        const details = await fetchEventDetails(allEvents[0].id);
        const mem = details.memberships.find(m => m.userId === me.id);
        setMembership(mem);
      }
    } catch (err) {
      console.error('Initialization error:', err);
    }
  };

  const handleSwitchUser = async (userId: string) => {
    try {
      const switched = await switchUser(userId);
      setCurrentUser(switched);
      if (currentEvent) {
        const details = await fetchEventDetails(currentEvent.id);
        const mem = details.memberships.find(m => m.userId === switched.id);
        setMembership(mem);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectEvent = async (event: EventItem) => {
    setCurrentEvent(event);
    if (currentUser) {
      try {
        const res = await joinEvent(event.id, currentUser.id);
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

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F8F7F3] flex items-center justify-center text-slate-600">
        Initializing DropZone...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7F3] text-[#2D343C] flex flex-col font-sans selection:bg-[#55799C] selection:text-white">
      <Navbar
        currentUser={currentUser}
        users={users}
        onSwitchUser={handleSwitchUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
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
            onOpenCreatePost={() => setIsCreatePostOpen(true)}
            onSelectPost={(post) => {
              setSelectedPost(post);
              setIsPostDetailOpen(true);
            }}
          />
        )}

        {activeTab === 'inbox' && (
          <InboxView currentEvent={currentEvent} currentUser={currentUser} />
        )}

        {activeTab === 'notifications' && (
          <NotificationsView currentEvent={currentEvent} currentUser={currentUser} />
        )}

        {activeTab === 'organizer' && (
          <OrganizerDashboard currentEvent={currentEvent} onEventUpdated={initApp} />
        )}

        {activeTab === 'moderation' && (
          <ModerationDashboard currentEvent={currentEvent} />
        )}

        {activeTab === 'profile' && (
          <ProfilePrivacyView
            currentUser={currentUser}
            currentEvent={currentEvent}
            membership={membership}
            onLeaveEvent={() => alert('You have left the event active view.')}
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
        onPostCreated={() => {}}
      />

      <PostDetailModal
        isOpen={isPostDetailOpen}
        onClose={() => setIsPostDetailOpen(false)}
        post={selectedPost}
        currentEvent={currentEvent}
        currentUser={currentUser}
        onPostUpdated={() => {}}
        onOpenInboxWithMessage={(authorName) => {
          setActiveTab('inbox');
        }}
      />
    </div>
  );
}
