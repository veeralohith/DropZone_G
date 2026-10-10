import React, { useState, useEffect } from 'react';
import { EventItem, Post, User } from '../types';
import { fetchPosts, createPost, createReport, updatePostStatus } from '../services/api';
import { Search, MapPin, MessageSquare, Flag, Plus, CheckCircle2, Clock, Filter, AlertCircle, Share2, Layers, Check, Send, Sparkles, ChevronDown, ChevronUp, Cpu, HelpCircle, Tag, Radio } from 'lucide-react';

interface CommunityFeedProps {
  currentEvent: EventItem | null;
  currentUser: User;
  refreshKey: number;
  onOpenCreatePost: () => void;
  onSelectPost: (post: Post) => void;
  onOpenInboxWithMessage?: (authorId: string, authorName: string) => void;
}

export const CommunityFeed: React.FC<CommunityFeedProps> = ({
  currentEvent,
  currentUser,
  refreshKey,
  onOpenCreatePost,
  onSelectPost,
  onOpenInboxWithMessage
}) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hideResolved, setHideResolved] = useState<boolean>(false);
  
  // Quick Composer State
  const [isComposerExpanded, setIsComposerExpanded] = useState<boolean>(false);
  const [composerCategory, setComposerCategory] = useState<'lost_found' | 'requirement' | 'announcement' | 'qa' | 'promotion'>('requirement');
  const [composerTitle, setComposerTitle] = useState('');
  const [composerContent, setComposerContent] = useState('');
  const [composerLocation, setComposerLocation] = useState('Innovation Pavilion Zone A');
  const [composerPriority, setComposerPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [composerItemName, setComposerItemName] = useState('');
  const [composerNeededBy, setComposerNeededBy] = useState('In 2 hours');
  const [isPosting, setIsPosting] = useState(false);
  const [composerSuccess, setComposerSuccess] = useState(false);

  // Reporting state
  const [reportingPostId, setReportingPostId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<string>('Spam or unverified content');
  const [reportDetails, setReportDetails] = useState<string>('');
  const [reportSuccess, setReportSuccess] = useState(false);

  // Copied link toast state
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);

  // Expanded quick comments per post
  const [expandedCommentsPostId, setExpandedCommentsPostId] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState<{ [postId: string]: string }>({});
  const [localReplies, setLocalReplies] = useState<{ [postId: string]: Array<{ id: string; authorName: string; text: string; time: string }> }>({});

  useEffect(() => {
    if (currentEvent) {
      loadPosts();
    }
  }, [currentEvent, selectedCategory, refreshKey]);

  const loadPosts = async () => {
    if (!currentEvent) return;
    setLoading(true);
    try {
      const data = await fetchPosts(currentEvent.id, selectedCategory, searchQuery);
      setPosts(data);
    } catch (err) {
      console.error('Failed to load posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadPosts();
  };

  const handleQuickPostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEvent || !composerTitle.trim() || !composerContent.trim()) return;

    setIsPosting(true);
    try {
      let structuredData: any = undefined;
      if (composerCategory === 'lost_found') {
        structuredData = { itemType: 'lost', itemName: composerItemName || composerTitle };
      } else if (composerCategory === 'requirement') {
        structuredData = { reqType: 'equipment', neededBy: composerNeededBy, priority: composerPriority };
      }

      await createPost(currentEvent.id, {
        authorId: currentUser.id,
        authorName: currentUser.name,
        category: composerCategory,
        title: composerTitle.trim(),
        content: composerContent.trim(),
        structuredData,
        approxLocation: composerLocation,
        audience: 'all',
        ttlMinutes: currentEvent.defaultTtlMinutes || 1440
      });

      setComposerSuccess(true);
      setTimeout(() => {
        setComposerSuccess(false);
        setComposerTitle('');
        setComposerContent('');
        setComposerItemName('');
        setIsComposerExpanded(false);
      }, 1200);

      await loadPosts();
    } catch (err) {
      console.error('Failed to create quick post:', err);
    } finally {
      setIsPosting(false);
    }
  };

  const handleResolvePost = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    if (!currentEvent) return;
    try {
      await updatePostStatus(currentEvent.id, postId, 'resolved');
      setPosts(posts.map(p => p.id === postId ? { ...p, status: 'resolved' } : p));
    } catch (err) {
      console.error(err);
    }
  };

  const handleReportSubmit = async (postId: string, postTitle: string) => {
    if (!currentEvent) return;
    try {
      await createReport(currentEvent.id, {
        targetType: 'post',
        targetId: postId,
        targetSummary: postTitle,
        reporterId: currentUser.id,
        reporterName: currentUser.name,
        reason: reportReason,
        details: reportDetails
      });
      setReportSuccess(true);
      setTimeout(() => {
        setReportSuccess(false);
        setReportingPostId(null);
        setReportDetails('');
      }, 1500);
    } catch (err) {
      console.error('Report error:', err);
    }
  };

  const handleCopyLink = (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    navigator.clipboard?.writeText?.(window.location.href);
    setCopiedPostId(postId);
    setTimeout(() => setCopiedPostId(null), 2000);
  };

  const handleAddComment = (e: React.FormEvent, postId: string) => {
    e.preventDefault();
    const text = commentInput[postId]?.trim();
    if (!text) return;

    const currentPostReplies = localReplies[postId] || [];
    setLocalReplies({
      ...localReplies,
      [postId]: [
        ...currentPostReplies,
        {
          id: `comment-${Date.now()}`,
          authorName: currentUser.name,
          text,
          time: 'Just now'
        }
      ]
    });
    setCommentInput({ ...commentInput, [postId]: '' });
  };

  const formatExpiresIn = (expiresAt: string) => {
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    if (diffMs <= 0) return 'Expired';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `Expires in ${days}d`;
    }
    return `Expires in ${hours}h`;
  };

  const formatTimeAgo = (createdAt: string) => {
    const diffMs = Date.now() - new Date(createdAt).getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'announcement':
        return { label: 'Announcement', color: 'text-indigo-700 bg-indigo-50 border-indigo-200/60' };
      case 'requirement':
        return { label: 'Hardware & Need', color: 'text-emerald-700 bg-emerald-50 border-emerald-200/60' };
      case 'lost_found':
        return { label: 'Lost & Found', color: 'text-amber-700 bg-amber-50 border-amber-200/60' };
      case 'qa':
        return { label: 'Q&A & Help', color: 'text-purple-700 bg-purple-50 border-purple-200/60' };
      default:
        return { label: 'General', color: 'text-slate-700 bg-slate-50 border-slate-200/60' };
    }
  };

  const filteredPosts = posts.filter((p) => {
    if (hideResolved && p.status === 'resolved') return false;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Event Context Header */}
      {currentEvent && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-blue-600 font-semibold tracking-wide">
              <span>Verified Geofence Active</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500 font-normal">{currentEvent.zoneConfig?.centerName || 'Innovation Pavilion'}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500 font-normal tabular-nums">{currentEvent.zoneConfig?.radiusMeters || 500}m radius</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">
              {currentEvent.name}
            </h1>
            <p className="text-xs text-slate-500 max-w-2xl line-clamp-2">
              {currentEvent.description}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsComposerExpanded(!isComposerExpanded)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isComposerExpanded ? 'Close Composer' : 'Quick Broadcast'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Quick In-line Composer Box */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden transition-all">
        {!isComposerExpanded ? (
          <div
            onClick={() => setIsComposerExpanded(true)}
            className="p-3.5 flex items-center gap-3 cursor-pointer hover:bg-slate-50/70 transition-colors"
          >
            <img
              src={currentUser.avatar || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100`}
              alt={currentUser.name}
              className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
            />
            <div className="flex-1 text-xs text-slate-400 font-medium">
              Share an update, request hardware, or report a lost item in the venue...
            </div>
            <button
              type="button"
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Compose
            </button>
          </div>
        ) : (
          <form onSubmit={handleQuickPostSubmit} className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <span>Broadcast to Verified Event Attendees</span>
              </div>
              <button
                type="button"
                onClick={() => setIsComposerExpanded(false)}
                className="text-xs text-slate-400 hover:text-slate-700"
              >
                Cancel
              </button>
            </div>

            {/* Category Selector Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: 'requirement', label: 'Hardware & Needs' },
                { id: 'lost_found', label: 'Lost & Found' },
                { id: 'qa', label: 'Q&A & Help' },
                { id: 'announcement', label: 'Announcement' }
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setComposerCategory(c.id as any)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    composerCategory === c.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <input
                type="text"
                required
                value={composerTitle}
                onChange={(e) => setComposerTitle(e.target.value)}
                placeholder={
                  composerCategory === 'requirement'
                    ? "e.g., Need Arduino Nano or USB-C Hub for Drone Telemetry"
                    : composerCategory === 'lost_found'
                    ? "e.g., Found blue lanyard with student keycard at Table 4"
                    : "Post Title..."
                }
                className="w-full px-3.5 py-2 text-sm font-semibold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-slate-400 placeholder:font-normal"
              />

              <textarea
                required
                rows={3}
                value={composerContent}
                onChange={(e) => setComposerContent(e.target.value)}
                placeholder="Describe your request or update with relevant details..."
                className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-slate-400 resize-none"
              />

              {/* Extra Context Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Approximate Venue Location
                  </label>
                  <input
                    type="text"
                    value={composerLocation}
                    onChange={(e) => setComposerLocation(e.target.value)}
                    placeholder="e.g., Hall A, Table 12, Hardware Lab"
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {composerCategory === 'requirement' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Urgency Level
                    </label>
                    <select
                      value={composerPriority}
                      onChange={(e) => setComposerPriority(e.target.value as any)}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="low">Low Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="high">High Priority</option>
                      <option value="urgent">Urgent (Within 1 hour)</option>
                    </select>
                  </div>
                )}

                {composerCategory === 'lost_found' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Item Description
                    </label>
                    <input
                      type="text"
                      value={composerItemName}
                      onChange={(e) => setComposerItemName(e.target.value)}
                      placeholder="e.g., Apple Pencil, Blue Hydroflask"
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Composer Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="text-[11px] text-slate-500">
                <span>Auto-expires after 24h</span>
                <span className="mx-1">·</span>
                <span>Volatile geofence verification</span>
              </div>

              <div className="flex items-center gap-2">
                {composerSuccess && (
                  <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>Broadcasted!</span>
                  </span>
                )}
                <button
                  type="submit"
                  disabled={isPosting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-xs transition-colors disabled:opacity-60 cursor-pointer flex items-center gap-1.5"
                >
                  {isPosting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3 h-3" />
                      <span>Broadcast Post</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
        {/* Segmented Category Filter */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'All Updates' },
            { id: 'requirement', label: 'Hardware & Needs' },
            { id: 'lost_found', label: 'Lost & Found' },
            { id: 'announcement', label: 'Announcements' },
            { id: 'qa', label: 'Q&A' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input & Status Filter */}
        <div className="flex items-center gap-2">
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-56 shrink-0">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search posts..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all placeholder:text-slate-400"
            />
          </form>

          <button
            type="button"
            onClick={() => setHideResolved(!hideResolved)}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
              hideResolved
                ? 'bg-blue-50 border-blue-200 text-blue-700 font-semibold'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Toggle resolved posts"
          >
            Active only
          </button>
        </div>
      </div>

      {/* Feed Posts Stream */}
      {loading ? (
        <div className="py-14 flex flex-col items-center justify-center text-slate-400 gap-2">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <div className="text-xs font-medium text-slate-500">Loading community updates...</div>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">No posts in this view</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Be the first to share an update, report a lost item, or ask for hardware components.
            </p>
          </div>
          <button
            onClick={() => setIsComposerExpanded(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Post</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredPosts.map((post) => {
            const isAuthor = post.authorId === currentUser.id;
            const isOrganizerOrMod = currentUser.role === 'organizer' || currentUser.role === 'moderator';
            const isResolved = post.status === 'resolved';
            const categoryInfo = getCategoryBadge(post.category);
            const replies = localReplies[post.id] || [];
            const isThreadOpen = expandedCommentsPostId === post.id;

            return (
              <div
                key={post.id}
                className={`bg-white rounded-xl border transition-all p-5 shadow-xs ${
                  isResolved
                    ? 'border-slate-200 bg-slate-50/60 opacity-80'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <img
                      src={`https://images.unsplash.com/photo-${1534528741775 + post.authorName.length}?w=100`}
                      alt={post.authorName}
                      className="w-9 h-9 rounded-full object-cover border border-slate-200 mt-0.5 shrink-0"
                    />

                    <div className="space-y-1">
                      {/* Author & Metadata Line */}
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-bold text-slate-900">{post.authorName}</span>
                        <span className="text-slate-300">·</span>
                        <span className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${categoryInfo.color}`}>
                          {categoryInfo.label}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-400 tabular-nums">{formatTimeAgo(post.createdAt)}</span>
                        
                        {post.approxLocation && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="text-slate-500 flex items-center gap-1 font-medium">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>{post.approxLocation}</span>
                            </span>
                          </>
                        )}

                        {isResolved && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Resolved</span>
                            </span>
                          </>
                        )}
                      </div>

                      {/* Post Title */}
                      <h3
                        onClick={() => onSelectPost(post)}
                        className="text-base font-bold text-slate-900 tracking-tight leading-snug hover:text-blue-600 transition-colors cursor-pointer"
                      >
                        {post.title}
                      </h3>

                      {/* Post Content */}
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                        {post.content}
                      </p>

                      {/* Structured Data Highlights */}
                      {post.structuredData && (
                        <div className="mt-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center gap-4 text-xs flex-wrap">
                          {post.structuredData.itemName && (
                            <div>
                              <span className="text-slate-400 font-medium">Item: </span>
                              <span className="font-semibold text-slate-800">{post.structuredData.itemName}</span>
                            </div>
                          )}
                          {post.structuredData.reqType && (
                            <div>
                              <span className="text-slate-400 font-medium">Type: </span>
                              <span className="font-semibold text-slate-800">{post.structuredData.reqType}</span>
                            </div>
                          )}
                          {post.structuredData.neededBy && (
                            <div>
                              <span className="text-slate-400 font-medium">Timeline: </span>
                              <span className="font-semibold text-slate-800">{post.structuredData.neededBy}</span>
                            </div>
                          )}
                          {post.structuredData.priority && (
                            <div>
                              <span className="text-slate-400 font-medium">Priority: </span>
                              <span className={`font-semibold capitalize ${
                                post.structuredData.priority === 'urgent'
                                  ? 'text-rose-600'
                                  : post.structuredData.priority === 'high'
                                  ? 'text-amber-600'
                                  : 'text-slate-700'
                              }`}>
                                {post.structuredData.priority}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Top Right: TTL Expiry */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                      <Clock className="w-3 h-3" />
                      <span className="tabular-nums">{formatExpiresIn(post.expiresAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Bar */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {/* Toggle Thread/Discussion */}
                    <button
                      type="button"
                      onClick={() => setExpandedCommentsPostId(isThreadOpen ? null : post.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer font-medium"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{replies.length > 0 ? `${replies.length} replies` : 'Reply / Coordinate'}</span>
                      {isThreadOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {/* Copy Link */}
                    <button
                      type="button"
                      onClick={(e) => handleCopyLink(e, post.id)}
                      className="flex items-center gap-1 px-2.5 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>{copiedPostId === post.id ? 'Copied!' : 'Share'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Mark Resolved */}
                    {(isAuthor || isOrganizerOrMod) && !isResolved && (
                      <button
                        type="button"
                        onClick={(e) => handleResolvePost(e, post.id)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
                      >
                        Mark Resolved
                      </button>
                    )}

                    {/* Report Content */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReportingPostId(post.id);
                      }}
                      title="Report this post to organizers"
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                    >
                      <Flag className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline Thread / Quick Comments */}
                {isThreadOpen && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                    {replies.length > 0 && (
                      <div className="space-y-2 pl-4 border-l-2 border-slate-200">
                        {replies.map((reply) => (
                          <div key={reply.id} className="text-xs space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800">{reply.authorName}</span>
                              <span className="text-slate-400 text-[10px]">{reply.time}</span>
                            </div>
                            <p className="text-slate-600">{reply.text}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <form onSubmit={(e) => handleAddComment(e, post.id)} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={commentInput[post.id] || ''}
                        onChange={(e) => setCommentInput({ ...commentInput, [post.id]: e.target.value })}
                        placeholder="Offer help or add a venue update..."
                        className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                      >
                        Send
                      </button>
                    </form>
                  </div>
                )}

                {/* Inline Report Dialog */}
                {reportingPostId === post.id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-3"
                  >
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-500" />
                      <span>Submit Content Report to Event Moderators</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-600 font-medium">Select Reason</label>
                      <select
                        value={reportReason}
                        onChange={(e) => setReportReason(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none"
                      >
                        <option>Spam or unverified content</option>
                        <option>Misleading information</option>
                        <option>Commercial advertisement / promotion</option>
                        <option>Inappropriate or offensive text</option>
                        <option>Safety or harassment issue</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-600 font-medium">Details (optional)</label>
                      <input
                        type="text"
                        value={reportDetails}
                        onChange={(e) => setReportDetails(e.target.value)}
                        placeholder="Provide additional context for moderators..."
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setReportingPostId(null)}
                        className="px-3 py-1.5 text-slate-600 hover:text-slate-800 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReportSubmit(post.id, post.title)}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold cursor-pointer"
                      >
                        Submit Report
                      </button>
                    </div>

                    {reportSuccess && (
                      <div className="text-emerald-700 font-medium text-[11px] flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>Report submitted successfully to moderation queue.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
