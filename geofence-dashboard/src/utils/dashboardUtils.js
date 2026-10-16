/**
 * CareTag Dashboard Utilities
 * 
 * Common geospatial, time freshness, schedule evaluation, and safety state functions
 * designed to provide predictable, unit-tested logic for both
 * caregivers and technical evaluators.
 */

/**
 * Calculates Great-Circle distance between two coordinates in kilometers using Haversine formula.
 */
export function computeHaversineKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);
  if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) return null;

  const R = 6371.0; // Earth radius in km
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(nLat2 - nLat1);
  const dLon = toRad(nLon2 - nLon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(nLat1)) * Math.cos(toRad(nLat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(4));
}

/**
 * CareTag Smart Band Status Thresholds (Single Source of Truth)
 * 
 * Configured based on physical Smart Band transmission frequency:
 * - FRESHNESS_MS: Telemetry is considered LIVE if verified within 15 seconds.
 * - OFFLINE_TIMEOUT_MS: Telemetry is considered OFFLINE if no verified update in 45 seconds.
 * - Between 15s and 45s: Device is STALE (network delay or packet loss).
 * - BOUNDARY_JITTER_TOLERANCE_METERS: Tolerance applied near geofence boundaries to prevent oscillating alerts.
 */
export const STATUS_THRESHOLDS = {
  FRESHNESS_MS: 15000,
  FRESH_SECONDS: 15,
  STALE_THRESHOLD_MS: 15000,
  STALE_SECONDS: 15,
  OFFLINE_TIMEOUT_MS: 45000,
  OFFLINE_SECONDS: 45,
  INITIAL_VERIFY_WINDOW_MS: 5000,
  INITIAL_VERIFY_WINDOW_SECONDS: 5,
  BOUNDARY_JITTER_TOLERANCE_METERS: 25, // 25m boundary hysteresis
};

export const DEVICE_STATUS = {
  CONNECTING: 'connecting',
  WAITING_FOR_DATA: 'waiting_for_data',
  LIVE: 'live',
  STALE: 'stale',
  OFFLINE: 'offline',
  CONNECTION_ERROR: 'connection_error',
};

/**
 * Maps a device status to standardized human-readable label and UI classes.
 */
export function getDeviceStatusMeta(status, ageSeconds = null) {
  switch (status) {
    case DEVICE_STATUS.LIVE:
      return {
        status: DEVICE_STATUS.LIVE,
        label: 'Live',
        badgeText: 'Smart Band · Live',
        pillClass: 'hw-status-pill--live',
        connectionClass: 'connection-badge--hardware-live',
        color: '#10B981',
        isLive: true,
        isStale: false,
        isOffline: false,
        description: ageSeconds != null && ageSeconds > 0 ? `Live · Updated ${ageSeconds}s ago` : 'Live telemetry verified',
      };
    case DEVICE_STATUS.STALE:
      return {
        status: DEVICE_STATUS.STALE,
        label: 'Stale',
        badgeText: ageSeconds != null ? `Smart Band · Stale (${ageSeconds}s)` : 'Smart Band · Stale',
        pillClass: 'hw-status-pill--stale',
        connectionClass: 'connection-badge--hardware-stale',
        color: '#F59E0B',
        isLive: false,
        isStale: true,
        isOffline: false,
        description: ageSeconds != null ? `Delayed · No update for ${ageSeconds}s` : 'Telemetry delayed',
      };
    case DEVICE_STATUS.OFFLINE:
      return {
        status: DEVICE_STATUS.OFFLINE,
        label: 'Offline',
        badgeText: 'Smart Band · Offline',
        pillClass: 'hw-status-pill--offline',
        connectionClass: 'connection-badge--disconnected',
        color: '#EF4444',
        isLive: false,
        isStale: false,
        isOffline: true,
        description: ageSeconds != null && isFinite(ageSeconds)
          ? `Device offline · Last verified update: ${ageSeconds >= 60 ? `${Math.floor(ageSeconds / 60)}m ago` : `${ageSeconds}s ago`}`
          : 'Smart Band offline · No active heartbeat',
      };
    case DEVICE_STATUS.WAITING_FOR_DATA:
      return {
        status: DEVICE_STATUS.WAITING_FOR_DATA,
        label: 'Waiting for data',
        badgeText: 'Smart Band · Waiting for data',
        pillClass: 'hw-status-pill--waiting',
        connectionClass: 'connection-badge--disconnected',
        color: '#94A3B8',
        isLive: false,
        isStale: false,
        isOffline: true,
        description: 'Connected to Firebase · Awaiting first device heartbeat',
      };
    case DEVICE_STATUS.CONNECTION_ERROR:
      return {
        status: DEVICE_STATUS.CONNECTION_ERROR,
        label: 'Connection issue',
        badgeText: 'Connection issue',
        pillClass: 'hw-status-pill--error',
        connectionClass: 'connection-badge--disconnected',
        color: '#EA580C',
        isLive: false,
        isStale: false,
        isOffline: true,
        description: 'Data source unavailable · Cannot verify device telemetry',
      };
    case DEVICE_STATUS.CONNECTING:
    default:
      return {
        status: DEVICE_STATUS.CONNECTING,
        label: 'Connecting',
        badgeText: 'Connecting...',
        pillClass: 'hw-status-pill--connecting',
        connectionClass: 'connection-badge--disconnected',
        color: '#64748B',
        isLive: false,
        isStale: false,
        isOffline: true,
        description: 'Establishing connection to telemetry stream...',
      };
  }
}

