/**
 * CareTag Device Management Store
 * 
 * Provides authenticated Caregiver -> Smart Band device management.
 * Supports single-device setup today with full multi-device architecture for future scaling.
 * Each wearable maintains isolated real-time telemetry, geofences, routine models, and alerts.
 */

import { userKey } from './auth';

/**
 * Stable, persistent CareTag brand color identity for up to N devices.
 * Device 1: CareTag Blue (#2563EB)
 * Device 2: CareTag Teal (#14B8A6)
 * Device 3: Soft Violet (#6366F1)
 * Device 4: Secondary Blue (#0EA5E9)
 * Device 5: Muted Amber (#D97706)
 */
export const DEVICE_PALETTE = [
  '#2563EB', // Device 1 — CareTag Blue
  '#14B8A6', // Device 2 — CareTag Teal
  '#6366F1', // Device 3 — Soft Violet
  '#0EA5E9', // Device 4 — Secondary Blue
  '#D97706', // Device 5 — Muted Amber
];

/**
 * Default authorized device collection.
 * Contains only the genuinely registered physical hardware device (CARE-TAG-01),
 * with user-friendly nickname "Leon". Fabricated demonstration entries have been removed.
 */
export const DEFAULT_DEVICES = [
  {
    id: 'dev_leon_01',
    deviceKey: 'CARE-TAG-01',
    nickname: 'Leon',
    name: 'Leon',
    childName: 'Leon',
    age: 8,
    relation: 'Smart Band',
    avatarColor: '#2563EB',
    isDefault: true,
    hardwareModel: 'ESP32-WROOM-32U + NEO-6M',
    registeredAt: '2026-09-15T08:00:00.000Z',
  },
];

/**
 * Load all registered devices associated with a caregiver user.
 * Sanitizes existing local storage by purging demonstration entries (Diya/Kabir)
 * while preserving the real hardware record (CARE-TAG-01) and any user-added bands.
 */
export function loadUserDevices(userId) {
  if (!userId) return DEFAULT_DEVICES;
  try {
    const key = userKey(userId, 'devices');
    const stored = JSON.parse(localStorage.getItem(key));
    if (Array.isArray(stored)) {
      if (stored.length === 0) return [];
      // Filter out confirmed demonstration fixtures (dev_diya_02, dev_kabir_03)
      // while preserving real device (CARE-TAG-01) and any user-added devices
      const realOrUserAdded = stored.filter(d => 
        d.deviceKey === 'CARE-TAG-01' || d.isUserAdded || (!['dev_diya_02', 'dev_kabir_03'].includes(d.id) && !['Diya Singla', 'Kabir Verma'].includes(d.childName))
      );
      // Ensure CARE-TAG-01 has nickname 'Leon' if not customized by user
      const updated = realOrUserAdded.map(d => {
        if (d.deviceKey === 'CARE-TAG-01' && (!d.nickname || d.nickname === 'Aarav Singla' || d.nickname === 'Device 1')) {
          return { ...d, nickname: 'Leon', name: 'Leon', childName: 'Leon' };
        }
        return d;
      });
      // Save sanitized devices back to localStorage if demo fixtures were purged
      if (updated.length !== stored.length || updated.some((d, i) => d.nickname !== stored[i]?.nickname)) {
        localStorage.setItem(key, JSON.stringify(updated));
      }
      return updated;
    }
  } catch {}

  // Fallback / seed initial devices with only real device
  try {
    const key = userKey(userId, 'devices');
    localStorage.setItem(key, JSON.stringify(DEFAULT_DEVICES));
  } catch {}
  return DEFAULT_DEVICES;
}

/**
 * Update a device's friendly nickname.
 * Persists the change across sessions while keeping the hardware identifier immutable.
 */
export function updateDeviceNickname(userId, deviceKey, newNickname) {
  if (!userId || !deviceKey) {
    return { ok: false, error: 'User ID and Device Key are required' };
  }
  const cleanNickname = (newNickname || '').trim();
  if (!cleanNickname) {
    return { ok: false, error: 'Device nickname cannot be empty' };
  }

  const devices = loadUserDevices(userId);
  const targetIdx = devices.findIndex(d => d.deviceKey === deviceKey);
  if (targetIdx === -1) {
    return { ok: false, error: `Device ${deviceKey} not found in account` };
  }

  devices[targetIdx] = {
    ...devices[targetIdx],
    nickname: cleanNickname,
    name: cleanNickname,
    updatedAt: new Date().toISOString(),
  };

  try {
    const key = userKey(userId, 'devices');
    localStorage.setItem(key, JSON.stringify(devices));
  } catch {}

  return { ok: true, device: devices[targetIdx], devices };
}

