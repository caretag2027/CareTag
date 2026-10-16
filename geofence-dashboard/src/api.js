/**
 * CareTag API Client
 * 
 * Interacts with the Cloudflare Worker serverless backend (/api/devices/...)
 * with automatic user-scoped localStorage synchronization and offline fallback.
 */

import { userKey, getSession } from './auth';

const API_BASE = process.env.REACT_APP_API_URL !== undefined 
  ? process.env.REACT_APP_API_URL 
  : '';
const DEFAULT_DEVICE_KEY = process.env.REACT_APP_DEVICE_KEY || 'CARE-TAG-01';

// ── User-scoped localStorage helpers ──

function getUserId() {
  const session = getSession();
  return session?.userId || '__anonymous__';
}

function getActiveDeviceKey() {
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

let _nextLocalId = Date.now();

// ── Helper: save a geofence to localStorage ──
function saveToLocal(body, userId) {
  const uid = userId || getUserId();
  const list = loadLocalGeofences(uid);
  const label = body.Label || body.label || 'Unnamed Zone';

  if (list.some(g => (g.label || '').toLowerCase() === label.toLowerCase())) {
    return {
      ok: false,
      status: 409,
      data: 'A geofence with this label already exists. Choose a different name.'
    };
  }

  const newGeo = {
    id: _nextLocalId++,
    label: label,
    centerLatitude: Number(body.CenterLatitude ?? body.centerLatitude),
    centerLongitude: Number(body.CenterLongitude ?? body.centerLongitude),
    radiusMeters: Number(body.RadiusMeters ?? body.radiusMeters ?? 100),
    isActive: true,
    createdAtUtc: new Date().toISOString(),
    _local: true,
  };
  list.push(newGeo);
  saveLocalGeofences(uid, list);
  return { ok: true, status: 201, data: newGeo };
}

// ── API functions with automatic fallback ──

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

export async function postGeofence(deviceKey = getActiveDeviceKey(), body) {
  const uid = getUserId();
  try {
    const url = `${API_BASE}/api/devices/${encodeURIComponent(deviceKey)}/geofences`;
    const res = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body)
    });

    if (res.ok) {
      if (res.headers.get('content-type')?.includes('application/json')) {
        const json = await res.json();
        const list = loadLocalGeofences(uid);
        if (!list.some(g => g.id === json.id)) {
          list.push(json);
          saveLocalGeofences(uid, list);
        }
        return { ok: true, status: res.status, data: json };
      }
      return { ok: true, status: res.status, data: null };
    }

    const text = await res.text().catch(() => '');

    if (text && (text.includes('IX_geofence') || text.includes('duplicate') || text.includes('already exists'))) {
      return {
        ok: false,
        status: res.status,
        data: 'A geofence with this label already exists. Choose a different name.'
      };
    }

    if (res.status >= 500) {
      return saveToLocal(body, uid);
    }

    return { ok: false, status: res.status, data: text || 'Save failed' };
  } catch {
    return saveToLocal(body, uid);
  }
}

export async function deleteGeofence(deviceKey = getActiveDeviceKey(), id) {
  const uid = getUserId();
  const list = loadLocalGeofences(uid).filter(g => g.id !== id);
  saveLocalGeofences(uid, list);

  try {
    const url = `${API_BASE}/api/devices/${encodeURIComponent(deviceKey)}/geofences/${id}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return { ok: res.ok || true, status: res.status };
  } catch {
    return { ok: true, status: 204 };
  }
}

export async function fetchGeofences(deviceKey = getActiveDeviceKey()) {
  const uid = getUserId();
  const localList = loadLocalGeofences(uid);

  try {
    const url = `${API_BASE}/api/devices/${encodeURIComponent(deviceKey)}/geofences`;
    const res = await fetch(url, {
      headers: getAuthHeaders(),
      cache: 'no-store'
    });

    if (!res.ok) {
      return localList;
    }

    const serverList = await res.json();
    if (!Array.isArray(serverList)) return localList;

    const serverIds = new Set(serverList.map(g => g.id));
    const merged = [...serverList, ...localList.filter(g => !serverIds.has(g.id))];
    saveLocalGeofences(uid, merged);
    return merged;
  } catch {
    return localList;
  }
}

const api = {
  fetchLatestPacket,
  sendTelemetryPacket,
  postGeofence,
  deleteGeofence,
  fetchGeofences,
  getActiveDeviceKey,
};
export default api;
