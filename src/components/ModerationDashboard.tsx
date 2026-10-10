import React, { useState, useEffect } from 'react';
import { EventItem, Report } from '../types';
import { fetchReports, updateReportStatus } from '../services/api';
import { ShieldAlert, CheckCircle2, XCircle, AlertTriangle, Shield, Flag, RefreshCw, Check } from 'lucide-react';

interface ModerationDashboardProps {
  currentEvent: EventItem | null;
}

export const ModerationDashboard: React.FC<ModerationDashboardProps> = ({ currentEvent }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'resolved' | 'dismissed' | 'all'>('pending');

  useEffect(() => {
    if (currentEvent) {
      loadReports();
    }
  }, [currentEvent]);

  const loadReports = async () => {
    if (!currentEvent) return;
    setLoading(true);
    try {
      const data = await fetchReports(currentEvent.id);
      setReports(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (reportId: string, status: string) => {
    if (!currentEvent) return;
    try {
      await updateReportStatus(currentEvent.id, reportId, status);
      await loadReports();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredReports = reports.filter((r) => {
    if (filterStatus === 'all') return true;
    return r.status === filterStatus;
  });

  const pendingCount = reports.filter((r) => r.status === 'pending').length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="text-xs font-semibold text-blue-600">Trust & Safety Console</div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Moderation Queue</h1>
          <p className="text-xs text-slate-500">Review reported posts, messages, and enforce event safety policies</p>
        </div>

        <button
          onClick={loadReports}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2">
        {[
          { id: 'pending', label: `Pending Triage (${pendingCount})` },
          { id: 'resolved', label: 'Resolved' },
          { id: 'dismissed', label: 'Dismissed' },
          { id: 'all', label: `All Reports (${reports.length})` }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id as any)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              filterStatus === tab.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs">Loading moderation queue...</div>
      ) : filteredReports.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            {filterStatus === 'pending' ? 'Zero Pending Reports' : 'No reports found'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            All geofenced community posts and messages are compliant with event community guidelines.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredReports.map((rep) => (
            <div key={rep.id} className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="font-bold text-slate-900 uppercase">Target: {rep.targetType}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-600">Reported by {rep.reporterName}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-400">{new Date(rep.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${
                  rep.status === 'pending' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-700'
                }`}>
                  {rep.status}
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="text-sm font-bold text-slate-900">{rep.targetSummary}</div>
                <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200/80 space-y-1">
                  <div><strong className="text-slate-900">Reason:</strong> {rep.reason}</div>
                  {rep.details && <div><strong className="text-slate-900">Reporter Context:</strong> {rep.details}</div>}
                </div>
              </div>

              {rep.status === 'pending' && (
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
                  <button
                    onClick={() => handleAction(rep.id, 'dismissed')}
                    className="px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    Dismiss (False Alarm)
                  </button>
                  <button
                    onClick={() => handleAction(rep.id, 'restricted')}
                    className="px-3.5 py-1.5 font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                  >
                    Take Down Content
                  </button>
                  <button
                    onClick={() => handleAction(rep.id, 'resolved')}
                    className="px-3.5 py-1.5 font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    Resolve Report
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
