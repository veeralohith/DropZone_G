import React, { useState } from 'react';
import { EventItem, User, Membership } from '../types';
import { Shield, UserCheck, Mail, Lock, LogOut, AlertTriangle, CheckCircle2, Radio, Key, Clock, Sparkles } from 'lucide-react';

interface ProfilePrivacyViewProps {
  currentUser: User;
  currentEvent: EventItem | null;
  membership?: Membership;
  onLeaveEvent: () => void;
}

export const ProfilePrivacyView: React.FC<ProfilePrivacyViewProps> = ({
  currentUser,
  currentEvent,
  membership,
  onLeaveEvent
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'privacy'>('profile');

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Profile & Geofence Security</h1>
          <p className="text-xs text-slate-500">Manage your verified identity, cryptographic session, and privacy policies</p>
        </div>

        <button
          onClick={onLeaveEvent}
          className="self-start sm:self-auto px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Card */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 space-y-4 text-center shadow-xs">
          <img
            src={currentUser.avatar || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100`}
            alt={currentUser.name}
            className="w-20 h-20 rounded-full mx-auto object-cover border-2 border-slate-100 shadow-sm"
          />
          <div>
            <h2 className="text-base font-bold text-slate-900">{currentUser.name}</h2>
            <p className="text-xs text-slate-500">{currentUser.email}</p>
          </div>
          <div className="inline-block px-3 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 capitalize">
            Role: {currentUser.role}
          </div>

          <div className="pt-4 border-t border-slate-100 text-left space-y-2.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Registration ID:</span>
              <span className="font-mono font-semibold text-slate-800">{membership?.registrationId || 'SM-2026-001'}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Active Team:</span>
              <span className="font-semibold text-slate-800">Alpha Geofence Innovators</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Zone Status:</span>
              <span className="font-semibold text-emerald-600 capitalize">
                {membership?.zoneState ? membership.zoneState.replace('_', ' ') : 'In-Zone Verified'}
              </span>
            </div>
          </div>
        </div>

        {/* Privacy & Retention Notice */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <span>Zero-Storage Geofence Architecture</span>
            </h3>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Transient Geofence Calculation</span>
                </span>
                <p>
                  Your browser checks distance to the event center ({currentEvent?.zoneConfig?.centerName || 'IIT Delhi Pavilion'}) in memory. Raw GPS coordinates are never stored in PostgreSQL tables or logged in server persistent storage.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>24-Hour Ephemeral Purging (TTL)</span>
                </span>
                <p>
                  All community posts, lost & found entries, and public channel exchanges automatically expire after 24 hours. The database runs automated TTL sweeps to keep event data ephemeral.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-purple-600" />
                  <span>Cryptographic HMAC Session Tokens</span>
                </span>
                <p>
                  Every API request is signed and verified via server-side HMAC tokens with timing-safe validation. Unauthenticated persona switching is strictly blocked.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
              <span>Connected to: <strong className="text-slate-700">{currentEvent?.name || 'SAMARTHA 2026'}</strong></span>
              <span className="font-mono text-[11px] text-emerald-700 font-semibold">PostgreSQL & Prisma 8 Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
