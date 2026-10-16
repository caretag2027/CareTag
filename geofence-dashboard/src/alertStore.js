/**
 * CareTag Alert Store
 * 
 * Persists and manages safety events scoped per user and device.
 * Supported event categories (as specified in CareTag requirements):
 *   1. nominal_safety  — device is reporting normally, no safety exception (informational)
 *   2. boundary_breach — device has left an actively monitored safe place
 *   3. route_deviation — device has deviated materially from learned expected corridor
 */

import { userKey } from './auth';

const MAX_ALERTS = 500; // cap per user

export const ALERT_CATEGORIES = {
  NOMINAL: 'nominal_safety',
  BREACH: 'boundary_breach',
  DEVIATION: 'route_deviation',
};

/**
 * Save a new safety event.
 * @param {string} userId
 * @param {Object} data
 * @returns {Object} the saved event
 */
export function saveAlert(userId, data) {
  const key = userKey(userId, 'alerts');
  const alerts = loadAlerts(userId);

  // Normalize category to standard 3 categories
  let category = ALERT_CATEGORIES.BREACH;
  if (data.type === 'nominal' || data.type === 'nominal_safety') {
    category = ALERT_CATEGORIES.NOMINAL;
  } else if (data.type === 'deviation' || data.type === 'route_deviation' || data.type === 'anomaly') {
    category = ALERT_CATEGORIES.DEVIATION;
  } else if (data.type === 'breach' || data.type === 'boundary_breach' || data.type === 'out_of_zone') {
    category = ALERT_CATEGORIES.BREACH;
  }

  const alert = {
    id: data.id || `alert-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    type: category,
    category,
    timestamp: data.timestamp || new Date().toISOString(),
    deviceId: data.deviceId || data.deviceKey || 'SMART-BAND-01',
    latitude: data.latitude,
    longitude: data.longitude,
    nearestGeofence: data.nearestGeofence || data.nearestZone || null,
    distanceMeters: data.distanceMeters || (data.distance ? Math.round(data.distance * 1000) : null),
    deviationScore: data.deviationScore != null ? Number(data.deviationScore) : null,
    message: data.message || (category === ALERT_CATEGORIES.BREACH ? 'Boundary breach detected' : 'Route deviation flagged'),
    source: data.source || (data.isSimulation ? 'simulation' : 'hardware'),
    acknowledged: Boolean(data.acknowledged),
    batteryPercent: data.batteryPercent || null,
  };

  alerts.unshift(alert); // newest first

  // Cap the list
  if (alerts.length > MAX_ALERTS) {
    alerts.length = MAX_ALERTS;
  }

  try { localStorage.setItem(key, JSON.stringify(alerts)); } catch {}

  return alert;
}

/**
 * Load all alerts for a user, filtering out any legacy fall events.
 */
export function loadAlerts(userId) {
  try {
    const key = userKey(userId, 'alerts');
    const raw = JSON.parse(localStorage.getItem(key)) || [];
    // Filter out fall-specific events from this product flow
    return raw.filter(a => a.type !== 'fall_detected' && a.category !== 'fall_detected');
  } catch {
    return [];
  }
}

/**
 * Get recent alerts (limited).
 */
export function getRecentAlerts(userId, limit = 20) {
  return loadAlerts(userId).slice(0, limit);
}

/**
 * Count unacknowledged non-nominal alerts.
 */
export function getUnacknowledgedCount(userId) {
  return loadAlerts(userId).filter(a => !a.acknowledged && a.type !== ALERT_CATEGORIES.NOMINAL).length;
}

/**
 * Acknowledge an alert (mark as seen).
 */
export function acknowledgeAlert(userId, alertId) {
  const key = userKey(userId, 'alerts');
  const alerts = loadAlerts(userId);
  const alert = alerts.find(a => a.id === alertId);
  if (alert) {
    alert.acknowledged = true;
    try { localStorage.setItem(key, JSON.stringify(alerts)); } catch {}
  }
}

/**
 * Acknowledge all alerts.
 */
export function acknowledgeAll(userId) {
  const key = userKey(userId, 'alerts');
  const alerts = loadAlerts(userId);
  alerts.forEach(a => { a.acknowledged = true; });
  try { localStorage.setItem(key, JSON.stringify(alerts)); } catch {}
}

export const alertStore = {
  saveAlert,
  addAlert: saveAlert,
  loadAlerts,
  getRecentAlerts,
  getUnacknowledgedCount,
  acknowledgeAlert,
  acknowledgeAll,
  ALERT_CATEGORIES,
};

export default alertStore;
