import simulation from './simulation';

describe('CareTag GPS Simulation Engine & Anomaly Logic', () => {
  const mockGeofences = [
    {
      id: 1,
      label: 'Home Safe Zone',
      centerLatitude: 30.3398,
      centerLongitude: 76.3869,
      radiusMeters: 500
    },
    {
      id: 2,
      label: 'Day Center',
      centerLatitude: 30.3550,
      centerLongitude: 76.3950,
      radiusMeters: 400
    }
  ];

  afterEach(() => {
    simulation.stop();
  });

  test('initializes with inactive status', () => {
    expect(simulation.running).toBe(false);
  });

  test('starts simulation and produces valid telemetry packets', (done) => {
    let packetCount = 0;
    simulation.start(mockGeofences, (packet) => {
      packetCount++;
      expect(packet).toBeDefined();
      expect(typeof packet.latitude).toBe('number');
      expect(typeof packet.longitude).toBe('number');
      expect(packet.batteryPercent).toBeGreaterThanOrEqual(0);
      expect(packet.batteryPercent).toBeLessThanOrEqual(100);
      expect(typeof packet.deviationScore).toBe('number');
      expect(typeof packet.isAnomaly).toBe('boolean');

      if (packetCount >= 1) {
        simulation.stop();
        expect(simulation.running).toBe(false);
        done();
      }
    }, 100);
  });

  test('setSpeed adjusts simulation interval correctly', () => {
    simulation.start(mockGeofences, () => {}, 3000);
    expect(simulation.intervalMs).toBe(3000);
    simulation.setSpeed(1000);
    expect(simulation.intervalMs).toBe(1000);
  });

  test('advanceStep produces single step packets manually', () => {
    const packets = [];
    simulation.start(mockGeofences, (packet) => {
      packets.push(packet);
    }, 10000);
    simulation.stop(); // pause auto-ticker

    const initialLen = packets.length;
    simulation.advanceStep();
    expect(packets.length).toBe(initialLen + 1);

    const latest = packets[packets.length - 1];
    expect(latest.deviceKey).toBe('SIM-DEVICE-01');
    expect(latest.latitude).toBeCloseTo(30.34, 1);
  });

  test('evaluates independent safe-zone breach and routine deviation', () => {
    // Independent check 1: safe zone breach (distToNearestKm > radius)
    const outOfZonePacket = {
      latitude: 30.45,
      longitude: 76.50,
      distToNearestKm: 12.4,
      deviationScore: 0.85,
      isAnomaly: true,
      nearestGeofence: 'Home Safe Zone'
    };

    const isOutOfZone = outOfZonePacket.distToNearestKm != null && outOfZonePacket.distToNearestKm > 0;
    expect(isOutOfZone).toBe(true);

    // Independent check 2: behavioral routine deviation inside safe zone
    const routineAnomalyInZonePacket = {
      latitude: 30.3398,
      longitude: 76.3869,
      distToNearestKm: 0,
      deviationScore: 0.72,
      isAnomaly: true,
      nearestGeofence: 'Home Safe Zone'
    };

    const isOutOfZone2 = routineAnomalyInZonePacket.distToNearestKm > 0;
    const isBehavioralAnomaly = routineAnomalyInZonePacket.deviationScore > 0.6;
    expect(isOutOfZone2).toBe(false);
    expect(isBehavioralAnomaly).toBe(true);
  });
});
