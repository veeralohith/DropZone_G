import React from 'react';
import { EventItem, Post, User } from '../types';
import { updatePostStatus } from '../services/api';
import { X, Clock, MapPin, CheckCircle2, MessageSquare, Flag, User as UserIcon } from 'lucide-react';

interface PostDetailModalProps {
  post: Post | null;
  isOpen: boolean;
  onClose: () => void;
  currentEvent: EventItem | null;
  currentUser: User;
  onPostUpdated: () => void;
  onOpenInboxWithMessage: (recipientName: string) => void;
}

export const PostDetailModal: React.FC<PostDetailModalProps> = ({
  post,
  isOpen,
  onClose,
  currentEvent,
  currentUser,
  onPostUpdated,
  onOpenInboxWithMessage
}) => {
  if (!isOpen || !post || !currentEvent) return null;

  const isAuthor = post.authorId === currentUser.id;
  const isOrganizerOrMod = currentUser.role === 'organizer' || currentUser.role === 'moderator';

  const handleResolve = async () => {
    try {
      await updatePostStatus(currentEvent.id, post.id, 'resolved');
      onPostUpdated();
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">
              {post.category.replace('_', ' & ')}
            </span>
            <h3 className="text-base font-bold truncate max-w-[380px]">{post.title}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between text-xs text-slate-500 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <UserIcon className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-bold text-slate-800">{post.authorName}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="tabular-nums">{new Date(post.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Description</h4>
            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{post.content}</p>
          </div>

          {post.approxLocation && (
            <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Approximate Location: <strong className="text-slate-800">{post.approxLocation}</strong></span>
            </div>
          )}

          {post.structuredData?.itemName && (
            <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 text-xs text-blue-900 space-y-1">
              <div className="font-semibold capitalize">Item Type: {post.structuredData.itemType}</div>
              <div>Item Name: {post.structuredData.itemName}</div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => {
                onClose();
                onOpenInboxWithMessage(post.authorName);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Message in Channels</span>
            </button>

            {(isAuthor || isOrganizerOrMod) && post.status === 'active' && (
              <button
                onClick={handleResolve}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark Resolved</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
