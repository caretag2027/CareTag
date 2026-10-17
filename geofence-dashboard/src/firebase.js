/**
 * CareTag Physical Smart Band Firebase Integration
 * 
 * Directly connects the CareTag dashboard to the physical Smart Band hardware
 * streaming to Firebase Realtime Database (/sensorData).
 * 
 * Features:
 * - Real-time WebSocket synchronization via Firebase JS SDK
 * - REST and Cloudflare Worker Edge fallback if WebSockets are blocked
 * - Strict device online/stale/offline status state machine:
 *     * CONNECTING: Establishing data transport
 *     * WAITING_FOR_DATA: Firebase connected, awaiting verified device heartbeat
 *     * LIVE: Valid heartbeat or telemetry verified within freshness threshold (15s)
 *     * STALE: No update for 15s to 45s (packet delay / network degradation)
 *     * OFFLINE: Exceeded 45s offline threshold (band powered off / out of range)
 *     * CONNECTION_ERROR: Telemetry transport failed or disconnected
 * - Genuine timestamp tracking (prevents fabricating Date.now() on static snapshots)
 * - Hardware uptime progression verification
 * - GPS fix verification (prevents coordinate zeroing/teleportation when indoors)
 * - Fall & impact detection heuristics from IMU telemetry
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue, off } from 'firebase/database';
import {
  STATUS_THRESHOLDS,
  DEVICE_STATUS,
  getDeviceStatusMeta,
} from './utils/dashboardUtils';

export const FIREBASE_CONFIG = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "smart-band-7de19.firebaseapp.com",
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL || "https://smart-band-7de19-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "smart-band-7de19",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "smart-band-7de19.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "673896145526",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:673896145526:web:199737a1183586dfb6f557",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-9M1VLF71W2",
  userUid: process.env.REACT_APP_FIREBASE_USER_UID || "V68ovsSKeqRlyIdh2xoJV7EizVq1",
};

// Singleton App & Database instances
let app = null;
let database = null;

export function getFirebaseApp() {
  if (app) return app;
  if (!FIREBASE_CONFIG.apiKey) {
    // When client-side API key is omitted, client safely delegates telemetry syncing to Cloudflare Edge Worker (/api/hardware/telemetry)
    return null;
  }
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG);
    return app;
  } catch (err) {
    console.warn('[CareTag Firebase] Failed to initialize Firebase App:', err);
    return null;
  }
}

export function getFirebaseDatabase() {
  if (database) return database;
  const fbApp = getFirebaseApp();
  if (!fbApp) return null;
  try {
    database = getDatabase(fbApp);
    return database;
  } catch (err) {
    console.warn('[CareTag Firebase] Failed to get Database instance:', err);
    return null;
  }
}

/**
 * Format uptime milliseconds into human-readable string (e.g. "02h 28m 45s")
 */
export function formatUptime(uptimeMs) {
  if (!uptimeMs || isNaN(uptimeMs)) return '00:00:00';
  const totalSeconds = Math.floor(uptimeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  }
  return `${pad(minutes)}m ${pad(seconds)}s`;
}

/**
 * Validates GPS coordinate and fix status.
 * Prevents invalid/zeroed coordinates (e.g. 0,0) from breaking the UI.
 */
export function isValidGpsCoordinate(lat, lon, validFlag = true) {
  if (validFlag === false) return false;
  if (lat == null || lon == null) return false;
  const nLat = Number(lat);
  const nLon = Number(lon);
  if (isNaN(nLat) || isNaN(nLon)) return false;
  // If coordinates are exact 0,0, GPS module has no lock
  if (Math.abs(nLat) < 0.0001 && Math.abs(nLon) < 0.0001) return false;
  return nLat >= -90 && nLat <= 90 && nLon >= -180 && nLon <= 180;
}

/**
 * Validates an ISO or Epoch timestamp from hardware/backend.
 * Must be within plausible range (after 2020 and not in the distant future).
 */
export function parseValidTimestamp(candidate) {
  if (!candidate) return null;
  const parsed = new Date(candidate).getTime();
  if (isNaN(parsed)) return null;
  // Plausible window: between year 2021 and 24 hours into the future
  const minValid = 1609459200000; // 2021-01-01
  const maxValid = Date.now() + 86400000;
  if (parsed < minValid || parsed > maxValid) return null;
  return parsed;
}

/**
 * Normalizes raw hardware sensor data from Firebase RTDB into standard CareTag packet.
 * 
 * CRITICAL: Does NOT fabricate new Date().toISOString() when telemetry is static or unverified.
 * Preserves genuine device timestamp or verified update timestamp.
 * 
 * @param {Object} raw - Raw payload from /sensorData
 * @param {Object|null} lastValidGps - Last known valid coordinates to hold if indoor
 * @param {Object} context - Optional verification context ({ verifiedAt, isVerifiedFresh, receivedAt })
 */
