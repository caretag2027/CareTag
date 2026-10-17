/**
 * CareTag Device Management Store
 * 
 * Provides explicit, authenticated Caregiver -> Child/Profile -> Smart Band relationships.
 * Supports multiple wearable devices per caregiver account with isolated telemetry,
 * geofences, routine models, and alerts.
 */

import { userKey } from './auth';

export const DEFAULT_DEVICES = [
  {
    id: 'dev_aarav_01',
    deviceKey: 'CARE-TAG-01',
    childName: 'Aarav Singla',
    age: 8,
    relation: 'Child',
    avatarColor: '#2563EB',
    isDefault: true,
    hardwareModel: 'ESP32-WROOM-32U + NEO-6M',
    registeredAt: '2026-09-15T08:00:00.000Z',
  },
  {
    id: 'dev_diya_02',
    deviceKey: 'CARE-TAG-02',
    childName: 'Diya Singla',
    age: 12,
    relation: 'Child',
    avatarColor: '#EC4899',
    isDefault: false,
    hardwareModel: 'ESP32-S3 + NEO-8M',
    registeredAt: '2026-10-01T09:30:00.000Z',
  },
  {
    id: 'dev_kabir_03',
    deviceKey: 'CARE-TAG-03',
    childName: 'Kabir Verma',
    age: 6,
    relation: 'Ward',
    avatarColor: '#10B981',
    isDefault: false,
    hardwareModel: 'ESP32-C3 Mini',
    registeredAt: '2026-10-10T14:15:00.000Z',
  },
];

/**
 * Load all registered devices associated with a caregiver user.
 */
export function loadUserDevices(userId) {
  if (!userId) return DEFAULT_DEVICES;
  try {
    const key = userKey(userId, 'devices');
    const stored = JSON.parse(localStorage.getItem(key));
    if (Array.isArray(stored) && stored.length > 0) {
      return stored;
    }
  } catch {}

  // Fallback / seed initial devices
  try {
    const key = userKey(userId, 'devices');
    localStorage.setItem(key, JSON.stringify(DEFAULT_DEVICES));
  } catch {}
  return DEFAULT_DEVICES;
}

/**
 * Add / link a new Smart Band device to the caregiver account.
 */
export function linkNewDevice(userId, { deviceKey, childName, age = 8, relation = 'Child' }) {
  if (!deviceKey?.trim() || !childName?.trim()) {
    return { ok: false, error: 'Device Key and Child Name are required' };
  }

  const cleanKey = deviceKey.trim().toUpperCase();
  const devices = loadUserDevices(userId);

  if (devices.some(d => d.deviceKey === cleanKey)) {
    return { ok: false, error: `Device ${cleanKey} is already linked to this account` };
  }

  const newDevice = {
    id: `dev_${cleanKey.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
    deviceKey: cleanKey,
    childName: childName.trim(),
    age: Number(age) || 8,
    relation: relation.trim() || 'Child',
    avatarColor: ['#2563EB', '#7C3AED', '#059669', '#D97706', '#EC4899'][devices.length % 5],
    isDefault: false,
    hardwareModel: 'ESP32 Standalone Smart Band',
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
 * Get active child profile object.
 */
export function getActiveDeviceProfile(userId, deviceKey) {
  const devices = loadUserDevices(userId);
  const targetKey = deviceKey || getActiveDeviceKey(userId);
  return devices.find(d => d.deviceKey === targetKey) || devices[0] || {
    id: 'dev_default',
    deviceKey: targetKey || 'CARE-TAG-01',
    childName: 'Monitored Child',
    relation: 'Child',
    avatarColor: '#2563EB',
  };
}

const deviceStore = {
  DEFAULT_DEVICES,
  loadUserDevices,
  linkNewDevice,
  getActiveDeviceKey,
  setActiveDeviceKey,
  getActiveDeviceProfile,
};

export default deviceStore;
