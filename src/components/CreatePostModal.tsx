import React, { useEffect, useState } from 'react';
import { EventItem, Post, User } from '../types';
import { createPost } from '../services/api';
import { X, Plus, Megaphone, AlertCircle, Sparkles, MapPin, Send, Info, ExternalLink } from 'lucide-react';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEvent: EventItem | null;
  currentUser: User;
  zoneId?: string | null;
  allowedPostTypes?: Post['category'][];
  onPostCreated: () => void;
  onNavigateToPolicy?: () => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  currentEvent,
  currentUser,
  zoneId,
  allowedPostTypes,
  onPostCreated,
  onNavigateToPolicy
}) => {
  const [category, setCategory] = useState<'lost_found' | 'requirement' | 'announcement' | 'qa' | 'promotion'>('requirement');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [approxLocation, setApproxLocation] = useState('Innovation Pavilion Zone A');
  const [audience, setAudience] = useState<'all' | 'team' | 'organizers'>('all');

  // Structured fields
  const [itemType, setItemType] = useState<'lost' | 'found'>('lost');
  const [itemName, setItemName] = useState('');
  const [reqType, setReqType] = useState<'person' | 'skill' | 'equipment' | 'resource' | 'assistance'>('equipment');
  const [neededBy, setNeededBy] = useState('In 2 hours');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [ttlMinutes, setTtlMinutes] = useState<number>(currentEvent?.defaultTtlMinutes || 1440);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isStaff = currentUser.role === 'organizer' || currentUser.role === 'moderator' || currentEvent?.ownerId === currentUser.id;
  const postTypes: { id: Post['category']; label: string }[] = [
    { id: 'requirement', label: 'Hardware / Assistance Needed' },
    { id: 'lost_found', label: 'Lost & Found Item' },
    { id: 'announcement', label: 'Official Announcement' },
    { id: 'qa', label: 'Community Q&A' },
    { id: 'promotion', label: 'Sponsored Partner / Vendor (reviewed)' }
  ];
  const visiblePostTypes = postTypes.filter(type =>
    (type.id !== 'announcement' || isStaff) &&
    (type.id === 'announcement' || !zoneId || !allowedPostTypes || allowedPostTypes.includes(type.id))
  );

  useEffect(() => {
    if (visiblePostTypes.length > 0 && !visiblePostTypes.some(type => type.id === category)) {
      setCategory(visiblePostTypes[0].id);
    }
  }, [zoneId, allowedPostTypes, category, currentUser.role]);

  if (!isOpen || !currentEvent) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    if (category !== 'announcement' && zoneId && allowedPostTypes && !allowedPostTypes.includes(category)) {
      setErrorMessage('This post type is not allowed in the selected zone.');
      return;
    }

    let structuredData: any = undefined;
    if (category === 'lost_found') {
      structuredData = { itemType, itemName };
    } else if (category === 'requirement') {
      structuredData = { reqType, neededBy, priority };
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await createPost(currentEvent.id, {
        authorId: currentUser.id,
        authorName: currentUser.name,
        category,
        zoneId: category === 'announcement' ? null : (zoneId ?? null),
        title: title.trim(),
        content: content.trim(),
        structuredData,
        approxLocation,
        audience,
        ttlMinutes
      });
      onPostCreated();
      onClose();
      // Reset form
      setTitle('');
      setContent('');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not publish this post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">Create Community Post</h3>
            <p className="text-xs text-slate-400">Broadcast geofenced updates, hardware requests, or lost items</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Post Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
            >
              {visiblePostTypes.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
            </select>
          </div>

          {category === 'announcement' && !isStaff && (
            <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded-lg border border-amber-200">
              Note: Only authorized event organizers and staff can publish official announcements.
            </div>
          )}

          {/* Structured Fields for Lost & Found */}
          {category === 'lost_found' && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Item Status</label>
                <select
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="lost">Lost Item</option>
                  <option value="found">Found Item</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Item Name / Model</label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Dell Power Supply"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>
            </div>
          )}

          {/* Structured Fields for Requirements */}
          {category === 'requirement' && (
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Need Type</label>
                <select
                  value={reqType}
                  onChange={(e) => setReqType(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="equipment">Equipment</option>
                  <option value="skill">Skill / Dev</option>
                  <option value="resource">Resource</option>
                  <option value="assistance">Assistance</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Needed By</label>
                <input
                  type="text"
                  value={neededBy}
                  onChange={(e) => setNeededBy(e.target.value)}
                  placeholder="e.g. In 1 hour"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Headline</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Clear, concise headline..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Details & Context</label>
            <textarea
              rows={3}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Provide specific details, specifications, or venue coordinates..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Approximate Location</label>
              <input
                type="text"
                value={approxLocation}
                onChange={(e) => setApproxLocation(e.target.value)}
                placeholder="e.g. Block 3, Table 14"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Auto-Expiry TTL</label>
              <select
                value={ttlMinutes}
                onChange={(e) => setTtlMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value={360}>6 Hours</option>
                <option value={720}>12 Hours</option>
                <option value={1440}>24 Hours (Default)</option>
                <option value={2880}>48 Hours</option>
              </select>
            </div>
          </div>

          {/* Pre-Post Expiry Notice */}
          <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="leading-relaxed">
                Your post will disappear from the feed in {ttlMinutes >= 60 ? `${Math.round(ttlMinutes / 60)}h` : `${ttlMinutes}m`}. It may remain in server logs, backups, and screenshots. <strong>Expiry is not deletion.</strong>
              </p>
              {onNavigateToPolicy && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateToPolicy();
                  }}
                  className="font-bold text-blue-700 hover:text-blue-900 underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Learn more</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-3 h-3" />
                  <span>Publish Broadcast</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
