import { AlertTriangle, Crosshair, MapPin, Radio, RefreshCw, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { joinZone, leaveZone, fetchZones } from '../services/api';
import { EventItem, GeoJsonPoint, GeoJsonPolygon, User, Zone } from '../types';
import { useGeofence } from '../hooks/useGeofence';
import { MapView, ZoneDrawingTool } from './MapView';
import { ZoneCreator } from './ZoneCreator';

interface ZonesViewProps {
  isActive: boolean;
  currentEvent: EventItem | null;
  currentUser: User;
  onCurrentZoneChange: (zone: Zone | null) => void;
}

function zoneStatus(zone: Zone): 'joined' | 'available' | 'expired' {
  if (new Date(zone.expiresAt).getTime() <= Date.now()) return 'expired';
  return zone.joined ? 'joined' : 'available';
}

function ttlLabel(expiresAt: string): string {
  const remaining = new Date(expiresAt).getTime() - Date.now();
  if (remaining <= 0) return 'Expired';
  const totalMinutes = Math.floor(remaining / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `Expires in ${days}d ${hours}h`;
  return `Expires in ${hours}h ${minutes}m`;
}

export function ZonesView({ isActive, currentEvent, currentUser, onCurrentZoneChange }: ZonesViewProps) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [drawingTool, setDrawingTool] = useState<ZoneDrawingTool>('none');
  const [geometryDraft, setGeometryDraft] = useState<GeoJsonPoint | GeoJsonPolygon | null>(null);
  const [draftRadiusMeters, setDraftRadiusMeters] = useState(250);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState<string | null>(null);
  const [simulationTarget, setSimulationTarget] = useState('');
  const onCurrentZoneChangeRef = useRef(onCurrentZoneChange);
  onCurrentZoneChangeRef.current = onCurrentZoneChange;
  const zonesRef = useRef(zones);
  zonesRef.current = zones;

  const loadZones = useCallback(async () => {
    if (!currentEvent) {
      setZones([]);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchZones(currentEvent.id);
      setZones(data);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load zones.');
    } finally {
      setIsLoading(false);
    }
  }, [currentEvent]);

  useEffect(() => {
    void loadZones();
    const interval = window.setInterval(() => void loadZones(), 60000);
    return () => window.clearInterval(interval);
  }, [loadZones]);

  const handleZoneEnter = useCallback((zoneId: string) => {
    const zone = zonesRef.current.find(item => item.id === zoneId) || null;
    onCurrentZoneChangeRef.current(zone);
    setSelectedZoneId(zoneId);
  }, []);

  const handleZoneExit = useCallback((zoneId: string) => {
    setSelectedZoneId(selected => selected === zoneId ? null : selected);
    onCurrentZoneChangeRef.current(null);
  }, []);

  const geofence = useGeofence({
    eventId: currentEvent?.id || null,
    zones,
    onZoneEnter: handleZoneEnter,
    onZoneExit: handleZoneExit
  });

  useEffect(() => {
    if (geofence.currentZone) {
      setSelectedZoneId(geofence.currentZone.id);
      onCurrentZoneChangeRef.current(geofence.currentZone);
    }
  }, [geofence.currentZone]);

  useEffect(() => {
    if (zones.length === 0) {
      setSimulationTarget('');
      return;
    }
    if (!simulationTarget || !zones.some(zone => zone.id === simulationTarget)) setSimulationTarget(zones[0].id);
  }, [zones, simulationTarget]);

  const handleJoin = async (zoneId: string) => {
    if (!currentEvent) return;
    setIsJoining(zoneId);
    setActionError(null);
    try {
      await joinZone(currentEvent.id, zoneId);
      setZones(current => current.map(zone => zone.id === zoneId
        ? { ...zone, joined: true, memberCount: zone.memberCount + (zone.joined ? 0 : 1) }
        : zone));
      const zone = zonesRef.current.find(item => item.id === zoneId);
      if (zone) {
        setSelectedZoneId(zone.id);
        onCurrentZoneChangeRef.current({ ...zone, joined: true, memberCount: zone.memberCount + (zone.joined ? 0 : 1) });
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not join this zone.');
    } finally {
      setIsJoining(null);
    }
  };

  const handleLeave = async (zoneId: string) => {
    if (!currentEvent) return;
    setIsJoining(zoneId);
    setActionError(null);
    try {
      await leaveZone(currentEvent.id, zoneId);
      setZones(current => current.map(zone => zone.id === zoneId
        ? { ...zone, joined: false, memberCount: Math.max(0, zone.memberCount - 1) }
        : zone));
      const zone = zonesRef.current.find(item => item.id === zoneId);
      if (zone && geofence.currentZone?.id === zoneId) {
        onCurrentZoneChangeRef.current({ ...zone, joined: false, memberCount: Math.max(0, zone.memberCount - 1) });
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not leave this zone.');
    } finally {
      setIsJoining(null);
    }
  };

  const handleManualSelect = (zone: Zone) => {
    if (zoneStatus(zone) === 'expired') return;
    setSelectedZoneId(zone.id);
    geofence.selectZoneManually(zone);
    onCurrentZoneChangeRef.current(zone);
  };

  const handleZoneCreated = (zone: Zone) => {
    setZones(current => [zone, ...current]);
    setGeometryDraft(null);
    setSelectedZoneId(zone.id);
    setActionError(null);
  };

  const handleCircleCenter = (geometry: GeoJsonPoint) => setGeometryDraft(geometry);
  const handlePolygonDrawn = (geometry: GeoJsonPolygon) => {
    setGeometryDraft(geometry);
    setDrawingTool('none');
  };

  const handleToolChange = (tool: ZoneDrawingTool) => {
    setDrawingTool(tool);
    setGeometryDraft(null);
  };

  if (!currentEvent) {
    return <div className="zones-empty">Select an event to view its zones.</div>;
  }

  const canCreate = currentUser.role === 'organizer' || currentUser.role === 'moderator';
  const activeZone = geofence.currentZone;

  return (
    <main className={`zones-workspace${isActive ? '' : ' zones-workspace-hidden'}`}>
      <section className="zones-map-stage" aria-label="Event zone map">
        <MapView
          zones={zones}
          isActive={isActive}
          defaultCenter={[
            currentEvent.zoneConfig?.latitude || 17.6868,
            currentEvent.zoneConfig?.longitude || 83.2185
          ]}
          currentZone={activeZone}
          position={geofence.position}
          drawingTool={drawingTool}
          draftGeometry={geometryDraft}
          draftRadiusMeters={draftRadiusMeters}
          selectedZoneId={selectedZoneId}
          onSelectZone={zone => setSelectedZoneId(zone.id)}
          onJoinZone={handleJoin}
          onLeaveZone={handleLeave}
          onCircleCenter={handleCircleCenter}
          onPolygonDrawn={handlePolygonDrawn}
          onCancelDrawing={() => handleToolChange('none')}
        />
        <div className="zones-map-key" aria-label="Zone colors">
          <span><i className="joined" /> Joined</span>
          <span><i className="available" /> Available</span>
          <span><i className="expired" /> Expired</span>
        </div>
        {activeZone && (
          <div className={`zone-entry-banner${geofence.isSimulated ? ' simulated' : ''}`} role="status">
            <Radio size={17} />
            <span>{geofence.isSimulated
              ? `DEV SIMULATION · You’re inside ${activeZone.name} — simulated position`
              : geofence.isManualSelection
                ? `${activeZone.name} selected manually${activeZone.joined ? ' — joined' : ' — join to post'}`
                : `You’re inside ${activeZone.name} — posting enabled`}</span>
            {geofence.isSimulated && <strong>Simulated position</strong>}
          </div>
        )}
        {geofence.isLowAccuracy && (
          <div className="zone-accuracy-warning" role="status">
            <AlertTriangle size={16} /> GPS accuracy is {Math.round(geofence.position?.accuracy || 0)}m. Indoor location may be inaccurate.
          </div>
        )}
      </section>

      <aside className="zones-sidebar">
        <div className="zones-sidebar-header">
          <div className="zones-eyebrow"><MapPin size={14} /> MAP VIEW</div>
          <h1>{currentEvent.name}</h1>
          <p>Zones remain visible until their posted expiry time.</p>
        </div>

        <section className="location-consent-panel" aria-labelledby="location-consent-title">
          <div className="location-consent-title"><ShieldCheck size={17} /><h2 id="location-consent-title">Optional location</h2></div>
          <p>We use your location only to show nearby zones. Precise coordinates stay in this browser; the server receives coordinates rounded to about 100m and stores only your last known zone ID. Nothing is requested until you choose to enable it.</p>
          {geofence.permissionState === 'prompt' && (
            <button type="button" className="location-enable-button" onClick={geofence.requestLocation}>
              <Crosshair size={15} /> Enable location
            </button>
          )}
          {geofence.permissionState === 'requesting' && <div className="location-inline-status">Waiting for browser permission…</div>}
          {geofence.permissionState === 'granted' && <div className="location-inline-status">Location enabled for this page session.</div>}
          {(geofence.permissionState === 'denied' || geofence.permissionState === 'unavailable') && (
            <div className="location-inline-status">{geofence.permissionState === 'denied' ? 'Location denied. Choose an active zone below.' : 'Location unavailable. Choose an active zone below.'}</div>
          )}
          {geofence.locationError && <div className="zone-inline-error" role="status">{geofence.locationError}</div>}
        </section>

        {import.meta.env.DEV && (
          <section className="zone-simulator-panel">
            <label htmlFor="zone-simulator">Simulate location <span>DEV</span></label>
            <div className="zone-simulator-controls">
              <select id="zone-simulator" value={simulationTarget} onChange={event => setSimulationTarget(event.target.value)}>
                <option value="">Outside all zones</option>
                {zones.filter(zone => zoneStatus(zone) !== 'expired').map(zone => <option key={zone.id} value={zone.id}>Inside: {zone.name}</option>)}
              </select>
              <button type="button" onClick={() => {
                const target = zones.find(zone => zone.id === simulationTarget) || null;
                geofence.simulateLocation(target);
              }}>Run</button>
            </div>
            <p>Simulated fixes are visibly flagged and are never available in production.</p>
          </section>
        )}

        {actionError && <div className="zone-inline-error" role="alert">{actionError}</div>}
        {loadError && <div className="zone-inline-error" role="alert">{loadError}</div>}

        <section className="zone-list-section">
          <div className="zone-list-heading">
            <h2>Event zones <span>{zones.length}</span></h2>
            <button type="button" onClick={() => void loadZones()} aria-label="Refresh zones" title="Refresh zones"><RefreshCw size={15} /></button>
          </div>
          {isLoading && zones.length === 0 ? <div className="zone-list-empty">Loading zones…</div> : null}
          {!isLoading && zones.length === 0 ? <div className="zone-list-empty">No zones yet. {canCreate ? 'Create one below.' : 'Ask an organizer to create one.'}</div> : null}
          <div className="zone-list-items">
            {zones.map(zone => {
              const status = zoneStatus(zone);
              const selected = selectedZoneId === zone.id;
              return (
                <article key={zone.id} className={`zone-list-item ${status}${selected ? ' selected' : ''}`}>
                  <button type="button" className="zone-list-select" onClick={() => handleManualSelect(zone)} disabled={status === 'expired'}>
                    <span className={`zone-status-dot ${status}`} />
                    <span className="zone-list-copy">
                      <strong>{zone.name}</strong>
                      <span>{zone.geometry.type === 'Point' ? `${zone.radiusMeters}m circle` : 'Polygon'} · {zone.memberCount} joined</span>
                      <small>{ttlLabel(zone.expiresAt)}</small>
                    </span>
                  </button>
                  {status === 'available' && (
                    <button type="button" className="zone-join-button" onClick={() => void handleJoin(zone.id)} disabled={isJoining === zone.id}>
                      {isJoining === zone.id ? 'Joining…' : 'Join'}
                    </button>
                  )}
                  {status === 'joined' && <button type="button" className="zone-leave-button" onClick={() => void handleLeave(zone.id)} disabled={isJoining === zone.id}>{isJoining === zone.id ? 'Leaving…' : 'Leave'}</button>}
                </article>
              );
            })}
          </div>
        </section>

        {canCreate && (
          <ZoneCreator
            eventId={currentEvent.id}
            geometry={geometryDraft}
            radiusMeters={draftRadiusMeters}
            onRadiusChange={setDraftRadiusMeters}
            drawingTool={drawingTool}
            onDrawingToolChange={handleToolChange}
            onZoneCreated={handleZoneCreated}
          />
        )}
      </aside>
    </main>
  );
}
