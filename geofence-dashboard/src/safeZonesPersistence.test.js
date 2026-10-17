import {
  saveSafeZoneToFirebase,
  fetchSafeZonesFromFirebase,
  updateSafeZoneInFirebase,
  deleteSafeZoneFromFirebase,
  validateSafeZoneData,
} from './firebase';
import {
  createGeofence,
  fetchGeofences,
  updateGeofence,
  deleteGeofence,
} from './api';

describe('Multi-User Safe Places Database Persistence and Cross-User Visibility', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.clear();
    jest.restoreAllMocks();
  });

  test('validateSafeZoneData generates consistent payload with proper types and coordinates', () => {
    const raw = {
      label: 'Grandma Residence',
      lat: 30.34912,
      lng: 76.41178,
      radiusMeters: 400,
    };
    const validated = validateSafeZoneData(raw, 'CARE-TAG-01');
    expect(validated.id).toBeDefined();
    expect(validated.label).toBe('Grandma Residence');
    expect(validated.name).toBe('Grandma Residence');
    expect(validated.centerLatitude).toBe(30.34912);
    expect(validated.centerLongitude).toBe(76.41178);
    expect(validated.radiusMeters).toBe(400);
    expect(validated.deviceKey).toBe('CARE-TAG-01');
    expect(validated.schedule.mode).toBe('all_day');
  });

  test('saveSafeZoneToFirebase writes to user-specific, device, primary, and shared endpoints', async () => {
    const writtenUrls = [];
    global.fetch = jest.fn((url, options) => {
      writtenUrls.push({ url, method: options?.method });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });

    const zone = {
      id: 'zone-test-101',
      label: 'Campus Library',
      lat: 30.352,
      lng: 76.415,
      radiusMeters: 300,
    };

    const res = await saveSafeZoneToFirebase('CARE-TAG-01', zone, 'usr_dr_sharma');

    expect(res.ok).toBe(true);
    expect(writtenUrls.length).toBe(4);

    const urls = writtenUrls.map(w => w.url);
    // 1. Device key path
    expect(urls.some(u => u.includes('/safeZones/CARE-TAG-01/zone-test-101.json'))).toBe(true);
    // 2. User-specific path
    expect(urls.some(u => u.includes('/users/usr_dr_sharma/safeZones/zone-test-101.json'))).toBe(true);
    // 3. Shared path for cross-user visibility
    expect(urls.some(u => u.includes('/shared/safeZones/zone-test-101.json'))).toBe(true);

    // All must be PUT requests
    expect(writtenUrls.every(w => w.method === 'PUT')).toBe(true);
  });

  test('fetchSafeZonesFromFirebase merges and deduplicates across user-specific and shared paths', async () => {
    // Simulate Firebase having a zone created by Dr. Sharma at /shared/safeZones.json
    // and another zone at /safeZones/CARE-TAG-01.json
    global.fetch = jest.fn((url) => {
      if (url.includes('/shared/safeZones.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            'zone-shared-1': {
              id: 'zone-shared-1',
              label: 'Community Clinic',
              centerLatitude: 30.355,
              centerLongitude: 76.418,
              radiusMeters: 250,
              updatedAtUtc: '2026-10-16T10:00:00Z',
            },
          }),
        });
      }
      if (url.includes('/safeZones/CARE-TAG-01.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            'zone-device-1': {
              id: 'zone-device-1',
              label: 'Home Perimeter',
              centerLatitude: 30.349,
              centerLongitude: 76.411,
              radiusMeters: 500,
              updatedAtUtc: '2026-10-16T09:00:00Z',
            },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(null),
      });
    });

    // When Priya Singla (another user) opens the dashboard and fetches
    const zones = await fetchSafeZonesFromFirebase('CARE-TAG-01', 'usr_parent_guardian');

    expect(zones.length).toBe(2);
    const labels = zones.map(z => z.label);
    expect(labels).toContain('Community Clinic');
    expect(labels).toContain('Home Perimeter');
  });

  test('updateSafeZoneInFirebase propagates updates across all paths', async () => {
    const calls = [];
    global.fetch = jest.fn((url, options) => {
      calls.push({ url, method: options?.method });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          id: 'zone-update-1',
          label: 'Updated Name',
          centerLatitude: 30.349,
          centerLongitude: 76.411,
        }),
      });
    });

    const res = await updateSafeZoneInFirebase('CARE-TAG-01', 'zone-update-1', {
      label: 'Updated Name',
      radiusMeters: 600,
    }, 'usr_nurse_ananya');

    expect(res.ok).toBe(true);
    const putCalls = calls.filter(c => c.method === 'PUT');
    expect(putCalls.length).toBe(4);
    expect(putCalls.some(c => c.url.includes('/users/usr_nurse_ananya/safeZones/zone-update-1.json'))).toBe(true);
    expect(putCalls.some(c => c.url.includes('/shared/safeZones/zone-update-1.json'))).toBe(true);
  });

  test('deleteSafeZoneFromFirebase sends DELETE to user, device, and shared endpoints', async () => {
    const deleteCalls = [];
    global.fetch = jest.fn((url, options) => {
      deleteCalls.push({ url, method: options?.method });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const res = await deleteSafeZoneFromFirebase('CARE-TAG-01', 'zone-del-1', 'usr_singla_be23');
    expect(res.ok).toBe(true);
    const deletes = deleteCalls.filter(c => c.method === 'DELETE');
    expect(deletes.length).toBe(4);
    expect(deletes.some(c => c.url.includes('/users/usr_singla_be23/safeZones/zone-del-1.json'))).toBe(true);
    expect(deletes.some(c => c.url.includes('/shared/safeZones/zone-del-1.json'))).toBe(true);
  });

  test('api client creates zone, updates localStorage caches (user + shared), and allows another user to see it', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
    );

    // 1. User 1 (Bhavishya) creates a safe place
    const created = await createGeofence({
      id: 'zone-shared-cache-test',
      label: 'Main Park',
      lat: 30.351,
      lng: 76.413,
      radiusMeters: 450,
    }, 'CARE-TAG-01', 'usr_singla_be23');

    expect(created.label).toBe('Main Park');

    // Check localStorage has it saved under user key and shared key
    const userStorage = JSON.parse(localStorage.getItem('caretag.usr_singla_be23.geofences'));
    const sharedStorage = JSON.parse(localStorage.getItem('caretag.shared.geofences'));

    expect(userStorage).toHaveLength(1);
    expect(userStorage[0].id).toBe('zone-shared-cache-test');
    expect(sharedStorage).toHaveLength(1);
    expect(sharedStorage[0].id).toBe('zone-shared-cache-test');

    // 2. User 2 (Priya) fetches geofences locally without network data
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
    const priyaZones = await fetchGeofences('CARE-TAG-01', 'usr_parent_guardian');

    // Priya immediately sees Bhavishya's safe place from the shared cache
    expect(priyaZones.some(z => z.id === 'zone-shared-cache-test')).toBe(true);
  });
});
