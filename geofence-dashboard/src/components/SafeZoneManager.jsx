import React, { useState, useEffect } from 'react';
import {
  Shield,
  Plus,
  Trash2,
  MapPin,
  AlertCircle,
  Home,
  GraduationCap,
  Trees,
  Briefcase,
  Users,
  Clock,
  Check,
  Edit2,
  X,
  Power,
  Globe
} from 'lucide-react';
import { computeHaversineKm, isScheduleActive } from '../utils/dashboardUtils';

const CATEGORIES = [
  { id: 'home', label: 'Home', icon: Home, defaultRadius: 400, defaultSchedule: { mode: 'all_day' } },
  { id: 'school', label: 'School', icon: GraduationCap, defaultRadius: 500, defaultSchedule: { mode: 'custom', startTime: '07:30', endTime: '15:30', days: ['mon', 'tue', 'wed', 'thu', 'fri'] } },
  { id: 'park', label: 'Park', icon: Trees, defaultRadius: 350, defaultSchedule: { mode: 'custom', startTime: '16:00', endTime: '19:00', days: ['sat', 'sun'] } },
  { id: 'work', label: 'Work', icon: Briefcase, defaultRadius: 450, defaultSchedule: { mode: 'custom', startTime: '09:00', endTime: '17:00', days: ['mon', 'tue', 'wed', 'thu', 'fri'] } },
  { id: 'relative', label: "Relative's Home", icon: Users, defaultRadius: 400, defaultSchedule: { mode: 'all_day' } },
  { id: 'custom', label: 'Custom Location', icon: MapPin, defaultRadius: 500, defaultSchedule: { mode: 'all_day' } },
];

const DAYS_OF_WEEK = [
  { key: 'mon', label: 'M' },
  { key: 'tue', label: 'T' },
  { key: 'wed', label: 'W' },
  { key: 'thu', label: 'T' },
  { key: 'fri', label: 'F' },
  { key: 'sat', label: 'S' },
  { key: 'sun', label: 'S' },
];

