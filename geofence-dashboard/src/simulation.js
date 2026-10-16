/**
 * CareTag GPS Simulation Engine
 * 
 * Simulates realistic device movement using the user's saved geofences
 * as location clusters. The simulated device:
 *   - Stays at geofence centers (stationary phases)
 *   - Commutes between geofences (moving phases with interpolation)
 *   - Occasionally wanders to unexpected locations (anomalies)
 * 
 * Deviation scoring uses the same haversine + threshold logic
 * as the CareTag ML pipeline (config: ANOMALY_THRESHOLD=0.6,
 * MAX_EXPECTED_DISTANCE_KM=10).
 */

// ── CareTag config constants (from config.py) ──
const ANOMALY_THRESHOLD = 0.6;
const SPATIAL_WEIGHT = 0.5;
const TEMPORAL_WEIGHT = 0.5;

// ── Haversine distance (same formula as anomaly_scorer.py) ──
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ── GPS jitter to simulate real device noise ──
function addJitter(lat, lon, metersRange = 30) {
  const jitterDeg = metersRange / 111320; // ~1 degree = 111.32 km
  return {
    lat: lat + (Math.random() - 0.5) * 2 * jitterDeg,
    lon: lon + (Math.random() - 0.5) * 2 * jitterDeg,
  };
}

// ── Interpolate between two points ──
function interpolate(from, to, t) {
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lon: from.lon + (to.lon - from.lon) * t,
  };
}

/**
 * The simulation state machine.
 * 
 * Phases:
 *   STAY      — device is stationary at a geofence center
 *   COMMUTE   — device is moving between two geofences
 *   ANOMALY   — device wanders to unexpected location
 */
class GPSSimulation {
  constructor() {
    this.geofences = [];
    this.intervalId = null;
    this.onPacket = null;
    this.tickCount = 0;
    this.phase = 'STAY';        // STAY | COMMUTE | ANOMALY
    this.currentGeoIdx = 0;     // index into geofences
    this.targetGeoIdx = 0;
    this.phaseProgress = 0;     // 0..1 progress through current phase
    this.phaseDuration = 0;     // how many ticks this phase lasts
    this.phaseTick = 0;
    this.currentLat = 0;
    this.currentLon = 0;
    this.running = false;
  }

  /**
   * Start the simulation.
   * @param {Array} geofences — array of { id, label, centerLatitude, centerLongitude, radiusMeters }
   * @param {Function} onPacket — callback(packet) called every tick with simulated GPS data
   * @param {number} intervalMs — tick interval in ms (default 3000 = 3s)
   */
  start(geofences, onPacket, intervalMs = 3000) {
    this.stop();

    if (!geofences || geofences.length === 0) return;

    this.geofences = geofences;
    this.onPacket = onPacket;
    this.tickCount = 0;
    this.running = true;

    // Start at the first geofence
    this.currentGeoIdx = 0;
    this.currentLat = geofences[0].centerLatitude;
    this.currentLon = geofences[0].centerLongitude;
    this._startStayPhase(0);

    this.intervalId = setInterval(() => this._tick(), intervalMs);
    // Fire immediately
    this._tick();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
  }

  /** Update geofences while simulation is running */
  updateGeofences(geofences) {
    this.geofences = geofences || [];
    if (this.geofences.length === 0) {
      this.stop();
    }
  }

  // ── Phase management ──

  _startStayPhase(geoIdx) {
    this.phase = 'STAY';
    this.currentGeoIdx = geoIdx % this.geofences.length;
    this.phaseTick = 0;
    // Stay for 8–15 ticks (24–45 seconds at 3s interval)
    this.phaseDuration = 8 + Math.floor(Math.random() * 8);
  }

  _startCommutePhase(fromIdx, toIdx) {
    this.phase = 'COMMUTE';
    this.currentGeoIdx = fromIdx;
    this.targetGeoIdx = toIdx;
    this.phaseTick = 0;
    // Commute takes 6–12 ticks
    this.phaseDuration = 6 + Math.floor(Math.random() * 7);
  }

  _startAnomalyPhase() {
    this.phase = 'ANOMALY';
    this.phaseTick = 0;
    // Anomaly lasts 4–8 ticks
    this.phaseDuration = 4 + Math.floor(Math.random() * 5);
  }

  // ── Core tick ──

