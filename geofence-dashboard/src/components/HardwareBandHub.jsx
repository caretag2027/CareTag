import React, { useState } from 'react';
import {
  Activity,
  Compass,
  Cpu,
  Layers,
  MapPin,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Wifi,
  Copy,
  Check,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { getDeviceStatusMeta, DEVICE_STATUS } from '../utils/dashboardUtils';
import './HardwareBandHub.css';

/**
 * HardwareBandHub - Live Physical Smart Band Telemetry & Diagnostics
 * 
 * Renders real-time telemetry from the physical hardware streaming via Firebase:
 * - 3-Axis Accelerometer (x, y, z in m/s^2, pitch, roll, magnitude)
 * - 3-Axis Gyroscope (x, y, z in dps, rotation rate)
 * - GPS Status (Lock validity, satellites, accuracy, lat/lon)
 * - Fall Detection Safety Monitor
 * - Hardware Uptime & Network Diagnostics
 */
export default function HardwareBandHub({
  packet,
  status,
  isLiveMode,
  onToggleMode,
  onRefresh,
}) {
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const hw = packet?.isHardware ? packet : null;
  const deviceStatus = status?.deviceStatus || (status?.isHardwareStreaming && !status?.isStale ? DEVICE_STATUS.LIVE : DEVICE_STATUS.OFFLINE);
  const statusMeta = getDeviceStatusMeta(deviceStatus, status?.ageSeconds);
  const hasGpsFix = hw?.gps?.valid;

  const accel = hw?.accelerometer || { x_ms2: 0, y_ms2: 0, z_ms2: -9.81, magnitude: 9.81 };
  const gyro = hw?.gyroscope || { x_dps: 0, y_dps: 0, z_dps: 0, magnitude: 0 };
  const isFall = Boolean(hw?.isFall);

  const handleCopyCoords = () => {
    if (!packet) return;
    const text = `${packet.latitude?.toFixed(6)}, ${packet.longitude?.toFixed(6)}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefreshClick = async () => {
    setRefreshing(true);
    if (onRefresh) await onRefresh();
    setTimeout(() => setRefreshing(false), 800);
  };

  // Helper to calculate percentage fill for visual bars (-20 to +20 m/s^2 for accel)
  const getAccelFill = (val) => {
    const clamped = Math.max(-20, Math.min(20, val || 0));
    return ((clamped + 20) / 40) * 100;
  };

  // Helper to calculate percentage fill for visual bars (-150 to +150 dps for gyro)
  const getGyroFill = (val) => {
    const clamped = Math.max(-150, Math.min(150, val || 0));
    return ((clamped + 150) / 300) * 100;
  };

  return (
    <div className={`hw-hub-container ${isFall ? 'hw-hub--alert' : ''}`}>
      {/* ── Header ── */}
      <div className="hw-hub-header">
        <div className="hw-hub-title-row">
          <div className="hw-hub-title">
            <Cpu size={16} className="hw-hub-icon" />
            <span>Smart Band Hardware</span>
          </div>
          <div className="hw-hub-actions">
            <button
              type="button"
              className={`hw-refresh-btn ${refreshing ? 'is-spinning' : ''}`}
              onClick={handleRefreshClick}
              title="Refresh Firebase Connection"
            >
              <RefreshCw size={13} />
            </button>
            <span className={`hw-status-pill ${statusMeta.pillClass}`}>
              <span className="hw-pulse-dot" />
              {statusMeta.label}
            </span>
          </div>
        </div>
        <div className="hw-hub-subtitle">
          Firebase RTDB: {status?.transportStatus === 'connected' ? 'Connected' : 'Connecting'} · Node: <code className="hw-node-tag">/sensorData</code>
        </div>
        <div className="hw-update-freshness">
          <span>
            <Clock size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 4 }} />
            Last device update: <strong>{status?.formattedAge || 'No active heartbeat'}</strong>
          </span>
          <span>{statusMeta.description}</span>
        </div>
      </div>

      {/* ── Fall Alert Banner (if impact/free-fall detected) ── */}
      {isFall && (
        <div className="hw-fall-banner" role="alert">
          <ShieldAlert size={18} />
          <div>
            <strong>High-Impact Motion Flagged!</strong>
            <p>Significant acceleration spike detected ({accel.magnitude.toFixed(1)} m/s²). Check user status.</p>
          </div>
        </div>
      )}

      {/* ── Mode Switcher Bar ── */}
      <div className="hw-mode-switcher">
        <button
          type="button"
          className={`hw-mode-tab ${isLiveMode ? 'active' : ''}`}
          onClick={() => !isLiveMode && onToggleMode && onToggleMode(true)}
        >
          <Radio size={13} /> Live Hardware Band
        </button>
        <button
          type="button"
          className={`hw-mode-tab ${!isLiveMode ? 'active' : ''}`}
          onClick={() => isLiveMode && onToggleMode && onToggleMode(false)}
        >
          <Activity size={13} /> Virtual Simulation
        </button>
      </div>

      {/* ── GPS Subsystem Card ── */}
      <div className="hw-subsystem-card">
        <div className="hw-subsystem-header">
          <span className="hw-subsystem-label">
            <MapPin size={13} /> GPS Fix & Positioning
          </span>
          <span className={`hw-gps-badge ${hasGpsFix ? 'hw-gps-badge--locked' : 'hw-gps-badge--searching'}`}>
            {hasGpsFix ? <Wifi size={11} /> : <AlertTriangle size={11} />}
            {hasGpsFix ? 'Locked' : 'Indoors / No Fix'}
          </span>
        </div>

        <div className="hw-gps-data-row">
          <div className="hw-gps-coord-box">
            <span className="hw-label">Latitude, Longitude</span>
            <div className="hw-coord-val">
              <span>{packet?.latitude != null ? `${packet.latitude.toFixed(6)}, ${packet.longitude.toFixed(6)}` : 'Awaiting fix...'}</span>
              <button
                type="button"
                className="hw-copy-btn"
                onClick={handleCopyCoords}
                title="Copy coordinates"
              >
                {copied ? <Check size={12} color="var(--ct-teal)" /> : <Copy size={12} />}
              </button>
            </div>
          </div>
          <div className="hw-gps-stat">
            <span className="hw-label">Satellites</span>
            <span className="hw-val">{hw?.gps?.satellites ?? 0}</span>
          </div>
        </div>

        {!hasGpsFix && (
          <div className="hw-gps-notice">
            <AlertTriangle size={12} />
            <span>GPS signal weak indoors. Map is holding at last known campus coordinate without drifting.</span>
          </div>
        )}
      </div>

      {/* ── 3-Axis Accelerometer Hub ── */}
      <div className="hw-subsystem-card">
        <div className="hw-subsystem-header">
          <span className="hw-subsystem-label">
            <Layers size={13} /> Accelerometer (m/s²)
          </span>
          <span className="hw-magnitude-badge" title="Total resultant acceleration">
            |a| {accel.magnitude.toFixed(2)} m/s²
          </span>
        </div>

        <div className="hw-axis-grid">
          <div className="hw-axis-row">
            <span className="hw-axis-tag axis-x">X</span>
            <div className="hw-bar-track">
              <div
                className="hw-bar-fill bar-x"
                style={{ width: `${getAccelFill(accel.x_ms2)}%` }}
              />
            </div>
            <span className="hw-axis-val">{accel.x_ms2.toFixed(3)}</span>
          </div>

          <div className="hw-axis-row">
            <span className="hw-axis-tag axis-y">Y</span>
            <div className="hw-bar-track">
              <div
                className="hw-bar-fill bar-y"
                style={{ width: `${getAccelFill(accel.y_ms2)}%` }}
              />
            </div>
            <span className="hw-axis-val">{accel.y_ms2.toFixed(3)}</span>
          </div>

          <div className="hw-axis-row">
            <span className="hw-axis-tag axis-z">Z</span>
            <div className="hw-bar-track">
              <div
                className="hw-bar-fill bar-z"
                style={{ width: `${getAccelFill(accel.z_ms2)}%` }}
              />
            </div>
            <span className="hw-axis-val">{accel.z_ms2.toFixed(3)}</span>
          </div>
        </div>

        <div className="hw-orientation-row">
          <span>Pitch: <strong>{accel.pitch ?? 0}°</strong></span>
          <span>Roll: <strong>{accel.roll ?? 0}°</strong></span>
          <span>Earth g: <strong>9.81 m/s²</strong></span>
        </div>
      </div>

      {/* ── 3-Axis Gyroscope Hub ── */}
      <div className="hw-subsystem-card">
        <div className="hw-subsystem-header">
          <span className="hw-subsystem-label">
            <Compass size={13} /> Gyroscope (°/s)
          </span>
          <span className="hw-magnitude-badge" title="Net angular velocity">
            |ω| {gyro.magnitude.toFixed(2)} °/s
          </span>
        </div>

        <div className="hw-axis-grid">
          <div className="hw-axis-row">
            <span className="hw-axis-tag axis-gx">Gx</span>
            <div className="hw-bar-track">
              <div
                className="hw-bar-fill bar-gx"
                style={{ width: `${getGyroFill(gyro.x_dps)}%` }}
              />
            </div>
            <span className="hw-axis-val">{gyro.x_dps.toFixed(2)}</span>
          </div>

          <div className="hw-axis-row">
            <span className="hw-axis-tag axis-gy">Gy</span>
            <div className="hw-bar-track">
              <div
                className="hw-bar-fill bar-gy"
                style={{ width: `${getGyroFill(gyro.y_dps)}%` }}
              />
            </div>
            <span className="hw-axis-val">{gyro.y_dps.toFixed(2)}</span>
          </div>

          <div className="hw-axis-row">
            <span className="hw-axis-tag axis-gz">Gz</span>
            <div className="hw-bar-track">
              <div
                className="hw-bar-fill bar-gz"
                style={{ width: `${getGyroFill(gyro.z_dps)}%` }}
              />
            </div>
            <span className="hw-axis-val">{gyro.z_dps.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* ── Hardware Diagnostics Footer ── */}
      <div className="hw-diag-footer">
        <div className="hw-diag-item">
          <span className="hw-diag-label">Device Status</span>
          <span className={`hw-diag-val ${statusMeta.isLive ? 'text-teal' : statusMeta.isStale ? 'text-warning' : 'text-danger'}`}>
            {statusMeta.label.toUpperCase()}
          </span>
        </div>
        <div className="hw-diag-item">
          <span className="hw-diag-label">Motion State</span>
          <span className={`hw-diag-val ${isFall ? 'text-danger' : ''}`}>
            {hw?.motionState ? hw.motionState.toUpperCase() : 'STATIONARY'}
          </span>
        </div>
        <div className="hw-diag-item">
          <span className="hw-diag-label">Hardware Uptime</span>
          <span className="hw-diag-val">{hw?.uptimeFormatted || '00:00:00'}</span>
        </div>
        <div className="hw-diag-item">
          <span className="hw-diag-label">Fall Guard</span>
          <span className="hw-diag-val text-teal">
            <ShieldCheck size={12} style={{ display: 'inline', verticalAlign: '-1px' }} /> ARMED
          </span>
        </div>
      </div>
    </div>
  );
}
