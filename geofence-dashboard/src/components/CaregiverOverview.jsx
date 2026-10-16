import React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Battery,
  BatteryLow,
  MapPin,
  Compass,
  CheckCircle,
  Plus,
  ArrowRight,
  Wifi,
  Radio,
  Check
} from 'lucide-react';
import {
  formatLocationFreshness,
  evaluateSafetyState,
  getDeviceStatusMeta,
  DEVICE_STATUS
} from '../utils/dashboardUtils';

/**
 * CaregiverOverview - Clean, Calm, Non-Technical Guardian Workspace
 * 
 * Directly answers the 4 essential caregiver questions:
 * 1. Where is the child right now?
 * 2. Are they in a safe place?
 * 3. Is the smart band connected and charged?
 * 4. Does anything require my attention?
 */
export default function CaregiverOverview({
  packet,
  geofences = [],
  alerts = [],
  hardwareStatus,
  simRunning,
  isLiveHardwareMode,
  onRecenterMap,
  onAcknowledgeAlert,
  onOpenSafeZones,
  onOpenTechInspector,
}) {
  const safety = evaluateSafetyState(packet, geofences);
  const freshness = formatLocationFreshness(packet?.timestamp || packet?.capturedAtUtc);

  const batteryLevel = packet?.batteryPercent != null ? Number(packet.batteryPercent) : 92;
  const isBatteryLow = batteryLevel < 20;

  // Active unacknowledged safety alerts (only boundary breach & route deviation)
  const activeAlerts = alerts.filter(a => !a.acknowledged && (a.type === 'boundary_breach' || a.type === 'route_deviation' || a.type === 'breach' || a.type === 'out_of_zone' || a.type === 'anomaly'));
  const topActiveAlert = activeAlerts[0] || null;

  const isConnectionLost = safety.status === 'connection_lost' || (!simRunning && hardwareStatus?.deviceStatus === DEVICE_STATUS.OFFLINE);

  return (
    <div className="caregiver-overview">
      {/* ── QUESTION 2: Are they in a safe place? ── */}
      <div className={`caregiver-safety-banner ${
        isConnectionLost
          ? 'banner--connection-lost'
          : safety.status === 'outside' || safety.status === 'breach'
          ? 'banner--outside'
          : safety.status === 'deviation'
          ? 'banner--deviation'
          : 'banner--safe'
      }`}>
        <div className="safety-banner-icon-box">
          {isConnectionLost ? (
            <AlertTriangle size={26} className="banner-icon-lost" />
          ) : safety.status === 'outside' || safety.status === 'breach' ? (
            <ShieldAlert size={26} className="banner-icon-outside" />
          ) : safety.status === 'deviation' ? (
            <AlertTriangle size={26} className="banner-icon-deviation" />
          ) : (
            <ShieldCheck size={26} className="banner-icon-safe" />
          )}
        </div>

        <div className="safety-banner-text">
          <div className="safety-banner-tag-row">
            <span className="safety-kicker">Current Safety Status</span>
            <span className={`status-pill ${
              isConnectionLost
                ? 'pill--lost'
                : safety.status === 'outside' || safety.status === 'breach'
                ? 'pill--outside'
                : safety.status === 'deviation'
                ? 'pill--deviation'
                : 'pill--safe'
            }`}>
              {isConnectionLost
                ? 'Connection Lost'
                : safety.status === 'outside' || safety.status === 'breach'
                ? 'Outside Safe Place'
                : safety.status === 'deviation'
                ? 'Route Deviation'
                : 'Safe'}
            </span>
          </div>

          <h3 className="safety-main-title">
            {isConnectionLost
              ? 'Smart band connection lost'
              : safety.status === 'outside' || safety.status === 'breach'
              ? `Outside safe places (${safety.distanceToBoundaryKm} km from "${safety.nearestZone}")`
              : safety.status === 'deviation'
              ? 'Child has taken an unusual route'
              : safety.insideZone
              ? `Safe inside "${safety.insideZone}"`
              : 'Inside configured safe place'}
          </h3>

          <p className="safety-explanation-text">
            {isConnectionLost
              ? 'The smart band has stopped updating. Last location is retained on the map.'
              : safety.explanation}
          </p>
        </div>
      </div>

      {/* ── QUESTION 4: Does anything require my attention? ── */}
      {topActiveAlert ? (
        <div className="caregiver-attention-card attention-active">
          <div className="attention-header">
            <div className="attention-title-group">
              <AlertTriangle size={16} color="#DC2626" />
              <h4>Action Required: {topActiveAlert.type === 'boundary_breach' ? 'Boundary Breach' : 'Route Deviation'}</h4>
            </div>
            <span className="attention-time">{freshness.text}</span>
          </div>
          <p className="attention-desc">{topActiveAlert.message}</p>
          <div className="attention-actions">
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={onRecenterMap}
            >
              <Compass size={13} />
              <span>Show on Map</span>
            </button>
            {onAcknowledgeAlert && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => onAcknowledgeAlert(topActiveAlert.id)}
              >
                <Check size={13} />
                <span>Acknowledge Alert</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="caregiver-attention-card attention-calm">
          <CheckCircle size={16} color="#059669" />
          <span>All Clear — No active safety alerts or boundary notices requiring attention.</span>
        </div>
      )}

      {/* ── QUESTION 1: Where is the child right now? ── */}
      <div className="caregiver-card">
        <div className="caregiver-card-header">
          <div className="caregiver-card-title-row">
            <div className="caregiver-card-icon location-icon">
              <MapPin size={16} />
            </div>
            <div>
              <h4 className="caregiver-card-title">Where is the child right now?</h4>
              <p className="caregiver-card-subtitle">Live device location context</p>
            </div>
          </div>
          <div className={`freshness-badge freshness-badge--${freshness.status}`}>
            <span className="freshness-dot" />
            <span>{freshness.text}</span>
          </div>
        </div>

        <div className="location-details-box">
          <div className="location-main-text">
            <span className="location-place-name">
              {safety.insideZone ? safety.insideZone : safety.nearestZone ? `Near ${safety.nearestZone}` : 'Thapar Campus Area'}
            </span>
            <span className="location-geo-context">
              {safety.insideZone
                ? 'Inside protected perimeter'
                : safety.distanceToBoundaryKm > 0
                ? `${safety.distanceToBoundaryKm} km outside "${safety.nearestZone}"`
                : 'Inside configured radius'}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm recenter-btn"
            onClick={onRecenterMap}
            title="Recenter map on child location"
          >
            <Compass size={14} />
            <span>Recenter Map</span>
          </button>
        </div>
      </div>

      {/* ── QUESTION 3: Is the smart band connected and charged? ── */}
      <div className="caregiver-card">
        <div className="caregiver-card-header">
          <div className="caregiver-card-title-row">
            <div className="caregiver-card-icon device-icon">
              <Radio size={16} />
            </div>
            <div>
              <h4 className="caregiver-card-title">Is the smart band connected & charged?</h4>
              <p className="caregiver-card-subtitle">Physical Smart Band health</p>
            </div>
          </div>
          <span className={`battery-pill ${isBatteryLow ? 'battery-pill--low' : 'battery-pill--good'}`}>
            {isBatteryLow ? <BatteryLow size={14} /> : <Battery size={14} />}
            <span>{batteryLevel}% Charged</span>
          </span>
        </div>

        <div className="device-health-grid">
          <div className="health-grid-item">
            <span className="health-label">Battery Level</span>
            <div className="health-battery-bar">
              <div
                className={`battery-fill ${isBatteryLow ? 'fill-low' : 'fill-good'}`}
                style={{ width: `${Math.min(100, Math.max(5, batteryLevel))}%` }}
              />
            </div>
            <span className="health-sub">
              {isBatteryLow ? '⚠️ Charging recommended' : 'Nominal (~18h remaining)'}
            </span>
          </div>

          <div className="health-grid-item">
            <span className="health-label">Connection Status</span>
            <div className="health-val-row">
              <span className="connection-status-indicator">
                {simRunning ? (
                  <>
                    <Radio size={13} color="#2563EB" />
                    <strong>Simulation Active</strong>
                  </>
                ) : (() => {
                  const devMeta = getDeviceStatusMeta(hardwareStatus?.deviceStatus, hardwareStatus?.ageSeconds);
                  if (devMeta.isLive) {
                    return (
                      <>
                        <span className="status-live-dot" />
                        <strong style={{ color: '#059669' }}>Connected & Active</strong>
                      </>
                    );
                  }
                  if (devMeta.isStale) {
                    return (
                      <>
                        <AlertTriangle size={13} color="#D97706" />
                        <strong style={{ color: '#D97706' }}>Signal Delayed</strong>
                      </>
                    );
                  }
                  return (
                    <>
                      <Wifi size={13} color="#94A3B8" />
                      <strong style={{ color: '#64748B' }}>Band Offline</strong>
                    </>
                  );
                })()}
              </span>
            </div>
            <span className="health-sub">
              {freshness.text}
            </span>
          </div>
        </div>
      </div>

      {/* ── Configured Safe Places Quick Overview ── */}
      <div className="caregiver-card">
        <div className="caregiver-card-header">
          <div className="caregiver-card-title-row">
            <div className="caregiver-card-icon zone-summary-icon">
              <MapPin size={16} />
            </div>
            <div>
              <h4 className="caregiver-card-title">Configured Safe Places ({geofences.length})</h4>
              <p className="caregiver-card-subtitle">Active perimeters monitored by CareTag</p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onOpenSafeZones}
          >
            <span>Manage Places</span>
            <ArrowRight size={13} />
          </button>
        </div>

        <div className="caregiver-safeplaces-list">
          {geofences.length === 0 ? (
            <div className="places-empty-row">
              <span>No safe places configured yet.</span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={onOpenSafeZones}
              >
                <Plus size={13} />
                <span>Add Safe Place</span>
              </button>
            </div>
          ) : (
            geofences.slice(0, 4).map(zone => (
              <div key={zone.id} className="place-item-row" onClick={onOpenSafeZones}>
                <div className="place-item-name-group">
                  <span className="place-dot" />
                  <strong>{zone.label || zone.name}</strong>
                  <span className="place-radius-tag">{zone.radiusMeters || 500}m</span>
                </div>
                <span className="place-schedule-tag">
                  {zone.schedule?.mode === 'custom' ? 'Custom Schedule' : '24/7 All Day'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