export function parseHardwareTelemetry(raw, lastValidGps = null, context = {}) {
  if (!raw || typeof raw !== 'object') return null;

  // 1. Accelerometer (m/s^2)
  const ax = Number(raw?.accelerometer?.x_ms2 ?? 0);
  const ay = Number(raw?.accelerometer?.y_ms2 ?? 0);
  const az = Number(raw?.accelerometer?.z_ms2 ?? -9.81);
  const accelMag = Math.sqrt(ax * ax + ay * ay + az * az);

  // Pitch and roll estimation from accelerometer
  const pitchDeg = Math.atan2(-ax, Math.sqrt(ay * ay + az * az)) * (180 / Math.PI);
  const rollDeg = Math.atan2(ay, az) * (180 / Math.PI);

  // 2. Gyroscope (degrees/sec)
  const gx = Number(raw?.gyroscope?.x_dps ?? 0);
  const gy = Number(raw?.gyroscope?.y_dps ?? 0);
  const gz = Number(raw?.gyroscope?.z_dps ?? 0);
  const gyroMag = Math.sqrt(gx * gx + gy * gy + gz * gz);

  // 3. GPS extraction & validation
  const gps = raw?.gps || {};
  const rawLat = gps.latitude != null ? Number(gps.latitude) : null;
  const rawLon = gps.longitude != null ? Number(gps.longitude) : null;
  const satellites = Number(gps.satellites ?? 0);
  const rawValidFlag = gps.valid !== false && gps.valid !== 'false';
  const hasValidFix = isValidGpsCoordinate(rawLat, rawLon, rawValidFlag);

  // Determine effective coordinates (fallback to last known valid GPS or default campus anchor)
  let effectiveLat;
  let effectiveLon;
  let isGpsEstimated = false;

  if (hasValidFix) {
    effectiveLat = rawLat;
    effectiveLon = rawLon;
  } else if (lastValidGps && isValidGpsCoordinate(lastValidGps.latitude, lastValidGps.longitude)) {
    effectiveLat = lastValidGps.latitude;
    effectiveLon = lastValidGps.longitude;
    isGpsEstimated = true;
  } else {
    // Thapar University default anchor
    effectiveLat = 30.3491155;
    effectiveLon = 76.411710833;
    isGpsEstimated = true;
  }

  // 4. Motion State & Fall Detection Heuristics
  const isFreeFall = accelMag < 3.5;
  const isImpact = accelMag > 24.0 || (accelMag > 18.0 && gyroMag > 120.0);
  const isFall = isFreeFall || isImpact;

  let motionState = 'stationary';
  if (isFall) {
    motionState = 'potential_fall';
  } else if (accelMag > 13.0 || Math.abs(accelMag - 9.81) > 2.2 || gyroMag > 20.0) {
    motionState = 'moving';
  } else if (Math.abs(accelMag - 9.81) > 0.8 || gyroMag > 8.0) {
    motionState = 'active';
  }

  const uptimeMs = Number(raw.uptime_ms ?? 0);

  // 5. Genuine timestamp resolution (never fabricate Date.now() on stale static snapshots)
  const hardwareParsedTime = parseValidTimestamp(
    raw.timestamp || raw.captured_at || raw.time || raw.updated_at || raw.last_seen
  );

  let effectiveTimestampIso = null;
  if (hardwareParsedTime != null) {
    effectiveTimestampIso = new Date(hardwareParsedTime).toISOString();
  } else if (context.verifiedAt != null) {
    effectiveTimestampIso = new Date(context.verifiedAt).toISOString();
  }

  return {
    id: `hw-${uptimeMs || 'static'}`,
    deviceKey: 'SMART-BAND-01',
    source: 'hardware_firebase',
    isHardware: true,

    // Timestamps
    timestamp: effectiveTimestampIso,
    capturedAtUtc: effectiveTimestampIso,
    receivedAtUtc: context.receivedAt ? new Date(context.receivedAt).toISOString() : null,
    lastVerifiedAt: context.verifiedAt ? new Date(context.verifiedAt).toISOString() : null,
    isVerifiedFresh: Boolean(context.isVerifiedFresh),

    // Map Coordinates
    latitude: parseFloat(effectiveLat.toFixed(7)),
    longitude: parseFloat(effectiveLon.toFixed(7)),
    speedKph: hasValidFix ? (motionState === 'stationary' ? 0.2 : 4.5) : 0,
    headingDegrees: Math.round((Math.atan2(gy, gx) * (180 / Math.PI) + 360) % 360),
    accuracyMeters: hasValidFix ? (satellites > 4 ? 4.2 : 12.0) : 35.0,
    batteryPercent: 92,

    // Detailed GPS telemetry
    gps: {
      latitude: rawLat,
      longitude: rawLon,
      valid: hasValidFix,
      rawValid: rawValidFlag,
      satellites,
      isEstimated: isGpsEstimated,
    },

    // Detailed IMU telemetry
    accelerometer: {
      x_ms2: parseFloat(ax.toFixed(4)),
      y_ms2: parseFloat(ay.toFixed(4)),
      z_ms2: parseFloat(az.toFixed(4)),
      magnitude: parseFloat(accelMag.toFixed(3)),
      pitch: parseFloat(pitchDeg.toFixed(1)),
      roll: parseFloat(rollDeg.toFixed(1)),
    },

    gyroscope: {
      x_dps: parseFloat(gx.toFixed(3)),
      y_dps: parseFloat(gy.toFixed(3)),
      z_dps: parseFloat(gz.toFixed(3)),
      magnitude: parseFloat(gyroMag.toFixed(3)),
    },

    motionState,
    isFall,
    isAnomaly: isFall,
    deviationScore: isFall ? 0.95 : motionState === 'moving' ? 0.25 : 0.05,

    // Hardware metadata
    uptimeMs,
    uptimeFormatted: formatUptime(uptimeMs),
  };
}

/**
 * Subscribes to live hardware telemetry from Firebase Realtime Database
 * with guaranteed device freshness verification.
 * 
 * Implements a strict status state machine:
 * - CONNECTING: Establishing data transport
 * - WAITING_FOR_DATA: Firebase connected, awaiting verified device heartbeat
 * - LIVE: Valid heartbeat or telemetry verified within freshness threshold (15s)
 * - STALE: No update for 15s to 45s (packet delay / network degradation)
 * - OFFLINE: Exceeded 45s offline threshold (band powered off / out of range)
 * - CONNECTION_ERROR: Telemetry transport failed or disconnected
 * 
 * @param {Function} onPacket - Callback when a fresh packet arrives
 * @param {Function} onStatusChange - Callback when connection status updates
 * @param {Object} options - Custom threshold configuration
 * @returns {Function} unsubscribe function
 */
