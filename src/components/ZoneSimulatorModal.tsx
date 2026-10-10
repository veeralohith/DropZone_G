import React, { useState } from 'react';
import { EventItem, Membership } from '../types';
import { Radio, ShieldCheck, MapPin, X, Navigation, Loader2, Check, AlertTriangle } from 'lucide-react';
import campusMapImage from '../assets/images/geofence_campus_map_1791629391910.jpg';

interface ZoneSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEvent: EventItem | null;
  membership?: Membership;
  onUpdateZoneState: (state: Membership['zoneState']) => void;
}

export const ZoneSimulatorModal: React.FC<ZoneSimulatorModalProps> = ({
  isOpen,
  onClose,
  currentEvent,
  membership,
  onUpdateZoneState
}) => {
  const [simState, setSimState] = useState<Membership['zoneState']>(membership?.zoneState || 'eligible');
  const [isDetecting, setIsDetecting] = useState(false);
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);
  const customRadius = currentEvent?.zoneConfig?.radiusMeters || 500;

  if (!isOpen || !currentEvent) return null;

  const handleApply = (newState: Membership['zoneState']) => {
    setSimState(newState);
    onUpdateZoneState(newState);
    onClose();
  };

  const requestRealGeolocation = () => {
    if (!navigator.geolocation) {
      setGpsMessage('Geolocation is not supported by your browser environment.');
      handleApply('permission_denied');
      return;
    }

    setIsDetecting(true);
    setGpsMessage('Requesting device location via browser API...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsDetecting(false);
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;

        const targetLat = currentEvent.zoneConfig?.latitude || 28.5450;
        const targetLon = currentEvent.zoneConfig?.longitude || 77.1926;

        const R = 6371e3;
        const toRad = (d: number) => (d * Math.PI) / 180;
        const dLat = toRad(targetLat - userLat);
        const dLon = toRad(targetLon - userLon);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(userLat)) * Math.cos(toRad(targetLat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        if (distance <= customRadius) {
          setGpsMessage(`Verified: ~${Math.round(distance)}m from zone center (Inside ${customRadius}m perimeter).`);
          handleApply('eligible');
        } else {
          setGpsMessage(`Calculated: ~${Math.round(distance)}m from zone center (Outside ${customRadius}m perimeter).`);
          handleApply('outside_zone');
        }
      },
      (error) => {
        setIsDetecting(false);
        setGpsMessage(`Location access denied or timed out (${error.message}).`);
        handleApply('permission_denied');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Geofence & Proximity Inspector</h3>
              <p className="text-[11px] text-slate-400">{currentEvent.zoneConfig?.centerName || 'IIT Delhi Pavilion'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Campus Diagram */}
        <div className="relative h-44 w-full bg-slate-100 overflow-hidden border-b border-slate-200">
          <img
            src={campusMapImage}
            alt="Campus Geofence Boundary Map"
            className="w-full h-full object-cover object-center"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent to-transparent flex items-end p-4">
            <div className="text-white text-xs space-y-0.5">
              <div className="font-bold flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>Active Radius: {customRadius}m Perimeter</span>
              </div>
              <div className="text-[11px] text-slate-200 font-mono">
                Center Coordinates: {currentEvent.zoneConfig?.latitude || '28.5450'}° N, {currentEvent.zoneConfig?.longitude || '77.1926'}° E
              </div>
            </div>
          </div>
        </div>

        {/* Content & Options */}
        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Simulate Zone Location
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleApply('eligible')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  simState === 'eligible'
                    ? 'border-emerald-600 bg-emerald-50/60 text-emerald-900'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="text-xs font-bold">Inside Venue</div>
                <div className="text-[11px] text-slate-500 mt-0.5">~35m from center</div>
              </button>

              <button
                type="button"
                onClick={() => handleApply('outside_zone')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  simState === 'outside_zone'
                    ? 'border-rose-600 bg-rose-50/60 text-rose-900'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="text-xs font-bold">Outside Zone</div>
                <div className="text-[11px] text-slate-500 mt-0.5">1,250m beyond perimeter</div>
              </button>

              <button
                type="button"
                onClick={() => handleApply('demo_zone')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  simState === 'demo_zone'
                    ? 'border-blue-600 bg-blue-50/60 text-blue-900'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="text-xs font-bold">Demo Override</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Always eligible</div>
              </button>
            </div>
          </div>

          {/* Browser Real GPS Button */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={requestRealGeolocation}
              disabled={isDetecting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-60 cursor-pointer"
            >
              {isDetecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Calculating Haversine Distance...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4 text-blue-600" />
                  <span>Test Real Device GPS (Browser Geolocation API)</span>
                </>
              )}
            </button>

            {gpsMessage && (
              <div className="mt-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                {gpsMessage}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Zero Persistent GPS Storage: Coordinates are transiently verified in memory and never logged to database tables.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