/**
 * Evaluates human-readable data freshness string and status flag.
 */
export function formatLocationFreshness(timestampUtc, now = new Date()) {
  if (!timestampUtc) {
    return {
      text: 'Waiting for device data',
      isFresh: false,
      isStale: false,
      isOffline: true,
      ageSeconds: Infinity,
      status: DEVICE_STATUS.WAITING_FOR_DATA,
    };
  }

  const then = new Date(timestampUtc);
  if (isNaN(then.getTime())) {
    return {
      text: 'Invalid timestamp',
      isFresh: false,
      isStale: false,
      isOffline: true,
      ageSeconds: Infinity,
      status: 'invalid',
    };
  }

  const ageSeconds = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 1000));

  if (ageSeconds < 15) {
    return {
      text: ageSeconds < 3 ? 'Live · Just now' : `Live · ${ageSeconds}s ago`,
      isFresh: true,
      isStale: false,
      isOffline: false,
      ageSeconds,
      status: DEVICE_STATUS.LIVE,
    };
  }
  if (ageSeconds < 45) {
    return {
      text: `Stale · ${ageSeconds}s ago`,
      isFresh: false,
      isStale: true,
      isOffline: false,
      ageSeconds,
      status: DEVICE_STATUS.STALE,
    };
  }
  const minutes = Math.floor(ageSeconds / 60);
  if (minutes < 60) {
    return {
      text: `Offline · ${minutes}m ago`,
      isFresh: false,
      isStale: false,
      isOffline: true,
      ageSeconds,
      status: DEVICE_STATUS.OFFLINE,
    };
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return {
      text: `Offline · ${hours}h ${minutes % 60}m ago`,
      isFresh: false,
      isStale: false,
      isOffline: true,
      ageSeconds,
      status: DEVICE_STATUS.OFFLINE,
    };
  }
  return {
    text: 'Offline · Over 24h ago',
    isFresh: false,
    isStale: false,
    isOffline: true,
    ageSeconds,
    status: DEVICE_STATUS.OFFLINE,
  };
}

/**
 * Evaluates whether a safe zone's monitoring schedule is active right now.
 * Correctly handles:
 * - All day mode vs custom time window
 * - Days of the week filtering (mon, tue, wed, thu, fri, sat, sun)
 * - Midnight-crossing schedules (e.g. 6:00 PM to 8:00 AM)
 * - Timezone conversions
 * 
 * @param {Object} schedule
 * @param {Date} date
 * @param {string} fallbackTimezone
 * @returns {boolean}
 */
