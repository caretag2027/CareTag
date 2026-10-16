import {
  parseHardwareTelemetry,
  formatUptime,
  isValidGpsCoordinate,
  subscribeHardwareTelemetry,
} from './firebase';
import {
  STATUS_THRESHOLDS,
  DEVICE_STATUS,
  getDeviceStatusMeta,
} from './utils/dashboardUtils';

describe('CareTag Smart Band Firebase Telemetry Parser', () => {
  const sampleHardwareRaw = {
    accelerometer: {
      x_ms2: -0.90022,
      y_ms2: 0.3711,
      z_ms2: -10.07959,
    },
    gps: {
      latitude: 30.3491155,
      longitude: 76.411710833,
      satellites: 0,
      valid: true,
    },
    gyroscope: {
      x_dps: -2.12214,
      y_dps: 6.36641,
      z_dps: -0.27481,
    },
    uptime_ms: 148835,
  };

  test('parses real hardware payload accurately', () => {
    const packet = parseHardwareTelemetry(sampleHardwareRaw);
    expect(packet).toBeDefined();
    expect(packet.deviceKey).toBe('SMART-BAND-01');
    expect(packet.isHardware).toBe(true);
    expect(packet.latitude).toBeCloseTo(30.3491, 3);
    expect(packet.longitude).toBeCloseTo(76.4117, 3);
    expect(packet.gps.valid).toBe(true);

    // Accelerometer magnitude = sqrt((-0.9)^2 + 0.37^2 + (-10.079)^2) ≈ 10.126
    expect(packet.accelerometer.magnitude).toBeGreaterThan(9.0);
    expect(packet.accelerometer.magnitude).toBeLessThan(12.0);

    // Gyroscope
    expect(packet.gyroscope.magnitude).toBeGreaterThan(5.0);

    // Uptime 148835 ms ≈ 2 minutes 28 seconds
    expect(packet.uptimeFormatted).toBe('02m 28s');
    expect(packet.motionState).toBe('stationary');
  });

  test('safely handles missing or empty raw data without throwing', () => {
    expect(parseHardwareTelemetry(null)).toBeNull();
    expect(parseHardwareTelemetry(undefined)).toBeNull();
    expect(parseHardwareTelemetry('not-an-object')).toBeNull();

    // Partial empty object
    const emptyPacket = parseHardwareTelemetry({});
    expect(emptyPacket).toBeDefined();
    expect(emptyPacket.accelerometer.magnitude).toBeDefined();
    expect(emptyPacket.gps.valid).toBe(false);
  });

  test('validates GPS coordinates correctly and prevents 0,0 teleportation', () => {
    expect(isValidGpsCoordinate(30.3491, 76.4117, true)).toBe(true);
    expect(isValidGpsCoordinate(0, 0, true)).toBe(false); // Null island rejected
    expect(isValidGpsCoordinate(30.3491, 76.4117, false)).toBe(false); // Flagged invalid by GPS chip
    expect(isValidGpsCoordinate(null, null, true)).toBe(false);
    expect(isValidGpsCoordinate(NaN, 76.4117, true)).toBe(false);

    // If GPS is invalid, packet should fall back to last known valid coordinate
    const indoorRaw = {
      ...sampleHardwareRaw,
      gps: { latitude: 0, longitude: 0, satellites: 0, valid: false },
    };
    const lastValid = { latitude: 30.3488, longitude: 76.4112 };
    const packet = parseHardwareTelemetry(indoorRaw, lastValid);
    expect(packet.gps.valid).toBe(false);
    expect(packet.latitude).toBe(30.3488);
    expect(packet.longitude).toBe(76.4112);
  });

  test('detects high-impact or free-fall as potential fall anomaly', () => {
    const fallRaw = {
      ...sampleHardwareRaw,
      accelerometer: { x_ms2: 18.5, y_ms2: 15.2, z_ms2: 22.0 }, // Magnitude ~32 m/s^2 impact
      gyroscope: { x_dps: 150.0, y_dps: -90.0, z_dps: 45.0 },
    };
    const packet = parseHardwareTelemetry(fallRaw);
    expect(packet.isFall).toBe(true);
    expect(packet.isAnomaly).toBe(true);
    expect(packet.motionState).toBe('potential_fall');
    expect(packet.deviationScore).toBeGreaterThanOrEqual(0.9);
  });

  test('formats uptime milliseconds into readable strings', () => {
    expect(formatUptime(0)).toBe('00:00:00');
    expect(formatUptime(65000)).toBe('01m 05s');
    expect(formatUptime(3665000)).toBe('01h 01m 05s');
  });

  test('preserves genuine hardware timestamp and avoids fabricating Date.now() on static data', () => {
    // When hardware explicitly supplies a timestamp
    const explicitTimeRaw = {
      ...sampleHardwareRaw,
      timestamp: '2026-10-16T12:00:00.000Z',
    };
    const packetWithTime = parseHardwareTelemetry(explicitTimeRaw);
    expect(packetWithTime.timestamp).toBe('2026-10-16T12:00:00.000Z');
    expect(packetWithTime.isVerifiedFresh).toBe(false);

    // When no verified timestamp is available, does NOT invent one
    const unverifiedPacket = parseHardwareTelemetry(sampleHardwareRaw, null, {
      verifiedAt: null,
      isVerifiedFresh: false,
    });
    expect(unverifiedPacket.timestamp).toBeNull();
    expect(unverifiedPacket.isVerifiedFresh).toBe(false);

    // Safely handles invalid or garbage timestamps
    const garbageTimeRaw = {
      ...sampleHardwareRaw,
      timestamp: 'invalid-date-string-xyz',
    };
    const packetGarbage = parseHardwareTelemetry(garbageTimeRaw);
    expect(packetGarbage.timestamp).toBeNull();
  });
});

