import { parseHardwareTelemetry } from './firebase';
import { evaluateSafetyState } from './utils/dashboardUtils';

const zone = { id: 'home', label: 'Home', centerLatitude: 30.3491, centerLongitude: 76.4117, radiusMeters: 100 };
const base = { accelerometer: { x_ms2: 0, y_ms2: 0, z_ms2: 9.81 }, gyroscope: {}, uptime_ms: 1000 };

test('no GPS fix yields estimated position, flagged invalid', () => {
  const p = parseHardwareTelemetry({ ...base, gps: { valid: false } });
  expect(p.gps.valid).toBe(false);
  expect(p.gps.isEstimated).toBe(true);
});

test('marker moves and leaves safe zone as GPS fixes arrive', () => {
  const inside = parseHardwareTelemetry({ ...base, gps: { valid: true, latitude: 30.3491, longitude: 76.4117, satellites: 7 } });
  expect(inside.latitude).toBeCloseTo(30.3491);
  expect(evaluateSafetyState(inside, [zone]).insideZone).toBe('Home');

  const outside = parseHardwareTelemetry({ ...base, uptime_ms: 9000, gps: { valid: true, latitude: 30.3530, longitude: 76.4117, satellites: 7 } });
  expect(outside.latitude).toBeCloseTo(30.353);
  expect(evaluateSafetyState(outside, [zone]).status).toBe('breach');
});

test('accepts lat/lng and lon field spellings from firmware', () => {
  const a = parseHardwareTelemetry({ ...base, gps: { valid: true, lat: 30.35, lng: 76.41 } });
  expect(a.gps.valid).toBe(true);
  expect(a.latitude).toBeCloseTo(30.35);
  const b = parseHardwareTelemetry({ ...base, gps: { valid: true, lat: '30.36', lon: '76.42' } });
  expect(b.longitude).toBeCloseTo(76.42);
});
