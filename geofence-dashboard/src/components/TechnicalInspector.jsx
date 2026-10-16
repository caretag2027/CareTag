import React, { useState, useEffect, useCallback } from 'react';
import {
  Terminal,
  Cpu,
  Layers,
  Activity,
  Play,
  RotateCcw,
  RefreshCw,
  Copy,
  Check,
  Database,
  FileCode,
  Zap,
  Sliders,
  CheckCircle,
  XCircle,
  X
} from 'lucide-react';
import {
  computeHaversineKm,
  STATUS_THRESHOLDS,
  isScheduleActive
} from '../utils/dashboardUtils';
import { SCENARIO_PRESETS, SCENARIO_METADATA } from '../simulation';
import { diagnoseFirebaseOperations } from '../firebase';
import { computeRoutineProfile } from '../utils/routineModel';

export default function TechnicalInspector({
  packet,
  geofences = [],
  hardwareStatus,
  simRunning,
  activeScenario,
  onStartScenario,
  onStopScenario,
  onResetScenario,
  onManualSimulate,
  routineHistory = {},
  routineProfile,
  onClose,
  evaluationLog = [],
  telemetryHistory = [],
}) {
  const [activeTab, setActiveTab] = useState('telemetry'); // 'telemetry' | 'geofence' | 'routine' | 'scenarios' | 'diagnostics'
  const [copied, setCopied] = useState(false);

  // Manual scenario form
  const [manualLat, setManualLat] = useState('30.3600');
  const [manualLon, setManualLon] = useState('76.4250');
  const [manualSpeed, setManualSpeed] = useState('4.5');

  // Diagnostics state
  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false);
  const [diagResults, setDiagResults] = useState(null);

  const isRealHardware = packet?.isHardware && !simRunning && packet?.source !== 'simulation';

  const handleCopyJson = () => {
    const jsonStr = JSON.stringify(packet || {}, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunDiagnostics = useCallback(async () => {
    setDiagnosticsRunning(true);
    try {
      const res = await diagnoseFirebaseOperations();
      setDiagResults(res);
    } catch (err) {
      console.error(err);
    } finally {
      setDiagnosticsRunning(false);
    }
  }, []);

  // Run diagnostics once on mount if empty
  useEffect(() => {
    if (!diagResults && activeTab === 'diagnostics') {
      handleRunDiagnostics();
    }
  }, [activeTab, diagResults, handleRunDiagnostics]);

  // Compute live per-device routine profile from actual daily history
  const derivedProfile = routineProfile || computeRoutineProfile(packet?.deviceKey || 'CARE-TAG-01', routineHistory, geofences);

  // Geofence calculations
  const geofenceCalculations = geofences.map(g => {
    const d = computeHaversineKm(
      packet?.latitude,
      packet?.longitude,
      g.centerLatitude,
      g.centerLongitude
    );
    const radiusMeters = g.radiusMeters || 500;
    const distanceMeters = d != null ? Math.round(d * 1000) : null;
    const isInside = d != null ? (distanceMeters <= radiusMeters + STATUS_THRESHOLDS.BOUNDARY_JITTER_TOLERANCE_METERS) : false;
    const marginMeters = distanceMeters != null ? (distanceMeters - radiusMeters) : 0;
    const scheduleActive = isScheduleActive(g.schedule);

    let eventDecision = 'None';
    let decisionReason = 'Inside active safe place';

    if (!isInside) {
      if (scheduleActive && g.enabled !== false) {
        eventDecision = 'boundary_breach';
        decisionReason = `Device exceeded boundary by ${marginMeters}m during active schedule`;
      } else {
        eventDecision = 'None (Inactive)';
        decisionReason = 'Outside boundary, but zone schedule is inactive or disabled';
      }
    } else if (Number(packet?.deviationScore) > 0.65) {
      eventDecision = 'route_deviation';
      decisionReason = 'Inside safe place, but path deviated from learned corridor';
    }

    return {
      id: g.id,
      label: g.label || g.name,
      centerLat: g.centerLatitude,
      centerLng: g.centerLongitude,
      radiusMeters,
      distanceKm: d,
      distanceMeters,
      isInside,
      marginMeters,
      scheduleActive,
      eventDecision,
      decisionReason,
    };
  });

  return (
    <div className="tech-inspector-drawer">
      {/* Top Header */}
      <div className="tech-inspector-header">
        <div className="tech-header-title">
          <Terminal size={18} className="tech-terminal-icon" />
          <div>
            <h3>Technical Inspector &amp; Capstone Console</h3>
            <p>Engineering evaluation console for live telemetry, geofencing math, and routine models</p>
          </div>
        </div>
        <div className="tech-header-actions">
          {/* Mode Indicator */}
          <div className={`tech-mode-pill ${isRealHardware ? 'pill--hardware' : 'pill--sim'}`}>
            <span className="tech-mode-dot" />
            <span>{isRealHardware ? 'Live Hardware (Physical ESP32)' : 'Demo Simulation Mode'}</span>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm tech-copy-btn"
            onClick={handleCopyJson}
            title="Copy raw telemetry JSON"
          >
            {copied ? <Check size={13} color="#059669" /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy JSON'}</span>
          </button>
          {onClose && (
            <button
              type="button"
              className="tech-close-btn"
              onClick={onClose}
              aria-label="Close Inspector"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Accessible Tab Navigation */}
      <div className="tech-tabs-bar" role="tablist">
        {[
          { id: 'telemetry', label: 'Raw Telemetry', icon: Cpu },
          { id: 'geofence', label: 'Geofence Engine', icon: Layers },
          { id: 'routine', label: 'Routine Model', icon: Activity },
          { id: 'scenarios', label: 'Scenarios', icon: Zap },
          { id: 'diagnostics', label: 'Firebase & Diagnostics', icon: Database },
        ].map(tab => {
          const IconComp = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`tech-tab ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <IconComp size={13} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="tech-tab-content">
        {/* ── TAB 1: Raw Telemetry ── */}
        {activeTab === 'telemetry' && (
          <div className="tech-panel">
            <div className="tech-source-notice">
              <strong>Data Source:</strong> {packet?.source === 'hardware_firebase' ? 'Genuine ESP32 Hardware via Firebase RTDB (/sensorData)' : 'Demonstration Scenario Stream'}
              {' · '}
              <strong>Device ID:</strong> <code>{packet?.deviceKey || 'SMART-BAND-01'}</code>
            </div>

            <div className="tech-grid-2">
              <div className="tech-card">
                <h4>GPS Coordinate Fix &amp; Accuracy</h4>
                <table className="tech-table">
                  <tbody>
                    <tr>
                      <td>Latitude:</td>
                      <td><code>{packet?.latitude != null ? packet.latitude.toFixed(7) : 'Unavailable'}</code></td>
                    </tr>
                    <tr>
                      <td>Longitude:</td>
                      <td><code>{packet?.longitude != null ? packet.longitude.toFixed(7) : 'Unavailable'}</code></td>
                    </tr>
                    <tr>
                      <td>Fix Validity:</td>
                      <td>
                        {packet?.gps?.valid ? (
                          <span className="text-success font-bold">Valid GPS Fix</span>
                        ) : packet?.gps?.isEstimated ? (
                          <span className="text-warning">Estimated (Campus Anchor)</span>
                        ) : (
                          <span className="text-muted">No Satellite Lock</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td>Satellites:</td>
                      <td><code>{packet?.gps?.satellites ?? 0} locked</code></td>
                    </tr>
                    <tr>
                      <td>Accuracy:</td>
                      <td><code>&plusmn;{packet?.accuracyMeters || 4.2}m</code></td>
                    </tr>
                    <tr>
                      <td>Speed:</td>
                      <td><code>{packet?.speedKph != null ? `${packet.speedKph.toFixed(1)} km/h` : '0.0 km/h'}</code></td>
                    </tr>
                    <tr>
                      <td>Timestamp (UTC):</td>
                      <td><code style={{ fontSize: '0.72rem' }}>{packet?.timestamp || packet?.capturedAtUtc || 'None'}</code></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="tech-card">
                <h4>IMU Sensor Readings &amp; Battery</h4>
                <table className="tech-table">
                  <tbody>
                    <tr>
                      <td>Battery:</td>
                      <td><strong>{packet?.batteryPercent ?? 92}%</strong></td>
                    </tr>
                    <tr>
                      <td>Net Accel (|a|):</td>
                      <td><code>{packet?.accelerometer?.magnitude ?? 9.81} m/s&sup2;</code></td>
                    </tr>
                    <tr>
                      <td>Accel X, Y, Z:</td>
                      <td>
                        <code>
                          {packet?.accelerometer?.x_ms2 ?? 0}, {packet?.accelerometer?.y_ms2 ?? 0}, {packet?.accelerometer?.z_ms2 ?? -9.81}
                        </code>
                      </td>
                    </tr>
                    <tr>
                      <td>Gyro Magnitude:</td>
                      <td><code>{packet?.gyroscope?.magnitude ?? 0} &deg;/s</code></td>
                    </tr>
                    <tr>
                      <td>Motion State:</td>
                      <td><span className="badge-tech">{packet?.motionState || 'stationary'}</span></td>
                    </tr>
                    <tr>
                      <td>Device Uptime:</td>
                      <td><code>{packet?.uptimeFormatted || '00:00:00'}</code></td>
                    </tr>
                    <tr>
                      <td>Telemetry Mode:</td>
                      <td>
                        <span className={isRealHardware ? 'text-success font-bold' : 'text-primary'}>
                          {isRealHardware ? 'Real Hardware Stream' : 'Simulation Preset'}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Formatted JSON Viewer */}
            <div className="tech-raw-viewer">
              <div className="tech-raw-title">
                <FileCode size={13} />
                <span>Active Telemetry Packet JSON Payload</span>
              </div>
              <pre className="tech-code-block">
                {JSON.stringify(packet || { message: 'Awaiting telemetry packet' }, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* ── TAB 2: Geofence Engine ── */}
        {activeTab === 'geofence' && (
          <div className="tech-panel">
            <div className="tech-desc-box">
              <p>
                <strong>Evaluation Algorithm:</strong> WGS84 Great-Circle Haversine Formula with boundary jitter tolerance:
                <br />
                <code>d = 2R · asin(&radic;(sin&sup2;(&Delta;&phi;/2) + cos(&phi;1)cos(&phi;2)sin&sup2;(&Delta;&lambda;/2)))</code>
                {' · '}
                <span>Boundary Hysteresis Tolerance: <strong>{STATUS_THRESHOLDS.BOUNDARY_JITTER_TOLERANCE_METERS}m</strong></span>
              </p>
            </div>

            <table className="tech-eval-table">
              <thead>
                <tr>
                  <th>Safe Place</th>
                  <th>Center Coordinates</th>
                  <th>Radius</th>
                  <th>Distance to Child</th>
                  <th>Schedule</th>
                  <th>Result</th>
                  <th>Event Decision &amp; Reason</th>
                </tr>
              </thead>
              <tbody>
                {geofenceCalculations.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: '#94A3B8' }}>
                      No safe places configured. Add a safe place in Setup or Safe Places tab.
                    </td>
                  </tr>
                ) : (
                  geofenceCalculations.map(c => (
                    <tr key={c.id}>
                      <td><strong>{c.label}</strong></td>
                      <td><code>{c.centerLat.toFixed(5)}, {c.centerLng.toFixed(5)}</code></td>
                      <td>{c.radiusMeters}m</td>
                      <td><code>{c.distanceMeters != null ? `${c.distanceMeters}m` : '—'}</code></td>
                      <td>
                        <span className={`schedule-chip ${c.scheduleActive ? 'chip-active' : 'chip-inactive'}`}>
                          {c.scheduleActive ? 'Active Now' : 'Inactive Window'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge-chip ${c.isInside ? 'chip--safe' : 'chip--breach'}`}>
                          {c.isInside ? 'Inside Zone' : 'Outside Zone'}
                        </span>
                      </td>
                      <td>
                        <div className="decision-cell">
                          <strong className={c.eventDecision === 'boundary_breach' ? 'text-danger' : 'text-success'}>
                            {c.eventDecision}
                          </strong>
                          <span className="decision-sub">{c.decisionReason}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Evaluation Log history */}
            <div className="tech-card" style={{ marginTop: '14px' }}>
              <h4>Recent Geofence Evaluations History</h4>
              <div className="eval-log-container">
                {evaluationLog.length === 0 ? (
                  <p className="text-muted" style={{ fontSize: '0.8rem' }}>Awaiting initial geofence evaluation cycles...</p>
                ) : (
                  evaluationLog.slice(0, 8).map((log, idx) => (
                    <div key={idx} className="eval-log-item">
                      <span className="log-time">{log.time}</span>
                      <span className="log-zone">{log.zone}</span>
                      <span className="log-dist">{log.distanceMeters}m</span>
                      <span className={`log-event ${log.event === 'None' ? 'log-nominal' : 'log-breach'}`}>{log.event}</span>
                      <span className="log-reason">{log.reason}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: Routine Model ── */}
        {activeTab === 'routine' && (
          <div className="tech-panel">
            <div className="tech-grid-2">
              <div className="tech-card">
                <h4>Per-Device Statistical Baseline</h4>
                <table className="tech-table">
                  <tbody>
                    <tr>
                      <td>Device ID:</td>
                      <td><code>{derivedProfile.deviceKey}</code></td>
                    </tr>
                    <tr>
                      <td>Model Engine:</td>
                      <td><code>{derivedProfile.modelVersion}</code></td>
                    </tr>
                    <tr>
                      <td>Recorded Observation Days:</td>
                      <td><strong>{derivedProfile.recordedDaysCount} days</strong></td>
                    </tr>
                    <tr>
                      <td>Valid Historical Observations:</td>
                      <td><strong>{derivedProfile.totalValidObservations} verified fixes</strong></td>
                    </tr>
                    <tr>
                      <td>Minimum History Threshold:</td>
                      <td><code>3 days (Current: {derivedProfile.recordedDaysCount}/3)</code></td>
                    </tr>
                    <tr>
                      <td>Route Confidence:</td>
                      <td>
                        <strong style={{ color: derivedProfile.confidence.score > 0.6 ? '#059669' : '#D97706' }}>
                          {derivedProfile.confidence.label} ({derivedProfile.confidence.percentage}%)
                        </strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="tech-card">
                <h4>Learned Journey Corridor</h4>
                <table className="tech-table">
                  <tbody>
                    <tr>
                      <td>Expected Route:</td>
                      <td><strong>{derivedProfile.primaryRoute.name}</strong></td>
                    </tr>
                    <tr>
                      <td>Typical Departure:</td>
                      <td><code>{derivedProfile.primaryRoute.typicalDeparture} ({derivedProfile.primaryRoute.departureWindow})</code></td>
                    </tr>
                    <tr>
                      <td>Typical Arrival:</td>
                      <td><code>{derivedProfile.primaryRoute.typicalArrival} ({derivedProfile.primaryRoute.arrivalWindow})</code></td>
                    </tr>
                    <tr>
                      <td>Expected Journey Duration:</td>
                      <td><code>~{derivedProfile.primaryRoute.typicalDurationMinutes} minutes</code></td>
                    </tr>
                    <tr>
                      <td>Corridor Tolerance:</td>
                      <td><code>&plusmn;{derivedProfile.primaryRoute.corridorToleranceMeters}m lateral margin</code></td>
                    </tr>
                    <tr>
                      <td>Deviation Score:</td>
                      <td>
                        <strong style={{ color: Number(packet?.deviationScore) > 0.65 ? '#DC2626' : '#059669' }}>
                          {(Number(packet?.deviationScore) || 0).toFixed(3)}
                        </strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Daily learning timeline */}
            <div className="tech-card" style={{ marginTop: '14px' }}>
              <h4>Daily Learning Timeline Progression</h4>
              <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '12px' }}>
                Progression is derived solely from eligible historical observations on this physical device. Simulation packets are strictly excluded.
              </p>
              <div className="learning-timeline-track">
                {derivedProfile.timeline.map(t => (
                  <div key={t.day} className={`timeline-step ${t.status}`}>
                    <div className="timeline-node">
                      {t.status === 'completed' ? <Check size={12} /> : t.day}
                    </div>
                    <div className="timeline-content">
                      <strong>Day {t.day} — {t.title}</strong>
                      <span>{t.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: Capstone Scenarios ── */}
        {activeTab === 'scenarios' && (
          <div className="tech-panel">
            <div className="scenario-isolation-notice">
              <Zap size={15} color="#2563EB" />
              <div>
                <strong>Strict Simulation Isolation:</strong>
                <span> All scenarios use dummy device ID <code>SIM-DEVICE-01</code>. Scenario events NEVER overwrite live hardware telemetry or real routine learning.</span>
              </div>
            </div>

            <div className="scenario-cards-grid">
              {/* Preset 1: Nominal Safety */}
              <div className={`scenario-card ${activeScenario === SCENARIO_PRESETS.NOMINAL ? 'scenario-card--active' : ''}`}>
                <div className="scenario-card-header">
                  <strong>{SCENARIO_METADATA[SCENARIO_PRESETS.NOMINAL].name}</strong>
                  <span className="scenario-chip chip--green">{SCENARIO_METADATA[SCENARIO_PRESETS.NOMINAL].tag}</span>
                </div>
                <p>{SCENARIO_METADATA[SCENARIO_PRESETS.NOMINAL].description}</p>
                <div className="scenario-expected-box">
                  <span className="expected-label">Expected Result:</span>
                  <code>{SCENARIO_METADATA[SCENARIO_PRESETS.NOMINAL].expectedResult}</code>
                </div>
                <div className="scenario-card-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => onStartScenario(SCENARIO_PRESETS.NOMINAL)}
                  >
                    <Play size={12} />
                    <span>Run Preset 1</span>
                  </button>
                </div>
              </div>

              {/* Preset 2: Boundary Breach */}
              <div className={`scenario-card ${activeScenario === SCENARIO_PRESETS.BREACH ? 'scenario-card--active' : ''}`}>
                <div className="scenario-card-header">
                  <strong>{SCENARIO_METADATA[SCENARIO_PRESETS.BREACH].name}</strong>
                  <span className="scenario-chip chip--red">{SCENARIO_METADATA[SCENARIO_PRESETS.BREACH].tag}</span>
                </div>
                <p>{SCENARIO_METADATA[SCENARIO_PRESETS.BREACH].description}</p>
                <div className="scenario-expected-box">
                  <span className="expected-label">Expected Result:</span>
                  <code>{SCENARIO_METADATA[SCENARIO_PRESETS.BREACH].expectedResult}</code>
                </div>
                <div className="scenario-card-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => onStartScenario(SCENARIO_PRESETS.BREACH)}
                  >
                    <Play size={12} />
                    <span>Run Preset 2</span>
                  </button>
                </div>
              </div>

              {/* Preset 3: Route Deviation */}
              <div className={`scenario-card ${activeScenario === SCENARIO_PRESETS.DEVIATION ? 'scenario-card--active' : ''}`}>
                <div className="scenario-card-header">
                  <strong>{SCENARIO_METADATA[SCENARIO_PRESETS.DEVIATION].name}</strong>
                  <span className="scenario-chip chip--amber">{SCENARIO_METADATA[SCENARIO_PRESETS.DEVIATION].tag}</span>
                </div>
                <p>{SCENARIO_METADATA[SCENARIO_PRESETS.DEVIATION].description}</p>
                <div className="scenario-expected-box">
                  <span className="expected-label">Expected Result:</span>
                  <code>{SCENARIO_METADATA[SCENARIO_PRESETS.DEVIATION].expectedResult}</code>
                </div>
                <div className="scenario-card-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => onStartScenario(SCENARIO_PRESETS.DEVIATION)}
                  >
                    <Play size={12} />
                    <span>Run Preset 3</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Manual Scenario Controls */}
            <div className="tech-card" style={{ marginTop: '14px' }}>
              <h4>Manual Scenario Telemetry Controls</h4>
              <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '10px' }}>
                Set custom simulated coordinates and test real-time event-evaluation logic without affecting live hardware records.
              </p>
              <div className="form-row-3">
                <div className="form-group">
                  <label>Simulated Lat</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={manualLat}
                    onChange={e => setManualLat(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Simulated Lng</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={manualLon}
                    onChange={e => setManualLon(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Speed (km/h)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={manualSpeed}
                    onChange={e => setManualSpeed(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => onManualSimulate?.(manualLat, manualLon, manualSpeed)}
                >
                  <Sliders size={13} />
                  <span>Inject Coordinates to Simulator</span>
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={onResetScenario}
                >
                  <RotateCcw size={13} />
                  <span>Reset &amp; Clear Simulation</span>
                </button>
              </div>
            </div>

            {/* Active Simulation Stop Bar */}
            {simRunning && (
              <div className="scenario-stop-bar">
                <div className="scenario-status-info">
                  <span className="status-live-dot" />
                  <span>Simulation preset actively running ({activeScenario}).</span>
                </div>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={onStopScenario}
                >
                  <span>Stop Simulation &amp; Resume Live Hardware</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 5: Firebase and Diagnostics ── */}
        {activeTab === 'diagnostics' && (
          <div className="tech-panel">
            <div className="diag-header-bar">
              <div>
                <h4>Firebase Realtime Database Diagnostics</h4>
                <p>Independent verification of all 8 database paths, rules, and read/write operations.</p>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleRunDiagnostics}
                disabled={diagnosticsRunning}
              >
                <RefreshCw size={13} className={diagnosticsRunning ? 'spin' : ''} />
                <span>{diagnosticsRunning ? 'Running Tests...' : 'Run Diagnostics Probe'}</span>
              </button>
            </div>

            {diagResults ? (
              <div className="diag-results-list">
                {[
                  { key: 'readTelemetry', label: '1. Read Live Telemetry (/sensorData)', op: 'GET /sensorData.json' },
                  { key: 'readSafeZones', label: '2. Read Safe Places (/safeZones)', op: 'GET /safeZones/:deviceKey.json' },
                  { key: 'createSafeZone', label: '3. Create Safe Place (Write Validation)', op: 'PUT /safeZones/:deviceKey/:probe.json' },
                  { key: 'editSafeZone', label: '4. Edit Safe Place (PATCH/Update)', op: 'PATCH /safeZones/:deviceKey/:probe.json' },
                  { key: 'deleteSafeZone', label: '5. Delete Safe Place (DELETE Cleanup)', op: 'DELETE /safeZones/:deviceKey/:probe.json' },
                  { key: 'persistRoutineHistory', label: '6. Persist Daily Routine History', op: 'PUT /routineHistory/:deviceKey/:date/:obs.json' },
                  { key: 'loadRoutineProfile', label: '7. Load Learned Routine Profile', op: 'GET /routineProfile/:deviceKey.json' },
                  { key: 'saveAlerts', label: '8. Save Safety Events & Alerts', op: 'PUT /alerts/:deviceKey/:alert.json' },
                ].map(item => {
                  const res = diagResults.results?.[item.key] || {};
                  return (
                    <div key={item.key} className={`diag-item ${res.ok ? 'diag-item--ok' : 'diag-item--fail'}`}>
                      <div className="diag-item-left">
                        {res.ok ? <CheckCircle size={16} color="#059669" /> : <XCircle size={16} color="#DC2626" />}
                        <div>
                          <strong>{item.label}</strong>
                          <span className="diag-op-code">{item.op}</span>
                        </div>
                      </div>
                      <div className="diag-item-right">
                        {res.latencyMs != null && <span className="diag-latency">{res.latencyMs}ms</span>}
                        <span className={`diag-status-pill ${res.ok ? 'pill-healthy' : 'pill-fail'}`}>
                          {res.status || 'Pending'}
                        </span>
                        {res.details && <span className="diag-details">{res.details}</span>}
                        {res.error && <span className="diag-error">{res.error}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="diag-placeholder">
                <Database size={32} color="#CBD5E1" />
                <p>Click &quot;Run Diagnostics Probe&quot; to test all 8 database operations.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
