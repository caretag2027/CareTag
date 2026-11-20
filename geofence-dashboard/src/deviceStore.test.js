/**
 * Device list tests (moved from the old dashboard UI tests).
 */
import { DEFAULT_DEVICES, loadUserDevices, updateDeviceNickname, linkNewDevice } from './deviceStore';

const userId = 'usr_test';

beforeEach(() => localStorage.clear());

test('default device list contains only the real band CARE-TAG-01', () => {
  expect(DEFAULT_DEVICES).toHaveLength(1);
  expect(DEFAULT_DEVICES[0].deviceKey).toBe('CARE-TAG-01');
  expect(['CareTag 1', 'Leon']).toContain(DEFAULT_DEVICES[0].nickname);
  expect(DEFAULT_DEVICES[0].hardwareModel).toContain('ESP32');
});

test('loadUserDevices removes old demo devices from storage', () => {
  localStorage.setItem(`caretag.${userId}.devices`, JSON.stringify([
    { id: 'dev_aarav_01', deviceKey: 'CARE-TAG-01', childName: 'Aarav Singla', nickname: 'Leon' },
    { id: 'dev_diya_02', deviceKey: 'CARE-TAG-02', childName: 'Diya Singla' },
    { id: 'dev_kabir_03', deviceKey: 'CARE-TAG-03', childName: 'Kabir Verma' },
  ]));
  const cleaned = loadUserDevices(userId);
  expect(cleaned).toHaveLength(1);
  expect(cleaned[0].deviceKey).toBe('CARE-TAG-01');
});

test('renaming to an empty name is rejected', () => {
  const res = updateDeviceNickname(userId, 'CARE-TAG-01', '   ');
  expect(res.ok).toBe(false);
  expect(res.error).toMatch(/cannot be empty/i);
});

test('linking the same band twice is rejected', () => {
  const res = linkNewDevice(userId, { deviceKey: 'CARE-TAG-01', nickname: 'Duplicate Tag' });
  expect(res.ok).toBe(false);
  expect(res.error).toMatch(/already linked/i);
});
