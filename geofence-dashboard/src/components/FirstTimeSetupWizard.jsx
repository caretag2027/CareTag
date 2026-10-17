import React, { useState } from 'react';
import {
  ShieldCheck,
  MapPin,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Home,
  GraduationCap,
  Trees,
  Briefcase,
  Users,
  Clock,
  Globe,
  Radio,
  Battery,
  Check,
  X
} from 'lucide-react';
import { getDeviceStatusMeta } from '../utils/dashboardUtils';

const CATEGORIES = [
  { id: 'home', label: 'Home', icon: Home, defaultRadius: 400 },
  { id: 'school', label: 'School', icon: GraduationCap, defaultRadius: 500 },
  { id: 'park', label: 'Park', icon: Trees, defaultRadius: 350 },
  { id: 'work', label: 'Work', icon: Briefcase, defaultRadius: 450 },
  { id: 'relative', label: "Relative", icon: Users, defaultRadius: 400 },
  { id: 'custom', label: 'Custom', icon: MapPin, defaultRadius: 500 },
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

export default function FirstTimeSetupWizard({
  geofences = [],
  onSaveGeofence,
  onCompleteSetup,
  currentPacket,
  hardwareStatus,
  onDismiss,
  onFlyToZone,
}) {
  const [step, setStep] = useState(1);

  // Safe Place fields
  const [category, setCategory] = useState('home');
  const [label, setLabel] = useState('Home (Residence)');
  const [lat, setLat] = useState(currentPacket?.latitude ? currentPacket.latitude.toFixed(6) : '30.349100');
  const [lng, setLng] = useState(currentPacket?.longitude ? currentPacket.longitude.toFixed(6) : '76.411700');
  const [radiusMeters, setRadiusMeters] = useState(400);

  // Schedule fields
  const [scheduleMode, setScheduleMode] = useState('all_day'); // 'all_day' | 'custom'
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');
  const [selectedDays, setSelectedDays] = useState(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
  const [timezone, setTimezone] = useState('Asia/Kolkata');

  const [saving, setSaving] = useState(false);
  const [savedZone, setSavedZone] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const selectCategory = (catId) => {
    setCategory(catId);
    const cat = CATEGORIES.find(c => c.id === catId);
    if (catId === 'home') setLabel('Home (Residence)');
    else if (catId === 'school') setLabel('School Campus');
    else if (catId === 'park') setLabel('Neighborhood Park');
    else if (catId === 'work') setLabel("Parent's Workplace");
    else if (catId === 'relative') setLabel("Grandparents' Home");
    else setLabel('My Safe Place');
    if (cat) setRadiusMeters(cat.defaultRadius);
  };

  const toggleDay = (dayKey) => {
    setSelectedDays(prev =>
      prev.includes(dayKey)
        ? (prev.length > 1 ? prev.filter(d => d !== dayKey) : prev)
        : [...prev, dayKey]
    );
  };

  const handleSaveAndProceed = async (e) => {
    if (e) e.preventDefault();
    const cleanLabel = label.trim();
    if (!cleanLabel) {
      setErrorMsg('Please name this safe place.');
      return;
    }
    const nLat = parseFloat(lat);
    const nLng = parseFloat(lng);
    if (isNaN(nLat) || nLat < -90 || nLat > 90 || isNaN(nLng) || nLng < -180 || nLng > 180) {
      setErrorMsg('Valid geographic coordinates are required.');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    const zonePayload = {
      label: cleanLabel,
      name: cleanLabel,
      category,
      centerLatitude: nLat,
      centerLongitude: nLng,
      radiusMeters: Number(radiusMeters),
      enabled: true,
      isActive: true,
      schedule: {
        mode: scheduleMode,
        startTime,
        endTime,
        days: selectedDays,
        timezone,
        enabled: true,
      },
    };

    try {
      const res = await onSaveGeofence(zonePayload);
      if (res !== false) {
        setSavedZone(res?.data || zonePayload);
        onFlyToZone?.(nLat, nLng);
        setStep(4); // Move to Review & Confirm
      } else {
        setErrorMsg('Failed to save safe place to database. Your entries have been preserved — please try again.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Network error occurred while saving safe place.');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalConfirm = () => {
    if (onCompleteSetup) {
      onCompleteSetup();
    }
  };

  const devMeta = getDeviceStatusMeta(hardwareStatus?.deviceStatus, hardwareStatus?.ageSeconds);
  const isOvernight = scheduleMode === 'custom' && startTime > endTime;

  return (
    <div className="setup-wizard-backdrop" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
      <div className="setup-wizard-card">
        {/* Top Header */}
        <div className="wizard-top-nav">
          <span className="wizard-top-tag">CareTag Guided Setup</span>
          {onDismiss && (
            <button
              type="button"
              className="wizard-close-btn"
              onClick={onDismiss}
              aria-label="Close Setup Guide"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* 4-Step Stepper Header */}
        <div className="wizard-stepper" role="navigation" aria-label="Setup Steps">
          {[
            { num: 1, label: '1. Smart Band' },
            { num: 2, label: '2. Safe Place' },
            { num: 3, label: '3. Schedule' },
            { num: 4, label: '4. Confirm' },
          ].map(item => {
            const isCompleted = step > item.num;
            const isCurrent = step === item.num;
            return (
              <React.Fragment key={item.num}>
                <div className={`wizard-stepper-node ${isCurrent ? 'is-current' : ''} ${isCompleted ? 'is-completed' : ''}`}>
                  <div className="wizard-stepper-circle">
                    {isCompleted ? <Check size={12} /> : item.num}
                  </div>
                  <span className="wizard-stepper-label">{item.label}</span>
                </div>
                {item.num < 4 && (
                  <div className={`wizard-stepper-line ${isCompleted ? 'is-active' : ''}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* ── STEP 1: Connect or verify smart band ── */}
        {step === 1 && (
          <div className="wizard-step-content">
            <div className="wizard-step-header">
              <h3 id="wizard-title">Connect & Verify Smart Band</h3>
              <p>Checking live telemetry synchronization from the wearable smart band.</p>
            </div>

            <div className="wizard-status-card">
              <div className="wizard-status-item">
                <span className="wizard-status-label">Device Status</span>
                <div className="wizard-status-value">
                  <span className={`status-dot ${devMeta.isLive ? 'status-dot--green' : devMeta.isStale ? 'status-dot--amber' : 'status-dot--red'}`} />
                  <strong>{devMeta.label} ({devMeta.description})</strong>
                </div>
              </div>

              <div className="wizard-status-item">
                <span className="wizard-status-label">Hardware Battery</span>
                <div className="wizard-status-value">
                  <Battery size={14} color="#059669" />
                  <span>{currentPacket?.batteryPercent ?? 92}% Charged</span>
                </div>
              </div>

              <div className="wizard-status-item">
                <span className="wizard-status-label">GPS Coordinate Lock</span>
                <div className="wizard-status-value">
                  <Radio size={14} color="#2563EB" />
                  <span>
                    {currentPacket?.latitude && currentPacket?.longitude
                      ? `${currentPacket.latitude.toFixed(4)}° N, ${currentPacket.longitude.toFixed(4)}° E`
                      : 'Thapar Campus Default Anchor'}
                  </span>
                </div>
              </div>
            </div>

            <div className="wizard-actions">
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => setStep(2)}
              >
                <span>Continue to Add Safe Place</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Add first safe place ── */}
        {step === 2 && (
          <div className="wizard-step-content">
            <div className="wizard-step-header">
              <h3>Add Your First Safe Place</h3>
              <p>Choose a category and define the boundary coordinates and coverage radius.</p>
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
                    onClick={() => selectCategory(cat.id)}
                  >
                    <IconComponent size={13} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="form-group">
              <label>Place Name</label>
              <input
                type="text"
                placeholder="e.g. Home, School, Park"
                value={label}
                onChange={e => setLabel(e.target.value)}
                required
              />
            </div>

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
              <div className="radius-presets" role="group">
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

            <div className="wizard-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setStep(1)}
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep(3)}
              >
                <span>Continue to Schedule</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Choose when that place should be monitored ── */}
        {step === 3 && (
          <div className="wizard-step-content">
            <div className="wizard-step-header">
              <h3>Monitoring Schedule</h3>
              <p>Choose when boundary monitoring should be active for this safe place.</p>
            </div>

            <div className="schedule-config-section">
              <div className="schedule-header-row">
                <div className="schedule-title-wrap">
                  <Clock size={14} color="#2563EB" />
                  <strong>Monitoring Window</strong>
                </div>
                <div className="schedule-mode-toggle">
                  <button
                    type="button"
                    className={`mode-toggle-btn ${scheduleMode === 'all_day' ? 'is-active' : ''}`}
                    onClick={() => setScheduleMode('all_day')}
                  >
                    All Day (24/7)
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
                  <div className="schedule-days-group">
                    <label className="schedule-sublabel">Monitored Days</label>
                    <div className="day-chips-row">
                      {DAYS_OF_WEEK.map(d => {
                        const isSelected = selectedDays.includes(d.key);
                        return (
                          <button
                            key={d.key}
                            type="button"
                            className={`day-chip ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => toggleDay(d.key)}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

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
                      <span>Overnight Schedule: Active from {startTime} to {endTime} the next morning.</span>
                    </div>
                  )}

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

            {errorMsg && (
              <div className="wizard-error-banner" style={{ marginTop: '12px' }}>
                <AlertCircle size={14} />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="wizard-actions" style={{ marginTop: '16px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setStep(2)}
                disabled={saving}
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveAndProceed}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="auth-spinner" style={{ width: 12, height: 12 }} />
                    <span>Saving to Firebase...</span>
                  </>
                ) : (
                  <>
                    <span>Save & Review Map</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Review map and confirm configuration ── */}
        {step === 4 && (
          <div className="wizard-step-content">
            <div className="wizard-step-header">
              <h3>Setup Complete! Review & Confirm</h3>
              <p>Your safe place is configured and active. Confirm to open the dashboard.</p>
            </div>

            <div className="wizard-summary-card">
              <div className="summary-card-header">
                <ShieldCheck size={20} color="#0D9488" />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong>{savedZone?.label || label}</strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    {hardwareStatus?.deviceStatus === 'live' ? 'Setup Saved · Monitoring Ready' : 'Setup Saved · Awaiting Wearable Data'}
                  </span>
                </div>
              </div>
              <div className="summary-card-details">
                <div className="summary-detail-row">
                  <span>Coverage Perimeter:</span>
                  <strong>{savedZone?.radiusMeters || radiusMeters}m radius</strong>
                </div>
                <div className="summary-detail-row">
                  <span>Schedule:</span>
                  <strong>
                    {scheduleMode === 'all_day'
                      ? 'Monitored 24/7 (All Day)'
                      : `${startTime} – ${endTime} (${selectedDays.map(d => d.toUpperCase()).join(', ')})`}
                  </strong>
                </div>
                <div className="summary-detail-row">
                  <span>Device Linked:</span>
                  <span className="text-success font-bold">CARE-TAG-01 · ESP32 Verified</span>
                </div>
                <div className="summary-detail-row">
                  <span>Live Telemetry:</span>
                  <span className={hardwareStatus?.deviceStatus === 'live' ? 'text-success font-bold' : 'text-warning font-bold'}>
                    {hardwareStatus?.deviceStatus === 'live' ? 'Streaming Live' : 'Awaiting Device Ping'}
                  </span>
                </div>
                <div className="summary-detail-row">
                  <span>Routine Learning:</span>
                  <span className="text-teal font-bold">Adaptive · Awaiting Initial 3 Journeys</span>
                </div>
              </div>
            </div>

            <div className="wizard-actions">
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={handleFinalConfirm}
              >
                <Check size={15} />
                <span>Launch Caregiver Dashboard</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
