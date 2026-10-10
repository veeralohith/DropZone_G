import { AlertCircle, Circle, Pentagon, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createZone } from '../services/api';
import { GeoJsonPoint, GeoJsonPolygon, Post, Zone } from '../types';
import { ZoneDrawingTool } from './MapView';

const POST_TYPES: { id: Post['category']; label: string }[] = [
  { id: 'requirement', label: 'Hardware & needs' },
  { id: 'lost_found', label: 'Lost & found' },
  { id: 'qa', label: 'Q&A & help' },
  { id: 'announcement', label: 'Announcements' },
  { id: 'promotion', label: 'Sponsored / merchant (reviewed)' }
];

interface ZoneCreatorProps {
  eventId: string;
  geometry: GeoJsonPoint | GeoJsonPolygon | null;
  radiusMeters: number;
  onRadiusChange: (radius: number) => void;
  drawingTool: ZoneDrawingTool;
  onDrawingToolChange: (tool: ZoneDrawingTool) => void;
  onZoneCreated: (zone: Zone) => void;
}

export function ZoneCreator({ eventId, geometry, radiusMeters, onRadiusChange, drawingTool, onDrawingToolChange, onZoneCreated }: ZoneCreatorProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ttlSeconds, setTtlSeconds] = useState(86400);
  const [allowedPostTypes, setAllowedPostTypes] = useState<Post['category'][]>(['requirement', 'lost_found', 'qa', 'announcement']);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (drawingTool !== 'none') setError(null);
  }, [drawingTool]);

  const togglePostType = (postType: Post['category']) => {
    setAllowedPostTypes(current => current.includes(postType)
      ? current.filter(type => type !== postType)
      : [...current, postType]);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!geometry) {
      setError(drawingTool === 'circle' ? 'Click the map to place the zone center.' : 'Draw a polygon on the map first.');
      return;
    }
    if (allowedPostTypes.length === 0) {
      setError('Choose at least one permitted post type.');
      return;
    }

    setIsSaving(true);
    try {
      const zone = await createZone(eventId, {
        name: name.trim(),
        description: description.trim(),
        geometry,
        radiusMeters: geometry.type === 'Point' ? radiusMeters : undefined,
        ttlSeconds,
        allowedPostTypes
      });
      onZoneCreated(zone);
      setName('');
      setDescription('');
      onDrawingToolChange('none');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save the zone.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="zone-creator-panel" aria-labelledby="zone-creator-title">
      <div className="zone-panel-heading">
        <div>
          <h2 id="zone-creator-title">Create a zone</h2>
          <p>Zones expire automatically and do not store member coordinates.</p>
        </div>
      </div>

      <div className="zone-tool-switch" role="group" aria-label="Choose zone shape">
        <button type="button" aria-pressed={drawingTool === 'circle'} onClick={() => onDrawingToolChange(drawingTool === 'circle' ? 'none' : 'circle')}>
          <Circle size={15} /> Circle
        </button>
        <button type="button" aria-pressed={drawingTool === 'polygon'} onClick={() => onDrawingToolChange(drawingTool === 'polygon' ? 'none' : 'polygon')}>
          <Pentagon size={15} /> Polygon
        </button>
      </div>

      <form onSubmit={handleSubmit} className="zone-creator-form">
        <label>
          Zone name
          <input value={name} onChange={event => setName(event.target.value)} maxLength={100} required placeholder="e.g. Hardware lab" />
        </label>
        <label>
          Description
          <textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={500} rows={2} placeholder="What is this zone for?" />
        </label>

        {geometry?.type === 'Point' && (
          <label className="zone-radius-control">
            <span>Radius <strong>{radiusMeters} m</strong></span>
            <input type="range" min="50" max="500" step="10" value={radiusMeters} onChange={event => onRadiusChange(Number(event.target.value))} />
          </label>
        )}
        <div className="zone-selected-shape" aria-live="polite">
          {geometry ? `${geometry.type === 'Point' ? 'Circle center set' : 'Polygon drawn'}` : drawingTool === 'circle' ? 'Click map to place center' : drawingTool === 'polygon' ? 'Draw a polygon on the map' : 'Choose a shape to begin'}
        </div>

        <label>
          Zone lifetime
          <select value={ttlSeconds} onChange={event => setTtlSeconds(Number(event.target.value))}>
            <option value={7200}>2 hours</option>
            <option value={86400}>24 hours</option>
            <option value={604800}>7 days</option>
          </select>
        </label>

        <fieldset className="zone-post-types">
          <legend>Allowed post types</legend>
          {POST_TYPES.map(type => (
            <label key={type.id}>
              <input type="checkbox" checked={allowedPostTypes.includes(type.id)} onChange={() => togglePostType(type.id)} />
              <span>{type.label}</span>
            </label>
          ))}
        </fieldset>

        {error && <div role="alert" className="zone-form-error"><AlertCircle size={15} />{error}</div>}
        <button type="submit" className="zone-save-button" disabled={isSaving}>
          <Save size={15} /> {isSaving ? 'Saving zone…' : 'Save zone'}
        </button>
      </form>
    </section>
  );
}
