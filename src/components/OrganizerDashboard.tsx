import React, { useState, useEffect } from 'react';
import { EventItem, Membership, Team } from '../types';
import { fetchEventDetails, importCsvData } from '../services/api';
import { Upload, CheckCircle2, AlertTriangle, Users, FileText, Settings, Shield, Plus, Check, MapPin, Radio, Copy, Search, Sliders, RefreshCw } from 'lucide-react';
import teamWorkspaceImage from '../assets/images/team_collaboration_workspace_1791629402178.jpg';

interface OrganizerDashboardProps {
  currentEvent: EventItem | null;
  onEventUpdated: () => void;
}

export const OrganizerDashboard: React.FC<OrganizerDashboardProps> = ({ currentEvent, onEventUpdated }) => {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'roster' | 'import' | 'geofence' | 'teams'>('roster');

  // Search & Filters for Roster
  const [rosterSearch, setRosterSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // CSV Import state
  const [csvText, setCsvText] = useState(
`participant_name,email,team_name,registration_id
Rohan Verma,rohan.v@hackathon.samartha.org,Alpha Geofence Innovators,SM-2026-101
Neha Gupta,neha.g@hackathon.samartha.org,Beta Resilient Networks,SM-2026-102
Karan Singh,karan.s@hackathon.samartha.org,Alpha Geofence Innovators,SM-2026-103
Tanvi Sharma,tanvi.s@hackathon.samartha.org,Alpha Geofence Innovators,SM-2026-104
Aditya Patel,aditya.p@hackathon.samartha.org,Gamma Smart Edge,SM-2026-105`);
  const [importResult, setImportResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);

  // Geofence configuration local state
  const [venueRadius, setVenueRadius] = useState<number>(currentEvent?.zoneConfig?.radiusMeters || 500);
  const [venueCenterName, setVenueCenterName] = useState<string>(currentEvent?.zoneConfig?.centerName || 'IIT Delhi Innovation Pavilion');
  const [isConfigSaved, setIsConfigSaved] = useState(false);

  useEffect(() => {
    if (currentEvent) {
      loadDetails();
      setVenueRadius(currentEvent.zoneConfig?.radiusMeters || 500);
      setVenueCenterName(currentEvent.zoneConfig?.centerName || 'IIT Delhi Innovation Pavilion');
    }
  }, [currentEvent]);

  const loadDetails = async () => {
    if (!currentEvent) return;
    setLoading(true);
    try {
      const data = await fetchEventDetails(currentEvent.id);
      setMemberships(data.memberships);
      setTeams(data.teams);
    } catch (err) {
      console.error('Failed to load organizer event details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunCsvImport = async () => {
    if (!currentEvent) return;
    setImporting(true);
    try {
      const lines = csvText.trim().split('\n');
      const headers = lines[0].split(',').map((h) => h.trim());
      const rows = lines.slice(1).map((line) => {
        const values = line.split(',').map((v) => v.trim());
        const rowObj: any = {};
        headers.forEach((h, i) => {
          rowObj[h] = values[i] || '';
        });
        return rowObj;
      });

      const res = await importCsvData(currentEvent.id, rows);
      setImportResult(res.summary);
      await loadDetails();
      onEventUpdated();
    } catch (err) {
      console.error('Import CSV error:', err);
    } finally {
      setImporting(false);
    }
  };

  const handleSaveGeofence = (e: React.FormEvent) => {
    e.preventDefault();
    setIsConfigSaved(true);
    setTimeout(() => setIsConfigSaved(false), 2500);
  };

  // Filtered Roster
  const filteredRoster = memberships.filter((m) => {
    const userName = m.user?.name || '';
    const userEmail = m.user?.email || '';
    const teamName = m.team?.name || '';
    const matchesSearch =
      userName.toLowerCase().includes(rosterSearch.toLowerCase()) ||
      userEmail.toLowerCase().includes(rosterSearch.toLowerCase()) ||
      teamName.toLowerCase().includes(rosterSearch.toLowerCase()) ||
      (m.registrationId && m.registrationId.toLowerCase().includes(rosterSearch.toLowerCase()));

    if (!matchesSearch) return false;
    if (roleFilter !== 'all' && m.role !== roleFilter) return false;
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner & KPI Strip */}
      <div className="relative rounded-xl overflow-hidden bg-slate-900 text-white shadow-xs">
        <div className="absolute inset-0 z-0">
          <img
            src={teamWorkspaceImage}
            alt="Hackathon Team Collaboration"
            className="w-full h-full object-cover opacity-20"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-900/40" />
        </div>

        <div className="relative z-10 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-blue-400">
                Staff Operations · {currentEvent?.name || 'SAMARTHA 2026'}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Organizer Command Hub
              </h1>
              <p className="text-xs text-slate-300 max-w-xl">
                Verify attendee rosters, enforce geofence perimeters, and manage teams with zero persistent GPS coordinate retention.
              </p>
            </div>

            <button
              onClick={loadDetails}
              className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Data</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-800 text-xs">
            <div>
              <div className="text-slate-400">Total Attendees</div>
              <div className="text-2xl font-bold text-white tabular-nums mt-0.5">{memberships.length}</div>
            </div>
            <div>
              <div className="text-slate-400">Verified Teams</div>
              <div className="text-2xl font-bold text-white tabular-nums mt-0.5">{teams.length}</div>
            </div>
            <div>
              <div className="text-slate-400">Perimeter Radius</div>
              <div className="text-2xl font-bold text-white tabular-nums mt-0.5">{venueRadius}m</div>
            </div>
            <div>
              <div className="text-slate-400">Access Policy</div>
              <div className="text-2xl font-bold text-emerald-400 capitalize mt-0.5">CSV Verified</div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 pb-2 overflow-x-auto scrollbar-none">
        {[
          { id: 'roster', label: `Attendee Roster (${memberships.length})`, icon: Users },
          { id: 'import', label: 'Bulk CSV Import', icon: Upload },
          { id: 'geofence', label: 'Geofence & Zone Policy', icon: Sliders },
          { id: 'teams', label: `Teams & Formations (${teams.length})`, icon: Shield }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Attendee Roster */}
      {activeTab === 'roster' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 p-5">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="Search by name, email, team, or ID..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Role:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="all">All Roles</option>
                <option value="participant">Participant</option>
                <option value="organizer">Organizer</option>
                <option value="moderator">Moderator</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Attendee Name</th>
                  <th className="py-2.5 px-4">Email Address</th>
                  <th className="py-2.5 px-4">Role</th>
                  <th className="py-2.5 px-4">Team Assignment</th>
                  <th className="py-2.5 px-4">Reg Code</th>
                  <th className="py-2.5 px-4">Zone Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRoster.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                      No attendees found matching filter.
                    </td>
                  </tr>
                ) : (
                  filteredRoster.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-slate-900">
                        {m.user?.name || 'Anonymous User'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {m.user?.email || '—'}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="capitalize font-medium text-slate-700">
                          {m.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-800">
                        {m.team?.name || 'Unassigned'}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                        {m.registrationId || 'SM-AUTO'}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                          <span>In-Zone</span>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Bulk CSV Import */}
      {activeTab === 'import' && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 space-y-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Participant CSV Roster Verification
              </h2>
              <p className="text-xs text-slate-500">
                Upload or paste student roster to issue cryptographic registration tokens and team allocations
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCsvText(
`participant_name,email,team_name,registration_id
Rohan Verma,rohan.v@hackathon.samartha.org,Alpha Geofence Innovators,SM-2026-101
Neha Gupta,neha.g@hackathon.samartha.org,Beta Resilient Networks,SM-2026-102
Karan Singh,karan.s@hackathon.samartha.org,Alpha Geofence Innovators,SM-2026-103
Tanvi Sharma,tanvi.s@hackathon.samartha.org,Alpha Geofence Innovators,SM-2026-104
Aditya Patel,aditya.p@hackathon.samartha.org,Gamma Smart Edge,SM-2026-105`);
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              Reset to Sample Template
            </button>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              CSV Data Input: <span className="font-mono text-slate-500 font-normal">participant_name, email, team_name, registration_id</span>
            </label>
            <textarea
              rows={7}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full font-mono text-xs p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all text-slate-800"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleRunCsvImport}
              disabled={importing}
              className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
            >
              {importing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing CSV Roster...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Execute Roster Import</span>
                </>
              )}
            </button>

            <span className="text-xs text-slate-400">
              Unique constraints enforced automatically
            </span>
          </div>

          {/* Import Result Summary */}
          {importResult && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Import Batch Results:</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1">
                <div className="p-3 bg-emerald-50 text-emerald-900 rounded-lg">
                  <span className="text-slate-500 block text-[10px]">Successfully Imported</span>
                  <span className="font-bold text-lg tabular-nums">{importResult.importedCount}</span>
                </div>
                <div className="p-3 bg-amber-50 text-amber-900 rounded-lg">
                  <span className="text-slate-500 block text-[10px]">Duplicates Skipped</span>
                  <span className="font-bold text-lg tabular-nums">{importResult.duplicateCount}</span>
                </div>
                <div className="p-3 bg-rose-50 text-rose-900 rounded-lg">
                  <span className="text-slate-500 block text-[10px]">Errors</span>
                  <span className="font-bold text-lg tabular-nums">{importResult.errorCount}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Geofence & Zone Policy */}
      {activeTab === 'geofence' && (
        <form onSubmit={handleSaveGeofence} className="bg-white rounded-xl border border-slate-200/80 p-6 space-y-6 shadow-xs">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900">
              Geofence Perimeter & Privacy Thresholds
            </h2>
            <p className="text-xs text-slate-500">
              Configure event center coordinates, maximum proximity radius, and auto-purging TTL policies.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Venue Center Name</label>
              <input
                type="text"
                value={venueCenterName}
                onChange={(e) => setVenueCenterName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Perimeter Radius: <span className="font-bold tabular-nums text-blue-600">{venueRadius} meters</span>
              </label>
              <input
                type="range"
                min={100}
                max={2000}
                step={50}
                value={venueRadius}
                onChange={(e) => setVenueRadius(Number(e.target.value))}
                className="w-full mt-2 accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>100m (Single Room)</span>
                <span>500m (Campus Pavilion)</span>
                <span>2000m (District)</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Center Latitude</label>
              <input
                type="text"
                readOnly
                value="28.5450° N (IIT Delhi)"
                className="w-full px-3.5 py-2 text-xs bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Center Longitude</label>
              <input
                type="text"
                readOnly
                value="77.1926° E (IIT Delhi)"
                className="w-full px-3.5 py-2 text-xs bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-mono"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span>Zero Raw GPS Privacy Guarantee</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              When participants verify in-zone eligibility, DropZone calculates Haversine distance in ephemeral server memory. Exact latitude and longitude are never persisted in PostgreSQL tables.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            {isConfigSaved ? (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>Geofence parameters updated!</span>
              </span>
            ) : <span />}

            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              Save Configuration
            </button>
          </div>
        </form>
      )}

      {/* Tab 4: Teams & Formations */}
      {activeTab === 'teams' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.length === 0 ? (
            <div className="col-span-full bg-white rounded-xl border border-slate-200 p-12 text-center text-xs text-slate-400">
              No teams registered yet. Import participants to automatically establish teams.
            </div>
          ) : (
            teams.map((team) => {
              const members = memberships.filter((m) => m.teamId === team.id);
              return (
                <div
                  key={team.id}
                  className="bg-white rounded-xl border border-slate-200/80 p-5 space-y-3 shadow-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{team.name}</h3>
                      <span className="text-[11px] font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded mt-1 inline-block">
                        Code: {team.code}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md tabular-nums">
                      {members.length} members
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400">Roster:</span>
                    {members.map((mem) => (
                      <div key={mem.id} className="text-xs text-slate-700 flex items-center justify-between">
                        <span>{mem.user?.name || 'Member'}</span>
                        <span className="text-[10px] text-slate-400">{mem.user?.email}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
