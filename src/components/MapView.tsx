import L, { type Map as LeafletMap, type Layer, type LeafletMouseEvent } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { GeoJsonPoint, GeoJsonPolygon, Zone } from '../types';
import { CoarsePosition } from '../hooks/useGeofence';

export type ZoneDrawingTool = 'none' | 'circle' | 'polygon';

interface MapViewProps {
  zones: Zone[];
  isActive: boolean;
  defaultCenter: [number, number];
  currentZone: Zone | null;
  position: CoarsePosition | null;
  drawingTool: ZoneDrawingTool;
  draftGeometry: GeoJsonPoint | GeoJsonPolygon | null;
  draftRadiusMeters: number;
  selectedZoneId: string | null;
  onSelectZone: (zone: Zone) => void;
  onJoinZone: (zoneId: string) => void;
  onLeaveZone: (zoneId: string) => void;
  onCircleCenter: (geometry: GeoJsonPoint) => void;
  onPolygonDrawn: (geometry: GeoJsonPolygon) => void;
  onCancelDrawing: () => void;
}

const VISAKHAPATNAM_CENTER: [number, number] = [17.6868, 83.2185];
const DEFAULT_ZOOM = 16;

function formatTtl(expiresAt: string): string {
  const remaining = new Date(expiresAt).getTime() - Date.now();
  if (remaining <= 0) return 'Expired';
  const hours = Math.floor(remaining / 3600000);
  const days = Math.floor(hours / 24);
  return days > 0 ? `Expires in ${days}d ${hours % 24}h` : `Expires in ${hours}h ${Math.floor((remaining % 3600000) / 60000)}m`;
}

function popupContent(zone: Zone, onJoinZone: (zoneId: string) => void, onLeaveZone: (zoneId: string) => void): HTMLElement {
  const root = document.createElement('div');
  root.className = 'zone-map-popup';
  const name = document.createElement('strong');
  name.textContent = zone.name;
  const ttl = document.createElement('div');
  ttl.textContent = formatTtl(zone.expiresAt);
  const members = document.createElement('div');
  members.textContent = `${zone.memberCount} ${zone.memberCount === 1 ? 'member' : 'members'}`;
  root.append(name, ttl, members);
  if (new Date(zone.expiresAt).getTime() > Date.now()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'zone-popup-join';
    button.textContent = zone.joined ? 'Leave Zone' : 'Join Zone';
    button.addEventListener('click', event => {
      event.stopPropagation();
      if (zone.joined) onLeaveZone(zone.id);
      else onJoinZone(zone.id);
    });
    root.append(button);
  }
  return root;
}

function styleForZone(zone: Zone, selected: boolean): { color: string; fillColor: string; fillOpacity: number; weight: number } {
  const expired = new Date(zone.expiresAt).getTime() <= Date.now();
  const color = expired ? '#64748b' : zone.joined ? '#15803d' : '#2563eb';
  return { color, fillColor: color, fillOpacity: selected ? 0.3 : 0.16, weight: selected ? 3 : 2 };
}

