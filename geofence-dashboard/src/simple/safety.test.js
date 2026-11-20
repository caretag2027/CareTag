/**
 * Safety logic tests — "is the child inside a safe place, and when do we alert?"
 */
import { checkPosition, createAlertMonitor, distanceMeters, explainNoGps, getStatus, GPS_WOBBLE_METERS } from './safety';

// A 100 m safe place called Home, plus a helper to make points N metres east of it.
const HOME = { id: 'home', label: 'Home', centerLatitude: 30.3532, centerLongitude: 76.3713, radiusMeters: 100 };
const SCHOOL = { id: 'school', label: 'School', centerLatitude: 30.3600, centerLongitude: 76.3713, radiusMeters: 150 };
const eastOfHome = (m) => ({
  lat: HOME.centerLatitude,
  lng: HOME.centerLongitude + m / (111320 * Math.cos((HOME.centerLatitude * Math.PI) / 180)),
});

describe('distanceMeters', () => {
  test('measures real-world distance', () => {
    expect(distanceMeters(eastOfHome(0), eastOfHome(250))).toBeCloseTo(250, 0);
  });
});

describe('checkPosition — inside or outside?', () => {
  test('child at the centre of Home is inside', () => {
    const r = checkPosition(eastOfHome(0), [HOME]);
    expect(r.inside).toBe(true);
    expect(r.zoneName).toBe('Home');
  });

  test('child 250 m away is outside, 150 m past the edge', () => {
    const r = checkPosition(eastOfHome(250), [HOME]);
    expect(r.inside).toBe(false);
    expect(r.zoneName).toBe('Home');
    expect(r.metersOutside).toBeCloseTo(150, -1);
  });

  test('small GPS wobble just past the edge still counts as inside', () => {
    expect(checkPosition(eastOfHome(100 + GPS_WOBBLE_METERS - 2), [HOME]).inside).toBe(true);
    expect(checkPosition(eastOfHome(100 + GPS_WOBBLE_METERS + 5), [HOME]).inside).toBe(false);
  });

  test('being inside ANY safe place counts as safe', () => {
    const atSchool = { lat: SCHOOL.centerLatitude, lng: SCHOOL.centerLongitude };
    const r = checkPosition(atSchool, [HOME, SCHOOL]);
    expect(r.inside).toBe(true);
    expect(r.zoneName).toBe('School');
  });

  test('when outside everywhere, reports the nearest safe place', () => {
    const r = checkPosition(eastOfHome(400), [HOME, SCHOOL]);
    expect(r.inside).toBe(false);
    expect(r.zoneName).toBe('Home');
  });

  test('switched-off safe places are ignored', () => {
    expect(checkPosition(eastOfHome(0), [{ ...HOME, enabled: false }])).toBeNull();
  });

  test('no position or no safe places gives no answer (never a false alarm)', () => {
    expect(checkPosition(null, [HOME])).toBeNull();
    expect(checkPosition(eastOfHome(0), [])).toBeNull();
  });
});

describe('getStatus — the banner message', () => {
  const base = { bandOnline: true, hasGps: true, position: eastOfHome(0), zones: [HOME] };

  test('safe inside Home', () => {
    const s = getStatus(base);
    expect(s.kind).toBe('safe');
    expect(s.title).toBe('Safe — inside Home');
  });

  test('outside shows distance and place name', () => {
    const s = getStatus({ ...base, position: eastOfHome(250) });
    expect(s.kind).toBe('outside');
    expect(s.title).toMatch(/Outside safe place — \d+ m from Home/);
  });

  test('no safe places → asks caregiver to add one', () => {
    expect(getStatus({ ...base, zones: [] }).kind).toBe('no_zones');
  });

  test('band offline beats everything else', () => {
    expect(getStatus({ ...base, bandOnline: false, position: eastOfHome(500) }).kind).toBe('offline');
  });

  test('band online but no GPS fix → waiting for GPS', () => {
    expect(getStatus({ ...base, hasGps: false, position: null }).kind).toBe('no_gps');
  });
});

describe('createAlertMonitor — when to alert', () => {
  const run = (meters) => {
    const monitor = createAlertMonitor();
    return meters.map((m) => monitor.update(m == null ? null : checkPosition(eastOfHome(m), [HOME]))).filter(Boolean);
  };

  test('child walks out of Home → exactly one alert', () => {
    const events = run([0, 40, 80, 130, 180, 250, 300]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'left', zoneName: 'Home' });
  });

  test('child stays inside → no alerts', () => {
    expect(run([0, 20, 50, 90, 30, 0])).toHaveLength(0);
  });

  test('child leaves then returns → alert, then "returned"', () => {
    const events = run([0, 200, 250, 200, 50, 0]);
    expect(events.map((e) => e.type)).toEqual(['left', 'returned']);
  });

  test('child leaves twice → two alerts', () => {
    const events = run([0, 200, 0, 220]);
    expect(events.map((e) => e.type)).toEqual(['left', 'returned', 'left']);
  });

  test('GPS drops out (null readings) → no false alert', () => {
    expect(run([0, null, null, null, 30])).toHaveLength(0);
  });

  test('GPS drops out while outside → no repeat alert when it comes back', () => {
    const events = run([0, 200, null, null, 210]);
    expect(events.map((e) => e.type)).toEqual(['left']);
  });

  test('wobbling on the boundary edge → no alert', () => {
    expect(run([95, 105, 98, 110, 100, 108])).toHaveLength(0);
  });

  test('first reading already outside → alert straight away', () => {
    expect(run([300]).map((e) => e.type)).toEqual(['left']);
  });
});

describe('explainNoGps — why there is no location', () => {
  test('GPS module sends no bytes → "not responding", with wiring hint', () => {
    const r = explainNoGps({ satellitesReported: 0, chars: 0 });
    expect(r.reason).toBe('module_silent');
    expect(r.detail).toMatch(/GPIO 16/);
  });

  test('module talking but too few satellites → shows the count', () => {
    const r = explainNoGps({ satellitesReported: 2, chars: 5400 });
    expect(r.reason).toBe('searching');
    expect(r.detail).toMatch(/2 found, needs 4/);
  });

  test('band sends no diagnostics → says the cause is unknown', () => {
    expect(explainNoGps({ satellitesReported: null, chars: null }).reason).toBe('unknown');
    expect(explainNoGps().reason).toBe('unknown');
  });

  test('banner title changes when the module is silent', () => {
    const s = getStatus({ bandOnline: true, hasGps: false, position: null, zones: [HOME], gpsInfo: { chars: 0 } });
    expect(s.kind).toBe('no_gps');
    expect(s.title).toBe('GPS module not responding');
  });

  test('banner shows satellite count while searching', () => {
    const s = getStatus({ bandOnline: true, hasGps: false, position: null, zones: [HOME], gpsInfo: { satellitesReported: 3, chars: 900 } });
    expect(s.title).toBe('Waiting for GPS');
    expect(s.detail).toMatch(/3 found/);
  });
});