export default function SafeZoneManager({
  geofences = [],
  currentPacket,
  onSaveGeofence,
  onUpdateGeofence,
  onDeleteGeofence,
  onFlyToZone,
  selectedZoneId,
  onSelectZone,
  draftZone,
  setDraftZone,
  isMapPickActive,
  setIsMapPickActive,
  onClose,
}) {
  const [formMode, setFormMode] = useState(null); // 'create' | 'edit' | null
  const [editingZoneId, setEditingZoneId] = useState(null);

  // Form states
  const [category, setCategory] = useState('home');
  const [label, setLabel] = useState('');
  const [lat, setLat] = useState('30.3491');
  const [lng, setLng] = useState('76.4117');
  const [radiusMeters, setRadiusMeters] = useState(400);
  const [enabled, setEnabled] = useState(true);

  // Schedule states
  const [scheduleMode, setScheduleMode] = useState('all_day'); // 'all_day' | 'custom'
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');
  const [selectedDays, setSelectedDays] = useState(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [timezone, setTimezone] = useState('Asia/Kolkata');

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Keep draftZone synchronized with map for live drawing
  useEffect(() => {
    if (formMode) {
      setDraftZone?.({
        id: editingZoneId || 'draft',
        label: label.trim() || 'New Safe Place',
        category,
        centerLatitude: parseFloat(lat) || 30.3491,
        centerLongitude: parseFloat(lng) || 76.4117,
        radiusMeters: Number(radiusMeters) || 400,
        enabled,
        schedule: {
          mode: scheduleMode,
          startTime,
          endTime,
          days: selectedDays,
          timezone,
        },
      });
    } else {
      setDraftZone?.(null);
    }
  }, [formMode, editingZoneId, label, category, lat, lng, radiusMeters, enabled, scheduleMode, startTime, endTime, selectedDays, timezone, setDraftZone]);

  // When map updates draft coordinates via click or drag, reflect in form
  useEffect(() => {
    if (draftZone && draftZone._fromMap) {
      if (draftZone.centerLatitude != null) setLat(draftZone.centerLatitude.toFixed(6));
      if (draftZone.centerLongitude != null) setLng(draftZone.centerLongitude.toFixed(6));
    }
  }, [draftZone]);

  // Select preset category defaults
  const handleSelectCategory = (catId) => {
    setCategory(catId);
    const cat = CATEGORIES.find(c => c.id === catId);
    if (!cat) return;

    if (!editingZoneId) {
      if (catId === 'home') setLabel('Home (Residence)');
      else if (catId === 'school') setLabel('School Campus');
      else if (catId === 'park') setLabel('Neighborhood Park');
      else if (catId === 'work') setLabel("Parent's Workplace");
      else if (catId === 'relative') setLabel("Grandparents' Home");
      else setLabel('');
    }

    setRadiusMeters(cat.defaultRadius);
    if (cat.defaultSchedule) {
      setScheduleMode(cat.defaultSchedule.mode);
      if (cat.defaultSchedule.startTime) setStartTime(cat.defaultSchedule.startTime);
      if (cat.defaultSchedule.endTime) setEndTime(cat.defaultSchedule.endTime);
      if (cat.defaultSchedule.days) setSelectedDays(cat.defaultSchedule.days);
    }
  };

  const handleStartCreate = () => {
    setFormMode('create');
    setEditingZoneId(null);
    setErrorMsg('');
    setIsMapPickActive?.(true);

    // Initial center from device location or campus default
    const initLat = currentPacket?.latitude ? currentPacket.latitude.toFixed(6) : '30.349100';
    const initLng = currentPacket?.longitude ? currentPacket.longitude.toFixed(6) : '76.411700';

    setCategory('home');
    setLabel('Home (Residence)');
    setLat(initLat);
    setLng(initLng);
    setRadiusMeters(400);
    setEnabled(true);
    setScheduleMode('all_day');
    setStartTime('00:00');
    setEndTime('23:59');
    setSelectedDays(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    setTimezone('Asia/Kolkata');

    onFlyToZone?.(parseFloat(initLat), parseFloat(initLng));
  };

  const handleStartEdit = (zone) => {
    setFormMode('edit');
    setEditingZoneId(zone.id);
    setErrorMsg('');
    setIsMapPickActive?.(true);

    setCategory(zone.category || 'custom');
    setLabel(zone.label || zone.name || '');
    setLat(zone.centerLatitude != null ? zone.centerLatitude.toFixed(6) : '30.349100');
    setLng(zone.centerLongitude != null ? zone.centerLongitude.toFixed(6) : '76.411700');
    setRadiusMeters(zone.radiusMeters || 500);
    setEnabled(zone.enabled !== false && zone.isActive !== false);

    const sched = zone.schedule || {};
    setScheduleMode(sched.mode === 'custom' ? 'custom' : 'all_day');
    setStartTime(sched.startTime || '08:00');
    setEndTime(sched.endTime || '16:00');
    setSelectedDays(Array.isArray(sched.days) ? sched.days : ['mon', 'tue', 'wed', 'thu', 'fri']);
    setTimezone(sched.timezone || 'Asia/Kolkata');

    onFlyToZone?.(zone.centerLatitude, zone.centerLongitude);
    onSelectZone?.(zone.id);
  };

  const handleCancelForm = () => {
    setFormMode(null);
    setEditingZoneId(null);
    setErrorMsg('');
    setIsMapPickActive?.(false);
    setDraftZone?.(null);
  };

  const toggleDay = (dayKey) => {
    setSelectedDays(prev => 
      prev.includes(dayKey)
        ? (prev.length > 1 ? prev.filter(d => d !== dayKey) : prev) // keep at least 1 day
        : [...prev, dayKey]
    );
  };

  const handleSaveForm = async (e) => {
    if (e) e.preventDefault();

    const cleanLabel = label.trim();
    if (!cleanLabel) {
      setErrorMsg('Please name this safe place.');
      return;
    }

    const nLat = parseFloat(lat);
    const nLng = parseFloat(lng);
    if (isNaN(nLat) || nLat < -90 || nLat > 90) {
      setErrorMsg('Latitude must be a valid number between -90 and 90.');
      return;
    }
    if (isNaN(nLng) || nLng < -180 || nLng > 180) {
      setErrorMsg('Longitude must be a valid number between -180 and 180.');
      return;
    }

    const zonePayload = {
      id: editingZoneId || `zone-${Date.now()}`,
      label: cleanLabel,
      name: cleanLabel,
      category,
      centerLatitude: nLat,
      centerLongitude: nLng,
      radiusMeters: Number(radiusMeters),
      enabled,
      isActive: enabled,
      schedule: {
        mode: scheduleMode,
        startTime,
        endTime,
        days: selectedDays,
        timezone,
        enabled,
      },
    };

    setSaving(true);
    setErrorMsg('');

    try {
      let success = false;
      if (formMode === 'edit' && editingZoneId) {
        if (onUpdateGeofence) {
          const res = await onUpdateGeofence(editingZoneId, zonePayload);
          success = res !== false;
        } else if (onSaveGeofence) {
          const res = await onSaveGeofence(zonePayload);
          success = res !== false;
        }
      } else {
        const res = await onSaveGeofence(zonePayload);
        success = res !== false;
      }

      if (success) {
        handleCancelForm();
      } else {
        setErrorMsg('Failed to save safe place to database. Please check connection and retry.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error saving safe place.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (onDeleteGeofence) {
      await onDeleteGeofence(id);
      setConfirmDeleteId(null);
      if (editingZoneId === id) {
        handleCancelForm();
      }
    }
  };

  const handleToggleEnabled = async (zone, e) => {
    e.stopPropagation();
    const newEnabled = !(zone.enabled !== false && zone.isActive !== false);
    if (onUpdateGeofence) {
      await onUpdateGeofence(zone.id, { enabled: newEnabled, isActive: newEnabled });
    }
  };

  // Check if current schedule crosses midnight
  const isOvernight = scheduleMode === 'custom' && startTime > endTime;

  return (
    <div className="safezone-manager">
      {/* Header */}
      <div className="safezone-manager-header">
        <div>
          <h3>Safe Places ({geofences.length})</h3>
          <p>Protected boundary perimeters monitored by CareTag</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {!formMode && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleStartCreate}
            >
              <Plus size={14} />
              <span>Add Safe Place</span>
            </button>
          )}
          {onClose && (
            <button
              type="button"
              className="tech-close-btn"
              onClick={onClose}
              aria-label="Close Manager"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Map-based picker active banner */}
      {formMode && (
        <div className="map-pick-indicator-banner">
          <MapPin size={14} className="pulse-icon" />
          <span>Click anywhere on the map or drag the circle to adjust location.</span>
        </div>
      )}

      {/* ── Form Drawer (Create / Edit) ── */}
      {formMode && (
        <div className="add-zone-drawer">
          <div className="add-zone-drawer-header">
            <h4>{formMode === 'edit' ? 'Edit Safe Place' : 'Create New Safe Place'}</h4>
            <button
              type="button"
              className="icon-btn-close"
              onClick={handleCancelForm}
            >
              <X size={14} />
            </button>
          </div>

          {/* Category Chips */}
          <div className="wizard-preset-chips" style={{ marginBottom: '14px' }}>
            {CATEGORIES.map(cat => {
              const IconComponent = cat.icon;
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`preset-chip ${category === cat.id ? 'is-active' : ''}`}
                  onClick={() => handleSelectCategory(cat.id)}
                >
                  <IconComponent size={13} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSaveForm}>
            {/* Zone Name */}
            <div className="form-group">
              <label>Place Name</label>
              <input
                type="text"
                placeholder="e.g. Home, DPS Campus, City Park"
                value={label}
                onChange={e => setLabel(e.target.value)}
                required
                autoFocus
              />
            </div>

            {/* Coordinates */}
            <div className="form-row-2">
              <div className="form-group">
                <label>Latitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={lat}
                  onChange={e => setLat(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Longitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={lng}
                  onChange={e => setLng(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Radius Slider & Presets */}
            <div className="form-group">
              <div className="radius-label-row">
                <label>Coverage Radius</label>
                <span className="radius-value-pill">{radiusMeters}m</span>
              </div>
              <input
                type="range"
                min="50"
                max="2000"
                step="25"
                value={radiusMeters}
                onChange={e => setRadiusMeters(Number(e.target.value))}
              />
              <div className="radius-presets" role="group" aria-label="Coverage Radius Presets">
                {[
                  { m: 100, label: '100m', sub: 'Compact' },
                  { m: 250, label: '250m', sub: 'Tight' },
                  { m: 500, label: '500m', sub: 'Standard' },
                  { m: 1000, label: '1 km', sub: 'Campus' },
                ].map(p => (
                  <button
                    key={p.m}
                    type="button"
                    className={`radius-preset-btn ${radiusMeters === p.m ? 'is-active' : ''}`}
                    onClick={() => setRadiusMeters(p.m)}
                  >
                    <span className="radius-preset-val">{p.label}</span>
                    <span className="radius-preset-desc">{p.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Scheduled Geofencing Section ── */}
            <div className="schedule-config-section">
              <div className="schedule-header-row">
                <div className="schedule-title-wrap">
                  <Clock size={14} color="#2563EB" />
                  <strong>Monitoring Schedule</strong>
                </div>
                <div className="schedule-mode-toggle">
                  <button
                    type="button"
                    className={`mode-toggle-btn ${scheduleMode === 'all_day' ? 'is-active' : ''}`}
                    onClick={() => setScheduleMode('all_day')}
                  >
                    All Day
                  </button>
                  <button
                    type="button"
                    className={`mode-toggle-btn ${scheduleMode === 'custom' ? 'is-active' : ''}`}
                    onClick={() => setScheduleMode('custom')}
                  >
                    Custom Hours
                  </button>
                </div>
              </div>

              {scheduleMode === 'custom' && (
                <div className="schedule-details-panel">
                  {/* Days of Week */}
                  <div className="schedule-days-group">
                    <label className="schedule-sublabel">Active Days</label>
                    <div className="day-chips-row">
                      {DAYS_OF_WEEK.map(d => {
                        const isSelected = selectedDays.includes(d.key);
                        return (
                          <button
                            key={d.key}
                            type="button"
                            className={`day-chip ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => toggleDay(d.key)}
                            title={d.key.toUpperCase()}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Time Window */}
                  <div className="form-row-2" style={{ marginTop: '10px' }}>
                    <div className="form-group">
                      <label className="schedule-sublabel">Start Time</label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={e => setStartTime(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="schedule-sublabel">End Time</label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={e => setEndTime(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {isOvernight && (
                    <div className="overnight-notice">
                      <Clock size={12} />
                      <span>Overnight Schedule: active from {startTime} until {endTime} the following day.</span>
                    </div>
                  )}

                  {/* Timezone */}
                  <div className="form-group" style={{ marginTop: '8px' }}>
                    <label className="schedule-sublabel">Timezone</label>
                    <div className="timezone-select-wrap">
                      <Globe size={13} color="#64748B" />
                      <select
                        value={timezone}
                        onChange={e => setTimezone(e.target.value)}
                        className="timezone-select"
                      >
                        <option value="Asia/Kolkata">Asia/Kolkata (IST · UTC+5:30)</option>
                        <option value="UTC">UTC (Coordinated Universal Time)</option>
                        <option value="America/New_York">America/New_York (EST · UTC-5)</option>
                        <option value="Europe/London">Europe/London (GMT/BST · UTC+0)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Error Message Banner */}
            {errorMsg && (
              <div className="wizard-error-banner" style={{ marginTop: '12px' }}>
                <AlertCircle size={14} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Form Actions */}
            <div className="wizard-actions" style={{ marginTop: '16px' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleCancelForm}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="auth-spinner" style={{ width: 12, height: 12 }} />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>{formMode === 'edit' ? 'Update Safe Place' : 'Save Safe Place'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Configured Safe Places List ── */}
      <div className="safezone-list">
        {geofences.length === 0 ? (
          <div className="empty-zones-placeholder">
            <Shield size={36} color="#CBD5E1" />
            <h4>No safe places configured yet</h4>
            <p>Add Home, School, or familiar places to monitor your child&apos;s boundaries.</p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleStartCreate}
            >
              <Plus size={14} />
              <span>Add First Safe Place</span>
            </button>
          </div>
        ) : (
          geofences.map(zone => {
            const isSelected = selectedZoneId === zone.id;
            const isEnabled = zone.enabled !== false && zone.isActive !== false;
            const isNowActive = isScheduleActive(zone.schedule);

            // Proximity calculation
            const distanceKm = currentPacket?.latitude && currentPacket?.longitude
              ? computeHaversineKm(
                  currentPacket.latitude,
                  currentPacket.longitude,
                  zone.centerLatitude,
                  zone.centerLongitude
                )
              : null;

            const radiusKm = (zone.radiusMeters || 500) / 1000;
            const isInside = distanceKm != null ? distanceKm <= radiusKm : false;
            const catMeta = CATEGORIES.find(c => c.id === zone.category) || CATEGORIES[0];
            const CatIcon = catMeta.icon || MapPin;

            return (
              <div
                key={zone.id}
                className={`safezone-card ${isSelected ? 'safezone-card--selected' : ''} ${!isEnabled ? 'safezone-card--disabled' : ''}`}
                onClick={() => {
                  onSelectZone?.(zone.id);
                  onFlyToZone?.(zone.centerLatitude, zone.centerLongitude);
                }}
              >
                <div className="safezone-card-top">
                  <div className="safezone-card-title-group">
                    <div className={`zone-category-badge zone-category--${zone.category || 'home'}`}>
                      <CatIcon size={15} />
                    </div>
                    <div>
                      <h4 className="zone-name">{zone.label || zone.name}</h4>
                      <div className="zone-meta-line">
                        <span className="zone-radius-pill">{zone.radiusMeters || 500}m radius</span>
                        {zone.schedule?.mode === 'custom' ? (
                          <span className={`schedule-status-pill ${isNowActive && isEnabled ? 'is-active' : 'is-inactive'}`}>
                            <Clock size={11} />
                            <span>{isNowActive && isEnabled ? 'Active Schedule' : 'Schedule Inactive'}</span>
                          </span>
                        ) : (
                          <span className="schedule-status-pill is-active">
                            <span>All Day</span>
                          </span>
                        )}
                        {!isEnabled && (
                          <span className="disabled-pill">Disabled</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="zone-card-actions">
                    <button
                      type="button"
                      className="btn-icon-sm"
                      onClick={(e) => handleToggleEnabled(zone, e)}
                      title={isEnabled ? 'Disable Monitoring' : 'Enable Monitoring'}
                    >
                      <Power size={13} color={isEnabled ? '#059669' : '#94A3B8'} />
                    </button>
                    <button
                      type="button"
                      className="btn-icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(zone);
                      }}
                      title="Edit Safe Place"
                    >
                      <Edit2 size={13} color="#2563EB" />
                    </button>
                    <button
                      type="button"
                      className="btn-icon-sm btn-icon-sm--danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(zone.id);
                      }}
                      title="Delete Safe Place"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Proximity / Inside status */}
                <div className="safezone-proximity-row">
                  <span className={`zone-child-status ${isInside ? 'is-inside' : 'is-outside'}`}>
                    {isInside ? (
                      <>
                        <span className="status-live-dot" />
                        <strong>Child is currently inside this zone</strong>
                      </>
                    ) : distanceKm != null ? (
                      <span>{distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m away` : `${distanceKm.toFixed(1)} km away`}</span>
                    ) : (
                      <span>Awaiting device location</span>
                    )}
                  </span>
                </div>

                {/* Delete Confirmation Modal Overlay */}
                {confirmDeleteId === zone.id && (
                  <div className="zone-delete-confirm-box" onClick={e => e.stopPropagation()}>
                    <p>Delete <strong>&quot;{zone.label}&quot;</strong>? This safe place will be removed from monitoring.</p>
                    <div className="delete-confirm-actions">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Keep Zone
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(zone.id)}
                      >
                        Confirm Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