/**
 * Add / link a new Smart Band device to the caregiver account.
 * Supports real hardware registration with optional friendly nickname.
 */
export function linkNewDevice(userId, {
  deviceKey,
  nickname,
  name,
  childName,
  age = 8,
  relation = 'Child',
  hardwareModel = 'ESP32 Standalone Smart Band'
}) {
  if (!deviceKey?.trim()) {
    return { ok: false, error: 'Device Key / Hardware Identifier is required' };
  }

  const cleanKey = deviceKey.trim().toUpperCase();
  const devices = loadUserDevices(userId);

  if (devices.some(d => d.deviceKey === cleanKey)) {
    return { ok: false, error: `Device ${cleanKey} is already linked to this account` };
  }

  const friendlyNickname = (nickname || name || childName || cleanKey).trim();
  const assignedColor = DEVICE_PALETTE[devices.length % DEVICE_PALETTE.length];

  const newDevice = {
    id: `dev_${cleanKey.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
    deviceKey: cleanKey,
    nickname: friendlyNickname,
    name: friendlyNickname,
    childName: (childName || friendlyNickname).trim(),
    age: Number(age) || 8,
    relation: (relation || 'Child').trim(),
    avatarColor: assignedColor,
    isDefault: false,
    isUserAdded: true,
    hardwareModel: hardwareModel.trim() || 'ESP32 Standalone Smart Band',
    registeredAt: new Date().toISOString(),
  };

  devices.push(newDevice);

  try {
    const key = userKey(userId, 'devices');
    localStorage.setItem(key, JSON.stringify(devices));
  } catch {}

  return { ok: true, device: newDevice, devices };
}

/**
 * Remove a linked device from the account.
 */
export function removeDevice(userId, deviceKey) {
  if (!userId || !deviceKey) return { ok: false, error: 'Invalid parameters' };
  const devices = loadUserDevices(userId);
  const filtered = devices.filter(d => d.deviceKey !== deviceKey);
  try {
    const key = userKey(userId, 'devices');
    localStorage.setItem(key, JSON.stringify(filtered));
  } catch {}
  return { ok: true, devices: filtered };
}

/**
 * Get active/selected device key for a user.
 */
export function getActiveDeviceKey(userId, fallback = 'CARE-TAG-01') {
  if (!userId) return fallback;
  try {
    const key = userKey(userId, 'selectedDeviceKey');
    const selected = localStorage.getItem(key);
    if (selected) {
      const devices = loadUserDevices(userId);
      if (devices.some(d => d.deviceKey === selected)) {
        return selected;
      }
    }
  } catch {}

  const devices = loadUserDevices(userId);
  return devices[0]?.deviceKey || fallback;
}

/**
 * Set active/selected device key for a user.
 */
export function setActiveDeviceKey(userId, deviceKey) {
  if (!userId || !deviceKey) return;
  try {
    const key = userKey(userId, 'selectedDeviceKey');
    localStorage.setItem(key, deviceKey);
  } catch {}
}

/**
 * Get active device profile object.
 */
export function getActiveDeviceProfile(userId, deviceKey) {
  const devices = loadUserDevices(userId);
  const targetKey = deviceKey || getActiveDeviceKey(userId);
  const profile = devices.find(d => d.deviceKey === targetKey) || devices[0];
  if (profile) {
    return {
      ...profile,
      nickname: profile.nickname || profile.name || (profile.deviceKey === 'CARE-TAG-01' ? 'Leon' : (profile.childName || profile.deviceKey)),
    };
  }
  return {
    id: 'dev_default',
    deviceKey: targetKey || 'CARE-TAG-01',
    nickname: 'Leon',
    name: 'Leon',
    childName: 'Monitored Profile',
    relation: 'Child',
    avatarColor: '#2563EB',
    hardwareModel: 'ESP32-WROOM-32U + NEO-6M',
  };
}

const deviceStore = {
  DEVICE_PALETTE,
  DEFAULT_DEVICES,
  loadUserDevices,
  updateDeviceNickname,
  linkNewDevice,
  removeDevice,
  getActiveDeviceKey,
  setActiveDeviceKey,
  getActiveDeviceProfile,
};

export default deviceStore;
