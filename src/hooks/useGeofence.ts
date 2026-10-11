import { booleanPointInPolygon, centroid, distance, point } from '@turf/turf';
import { useCallback, useEffect, useRef, useState } from 'react';
import { locateZone } from '../services/api';
import { GeoJsonPolygon, Zone } from '../types';

export type LocationPermissionState = 'prompt' | 'requesting' | 'granted' | 'denied' | 'unavailable';
export type CoarsePosition = { latitude: number; longitude: number; accuracy: number; simulated: boolean };

interface UseGeofenceOptions {
  eventId: string | null;
  zones: Zone[];
  onZoneEnter?: (zoneId: string) => void;
  onZoneExit?: (zoneId: string) => void;
}

export function useGeofence({ eventId, zones, onZoneEnter, onZoneExit }: UseGeofenceOptions) {
  const [currentZone, setCurrentZone] = useState<Zone | null>(null);
  const [permissionState, setPermissionState] = useState<LocationPermissionState>('prompt');
  const [position, setPosition] = useState<CoarsePosition | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLowAccuracy, setIsLowAccuracy] = useState(false);
  const [isSimulated, setIsSimulated] = useState(false);
  const [isManualSelection, setIsManualSelection] = useState(false);
  const currentZoneRef = useRef<Zone | null>(null);
  const zonesRef = useRef(zones);
  const callbacksRef = useRef({ onZoneEnter, onZoneExit });
  const processPositionRef = useRef<(latitude: number, longitude: number, accuracy: number, simulated: boolean) => void>(() => {});
  const lastSentZoneRef = useRef<string | null | undefined>(undefined);
  const watchIdRef = useRef<number | null>(null);

  zonesRef.current = zones;
  callbacksRef.current = { onZoneEnter, onZoneExit };

  const setZone = useCallback((nextZone: Zone | null) => {
    const previousZone = currentZoneRef.current;
    if (previousZone?.id === nextZone?.id) return;
    currentZoneRef.current = nextZone;
    setCurrentZone(nextZone);
    if (previousZone) callbacksRef.current.onZoneExit?.(previousZone.id);
    if (nextZone) callbacksRef.current.onZoneEnter?.(nextZone.id);
  }, []);

  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then(permissionStatus => {
        if (permissionStatus.state === 'granted') {
          requestLocation();
        }
      }).catch(() => {});
    }
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!currentZone) return;
    const refreshedZone = zones.find(zone => zone.id === currentZone.id);
    if (!refreshedZone || new Date(refreshedZone.expiresAt).getTime() <= Date.now()) setZone(null);
    else if (refreshedZone !== currentZone) setCurrentZone(refreshedZone);
  }, [zones, currentZone, setZone]);

  useEffect(() => {
    lastSentZoneRef.current = undefined;
    currentZoneRef.current = null;
    setCurrentZone(null);
  }, [eventId]);

  const processPosition = useCallback((latitude: number, longitude: number, accuracy: number, simulated: boolean) => {
    const now = Date.now();
    const activeZones = zonesRef.current.filter(zone => new Date(zone.expiresAt).getTime() > now);
    const userPoint = point([longitude, latitude]);
    const matched = activeZones.find(zone => {
      if (zone.geometry.type === 'Point') {
        const [centerLongitude, centerLatitude] = zone.geometry.coordinates;
        return distance(userPoint, point([centerLongitude, centerLatitude]), { units: 'meters' }) <= (zone.radiusMeters || 0);
      }
      return booleanPointInPolygon(userPoint, {
        type: 'Feature',
        properties: {},
        geometry: zone.geometry as GeoJsonPolygon
      });
    }) || null;

    setPosition({ latitude, longitude, accuracy, simulated });
    setIsLowAccuracy(accuracy > 50);
    setIsSimulated(simulated);
    setIsManualSelection(false);
    setZone(matched);

    if (eventId && lastSentZoneRef.current !== matched?.id) {
      lastSentZoneRef.current = matched?.id ?? null;
      void locateZone(eventId, Math.round(latitude * 1000) / 1000, Math.round(longitude * 1000) / 1000, simulated)
        .catch(error => setLocationError(error instanceof Error ? error.message : 'Zone verification failed.'));
    }
  }, [eventId, setZone]);

  processPositionRef.current = processPosition;

  const requestLocation = useCallback(() => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setPermissionState('unavailable');
      setLocationError('Location is unavailable in this browser. Select a zone manually or use the demo simulator.');
      return;
    }

    setPermissionState('requesting');
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = navigator.geolocation.watchPosition(
      positionResult => {
        setPermissionState('granted');
        processPositionRef.current(
          positionResult.coords.latitude,
          positionResult.coords.longitude,
          positionResult.coords.accuracy,
          false
        );
      },
      error => {
        setPermissionState(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable');
        setLocationError(error.code === error.PERMISSION_DENIED
          ? 'Location permission was denied. You can choose a zone manually.'
          : 'Could not read a location fix. Choose a zone manually or try again.');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  }, []);

  const simulateLocation = useCallback((zone: Zone | null) => {
    if (!import.meta.env.DEV) return;
    if (!zone) {
      processPositionRef.current(0, 0, 1000, true);
      return;
    }
    if (zone.geometry.type === 'Point') {
      const [longitude, latitude] = zone.geometry.coordinates;
      processPositionRef.current(latitude, longitude, 8, true);
      return;
    }
    const center = centroid({ type: 'Feature', properties: {}, geometry: zone.geometry as GeoJsonPolygon });
    processPositionRef.current(center.geometry.coordinates[1], center.geometry.coordinates[0], 8, true);
  }, []);

  const selectZoneManually = useCallback((zone: Zone | null) => {
    setIsSimulated(false);
    setIsManualSelection(true);
    setZone(zone);
  }, [setZone]);

  return {
    currentZone,
    permissionState,
    requestLocation,
    position,
    locationError,
    isLowAccuracy,
    isSimulated,
    isManualSelection,
    simulateLocation,
    selectZoneManually
  };
}
