/**
 * CareTag Progress Store
 * 
 * Tracks and aggregates monthly progress from alert and battery data.
 * Provides 6-8 month historical view. User-scoped via localStorage.
 * 
 * Progress is computed FROM accumulated data (alerts, battery readings),
 * not fabricated. If no data exists for a month, it shows as empty.
 */

import { userKey } from './auth';
import { getMonthlyAlertStats } from './alertStore';
import { getMonthlyBatteryStats } from './batteryStore';

/**
 * Get progress data for the last N months.
 * @param {string} userId
 * @param {number} months — how many months to look back (default 8)
 * @returns {Array<{ month, label, alerts, anomalies, breaches, lowBattery, avgDeviation, batteryAvg, batteryMin, hasData }>}
 */
export function getProgressHistory(userId, months = 8) {
  const result = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const alertStats = getMonthlyAlertStats(userId, monthKey);
    const batteryStats = getMonthlyBatteryStats(userId, monthKey);

    const hasData = alertStats.total > 0 || batteryStats.readings > 0;

    result.push({
      month: monthKey,
      label,
      alerts: alertStats.total,
      anomalies: alertStats.anomalies,
      breaches: alertStats.outOfZone,
      lowBattery: alertStats.lowBattery,
      avgDeviation: hasData ? Number(alertStats.avgDeviation.toFixed(3)) : null,
      batteryAvg: batteryStats.avg,
      batteryMin: batteryStats.min,
      batteryReadings: batteryStats.readings,
      hasData,
    });
  }

  return result;
}

/**
 * Get the current month's live stats.
 */
export function getCurrentMonthStats(userId) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const alertStats = getMonthlyAlertStats(userId, monthKey);
  const batteryStats = getMonthlyBatteryStats(userId, monthKey);

  return {
    month: monthKey,
    ...alertStats,
    batteryAvg: batteryStats.avg,
    batteryMin: batteryStats.min,
    hasData: alertStats.total > 0 || batteryStats.readings > 0,
  };
}

/**
 * Check if enough historical data exists (at least 2 months).
 */
export function hasEnoughHistory(userId) {
  const progress = getProgressHistory(userId, 8);
  return progress.filter(p => p.hasData).length >= 2;
}

const progressStore = { getProgressHistory, getCurrentMonthStats, hasEnoughHistory };
export default progressStore;
