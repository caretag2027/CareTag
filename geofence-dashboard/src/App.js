import {
  AlertTriangle, Bell, CheckCircle,
  Crosshair, LogOut, MapPin,
  Shield, ShieldCheck,
  Radio, Clock,
  Check, Terminal, Sliders, Maximize2, Minimize2,
  Navigation, X, ChevronDown, Car, Smartphone,
  Plus
} from 'lucide-react';
import {
  Circle, MapContainer, Marker, Popup, TileLayer, useMap, Polyline, useMapEvents
} from 'react-leaflet';
import L from 'leaflet';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from './api';
import simulation, { SCENARIO_PRESETS } from './simulation';
import auth, { DEDICATED_ACCOUNTS } from './auth';
import alertStore from './alertStore';
import deviceStore from './deviceStore';
import CareTagLogo from './components/CareTagLogo';
import LandingPage from './components/LandingPage';
import TaggyChatbot from './components/TaggyChatbot';
import CookieBanner from './components/CookieBanner';
import AuthPage from './components/AuthPage';
import {
  subscribeHardwareTelemetry,
  saveRoutineObservationToFirebase,
  fetchRoutineHistoryFromFirebase,
  fetchRoutineProfileFromFirebase
} from './firebase';
import FirstTimeSetupWizard from './components/FirstTimeSetupWizard';
import CaregiverOverview from './components/CaregiverOverview';
import TechnicalInspector from './components/TechnicalInspector';
import SafeZoneManager from './components/SafeZoneManager';
import {
  getDeviceStatusMeta,
  DEVICE_STATUS,
  isScheduleActive,
  evaluateSafetyState,
  getZoneCategoryColor
} from './utils/dashboardUtils';

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
          <svg width="22" height="22" viewBox="0 0 100 100" fill="none">
            <circle cx="34" cy="22" r="10.5" fill="#FFFFFF" />
            <circle cx="66" cy="28" r="8" fill="#7DD3C7" />
            <path d="M 33 37 C 16 42, 6 56, 12 73 C 18 87, 34 94, 50 97 C 40 88, 30 76, 30 65 C 30 52, 38 46, 46 53 C 41 44, 38 39, 33 37 Z" fill="#FFFFFF" />
            <path d="M 66 40 C 77 44, 88 54, 86 68 C 84 80, 71 89, 50 97 C 58 87, 65 77, 65 67 C 65 57, 58 53, 50 61 C 56 49, 61 43, 66 40 Z" fill="#7DD3C7" />
          </svg>
        </div>
      </div>
    `,
  });
}

const deviceIconNormal = makeDeviceIcon(false);
const deviceIconAlert = makeDeviceIcon(true);

function makeDraftMarkerIcon() {
  return L.divIcon({
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
    html: `
      <div style="background:#2563EB; width:36px; height:36px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(37,99,235,0.4); border:2px solid #FFFFFF;">
        <div style="width:12px; height:12px; background:#FFFFFF; border-radius:50%; transform:rotate(45deg);"></div>
      </div>
    `,
  });
}
const draftMarkerIcon = makeDraftMarkerIcon();

/**
 * Dependable FlyTo handler using a sequence counter to allow re-centering on the same location
 */
function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (!target || !target.latlng) return;
    map.flyTo(target.latlng, target.zoom || Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [target, map]);
  return null;
}

/**
 * Captures map clicks when interactive placement or safe-zone editing is active
 */
function MapClickHandler({ isMapPickActive, onMapClick }) {
  useMapEvents({
    click(e) {
      if (isMapPickActive && onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    }
  });
  return null;
}

/**
 * MapResizeHandler:
 * Automatically invalidates Leaflet map size on container resize and mode changes
 */
function MapResizeHandler({ isMapExpanded }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 80);
    const t2 = setTimeout(() => map.invalidateSize(), 250);
    const t3 = setTimeout(() => map.invalidateSize(), 500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isMapExpanded, map]);

  useEffect(() => {
    const container = map.getContainer();
    if (!container || typeof ResizeObserver === 'undefined') return;

    let resizeTimer = null;
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        map.invalidateSize();
      }, 50);
    });

    observer.observe(container);
    return () => {
      clearTimeout(resizeTimer);
      observer.disconnect();
    };
  }, [map]);

  return null;
}



/* ──────────────────────────────────────────────────────────────
   Main App: Landing Showcase, Auth, and Live Dashboard Views
   ────────────────────────────────────────────────────────────── */

function App() {
  const [session, setSession] = useState(() => auth.getSession());
  const [view, setView] = useState('landing');
  const [dashboardInitialTab, setDashboardInitialTab] = useState('overview');

  // Enforce private dashboard isolation: redirect to auth if attempting to access dashboard unauthenticated
  useEffect(() => {
    if (view === 'dashboard' && !session) {
      setView('auth');
    }
  }, [view, session]);

  const handleLaunchDashboard = (targetTab = 'overview') => {
    setDashboardInitialTab(targetTab);
    if (session) {
      setView('dashboard');
    } else {
      setView('auth');
    }
  };

  const handleOpenInspector = () => {
    // If not authenticated, automatically authenticate as primary demo evaluator so the visitor can immediately experience live telemetry without a login wall
    if (!session) {
      const demoAccount = DEDICATED_ACCOUNTS && DEDICATED_ACCOUNTS.length > 0
        ? DEDICATED_ACCOUNTS[0]
        : {
            id: 'usr_singla_be23',
            name: 'Bhavishya Singla',
            email: 'singla_be23@thapar.edu',
            role: 'admin',
            deviceKey: 'CARE-TAG-01'
          };
      const demoSession = {
        userId: demoAccount.id,
        name: demoAccount.name,
        email: demoAccount.email,
        role: demoAccount.role || 'admin',
        deviceKey: demoAccount.deviceKey || 'CARE-TAG-01',
        department: demoAccount.department || 'Computer Engineering (BE23)',
        institution: demoAccount.institution || 'Thapar Institute of Engineering & Technology',
        backend: 'demo-evaluator',
      };
      localStorage.setItem('caretag.session', JSON.stringify(demoSession));
      setSession(demoSession);
    }
    setDashboardInitialTab('inspector');
    setView('dashboard');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('caretag:navigate-tab', { detail: 'inspector' }));
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('caretag:navigate-tab', { detail: 'inspector' }));
        const el = document.querySelector('.tech-inspector-drawer') || document.querySelector('.caretag-content-pane');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  };

  return (
    <>
      {view === 'landing' && (
        <>
          <LandingPage
            onLaunchDashboard={handleLaunchDashboard}
            onOpenAuth={() => setView('auth')}
            onOpenInspector={handleOpenInspector}
            session={session}
          />
          <TaggyChatbot
            currentView="landing"
            onLaunchDashboard={handleLaunchDashboard}
            onOpenAuth={() => setView('auth')}
            onOpenInspector={handleOpenInspector}
          />
        </>
      )}

      {view === 'auth' && (
        <AuthPage
          onLogin={(s) => {
            setSession(s);
            setView('dashboard');
          }}
          onBackToLanding={() => setView('landing')}
        />
      )}

      {view === 'dashboard' && session && (
        <Dashboard
          session={session}
          initialTab={dashboardInitialTab}
          onLogout={() => {
            auth.logout();
            setSession(null);
            setView('landing');
          }}
          onGoToLanding={() => setView('landing')}
        />
      )}

      {view === 'landing' && <CookieBanner />}
    </>
  );
}

/* ──────────────────────────────────────────────────────────────
   CareTag Redesigned Dashboard Component
   ────────────────────────────────────────────────────────────── */

function Dashboard({ session, onLogout, onGoToLanding, initialTab = 'overview' }) {
  const userId = session.userId;

  // ── Multi-Device & Profile Management ──
  const [devicesList, setDevicesList] = useState(() => deviceStore.loadUserDevices(userId));
  const [selectedDeviceKey, setSelectedDeviceKey] = useState(() => deviceStore.getActiveDeviceKey(userId, session.deviceKey || 'CARE-TAG-01'));
  const [isDeviceMenuOpen, setIsDeviceMenuOpen] = useState(false);
  const [showLinkDeviceModal, setShowLinkDeviceModal] = useState(false);
  const [newDeviceKeyInput, setNewDeviceKeyInput] = useState('');
  const [newChildNameInput, setNewChildNameInput] = useState('');
  const [newAgeInput, setNewAgeInput] = useState('8');
  const [newRelationInput, setNewRelationInput] = useState('Child');
  const [linkError, setLinkError] = useState('');

  // Active Profile metadata derived from selected wearable device
  const activeProfile = devicesList.find(d => d.deviceKey === selectedDeviceKey) || devicesList[0] || {
    deviceKey: selectedDeviceKey,
    childName: session?.childName || 'Monitored Profile',
    relation: 'Child',
    avatarColor: '#2563EB',
    hardwareModel: 'ESP32 Smart Band',
  };
  const monitoredName = activeProfile.childName;
  const monitoredInitial = (monitoredName.trim().charAt(0) || 'C').toUpperCase();
  const deviceDisplayName = `${monitoredName.split(' ')[0]}'s Smart Band (${selectedDeviceKey})`;

  // ── Trip Mode & Alert Preferences State ──
  const [tripMode, setTripModeState] = useState(() => alertStore.getTripMode(userId, selectedDeviceKey));

  // Periodic heartbeat checking for Trip Mode auto-expiration
  useEffect(() => {
    setTripModeState(alertStore.getTripMode(userId, selectedDeviceKey));
    const timer = setInterval(() => {
      setTripModeState(alertStore.getTripMode(userId, selectedDeviceKey));
    }, 10000);
    return () => clearInterval(timer);
  }, [userId, selectedDeviceKey]);

  const handleSetTripMode = useCallback((durationMinutes = 60) => {
    alertStore.setTripMode(userId, selectedDeviceKey, durationMinutes);
    const updated = alertStore.getTripMode(userId, selectedDeviceKey);
    setTripModeState(updated);
  }, [userId, selectedDeviceKey]);

  const handleEndTripMode = useCallback(() => {
    alertStore.clearTripMode(userId, selectedDeviceKey);
    setTripModeState({ active: false, expiresAt: null, durationMinutes: 0 });
  }, [userId, selectedDeviceKey]);

  // ── Core Data state ──
  const [latest, setLatest] = useState(null);
  const [geofences, setGeofences] = useState([]);
  const [selectedZoneId, setSelectedZoneId] = useState(null);

  // ── Smart Band Physical Hardware state ──
  const [isLiveHardwareMode, setIsLiveHardwareMode] = useState(true);
  const [hardwareStatus, setHardwareStatus] = useState({
    connected: false,
    isHardwareStreaming: false,
    isStale: false,
    statusText: `CONNECTING TO ${selectedDeviceKey}...`,
    batteryPercent: 92,
  });

  // ── Simulation state ──
  const [simRunning, setSimRunning] = useState(false);
  const [activeScenario, setActiveScenario] = useState(null);
  const [simulatedAlerts, setSimulatedAlerts] = useState([]);

  // ── Alerts & Telemetry stores (Device-Scoped) ──
  const [alerts, setAlerts] = useState(() => alertStore.loadDeviceAlerts(userId, selectedDeviceKey));
  const [unackCount, setUnackCount] = useState(() => alertStore.getUnacknowledgedCount(userId));

  // ── Interactive Map & Draft Safe-Zone State ──
  const [draftZone, setDraftZone] = useState(null);
  const [isMapPickActive, setIsMapPickActive] = useState(false);
  const [recentTrail, setRecentTrail] = useState([]);
  const [evaluationLog, setEvaluationLog] = useState([]);

  // ── Routine History & Profile state (Device-Scoped) ──
  const [routineHistory, setRoutineHistory] = useState({});
  const [routineProfile, setRoutineProfile] = useState(null);

  // ── Navigation & UI State ──
  // Tabs: 'overview' | 'safezones' | 'alerts' | 'inspector'
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [showExpectedRoute, setShowExpectedRoute] = useState(true);
  const [flyToTarget, setFlyToTarget] = useState(null);
  const [toasts, setToasts] = useState([]);

  // Synchronize activeTab whenever initialTab changes
  useEffect(() => {
    if (initialTab) {
      setShowSetupWizard(false);
      setIsMapExpanded(false);
      setActiveTab(initialTab);
      if (initialTab === 'inspector') {
        setTimeout(() => {
          const el = document.querySelector('.tech-inspector-drawer') || document.querySelector('.caretag-content-pane');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      }
    }
  }, [initialTab]);

  // Resilient tab and inspector navigation that clears overlaying modals/views
  const handleOpenInspector = useCallback(() => {
    setShowSetupWizard(false);
    setIsMapExpanded(false);
    setActiveTab('inspector');
    setTimeout(() => {
      const el = document.querySelector('.tech-inspector-drawer') || document.querySelector('.caretag-content-pane');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);

  const handleNavigateTab = useCallback((tab) => {
    setShowSetupWizard(false);
    setIsMapExpanded(false);
    setActiveTab(tab);
    if (tab === 'inspector') {
      setTimeout(() => {
        const el = document.querySelector('.tech-inspector-drawer') || document.querySelector('.caretag-content-pane');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, []);

  // Listen for global navigation events from chatbot or landing page
  useEffect(() => {
    const handleNavEvent = (e) => {
      if (e.detail) {
        setShowSetupWizard(false);
        setIsMapExpanded(false);
        setActiveTab(e.detail);
        if (e.detail === 'inspector') {
          setTimeout(() => {
            const el = document.querySelector('.tech-inspector-drawer') || document.querySelector('.caretag-content-pane');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        }
      }
    };
    window.addEventListener('caretag:navigate-tab', handleNavEvent);
    return () => window.removeEventListener('caretag:navigate-tab', handleNavEvent);
  }, []);

  const geofencesRef = useRef(geofences);
  useEffect(() => {
    geofencesRef.current = geofences;
  }, [geofences]);

  const lastObservedRecordTime = useRef(0);

  // Toast notification dispatcher
  const pushToast = useCallback((text, type = 'info', ttl = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), ttl);
  }, []);

  // Reload alerts from persistent store (scoped to selected device)
  const refreshAlerts = useCallback(() => {
    setAlerts(alertStore.loadDeviceAlerts(userId, selectedDeviceKey));
    setUnackCount(alertStore.getUnacknowledgedCount(userId));
  }, [userId, selectedDeviceKey]);

  // Load Geofences and Routine data from Firebase & local stores
  const loadData = useCallback(async (targetDeviceKey) => {
    const dKey = targetDeviceKey || selectedDeviceKey;
    try {
      const list = await api.fetchGeofences(dKey, userId);
      setGeofences(list || []);

      // Load routine history and profile from Firebase RTDB for selected device
      const history = await fetchRoutineHistoryFromFirebase(dKey);
      setRoutineHistory(history || {});
      const prof = await fetchRoutineProfileFromFirebase(dKey);
      setRoutineProfile(prof || null);

      // If user has zero safe places and has not dismissed wizard, show wizard
      const hasCompleted = localStorage.getItem(`caretag_setup_completed_${userId}`);
      if ((!list || list.length === 0) && !hasCompleted) {
        setShowSetupWizard(true);
      }
    } catch {
      pushToast('Unable to synchronize safe places with server', 'error');
    }
  }, [selectedDeviceKey, userId, pushToast]);

  useEffect(() => {
    loadData(selectedDeviceKey);
  }, [loadData, selectedDeviceKey]);

  // ── Device Switch Handler with Clean State Isolation ──
  const handleSwitchDevice = useCallback((newKey) => {
    if (newKey === selectedDeviceKey) {
      setIsDeviceMenuOpen(false);
      return;
    }
    // Cleanly isolate states: clear previous device data to avoid brief leakage
    setLatest(null);
    setRecentTrail([]);
    setEvaluationLog([]);
    setGeofences([]);
    setRoutineHistory({});
    setRoutineProfile(null);
    setHardwareStatus({
      connected: false,
      isHardwareStreaming: false,
      isStale: false,
      statusText: `CONNECTING TO ${newKey}...`,
      batteryPercent: 92,
      deviceStatus: DEVICE_STATUS.CONNECTING,
    });
    setSelectedDeviceKey(newKey);
    deviceStore.setActiveDeviceKey(userId, newKey);
    setIsDeviceMenuOpen(false);
    pushToast(`Switched active profile to ${newKey}`, 'info');
  }, [selectedDeviceKey, userId, pushToast]);

  // ── Link New Device Handler ──
  const handleLinkDeviceSubmit = (e) => {
    e.preventDefault();
    setLinkError('');
    const res = deviceStore.linkNewDevice(userId, {
      deviceKey: newDeviceKeyInput,
      childName: newChildNameInput,
      age: newAgeInput,
      relation: newRelationInput,
    });
    if (!res.ok) {
      setLinkError(res.error || 'Failed to link device');
      return;
    }
    setDevicesList(res.devices);
    handleSwitchDevice(res.device.deviceKey);
    setShowLinkDeviceModal(false);
    setNewDeviceKeyInput('');
    setNewChildNameInput('');
    pushToast(`Linked ${res.device.deviceKey} (${res.device.childName}) successfully!`, 'success');
  };

  // ── Real-Time Safe Places Synchronization across users & devices ──
  useEffect(() => {
    let mounted = true;
    const unsubscribe = api.subscribeSafeZones(selectedDeviceKey, userId, (updatedList) => {
      if (mounted && Array.isArray(updatedList) && updatedList.length > 0) {
        setGeofences(updatedList);
      }
    });
    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [selectedDeviceKey, userId]);

  // ── Live Hardware Telemetry Subscription (Firebase RTDB, Device-Scoped) ──
  useEffect(() => {
    let mounted = true;

    const unsubscribe = subscribeHardwareTelemetry(
      (hwPacket) => {
        if (!mounted || !hwPacket) return;

        // Only update current display packet if live hardware mode is active and sim is not running
        if (!simRunning && isLiveHardwareMode) {
          const currentGeos = geofencesRef.current || [];
          
          // Evaluate safety state using scheduled geofencing and jitter suppression
          const safetyResult = evaluateSafetyState(hwPacket, currentGeos);

          // Update recent movement trail
          if (hwPacket.latitude && hwPacket.longitude) {
            setRecentTrail(prev => {
              const updated = [...prev, [hwPacket.latitude, hwPacket.longitude]];
              return updated.slice(-15);
            });
          }

          // Telemetry Enrichment
          const enriched = {
            ...hwPacket,
            nearestGeofence: safetyResult.nearestZone,
            distToNearestKm: Math.abs(safetyResult.distanceToBoundaryKm),
            isAnomaly: safetyResult.status === 'deviation' || safetyResult.status === 'outside',
            deviationScore: safetyResult.status === 'deviation' ? 0.85 : 0.05,
            safetyStatus: safetyResult.status,
            safetyExplanation: safetyResult.explanation,
          };

          setLatest({ lat: enriched.latitude, lng: enriched.longitude, packet: enriched });

          // Record evaluation in technical inspector log
          setEvaluationLog(prev => [
            {
              time: new Date().toLocaleTimeString(),
              zone: safetyResult.nearestZone || 'Safe Place',
              distanceMeters: Math.round(Math.abs(safetyResult.distanceToBoundaryKm) * 1000),
              event: safetyResult.eventType || 'None',
              reason: safetyResult.explanation,
            },
            ...prev.slice(0, 19)
          ]);

          // Handle real safety alert events (only boundary_breach and route_deviation)
          if (safetyResult.status === 'outside' && safetyResult.isScheduledActive) {
            const lastOutAlert = alertStore.getRecentAlerts(userId, 1)[0];
            const isRecent = lastOutAlert && (Date.now() - new Date(lastOutAlert.timestamp).getTime()) < 60000;
            if (!isRecent) {
              alertStore.saveAlert(userId, {
                type: 'boundary_breach',
                deviceId: selectedDeviceKey,
                latitude: enriched.latitude,
                longitude: enriched.longitude,
                nearestGeofence: safetyResult.nearestZone,
                message: `Child stepped outside safe place boundary by ${(safetyResult.distanceToBoundaryKm * 1000).toFixed(0)}m.`,
                distanceMeters: Math.round(safetyResult.distanceToBoundaryKm * 1000),
                source: 'hardware',
              });
              refreshAlerts();
              pushToast(`Safety Alert: Child outside "${safetyResult.nearestZone}"`, 'warning');
            }
          } else if (safetyResult.status === 'deviation') {
            // Check if Trip Mode is active or deviation alerts are muted
            const activeTrip = alertStore.getTripMode(userId, selectedDeviceKey);
            const alertPrefs = alertStore.getAlertPreferences(userId, selectedDeviceKey);

            if (!activeTrip.active && alertPrefs.deviationAlerts) {
              const lastDevAlert = alertStore.getRecentAlerts(userId, 1)[0];
              const isRecent = lastDevAlert && (Date.now() - new Date(lastDevAlert.timestamp).getTime()) < 60000;
              if (!isRecent) {
                alertStore.saveAlert(userId, {
                  type: 'route_deviation',
                  deviceId: selectedDeviceKey,
                  latitude: enriched.latitude,
                  longitude: enriched.longitude,
                  nearestGeofence: safetyResult.nearestZone,
                  message: 'Child deviated from established daily route corridor.',
                  source: 'hardware',
                });
                refreshAlerts();
                pushToast('Notice: Route deviation flagged against learned pattern', 'info');
              }
            }
          }

          // Persist eligible telemetry for routine model (rate-limited to every 30s)
          const now = Date.now();
          if (now - lastObservedRecordTime.current >= 30000 && hwPacket.gps?.valid) {
            lastObservedRecordTime.current = now;
            saveRoutineObservationToFirebase(selectedDeviceKey, hwPacket).catch(() => {});
          }
        }
      },
      (hwStatus) => {
        if (!mounted) return;
        setHardwareStatus(hwStatus);
      },
      { deviceKey: selectedDeviceKey }
    );

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [simRunning, isLiveHardwareMode, userId, selectedDeviceKey, pushToast, refreshAlerts]);

  // ── Capstone Scenario Simulation Controls (Strictly Isolated) ──
  const handleStartScenario = (scenarioId) => {
    setIsLiveHardwareMode(false);
    setSimRunning(true);
    setActiveScenario(scenarioId);

    const scenarioMeta = SCENARIO_PRESETS[scenarioId] || scenarioId;
    pushToast(`Simulation Active: Running ${scenarioMeta}`, 'info');

    simulation.startScenario(scenarioId, geofencesRef.current, (simPacket) => {
      setLatest({ lat: simPacket.latitude, lng: simPacket.longitude, packet: simPacket });

      // If simulated packet triggers an anomaly, store ONLY in simulated alerts (NEVER pollutes real history)
      if (simPacket.isAnomaly) {
        setSimulatedAlerts(prev => [
          {
            id: `sim-alert-${Date.now()}`,
            type: simPacket.eventType,
            category: simPacket.eventType,
            timestamp: new Date().toISOString(),
            latitude: simPacket.latitude,
            longitude: simPacket.longitude,
            nearestGeofence: simPacket.nearestGeofence,
            message: simPacket.eventType === 'boundary_breach'
              ? `Simulated boundary breach: device stepped outside "${simPacket.nearestGeofence}"`
              : 'Simulated route deviation: device departed from learned corridor',
            source: 'simulation',
            scenarioId,
          },
          ...prev.slice(0, 19)
        ]);
      }
    });
  };

  const handleStopScenario = () => {
    simulation.stop();
    setSimRunning(false);
    setActiveScenario(null);
    setIsLiveHardwareMode(true);
    pushToast('Simulation stopped. Resumed live hardware telemetry.', 'info');
  };

  const handleResetScenario = () => {
    simulation.reset();
    setSimRunning(false);
    setActiveScenario(null);
    setSimulatedAlerts([]);
    setIsLiveHardwareMode(true);
    pushToast('Simulation reset. Returned to live hardware mode.', 'info');
  };

  const handleManualSimulate = (lat, lon, speed) => {
    setIsLiveHardwareMode(false);
    setSimRunning(true);
    setActiveScenario('manual_custom');
    simulation.setManualPosition(lat, lon, speed);
    pushToast(`Injected coordinates: ${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}`, 'info');
  };

  // ── Safe Zone Management Handlers ──
  const handleSaveGeofence = async (zoneData) => {
    try {
      const created = await api.createGeofence(zoneData, selectedDeviceKey, userId);
      setGeofences(prev => {
        const idx = prev.findIndex(g => String(g.id) === String(created.id));
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = created;
          return updated;
        }
        return [...prev, created];
      });
      setSelectedZoneId(created.id);
      setFlyToTarget({ latlng: [created.centerLatitude, created.centerLongitude], timestamp: Date.now() });
      pushToast(`Safe place "${created.label}" saved and active.`, 'success');
      return created;
    } catch (err) {
      pushToast(`Failed to save safe place: ${err.message}`, 'error');
      return false;
    }
  };

  const handleUpdateGeofence = async (id, updates) => {
    try {
      const updated = await api.updateGeofence(id, updates, selectedDeviceKey, userId);
      setGeofences(prev => prev.map(g => String(g.id) === String(id) ? { ...g, ...updated } : g));
      pushToast('Safe place updated.', 'success');
      return updated;
    } catch (err) {
      pushToast(`Failed to update: ${err.message}`, 'error');
      return false;
    }
  };

  const handleDeleteGeofence = async (id) => {
    try {
      await api.deleteGeofence(selectedDeviceKey, id, userId);
      setGeofences(prev => prev.filter(g => String(g.id) !== String(id)));
      if (selectedZoneId === id) setSelectedZoneId(null);
      pushToast('Safe place removed.', 'info');
      return true;
    } catch {
      pushToast('Failed to delete safe place.', 'error');
      return false;
    }
  };

  const handleAcknowledgeAlert = (alertId) => {
    alertStore.acknowledgeAlert(userId, alertId);
    refreshAlerts();
    pushToast('Alert marked as acknowledged.', 'info');
  };

  const handleAcknowledgeAll = () => {
    alertStore.acknowledgeAll(userId);
    refreshAlerts();
    pushToast('All alerts acknowledged.', 'info');
  };

  const handleInspectAlertOnMap = (alertItem) => {
    if (alertItem.latitude && alertItem.longitude) {
      setFlyToTarget({ latlng: [alertItem.latitude, alertItem.longitude], timestamp: Date.now() });
      pushToast(`Centering map on alert location (${alertItem.nearestGeofence || 'Location'})`, 'info');
    }
  };

  // Map click handler for placing or editing a zone
  const handleMapClick = (clickLat, clickLng) => {
    if (draftZone) {
      setDraftZone(prev => ({
        ...prev,
        centerLatitude: parseFloat(clickLat.toFixed(6)),
        centerLongitude: parseFloat(clickLng.toFixed(6)),
        _fromMap: true,
      }));
    }
  };

  // Coordinates fallback if not yet received
  const mapCenterLat = latest?.lat || (geofences[0] ? geofences[0].centerLatitude : 30.3491155);
  const mapCenterLng = latest?.lng || (geofences[0] ? geofences[0].centerLongitude : 76.4117108);

  // Expected route corridor coordinates:
  // Strictly only displayed when valid learned corridor exists with sufficient history,
  // or when an active demonstration scenario defines a simulation corridor.
  // NEVER connect safe-place circles together!
  const routeWaypoints = simRunning && activeScenario && SCENARIO_PRESETS[activeScenario]?.routePoints
    ? SCENARIO_PRESETS[activeScenario].routePoints
    : (routineProfile?.hasSufficientHistory && Array.isArray(routineProfile?.learnedCorridor) && routineProfile.learnedCorridor.length >= 2)
    ? routineProfile.learnedCorridor
    : [];

  // Active top alert (only non-nominal)
  const topAlert = alerts.find(a => !a.acknowledged && a.type !== 'nominal_safety');

  return (
    <div className="caretag-app-shell">
      {/* ── Caregiver Navigation Header ── */}
      <header className="caretag-header" role="banner">
        <div className="caretag-header-left">
          <button
            type="button"
            className="brand-home-link"
            onClick={onGoToLanding}
            title="CareTag Home"
          >
            <CareTagLogo variant="horizontal" size="sm" showTagline={false} />
          </button>

          {/* Child Active Profile & Multi-Device Selector */}
          <div className="child-profile-selector-wrap" style={{ position: 'relative' }}>
            <button
              type="button"
              className="child-profile-pill child-profile-pill--selectable"
              onClick={() => setIsDeviceMenuOpen(o => !o)}
              title="Click to switch monitored child or device"
              aria-haspopup="true"
              aria-expanded={isDeviceMenuOpen}
            >
              <div className="child-avatar" style={{ backgroundColor: activeProfile.avatarColor || '#2563EB' }}>
                <span>{monitoredInitial}</span>
              </div>
              <div className="child-meta">
                <span className="child-name">{monitoredName}</span>
                <span className="child-device-tag">
                  {isLiveHardwareMode ? activeProfile.deviceKey : `Sim: ${activeScenario || 'Active'}`}
                </span>
              </div>
              <ChevronDown size={14} className="device-dropdown-chevron" />
            </button>

            {isDeviceMenuOpen && (
              <div className="device-select-dropdown" role="menu">
                <div className="dropdown-header-label">Switch Monitored Wearable</div>
                <div className="device-select-list">
                  {devicesList.map(dev => {
                    const isSelected = dev.deviceKey === selectedDeviceKey;
                    const initial = (dev.childName?.trim().charAt(0) || 'C').toUpperCase();
                    return (
                      <button
                        key={dev.id || dev.deviceKey}
                        type="button"
                        className={`device-select-item ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => handleSwitchDevice(dev.deviceKey)}
                        role="menuitem"
                      >
                        <div className="child-avatar child-avatar--sm" style={{ backgroundColor: dev.avatarColor || '#2563EB' }}>
                          <span>{initial}</span>
                        </div>
                        <div className="device-select-info">
                          <strong className="dev-name">{dev.childName}</strong>
                          <span className="dev-key">{dev.deviceKey} &bull; {dev.relation || 'Child'}</span>
                        </div>
                        {isSelected && <Check size={14} className="text-teal" />}
                      </button>
                    );
                  })}
                </div>
                <div className="device-dropdown-footer">
                  <button
                    type="button"
                    className="btn-link-new-device"
                    onClick={() => {
                      setIsDeviceMenuOpen(false);
                      setShowLinkDeviceModal(true);
                    }}
                  >
                    <Plus size={13} />
                    <span>Link Another Smart Band</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Simplified Caregiver Navigation (Home, Safe Places, Alerts, Setup) */}
        <div className="caretag-header-center">
          <nav className="view-mode-tabs" aria-label="Caregiver views">
            <button
              type="button"
              className={`view-tab-btn ${activeTab === 'overview' && !showSetupWizard ? 'active' : ''}`}
              onClick={() => { setActiveTab('overview'); setShowSetupWizard(false); setIsMapExpanded(false); }}
            >
              <Shield size={14} />
              <span>Home</span>
            </button>

            <button
              type="button"
              className={`view-tab-btn ${activeTab === 'safezones' && !showSetupWizard ? 'active' : ''}`}
              onClick={() => { setActiveTab('safezones'); setShowSetupWizard(false); setIsMapExpanded(false); }}
            >
              <MapPin size={14} />
              <span>Safe Places</span>
              {geofences.length > 0 && <span className="tab-counter-badge">{geofences.length}</span>}
            </button>

            <button
              type="button"
              className={`view-tab-btn ${activeTab === 'alerts' && !showSetupWizard ? 'active' : ''}`}
              onClick={() => { setActiveTab('alerts'); setShowSetupWizard(false); setIsMapExpanded(false); }}
            >
              <Bell size={14} />
              <span>Alerts</span>
              {unackCount > 0 && <span className="tab-counter-badge tab-counter-badge--warn">{unackCount}</span>}
            </button>

            <button
              type="button"
              className={`view-tab-btn ${showSetupWizard ? 'active' : ''}`}
              onClick={() => {
                setShowSetupWizard(true);
                setIsMapExpanded(false);
              }}
              title="Guided Setup Wizard"
            >
              <Sliders size={14} />
              <span>Setup</span>
            </button>
          </nav>
        </div>

        {/* Right: Telemetry Live Indicator, Inspector Shortcut, Logout */}
        <div className="caretag-header-right">
          {/* Live Telemetry / Simulation Badge */}
          {(() => {
            if (simRunning) {
              return (
                <div className="live-source-badge live-source-badge--sim" title="Demonstration scenario running">
                  <span className="live-source-pulse" />
                  <span className="live-source-label">Simulation Active</span>
                </div>
              );
            }
            const hwMeta = getDeviceStatusMeta(hardwareStatus.deviceStatus, hardwareStatus.ageSeconds);
            const badgeClass = hwMeta.isLive
              ? 'live-source-badge--hw'
              : hwMeta.isStale
              ? 'live-source-badge--stale'
              : hardwareStatus.deviceStatus === DEVICE_STATUS.CONNECTION_ERROR
              ? 'live-source-badge--error'
              : 'live-source-badge--offline';
            return (
              <div className={`live-source-badge ${badgeClass}`} title={hwMeta.description}>
                <span className="live-source-pulse" />
                <span className="live-source-label">
                  {hwMeta.badgeText}
                </span>
              </div>
            );
          })()}

          {/* Dedicated Engineering Technical Inspector Button */}
          <button
            type="button"
            className={`header-action-btn ${activeTab === 'inspector' && !showSetupWizard ? 'header-action-btn--active' : ''}`}
            onClick={() => {
              setShowSetupWizard(false);
              setActiveTab(t => t === 'inspector' ? 'overview' : 'inspector');
              setIsMapExpanded(false);
            }}
            title="Technical Inspector &amp; Capstone Console"
          >
            <Terminal size={14} />
            <span className="header-btn-text">Inspector</span>
          </button>

          <button
            type="button"
            className="header-logout-btn"
            onClick={onLogout}
            title={`Signed in as ${session.email} • Click to Sign Out`}
          >
            <LogOut size={15} />
            <span className="header-logout-text">Sign Out</span>
          </button>
        </div>
      </header>

      {/* ── Active Trip Mode Callout Banner ── */}
      {tripMode.active && (
        <aside className="trip-mode-active-banner" role="status" aria-live="polite">
          <div className="trip-mode-banner-content">
            <div className="trip-mode-icon-wrap">
              <Car size={16} />
            </div>
            <div className="trip-mode-text">
              <strong>Trip Mode Active ({selectedDeviceKey})</strong> &bull; <span>Route-deviation alerts paused while travelling together. Auto-restores in <strong>{tripMode.formattedRemaining}</strong>.</span>
            </div>
          </div>
          <button
            type="button"
            className="btn-end-trip-mode"
            onClick={handleEndTripMode}
            title="Resume standard route-deviation alerts immediately"
          >
            End Trip Mode
          </button>
        </aside>
      )}

      {/* ── Active Incident Callout Banner (Top Alert) ── */}
      {topAlert && activeTab !== 'alerts' && (
        <aside className="alert-incident-banner" role="alert" aria-live="assertive">
          <div className="incident-banner-content">
            <div className="incident-banner-icon">
              <AlertTriangle size={18} />
            </div>
            <div className="incident-banner-text">
              <strong className="incident-banner-title">
                {topAlert.type === 'boundary_breach' ? 'Boundary Breach Detected' : 'Route Deviation Detected'}
              </strong>
              <span className="incident-banner-desc">{topAlert.message}</span>
              <span className="incident-banner-time">
                {new Date(topAlert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
          <div className="incident-banner-actions">
            <button
              type="button"
              className="incident-action-btn incident-action-btn--view"
              onClick={() => handleInspectAlertOnMap(topAlert)}
            >
              <Crosshair size={13} />
              <span>View Location</span>
            </button>
            <button
              type="button"
              className="incident-action-btn incident-action-btn--ack"
              onClick={() => handleAcknowledgeAlert(topAlert.id)}
            >
              <Check size={13} />
              <span>Acknowledge</span>
            </button>
          </div>
        </aside>
      )}

      {/* ── Main Workspace: Two-Column Responsive Layout ── */}
      <main className={`caretag-main-workspace ${isMapExpanded ? 'caretag-main-workspace--expanded-map' : ''}`}>
        
        {/* ── Map Pane (Primary Visual Workspace) ── */}
        <section className="caretag-map-pane" aria-label="Live Geofence Map">
          
          {/* Floating Action Toolbar on Map */}
          <div className="map-floating-toolbar" role="toolbar" aria-label="Map Controls">
            <button
              type="button"
              className="map-toolbar-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (latest) {
                  setFlyToTarget({ latlng: [latest.lat, latest.lng], timestamp: Date.now() });
                  pushToast('Centered map on child location', 'info');
                } else if (geofences[0]) {
                  setFlyToTarget({ latlng: [geofences[0].centerLatitude, geofences[0].centerLongitude], timestamp: Date.now() });
                }
              }}
              title="Recenter on Child"
            >
              <Crosshair size={15} />
              <span className="toolbar-btn-text">Recenter</span>
            </button>

            <button
              type="button"
              className="map-toolbar-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (geofences.length > 0) {
                  setFlyToTarget({ latlng: [geofences[0].centerLatitude, geofences[0].centerLongitude], zoom: 14, timestamp: Date.now() });
                  pushToast('Fitted to safe places', 'info');
                } else {
                  pushToast('No safe places configured yet', 'info');
                }
              }}
              title="Fit Safe Places"
            >
              <MapPin size={15} />
              <span className="toolbar-btn-text">Safe Places</span>
            </button>

            <button
              type="button"
              className={`map-toolbar-btn ${showExpectedRoute ? 'map-toolbar-btn--active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setShowExpectedRoute(r => !r);
              }}
              title="Toggle Learned Route Corridor"
            >
              <Navigation size={15} />
              <span className="toolbar-btn-text">Learned Route</span>
            </button>

            <button
              type="button"
              className="map-toolbar-btn"
              onClick={(e) => {
                e.stopPropagation();
                setIsMapExpanded(exp => !exp);
              }}
              title={isMapExpanded ? 'Standard Split View' : 'Expand Map'}
            >
              {isMapExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              <span className="toolbar-btn-text">{isMapExpanded ? 'Standard' : 'Expand'}</span>
            </button>
          </div>

          {/* Leaflet Map Canvas */}
          <MapContainer
            center={[mapCenterLat, mapCenterLng]}
            zoom={14}
            scrollWheelZoom={true}
            className="leaflet-map-canvas"
          >
            <MapResizeHandler isMapExpanded={isMapExpanded} />
            <MapClickHandler isMapPickActive={isMapPickActive} onMapClick={handleMapClick} />

            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />

            <FlyTo target={flyToTarget} />

            {/* Configured Safe Places */}
            {geofences.map((zone) => {
              const isSelected = selectedZoneId === zone.id;
              const isEnabled = zone.enabled !== false && zone.isActive !== false;
              const isScheduled = isScheduleActive(zone.schedule);

              const color = getZoneCategoryColor(zone.category || zone.label, isEnabled, isScheduled);

              return (
                <Circle
                  key={zone.id}
                  center={[zone.centerLatitude, zone.centerLongitude]}
                  radius={zone.radiusMeters || 500}
                  pathOptions={{
                    color: isSelected ? '#1D4ED8' : color,
                    fillColor: color,
                    fillOpacity: isSelected ? 0.30 : isScheduled && isEnabled ? 0.16 : 0.06,
                    weight: isSelected ? 3.5 : 2,
                    dashArray: isEnabled && isScheduled ? '4 4' : '8 6',
                  }}
                  eventHandlers={{
                    click: () => {
                      setSelectedZoneId(zone.id);
                      setActiveTab('safezones');
                      setFlyToTarget({ latlng: [zone.centerLatitude, zone.centerLongitude], timestamp: Date.now() });
                    }
                  }}
                >
                  <Popup>
                    <div className="map-popup-card">
                      <div className="map-popup-header">
                        <MapPin size={14} color={color} />
                        <strong>{zone.label || zone.name}</strong>
                      </div>
                      <div className="map-popup-meta-row">
                        <span className="map-popup-radius-badge">{zone.radiusMeters || 500}m radius</span>
                        <span className={`map-popup-schedule-badge ${isEnabled && isScheduled ? 'is-active' : 'is-inactive'}`}>
                          {isEnabled ? (isScheduled ? 'Active Monitoring Now' : 'Schedule Inactive') : 'Monitoring Disabled'}
                        </span>
                      </div>
                      <p className="map-popup-coords">
                        {zone.centerLatitude.toFixed(5)}° N, {zone.centerLongitude.toFixed(5)}° E
                      </p>
                    </div>
                  </Popup>
                </Circle>
              );
            })}

            {/* Draft Zone Circle & Draggable Marker (While creating or editing a safe place) */}
            {draftZone && draftZone.centerLatitude && draftZone.centerLongitude && (
              <>
                <Circle
                  center={[draftZone.centerLatitude, draftZone.centerLongitude]}
                  radius={draftZone.radiusMeters || 400}
                  pathOptions={{
                    color: '#2563EB',
                    fillColor: '#3B82F6',
                    fillOpacity: 0.25,
                    weight: 3,
                    dashArray: '6 6',
                  }}
                />
                <Marker
                  position={[draftZone.centerLatitude, draftZone.centerLongitude]}
                  icon={draftMarkerIcon}
                  draggable={true}
                  eventHandlers={{
                    dragend: (e) => {
                      const pos = e.target.getLatLng();
                      setDraftZone(prev => ({
                        ...prev,
                        centerLatitude: pos.lat,
                        centerLongitude: pos.lng,
                        _fromMap: true,
                      }));
                    }
                  }}
                >
                  <Popup>
                    <div className="map-popup-card">
                      <strong>{draftZone.label || 'New Safe Place'}</strong>
                      <p style={{ fontSize: '0.75rem', color: '#64748B' }}>Drag pin to refine coordinates</p>
                    </div>
                  </Popup>
                </Marker>
              </>
            )}

            {/* Learned Route Corridor Polyline */}
            {showExpectedRoute && routeWaypoints.length >= 2 && (
              <Polyline
                positions={routeWaypoints}
                pathOptions={{
                  color: '#0D9488',
                  weight: 3,
                  opacity: 0.7,
                  dashArray: '6 8'
                }}
              />
            )}

            {/* Recent Movement Trail */}
            {recentTrail.length >= 2 && (
              <Polyline
                positions={recentTrail}
                pathOptions={{
                  color: '#059669',
                  weight: 3,
                  opacity: 0.85,
                }}
              />
            )}

            {/* Active Child Position Marker */}
            {latest && (
              <Marker
                position={[latest.lat, latest.lng]}
                icon={latest?.packet?.isAnomaly ? deviceIconAlert : deviceIconNormal}
              >
                <Popup>
                  <div className="map-popup-card">
                    <div className="map-popup-header">
                      <ShieldCheck size={14} color="#0D9488" />
                      <strong>{deviceDisplayName}</strong>
                    </div>
                    <p className="map-popup-sub">
                      Status: {latest.packet?.motionState || 'Normal'}
                    </p>
                    <p className="map-popup-sub">
                      Battery: {latest.packet?.batteryPercent ?? 92}% &bull; Speed: {latest.packet?.speedKph ?? 0} km/h
                    </p>
                    <p className="map-popup-coords">
                      {latest.lat.toFixed(5)}° N, {latest.lng.toFixed(5)}° E
                    </p>
                    <p className="map-popup-time">
                      Updated: {new Date(latest.packet?.capturedAtUtc || Date.now()).toLocaleTimeString()}
                    </p>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>

          {/* Map Footer Bar with Source & Attribution */}
          <footer className="map-footer-status">
            <span className="map-footer-item">
              <span className={`status-dot ${
                simRunning
                  ? 'status-dot--green'
                  : hardwareStatus.deviceStatus === DEVICE_STATUS.LIVE
                  ? 'status-dot--green'
                  : hardwareStatus.deviceStatus === DEVICE_STATUS.STALE
                  ? 'status-dot--yellow'
                  : 'status-dot--neutral'
              }`} />
              <strong>Data Source:</strong> {
                simRunning
                  ? `Simulation Mode (${activeScenario})`
                  : hardwareStatus.deviceStatus === DEVICE_STATUS.LIVE
                  ? 'Live Hardware (Firebase RTDB)'
                  : hardwareStatus.deviceStatus === DEVICE_STATUS.STALE
                  ? `Hardware Band (Delayed · ${hardwareStatus.formattedAge})`
                  : hardwareStatus.deviceStatus === DEVICE_STATUS.WAITING_FOR_DATA
                  ? 'Smart Band (Awaiting Heartbeat)'
                  : hardwareStatus.deviceStatus === DEVICE_STATUS.CONNECTION_ERROR
                  ? 'Firebase RTDB (Connection Error)'
                  : 'Smart Band Offline'
              }
            </span>
            {latest && (
              <span className="map-footer-item map-footer-coords">
                <strong>Coordinates:</strong> {latest.lat.toFixed(4)}°N, {latest.lng.toFixed(4)}°E
              </span>
            )}
          </footer>
        </section>

        {/* ── Contextual Content Pane ── */}
        <section className="caretag-content-pane" aria-label="Dashboard Views">
          
          {/* Guided Setup Wizard */}
          {showSetupWizard ? (
            <FirstTimeSetupWizard
              geofences={geofences}
              onSaveGeofence={handleSaveGeofence}
              onCompleteSetup={() => {
                setShowSetupWizard(false);
                setActiveTab('overview');
                localStorage.setItem(`caretag_setup_completed_${userId}`, 'true');
                pushToast('Setup completed! Live monitoring is active.', 'success');
              }}
              currentPacket={latest?.packet}
              hardwareStatus={hardwareStatus}
              onDismiss={() => {
                setShowSetupWizard(false);
                localStorage.setItem(`caretag_setup_completed_${userId}`, 'true');
              }}
              onFlyToZone={(flat, flng) => setFlyToTarget({ latlng: [flat, flng], timestamp: Date.now() })}
            />
          ) : activeTab === 'safezones' ? (
            /* Safe Places Management */
            <SafeZoneManager
              geofences={geofences}
              currentPacket={latest?.packet}
              onSaveGeofence={handleSaveGeofence}
              onUpdateGeofence={handleUpdateGeofence}
              onDeleteGeofence={handleDeleteGeofence}
              onFlyToZone={(flat, flng) => setFlyToTarget({ latlng: [flat, flng], timestamp: Date.now() })}
              selectedZoneId={selectedZoneId}
              onSelectZone={setSelectedZoneId}
              draftZone={draftZone}
              setDraftZone={setDraftZone}
              isMapPickActive={isMapPickActive}
              setIsMapPickActive={setIsMapPickActive}
              onClose={() => setActiveTab('overview')}
            />
          ) : activeTab === 'inspector' ? (
            /* Technical Inspector & Capstone Evaluator */
            <TechnicalInspector
              packet={latest?.packet}
              geofences={geofences}
              hardwareStatus={hardwareStatus}
              simRunning={simRunning}
              activeScenario={activeScenario}
              onStartScenario={handleStartScenario}
              onStopScenario={handleStopScenario}
              onResetScenario={handleResetScenario}
              onManualSimulate={handleManualSimulate}
              routineHistory={routineHistory}
              routineProfile={routineProfile}
              evaluationLog={evaluationLog}
              simulatedAlerts={simulatedAlerts}
              onClose={() => setActiveTab('overview')}
            />
          ) : activeTab === 'alerts' ? (
            /* Safety Alerts & Event Log */
            <div className="alerts-history-view">
              <div className="alerts-view-header">
                <div className="alerts-view-title-group">
                  <Bell size={18} className="text-teal" />
                  <h2>Safety Alerts &amp; Event Log</h2>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {alerts.some(a => !a.acknowledged) && (
                    <button
                      type="button"
                      className="alerts-ack-all-btn"
                      onClick={handleAcknowledgeAll}
                    >
                      <Check size={13} />
                      <span>Acknowledge All</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="tech-close-btn"
                    onClick={() => setActiveTab('overview')}
                    aria-label="Back to Overview"
                    title="Back to Overview"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {alerts.length === 0 ? (
                <div className="alerts-empty-card">
                  <CheckCircle size={32} color="#0D9488" />
                  <h3>No Incidents Recorded</h3>
                  <p>All recorded journeys have adhered to normal routines and designated safe boundaries.</p>
                </div>
              ) : (
                <div className="alerts-list">
                  {alerts.map((item) => (
                    <div
                      key={item.id}
                      className={`alert-list-card ${item.acknowledged ? 'alert-list-card--ack' : 'alert-list-card--unack'}`}
                    >
                      <div className="alert-card-top">
                        <span className={`alert-type-badge alert-type-badge--${item.type}`}>
                          {item.type === 'boundary_breach' ? 'Boundary Breach' : item.type === 'route_deviation' ? 'Route Deviation' : 'Nominal Safety'}
                        </span>
                        <span className="alert-card-time">
                          <Clock size={12} />
                          {new Date(item.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                      <p className="alert-card-message">{item.message}</p>
                      <div className="alert-card-bottom">
                        <div className="alert-card-meta">
                          {item.nearestGeofence && <span>Near: <strong>{item.nearestGeofence}</strong></span>}
                          {item.latitude && <span>Coords: {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</span>}
                          {item.source && <span className="alert-source-tag">{item.source === 'simulation' ? 'Simulation' : 'Hardware'}</span>}
                        </div>
                        <div className="alert-card-actions">
                          {item.latitude && (
                            <button
                              type="button"
                              className="alert-btn-map"
                              onClick={() => handleInspectAlertOnMap(item)}
                            >
                              <Crosshair size={12} />
                              <span>Inspect</span>
                            </button>
                          )}
                          {!item.acknowledged && (
                            <button
                              type="button"
                              className="alert-btn-ack"
                              onClick={() => handleAcknowledgeAlert(item.id)}
                            >
                              <Check size={12} />
                              <span>Acknowledge</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Caregiver Home (Answering the 4 Core Questions) */
            <CaregiverOverview
              packet={latest?.packet}
              geofences={geofences}
              alerts={alerts}
              hardwareStatus={hardwareStatus}
              simRunning={simRunning}
              isLiveHardwareMode={isLiveHardwareMode}
              routineProfile={routineProfile}
              routineHistory={routineHistory}
              selectedDeviceKey={selectedDeviceKey}
              activeProfile={activeProfile}
              devicesList={devicesList}
              onSwitchDevice={handleSwitchDevice}
              onOpenLinkDevice={() => setShowLinkDeviceModal(true)}
              tripMode={tripMode}
              onSetTripMode={handleSetTripMode}
              onEndTripMode={handleEndTripMode}
              onRecenterMap={() => {
                if (latest) setFlyToTarget({ latlng: [latest.lat, latest.lng], timestamp: Date.now() });
              }}
              onAcknowledgeAlert={handleAcknowledgeAlert}
              onOpenSafeZones={() => handleNavigateTab('safezones')}
              onOpenTechInspector={handleOpenInspector}
            />
          )}

        </section>
      </main>

      {/* ── Link New Smart Band Modal ── */}
      {showLinkDeviceModal && (
        <div className="caretag-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="link-device-title">
          <div className="caretag-modal-card">
            <div className="modal-header">
              <div className="modal-title-wrap">
                <Smartphone size={18} className="text-teal" />
                <h3 id="link-device-title">Link New Smart Band</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => { setShowLinkDeviceModal(false); setLinkError(''); }}
                aria-label="Close Modal"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleLinkDeviceSubmit} className="modal-body-form">
              <p className="modal-desc">
                Register a new wearable device to this caregiver account. Each device maintains isolated real-time telemetry, location, and routine models.
              </p>
              {linkError && (
                <div className="form-error-banner" role="alert">
                  <AlertTriangle size={14} />
                  <span>{linkError}</span>
                </div>
              )}
              <div className="form-group">
                <label>Device Key / Hardware Identifier *</label>
                <input
                  type="text"
                  placeholder="e.g. CARE-TAG-04 or ESP32-BAND-02"
                  value={newDeviceKeyInput}
                  onChange={e => setNewDeviceKeyInput(e.target.value.toUpperCase())}
                  required
                />
                <span className="form-hint">Found on the bottom of the band or in the pairing document.</span>
              </div>
              <div className="form-group">
                <label>Child / Profile Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Diya Singla"
                  value={newChildNameInput}
                  onChange={e => setNewChildNameInput(e.target.value)}
                  required
                />
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Age</label>
                  <input
                    type="number"
                    min="2"
                    max="18"
                    value={newAgeInput}
                    onChange={e => setNewAgeInput(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Relationship</label>
                  <select value={newRelationInput} onChange={e => setNewRelationInput(e.target.value)}>
                    <option value="Child">Child</option>
                    <option value="Ward">Ward</option>
                    <option value="Student">Student</option>
                    <option value="Elderly Parent">Elderly Parent</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => { setShowLinkDeviceModal(false); setLinkError(''); }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Plus size={14} />
                  <span>Link &amp; Activate Device</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Toast Notifications System ── */}
      <div className="caretag-toast-container" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`caretag-toast caretag-toast--${t.type}`}>
            {t.type === 'error' && <AlertTriangle size={15} />}
            {t.type === 'success' && <CheckCircle size={15} />}
            {t.type === 'info' && <Radio size={15} />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      {/* ── Taggy AI Companion Chatbot in Dashboard ── */}
      <TaggyChatbot
        currentView="dashboard"
        activeTab={activeTab}
        hardwareStatus={hardwareStatus}
        geofences={geofences}
        alerts={alerts}
        latest={latest?.packet}
        simRunning={simRunning}
        onNavigateTab={handleNavigateTab}
        onOpenInspector={handleOpenInspector}
        onRecenterMap={() => {
          if (latest) {
            setFlyToTarget({ latlng: [latest.lat, latest.lng], timestamp: Date.now() });
            pushToast('Centered map on child location', 'info');
          }
        }}
      />
    </div>
  );
}

export default App;