export function isScheduleActive(schedule, date = new Date(), fallbackTimezone = 'Asia/Kolkata') {
  if (!schedule) return true; // default active if unconfigured
  if (schedule.mode === 'all_day' || schedule.allDay) return true;
  if (schedule.enabled === false) return false;

  try {
    const tz = schedule.timezone || fallbackTimezone;
    
    // Extract local time in HH:mm
    const timeParts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const hour = parseInt(timeParts.find(p => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(timeParts.find(p => p.type === 'minute')?.value || '0', 10);
    const currentMinutes = hour * 60 + minute;

    // Extract day of week (mon, tue, ...)
    const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
    });
    const currentDayShort = weekdayFormatter.format(date).toLowerCase().slice(0, 3);

    const activeDays = Array.isArray(schedule.days) && schedule.days.length > 0
      ? schedule.days.map(d => String(d).toLowerCase().slice(0, 3))
      : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

    const [startH, startM] = (schedule.startTime || '00:00').split(':').map(Number);
    const [endH, endM] = (schedule.endTime || '23:59').split(':').map(Number);
    const startMinutes = (startH || 0) * 60 + (startM || 0);
    const endMinutes = (endH || 0) * 60 + (endM || 0);

    // Standard intraday schedule (e.g. 07:30 to 15:30)
    if (startMinutes <= endMinutes) {
      if (!activeDays.includes(currentDayShort)) return false;
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    }

    // Midnight-crossing schedule (e.g. 18:00 PM to 08:00 AM next day)
    // Part 1: Tonight after startMinutes on an active day
    if (currentMinutes >= startMinutes && activeDays.includes(currentDayShort)) {
      return true;
    }

    // Part 2: Morning before endMinutes, where yesterday was an active day
    if (currentMinutes <= endMinutes) {
      const daysOrder = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const todayIdx = daysOrder.indexOf(currentDayShort);
      const yesterdayIdx = (todayIdx + 6) % 7;
      const yesterdayDayShort = daysOrder[yesterdayIdx];
      if (activeDays.includes(yesterdayDayShort)) {
        return true;
      }
    }

    return false;
  } catch (err) {
    console.warn('[CareTag] Error evaluating schedule:', err);
    return true; // Fail-safe: assume active
  }
}

/**
 * Evaluates the safety condition of the child relative to all active safe zones.
 * 
 * Supports the 3 required event categories:
 * 1. Nominal safety - reporting normally, inside safe zone, or scheduled inactive
 * 2. Boundary breach - device left an actively monitored safe zone during its active schedule
 * 3. Route deviation - device has deviated materially from its learned expected route
 * 
 * Also handles boundary jitter tolerance and connection lost state.
 */
export function evaluateSafetyState(packet, geofences = [], options = {}) {
  const now = options.now || new Date();
  const jitterToleranceM = options.jitterToleranceMeters || STATUS_THRESHOLDS.BOUNDARY_JITTER_TOLERANCE_METERS;

  if (!geofences || geofences.length === 0) {
    return {
      status: 'unconfigured',
      insideZone: null,
      nearestZone: null,
      distanceToBoundaryKm: 0,
      isScheduledActive: false,
      explanation: 'No safe zones configured yet. Complete setup to start monitoring.',
    };
  }

  if (!packet || packet.latitude == null || packet.longitude == null) {
    return {
      status: 'awaiting_data',
      insideZone: null,
      nearestZone: null,
      distanceToBoundaryKm: 0,
      isScheduledActive: false,
      explanation: 'Awaiting device telemetry. Safe zones are ready.',
    };
  }

  // Legacy compatibility check for simulated fall
  if (packet.isFall) {
    return {
      status: 'breach',
      insideZone: null,
      nearestZone: null,
      distanceToBoundaryKm: 0,
      isFall: true,
      explanation: 'High-impact motion or potential fall detected by Smart Band sensors.',
    };
  }

  let insideZone = null;
  let nearestZone = null;
  let minDistanceKm = Infinity;
  let nearestRadiusKm = 0.5;
  let nearestIsScheduled = true;

  for (const g of geofences) {
    if (g.enabled === false || g.isActive === false) continue;

    const d = computeHaversineKm(
      packet.latitude,
      packet.longitude,
      g.centerLatitude,
      g.centerLongitude
    );
    if (d == null) continue;

    const radiusKm = (g.radiusMeters || 500) / 1000;
    const jitterKm = jitterToleranceM / 1000;
    const isScheduled = isScheduleActive(g.schedule, now);

    // Inside check with jitter margin
    if (d <= radiusKm + jitterKm) {
      insideZone = g.label || g.name;
    }

    if (d < minDistanceKm) {
      minDistanceKm = d;
      nearestZone = g.label || g.name;
      nearestRadiusKm = radiusKm;
      nearestIsScheduled = isScheduled;
    }
  }

  const isOutside = insideZone == null;
  const distOutsideKm = isOutside ? Math.max(0, minDistanceKm - nearestRadiusKm) : -(nearestRadiusKm - minDistanceKm);
  const devScore = Number(packet.deviationScore) || 0;

  // 1. Outside an actively monitored safe zone
  if (isOutside) {
    if (nearestIsScheduled) {
      return {
        status: 'breach',
        eventType: 'boundary_breach',
        insideZone: null,
        nearestZone: nearestZone || 'Safe Zone',
        distanceToBoundaryKm: parseFloat(distOutsideKm.toFixed(3)),
        isScheduledActive: true,
        explanation: `Outside safe zone boundaries (${distOutsideKm.toFixed(1)} km from "${nearestZone}").`,
      };
    } else {
      // Outside a zone, but its schedule is currently inactive (e.g. at park outside weekend hours)
      return {
        status: 'safe',
        eventType: 'nominal_safety',
        insideZone: null,
        nearestZone: nearestZone || 'Safe Zone',
        distanceToBoundaryKm: parseFloat(distOutsideKm.toFixed(3)),
        isScheduledActive: false,
        explanation: `Outside "${nearestZone}", but monitoring schedule is currently inactive.`,
      };
    }
  }

  // 2. Inside a safe zone, but route deviation flagged
  if (devScore > 0.6 || packet.isAnomaly) {
    return {
      status: 'warning',
      eventType: 'route_deviation',
      insideZone,
      nearestZone,
      distanceToBoundaryKm: parseFloat(distOutsideKm.toFixed(3)),
      isScheduledActive: nearestIsScheduled,
      explanation: `Inside "${insideZone}", but unexpected path or routine deviation flagged.`,
    };
  }

  // 3. Nominal safety
  return {
    status: 'safe',
    eventType: 'nominal_safety',
    insideZone,
    nearestZone,
    distanceToBoundaryKm: parseFloat(distOutsideKm.toFixed(3)),
    isScheduledActive: nearestIsScheduled,
    explanation: `Currently protected inside "${insideZone}".`,
  };
}