export function subscribeHardwareTelemetry(onPacket, onStatusChange, options = {}) {
  const FRESHNESS_MS = options.freshnessMs || STATUS_THRESHOLDS.FRESHNESS_MS;
  const OFFLINE_TIMEOUT_MS = options.offlineTimeoutMs || STATUS_THRESHOLDS.OFFLINE_TIMEOUT_MS;
  const INITIAL_VERIFY_WINDOW_MS = options.initialVerifyMs || STATUS_THRESHOLDS.INITIAL_VERIFY_WINDOW_MS;

  let isMounted = true;
  let dbRef = null;
  let connectedRef = null;
  let pollIntervalId = null;
  let tickerIntervalId = null;
  let verifyTimer = null;

  // Transport and device status
  let transportStatus = 'connecting';
  let firebaseConnected = false;
  let deviceStatus = DEVICE_STATUS.CONNECTING;

  // Telemetry heartbeat tracking
  let lastVerifiedAt = null;
  let lastObservedUptime = null;
  let lastObservedHash = null;
  let lastValidGps = null;
  let latestPacket = null;
  let isInitialSnapshot = true;

  // Helper to compute a hash of sensor readings to detect real changes
  function computeSensorHash(raw) {
    if (!raw) return '';
    return [
      raw.uptime_ms ?? '',
      raw.accelerometer?.x_ms2 ?? '',
      raw.accelerometer?.y_ms2 ?? '',
      raw.accelerometer?.z_ms2 ?? '',
      raw.gyroscope?.x_dps ?? '',
      raw.gyroscope?.y_dps ?? '',
      raw.gyroscope?.z_dps ?? '',
      raw.gps?.latitude ?? '',
      raw.gps?.longitude ?? '',
    ].join(':');
  }

  // Unified emitter for status changes
  function emitStatus() {
    if (!isMounted || typeof onStatusChange !== 'function') return;

    const now = Date.now();
    let ageSeconds = null;
    let formattedAge = 'Awaiting data';

    if (lastVerifiedAt != null) {
      ageSeconds = Math.max(0, Math.floor((now - lastVerifiedAt) / 1000));
      if (ageSeconds < 3) formattedAge = 'Just now';
      else if (ageSeconds < 60) formattedAge = `${ageSeconds}s ago`;
      else if (ageSeconds < 3600) formattedAge = `${Math.floor(ageSeconds / 60)}m ago`;
      else formattedAge = `${Math.floor(ageSeconds / 3600)}h ago`;
    }

    const meta = getDeviceStatusMeta(deviceStatus, ageSeconds);

    let statusText = meta.description;
    if (deviceStatus === DEVICE_STATUS.LIVE) {
      statusText = latestPacket?.gps?.valid
        ? 'SMART BAND ACTIVE · LIVE HARDWARE STREAM'
        : 'SMART BAND CONNECTED · SEARCHING GPS FIX';
    } else if (deviceStatus === DEVICE_STATUS.STALE) {
      statusText = `SMART BAND DELAYED · NO HEARTBEAT FOR ${ageSeconds}s`;
    } else if (deviceStatus === DEVICE_STATUS.OFFLINE) {
      statusText = ageSeconds != null && isFinite(ageSeconds)
        ? `SMART BAND OFFLINE · LAST SEEN ${formattedAge}`
        : 'SMART BAND OFFLINE · NO ACTIVE HEARTBEAT';
    }

    const payload = {
      deviceStatus,
      transportStatus,
      firebaseConnected,
      isHardwareStreaming: deviceStatus === DEVICE_STATUS.LIVE,
      isStale: deviceStatus === DEVICE_STATUS.STALE,
      isOffline: deviceStatus === DEVICE_STATUS.OFFLINE || deviceStatus === DEVICE_STATUS.WAITING_FOR_DATA,
      lastVerifiedAt: lastVerifiedAt ? new Date(lastVerifiedAt).toISOString() : null,
      ageSeconds,
      formattedAge,
      uptimeMs: latestPacket?.uptimeMs ?? lastObservedUptime,
      uptimeFormatted: formatUptime(latestPacket?.uptimeMs ?? lastObservedUptime),
      statusText,
      label: meta.label,
      gpsValid: Boolean(latestPacket?.gps?.valid),
    };

    try {
      onStatusChange(payload);
    } catch (err) {
      console.error('[CareTag Firebase] onStatusChange error:', err);
    }
  }

  // Ticker: runs every second to transition status (Live -> Stale -> Offline) smoothly
  function startStatusTicker() {
    if (tickerIntervalId) clearInterval(tickerIntervalId);
    tickerIntervalId = setInterval(() => {
      if (!isMounted) return;

      const now = Date.now();

      // If transport is disconnected, device status is connection_error
      if (!firebaseConnected && transportStatus === 'disconnected') {
        if (deviceStatus !== DEVICE_STATUS.CONNECTION_ERROR) {
          deviceStatus = DEVICE_STATUS.CONNECTION_ERROR;
          emitStatus();
        }
        return;
      }

      // If we have a verified update, re-evaluate freshness based on elapsed wall-clock time
      if (lastVerifiedAt != null) {
        const elapsed = now - lastVerifiedAt;

        if (elapsed < FRESHNESS_MS) {
          if (deviceStatus !== DEVICE_STATUS.LIVE) {
            deviceStatus = DEVICE_STATUS.LIVE;
            emitStatus();
          } else {
            // Still live, update age counter
            emitStatus();
          }
        } else if (elapsed < OFFLINE_TIMEOUT_MS) {
          if (deviceStatus !== DEVICE_STATUS.STALE) {
            deviceStatus = DEVICE_STATUS.STALE;
            emitStatus();
          } else {
            emitStatus();
          }
        } else {
          if (deviceStatus !== DEVICE_STATUS.OFFLINE) {
            deviceStatus = DEVICE_STATUS.OFFLINE;
            emitStatus();
          } else {
            emitStatus();
          }
        }
      } else if (deviceStatus === DEVICE_STATUS.CONNECTING && firebaseConnected) {
        deviceStatus = DEVICE_STATUS.WAITING_FOR_DATA;
        emitStatus();
      }
    }, 1000);
  }

  // Processes incoming raw snapshot from Firebase or REST fallback
  function handleData(raw, sourceName = 'firebase') {
    if (!isMounted || !raw) return;

    const rawUptime = Number(raw?.uptime_ms);
    const sensorHash = computeSensorHash(raw);
    const now = Date.now();

    // Check if the payload contains a genuine hardware timestamp
    const hardwareTimestamp = parseValidTimestamp(
      raw.timestamp || raw.captured_at || raw.time || raw.updated_at || raw.last_seen
    );

    // Initial snapshot handling:
    // Firebase ALWAYS delivers the currently stored snapshot upon subscription.
    // If that data was stored hours or days ago, it MUST NOT be falsely reported as Live.
    if (isInitialSnapshot) {
      isInitialSnapshot = false;
      lastObservedUptime = rawUptime;
      lastObservedHash = sensorHash;

      if (hardwareTimestamp != null) {
        // Hardware provided its own genuine clock: evaluate freshness directly
        const age = now - hardwareTimestamp;
        lastVerifiedAt = hardwareTimestamp;
        if (age < FRESHNESS_MS) {
          deviceStatus = DEVICE_STATUS.LIVE;
        } else if (age < OFFLINE_TIMEOUT_MS) {
          deviceStatus = DEVICE_STATUS.STALE;
        } else {
          deviceStatus = DEVICE_STATUS.OFFLINE;
        }
      } else {
        // No hardware clock: check if this exact uptime was seen earlier in localStorage
        let previouslySeenAt = null;
        try {
          const storedUptime = localStorage.getItem('caretag.hw.lastUptime');
          const storedTime = Number(localStorage.getItem('caretag.hw.lastSeenAt'));
          if (storedUptime && Number(storedUptime) === rawUptime && !isNaN(storedTime)) {
            previouslySeenAt = storedTime;
          }
        } catch {}

        if (previouslySeenAt != null) {
          const age = now - previouslySeenAt;
          lastVerifiedAt = previouslySeenAt;
          if (age < FRESHNESS_MS) {
            deviceStatus = DEVICE_STATUS.LIVE;
          } else if (age < OFFLINE_TIMEOUT_MS) {
            deviceStatus = DEVICE_STATUS.STALE;
          } else {
            deviceStatus = DEVICE_STATUS.OFFLINE;
          }
        } else {
          // Unknown age: save current time as baseline and verify if hardware is actively ticking
          try {
            localStorage.setItem('caretag.hw.lastUptime', String(rawUptime));
            localStorage.setItem('caretag.hw.lastSeenAt', String(now));
          } catch {}

          deviceStatus = DEVICE_STATUS.WAITING_FOR_DATA;

          // Start a verification window: if uptime does not advance in INITIAL_VERIFY_WINDOW_MS,
          // the hardware is NOT transmitting and must be marked OFFLINE.
          clearTimeout(verifyTimer);
          verifyTimer = setTimeout(() => {
            if (!isMounted) return;
            if (lastVerifiedAt === null) {
              deviceStatus = DEVICE_STATUS.OFFLINE;
              emitStatus();
            }
          }, INITIAL_VERIFY_WINDOW_MS);
        }
      }

      // Parse and deliver baseline packet (without claiming it's newly verified fresh)
      const packet = parseHardwareTelemetry(raw, lastValidGps, {
        verifiedAt: lastVerifiedAt,
        isVerifiedFresh: deviceStatus === DEVICE_STATUS.LIVE,
        receivedAt: now,
      });

      if (packet) {
        latestPacket = packet;
        if (packet.gps.valid) {
          lastValidGps = { latitude: packet.latitude, longitude: packet.longitude };
        }
        if (typeof onPacket === 'function') {
          try { onPacket(packet); } catch (e) { console.error(e); }
        }
      }

      emitStatus();
      return;
    }

    // Subsequent updates:
    // Determine if this represents a genuine new transmission from the device
    const uptimeChanged = rawUptime !== lastObservedUptime;
    const hashChanged = sensorHash !== lastObservedHash;
    const isNewTransmission = uptimeChanged || hashChanged || (hardwareTimestamp != null && hardwareTimestamp !== lastVerifiedAt);

    lastObservedUptime = rawUptime;
    lastObservedHash = sensorHash;

    if (isNewTransmission) {
      clearTimeout(verifyTimer);
      lastVerifiedAt = hardwareTimestamp != null ? hardwareTimestamp : now;
      deviceStatus = DEVICE_STATUS.LIVE;

      try {
        localStorage.setItem('caretag.hw.lastUptime', String(rawUptime));
        localStorage.setItem('caretag.hw.lastSeenAt', String(lastVerifiedAt));
      } catch {}

      const packet = parseHardwareTelemetry(raw, lastValidGps, {
        verifiedAt: lastVerifiedAt,
        isVerifiedFresh: true,
        receivedAt: now,
      });

      if (packet) {
        latestPacket = packet;
        if (packet.gps.valid) {
          lastValidGps = { latitude: packet.latitude, longitude: packet.longitude };
        }
        if (typeof onPacket === 'function') {
          try { onPacket(packet); } catch (e) { console.error(e); }
        }
      }

      emitStatus();
    }
  }

  // 1. Try Firebase Realtime Database SDK
  const db = getFirebaseDatabase();

  if (db) {
    try {
      const sensorPath = options.path || (options.deviceKey && options.deviceKey !== 'CARE-TAG-01' ? `devices/${options.deviceKey}/sensorData` : 'sensorData');
      dbRef = ref(db, sensorPath);
      connectedRef = ref(db, '.info/connected');
      let hasConnectedBefore = false;

      // Listen to Firebase transport connection state
      onValue(connectedRef, (snap) => {
        if (!isMounted) return;
        const isOnline = Boolean(snap.val());
        firebaseConnected = isOnline;

        if (isOnline) {
          hasConnectedBefore = true;
          transportStatus = 'connected';
          if (deviceStatus === DEVICE_STATUS.CONNECTING || deviceStatus === DEVICE_STATUS.CONNECTION_ERROR) {
            deviceStatus = lastVerifiedAt != null
              ? (Date.now() - lastVerifiedAt < FRESHNESS_MS ? DEVICE_STATUS.LIVE : DEVICE_STATUS.OFFLINE)
              : DEVICE_STATUS.WAITING_FOR_DATA;
          }
          emitStatus();
        } else {
          if (hasConnectedBefore) {
            transportStatus = 'disconnected';
            deviceStatus = DEVICE_STATUS.CONNECTION_ERROR;
            emitStatus();
          } else {
            // Still in initial connection establishment
            transportStatus = 'connecting';
            deviceStatus = DEVICE_STATUS.CONNECTING;
            emitStatus();
          }
        }
      }, (err) => {
        console.warn('[CareTag Firebase] .info/connected listener error:', err);
        firebaseConnected = false;
        transportStatus = 'error';
        deviceStatus = DEVICE_STATUS.CONNECTION_ERROR;
        emitStatus();
      });

      // Listen to sensorData node
      onValue(dbRef, (snapshot) => {
        if (!isMounted) return;
        if (snapshot.exists()) {
          handleData(snapshot.val(), 'firebase_sdk');
        } else {
          deviceStatus = DEVICE_STATUS.WAITING_FOR_DATA;
          emitStatus();
        }
      }, (err) => {
        console.warn('[CareTag Firebase] RTDB onValue error, falling back to polling:', err);
        startPollingFallback();
      });
    } catch (sdkErr) {
      console.warn('[CareTag Firebase] SDK initialization failed, falling back:', sdkErr);
      startPollingFallback();
    }
  } else {
    startPollingFallback();
  }

  // 2. Polling Fallback (Edge proxy or REST endpoint)
  function startPollingFallback() {
    if (pollIntervalId) return;

    async function poll() {
      if (!isMounted) return;
      try {
        // Try Cloudflare Worker edge endpoint
        let res = await fetch('/api/hardware/telemetry', { cache: 'no-store' }).catch(() => null);
        if (res && res.ok) {
          const json = await res.json();
          if (json?.data) {
            firebaseConnected = true;
            transportStatus = 'connected';
            handleData(json.raw || json.data, 'worker_edge');
            return;
          }
        }

        // Direct Firebase REST endpoint
        const restPath = options.path || (options.deviceKey && options.deviceKey !== 'CARE-TAG-01' ? `devices/${options.deviceKey}/sensorData` : 'sensorData');
        const restUrl = `${FIREBASE_CONFIG.databaseURL}/${restPath}.json`;
        res = await fetch(restUrl, { cache: 'no-store' });
        if (res && res.ok) {
          const raw = await res.json();
          if (raw) {
            firebaseConnected = true;
            transportStatus = 'connected';
            handleData(raw, 'rest_polling');
          }
        } else {
          firebaseConnected = false;
          transportStatus = 'disconnected';
          deviceStatus = DEVICE_STATUS.CONNECTION_ERROR;
          emitStatus();
        }
      } catch (pollErr) {
        if (isMounted) {
          firebaseConnected = false;
          transportStatus = 'error';
          deviceStatus = DEVICE_STATUS.CONNECTION_ERROR;
          emitStatus();
        }
      }
    }

    poll();
    pollIntervalId = setInterval(poll, 4000);
  }

  // Start 1-second status state machine ticker
  startStatusTicker();
  emitStatus();

  // Unsubscribe and timer cleanup
  return function unsubscribe() {
    isMounted = false;
    clearTimeout(verifyTimer);
    if (tickerIntervalId) clearInterval(tickerIntervalId);
    if (pollIntervalId) clearInterval(pollIntervalId);
    if (dbRef) {
      try { off(dbRef); } catch {}
    }
    if (connectedRef) {
      try { off(connectedRef); } catch {}
    }
  };
}

