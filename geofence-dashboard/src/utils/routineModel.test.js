import {
  isEligibleForRoutineLearning,
  getDateKey,
  computeRoutineProfile,
  evaluateRouteDeviation,
  ROUTINE_CONFIG,
} from './routineModel';

describe('CareTag Routine Learning Model', () => {
  describe('isEligibleForRoutineLearning', () => {
    test('rejects simulation packets', () => {
      expect(isEligibleForRoutineLearning({ source: 'simulation', latitude: 30.34, longitude: 76.41 })).toBe(false);
      expect(isEligibleForRoutineLearning({ source: 'simulation_scenario', latitude: 30.34, longitude: 76.41 })).toBe(false);
      expect(isEligibleForRoutineLearning({ isSimulation: true, latitude: 30.34, longitude: 76.41 })).toBe(false);
    });

    test('rejects missing or zeroed coordinates', () => {
      expect(isEligibleForRoutineLearning(null)).toBe(false);
      expect(isEligibleForRoutineLearning({ latitude: null, longitude: null })).toBe(false);
      expect(isEligibleForRoutineLearning({ latitude: 0.00001, longitude: 0.00001 })).toBe(false);
    });

    test('rejects packets with invalid GPS flags', () => {
      expect(isEligibleForRoutineLearning({ latitude: 30.34, longitude: 76.41, gps: { valid: false } })).toBe(false);
    });

    test('accepts valid live hardware packets', () => {
      const validPacket = {
        source: 'hardware_firebase',
        latitude: 30.3491,
        longitude: 76.4117,
        isHardware: true,
        gps: { valid: true },
      };
      expect(isEligibleForRoutineLearning(validPacket)).toBe(true);
    });
  });

  describe('getDateKey', () => {
    test('formats date correctly', () => {
      const key = getDateKey('2026-10-16T12:00:00Z', 'UTC');
      expect(key).toBe('2026-10-16');
    });
  });

  describe('computeRoutineProfile', () => {
    test('accurately indicates insufficient history when under minimum required days', () => {
      const history = {
        '2026-10-15': [
          { latitude: 30.3491, longitude: 76.4117, source: 'hardware_firebase' },
        ],
      };
      const profile = computeRoutineProfile('SMART-BAND-01', history, []);

      expect(profile.recordedDaysCount).toBe(1);
      expect(profile.hasSufficientHistory).toBe(false);
      expect(profile.confidence.score).toBeLessThanOrEqual(0.45);
      expect(profile.confidence.label).toContain('Baseline History Building');
      expect(profile.timeline[0].status).toBe('completed');
      expect(profile.timeline[1].status).toBe('in_progress');
      expect(profile.timeline[2].status).toBe('pending');
    });

    test('calibrates profile with high confidence when sufficient observations exist', () => {
      const history = {
        '2026-10-13': Array(8).fill({ latitude: 30.3491, longitude: 76.4117, source: 'hardware_firebase' }),
        '2026-10-14': Array(8).fill({ latitude: 30.3491, longitude: 76.4117, source: 'hardware_firebase' }),
        '2026-10-15': Array(8).fill({ latitude: 30.3491, longitude: 76.4117, source: 'hardware_firebase' }),
        '2026-10-16': Array(8).fill({ latitude: 30.3491, longitude: 76.4117, source: 'hardware_firebase' }),
      };

      const geofences = [
        { label: 'Home', centerLatitude: 30.3491, centerLongitude: 76.4117 },
        { label: 'School', centerLatitude: 30.3555, centerLongitude: 76.4225 },
      ];

      const profile = computeRoutineProfile('SMART-BAND-01', history, geofences);

      expect(profile.recordedDaysCount).toBe(4);
      expect(profile.hasSufficientHistory).toBe(true);
      expect(profile.confidence.score).toBeGreaterThan(0.7);
      expect(profile.primaryRoute.origin).toBe('Home');
      expect(profile.primaryRoute.destination).toBe('School');
      expect(profile.timeline[0].status).toBe('completed');
      expect(profile.timeline[1].status).toBe('completed');
      expect(profile.timeline[2].status).toBe('completed');
      expect(profile.timeline[3].status).toBe('completed');
    });
  });

  describe('evaluateRouteDeviation', () => {
    const corridor = [
      [30.3491, 76.4117],
      [30.3520, 76.4170],
      [30.3555, 76.4225],
    ];

    test('reports no deviation for coordinates close to the expected corridor', () => {
      // Very close to the start waypoint
      const result = evaluateRouteDeviation(30.3492, 76.4118, corridor, ROUTINE_CONFIG.CORRIDOR_TOLERANCE_KM);
      expect(result.isDeviated).toBe(false);
      expect(result.minDistanceKm).toBeLessThan(ROUTINE_CONFIG.CORRIDOR_TOLERANCE_KM);
      expect(result.deviationScore).toBeLessThan(0.5);
    });

    test('flags deviation when coordinates are far from the corridor', () => {
      // 5km away from the corridor
      const result = evaluateRouteDeviation(30.4000, 76.5000, corridor, ROUTINE_CONFIG.CORRIDOR_TOLERANCE_KM);
      expect(result.isDeviated).toBe(true);
      expect(result.minDistanceKm).toBeGreaterThan(ROUTINE_CONFIG.CORRIDOR_TOLERANCE_KM);
      expect(result.deviationScore).toBeGreaterThanOrEqual(0.65);
      expect(result.reason).toContain('away from learned corridor');
    });
  });
});