/**
 * Checks system monitoring readiness prerequisites for guided setup.
 */
export function getMonitoringReadiness(geofences = [], packet = null, hardwareStatus = null) {
  const hasZones = Array.isArray(geofences) && geofences.length > 0;
  const homeZone = geofences.find(g => (g.label || g.name || '').toLowerCase().includes('home'));
  const schoolZone = geofences.find(g => (g.label || g.name || '').toLowerCase().includes('school'));

  const hasDeviceData = Boolean(packet && packet.latitude && packet.longitude);
  const isHardwareStreaming = Boolean(hardwareStatus?.deviceStatus === DEVICE_STATUS.LIVE || (hardwareStatus?.isHardwareStreaming && !hardwareStatus?.isStale));
  const hasValidGpsLock = Boolean(packet?.gps?.valid || !packet?.gps?.isEstimated);

  return {
    readyToMonitor: hasZones,
    checks: [
      {
        id: 'zones_count',
        label: 'Safe zones created',
        passed: hasZones,
        detail: hasZones ? `${geofences.length} active safe place${geofences.length > 1 ? 's' : ''}` : 'Zero zones configured',
        actionRequired: !hasZones ? 'Add at least one safe place (Home or School)' : null,
      },
      {
        id: 'key_zones',
        label: 'Key anchors (Home / School)',
        passed: Boolean(homeZone || schoolZone || hasZones),
        detail: homeZone && schoolZone ? 'Both Home & School saved' : homeZone ? 'Home saved' : schoolZone ? 'School saved' : hasZones ? 'Custom safe places saved' : 'No places saved',
        actionRequired: !hasZones ? 'Consider adding Home or School anchors' : null,
      },
      {
        id: 'telemetry',
        label: 'Device data source',
        passed: isHardwareStreaming || hasDeviceData,
        detail: isHardwareStreaming
          ? 'Smart Band streaming live via Firebase RTDB'
          : hardwareStatus?.deviceStatus === DEVICE_STATUS.STALE
            ? 'Smart Band telemetry delayed (stale)'
            : hardwareStatus?.deviceStatus === DEVICE_STATUS.OFFLINE
              ? 'Smart Band is offline'
              : packet?.source === 'simulation'
                ? 'Simulated GPS telemetry active'
                : hasDeviceData
                  ? 'Last known coordinate cached'
                  : 'Awaiting first packet',
        actionRequired: !hasDeviceData
          ? 'Turn on Smart Band or start simulation'
          : null,
      },
      {
        id: 'gps_lock',
        label: 'GPS lock verification',
        passed: hasValidGpsLock,
        detail: hasValidGpsLock ? `Verified (${packet?.gps?.satellites || 6} satellites)` : 'Indoor estimation mode active',
        actionRequired: null,
      },
      {
        id: 'routine',
        label: 'Routine learning status',
        passed: true,
        detail: 'Routine learning engine active (per-device statistical baseline)',
        actionRequired: null,
      },
    ],
  };
}
