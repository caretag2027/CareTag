/**
 * CareTag API Client
 * 
 * Provides unified, reliable synchronization of Safe Zones and Telemetry with:
 * 1. Firebase Realtime Database (shared with physical ESP32 Smart Band)
 * 2. Cloudflare Worker Edge endpoints (/api/devices/...)
 * 3. User-scoped persistent localStorage fallback
 */

import { userKey, getSession } from './auth';
import {
  saveSafeZoneToFirebase,
  fetchSafeZonesFromFirebase,
  updateSafeZoneInFirebase,
  deleteSafeZoneFromFirebase,
  FIREBASE_CONFIG
} from './firebase';

const API_BASE = process.env.REACT_APP_API_URL !== undefined 
  ? process.env.REACT_APP_API_URL 
  : '';
const DEFAULT_DEVICE_KEY = process.env.REACT_APP_DEVICE_KEY || 'CARE-TAG-01';

// ── User-scoped localStorage helpers ──

function getUserId() {
  const session = getSession();
  return session?.userId || '__anonymous__';
}

export function getActiveDeviceKey() {
  const session = getSession();
  return session?.deviceKey || DEFAULT_DEVICE_KEY;
}

function getAuthHeaders() {
  const session = getSession();
  const headers = {
    'Content-Type': 'application/json',
  };
  if (session?.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
  }
  return headers;
}

function loadLocalGeofences(userId) {
  try {
    const key = userKey(userId || getUserId(), 'geofences');
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch { return []; }
}

function saveLocalGeofences(userId, list) {
  try {
    const key = userKey(userId || getUserId(), 'geofences');
    localStorage.setItem(key, JSON.stringify(list));
  } catch {}
}

/**
 * Normalizes geofence object for consistency across UI and backend.
 */
function normalizeZone(zone, deviceKey) {
  const label = (zone.label || zone.name || 'Safe Place').trim();
  const lat = Number(zone.centerLatitude ?? zone.latitude ?? zone.lat ?? 30.3491);
  const lng = Number(zone.centerLongitude ?? zone.longitude ?? zone.lng ?? 76.4117);
  const radius = Number(zone.radiusMeters ?? zone.radius ?? 500);

  return {
    id: String(zone.id || `zone-${Date.now()}`),
    deviceId: deviceKey || getActiveDeviceKey(),
    deviceKey: deviceKey || getActiveDeviceKey(),
    label,
    name: label,
    category: (zone.category || 'home').toLowerCase(),
    centerLatitude: parseFloat(lat.toFixed(6)),
    centerLongitude: parseFloat(lng.toFixed(6)),
    radiusMeters: Math.round(radius),
    enabled: zone.enabled !== false,
    isActive: zone.isActive !== false && zone.enabled !== false,
    schedule: zone.schedule || {
      mode: 'all_day',
      days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      startTime: '00:00',
      endTime: '23:59',
      timezone: 'Asia/Kolkata',
      enabled: true,
    },
    createdAtUtc: zone.createdAtUtc || new Date().toISOString(),
    updatedAtUtc: new Date().toISOString(),
  };
}

// ── Safe Zone Management ──

/**
 * Creates or saves a safe zone.
 * First writes to Firebase Realtime Database, then updates local storage and Cloudflare Worker.
 */
export async function createGeofence(zoneData, deviceKey = getActiveDeviceKey()) {
  const uid = getUserId();
  const normalized = normalizeZone(zoneData, deviceKey);

  // 1. Write directly to Firebase Realtime Database
  const fbResult = await saveSafeZoneToFirebase(deviceKey, normalized);

  // Determine effective zone
  const savedZone = (fbResult && fbResult.ok && fbResult.data) ? fbResult.data : normalized;

  // 2. Persist to user-scoped LocalStorage
  const localList = loadLocalGeofences(uid);
  const existingIdx = localList.findIndex(g => String(g.id) === String(savedZone.id));
  if (existingIdx >= 0) {
    localList[existingIdx] = savedZone;
  } else {
    localList.push(savedZone);
  }
  saveLocalGeofences(uid, localList);

  // 3. Optional async sync with Cloudflare Worker
  if (API_BASE) {
    try {
      fetch(`${API_BASE}/api/devices/${encodeURIComponent(deviceKey)}/geofences`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(savedZone),
      }).catch(() => {});
    } catch {}
  }

  if (fbResult && !fbResult.ok) {
    // If Firebase write errored with actionable message, throw or report so caller handles gracefully
    console.warn('[CareTag API] Firebase save warning:', fbResult.error);
  }

  return savedZone;
}

export async function postGeofence(deviceKey = getActiveDeviceKey(), body) {
  // Support both (deviceKey, body) and (body) parameter signatures
  if (typeof deviceKey === 'object' && body === undefined) {
    return createGeofence(deviceKey, getActiveDeviceKey());
  }
  return createGeofence(body, deviceKey);
}

