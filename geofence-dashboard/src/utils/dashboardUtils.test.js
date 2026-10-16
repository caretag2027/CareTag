import {
  computeHaversineKm,
  formatLocationFreshness,
  evaluateSafetyState,
  getMonitoringReadiness,
  isScheduleActive,
  DEVICE_STATUS
} from './dashboardUtils';

describe('dashboardUtils Unit Tests', () => {
  describe('computeHaversineKm', () => {
    test('calculates 0 km distance between identical points', () => {
      const dist = computeHaversineKm(30.3491, 76.4117, 30.3491, 76.4117);
      expect(dist).toBeCloseTo(0, 4);
    });

    test('calculates distance between Thapar campus and Patiala railway station (~3.5 km)', () => {
      const dist = computeHaversineKm(30.3540, 76.3620, 30.3275, 76.3980);
      expect(dist).toBeGreaterThan(2.5);
      expect(dist).toBeLessThan(5.5);
    });

    test('returns null when any coordinate is missing', () => {
      expect(computeHaversineKm(null, 76.4117, 30.3491, 76.4117)).toBeNull();
      expect(computeHaversineKm(30.3491, null, 30.3491, 76.4117)).toBeNull();
    });
  });

  describe('formatLocationFreshness', () => {
    test('returns waiting for device data when timestamp is null', () => {
      const freshness = formatLocationFreshness(null);
      expect(freshness.text).toBe('Waiting for device data');
      expect(freshness.isOffline).toBe(true);
      expect(freshness.status).toBe(DEVICE_STATUS.WAITING_FOR_DATA);
    });

    test('detects recent updates (< 15s) as live and fresh', () => {
      const now = new Date();
      const freshness = formatLocationFreshness(now.toISOString(), now);
      expect(freshness.isFresh).toBe(true);
      expect(freshness.isStale).toBe(false);
      expect(freshness.isOffline).toBe(false);
      expect(freshness.text).toContain('Live');
    });

    test('detects updates between 15s and 45s as stale', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 25 * 1000); // 25s ago
      const freshness = formatLocationFreshness(past.toISOString(), now);
      expect(freshness.isFresh).toBe(false);
      expect(freshness.isStale).toBe(true);
      expect(freshness.isOffline).toBe(false);
      expect(freshness.text).toContain('Stale');
    });

    test('detects updates older than 45s as offline', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 15 * 60 * 1000); // 15 mins ago
      const freshness = formatLocationFreshness(past.toISOString(), now);
      expect(freshness.isOffline).toBe(true);
      expect(freshness.isStale).toBe(false);
      expect(freshness.text).toContain('Offline · 15m ago');
    });
  });

  describe('evaluateSafetyState', () => {
    const safeZones = [
      { id: 1, label: 'Home', centerLatitude: 30.3491, centerLongitude: 76.4117, radiusMeters: 500 }
    ];

    test('identifies unconfigured state when 0 safe zones exist', () => {
      const result = evaluateSafetyState({ latitude: 30.3491, longitude: 76.4117 }, []);
      expect(result.status).toBe('unconfigured');
      expect(result.explanation).toContain('No safe zones configured');
    });

    test('identifies awaiting_data when packet is null', () => {
      const result = evaluateSafetyState(null, safeZones);
      expect(result.status).toBe('awaiting_data');
      expect(result.explanation).toContain('Awaiting device telemetry');
    });

    test('identifies safe status when within geofence without deviation', () => {
      const packet = {
        latitude: 30.3491,
        longitude: 76.4117,
        isAnomaly: false,
        isFall: false,
        batteryPercent: 88,
        deviationScore: 0.1,
      };
      const result = evaluateSafetyState(packet, safeZones);
      expect(result.status).toBe('safe');
      expect(result.insideZone).toBe('Home');
      expect(result.explanation).toContain('Currently protected inside "Home"');
    });

    test('identifies warning when within zone but deviation score is high', () => {
      const packet = {
        latitude: 30.3491,
        longitude: 76.4117,
        isAnomaly: true,
        isFall: false,
        batteryPercent: 88,
        deviationScore: 0.85,
      };
      const result = evaluateSafetyState(packet, safeZones);
      expect(result.status).toBe('warning');
      expect(result.insideZone).toBe('Home');
      expect(result.explanation).toContain('unexpected path or routine deviation');
    });

    test('identifies breach when outside safe zone', () => {
      const packet = {
        latitude: 30.3800, // distant point outside 500m
        longitude: 76.4500,
        isAnomaly: true,
        isFall: false,
      };
      const result = evaluateSafetyState(packet, safeZones);
      expect(result.status).toBe('breach');
      expect(result.insideZone).toBeNull();
      expect(result.explanation).toContain('Outside safe zone boundaries');
    });

    test('identifies breach / critical issue when fall is detected', () => {
      const packet = {
        latitude: 30.3491,
        longitude: 76.4117,
        isFall: true,
      };
      const result = evaluateSafetyState(packet, safeZones);
      expect(result.status).toBe('breach');
      expect(result.isFall).toBe(true);
      expect(result.explanation).toContain('High-impact motion or potential fall');
    });
  });

  describe('getMonitoringReadiness', () => {
    test('returns not ready when 0 safe zones are configured', () => {
      const readiness = getMonitoringReadiness([], null, { connected: false });
      expect(readiness.readyToMonitor).toBe(false);
      expect(readiness.checks.find(c => c.id === 'zones_count').passed).toBe(false);
    });

    test('returns ready to monitor when safe zones exist', () => {
      const zones = [{ id: 1, label: 'Home', centerLatitude: 30.34, centerLongitude: 76.41, radiusMeters: 500 }];
      const packet = { latitude: 30.34, longitude: 76.41, batteryPercent: 90 };
      const readiness = getMonitoringReadiness(zones, packet, { deviceStatus: DEVICE_STATUS.LIVE });
      expect(readiness.readyToMonitor).toBe(true);
      expect(readiness.checks.find(c => c.id === 'zones_count').passed).toBe(true);
      expect(readiness.checks.find(c => c.id === 'telemetry').passed).toBe(true);
    });
  });

  describe('isScheduleActive', () => {
    test('returns true when schedule is null or all_day', () => {
      expect(isScheduleActive(null)).toBe(true);
      expect(isScheduleActive({ mode: 'all_day' })).toBe(true);
    });

    test('returns false when enabled is false', () => {
      expect(isScheduleActive({ enabled: false })).toBe(false);
    });

    test('evaluates daytime window correctly', () => {
      // 2026-10-15 is Thursday (thu)
      const dateDuring = new Date('2026-10-15T10:00:00+05:30');
      const dateOutside = new Date('2026-10-15T16:00:00+05:30');

      const schedule = {
        mode: 'custom',
        days: ['mon', 'tue', 'wed', 'thu', 'fri'],
        startTime: '07:30',
        endTime: '15:30',
        timezone: 'Asia/Kolkata',
      };

      expect(isScheduleActive(schedule, dateDuring)).toBe(true);
      expect(isScheduleActive(schedule, dateOutside)).toBe(false);
    });

    test('evaluates midnight-crossing schedule correctly (e.g. 18:00 to 08:00 next day)', () => {
      // Thursday evening 20:00 (active)
      const eveningDate = new Date('2026-10-15T20:00:00+05:30');
      // Friday morning 06:30 (active, crossing midnight from Thursday)
      const morningDate = new Date('2026-10-16T06:30:00+05:30');
      // Friday noon 12:00 (inactive)
      const middayDate = new Date('2026-10-16T12:00:00+05:30');

      const schedule = {
        mode: 'custom',
        days: ['mon', 'tue', 'wed', 'thu', 'fri'],
        startTime: '18:00',
        endTime: '08:00',
        timezone: 'Asia/Kolkata',
      };

      expect(isScheduleActive(schedule, eveningDate)).toBe(true);
      expect(isScheduleActive(schedule, morningDate)).toBe(true);
      expect(isScheduleActive(schedule, middayDate)).toBe(false);
    });
  });
});