  _tick() {
    if (this.geofences.length === 0) return;
    this.tickCount++;
    this.phaseTick++;

    let speed = 0;
    let motionState = 'stationary';

    const geo = this.geofences[this.currentGeoIdx];

    if (this.phase === 'STAY') {
      // Slight jitter around geofence center
      const jittered = addJitter(geo.centerLatitude, geo.centerLongitude, 20);
      this.currentLat = jittered.lat;
      this.currentLon = jittered.lon;
      speed = Math.random() * 0.5; // nearly stationary

      if (this.phaseTick >= this.phaseDuration) {
        // Decide next: commute to another geofence, or inject anomaly
        if (this.geofences.length > 1 && Math.random() < 0.8) {
          // Pick a different geofence to commute to
          let nextIdx = (this.currentGeoIdx + 1) % this.geofences.length;
          this._startCommutePhase(this.currentGeoIdx, nextIdx);
        } else if (Math.random() < 0.4) {
          // Anomaly
          this._startAnomalyPhase();
        } else {
          // Stay longer at same location
          this._startStayPhase(this.currentGeoIdx);
        }
      }
    } else if (this.phase === 'COMMUTE') {
      const from = this.geofences[this.currentGeoIdx];
      const to = this.geofences[this.targetGeoIdx];
      const t = Math.min(this.phaseTick / this.phaseDuration, 1);
      // Ease in-out for natural movement
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      const pos = interpolate(
        { lat: from.centerLatitude, lon: from.centerLongitude },
        { lat: to.centerLatitude, lon: to.centerLongitude },
        eased
      );
      const jittered = addJitter(pos.lat, pos.lon, 50);
      this.currentLat = jittered.lat;
      this.currentLon = jittered.lon;

      // Calculate speed from distance between geofences
      const totalDist = haversineKm(
        from.centerLatitude, from.centerLongitude,
        to.centerLatitude, to.centerLongitude
      );
      speed = (totalDist / (this.phaseDuration * 3 / 3600)) || 5; // rough km/h
      speed = Math.min(speed, 60) + (Math.random() - 0.5) * 5;
      motionState = 'moving';

      if (this.phaseTick >= this.phaseDuration) {
        this._startStayPhase(this.targetGeoIdx);
      }
    } else if (this.phase === 'ANOMALY') {
      // Wander to a random offset from current position
      if (this.phaseTick === 1) {
        // Pick an anomaly direction — just outside geofence radius (0.5-2km away)
        const angle = Math.random() * 2 * Math.PI;
        const geoRadiusKm = (geo.radiusMeters || 500) / 1000;
        const distKm = geoRadiusKm + 0.5 + Math.random() * 1.5; // 0.5–2km beyond fence edge
        const dLat = (distKm / 111.32) * Math.cos(angle);
        const dLon = (distKm / (111.32 * Math.cos((geo.centerLatitude * Math.PI) / 180))) * Math.sin(angle);
        this._anomalyTarget = {
          lat: geo.centerLatitude + dLat,
          lon: geo.centerLongitude + dLon,
        };
      }

      const t = Math.min(this.phaseTick / this.phaseDuration, 1);
      const pos = interpolate(
        { lat: geo.centerLatitude, lon: geo.centerLongitude },
        this._anomalyTarget || { lat: geo.centerLatitude + 0.05, lon: geo.centerLongitude + 0.05 },
        t
      );
      const jittered = addJitter(pos.lat, pos.lon, 80);
      this.currentLat = jittered.lat;
      this.currentLon = jittered.lon;
      speed = 15 + Math.random() * 25;
      motionState = 'moving';

      if (this.phaseTick >= this.phaseDuration) {
        // Return to a geofence
        this._startCommutePhase(
          this.currentGeoIdx,
          Math.floor(Math.random() * this.geofences.length)
        );
      }
    }

    // ── Compute deviation score (mirrors CareTag anomaly_scorer.py) ──
    const { nearestIdx, distKm, radiusKm } = this._findNearestGeofence(this.currentLat, this.currentLon);
    // Score based on how far OUTSIDE the nearest geofence the device is
    const outsideDist = Math.max(0, distKm - radiusKm);
    // Normalize: 0 when inside fence, 1.0 when 2x the radius outside
    const maxExpectedDist = Math.max(radiusKm * 2, 0.5); // at least 500m
    const spatialScore = Math.min(outsideDist / maxExpectedDist, 1.0);
    // Temporal component: if at expected cluster → 0, otherwise estimate
    const atExpected = nearestIdx === this.currentGeoIdx ? 0.0 : 0.5;
    const deviationScore = SPATIAL_WEIGHT * spatialScore + TEMPORAL_WEIGHT * atExpected;
    const isAnomaly = deviationScore > ANOMALY_THRESHOLD || outsideDist > radiusKm;

    if (isAnomaly) {
      motionState = 'abnormal';
    }

    // ── Build packet (matches backend GsmPacket DTO shape) ──
    const now = new Date();
    const packet = {
      id: this.tickCount,
      deviceKey: 'SIM-DEVICE-01',
      packetType: 'GPS',
      capturedAtUtc: now.toISOString(),
      receivedAtUtc: now.toISOString(),
      latitude: parseFloat(this.currentLat.toFixed(6)),
      longitude: parseFloat(this.currentLon.toFixed(6)),
      speedKph: parseFloat(speed.toFixed(1)),
      headingDegrees: Math.floor(Math.random() * 360),
      accuracyMeters: 5 + Math.random() * 15,
      batteryPercent: Math.max(10, 95 - Math.floor(this.tickCount * 0.1)),
      gpsEnabled: true,
      motionState: motionState,
      routineState: this.phase.toLowerCase(),
      deviationScore: parseFloat(deviationScore.toFixed(4)),
      signalRssi: -60 - Math.floor(Math.random() * 30),
      isAnomaly: isAnomaly,
      nearestGeofence: this.geofences[nearestIdx]?.label || null,
      distToNearestKm: parseFloat(distKm.toFixed(3)),
      phase: this.phase,
    };

    this.onPacket?.(packet);
  }

  _findNearestGeofence(lat, lon) {
    let minDist = Infinity;
    let nearestIdx = 0;
    for (let i = 0; i < this.geofences.length; i++) {
      const d = haversineKm(lat, lon, this.geofences[i].centerLatitude, this.geofences[i].centerLongitude);
      if (d < minDist) {
        minDist = d;
        nearestIdx = i;
      }
    }
    return { nearestIdx, distKm: minDist, radiusKm: (this.geofences[nearestIdx]?.radiusMeters || 500) / 1000 };
  }
}

// Singleton
const simulation = new GPSSimulation();
export default simulation;
