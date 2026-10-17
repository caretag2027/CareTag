/**
 * CareTag Battery Store
 * 
 * Tracks battery percentage over time from simulation/live packets.
 * Provides statistics and trend analysis. User-scoped via localStorage.
 * 
 * NOTE: Battery data comes from actual simulation packets — no fake data.
 * When no simulation has run, the store is empty and the UI shows 
 * "No battery data — start simulation to track".
 */

import { userKey } from './auth';

const MAX_SNAPSHOTS = 1000;

/**
 * Save a battery reading.
 */
export function saveBatterySnapshot(userId, batteryPercent, deviceKey = 'SIM-DEVICE-01') {
  if (batteryPercent == null || isNaN(batteryPercent)) return;

  const key = userKey(userId, 'battery');
  const history = loadBatteryHistory(userId);

  history.push({
    timestamp: new Date().toISOString(),
    batteryPercent: Number(batteryPercent),
    deviceKey,
  });

  // Cap
  if (history.length > MAX_SNAPSHOTS) {
    history.splice(0, history.length - MAX_SNAPSHOTS);
  }

  try { localStorage.setItem(key, JSON.stringify(history)); } catch {}
}

/**
 * Load battery history, optionally scoped to a specific device.
 */
export function loadBatteryHistory(userId, deviceKey = null) {
  try {
    const key = userKey(userId, 'battery');
    const all = JSON.parse(localStorage.getItem(key)) || [];
    if (!deviceKey) return all;
    return all.filter(h => !h.deviceKey || h.deviceKey === deviceKey);
  } catch { return []; }
}

/**
 * Get battery statistics scoped to a device.
 * @returns {{ current, min, max, avg, totalReadings, lowEvents, trend, recentReadings }}
 */
export function getBatteryStats(userId, deviceKey = null) {
  const history = loadBatteryHistory(userId, deviceKey);

  if (history.length === 0) {
    return {
      current: null,
      min: null,
      max: null,
      avg: null,
      totalReadings: 0,
      lowEvents: 0,
      trend: 'stable',
      recentReadings: [],
    };
  }

  const values = history.map(h => h.batteryPercent);
  const current = values[values.length - 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const lowEvents = values.filter(v => v < 20).length;

  // Trend: compare last 10 avg vs previous 10 avg
  let trend = 'stable';
  if (values.length >= 20) {
    const recent = values.slice(-10);
    const previous = values.slice(-20, -10);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / 10;
    const prevAvg = previous.reduce((a, b) => a + b, 0) / 10;
    if (recentAvg < prevAvg - 3) trend = 'decreasing';
    else if (recentAvg > prevAvg + 3) trend = 'increasing';
  }

  // Last 50 readings for sparkline
  const recentReadings = history.slice(-50).map(h => ({
    timestamp: h.timestamp,
    value: h.batteryPercent,
  }));

  return { current, min, max, avg: Math.round(avg), totalReadings: history.length, lowEvents, trend, recentReadings };
}

/**
 * Get battery stats for a specific month.
 */
export function getMonthlyBatteryStats(userId, monthKey) {
  const history = loadBatteryHistory(userId);
  const monthData = history.filter(h => h.timestamp.startsWith(monthKey));

  if (monthData.length === 0) return { avg: null, min: null, lowEvents: 0, readings: 0 };

  const values = monthData.map(h => h.batteryPercent);
  return {
    avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    min: Math.min(...values),
    lowEvents: values.filter(v => v < 20).length,
    readings: values.length,
  };
}

const batteryStore = {
  saveBatterySnapshot, loadBatteryHistory, getBatteryStats, getMonthlyBatteryStats
};
export default batteryStore;
