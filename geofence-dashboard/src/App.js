import {
  AlertTriangle, Battery, BatteryLow, Bell, CheckCircle, ChevronRight,
  Crosshair, LogOut, MapPin, PanelRightClose, PanelRightOpen, Play, Pause,
  Shield, ShieldAlert, ShieldCheck, Trash2, TrendingDown, TrendingUp,
  User, Volume2, VolumeX, Wifi, WifiOff, X, Radio, Zap, BarChart3, Clock, Eye,
  EyeOff, Cloud, Sparkles, ArrowRight, Activity
} from 'lucide-react';
import {
  Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents
} from 'react-leaflet';
import L from 'leaflet';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from './api';
import simulation from './simulation';
import { startSignalR, stopSignalR } from './signalr';
import auth from './auth';
import alertStore from './alertStore';
import voiceAlarm from './voiceAlarm';
import batteryStore from './batteryStore';
import progressStore from './progressStore';

/* ──────────────────────────────────────────────────────────────
   Leaflet helpers & device icon
   ────────────────────────────────────────────────────────────── */

function makeDeviceIcon(isAnomaly) {
  return L.divIcon({
    className: '',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24],
    html: `
      <div class="device-marker ${isAnomaly ? 'device-marker--alert' : ''}">
        <div class="device-marker-pulse"></div>
        <div class="device-marker-core">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
      </div>
    `,
  });
}

const deviceIconNormal = makeDeviceIcon(false);
const deviceIconAlert = makeDeviceIcon(true);

function FlyTo({ latlng }) {
  const map = useMap();
  const prevRef = useRef(null);
  useEffect(() => {
    if (!latlng) return;
    const key = `${latlng[0].toFixed(4)},${latlng[1].toFixed(4)}`;
    if (prevRef.current === key) return;
    prevRef.current = key;
    map.flyTo(latlng, Math.max(map.getZoom(), 14), { duration: 0.6 });
  }, [latlng, map]);
  return null;
}

function MapClickListener({ onClick }) {
  useMapEvents({ click(e) { onClick?.(e.latlng); } });
  return null;
}

/* ──────────────────────────────────────────────────────────────
   Mini Sparkline component (SVG)
   ────────────────────────────────────────────────────────────── */
function Sparkline({ data, width = 200, height = 40, color = '#10b981' }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 100);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────
   Auth Page (Login / Register) with Cloudflare Backend & Quick Demo
   ────────────────────────────────────────────────────────────── */
