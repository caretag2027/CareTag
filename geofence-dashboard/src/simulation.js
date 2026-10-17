/**
 * CareTag Scenario Simulation Engine
 * 
 * Provides verifiable, reproducible evaluation scenarios for Capstone engineering demonstrations:
 * - Preset 1: Nominal Safety (device inside active safe place, valid telemetry, nominal state)
 * - Preset 2: Boundary Breach (device steps outside active safe place boundary, triggers boundary breach event)
 * - Preset 3: Route Deviation (device materially deviates from learned expected route corridor)
 * 
 * Strict isolation guarantees:
 * - All simulated packets are flagged with source: 'simulation', deviceKey: 'DEMO-BAND-01', isSimulation: true
 * - Simulated packets NEVER overwrite live hardware telemetry
 * - Reset and Clear restore clean state without altering live hardware data
 */

import { computeHaversineKm } from './utils/dashboardUtils';

export const DEMO_LOCATIONS = {
  HOME: { id: 'demo-home', label: 'Demo Home safe zone', centerLatitude: 30.3491, centerLongitude: 76.4117, radiusMeters: 350 },
  CAMPUS: { id: 'demo-campus', label: 'Thapar Campus', centerLatitude: 30.3555, centerLongitude: 76.4225, radiusMeters: 450 },
  PARK: { id: 'demo-park', label: 'Demo Park', centerLatitude: 30.3420, centerLongitude: 76.4050, radiusMeters: 300 },
};

export const SCENARIO_PRESETS = {
  NOMINAL: 'scenario_nominal',
  BREACH: 'scenario_breach',
  DEVIATION: 'scenario_deviation',
};

export const SCENARIO_METADATA = {
  [SCENARIO_PRESETS.NOMINAL]: {
    id: SCENARIO_PRESETS.NOMINAL,
    name: '1. Normal Movement — Inside Safe Zone',
    tag: 'Normal Movement',
    description: 'The person follows a familiar route and remains safely inside the configured safe zone.',
    expectedResult: 'Normal movement is displayed, with no safety alert triggered by the scenario.',
  },
  [SCENARIO_PRESETS.BREACH]: {
    id: SCENARIO_PRESETS.BREACH,
    name: '2. Safe-Zone Boundary Breach',
    tag: 'Boundary Breach',
    description: 'The person starts inside a safe zone and then crosses its configured boundary into unmonitored space.',
    expectedResult: 'A boundary breach is detected, the event time is displayed, and visual and voice alerts are triggered.',
  },
  [SCENARIO_PRESETS.DEVIATION]: {
    id: SCENARIO_PRESETS.DEVIATION,
    name: '3. Behavioral Route Deviation',
    tag: 'Route Deviation',
    description: 'The person begins along a familiar route but deviates from the expected path before leaving a safe zone.',
    expectedResult: 'The demo displays the route deviation and generates the corresponding behavioral alert when score exceeds threshold.',
  },
};

