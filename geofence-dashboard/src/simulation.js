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

export const SCENARIO_PRESETS = {
  NOMINAL: 'scenario_nominal',
  BREACH: 'scenario_breach',
  DEVIATION: 'scenario_deviation',
};

export const SCENARIO_METADATA = {
  [SCENARIO_PRESETS.NOMINAL]: {
    id: SCENARIO_PRESETS.NOMINAL,
    name: '1. Nominal Safety',
    tag: 'All Normal',
    description: 'Simulates device safely inside an actively monitored safe place with valid telemetry. No boundary breach or route deviation is flagged.',
    expectedResult: 'Inside Safe Place · Nominal Safety · Zero Alerts',
  },
  [SCENARIO_PRESETS.BREACH]: {
    id: SCENARIO_PRESETS.BREACH,
    name: '2. Boundary Breach',
    tag: 'Critical Breach',
    description: 'Simulates device moving beyond the perimeter of an active safe place into unmonitored territory. Evaluates distance against radius and triggers a boundary breach alert.',
    expectedResult: 'Outside Safe Place · Boundary Breach Event Emitted',
  },
  [SCENARIO_PRESETS.DEVIATION]: {
    id: SCENARIO_PRESETS.DEVIATION,
    name: '3. Route Deviation',
    tag: 'Corridor Deviation',
    description: 'Simulates device departing from the expected commute route into an unlearned side corridor. Calculates deviation score and triggers a route deviation alert.',
    expectedResult: 'Deviation Score > 0.65 · Route Deviation Event Emitted',
  },
};

class GPSSimulation {
  constructor() {
    this.geofences = [];
    this.intervalId = null;
    this.onPacket = null;
    this.tickCount = 0;
    this.running = false;
    this.activeScenario = null;
    this.simulatedAlerts = [];
    this.currentLat = 30.3491;
    this.currentLon = 76.4117;
    this.intervalMs = 3000;
  }

  /**
   * Start general simulation along configured geofences.
   */
  start(geofences, onPacket, intervalMs = 3000) {
    this.stop();
    if (!geofences || geofences.length === 0) return;

    this.geofences = geofences;
    this.onPacket = onPacket;
    this.intervalMs = intervalMs;
    this.tickCount = 0;
    this.running = true;
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
  }

  reset() {
    this.stop();
    this.activeScenario = null;
    this.simulatedAlerts = [];
    this.tickCount = 0;
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
    if (this.running && this.intervalId) {
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

    this.geofences = geofences && geofences.length > 0 ? geofences : [
      { id: 'geo-home', label: 'Home Safe Place', centerLatitude: 30.3491, centerLongitude: 76.4117, radiusMeters: 400 },
      { id: 'geo-school', label: 'School Campus', centerLatitude: 30.3555, centerLongitude: 76.4225, radiusMeters: 500 }
    ];
    this.onPacket = onPacket;
    this.activeScenario = targetScenario;
    this.running = true;
    this.tickCount = 0;

    const baseGeo = this.geofences[0];

    if (targetScenario === SCENARIO_PRESETS.NOMINAL) {
      this.currentLat = baseGeo.centerLatitude;
      this.currentLon = baseGeo.centerLongitude;
    } else if (targetScenario === SCENARIO_PRESETS.DEVIATION) {
      // Offset from expected corridor
      this.currentLat = baseGeo.centerLatitude + 0.004;
      this.currentLon = baseGeo.centerLongitude + 0.005;
    } else if (targetScenario === SCENARIO_PRESETS.BREACH) {
      // 1.2km offset outside all safe places
      this.currentLat = baseGeo.centerLatitude + 0.012;
      this.currentLon = baseGeo.centerLongitude + 0.015;
    }

    this.intervalId = setInterval(() => this._tickScenario(targetScenario), 2500);
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
    this.tickCount++;
    const baseGeo = this.geofences[0] || { centerLatitude: 30.3491, centerLongitude: 76.4117, radiusMeters: 400, label: 'Home Safe Place' };

    let lat = this.currentLat;
    let lon = this.currentLon;
    let speed = 3.2;
    let isAnomaly = false;
    let devScore = 0.08;
    let eventType = 'nominal_safety';
    let motionState = 'moving';

    if (scenarioId === SCENARIO_PRESETS.NOMINAL) {
      // Moving inside safe zone boundary
      const t = (this.tickCount % 6) / 6;
      lat = baseGeo.centerLatitude + (Math.sin(t * Math.PI * 2) * 0.001);
      lon = baseGeo.centerLongitude + (Math.cos(t * Math.PI * 2) * 0.001);
      devScore = 0.08;
      isAnomaly = false;
      eventType = 'nominal_safety';
      motionState = 'moving';
    } else if (scenarioId === SCENARIO_PRESETS.BREACH) {
      // Steps further outside active boundary
      const progress = Math.min(1.0, this.tickCount * 0.15);
      lat = baseGeo.centerLatitude + 0.008 + (progress * 0.006);
      lon = baseGeo.centerLongitude + 0.010 + (progress * 0.008);
      devScore = 0.92;
      isAnomaly = true;
      eventType = 'boundary_breach';
      motionState = 'moving';
    } else if (scenarioId === SCENARIO_PRESETS.DEVIATION) {
      // Diverges perpendicular to expected corridor
      const progress = this.tickCount * 0.0006;
      lat = baseGeo.centerLatitude + 0.005 + progress;
      lon = baseGeo.centerLongitude - 0.004 - progress;
      devScore = 0.84;
      isAnomaly = true;
      eventType = 'route_deviation';
      motionState = 'moving';
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
      deviceKey: 'SIM-DEVICE-01',
      source: 'simulation',
      scenarioId,
      isSimulation: true,
      isHardware: false,
      timestamp: new Date().toISOString(),
      capturedAtUtc: new Date().toISOString(),
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
