/**
 * CareTag API Client
 * 
 * Handles geofence CRUD with automatic localStorage fallback.
 * All localStorage keys are user-scoped via userId for data isolation.
 */

import { userKey, getSession } from './auth';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5077';
const DEVICE_KEY = process.env.REACT_APP_DEVICE_KEY || 'DEFAULT';

// ── User-scoped localStorage helpers ──

function getUserId() {
  const session = getSession();
  return session?.userId || '__anonymous__';
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
  const label = body.Label || body.label || 'Unnamed';

  // Check for duplicate label locally
  if (list.some(g => g.label.toLowerCase() === label.toLowerCase())) {
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
    radiusMeters: Number(body.RadiusMeters ?? body.radiusMeters),
    isActive: true,
    createdAtUtc: new Date().toISOString(),
    _local: true,
  };
  list.push(newGeo);
  saveLocalGeofences(uid, list);
  return { ok: true, status: 201, data: newGeo };
}

// ── API functions with automatic localStorage fallback ──

export async function fetchLatestPacket(deviceKey = DEVICE_KEY) {
  try {
    const url = `${API_BASE}/api/devices/${encodeURIComponent(deviceKey)}/packets/latest`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function postGeofence(deviceKey = DEVICE_KEY, body) {
  const uid = getUserId();
  try {
    const url = `${API_BASE}/api/devices/${encodeURIComponent(deviceKey)}/geofences`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });

    // ── Success from backend ──
    if (res.ok) {
      if (res.headers.get('content-type')?.includes('application/json')) {
        const json = await res.json();
        // Also save locally for offline access
        const list = loadLocalGeofences(uid);
        if (!list.some(g => g.id === json.id)) {
          list.push(json);
          saveLocalGeofences(uid, list);
        }
        return { ok: true, status: res.status, data: json };
      }
      return { ok: true, status: res.status, data: null };
    }

    // ── Backend error ──
    const text = await res.text().catch(() => '');

    // Duplicate label detection
    if (text && (text.includes('IX_geofence') || text.includes('duplicate') || text.includes('unique'))) {
      return {
        ok: false,
        status: res.status,
        data: 'A geofence with this label already exists. Choose a different name.'
      };
    }

    // Backend returned 500 or other error — fallback to localStorage
    if (res.status >= 500) {
      return saveToLocal(body, uid);
    }

    return { ok: false, status: res.status, data: text || 'Save failed' };
  } catch {
    // Network error (backend completely down) — save to localStorage
    return saveToLocal(body, uid);
  }
}

export async function deleteGeofence(deviceKey = DEVICE_KEY, id) {
  const uid = getUserId();
  // Always remove from localStorage
  const list = loadLocalGeofences(uid).filter(g => g.id !== id);
  saveLocalGeofences(uid, list);

  try {
    const url = `${API_BASE}/api/devices/${encodeURIComponent(deviceKey)}/geofences/${id}`;
    const res = await fetch(url, { method: 'DELETE' });
    return { ok: res.ok || true, status: res.status };
  } catch {
    return { ok: true, status: 204 };
  }
}

export async function fetchGeofences(deviceKey = DEVICE_KEY) {
  const uid = getUserId();
  const localList = loadLocalGeofences(uid);

  try {
    const url = `${API_BASE}/api/devices/${encodeURIComponent(deviceKey)}/geofences`;
    const res = await fetch(url, { cache: 'no-store' });

    if (!res.ok) {
      // Backend returned error (500, etc) — use localStorage
      return localList;
    }

    const serverList = await res.json();
    // Merge: server is source of truth, but add any local-only geofences
    const serverIds = new Set(serverList.map(g => g.id));
    const merged = [...serverList, ...localList.filter(g => !serverIds.has(g.id))];
    // Sync merged list back to localStorage
    saveLocalGeofences(uid, merged);
    return merged;
  } catch {
    // Backend completely down — use localStorage
    return localList;
  }
}

const api = { fetchLatestPacket, postGeofence, deleteGeofence, fetchGeofences };
export default api;