/**
 * Updates an existing safe zone in Firebase and LocalStorage.
 */
export async function updateGeofence(id, updates, deviceKey = getActiveDeviceKey()) {
  const uid = getUserId();
  const zoneId = String(id);

  // 1. Update in Firebase RTDB
  const fbResult = await updateSafeZoneInFirebase(deviceKey, zoneId, updates);

  // 2. Update in LocalStorage
  const localList = loadLocalGeofences(uid);
  const existingIdx = localList.findIndex(g => String(g.id) === zoneId);
  let updatedZone = null;

  if (existingIdx >= 0) {
    updatedZone = {
      ...localList[existingIdx],
      ...updates,
      id: zoneId,
      updatedAtUtc: new Date().toISOString(),
    };
    localList[existingIdx] = updatedZone;
    saveLocalGeofences(uid, localList);
  } else if (fbResult && fbResult.data) {
    updatedZone = fbResult.data;
    localList.push(updatedZone);
    saveLocalGeofences(uid, localList);
  }

  return updatedZone || updates;
}

/**
 * Deletes a safe zone from Firebase and LocalStorage.
 */
export async function deleteGeofence(deviceKeyOrId, optionalId) {
  const uid = getUserId();
  let deviceKey = getActiveDeviceKey();
  let id = deviceKeyOrId;

  if (optionalId !== undefined) {
    deviceKey = deviceKeyOrId;
    id = optionalId;
  }

  const zoneId = String(id);

  // 1. Delete from LocalStorage immediately (optimistic)
  const list = loadLocalGeofences(uid).filter(g => String(g.id) !== zoneId);
  saveLocalGeofences(uid, list);

  // 2. Delete from Firebase RTDB
  await deleteSafeZoneFromFirebase(deviceKey, zoneId).catch(() => {});

  // 3. Optional delete on Cloudflare Worker
  if (API_BASE) {
    try {
      fetch(`${API_BASE}/api/devices/${encodeURIComponent(deviceKey)}/geofences/${zoneId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }).catch(() => {});
    } catch {}
  }

  return { ok: true, status: 204 };
}

/**
 * Fetches all safe zones for the current user and device.
 * Merges Firebase RTDB data with local cache for instant rendering and durability.
 */
export async function fetchGeofences(deviceKey = getActiveDeviceKey()) {
  const uid = getUserId();
  const localList = loadLocalGeofences(uid);

  try {
    // 1. Fetch from Firebase RTDB
    const fbList = await fetchSafeZonesFromFirebase(deviceKey);

    if (Array.isArray(fbList) && fbList.length > 0) {
      // Index by id
      const fbMap = new Map(fbList.map(z => [String(z.id), z]));
      // Merge local zones not yet on Firebase
      const merged = [...fbList];
      for (const lz of localList) {
        if (!fbMap.has(String(lz.id))) {
          merged.push(lz);
          // Sync missing zone to Firebase in background
          saveSafeZoneToFirebase(deviceKey, lz).catch(() => {});
        }
      }
      saveLocalGeofences(uid, merged);
      return merged;
    }

    // 2. If Firebase returned empty but we have local zones, push them to Firebase
    if (localList.length > 0) {
      for (const zone of localList) {
        saveSafeZoneToFirebase(deviceKey, zone).catch(() => {});
      }
      return localList;
    }

    return [];
  } catch (err) {
    console.warn('[CareTag API] fetchGeofences fallback to local cache:', err);
    return localList;
  }
}

// ── Telemetry & Cloudflare Endpoints ──

export async function fetchLatestPacket(deviceKey = getActiveDeviceKey()) {
  try {
    const url = `${API_BASE}/api/devices/${encodeURIComponent(deviceKey)}/packets/latest`;
    const res = await fetch(url, {
      headers: getAuthHeaders(),
      cache: 'no-store'
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function sendTelemetryPacket(packet, deviceKey = getActiveDeviceKey()) {
  try {
    const url = `${API_BASE}/api/devices/${encodeURIComponent(deviceKey)}/packets`;
    const res = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(packet),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchHardwareTelemetry() {
  try {
    const res = await fetch(`${FIREBASE_CONFIG.databaseURL}/sensorData.json`, {
      cache: 'no-store'
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchFirebaseConfig() {
  return {
    ok: true,
    config: FIREBASE_CONFIG,
  };
}

const api = {
  createGeofence,
  postGeofence,
  updateGeofence,
  deleteGeofence,
  fetchGeofences,
  getActiveDeviceKey,
  fetchLatestPacket,
  sendTelemetryPacket,
  fetchHardwareTelemetry,
  fetchFirebaseConfig,
};

export default api;