describe('CareTag Device Status State Machine & Thresholds', () => {
  test('uses unified, configurable thresholds across the application', () => {
    expect(STATUS_THRESHOLDS.FRESH_SECONDS).toBe(15);
    expect(STATUS_THRESHOLDS.OFFLINE_SECONDS).toBe(45);
    expect(STATUS_THRESHOLDS.INITIAL_VERIFY_WINDOW_SECONDS).toBe(5);
  });

  test('provides metadata for all 6 core device states', () => {
    // 1. Connecting
    const connectingMeta = getDeviceStatusMeta(DEVICE_STATUS.CONNECTING);
    expect(connectingMeta.label).toBe('Connecting');
    expect(connectingMeta.isLive).toBe(false);

    // 2. Waiting for device data
    const waitingMeta = getDeviceStatusMeta(DEVICE_STATUS.WAITING_FOR_DATA);
    expect(waitingMeta.label).toBe('Waiting for data');
    expect(waitingMeta.isLive).toBe(false);
    expect(waitingMeta.isOffline).toBe(true);

    // 3. Live
    const liveMeta = getDeviceStatusMeta(DEVICE_STATUS.LIVE, 4);
    expect(liveMeta.label).toBe('Live');
    expect(liveMeta.isLive).toBe(true);
    expect(liveMeta.isStale).toBe(false);
    expect(liveMeta.isOffline).toBe(false);
    expect(liveMeta.pillClass).toBe('hw-status-pill--live');

    // 4. Stale
    const staleMeta = getDeviceStatusMeta(DEVICE_STATUS.STALE, 22);
    expect(staleMeta.label).toBe('Stale');
    expect(staleMeta.isLive).toBe(false);
    expect(staleMeta.isStale).toBe(true);
    expect(staleMeta.isOffline).toBe(false);
    expect(staleMeta.pillClass).toBe('hw-status-pill--stale');

    // 5. Offline
    const offlineMeta = getDeviceStatusMeta(DEVICE_STATUS.OFFLINE, 65);
    expect(offlineMeta.label).toBe('Offline');
    expect(offlineMeta.isLive).toBe(false);
    expect(offlineMeta.isStale).toBe(false);
    expect(offlineMeta.isOffline).toBe(true);
    expect(offlineMeta.pillClass).toBe('hw-status-pill--offline');

    // 6. Connection error
    const errorMeta = getDeviceStatusMeta(DEVICE_STATUS.CONNECTION_ERROR);
    expect(errorMeta.label).toBe('Connection issue');
    expect(errorMeta.isLive).toBe(false);
    expect(errorMeta.pillClass).toBe('hw-status-pill--error');
  });

  test('evaluates freshness age correctly across threshold boundaries', () => {
    const freshMeta = getDeviceStatusMeta(DEVICE_STATUS.LIVE, 15);
    expect(freshMeta.isLive).toBe(true);

    const staleMeta = getDeviceStatusMeta(DEVICE_STATUS.STALE, 16);
    expect(staleMeta.isStale).toBe(true);

    const offlineMeta = getDeviceStatusMeta(DEVICE_STATUS.OFFLINE, 46);
    expect(offlineMeta.isOffline).toBe(true);
  });
});

describe('CareTag Subscription Lifecycle and Memory Safety', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    localStorage.clear();
  });

  test('cleans up timers and resources without errors when unmounted', () => {
    let statusUpdates = [];
    const unsubscribe = subscribeHardwareTelemetry(
      () => {},
      (status) => statusUpdates.push(status)
    );

    // Initial subscription should emit connecting status
    expect(statusUpdates.length).toBeGreaterThan(0);
    expect(statusUpdates[0].deviceStatus).toBe(DEVICE_STATUS.CONNECTING);

    // Unsubscribe cleanly
    expect(() => unsubscribe()).not.toThrow();

    // Advancing timers should not cause updates after unmount
    const countBefore = statusUpdates.length;
    jest.advanceTimersByTime(20000);
    expect(statusUpdates.length).toBe(countBefore);
  });

  test('does not report LIVE when initial static snapshot has no advancing uptime', () => {
    // Simulate stored baseline from an earlier session with same uptime
    localStorage.setItem('caretag.hw.lastUptime', '148835');
    // Stored 2 minutes ago
    localStorage.setItem('caretag.hw.lastSeenAt', String(Date.now() - 120000));

    let receivedStatus = null;
    const unsubscribe = subscribeHardwareTelemetry(
      () => {},
      (status) => { receivedStatus = status; }
    );

    // Initial status must NOT be LIVE
    expect(receivedStatus.deviceStatus).not.toBe(DEVICE_STATUS.LIVE);
    expect(receivedStatus.deviceStatus).toBe(DEVICE_STATUS.CONNECTING);

    unsubscribe();
  });
});