function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('guardian');
  const [deviceKey, setDeviceKey] = useState('CARE-TAG-01');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState('checking');

  // Verify Cloudflare backend connectivity
  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        if (data.ok) setServerStatus('online');
        else setServerStatus('local');
      })
      .catch(() => setServerStatus('local'));
  }, []);

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = mode === 'register'
        ? await auth.register(name, email, password, role, deviceKey)
        : await auth.login(email, password);
      if (result.ok) {
        onLogin(result.user);
      } else {
        setError(result.error || 'Authentication failed');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  // One-click quick login for testing
  async function handleQuickLogin(demoEmail, demoRole, demoDevice) {
    setEmail(demoEmail);
    setPassword('caretag2026');
    setError('');
    setLoading(true);
    try {
      const result = await auth.login(demoEmail, 'caretag2026');
      if (result.ok) {
        onLogin(result.user);
      } else {
        // If not in KV yet, register it directly
        const reg = await auth.register(
          demoRole === 'caregiver' ? 'Marcus Vance, RN' : 'Dr. Sarah Jenkins',
          demoEmail,
          'caretag2026',
          demoRole,
          demoDevice
        );
        if (reg.ok) onLogin(reg.user);
        else setError(reg.error);
      }
    } catch (err) {
      setError(err.message || 'Quick login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Status Badge */}
        <div className="auth-edge-badge">
          <span className={`edge-dot ${serverStatus === 'online' ? 'edge-dot--online' : 'edge-dot--local'}`} />
          <span>{serverStatus === 'online' ? 'Cloudflare Workers KV Active' : 'Edge Sync Ready'}</span>
        </div>

        {/* Brand Header */}
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <ShieldCheck size={32} />
          </div>
          <h1>CareTag</h1>
          <p>GPS Behavioral Monitoring & Real-time Geofence Intelligence</p>
        </div>

        {/* Mode Tabs */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError(''); }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); setError(''); }}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Sarah Jenkins"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Role</label>
                <div className="auth-role-select">
                  <button
                    type="button"
                    className={`role-chip ${role === 'guardian' ? 'active' : ''}`}
                    onClick={() => setRole('guardian')}
                  >
                    Family Guardian
                  </button>
                  <button
                    type="button"
                    className={`role-chip ${role === 'caregiver' ? 'active' : ''}`}
                    onClick={() => setRole('caregiver')}
                  >
                    Clinical Caregiver
                  </button>
                  <button
                    type="button"
                    className={`role-chip ${role === 'admin' ? 'active' : ''}`}
                    onClick={() => setRole('admin')}
                  >
                    Administrator
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Device Tag ID</label>
                <input
                  type="text"
                  placeholder="CARE-TAG-01"
                  value={deviceKey}
                  onChange={e => setDeviceKey(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={4}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(p => !p)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="auth-error">
              <AlertTriangle size={15} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary auth-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <span className="spinner" />
            ) : mode === 'register' ? (
              <>Create Account <ArrowRight size={16} /></>
            ) : (
              <>Sign In <ArrowRight size={16} /></>
            )}
          </button>
        </form>

        {/* Quick Demo Logins */}
        <div className="auth-quick-demo">
          <div className="quick-demo-divider">
            <span>or instant test access</span>
          </div>
          <div className="quick-demo-buttons">
            <button
              type="button"
              className="quick-demo-btn"
              onClick={() => handleQuickLogin('demo@caretag.io', 'guardian', 'CARE-TAG-01')}
              disabled={loading}
            >
              <Sparkles size={14} />
              <span>Demo Guardian</span>
            </button>
            <button
              type="button"
              className="quick-demo-btn"
              onClick={() => handleQuickLogin('caregiver@caretag.io', 'caregiver', 'CARE-TAG-02')}
              disabled={loading}
            >
              <Activity size={14} />
              <span>Demo Caregiver</span>
            </button>
          </div>
        </div>

        {/* Footer Note */}
        <div className="auth-footer-note">
          <Cloud size={13} />
          <span>Cloudflare Edge Worker • Real-time Firebase Ready</span>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Main App
   ────────────────────────────────────────────────────────────── */

function App() {
  // ── Auth state ──
  const [session, setSession] = useState(() => auth.getSession());

  // If not logged in, show auth page
  if (!session) {
    return <AuthPage onLogin={setSession} />;
  }

  return <Dashboard session={session} onLogout={() => { auth.logout(); setSession(null); }} />;
}

/* ──────────────────────────────────────────────────────────────
   Dashboard (authenticated)
   ────────────────────────────────────────────────────────────── */

function Dashboard({ session, onLogout }) {
  const userId = session.userId;

  // ── Data state ──
  const [latest, setLatest] = useState(null);
  const [alert, setAlert] = useState(null);
  const [geofences, setGeofences] = useState([]);
  const [geofencesLoading, setGeofencesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [connected, setConnected] = useState(false);

  // ── Simulation state ──
  const [simRunning, setSimRunning] = useState(false);
  const [simPacketCount, setSimPacketCount] = useState(0);

  // ── New feature states ──
  const [alerts, setAlerts] = useState(() => alertStore.getRecentAlerts(userId, 20));
  const [unackCount, setUnackCount] = useState(() => alertStore.getUnacknowledgedCount(userId));
  const [batStats, setBatStats] = useState(() => batteryStore.getBatteryStats(userId));
  const [progress, setProgress] = useState(() => progressStore.getProgressHistory(userId, 8));
  const [voiceEnabled, setVoiceEnabled] = useState(() => voiceAlarm.isEnabled());

  // ── Safety status ──
  const [safetyStatus, setSafetyStatus] = useState('safe'); // 'safe' | 'warning' | 'breach'

  // ── UI state ──
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [activeTab, setActiveTab] = useState('controls'); // controls | alerts | battery | progress

  const [formState, setFormState] = useState({
    label: '',
    centerLat: 30.3398,
    centerLng: 76.3869,
    radiusMeters: 500
  });

  const [showOnboard, setShowOnboard] = useState(() => {
    try { return localStorage.getItem('caretag.onboard') !== 'done'; } catch { return true; }
  });

  const [flyTo, setFlyTo] = useState(null);
  const alertTimer = useRef(null);
  const geofencesRef = useRef(geofences);

  // Keep geofencesRef in sync
  useEffect(() => { geofencesRef.current = geofences; }, [geofences]);

  // ── Toast system ──
  const pushToast = useCallback((text, type = 'info', ttl = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), ttl);
  }, []);

  // ── Alert banner ──
  const showAlertBanner = useCallback((text) => {
    setAlert(text);
    clearTimeout(alertTimer.current);
    alertTimer.current = setTimeout(() => setAlert(null), 8000);
  }, []);

  // ── Refresh stores helper ──
  const refreshStores = useCallback(() => {
    setAlerts(alertStore.getRecentAlerts(userId, 20));
    setUnackCount(alertStore.getUnacknowledgedCount(userId));
    setBatStats(batteryStore.getBatteryStats(userId));
    setProgress(progressStore.getProgressHistory(userId, 8));
  }, [userId]);

  // ── Load geofences ──
  const loadGeofences = useCallback(async () => {
    try {
      const list = await api.fetchGeofences();
      setGeofences(list || []);
    } catch {
      pushToast('Failed to load geofences', 'error');
    } finally {
      setGeofencesLoading(false);
    }
  }, [pushToast]);

  useEffect(() => { loadGeofences(); }, [loadGeofences]);

  // ── Polling + SignalR (for real backend) — DISABLED when simulation runs ──
  useEffect(() => {
    if (simRunning) return;

    let mounted = true;

    async function poll() {
      try {
        const p = await api.fetchLatestPacket();
        if (!mounted || !p) return;
        if (p.latitude && p.longitude) {
          setLatest({ lat: Number(p.latitude), lng: Number(p.longitude), packet: p });
          const score = Number(p.deviationScore) || 0;
          if (score > 0.7 || p.motionState?.toLowerCase() === 'abnormal') {
            showAlertBanner(`Alert: ${p.packetType} — deviation ${score.toFixed(2)}`);
          }
        }
      } catch {}
    }

    poll();
    const intervalId = setInterval(poll, 5000);

    startSignalR((data) => {
      if (!mounted) return;
      setConnected(true);
      if (data?.latitude && data?.longitude) {
        setLatest({ lat: Number(data.latitude), lng: Number(data.longitude), packet: data });
        const score = Number(data.deviationScore) || 0;
        if (score > 0.7 || data.motionState?.toLowerCase() === 'abnormal') {
          showAlertBanner(`Live: ${data.packetType} — deviation ${score.toFixed(2)}`);
        }
      }
    }).then(() => setConnected(true))
      .catch(() => setConnected(false));

    return () => {
      mounted = false;
      clearInterval(intervalId);
      clearTimeout(alertTimer.current);
      stopSignalR();
    };
  }, [showAlertBanner, simRunning]);

  // ── Simulation controls ──
  const startSim = useCallback(() => {
    const geos = geofencesRef.current;
    if (geos.length === 0) {
      pushToast('Create at least one geofence first to start simulation', 'error');
      return;
    }

    simulation.start(geos, (packet) => {
      setLatest({ lat: packet.latitude, lng: packet.longitude, packet });
      setSimPacketCount(c => c + 1);

      // ── Store battery data ──
      if (packet.batteryPercent != null) {
        batteryStore.saveBatterySnapshot(userId, packet.batteryPercent, packet.deviceKey);

        // Low battery alert
        if (packet.batteryPercent < 20) {
          alertStore.saveAlert(userId, {
            type: 'low_battery',
            latitude: packet.latitude,
            longitude: packet.longitude,
            batteryPercent: packet.batteryPercent,
            message: `Low battery: ${packet.batteryPercent}%`,
          });
          voiceAlarm.trigger('low_battery', { batteryPercent: packet.batteryPercent });
          refreshStores();
        }
      }

      // ── Anomaly / Out-of-zone detection ──
      if (packet.isAnomaly) {
        const alertData = {
          type: packet.distToNearestKm != null ? 'out_of_zone' : 'anomaly',
          latitude: packet.latitude,
          longitude: packet.longitude,
          nearestGeofence: packet.nearestGeofence,
          distance: packet.distToNearestKm,
          deviationScore: packet.deviationScore,
          message: `⚡ Anomaly — deviation ${packet.deviationScore.toFixed(2)} (${packet.distToNearestKm?.toFixed(1) || '?'}km from "${packet.nearestGeofence || 'zone'}")`,
        };

        alertStore.saveAlert(userId, alertData);

        // Voice alarm
        voiceAlarm.trigger(alertData.type, {
          nearestGeofence: packet.nearestGeofence,
          distance: packet.distToNearestKm,
          deviationScore: packet.deviationScore,
        });

        showAlertBanner(alertData.message);
        setSafetyStatus('breach');
        refreshStores();
      } else {
        setSafetyStatus('safe');
      }

      // Periodic refresh of stores (every 10 packets)
      if ((packet.id || 0) % 10 === 0) {
        refreshStores();
      }
    }, 3000);

    setSimRunning(true);
    setSimPacketCount(0);
    pushToast('Simulation started — device is moving between your geofences', 'success');
  }, [pushToast, showAlertBanner, userId, refreshStores]);

  const stopSim = useCallback(() => {
    simulation.stop();
    setSimRunning(false);
    setSafetyStatus('safe');
    refreshStores();
    pushToast('Simulation stopped');
  }, [pushToast, refreshStores]);

  // Update simulation when geofences change
  useEffect(() => {
    if (simRunning) {
      simulation.updateGeofences(geofences);
    }
  }, [geofences, simRunning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { simulation.stop(); voiceAlarm.stop(); };
  }, []);

  // ── Form validation ──
  function validateForm() {
    const errors = {};
    if (!formState.label.trim()) errors.label = 'Label is required';
    const lat = Number(formState.centerLat);
    const lng = Number(formState.centerLng);
    if (isNaN(lat) || lat < -90 || lat > 90) errors.centerLat = 'Invalid (–90 to 90)';
    if (isNaN(lng) || lng < -180 || lng > 180) errors.centerLng = 'Invalid (–180 to 180)';
    const r = Number(formState.radiusMeters);
    if (isNaN(r) || r <= 0) errors.radiusMeters = 'Must be > 0';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Save geofence ──
  async function handleSaveGeofence(e) {
    e.preventDefault();
    if (!validateForm()) return;
    setSaving(true);
    try {
      const res = await api.postGeofence(undefined, {
        DeviceName: 'DEFAULT',
        Label: formState.label.trim(),
        CenterLatitude: Number(formState.centerLat),
        CenterLongitude: Number(formState.centerLng),
        RadiusMeters: Number(formState.radiusMeters),
        ActiveFrom: null,
        ActiveTo: null,
        IsActive: true
      });
      if (res?.ok) {
        pushToast(`Geofence "${res.data?.label || formState.label}" saved`, 'success');
        setFormState(s => ({ ...s, label: '' }));
        setFormErrors({});
        await loadGeofences();
      } else {
        pushToast(typeof res?.data === 'string' ? res.data : 'Save failed — try a different label', 'error');
      }
    } catch (err) {
      pushToast(`Error: ${err.message || 'Network error'}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Delete geofence ──
  async function handleDeleteGeofence(id, label) {
    setDeletingId(id);
    try {
      const res = await api.deleteGeofence(undefined, id);
      if (res.ok) {
        pushToast(`"${label}" deleted`, 'success');
        await loadGeofences();
      } else {
        pushToast(`Failed to delete "${label}"`, 'error');
      }
    } catch (err) {
      pushToast(`Error: ${err.message || 'Network error'}`, 'error');
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  }

  // ── Map click ──
  function handleMapClick(latlng) {
    setFormState(s => ({
      ...s,
      centerLat: parseFloat(latlng.lat.toFixed(6)),
      centerLng: parseFloat(latlng.lng.toFixed(6))
    }));
    setFormErrors(e => ({ ...e, centerLat: undefined, centerLng: undefined }));
    if (!sidebarOpen) setSidebarOpen(true);
  }

  function dismissOnboard() {
    setShowOnboard(false);
    try { localStorage.setItem('caretag.onboard', 'done'); } catch {}
  }

  // ── Alert acknowledge ──
  function handleAckAlert(alertId) {
    alertStore.acknowledgeAlert(userId, alertId);
    refreshStores();
  }

  function handleAckAll() {
    alertStore.acknowledgeAll(userId);
    refreshStores();
  }

  // ── Voice alarm toggle ──
  function handleToggleVoice() {
    const newState = voiceAlarm.toggle();
    setVoiceEnabled(newState);
    pushToast(newState ? 'Voice alarm enabled' : 'Voice alarm disabled');
  }

  // ── Helpers ──
  const pkt = latest?.packet;
  const devScore = pkt ? (Number(pkt.deviationScore) || 0) : null;
  const scoreClass = devScore === null ? '' : devScore > 0.7 ? 'value-bad' : devScore > 0.4 ? 'value-warn' : 'value-good';
  const connStatus = simRunning ? 'simulating' : connected ? 'connected' : 'disconnected';

  const safetyLabel = safetyStatus === 'breach' ? 'OUT OF ZONE' : safetyStatus === 'warning' ? 'WARNING' : 'SAFE';
  const safetyClass = safetyStatus === 'breach' ? 'safety--breach' : safetyStatus === 'warning' ? 'safety--warning' : 'safety--safe';

  // Progress summary
  const monthsWithData = progress.filter(p => p.hasData).length;

  /* ──────────────────────────────────────────────────────────
     Render
     ────────────────────────────────────────────────────────── */
  return (
    <div className={`app-layout ${!sidebarOpen ? 'sidebar-closed' : ''}`}>

      {/* ── Toasts ── */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type === 'error' ? 'toast--error' : t.type === 'success' ? 'toast--success' : ''}`}>
            {t.type === 'error' && <AlertTriangle size={15} />}
            {t.type === 'success' && <CheckCircle size={15} />}
            {t.text}
          </div>
        ))}
      </div>

      {/* ── Onboarding ── */}
      {showOnboard && (
        <div className="onboard-overlay" role="dialog" aria-label="Welcome" onClick={dismissOnboard}>
          <div className="onboard-card" onClick={e => e.stopPropagation()}>
            <h2><Zap size={20} /> Welcome to CareTag</h2>
            <p>
              <strong>1.</strong> Click the map to pick a location.<br />
              <strong>2.</strong> Name it and set a radius in the sidebar, then <strong>Save Geofence</strong>.<br />
              <strong>3.</strong> Create 2+ geofences and hit <strong>▶ Start Simulation</strong> to watch a virtual device move between them with ML-powered anomaly detection.
            </p>
            <button className="btn btn-primary" onClick={dismissOnboard} style={{ width: '100%' }}>
              Got it — let's go
            </button>
          </div>
        </div>
      )}

      {/* ── Alert banner ── */}
      {alert && (
        <div className="live-alert">
          <AlertTriangle size={16} />
          {alert}
          <button className="alert-dismiss" onClick={() => { setAlert(null); voiceAlarm.stop(); }} title="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Delete confirmation ── */}
      {confirmDelete && (
        <div className="confirm-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="confirm-card" onClick={e => e.stopPropagation()}>
            <h3><Trash2 size={18} /> Delete geofence</h3>
            <p>Are you sure you want to delete <strong>"{confirmDelete.label}"</strong>? This cannot be undone.</p>
            <div className="confirm-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button
                className="btn btn-danger-ghost"
                disabled={deletingId === confirmDelete.id}
                onClick={() => handleDeleteGeofence(confirmDelete.id, confirmDelete.label)}
              >
                {deletingId === confirmDelete.id ? <span className="spinner" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Top Bar ── */}
      <div className="top-bar">
        <div className="top-bar-left">
          <div className="app-logo">
            <MapPin size={20} />
            CareTag
          </div>
        </div>
        <div className="top-bar-right">
          {/* Safety status badge */}
          <div className={`safety-badge ${safetyClass}`}>
            {safetyStatus === 'breach' ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
            {safetyLabel}
          </div>

          {/* Voice alarm indicator */}
          <button className="icon-btn" onClick={handleToggleVoice} title={voiceEnabled ? 'Voice alarm ON' : 'Voice alarm OFF'}>
            {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {/* Alert badge */}
          <button className="icon-btn" onClick={() => { setSidebarOpen(true); setActiveTab('alerts'); }} title="Alerts">
            <Bell size={16} />
            {unackCount > 0 && <span className="badge-count">{unackCount > 99 ? '99+' : unackCount}</span>}
          </button>

          <div className={`connection-badge connection-badge--${connStatus}`}>
            <span className="connection-dot" />
            {connStatus === 'simulating' ? 'SIMULATING' : connStatus === 'connected' ? 'LIVE' : 'OFFLINE'}
            {connStatus === 'simulating' ? <Radio size={13} /> : connStatus === 'connected' ? <Wifi size={13} /> : <WifiOff size={13} />}
          </div>

          {/* User menu */}
          <div className="user-badge" title={`Signed in as ${session.email} • Device: ${session.deviceKey || 'CARE-TAG-01'}`}>
            <User size={14} />
            <div className="user-badge-details">
              <span className="user-name">{session.name}</span>
              <span className="user-role-badge">{session.role || 'guardian'}</span>
            </div>
            <span className="device-tag-badge">{session.deviceKey || 'CARE-TAG-01'}</span>
            <button className="icon-btn" onClick={onLogout} title="Logout"><LogOut size={14} /></button>
          </div>

          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarOpen(s => !s)}
            aria-label={sidebarOpen ? 'Close panel' : 'Open panel'}
          >
            {sidebarOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
            {sidebarOpen ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {/* ── Map ── */}
      <div className="map-container">
        <MapContainer center={[30.3398, 76.3869]} zoom={12} scrollWheelZoom className="leaflet-container">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickListener onClick={handleMapClick} />

          {/* Preview circle */}
          {formState.centerLat != null && formState.centerLng != null && (
            <Circle
              center={[Number(formState.centerLat), Number(formState.centerLng)]}
              radius={Math.max(10, Number(formState.radiusMeters) || 10)}
              pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.15, weight: 2, dashArray: '8 4' }}
            >
              <Popup><strong>Preview</strong><br />{formState.label || 'Unnamed'} — {formState.radiusMeters}m</Popup>
            </Circle>
          )}

          {/* Saved geofences */}
          {geofences.map(g => (
            <Circle
              key={g.id}
              center={[g.centerLatitude, g.centerLongitude]}
              radius={g.radiusMeters}
              pathOptions={{ color: '#a78bfa', fillColor: '#a78bfa', fillOpacity: 0.12, weight: 2 }}
            >
              <Popup><strong>{g.label}</strong><br />{g.centerLatitude.toFixed(4)}, {g.centerLongitude.toFixed(4)}<br />Radius: {g.radiusMeters}m</Popup>
            </Circle>
          ))}

          {/* Simulated / live device position */}
          {latest && (
            <>
              <Marker
                position={[latest.lat, latest.lng]}
                icon={pkt?.isAnomaly ? deviceIconAlert : deviceIconNormal}
              >
                <Popup>
                  <strong>{pkt?.deviceKey || 'Device'}</strong><br />
                  {pkt?.motionState && <span>State: {pkt.motionState}<br /></span>}
                  {pkt?.deviationScore != null && <span>Deviation: {Number(pkt.deviationScore).toFixed(3)}<br /></span>}
                  {pkt?.nearestGeofence && <span>Nearest: {pkt.nearestGeofence}<br /></span>}
                  {pkt?.distToNearestKm != null && <span>Distance: {pkt.distToNearestKm.toFixed(2)} km<br /></span>}
                  {pkt?.capturedAtUtc && <span>{new Date(pkt.capturedAtUtc).toLocaleTimeString()}</span>}
                </Popup>
              </Marker>
              {pkt?.isAnomaly && (
                <Circle
                  center={[latest.lat, latest.lng]}
                  radius={300}
                  pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.08, weight: 2, dashArray: '6 4' }}
                />
              )}
            </>
          )}

          {flyTo && <FlyTo latlng={flyTo} />}
        </MapContainer>
      </div>

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${!sidebarOpen ? 'sidebar--hidden' : ''}`} aria-label="Controls panel">
        <div className="sidebar-header">
          <h2>Control Panel</h2>
          <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)} aria-label="Close panel">
            <X size={16} />
          </button>
        </div>

        {/* ── Tab Navigation ── */}
        <div className="sidebar-tabs">
          <button className={`tab-btn ${activeTab === 'controls' ? 'tab-btn--active' : ''}`}
            onClick={() => setActiveTab('controls')}><Shield size={13} /> Controls</button>
          <button className={`tab-btn ${activeTab === 'alerts' ? 'tab-btn--active' : ''}`}
            onClick={() => setActiveTab('alerts')}>
            <Bell size={13} /> Alerts
            {unackCount > 0 && <span className="tab-badge">{unackCount}</span>}
          </button>
          <button className={`tab-btn ${activeTab === 'battery' ? 'tab-btn--active' : ''}`}
            onClick={() => setActiveTab('battery')}><Battery size={13} /> Battery</button>
          <button className={`tab-btn ${activeTab === 'progress' ? 'tab-btn--active' : ''}`}
            onClick={() => setActiveTab('progress')}><BarChart3 size={13} /> Progress</button>
        </div>

        <div className="sidebar-body">

          {/* ════════════════════════ TAB: Controls ════════════════════════ */}
          {activeTab === 'controls' && (
            <>
              {/* ── Simulation Controls ── */}
              <section>
                <p className="section-label">Simulation</p>
                <div className="sim-controls">
                  {!simRunning ? (
                    <button className="btn btn-sim-start" onClick={startSim} disabled={geofences.length === 0}>
                      <Play size={14} /> Start Simulation
                    </button>
                  ) : (
                    <button className="btn btn-sim-stop" onClick={stopSim}>
                      <Pause size={14} /> Stop Simulation
                    </button>
                  )}
                  {geofences.length === 0 && (
                    <p className="form-hint">Create geofences first, then simulate</p>
                  )}
                  {simRunning && (
                    <p className="form-hint" style={{ color: 'var(--success)' }}>
                      <Radio size={12} /> {simPacketCount} packets generated
                    </p>
                  )}
                </div>
              </section>

              {/* ── Voice Alarm Toggle ── */}
              <section>
                <p className="section-label">Voice Alarm</p>
                <div className="voice-alarm-control">
                  <button className={`btn ${voiceEnabled ? 'btn-voice-on' : 'btn-voice-off'}`} onClick={handleToggleVoice}>
                    {voiceEnabled ? <><Volume2 size={14} /> Voice Alarm ON</> : <><VolumeX size={14} /> Voice Alarm OFF</>}
                  </button>
                  <p className="form-hint">
                    {voiceEnabled ? 'Audible warnings will sound on anomalies' : 'Voice warnings are muted'}
                  </p>
                </div>
              </section>

              {/* ── Create Geofence ── */}
              <section>
                <p className="section-label">Create Geofence</p>
                <form className="geofence-form" onSubmit={handleSaveGeofence} noValidate>
                  <div className="form-group">
                    <label htmlFor="geo-label">Label</label>
                    <input
                      id="geo-label"
                      type="text"
                      placeholder="e.g., Home, School, Office"
                      className={formErrors.label ? 'input-error' : ''}
                      value={formState.label}
                      onChange={e => { setFormState(s => ({ ...s, label: e.target.value })); setFormErrors(f => ({ ...f, label: undefined })); }}
                    />
                    {formErrors.label && <span className="form-error">{formErrors.label}</span>}
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="geo-lat">Latitude</label>
                      <input
                        id="geo-lat" type="number" step="any" placeholder="30.3398"
                        className={formErrors.centerLat ? 'input-error' : ''}
                        value={formState.centerLat}
                        onChange={e => setFormState(s => ({ ...s, centerLat: e.target.value }))}
                      />
                      {formErrors.centerLat && <span className="form-error">{formErrors.centerLat}</span>}
                    </div>
                    <div className="form-group">
                      <label htmlFor="geo-lng">Longitude</label>
                      <input
                        id="geo-lng" type="number" step="any" placeholder="76.3869"
                        className={formErrors.centerLng ? 'input-error' : ''}
                        value={formState.centerLng}
                        onChange={e => setFormState(s => ({ ...s, centerLng: e.target.value }))}
                      />
                      {formErrors.centerLng && <span className="form-error">{formErrors.centerLng}</span>}
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="geo-radius">Radius (meters)</label>
                    <input
                      id="geo-radius" type="number" min="1" placeholder="500"
                      className={formErrors.radiusMeters ? 'input-error' : ''}
                      value={formState.radiusMeters}
                      onChange={e => setFormState(s => ({ ...s, radiusMeters: e.target.value }))}
                    />
                    {formErrors.radiusMeters && <span className="form-error">{formErrors.radiusMeters}</span>}
                  </div>

                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? <><span className="spinner" /> Saving…</> : <><Crosshair size={14} /> Save Geofence</>}
                  </button>
                  <p className="form-hint"><MapPin size={12} /> Click the map to set coordinates</p>
                </form>
              </section>

              {/* ── Saved Geofences ── */}
              <section>
                <p className="section-label">Saved Geofences ({geofences.length})</p>
                {geofencesLoading ? (
                  <div className="empty-state"><span className="spinner" /></div>
                ) : geofences.length === 0 ? (
                  <div className="empty-state">
                    <MapPin size={28} />
                    <p>No geofences yet.<br />Click the map and create one above.</p>
                  </div>
                ) : (
                  <div className="geofence-list">
                    {geofences.map(g => (
                      <div key={g.id} className="geofence-card">
                        <div className="geofence-card-info">
                          <div className="geofence-card-name">{g.label}</div>
                          <div className="geofence-card-coords">
                            {g.centerLatitude.toFixed(4)}, {g.centerLongitude.toFixed(4)} · {g.radiusMeters}m
                          </div>
                        </div>
                        <div className="geofence-card-actions">
                          <button className="btn btn-ghost" title={`Zoom to ${g.label}`}
                            onClick={() => { setFlyTo([g.centerLatitude, g.centerLongitude]); pushToast(`Zoomed to ${g.label}`); }}>
                            <ChevronRight size={14} />
                          </button>
                          <button className="btn btn-danger-ghost" title={`Delete ${g.label}`}
                            onClick={() => setConfirmDelete({ id: g.id, label: g.label })}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ── Device Telemetry ── */}
              {pkt && (
                <section>
                  <p className="section-label">Device Telemetry</p>
                  <div className="device-info">
                    <div className="device-info-item">
                      <div className="device-info-label">Device</div>
                      <div className="device-info-value">{pkt.deviceKey || '—'}</div>
                    </div>
                    <div className="device-info-item">
                      <div className="device-info-label">Phase</div>
                      <div className="device-info-value">{pkt.phase || pkt.motionState || '—'}</div>
                    </div>
                    <div className="device-info-item">
                      <div className="device-info-label">Speed</div>
                      <div className="device-info-value">{pkt.speedKph != null ? `${Number(pkt.speedKph).toFixed(1)} km/h` : '—'}</div>
                    </div>
                    <div className="device-info-item">
                      <div className="device-info-label">Deviation</div>
                      <div className={`device-info-value ${scoreClass}`}>
                        {devScore !== null ? devScore.toFixed(3) : '—'}
                      </div>
                    </div>
                    {pkt.nearestGeofence && (
                      <div className="device-info-item">
                        <div className="device-info-label">Nearest</div>
                        <div className="device-info-value">{pkt.nearestGeofence}</div>
                      </div>
                    )}
                    {pkt.distToNearestKm != null && (
                      <div className="device-info-item">
                        <div className="device-info-label">Distance</div>
                        <div className={`device-info-value ${pkt.distToNearestKm > 2 ? 'value-bad' : pkt.distToNearestKm > 0.5 ? 'value-warn' : 'value-good'}`}>
                          {pkt.distToNearestKm.toFixed(2)} km
                        </div>
                      </div>
                    )}
                    {pkt.batteryPercent != null && (
                      <div className="device-info-item">
                        <div className="device-info-label">Battery</div>
                        <div className={`device-info-value ${Number(pkt.batteryPercent) < 20 ? 'value-bad' : 'value-good'}`}>
                          {pkt.batteryPercent}%
                        </div>
                      </div>
                    )}
                    {pkt.capturedAtUtc && (
                      <div className="device-info-item">
                        <div className="device-info-label">Last Seen</div>
                        <div className="device-info-value" style={{ fontSize: '0.75rem' }}>
                          {new Date(pkt.capturedAtUtc).toLocaleTimeString()}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </>
          )}

          {/* ════════════════════════ TAB: Alerts ════════════════════════ */}
          {activeTab === 'alerts' && (
            <section>
              <div className="section-header-row">
                <p className="section-label">Alert History</p>
                {alerts.length > 0 && (
                  <button className="btn btn-ghost btn-sm" onClick={handleAckAll}>
                    <Eye size={12} /> Mark All Read
                  </button>
                )}
              </div>

              {alerts.length === 0 ? (
                <div className="empty-state">
                  <Bell size={28} />
                  <p>No alerts yet.<br />Alerts will appear when anomalies are detected during simulation.</p>
                </div>
              ) : (
                <div className="alert-list">
                  {alerts.map(a => (
                    <div key={a.id} className={`alert-card ${!a.acknowledged ? 'alert-card--unread' : ''} alert-card--${a.type}`}>
                      <div className="alert-card-icon">
                        {a.type === 'out_of_zone' ? <ShieldAlert size={16} /> :
                         a.type === 'low_battery' ? <BatteryLow size={16} /> :
                         <AlertTriangle size={16} />}
                      </div>
                      <div className="alert-card-body">
                        <div className="alert-card-type">
                          {a.type === 'out_of_zone' ? 'Out of Safety Zone' :
                           a.type === 'low_battery' ? 'Low Battery' : 'Anomaly Detected'}
                        </div>
                        <div className="alert-card-detail">{a.message}</div>
                        <div className="alert-card-time">
                          <Clock size={10} /> {new Date(a.timestamp).toLocaleString()}
                        </div>
                      </div>
                      {!a.acknowledged && (
                        <button className="btn btn-ghost btn-sm" onClick={() => handleAckAlert(a.id)} title="Acknowledge">
                          <CheckCircle size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ════════════════════════ TAB: Battery ════════════════════════ */}
          {activeTab === 'battery' && (
            <section>
              <p className="section-label">Battery Statistics</p>

              {batStats.current === null ? (
                <div className="empty-state">
                  <Battery size={28} />
                  <p>No battery data yet.<br />Start simulation to begin tracking battery.</p>
                </div>
              ) : (
                <>
                  {/* Battery gauge */}
                  <div className="battery-gauge">
                    <div className="battery-gauge-ring">
                      <svg viewBox="0 0 120 120" width="120" height="120">
                        <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="8" />
                        <circle cx="60" cy="60" r="52" fill="none"
                          stroke={batStats.current < 20 ? 'var(--danger)' : batStats.current < 50 ? 'var(--warning-text)' : 'var(--success)'}
                          strokeWidth="8"
                          strokeDasharray={`${(batStats.current / 100) * 327} 327`}
                          strokeLinecap="round"
                          transform="rotate(-90 60 60)"
                        />
                      </svg>
                      <div className="battery-gauge-text">
                        <span className="battery-gauge-value">{batStats.current}</span>
                        <span className="battery-gauge-unit">%</span>
                      </div>
                    </div>
                    <div className="battery-gauge-label">Current Battery</div>
                  </div>

                  {/* Battery stats grid */}
                  <div className="device-info">
                    <div className="device-info-item">
                      <div className="device-info-label">Average</div>
                      <div className="device-info-value">{batStats.avg}%</div>
                    </div>
                    <div className="device-info-item">
                      <div className="device-info-label">Minimum</div>
                      <div className={`device-info-value ${batStats.min < 20 ? 'value-bad' : 'value-good'}`}>{batStats.min}%</div>
                    </div>
                    <div className="device-info-item">
                      <div className="device-info-label">Low Events</div>
                      <div className={`device-info-value ${batStats.lowEvents > 0 ? 'value-bad' : 'value-good'}`}>{batStats.lowEvents}</div>
                    </div>
                    <div className="device-info-item">
                      <div className="device-info-label">Trend</div>
                      <div className={`device-info-value ${batStats.trend === 'decreasing' ? 'value-bad' : batStats.trend === 'increasing' ? 'value-good' : ''}`}>
                        {batStats.trend === 'decreasing' ? <><TrendingDown size={12} /> Decreasing</> :
                         batStats.trend === 'increasing' ? <><TrendingUp size={12} /> Increasing</> : 'Stable'}
                      </div>
                    </div>
                    <div className="device-info-item">
                      <div className="device-info-label">Readings</div>
                      <div className="device-info-value">{batStats.totalReadings}</div>
                    </div>
                  </div>

                  {/* Sparkline */}
                  {batStats.recentReadings.length > 1 && (
                    <div className="battery-sparkline">
                      <p className="section-label" style={{ fontSize: '0.7rem', marginBottom: '4px' }}>Recent Trend</p>
                      <Sparkline
                        data={batStats.recentReadings.map(r => r.value)}
                        width={280}
                        height={50}
                        color={batStats.current < 20 ? '#ef4444' : '#10b981'}
                      />
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {/* ════════════════════════ TAB: Progress ════════════════════════ */}
          {activeTab === 'progress' && (
            <section>
              <p className="section-label">Progress (8 Months)</p>

              {monthsWithData === 0 ? (
                <div className="empty-state">
                  <BarChart3 size={28} />
                  <p>No historical data yet.<br />Progress data will accumulate as you use the simulation over time.</p>
                </div>
              ) : (
                <>
                  {monthsWithData < 2 && (
                    <div className="info-banner">
                      <Clock size={14} />
                      Insufficient history for trend comparison. Data will accumulate over time.
                    </div>
                  )}
                  <div className="progress-table">
                    <div className="progress-header">
                      <span>Month</span>
                      <span>Alerts</span>
                      <span>Breaches</span>
                      <span>Anomalies</span>
                      <span>Bat. Avg</span>
                    </div>
                    {progress.map(p => (
                      <div key={p.month} className={`progress-row ${!p.hasData ? 'progress-row--empty' : ''} ${p.month === progress[progress.length - 1].month ? 'progress-row--current' : ''}`}>
                        <span className="progress-month">{p.label}</span>
                        <span>{p.hasData ? p.alerts : '—'}</span>
                        <span className={p.breaches > 0 ? 'value-bad' : ''}>{p.hasData ? p.breaches : '—'}</span>
                        <span className={p.anomalies > 0 ? 'value-warn' : ''}>{p.hasData ? p.anomalies : '—'}</span>
                        <span>{p.batteryAvg != null ? `${p.batteryAvg}%` : '—'}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

        </div>
      </aside>
    </div>
  );
}

export default App;
