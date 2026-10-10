import React, { useState } from 'react';
import { User, EventItem } from '../types';
import { Radio, Plus, LogOut, ChevronDown, Bell, MessageSquare, Shield, ShieldCheck, MapPin, Menu, X, Compass, CheckCircle } from 'lucide-react';

interface NavbarProps {
  currentUser: User;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentEvent: EventItem | null;
  onOpenEventPicker: () => void;
  onOpenZoneSimulator: () => void;
  onOpenCreatePost: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onLogout,
  activeTab,
  setActiveTab,
  currentEvent,
  onOpenEventPicker,
  onOpenZoneSimulator,
  onOpenCreatePost
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'feed', label: 'Feed' },
    { id: 'zones', label: 'Map & Zones' },
    { id: 'inbox', label: 'Channels' },
    { id: 'notifications', label: 'Alerts' },
    ...((currentUser.role === 'organizer' || currentUser.role === 'moderator')
      ? [{ id: 'organizer', label: 'Organizer Hub' }]
      : []),
    ...(currentUser.role === 'moderator'
      ? [{ id: 'moderation', label: 'Moderation' }]
      : []),
    { id: 'profile', label: 'Profile' }
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Wordmark & Event Switcher */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenEventPicker}
            className="flex items-center gap-2.5 text-left group p-1.5 -ml-1.5 rounded-xl hover:bg-slate-100/80 transition-colors cursor-pointer"
            title="Switch Event or Venue"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-xs text-sm">
              DZ
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors leading-none flex items-center gap-1.5">
                <span>DropZone</span>
                <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 border border-blue-200/60 px-1.5 py-0.5 rounded-md hidden sm:inline">
                  Live
                </span>
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1 font-medium mt-0.5">
                <span className="truncate max-w-[130px] sm:max-w-[180px] text-slate-700">
                  {currentEvent?.name || 'Select Event'}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-blue-600 shrink-0" />
              </div>
            </div>
          </button>
        </div>

        {/* Zone 2: Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-1 text-xs font-semibold text-slate-600">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Live Zone Status & Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Live Geofence Button */}
          <button
            onClick={onOpenZoneSimulator}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            title="Inspect Geofence Boundary & Location"
          >
            <Radio className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="hidden sm:inline">Zone: 500m Active</span>
            <span className="sm:hidden">Zone</span>
          </button>

          {/* New Post CTA */}
          <button
            onClick={onOpenCreatePost}
            className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-xs transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">New Post</span>
            <span className="sm:hidden">Post</span>
          </button>

          {/* User Profile & Sign Out */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <button
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-100 transition-colors text-left cursor-pointer"
              title="View Profile & Settings"
            >
              <img
                src={currentUser.avatar || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100`}
                alt={currentUser.name}
                className="w-7 h-7 rounded-full object-cover border border-slate-200 ring-1 ring-slate-100"
              />
              <div className="hidden lg:block text-left text-xs">
                <div className="font-semibold text-slate-800 truncate max-w-[100px] leading-tight">
                  {currentUser.name}
                </div>
                <div className="text-[10px] text-slate-500 capitalize font-medium">
                  {currentUser.role}
                </div>
              </div>
            </button>

            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1 shadow-lg">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white font-bold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
