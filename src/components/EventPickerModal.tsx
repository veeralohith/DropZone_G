import React, { useState } from 'react';
import { EventItem, User } from '../types';
import { MapPin, Calendar, Globe, Check, Plus, X, Radio } from 'lucide-react';

interface EventPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: EventItem[];
  currentEvent: EventItem | null;
  onSelectEvent: (event: EventItem) => void;
  onCreateEvent: (data: Partial<EventItem>) => void;
  currentUser: User;
}

export const EventPickerModal: React.FC<EventPickerModalProps> = ({
  isOpen,
  onClose,
  events,
  currentEvent,
  onSelectEvent,
  onCreateEvent,
  currentUser
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [accessMode, setAccessMode] = useState<'open' | 'invite_only' | 'csv_verified'>('csv_verified');
  const [centerName, setCenterName] = useState('IIT Delhi Innovation Pavilion');

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreateEvent({
      name,
      description,
      accessMode,
      zoneConfig: {
        enabled: true,
        radiusMeters: 500,
        centerName,
        latitude: 28.5450,
        longitude: 77.1926
      },
      teamPolicy: 'optional',
      defaultTtlMinutes: 1440,
      ownerId: currentUser.id
    });
    setName('');
    setDescription('');
    setIsCreating(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">Select Active Event</h3>
            <p className="text-xs text-slate-400">Switch or join a geofenced hackathon or campus network</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {!isCreating ? (
            <>
              <div className="space-y-2.5">
                {events.map((evt) => {
                  const isSelected = currentEvent?.id === evt.id;
                  return (
                    <div
                      key={evt.id}
                      onClick={() => {
                        onSelectEvent(evt);
                        onClose();
                      }}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start justify-between ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 bg-white'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{evt.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-slate-100 text-slate-600 capitalize">
                            {evt.eventType}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-2">{evt.description}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                          <span className="flex items-center gap-1 font-medium">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{evt.zoneConfig.centerName} ({evt.zoneConfig.radiusMeters}m radius)</span>
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {(currentUser.role === 'organizer' || currentUser.role === 'moderator') && (
                <div className="pt-3 border-t border-slate-100 flex justify-center">
                  <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create New Event</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-900">Create New Geofenced Event</h4>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Back to List
                </button>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Event Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Smart Campus Hackathon 2026"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the event, participants, and venue rules..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Perimeter Center Location</label>
                <input
                  type="text"
                  value={centerName}
                  onChange={(e) => setCenterName(e.target.value)}
                  placeholder="e.g. Innovation Pavilion Hall B"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  Save & Launch Event
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
