import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';
import deviceStore, { DEFAULT_DEVICES, DEVICE_PALETTE, loadUserDevices, updateDeviceNickname, linkNewDevice } from '../deviceStore';

// Mock react-leaflet components for headless JSDOM testing
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="mock-map-container">{children}</div>,
  TileLayer: () => <div data-testid="mock-tile-layer" />,
  Circle: ({ children, pathOptions }) => (
    <div data-testid="mock-circle" data-color={pathOptions?.color}>
      {children}
    </div>
  ),
  Popup: ({ children }) => <div data-testid="mock-popup">{children}</div>,
  Marker: ({ children }) => <div data-testid="mock-marker">{children}</div>,
  Polyline: () => <div data-testid="mock-polyline" />,
  useMap: () => ({
    setView: jest.fn(),
    flyTo: jest.fn(),
    invalidateSize: jest.fn(),
    getContainer: () => (typeof global !== 'undefined' && global.document ? global.document.createElement('div') : null),
  }),
  useMapEvents: () => null,
}));

jest.mock('leaflet', () => ({
  divIcon: (opts) => opts,
  latLngBounds: () => ({}),
}));

// Mock Firebase Realtime Database methods
jest.mock('../firebase', () => ({
  testHardwareConnection: jest.fn().mockResolvedValue({ ok: true, latencyMs: 28 }),
  subscribeHardwareTelemetry: jest.fn((onPacket, onStatus) => {
    onStatus({ connected: false, deviceStatus: 'offline', ageSeconds: 120 });
    return jest.fn();
  }),
  saveRoutineObservationToFirebase: jest.fn().mockResolvedValue(true),
  fetchRoutineHistoryFromFirebase: jest.fn().mockResolvedValue({}),
  fetchRoutineProfileFromFirebase: jest.fn().mockResolvedValue({ hasSufficientHistory: false }),
}));

// Mock API service for geofences
jest.mock('../api', () => ({
  fetchGeofences: jest.fn().mockResolvedValue([
    {
      id: 'geo-1',
      label: "Parent's Workplace",
      centerLatitude: 30.3491,
      centerLongitude: 76.4117,
      radiusMeters: 400,
      enabled: true,
      schedule: { mode: 'all_day' },
    },
  ]),
  subscribeSafeZones: jest.fn((deviceKey, userId, cb) => {
    cb([
      {
        id: 'geo-1',
        label: "Parent's Workplace",
        centerLatitude: 30.3491,
        centerLongitude: 76.4117,
        radiusMeters: 400,
        enabled: true,
        schedule: { mode: 'all_day' },
      },
    ]);
    return jest.fn();
  }),
  saveGeofence: jest.fn().mockResolvedValue({ ok: true }),
  updateGeofence: jest.fn().mockResolvedValue({ ok: true }),
  deleteGeofence: jest.fn().mockResolvedValue({ ok: true }),
}));

