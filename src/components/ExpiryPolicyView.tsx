import React, { useEffect, useState } from 'react';
import { EventItem, User, ExpiryAuditLog } from '../types';
import { fetchExpiryPolicy, fetchExpiryAuditLogs, triggerTtlCleanup } from '../services/api';
import {
  ShieldAlert,
  Clock,
  Trash2,
  Database,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Info,
  RefreshCw,
  FileText,
  Lock,
  Layers,
  Camera,
  Server,
  Archive,
  HelpCircle,
  ExternalLink
} from 'lucide-react';

interface ExpiryPolicyViewProps {
  currentEvent: EventItem | null;
  currentUser: User;
  onNavigateToFeed?: () => void;
}

export const ExpiryPolicyView: React.FC<ExpiryPolicyViewProps> = ({
  currentEvent,
  currentUser,
  onNavigateToFeed
}) => {
  const [policyData, setPolicyData] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<ExpiryAuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isCleaning, setIsCleaning] = useState<boolean>(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [currentEvent]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [policy, logs] = await Promise.all([
        fetchExpiryPolicy().catch(() => null),
        fetchExpiryAuditLogs(currentEvent?.id).catch(() => [])
      ]);
      setPolicyData(policy);
      setAuditLogs(logs);
    } catch (err) {
      console.error('Failed to load expiry policy data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualCleanup = async () => {
    if (!currentEvent) return;
    setIsCleaning(true);
    setCleanupMessage(null);
    try {
      const res = await triggerTtlCleanup(currentEvent.id);
      setCleanupMessage(`Cleanup completed successfully! ${res.expiredCount} posts expired.`);
      // Reload logs
      const logs = await fetchExpiryAuditLogs(currentEvent.id).catch(() => []);
      setAuditLogs(logs);
    } catch (err: any) {
      setCleanupMessage(err?.message || 'Failed to trigger cleanup cycle.');
    } finally {
      setIsCleaning(false);
      setTimeout(() => setCleanupMessage(null), 4000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 p-8 sm:p-10 text-white shadow-xl">
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-300 text-xs font-semibold uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>DropZone Transparency Architecture</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Content Expiry &amp; Persistence Policy
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            DropZone is designed for ephemeral, physical-proximity engagement. Posts disappear as their Time-To-Live (TTL) passes.
            <span className="font-semibold text-white ml-1">
              However, expiry does not mean guaranteed cryptographic deletion across the entire Internet stack.
            </span>
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {onNavigateToFeed && (
              <button
                onClick={onNavigateToFeed}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <span>Back to Live Feed</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={handleManualCleanup}
              disabled={isCleaning}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCleaning ? 'animate-spin text-blue-400' : ''}`} />
              <span>{isCleaning ? 'Running Cleanup...' : 'Trigger Expiry Purge Job'}</span>
            </button>
          </div>

          {cleanupMessage && (
            <div className="p-3 bg-blue-900/60 border border-blue-500/40 rounded-xl text-xs text-blue-200 flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{cleanupMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* Core Principle Alert */}
      <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200/80 shadow-xs flex items-start gap-4">
        <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5 text-amber-700" />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-amber-900">
            Our Commitment to Honesty: Expiry is not Complete Deletion
          </h2>
          <p className="text-xs text-amber-800/90 leading-relaxed">
            We do not promise perfect anonymity or instant eradication. When you post to DropZone, any attendee in your zone can view and screenshot your post while it is live. In addition, routine operational backups and server logs retain metadata for reliability and platform security.
          </p>
        </div>
      </div>

      {/* The 4-Stage TTL Lifecycle */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">The 4-Stage TTL Lifecycle</h2>
          <p className="text-xs text-slate-500">How every broadcast progresses from creation to purge</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Stage 1 */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3 relative">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-bold flex items-center justify-center text-xs">
              1
            </div>
            <h3 className="text-sm font-bold text-slate-900">Create &amp; Snapshot</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              When created, the server strictly assigns <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] text-slate-800">expires_at = now() + zone.ttl_seconds</code> and snapshots the TTL. Client timestamps are never trusted.
            </p>
            <div className="pt-2 border-t border-slate-100 text-[11px] font-medium text-blue-600 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>Immutable Snapshot</span>
            </div>
          </div>

          {/* Stage 2 */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3 relative">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold flex items-center justify-center text-xs">
              2
            </div>
            <h3 className="text-sm font-bold text-slate-900">Live Broadcast</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Post card displays a live countdown timer (&ldquo;Expires in 2h 14m&rdquo;), turning amber under 10m and red under 1m. Delivered only to participants within boundary.
            </p>
            <div className="pt-2 border-t border-slate-100 text-[11px] font-medium text-emerald-600 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>30s Dynamic Ticker</span>
            </div>
          </div>

          {/* Stage 3 */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3 relative">
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 font-bold flex items-center justify-center text-xs">
              3
            </div>
            <h3 className="text-sm font-bold text-slate-900">Feed Retraction</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              As soon as TTL expires, the post vanishes from active feeds and public queries. Client hides it immediately. Status transitions to <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] text-slate-800">expired</code>.
            </p>
            <div className="pt-2 border-t border-slate-100 text-[11px] font-medium text-amber-700 flex items-center gap-1">
              <EyeOff className="w-3 h-3" />
              <span>Zero Feed Visibility</span>
            </div>
          </div>

          {/* Stage 4 */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3 relative">
            <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-bold flex items-center justify-center text-xs">
              4
            </div>
            <h3 className="text-sm font-bold text-slate-900">Store Purge</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Following a 24-hour retention grace period, our background worker purges the post content from primary database storage. An audit entry is recorded.
            </p>
            <div className="pt-2 border-t border-slate-100 text-[11px] font-medium text-rose-600 flex items-center gap-1">
              <Trash2 className="w-3 h-3" />
              <span>Primary Store Scrubbed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-side Transparency Matrix: What is Deleted vs What is Not */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* What Expiry DOES Delete */}
        <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2.5 text-emerald-700">
            <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200/70">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">What Expiry DOES Delete</h3>
              <p className="text-xs text-slate-500">Guaranteed system actions upon TTL expiration</p>
            </div>
          </div>

          <ul className="space-y-3 text-xs text-slate-600">
            <li className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <span>
                <strong className="text-slate-800">Live Feed Presence:</strong> Posts are instantly filtered out from zone feeds, event streams, and category filters.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <span>
                <strong className="text-slate-800">Public API Delivery:</strong> Default <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">/api/events/:id/posts</code> queries exclude expired posts via database predicates.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <span>
                <strong className="text-slate-800">Primary Database Scrubbing:</strong> Hard content and metadata are permanently redacted/purged after the 24-hour grace window.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <span>
                <strong className="text-slate-800">Real-Time Distribution:</strong> Websockets and notification alerts for this post stop broadcasting immediately.
              </span>
            </li>
          </ul>
        </div>

        {/* What Expiry DOES NOT Delete */}
        <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2.5 text-rose-700">
            <div className="p-2 bg-rose-50 rounded-xl border border-rose-200/70">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">What Expiry DOES NOT Delete</h3>
              <p className="text-xs text-slate-500">Real-world technological persistence factors</p>
            </div>
          </div>

          <ul className="space-y-3 text-xs text-slate-600">
            <li className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
              <span>
                <strong className="text-slate-800">Server &amp; Proxy Access Logs:</strong> Web server HTTP request history (IPs, user agents, endpoints) persists in rolling infrastructure logs for security and abuse audits.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
              <span>
                <strong className="text-slate-800">Database Disaster Recovery Backups:</strong> Point-in-time database snapshots retain state until backups cycle off their automated retention windows (e.g. 7–30 days).
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
              <span>
                <strong className="text-slate-800">Recipient Screenshots &amp; Local Caches:</strong> Anyone in your zone could have taken a screenshot or photo of your broadcast while it was active.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
              <span>
                <strong className="text-slate-800">Moderation &amp; Legal Holds:</strong> Flagged or reported posts have their TTL paused and are preserved until human review.
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Moderation Override Disclosure */}
      <div className="p-6 rounded-2xl bg-indigo-50 border border-indigo-200/80 shadow-xs flex flex-col sm:flex-row items-start gap-4">
        <div className="p-2.5 bg-indigo-100 rounded-xl text-indigo-800 shrink-0">
          <ShieldAlert className="w-6 h-6 text-indigo-700" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-indigo-950">
              Moderation Override Policy (Legal &amp; Safety Hold)
            </h3>
            <span className="px-2 py-0.5 rounded-md bg-indigo-200 text-indigo-900 text-[10px] font-bold uppercase">
              Important Disclosure
            </span>
          </div>
          <p className="text-xs text-indigo-900/90 leading-relaxed">
            &ldquo;<strong>Reported content is retained until reviewed, even if its TTL passes.</strong>&rdquo;
            If a post is flagged by participants for safety violations, harassment, or security threats, its status is switched to <code className="bg-indigo-100 text-indigo-900 px-1 py-0.5 rounded font-mono text-[11px]">held</code> and its TTL timer is paused. This ensures bad actors cannot bypass accountability by posting abusive content right before expiry.
          </p>
        </div>
      </div>

      {/* Live Expiry Audit Log */}
      <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Archive className="w-4 h-4 text-slate-500" />
              <span>Live Expiry Audit Log</span>
            </h3>
            <p className="text-xs text-slate-500">Transparent record of expired, purged, and held actions</p>
          </div>
          <button
            onClick={loadData}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            title="Refresh Audit Logs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <div className="text-xs font-medium text-slate-500">Loading audit records...</div>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No audit actions recorded yet. All current posts are active within their TTL window.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                    <th className="pb-2">Action</th>
                    <th className="pb-2">Post ID</th>
                    <th className="pb-2">Reason / Note</th>
                    <th className="pb-2">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.slice(0, 15).map((log) => {
                    let actionBadge = 'bg-slate-100 text-slate-700 border-slate-200';
                    if (log.action === 'expired') actionBadge = 'bg-amber-50 text-amber-700 border-amber-200';
                    if (log.action === 'purged') actionBadge = 'bg-rose-50 text-rose-700 border-rose-200';
                    if (log.action === 'held') actionBadge = 'bg-indigo-50 text-indigo-700 border-indigo-200';

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${actionBadge}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2.5 font-mono text-[11px] text-slate-600">{log.postId}</td>
                        <td className="py-2.5 text-slate-700 max-w-xs truncate">{log.reason || 'Routine TTL cleanup'}</td>
                        <td className="py-2.5 text-slate-400 tabular-nums">
                          {new Date(log.performedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