function formatSimClock(tick) {
  const startSeconds = 8 * 3600 + 15 * 60; // 08:15:00 AM
  const totalSec = startSeconds + tick * 30; // 30 sec per tick
  const h = String(Math.floor(totalSec / 3600) % 24).padStart(2, '0');
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// Deterministic waypoint tracks for 100% reproducible capstone demonstrations
const NOMINAL_WAYPOINTS = [
  { lat: 30.34910, lon: 76.41170, dev: 0.05, desc: 'Inside Demo Home · Center' },
  { lat: 30.34940, lon: 76.41210, dev: 0.06, desc: 'Inside Demo Home · North Garden' },
  { lat: 30.34970, lon: 76.41240, dev: 0.08, desc: 'Inside Demo Home · Walkway' },
  { lat: 30.34950, lon: 76.41270, dev: 0.07, desc: 'Inside Demo Home · Courtyard' },
  { lat: 30.34920, lon: 76.41250, dev: 0.06, desc: 'Inside Demo Home · Perimeter Path' },
  { lat: 30.34910, lon: 76.41190, dev: 0.05, desc: 'Inside Demo Home · Safe Return' },
];

const BREACH_WAYPOINTS = [
  { lat: 30.34910, lon: 76.41170, dev: 0.05, isAnomaly: false, desc: 'Inside Demo Home · Starting Position' },
  { lat: 30.34960, lon: 76.41240, dev: 0.08, isAnomaly: false, desc: 'Inside Demo Home · Approaching East Gate' },
  { lat: 30.35020, lon: 76.41330, dev: 0.12, isAnomaly: false, desc: 'Inside Demo Home · East Perimeter (180m from center)' },
  { lat: 30.35080, lon: 76.41420, dev: 0.18, isAnomaly: false, desc: 'Inside Demo Home · Near Boundary (270m from center)' },
  { lat: 30.35140, lon: 76.41500, dev: 0.25, isAnomaly: false, desc: 'At Boundary Edge (340m / 350m threshold)' },
  { lat: 30.35240, lon: 76.41620, dev: 0.94, isAnomaly: true, desc: '08:17:30 — Boundary breach detected (left Demo Home)' },
  { lat: 30.35330, lon: 76.41730, dev: 0.98, isAnomaly: true, desc: 'Outside Safe Zone · Moving eastward' },
];

const DEVIATION_WAYPOINTS = [
  { lat: 30.34910, lon: 76.41170, dev: 0.05, isAnomaly: false, desc: 'Demo Home Origin · Familiar corridor' },
  { lat: 30.35070, lon: 76.41440, dev: 0.08, isAnomaly: false, desc: 'Expected Route · Towards Thapar Campus' },
  { lat: 30.35230, lon: 76.41710, dev: 0.12, isAnomaly: false, desc: 'Expected Route · Mid-commute corridor' },
  { lat: 30.35150, lon: 76.41550, dev: 0.42, isAnomaly: false, desc: 'Corridor Variance · Diverging towards Demo Park' },
  { lat: 30.34800, lon: 76.41100, dev: 0.68, isAnomaly: true, desc: 'Unusual Turn · Deviation score exceeds threshold (0.68 > 0.65)' },
  { lat: 30.34450, lon: 76.40750, dev: 0.84, isAnomaly: true, desc: '08:17:30 — Route deviation detected (Score: 0.84 > 0.65)' },
  { lat: 30.34250, lon: 76.40550, dev: 0.89, isAnomaly: true, desc: 'Divergent Corridor · Unlearned path towards Demo Park' },
];

class GPSSimulation {
  constructor() {
    this.geofences = [];
    this.intervalId = null;
    this.onPacket = null;
    this.onStateChange = null;
    this.tickCount = 0;
    this.running = false;
    this.isPaused = false;
    this.activeScenario = null;
    this.simulatedAlerts = [];
    this.currentLat = 30.3491;
    this.currentLon = 76.4117;
    this.intervalMs = 2500;
  }

  /**
   * Start general simulation along configured geofences.
   */
  start(geofences, onPacket, intervalMs = 2500) {
    this.stop();
    if (!geofences || geofences.length === 0) return;

    this.geofences = geofences;
    this.onPacket = onPacket;
    this.intervalMs = intervalMs;
    this.tickCount = 0;
    this.running = true;
    this.isPaused = false;
    this.activeScenario = 'commute_general';

    this.currentLat = geofences[0].centerLatitude;
    this.currentLon = geofences[0].centerLongitude;

    this.intervalId = setInterval(() => this._tickGeneral(), intervalMs);
    this._tickGeneral();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
    this.isPaused = false;
  }

  pause() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isPaused = true;
    if (this.onStateChange) this.onStateChange({ running: this.running, isPaused: this.isPaused });
  }

  resume() {
    if (!this.running || !this.isPaused) return;
    this.isPaused = false;
    if (this.activeScenario && this.activeScenario.startsWith('scenario_')) {
      this.intervalId = setInterval(() => this._tickScenario(this.activeScenario), this.intervalMs);
    } else {
      this.intervalId = setInterval(() => this._tickGeneral(), this.intervalMs);
    }
    if (this.onStateChange) this.onStateChange({ running: this.running, isPaused: this.isPaused });
  }

  restart() {
    if (!this.activeScenario) return;
    const currentScenario = this.activeScenario;
    const currentGeos = this.geofences;
    const currentCb = this.onPacket;
    this.stop();
    this.startScenario(currentScenario, currentGeos, currentCb);
  }

  reset() {
    this.stop();
    this.activeScenario = null;
    this.simulatedAlerts = [];
    this.tickCount = 0;
    this.isPaused = false;
    if (this.geofences && this.geofences[0]) {
      this.currentLat = this.geofences[0].centerLatitude;
      this.currentLon = this.geofences[0].centerLongitude;
    }
  }

  advanceStep() {
    if (!this.geofences || this.geofences.length === 0) return;
    this.tickCount++;
    this._emitPacket({
      latitude: this.currentLat,
      longitude: this.currentLon,
      deviationScore: 0.1,
      isAnomaly: false,
    });
  }

  setSpeed(intervalMs) {
    this.intervalMs = intervalMs;
    if (this.running && !this.isPaused && this.intervalId) {
      clearInterval(this.intervalId);
      if (this.activeScenario && this.activeScenario.startsWith('scenario_')) {
        this.intervalId = setInterval(() => this._tickScenario(this.activeScenario), intervalMs);
      } else {
        this.intervalId = setInterval(() => this._tickGeneral(), intervalMs);
      }
    }
  }

  /**
   * Start one of the 3 dedicated Capstone Evaluator Scenarios.
   * @param {'scenario_nominal'|'scenario_breach'|'scenario_deviation'|'scenario_safe'} scenarioId
   * @param {Array} geofences
   * @param {Function} onPacket
   */
  startScenario(scenarioId, geofences, onPacket) {
    this.stop();
    // Alias scenario_safe to scenario_nominal for backwards compatibility
    const targetScenario = scenarioId === 'scenario_safe' ? SCENARIO_PRESETS.NOMINAL : scenarioId;

    // Use stable demonstration dataset with clearly labelled fictional locations
    this.geofences = [
      DEMO_LOCATIONS.HOME,
      DEMO_LOCATIONS.CAMPUS,
      DEMO_LOCATIONS.PARK,
    ];
    this.onPacket = onPacket;
    this.activeScenario = targetScenario;
    this.running = true;
    this.isPaused = false;
    this.tickCount = 0;

    // All scenarios start inside the demo safe place at tick 0
    this.currentLat = DEMO_LOCATIONS.HOME.centerLatitude;
    this.currentLon = DEMO_LOCATIONS.HOME.centerLongitude;

    this.intervalId = setInterval(() => this._tickScenario(targetScenario), this.intervalMs);
    this._tickScenario(targetScenario);
  }

  /**
   * Manual scenario control to inject simulated telemetry inputs
   */
  setManualPosition(lat, lon, speedKph = 3.5) {
    this.currentLat = Number(lat);
    this.currentLon = Number(lon);
    this._emitPacket({
      latitude: this.currentLat,
      longitude: this.currentLon,
      speedKph: Number(speedKph),
      source: 'simulation_manual',
    });
  }

  _tickScenario(scenarioId) {
    const baseGeo = DEMO_LOCATIONS.HOME;
    const simTime = formatSimClock(this.tickCount);

    let lat = this.currentLat;
    let lon = this.currentLon;
    let speed = 3.5;
    let isAnomaly = false;
    let devScore = 0.08;
    let eventType = 'nominal_safety';
    let motionState = 'moving';
    let phaseDescription = 'Simulating trajectory';

    if (scenarioId === SCENARIO_PRESETS.NOMINAL) {
      const idx = this.tickCount % NOMINAL_WAYPOINTS.length;
      const wp = NOMINAL_WAYPOINTS[idx];
      lat = wp.lat;
      lon = wp.lon;
      devScore = wp.dev;
      isAnomaly = false;
      eventType = 'nominal_safety';
      phaseDescription = wp.desc;
    } else if (scenarioId === SCENARIO_PRESETS.BREACH) {
      const idx = Math.min(this.tickCount, BREACH_WAYPOINTS.length - 1);
      const wp = BREACH_WAYPOINTS[idx];
      lat = wp.lat;
      lon = wp.lon;
      devScore = wp.dev;
      isAnomaly = Boolean(wp.isAnomaly);
      eventType = isAnomaly ? 'boundary_breach' : 'nominal_safety';
      phaseDescription = wp.desc;
      speed = isAnomaly ? 4.8 : 3.2;
    } else if (scenarioId === SCENARIO_PRESETS.DEVIATION) {
      const idx = Math.min(this.tickCount, DEVIATION_WAYPOINTS.length - 1);
      const wp = DEVIATION_WAYPOINTS[idx];
      lat = wp.lat;
      lon = wp.lon;
      devScore = wp.dev;
      isAnomaly = Boolean(wp.isAnomaly);
      eventType = isAnomaly ? 'route_deviation' : 'nominal_safety';
      phaseDescription = wp.desc;
      speed = 3.8;
    }

    this.currentLat = lat;
    this.currentLon = lon;

    // Calculate distance to nearest safe zone
    let minDistanceKm = Infinity;
    let nearestZoneLabel = baseGeo.label;
    for (const g of this.geofences) {
      const d = computeHaversineKm(lat, lon, g.centerLatitude, g.centerLongitude);
      if (d != null && d < minDistanceKm) {
        minDistanceKm = d;
        nearestZoneLabel = g.label;
      }
    }

    const packet = {
      id: `sim-${scenarioId}-${this.tickCount}`,
      deviceKey: 'DEMO-BAND-01',
      source: 'simulation',
      scenarioId,
      isSimulation: true,
      isHardware: false,
      timestamp: new Date().toISOString(),
      capturedAtUtc: new Date().toISOString(),
      simClockTime: simTime,
      phaseDescription,
      tickCount: this.tickCount,
      latitude: parseFloat(lat.toFixed(6)),
      longitude: parseFloat(lon.toFixed(6)),
      speedKph: parseFloat(speed.toFixed(1)),
      headingDegrees: 90,
      accuracyMeters: 4.5,
      batteryPercent: Math.max(20, 95 - Math.floor(this.tickCount * 0.2)),
      motionState,
      deviationScore: parseFloat(devScore.toFixed(3)),
      isAnomaly,
      eventType,
      nearestGeofence: nearestZoneLabel,
      distToNearestKm: parseFloat(minDistanceKm.toFixed(3)),
      accelerometer: {
        x_ms2: 0.25,
        y_ms2: 0.65,
        z_ms2: -9.81,
        magnitude: 9.83,
      },
      gyroscope: {
        x_dps: 5.2,
        y_dps: 3.1,
        z_dps: 1.4,
        magnitude: 6.2,
      },
      gps: {
        latitude: lat,
        longitude: lon,
        valid: true,
        satellites: 8,
      },
    };

    if (this.onPacket) {
      this.onPacket(packet);
    }

    this.tickCount++;
  }

  _tickGeneral() {
    this.tickCount++;
    const baseGeo = this.geofences[0];
    const targetGeo = this.geofences[1] || baseGeo;
    const t = (this.tickCount % 12) / 12;

    const lat = baseGeo.centerLatitude + (targetGeo.centerLatitude - baseGeo.centerLatitude) * t;
    const lon = baseGeo.centerLongitude + (targetGeo.centerLongitude - baseGeo.centerLongitude) * t;

    this.currentLat = lat;
    this.currentLon = lon;

    this._emitPacket({
      latitude: lat,
      longitude: lon,
      speedKph: 3.8,
      deviationScore: 0.08,
      isAnomaly: false,
      eventType: 'nominal_safety',
    });
  }

  _emitPacket(overrides = {}) {
    const lat = overrides.latitude ?? this.currentLat;
    const lon = overrides.longitude ?? this.currentLon;

    const packet = {
      id: `sim-step-${Date.now()}`,
      deviceKey: 'SIM-DEVICE-01',
      source: 'simulation',
      isSimulation: true,
      isHardware: false,
      timestamp: new Date().toISOString(),
      capturedAtUtc: new Date().toISOString(),
      latitude: parseFloat(Number(lat).toFixed(6)),
      longitude: parseFloat(Number(lon).toFixed(6)),
      speedKph: overrides.speedKph ?? 0,
      headingDegrees: 0,
      accuracyMeters: 4.0,
      batteryPercent: 92,
      motionState: overrides.motionState || 'stationary',
      deviationScore: overrides.deviationScore ?? 0.05,
      isAnomaly: Boolean(overrides.isAnomaly),
      eventType: overrides.eventType || 'nominal_safety',
      nearestGeofence: this.geofences[0]?.label || 'Safe Place',
      distToNearestKm: 0.05,
      accelerometer: {
        x_ms2: 0.1,
        y_ms2: 0.2,
        z_ms2: -9.81,
        magnitude: 9.81,
      },
      gyroscope: {
        x_dps: 1.0,
        y_dps: 1.0,
        z_dps: 0.5,
        magnitude: 1.5,
      },
      gps: {
        latitude: lat,
        longitude: lon,
        valid: true,
        satellites: 8,
      },
      ...overrides,
    };

    if (this.onPacket) {
      this.onPacket(packet);
    }
  }

  updateGeofences(geofences) {
    this.geofences = geofences || [];
  }
}

const simulation = new GPSSimulation();
export default simulation;
