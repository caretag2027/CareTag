/**
 * CareTag Alert Store
 * 
 * Persists anomaly events, geofence breaches, and low-battery alerts
 * in localStorage, scoped per user. Provides retrieval and acknowledgment.
 */

import { userKey } from './auth';

const MAX_ALERTS = 500; // cap per user

/**
 * Alert types:
 *   out_of_zone  — device left all geofence radii
 *   anomaly      — deviation score exceeded threshold
 *   low_battery  — battery dropped below 20%
 */

/**
 * Save a new alert event.
 * @param {string} userId
 * @param {{ type: string, latitude: number, longitude: number, nearestGeofence?: string, distance?: number, deviationScore?: number, message: string }} data
 * @returns {object} the saved alert
 */
export function saveAlert(userId, data) {
  const key = userKey(userId, 'alerts');
  const alerts = loadAlerts(userId);

  const alert = {
    id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    type: data.type || 'anomaly',
    timestamp: new Date().toISOString(),
    latitude: data.latitude,
    longitude: data.longitude,
    nearestGeofence: data.nearestGeofence || null,
    distance: data.distance || null,
    deviationScore: data.deviationScore || null,
    message: data.message || 'Alert triggered',
    acknowledged: false,
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
 * Load all alerts for a user.
 */
export function loadAlerts(userId) {
  try {
    const key = userKey(userId, 'alerts');
    return JSON.parse(localStorage.getItem(key)) || [];
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
 * Count unacknowledged alerts.
 */
export function getUnacknowledgedCount(userId) {
  return loadAlerts(userId).filter(a => !a.acknowledged).length;
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

/**
 * Get alert statistics for a given month (for progress tracking).
 * @param {string} userId
 * @param {string} monthKey — "YYYY-MM"
 */
export function getMonthlyAlertStats(userId, monthKey) {
  const alerts = loadAlerts(userId);
  const monthAlerts = alerts.filter(a => a.timestamp.startsWith(monthKey));
  return {
    total: monthAlerts.length,
    outOfZone: monthAlerts.filter(a => a.type === 'out_of_zone').length,
    anomalies: monthAlerts.filter(a => a.type === 'anomaly').length,
    lowBattery: monthAlerts.filter(a => a.type === 'low_battery').length,
    avgDeviation: monthAlerts.length > 0
      ? monthAlerts.reduce((sum, a) => sum + (a.deviationScore || 0), 0) / monthAlerts.length
      : 0,
  };
}

const alertStore = {
  saveAlert, loadAlerts, getRecentAlerts, getUnacknowledgedCount,
  acknowledgeAlert, acknowledgeAll, getMonthlyAlertStats
};
export default alertStore;