export function MapView({
  zones,
  isActive,
  defaultCenter,
  currentZone,
  position,
  drawingTool,
  draftGeometry,
  draftRadiusMeters,
  selectedZoneId,
  onSelectZone,
  onJoinZone,
  onLeaveZone,
  onCircleCenter,
  onPolygonDrawn,
  onCancelDrawing
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layersRef = useRef<L.FeatureGroup>(L.featureGroup());
  const drawingLayersRef = useRef<L.LayerGroup>(L.layerGroup());
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const hasCenteredOnLocationRef = useRef(false);
  const drawingToolRef = useRef(drawingTool);
  const polygonPointsRef = useRef<L.LatLng[]>([]);
  const polygonPointCountRef = useRef(0);
  drawingToolRef.current = drawingTool;
  const handlersRef = useRef({ onSelectZone, onJoinZone, onLeaveZone, onCircleCenter, onPolygonDrawn });
  handlersRef.current = { onSelectZone, onJoinZone, onLeaveZone, onCircleCenter, onPolygonDrawn };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true }).setView(defaultCenter || VISAKHAPATNAM_CENTER, DEFAULT_ZOOM);
    mapRef.current = map;
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    layersRef.current.addTo(map);
    drawingLayersRef.current.addTo(map);

    map.on('click', (event: LeafletMouseEvent) => {
      const tool = drawingToolRef.current;
      if (tool === 'circle') {
        handlersRef.current.onCircleCenter({
          type: 'Point',
          coordinates: [event.latlng.lng, event.latlng.lat]
        });
      } else if (tool === 'polygon') {
        event.originalEvent.stopPropagation();
        polygonPointsRef.current.push(event.latlng);
        polygonPointCountRef.current += 1;
        const points = polygonPointsRef.current;
        drawingLayersRef.current.clearLayers();
        points.forEach(point => {
          L.circleMarker(point, { radius: 4, color: '#ffffff', weight: 2, fillColor: '#0f766e', fillOpacity: 1 })
            .addTo(drawingLayersRef.current);
        });
        if (points.length >= 3) {
          L.polygon(points, { color: '#0f766e', weight: 2, dashArray: '7 6', fillColor: '#14b8a6', fillOpacity: 0.15, interactive: false })
            .addTo(drawingLayersRef.current);
        } else if (points.length >= 2) {
          L.polyline(points, { color: '#0f766e', weight: 2, dashArray: '7 6', interactive: false })
            .addTo(drawingLayersRef.current);
        }
        setPolygonPointCount(polygonPointCountRef.current);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
      hasCenteredOnLocationRef.current = false;
      drawingLayersRef.current.clearLayers();
    };
  }, []);

  const [polygonPointCount, setPolygonPointCount] = useState(0);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getContainer().style.cursor = drawingTool !== 'none' ? 'crosshair' : '';
    polygonPointsRef.current = [];
    polygonPointCountRef.current = 0;
    setPolygonPointCount(0);
    drawingLayersRef.current.clearLayers();
    return () => {
      drawingLayersRef.current.clearLayers();
    };
  }, [drawingTool]);

  useEffect(() => {
    if (defaultCenter && mapRef.current) {
      mapRef.current.setView(defaultCenter, DEFAULT_ZOOM, { animate: false });
      hasCenteredOnLocationRef.current = false;
    }
  }, [defaultCenter[0], defaultCenter[1]]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    layersRef.current.clearLayers();
    zones.forEach(zone => {
      const style = styleForZone(zone, zone.id === selectedZoneId);
      let layer: Layer;
      if (zone.geometry.type === 'Point') {
        const [longitude, latitude] = zone.geometry.coordinates;
        layer = L.circle([latitude, longitude], { ...style, radius: zone.radiusMeters || 50 });
      } else {
        layer = L.geoJSON(zone.geometry, { style });
      }
      layer.on('click', (event: LeafletMouseEvent) => {
        handlersRef.current.onSelectZone(zone);
        L.popup({ closeButton: true, offset: L.point(0, -4) })
          .setLatLng(event.latlng)
          .setContent(popupContent(zone, handlersRef.current.onJoinZone, handlersRef.current.onLeaveZone))
          .openOn(map);
      });
      layersRef.current.addLayer(layer);
    });

    if (draftGeometry?.type === 'Point') {
      const [longitude, latitude] = draftGeometry.coordinates;
      layersRef.current.addLayer(L.circle([latitude, longitude], {
        radius: draftRadiusMeters,
        color: '#0f766e',
        weight: 2,
        dashArray: '7 6',
        fillColor: '#14b8a6',
        fillOpacity: 0.22,
        interactive: false
      }));
      map.panTo([latitude, longitude], { animate: true, duration: 0.25 });
    } else if (draftGeometry?.type === 'Polygon') {
      const draftLayer = L.geoJSON(draftGeometry, {
        style: { color: '#0f766e', weight: 3, dashArray: '7 6', fillColor: '#14b8a6', fillOpacity: 0.18 },
        interactive: false
      });
      layersRef.current.addLayer(draftLayer);
      map.fitBounds(draftLayer.getBounds().pad(0.2), { maxZoom: 17, animate: true });
    }
  }, [zones, selectedZoneId, draftGeometry, draftRadiusMeters]);

  useEffect(() => {
    const map = mapRef.current;
    const zone = zones.find(item => item.id === selectedZoneId);
    if (!map || !zone) return;
    if (zone.geometry.type === 'Point') {
      const [longitude, latitude] = zone.geometry.coordinates;
      map.setView([latitude, longitude], Math.max(map.getZoom(), 15), { animate: true });
    } else {
      const layer = L.geoJSON(zone.geometry);
      map.fitBounds(layer.getBounds().pad(0.15), { maxZoom: 17, animate: true });
    }
  }, [zones, selectedZoneId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (isActive) map.invalidateSize({ pan: false });
    if (!position) return;
    const location = L.latLng(position.latitude, position.longitude);
    if (!userMarkerRef.current) {
      userMarkerRef.current = L.circleMarker(location, {
        radius: 7,
        color: '#ffffff',
        weight: 3,
        fillColor: position.simulated ? '#c2410c' : '#0f766e',
        fillOpacity: 1
      }).addTo(map);
    } else {
      userMarkerRef.current.setLatLng(location);
      userMarkerRef.current.setStyle({ fillColor: position.simulated ? '#c2410c' : '#0f766e' });
    }
    if (!hasCenteredOnLocationRef.current || position.simulated) {
      map.setView(location, Math.max(map.getZoom(), 15), { animate: true });
      hasCenteredOnLocationRef.current = true;
    }
  }, [position, currentZone, isActive]);

  const finishPolygon = () => {
    const points = polygonPointsRef.current;
    if (points.length < 3) return;
    const coordinates = points.map(point => [point.lng, point.lat] as [number, number]);
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) coordinates.push(first);
    handlersRef.current.onPolygonDrawn({ type: 'Polygon', coordinates: [coordinates] });
    polygonPointsRef.current = [];
    polygonPointCountRef.current = 0;
    drawingLayersRef.current.clearLayers();
    setPolygonPointCount(0);
  };

  return (
    <div className="zone-map-canvas">
      <div ref={containerRef} className="zone-leaflet-map" aria-label="Map showing event zones" />
      {drawingTool !== 'none' && (
        <div className="zone-draw-help" role="status">
          <span>{drawingTool === 'circle'
            ? draftGeometry?.type === 'Point' ? `Circle preview · ${draftRadiusMeters}m radius. Adjust the slider, or click again to move the center.` : 'Click anywhere on the map to place the circle center.'
            : polygonPointCount < 3 ? `Click the map to add polygon corners (${polygonPointCount}/3 minimum).` : `${polygonPointCount} corners added. Review the preview and finish.`}</span>
          {drawingTool === 'polygon' && <button type="button" className="zone-draw-finish" onClick={finishPolygon} disabled={polygonPointCount < 3}>Finish polygon</button>}
          <button type="button" className="zone-draw-cancel" onClick={onCancelDrawing}>Cancel</button>
        </div>
      )}
    </div>
  );
}
