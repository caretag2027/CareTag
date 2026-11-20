/**
 * Demo scenarios: a pretend child walking around a safe place.
 * Used by the "Try a demo" buttons and by the automated tests, so what you see
 * on screen is exactly what the tests check.
 *
 * Each scenario is a list of steps: { lat, lng, hasGps }.
 * The dashboard plays one step per second.
 */
import { zoneCenter } from './safety';

/** Used when the caregiver has no safe place yet. */
export const DEMO_ZONE = {
  id: 'demo-home',
  label: 'Home (demo)',
  centerLatitude: 30.3532,
  centerLongitude: 76.3713,
  radiusMeters: 100,
};

export const SCENARIOS = [
  { id: 'leaves',   label: 'Child leaves safe place',      expect: 'Alert is raised' },
  { id: 'stays',    label: 'Child stays inside',            expect: 'No alert' },
  { id: 'returns',  label: 'Child leaves, then comes back', expect: 'Alert, then “back safe”' },
  { id: 'gps_lost', label: 'Band loses GPS signal',         expect: 'No false alert' },
];

/** Move `meters` east and `metersNorth` north from a point. */
function offset(center, metersEast, metersNorth = 0) {
  const lat = center.lat + metersNorth / 111320;
  const lng = center.lng + metersEast / (111320 * Math.cos((center.lat * Math.PI) / 180));
  return { lat, lng };
}

/** Evenly spaced points from `fromM` to `toM` metres east of the centre. */
function walkEast(center, fromM, toM, steps) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const m = fromM + ((toM - fromM) * i) / steps;
    out.push({ ...offset(center, m), hasGps: true });
  }
  return out;
}

export function buildScenario(id, zone = DEMO_ZONE) {
  const c = zoneCenter(zone);
  const r = Number(zone.radiusMeters) || 100;
  const farOut = r + 150; // clearly outside

  switch (id) {
    case 'leaves':
      return walkEast(c, 0, farOut, 10);
    case 'stays':
      return [0, 0.2, 0.4, 0.3, 0.1, -0.2, -0.4, -0.1].map((f, i) => ({
        ...offset(c, r * f, r * (i % 2 ? 0.2 : -0.2)),
        hasGps: true,
      }));
    case 'returns':
      return [...walkEast(c, 0, farOut, 6), ...walkEast(c, farOut, 0, 6).slice(1)];
    case 'gps_lost':
      return [
        ...walkEast(c, 0, r * 0.4, 3),
        { lat: null, lng: null, hasGps: false },
        { lat: null, lng: null, hasGps: false },
        { lat: null, lng: null, hasGps: false },
        { ...offset(c, r * 0.3), hasGps: true },
      ];
    default:
      throw new Error(`Unknown demo scenario: ${id}`);
  }
}