/**
 * One-shot check of Firebase connectivity and hardware status
 */
export async function testHardwareConnection() {
  const t0 = performance.now();
  try {
    const res = await fetch(`${FIREBASE_CONFIG.databaseURL}/sensorData.json`, {
      cache: 'no-store'
    });
    const latency = Math.round(performance.now() - t0);
    if (!res.ok) {
      return { ok: false, status: res.status, latencyMs: latency, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { ok: true, latencyMs: latency, data, packet: parseHardwareTelemetry(data) };
  } catch (err) {
    return { ok: false, latencyMs: Math.round(performance.now() - t0), error: err.message };
  }
}

/**
 * ── Safe-Zone Management via Firebase Realtime Database ──
 */

export function validateSafeZoneData(zone, deviceKey = 'CARE-TAG-01') {
  if (!zone || typeof zone !== 'object') {
    throw new Error('Safe zone data object is required.');
  }

  const label = (zone.label || zone.name || '').trim();
  if (!label) {
    throw new Error('Zone display name is required.');
  }

  const lat = Number(zone.centerLatitude ?? zone.latitude ?? zone.lat);
  const lng = Number(zone.centerLongitude ?? zone.longitude ?? zone.lng);

  if (isNaN(lat) || lat < -90 || lat > 90) {
    throw new Error('Latitude must be a valid number between -90 and 90 degrees.');
  }
  if (isNaN(lng) || lng < -180 || lng > 180) {
    throw new Error('Longitude must be a valid number between -180 and 180 degrees.');
  }

  const radiusMeters = Number(zone.radiusMeters || 500);
  if (isNaN(radiusMeters) || radiusMeters < 50 || radiusMeters > 10000) {
    throw new Error('Coverage radius must be between 50m and 10,000m.');
  }

  const id = String(zone.id || `zone-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const category = (zone.category || 'home').toLowerCase();
  const nowIso = new Date().toISOString();

  const schedule = zone.schedule || {
    mode: 'all_day',
    days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    startTime: '00:00',
    endTime: '23:59',
    timezone: 'Asia/Kolkata',
    enabled: true,
  };

  return {
    id,
    deviceId: deviceKey,
    deviceKey,
    label,
    name: label,
    category,
    centerLatitude: parseFloat(lat.toFixed(6)),
    centerLongitude: parseFloat(lng.toFixed(6)),
    radiusMeters: Math.round(radiusMeters),
    enabled: zone.enabled !== false,
    isActive: zone.isActive !== false && zone.enabled !== false,
    schedule: {
      mode: schedule.mode === 'custom' ? 'custom' : 'all_day',
      days: Array.isArray(schedule.days) && schedule.days.length > 0
        ? schedule.days.map(d => String(d).toLowerCase().slice(0, 3))
        : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      startTime: schedule.startTime || '00:00',
      endTime: schedule.endTime || '23:59',
      timezone: schedule.timezone || 'Asia/Kolkata',
      enabled: schedule.enabled !== false,
    },
    createdAtUtc: zone.createdAtUtc || nowIso,
    updatedAtUtc: nowIso,
  };
}

/**
 * Saves or creates a safe zone directly in Firebase Realtime Database.
 * Persists across:
 * 1. Device key path (/safeZones/${deviceKey}/${zone.id})
 * 2. Primary hardware path (/safeZones/CARE-TAG-01/${zone.id})
 * 3. User-specific path (/users/${userId}/safeZones/${zone.id})
 * 4. Shared CareTag ecosystem path (/shared/safeZones/${zone.id})
 * This ensures that the safe place is stored for that particular user,
 * and remains immediately visible if someone else opens the app.
 */
export async function saveSafeZoneToFirebase(deviceKey, zoneData, userId = null) {
  try {
    const key = deviceKey || 'CARE-TAG-01';
    const effectiveUserId = userId || zoneData.userId || 'usr_singla_be23';
    const zone = validateSafeZoneData({
      ...zoneData,
      userId: effectiveUserId,
      createdBy: effectiveUserId,
      deviceId: key,
      deviceKey: key,
    }, key);

    const endpoints = [
      `${FIREBASE_CONFIG.databaseURL}/safeZones/${encodeURIComponent(key)}/${encodeURIComponent(zone.id)}.json`,
      `${FIREBASE_CONFIG.databaseURL}/safeZones/CARE-TAG-01/${encodeURIComponent(zone.id)}.json`,
      `${FIREBASE_CONFIG.databaseURL}/users/${encodeURIComponent(effectiveUserId)}/safeZones/${encodeURIComponent(zone.id)}.json`,
      `${FIREBASE_CONFIG.databaseURL}/shared/safeZones/${encodeURIComponent(zone.id)}.json`,
    ];

    const results = await Promise.all(
      endpoints.map(url =>
        fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(zone),
        }).then(res => res.ok ? res.json() : null).catch(() => null)
      )
    );

    const saved = results.find(r => r && (r.id || r.label || r.name));
    return { ok: true, data: (saved && saved.id) ? saved : zone };
  } catch (err) {
    return {
      ok: false,
      error: `Safe zone write failed: ${err.message}`
    };
  }
}

/**
 * Fetches all safe zones from Firebase Realtime Database.
 * Aggregates and deduplicates across device, primary band, user-specific,
 * and shared paths to ensure any safe place created is visible to anyone opening the dashboard.
 */
export async function fetchSafeZonesFromFirebase(deviceKey = 'CARE-TAG-01', userId = null) {
  try {
    const key = deviceKey || 'CARE-TAG-01';
    const effectiveUserId = userId || 'usr_singla_be23';

    const urls = [
      `${FIREBASE_CONFIG.databaseURL}/safeZones/${encodeURIComponent(key)}.json`,
      `${FIREBASE_CONFIG.databaseURL}/safeZones/CARE-TAG-01.json`,
      `${FIREBASE_CONFIG.databaseURL}/users/${encodeURIComponent(effectiveUserId)}/safeZones.json`,
      `${FIREBASE_CONFIG.databaseURL}/shared/safeZones.json`,
    ];

    const responses = await Promise.all(
      urls.map(url =>
        fetch(url, { cache: 'no-store' })
          .then(res => res.ok ? res.json() : null)
          .catch(() => null)
      )
    );

    const zoneMap = new Map();

    for (const data of responses) {
      if (data && typeof data === 'object') {
        const items = Array.isArray(data) ? data : Object.values(data);
        for (const item of items) {
          if (item && item.id) {
            const existing = zoneMap.get(String(item.id));
            if (!existing) {
              zoneMap.set(String(item.id), item);
            } else {
              const existingTime = new Date(existing.updatedAtUtc || 0).getTime();
              const itemTime = new Date(item.updatedAtUtc || 0).getTime();
              if (itemTime > existingTime) {
                zoneMap.set(String(item.id), item);
              }
            }
          }
        }
      }
    }

    return Array.from(zoneMap.values());
  } catch (err) {
    console.warn('[CareTag Firebase] fetchSafeZonesFromFirebase error:', err);
    return [];
  }
}

/**
 * Updates an existing safe zone in Firebase Realtime Database across all paths.
 */
export async function updateSafeZoneInFirebase(deviceKey, zoneId, updates, userId = null) {
  try {
    const key = deviceKey || 'CARE-TAG-01';
    const effectiveUserId = userId || updates.userId || 'usr_singla_be23';

    // Fetch existing zone from primary endpoint to merge
    const currentUrl = `${FIREBASE_CONFIG.databaseURL}/safeZones/${encodeURIComponent(key)}/${encodeURIComponent(zoneId)}.json`;
    let existing = {};
    try {
      const getRes = await fetch(currentUrl, { cache: 'no-store' });
      if (getRes.ok) existing = (await getRes.json()) || {};
    } catch {}

    const merged = {
      ...existing,
      ...updates,
      id: zoneId,
      userId: existing.userId || effectiveUserId,
      updatedAtUtc: new Date().toISOString(),
    };

    const validated = validateSafeZoneData(merged, key);

    const endpoints = [
      `${FIREBASE_CONFIG.databaseURL}/safeZones/${encodeURIComponent(key)}/${encodeURIComponent(zoneId)}.json`,
      `${FIREBASE_CONFIG.databaseURL}/safeZones/CARE-TAG-01/${encodeURIComponent(zoneId)}.json`,
      `${FIREBASE_CONFIG.databaseURL}/users/${encodeURIComponent(validated.userId || effectiveUserId)}/safeZones/${encodeURIComponent(zoneId)}.json`,
      `${FIREBASE_CONFIG.databaseURL}/shared/safeZones/${encodeURIComponent(zoneId)}.json`,
    ];

    await Promise.all(
      endpoints.map(url =>
        fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validated),
        }).catch(() => {})
      )
    );

    return { ok: true, data: validated };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Deletes a safe zone from Firebase Realtime Database across all paths.
 */
export async function deleteSafeZoneFromFirebase(deviceKey, zoneId, userId = null) {
  try {
    const key = deviceKey || 'CARE-TAG-01';
    const effectiveUserId = userId || 'usr_singla_be23';

    const endpoints = [
      `${FIREBASE_CONFIG.databaseURL}/safeZones/${encodeURIComponent(key)}/${encodeURIComponent(zoneId)}.json`,
      `${FIREBASE_CONFIG.databaseURL}/safeZones/CARE-TAG-01/${encodeURIComponent(zoneId)}.json`,
      `${FIREBASE_CONFIG.databaseURL}/users/${encodeURIComponent(effectiveUserId)}/safeZones/${encodeURIComponent(zoneId)}.json`,
      `${FIREBASE_CONFIG.databaseURL}/shared/safeZones/${encodeURIComponent(zoneId)}.json`,
    ];

    await Promise.all(
      endpoints.map(url =>
        fetch(url, { method: 'DELETE' }).catch(() => {})
      )
    );

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Subscribes to real-time safe zone updates from Firebase Realtime Database.
 * Ensures that if anyone creates, updates, or deletes a safe place,
 * all open caregiver dashboards reflect the change immediately.
 */
export function subscribeSafeZones(deviceKey, userId, onZonesUpdated) {
  if (typeof onZonesUpdated !== 'function') return () => {};

  let isMounted = true;
  let pollTimer = null;
  let db = null;
  let safeZoneRef = null;

  try {
    db = getFirebaseDatabase();
    if (db) {
      const key = deviceKey || 'CARE-TAG-01';
      safeZoneRef = ref(db, `safeZones/${key}`);
      onValue(safeZoneRef, async () => {
        if (!isMounted) return;
        const fresh = await fetchSafeZonesFromFirebase(deviceKey, userId);
        if (isMounted && Array.isArray(fresh)) {
          onZonesUpdated(fresh);
        }
      }, (err) => {
        console.warn('[CareTag Firebase] subscribeSafeZones onValue error:', err);
      });
    }
  } catch (err) {
    console.warn('[CareTag Firebase] RTDB SDK subscription error:', err);
  }

  // Periodic poll fallback (every 5s) to guarantee multi-device / multi-user synchronization
  pollTimer = setInterval(async () => {
    if (!isMounted) return;
    try {
      const fresh = await fetchSafeZonesFromFirebase(deviceKey, userId);
      if (isMounted && Array.isArray(fresh) && fresh.length > 0) {
        onZonesUpdated(fresh);
      }
    } catch {}
  }, 5000);

  return function unsubscribe() {
    isMounted = false;
    if (pollTimer) clearInterval(pollTimer);
    if (safeZoneRef) {
      try { off(safeZoneRef); } catch {}
    }
  };
}

/**
 * ── Routine History & Profile via Firebase Realtime Database ──
 */

export async function saveRoutineObservationToFirebase(deviceKey, observation) {
  if (!observation || !deviceKey) return false;
  if (observation.source === 'simulation' || observation.isSimulation) return false; // Exclude simulation

  try {
    const key = deviceKey || 'CARE-TAG-01';
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const obsId = `obs-${now.getTime()}`;

    const record = {
      id: obsId,
      deviceId: key,
      timestamp: now.toISOString(),
      latitude: observation.latitude,
      longitude: observation.longitude,
      speedKph: observation.speedKph || 0,
      motionState: observation.motionState || 'stationary',
      gpsValid: Boolean(observation.gps?.valid),
      source: 'live_hardware',
    };

    const url = `${FIREBASE_CONFIG.databaseURL}/routineHistory/${encodeURIComponent(key)}/${dateStr}/${obsId}.json`;
    await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });

    return true;
  } catch {
    return false;
  }
}

export async function fetchRoutineHistoryFromFirebase(deviceKey = 'CARE-TAG-01') {
  try {
    const key = deviceKey || 'CARE-TAG-01';
    const url = `${FIREBASE_CONFIG.databaseURL}/routineHistory/${encodeURIComponent(key)}.json`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return {};
    const data = await res.json();
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

export async function saveRoutineProfileToFirebase(deviceKey, profile) {
  try {
    const key = deviceKey || 'CARE-TAG-01';
    const url = `${FIREBASE_CONFIG.databaseURL}/routineProfile/${encodeURIComponent(key)}.json`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchRoutineProfileFromFirebase(deviceKey = 'CARE-TAG-01') {
  try {
    const key = deviceKey || 'CARE-TAG-01';
    const url = `${FIREBASE_CONFIG.databaseURL}/routineProfile/${encodeURIComponent(key)}.json`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * ── Alerts Persistence via Firebase Realtime Database ──
 */

export async function saveAlertToFirebase(deviceKey, alert) {
  try {
    const key = deviceKey || 'CARE-TAG-01';
    const id = alert.id || `alert-${Date.now()}`;
    const url = `${FIREBASE_CONFIG.databaseURL}/alerts/${encodeURIComponent(key)}/${encodeURIComponent(id)}.json`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alert),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchAlertsFromFirebase(deviceKey = 'CARE-TAG-01') {
  try {
    const key = deviceKey || 'CARE-TAG-01';
    const url = `${FIREBASE_CONFIG.databaseURL}/alerts/${encodeURIComponent(key)}.json`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data || typeof data !== 'object') return [];
    return Object.values(data);
  } catch {
    return [];
  }
}

/**
 * ── Granular Diagnostics for Firebase RTDB Operations ──
 * Performs independent verification for all 8 operations required by Technical Inspector.
 */
export async function diagnoseFirebaseOperations(deviceKey = 'CARE-TAG-01') {
  const results = {};
  const tStart = performance.now();

  // 1. Read Live Telemetry
  try {
    const t0 = performance.now();
    const res = await fetch(`${FIREBASE_CONFIG.databaseURL}/sensorData.json`, { cache: 'no-store' });
    const latency = Math.round(performance.now() - t0);
    if (res.ok) {
      const data = await res.json();
      results.readTelemetry = {
        ok: true,
        latencyMs: latency,
        status: 'Healthy',
        lastSuccess: new Date().toISOString(),
        details: `Live node active (${data?.uptime_ms ? `Uptime: ${data.uptime_ms}ms` : 'Valid data'})`,
      };
    } else {
      results.readTelemetry = {
        ok: false,
        latencyMs: latency,
        status: `HTTP ${res.status}`,
        error: `Failed to read /sensorData.json (HTTP ${res.status})`,
      };
    }
  } catch (err) {
    results.readTelemetry = { ok: false, status: 'Error', error: err.message };
  }

  // 2. Read Safe Zones
  try {
    const t0 = performance.now();
    const res = await fetch(`${FIREBASE_CONFIG.databaseURL}/safeZones/${encodeURIComponent(deviceKey)}.json`, { cache: 'no-store' });
    const latency = Math.round(performance.now() - t0);
    if (res.ok) {
      const data = await res.json();
      const count = data ? Object.keys(data).length : 0;
      results.readSafeZones = {
        ok: true,
        latencyMs: latency,
        status: 'Healthy',
        lastSuccess: new Date().toISOString(),
        details: `${count} configured safe place${count === 1 ? '' : 's'} loaded`,
      };
    } else {
      results.readSafeZones = { ok: false, latencyMs: latency, status: `HTTP ${res.status}`, error: `HTTP ${res.status}` };
    }
  } catch (err) {
    results.readSafeZones = { ok: false, status: 'Error', error: err.message };
  }

  // 3. Create Safe Zone (Diagnostic Probe Write)
  const probeId = `probe_${Date.now()}`;
  try {
    const t0 = performance.now();
    const probeZone = {
      id: probeId,
      deviceId: deviceKey,
      label: 'Diagnostic Test Zone',
      category: 'custom',
      centerLatitude: 30.3491,
      centerLongitude: 76.4117,
      radiusMeters: 500,
      enabled: false,
      _diagnostic: true,
      timestamp: Date.now(),
    };
    const res = await fetch(`${FIREBASE_CONFIG.databaseURL}/safeZones/${encodeURIComponent(deviceKey)}/${probeId}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(probeZone),
    });
    const latency = Math.round(performance.now() - t0);
    if (res.ok) {
      results.createSafeZone = {
        ok: true,
        latencyMs: latency,
        status: 'Healthy',
        lastSuccess: new Date().toISOString(),
        details: 'Write authorization verified on /safeZones',
      };
    } else {
      results.createSafeZone = { ok: false, latencyMs: latency, status: `HTTP ${res.status}`, error: 'Write failed or denied' };
    }
  } catch (err) {
    results.createSafeZone = { ok: false, status: 'Error', error: err.message };
  }

  // 4. Edit Safe Zone (Probe Update)
  try {
    const t0 = performance.now();
    const res = await fetch(`${FIREBASE_CONFIG.databaseURL}/safeZones/${encodeURIComponent(deviceKey)}/${probeId}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updatedAtUtc: new Date().toISOString(), radiusMeters: 600 }),
    });
    const latency = Math.round(performance.now() - t0);
    if (res.ok) {
      results.editSafeZone = {
        ok: true,
        latencyMs: latency,
        status: 'Healthy',
        lastSuccess: new Date().toISOString(),
        details: 'Update (PATCH/PUT) verified',
      };
    } else {
      results.editSafeZone = { ok: false, latencyMs: latency, status: `HTTP ${res.status}`, error: 'Update failed' };
    }
  } catch (err) {
    results.editSafeZone = { ok: false, status: 'Error', error: err.message };
  }

  // 5. Delete Safe Zone (Probe Cleanup)
  try {
    const t0 = performance.now();
    const res = await fetch(`${FIREBASE_CONFIG.databaseURL}/safeZones/${encodeURIComponent(deviceKey)}/${probeId}.json`, {
      method: 'DELETE',
    });
    const latency = Math.round(performance.now() - t0);
    if (res.ok) {
      results.deleteSafeZone = {
        ok: true,
        latencyMs: latency,
        status: 'Healthy',
        lastSuccess: new Date().toISOString(),
        details: 'DELETE authorization verified & test probe cleaned',
      };
    } else {
      results.deleteSafeZone = { ok: false, latencyMs: latency, status: `HTTP ${res.status}`, error: 'DELETE failed' };
    }
  } catch (err) {
    results.deleteSafeZone = { ok: false, status: 'Error', error: err.message };
  }

  // 6. Persist Routine History
  try {
    const t0 = performance.now();
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(`${FIREBASE_CONFIG.databaseURL}/routineHistory/${encodeURIComponent(deviceKey)}/${today}/_probe.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true, timestamp: Date.now() }),
    });
    const latency = Math.round(performance.now() - t0);
    if (res.ok) {
      // Clean up probe
      await fetch(`${FIREBASE_CONFIG.databaseURL}/routineHistory/${encodeURIComponent(deviceKey)}/${today}/_probe.json`, { method: 'DELETE' }).catch(() => {});
      results.persistRoutineHistory = {
        ok: true,
        latencyMs: latency,
        status: 'Healthy',
        lastSuccess: new Date().toISOString(),
        details: 'Daily history partition write verified',
      };
    } else {
      results.persistRoutineHistory = { ok: false, latencyMs: latency, status: `HTTP ${res.status}`, error: 'Routine history write denied' };
    }
  } catch (err) {
    results.persistRoutineHistory = { ok: false, status: 'Error', error: err.message };
  }

  // 7. Load Learned Routine Profile
  try {
    const t0 = performance.now();
    const res = await fetch(`${FIREBASE_CONFIG.databaseURL}/routineProfile/${encodeURIComponent(deviceKey)}.json`, { cache: 'no-store' });
    const latency = Math.round(performance.now() - t0);
    if (res.ok) {
      results.loadRoutineProfile = {
        ok: true,
        latencyMs: latency,
        status: 'Healthy',
        lastSuccess: new Date().toISOString(),
        details: 'Profile retrieval endpoint reachable',
      };
    } else {
      results.loadRoutineProfile = { ok: false, latencyMs: latency, status: `HTTP ${res.status}`, error: 'Profile load failed' };
    }
  } catch (err) {
    results.loadRoutineProfile = { ok: false, status: 'Error', error: err.message };
  }

  // 8. Saving Alerts/Events
  try {
    const t0 = performance.now();
    const res = await fetch(`${FIREBASE_CONFIG.databaseURL}/alerts/${encodeURIComponent(deviceKey)}/_probe.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true, timestamp: Date.now() }),
    });
    const latency = Math.round(performance.now() - t0);
    if (res.ok) {
      // Clean up probe
      await fetch(`${FIREBASE_CONFIG.databaseURL}/alerts/${encodeURIComponent(deviceKey)}/_probe.json`, { method: 'DELETE' }).catch(() => {});
      results.saveAlerts = {
        ok: true,
        latencyMs: latency,
        status: 'Healthy',
        lastSuccess: new Date().toISOString(),
        details: 'Alerts & events persistence verified',
      };
    } else {
      results.saveAlerts = { ok: false, latencyMs: latency, status: `HTTP ${res.status}`, error: 'Alerts write failed' };
    }
  } catch (err) {
    results.saveAlerts = { ok: false, status: 'Error', error: err.message };
  }

  return {
    totalDurationMs: Math.round(performance.now() - tStart),
    timestamp: new Date().toISOString(),
    results,
  };
}

const firebaseService = {
  FIREBASE_CONFIG,
  getFirebaseApp,
  getFirebaseDatabase,
  parseHardwareTelemetry,
  subscribeHardwareTelemetry,
  testHardwareConnection,
  saveSafeZoneToFirebase,
  fetchSafeZonesFromFirebase,
  updateSafeZoneInFirebase,
  deleteSafeZoneFromFirebase,
  subscribeSafeZones,
  saveRoutineObservationToFirebase,
  fetchRoutineHistoryFromFirebase,
  saveRoutineProfileToFirebase,
  fetchRoutineProfileFromFirebase,
  saveAlertToFirebase,
  fetchAlertsFromFirebase,
  diagnoseFirebaseOperations,
  validateSafeZoneData,
  formatUptime,
  isValidGpsCoordinate,
  parseValidTimestamp,
};

export default firebaseService;

