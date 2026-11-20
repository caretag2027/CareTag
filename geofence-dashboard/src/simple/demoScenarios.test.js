/**
 * Demo child scenarios — each "Try a demo" button, played start to finish
 * through the same safety logic the live band uses.
 */
import { checkPosition, createAlertMonitor, GPS_WOBBLE_METERS } from './safety';
import { DEMO_ZONE, SCENARIOS, buildScenario } from './demoScenarios';

/** Plays a scenario and returns the alert events it produced. */
function play(id, zone = DEMO_ZONE) {
  const monitor = createAlertMonitor();
  return buildScenario(id, zone)
    .map((step) => monitor.update(step.hasGps ? checkPosition(step, [zone]) : null))
    .filter(Boolean);
}

describe('Demo child scenarios', () => {
  test('"Child leaves safe place" → child is alerted as outside', () => {
    const events = play('leaves');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('left');
    expect(events[0].zoneName).toBe('Home (demo)');
    expect(events[0].metersOutside).toBeGreaterThan(GPS_WOBBLE_METERS); // alerted as soon as they cross the edge
  });

  test('"Child stays inside" → no alert at all', () => {
    expect(play('stays')).toEqual([]);
  });

  test('"Child leaves, then comes back" → alert, then back-safe notice', () => {
    expect(play('returns').map((e) => e.type)).toEqual(['left', 'returned']);
  });

  test('"Band loses GPS signal" → no false alert', () => {
    expect(play('gps_lost')).toEqual([]);
  });

  test('scenarios work around the caregiver\'s own safe place too', () => {
    const school = { id: 's', label: 'School', centerLatitude: 28.6139, centerLongitude: 77.209, radiusMeters: 300 };
    expect(play('leaves', school)).toMatchObject([{ type: 'left', zoneName: 'School' }]);
    expect(play('stays', school)).toEqual([]);
  });

  test('every listed scenario can be built', () => {
    SCENARIOS.forEach((s) => expect(buildScenario(s.id).length).toBeGreaterThan(3));
  });
});