describe('CareTag — Real Device Setup, Device Nicknames, and Multi-Device Architecture', () => {
  const caregiverSession = {
    userId: 'usr_caregiver_real',
    name: 'Bhavishya Singla',
    email: 'singla_be23@thapar.edu',
    role: 'caregiver',
    deviceKey: 'CARE-TAG-01',
    institution: 'Thapar Institute of Engineering & Technology',
  };

  beforeEach(() => {
    window.scrollTo = jest.fn();
    localStorage.clear();
    localStorage.setItem('caretag.session', JSON.stringify(caregiverSession));
    localStorage.setItem(`caretag_setup_completed_${caregiverSession.userId}`, 'true');
  });

  afterEach(() => {
    localStorage.clear();
  });

  async function renderDashboard() {
    render(<App />);
    const launchBtn = await screen.findByRole('button', { name: /Go to Dashboard/i });
    fireEvent.click(launchBtn);
    await waitFor(() => {
      expect(screen.getByRole('banner')).toBeInTheDocument();
    });
  }

  // 1. Device Registry: Exactly one real hardware device by default
  test('criterion 1 & 2: DEFAULT_DEVICES contains only the real hardware device CARE-TAG-01 with nickname CareTag 1', () => {
    expect(DEFAULT_DEVICES).toHaveLength(1);
    expect(DEFAULT_DEVICES[0].deviceKey).toBe('CARE-TAG-01');
    expect(['CareTag 1', 'Leon']).toContain(DEFAULT_DEVICES[0].nickname);
    expect(DEFAULT_DEVICES[0].hardwareModel).toContain('ESP32');
  });

  test('criterion 1: loadUserDevices purges legacy demo fixtures (Diya/Kabir) from existing localStorage', () => {
    const legacyStorageWithDemo = [
      { id: 'dev_aarav_01', deviceKey: 'CARE-TAG-01', childName: 'Aarav Singla', nickname: 'Leon' },
      { id: 'dev_diya_02', deviceKey: 'CARE-TAG-02', childName: 'Diya Singla' },
      { id: 'dev_kabir_03', deviceKey: 'CARE-TAG-03', childName: 'Kabir Verma' },
    ];
    localStorage.setItem(`caretag.${caregiverSession.userId}.devices`, JSON.stringify(legacyStorageWithDemo));

    const cleaned = loadUserDevices(caregiverSession.userId);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0].deviceKey).toBe('CARE-TAG-01');
    expect(['CareTag 1', 'Leon']).toContain(cleaned[0].nickname);
  });

  // 2. Display Devices (1) and Nickname in Dashboard
  test('criterion 2, 3 & 4: Dashboard displays Devices (1), nickname, hardware ID, and no child name label', async () => {
    await renderDashboard();

    // Verify "Devices (1)" appears in header & overview
    const deviceCountBadges = screen.getAllByText(/Devices \(1\)/i);
    expect(deviceCountBadges.length).toBeGreaterThanOrEqual(1);

    // Verify "CareTag 1" (or "Leon") appears as the monitored device name
    const heading = screen.getByRole('heading', { level: 2, name: /CareTag 1|Leon/i });
    expect(heading).toBeInTheDocument();

    // Verify real hardware identifier is visible
    expect(screen.getAllByText('CARE-TAG-01').length).toBeGreaterThanOrEqual(1);
    // Unnecessary hardware model is removed from primary card (moved to diagnostics / device management)
    const monitoringCard = screen.getByLabelText(/Currently monitoring/i);
    expect(within(monitoringCard).queryByText(/ESP32-WROOM-32U \+ NEO-6M/i)).not.toBeInTheDocument();

    // Verify child-centric labels are removed from primary card
    expect(screen.queryByText('Child Aarav')).not.toBeInTheDocument();
    expect(screen.queryByText('Diya Singla')).not.toBeInTheDocument();
    expect(screen.queryByText('Kabir Verma')).not.toBeInTheDocument();
  });

  // 3. Rename Device Functionality
  test('criterion 5: Caregiver can rename device nickname and it persists across refresh', async () => {
    await renderDashboard();

    // Click "Rename" button next to device nickname
    const renameBtn = screen.getByRole('button', { name: /Rename device/i });
    fireEvent.click(renameBtn);

    // Modal opens with read-only hardware ID
    const renameModal = screen.getByRole('dialog');
    expect(within(renameModal).getByText('CARE-TAG-01')).toBeInTheDocument();
    expect(within(renameModal).getByText(/Immutable hardware ID/i)).toBeInTheDocument();

    const input = within(renameModal).getByLabelText(/Device Nickname/i);
    expect(['CareTag 1', 'Leon']).toContain(input.value);

    // Change nickname to "Leon Rover"
    fireEvent.change(input, { target: { value: 'Leon Rover' } });
    const saveBtn = within(renameModal).getByRole('button', { name: /Save Nickname/i });
    fireEvent.click(saveBtn);

    // Verify updated on the screen
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Leon Rover' })).toBeInTheDocument();
    });

    // Check persistence in localStorage
    const savedDevices = loadUserDevices(caregiverSession.userId);
    expect(savedDevices[0].nickname).toBe('Leon Rover');
    expect(savedDevices[0].deviceKey).toBe('CARE-TAG-01'); // immutable
  });

  // 4. Rename validation prevents empty names
  test('criterion 5: Rename validation rejects empty nickname', () => {
    const res = updateDeviceNickname(caregiverSession.userId, 'CARE-TAG-01', '   ');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/cannot be empty/i);
  });

  // 5. Add Another Smart Band Workflow
  test('criterion 6 & 7: Caregiver can link a real second Smart Band and update device list to Devices (2)', async () => {
    await renderDashboard();

    // Open device management
    const manageBtn = screen.getByTitle(/Manage authorized Smart Band/i);
    fireEvent.click(manageBtn);

    // Click "Link another Smart Band" in the single-device card
    const linkAnotherBtn = screen.getByRole('button', { name: /Link another Smart Band/i });
    fireEvent.click(linkAnotherBtn);

    // Modal opens
    expect(screen.getByRole('heading', { name: /Link (?:another|New) Smart Band/i })).toBeInTheDocument();

    // Fill in new device key and nickname
    const keyInput = screen.getByPlaceholderText(/e\.g\. CARE-TAG-02/i);
    const nickInput = screen.getByPlaceholderText(/e\.g\. (?:CareTag 2|Secondary Band)/i);

    fireEvent.change(keyInput, { target: { value: 'CARE-TAG-02' } });
    fireEvent.change(nickInput, { target: { value: 'Secondary Band' } });

    const submitBtn = screen.getByRole('button', { name: /Link (?:device|& Activate Device)/i });
    fireEvent.click(submitBtn);

    // Verify Devices (2) now appears
    await waitFor(() => {
      expect(screen.getAllByText(/Devices \(2\)/i).length).toBeGreaterThanOrEqual(1);
    });

    // Check localStorage has both devices with consistent palette
    const userDevices = loadUserDevices(caregiverSession.userId);
    expect(userDevices).toHaveLength(2);
    expect(userDevices[0].deviceKey).toBe('CARE-TAG-01');
    expect(userDevices[0].avatarColor).toBe(DEVICE_PALETTE[0]);
    expect(userDevices[1].deviceKey).toBe('CARE-TAG-02');
    expect(userDevices[1].nickname).toBe('Secondary Band');
    expect(userDevices[1].avatarColor).toBe(DEVICE_PALETTE[1]);
  });

  // 6. Duplicate Device Key Prevention
  test('criterion 6: Linking rejects duplicate device keys', () => {
    const res = linkNewDevice(caregiverSession.userId, {
      deviceKey: 'CARE-TAG-01', // Already exists
      nickname: 'Duplicate Tag',
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/already linked/i);
  });

  // 7. Battery Honesty: Offline device does not show fake battery
  test('criterion 8 & 11: Offline device shows honest waiting for battery status instead of fake percentage', async () => {
    await renderDashboard();

    // The battery bento card should display honest state
    const batteryText = screen.getByText(/Waiting for battery data/i);
    expect(batteryText).toBeInTheDocument();
  });
});
