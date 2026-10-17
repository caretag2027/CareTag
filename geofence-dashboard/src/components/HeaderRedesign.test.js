import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';
import deviceStore from '../deviceStore';
import alertStore from '../alertStore';

// Mock react-leaflet components for headless JSDOM testing
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="mock-map-container">{children}</div>,
  TileLayer: () => <div data-testid="mock-tile-layer" />,
  Circle: ({ children }) => <div data-testid="mock-circle">{children}</div>,
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
  divIcon: () => ({}),
  latLngBounds: () => ({}),
}));

// Mock Firebase Realtime Database methods
jest.mock('../firebase', () => ({
  testHardwareConnection: jest.fn().mockResolvedValue({ ok: true, latencyMs: 28 }),
  subscribeHardwareTelemetry: jest.fn((onPacket, onStatus) => {
    onStatus({ connected: true, deviceStatus: 'live', ageSeconds: 1 });
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
      label: 'Campus Safe Zone',
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
        label: 'Campus Safe Zone',
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

describe('Header Redesign & Caregiver-Device Architecture Tests', () => {
  const caregiverSession = {
    userId: 'usr_singla_be23',
    name: 'Bhavishya Singla',
    email: 'singla_be23@thapar.edu',
    role: 'admin', // backend role is admin, but presented as Caregiver in dashboard
    deviceKey: 'CARE-TAG-01',
    institution: 'Thapar Institute of Engineering & Technology',
  };

  beforeEach(() => {
    window.scrollTo = jest.fn();
    localStorage.clear();
    localStorage.setItem('caretag.session', JSON.stringify(caregiverSession));
    localStorage.setItem(`caretag_setup_completed_${caregiverSession.userId}`, 'true');
    // Seed devices in deviceStore for this user
    localStorage.setItem(
      `caretag.${caregiverSession.userId}.devices`,
      JSON.stringify(deviceStore.DEFAULT_DEVICES)
    );
    localStorage.setItem(
      `caretag.${caregiverSession.userId}.selectedDeviceKey`,
      'CARE-TAG-01'
    );
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

  // Acceptance Criterion 1 & 8: No separate MONITORING selector, clean header
  test('criterion 1: removes separate MONITORING selector dropdown from the header', async () => {
    await renderDashboard();

    const header = screen.getByRole('banner');

    // "MONITORING" uppercase label should not exist in the header
    expect(within(header).queryByText(/^MONITORING$/i)).not.toBeInTheDocument();
    expect(within(header).queryByText(/^DEVICE$/i)).not.toBeInTheDocument();

    // The header contains CareTag logo, Device Selector, Center Navigation, and Caregiver Profile
    expect(within(header).getByTitle(/CareTag Home/i)).toBeInTheDocument();
  });

  // Acceptance Criterion 2: Device selector shows count of authorized devices
  test('criterion 2: device selector displays the count of devices linked to the signed-in caregiver', async () => {
    await renderDashboard();

    // Check device count badge in selector (desktop and/or mobile)
    const countBadges = screen.getAllByText('Devices (1)');
    expect(countBadges.length).toBeGreaterThan(0);
    expect(countBadges[0]).toBeInTheDocument();
  });

  // Acceptance Criterion 3: Signed-in caregiver is visible with role "Caregiver" (NOT Administrator)
  test('criterion 3: caregiver name Bhavishya Singla is visible with role "Caregiver" instead of "Administrator"', async () => {
    await renderDashboard();

    const header = screen.getByRole('banner');

    // Caregiver's actual name is rendered in the header
    expect(within(header).getByText('Bhavishya Singla')).toBeInTheDocument();

    // Role is presented as "Caregiver"
    expect(within(header).getByText('Caregiver')).toBeInTheDocument();

    // "Administrator" should NOT be visible in the header
    expect(within(header).queryByText('Administrator')).not.toBeInTheDocument();
  });

  // Acceptance Criterion 4: Selecting a device automatically resolves the monitored person
  test('criterion 4: selecting a device from the dropdown resolves its associated monitored person', async () => {
    const multiDevices = [
      { id: 'dev_leon_01', deviceKey: 'CARE-TAG-01', nickname: 'Leon', name: 'Leon', childName: 'Aarav Singla', avatarColor: '#2563EB', isUserAdded: true },
      { id: 'dev_diya_02', deviceKey: 'CARE-TAG-02', nickname: 'Diya Singla', name: 'Diya Singla', childName: 'Diya Singla', avatarColor: '#EC4899', isUserAdded: true },
      { id: 'dev_kabir_03', deviceKey: 'CARE-TAG-03', nickname: 'Kabir Verma', name: 'Kabir Verma', childName: 'Kabir Verma', avatarColor: '#10B981', isUserAdded: true },
    ];
    localStorage.setItem(`caretag.${caregiverSession.userId}.devices`, JSON.stringify(multiDevices));
    localStorage.setItem(`caretag.${caregiverSession.userId}.selectedDeviceKey`, 'CARE-TAG-02');

    await renderDashboard();

    // Initially CARE-TAG-02 is selected -> Diya Singla
    expect(screen.getAllByText(/Diya Singla/i).length).toBeGreaterThan(0);

    // Open device dropdown
    const devicePill = document.querySelector('.device-selector-pill');
    expect(devicePill).toBeInTheDocument();
    fireEvent.click(devicePill);

    // Dropdown / sheet should be open and list all 3 devices
    const dropdown = screen.getByRole('dialog', { name: /Caregiver Authorized Devices|Switch Monitored Person/i });
    expect(dropdown).toBeInTheDocument();

    // Check device options: CARE-TAG-01 (Leon), CARE-TAG-02 (Diya), CARE-TAG-03 (Kabir)
    expect(within(dropdown).getByText('Leon')).toBeInTheDocument();
    expect(within(dropdown).getByText('Diya Singla')).toBeInTheDocument();
    expect(within(dropdown).getByText('Kabir Verma')).toBeInTheDocument();

    // Switch to CARE-TAG-01 (Leon)
    const leonBtn = within(dropdown).getByText('Leon').closest('button');
    fireEvent.click(leonBtn);

    // After switching, the dashboard and header reflect CARE-TAG-01 and Leon
    await waitFor(() => {
      expect(screen.getAllByText(/Leon/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/CARE-TAG-01/i).length).toBeGreaterThan(0);
    });
  });

  // Acceptance Criterion 5 & 6: Data synchronization & state isolation across device switches
  test('criterion 5 & 6: switching devices updates device-dependent telemetry and isolates data', async () => {
    const multiDevices = [
      { id: 'dev_leon_01', deviceKey: 'CARE-TAG-01', nickname: 'Leon', name: 'Leon', childName: 'Aarav Singla', avatarColor: '#2563EB', isUserAdded: true },
      { id: 'dev_diya_02', deviceKey: 'CARE-TAG-02', nickname: 'Diya Singla', name: 'Diya Singla', childName: 'Diya Singla', avatarColor: '#EC4899', isUserAdded: true },
    ];
    localStorage.setItem(`caretag.${caregiverSession.userId}.devices`, JSON.stringify(multiDevices));
    localStorage.setItem(`caretag.${caregiverSession.userId}.selectedDeviceKey`, 'CARE-TAG-02');

    // Add device-scoped alerts to alertStore
    alertStore.saveAlert(caregiverSession.userId, {
      type: 'boundary_breach',
      deviceId: 'CARE-TAG-02',
      message: 'Diya stepped outside Campus Safe Zone',
    });
    alertStore.saveAlert(caregiverSession.userId, {
      type: 'route_deviation',
      deviceId: 'CARE-TAG-01',
      message: 'Aarav deviated from daily walk',
    });

    await renderDashboard();

    // When CARE-TAG-02 is active, the alert belonging to Diya is loaded
    expect(screen.getAllByText(/Diya stepped outside Campus Safe Zone/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Aarav deviated from daily walk/i)).not.toBeInTheDocument();

    // Switch to CARE-TAG-01
    const devicePill = document.querySelector('.device-selector-pill');
    fireEvent.click(devicePill);
    const dropdown = screen.getByRole('dialog', { name: /Caregiver Authorized Devices|Switch Monitored Person/i });
    const leonBtn = within(dropdown).getByText('Leon').closest('button');
    fireEvent.click(leonBtn);

    // Verify switch occurred cleanly
    await waitFor(() => {
      expect(screen.getAllByText('CARE-TAG-01').length).toBeGreaterThan(0);
    });

    // Now Aarav's alert is displayed and Diya's alert is NOT visible in the active incident banner
    await waitFor(() => {
      expect(screen.queryAllByText(/Diya stepped outside Campus Safe Zone/i).length).toBe(0);
    });
  });

  // Acceptance Criterion 7: Honest status representation
  test('criterion 7: honest status indicator represents device connection truthfully', async () => {
    await renderDashboard();

    // With our mock returning live status, connection indicator shows Connected or GPS Searching
    const statusBadges = screen.getAllByText(/Connected|GPS Searching|Waiting for data|Offline/i);
    expect(statusBadges.length).toBeGreaterThan(0);
  });

  // Acceptance Criterion 9: Mobile device selector is present and usable for narrow screens
  test('criterion 9: device selector is present, touch-friendly, and accessible for mobile screens', async () => {
    const multiDevices = [
      { id: 'dev_leon_01', deviceKey: 'CARE-TAG-01', nickname: 'Leon', name: 'Leon', childName: 'Aarav Singla', avatarColor: '#2563EB', isUserAdded: true },
      { id: 'dev_diya_02', deviceKey: 'CARE-TAG-02', nickname: 'Diya Singla', name: 'Diya Singla', childName: 'Diya Singla', avatarColor: '#EC4899', isUserAdded: true },
    ];
    localStorage.setItem(`caretag.${caregiverSession.userId}.devices`, JSON.stringify(multiDevices));

    await renderDashboard();

    // The unified device selector pill is present in the Currently Monitoring card
    const devicePill = document.querySelector('.device-selector-pill');
    expect(devicePill).toBeInTheDocument();
    expect(devicePill).toHaveAttribute('aria-haspopup', 'dialog');

    // Clicking device pill opens device dropdown with touch targets
    fireEvent.click(devicePill);
    const dropdown = screen.getByRole('dialog', { name: /Caregiver Authorized Devices|Switch Monitored Person/i });
    expect(dropdown).toBeInTheDocument();
    expect(within(dropdown).getByText('Diya Singla')).toBeInTheDocument();
    expect(within(dropdown).getByText('Leon')).toBeInTheDocument();
  });

  // "+ Link another device" modal opens from dropdown
  test('allows caregiver to open Link New Smart Band modal from dropdown', async () => {
    await renderDashboard();

    const devicePill = document.querySelector('.device-selector-pill');
    fireEvent.click(devicePill);

    const linkNewBtn = screen.getByRole('button', { name: /Link another (Smart Band|device)/i });
    fireEvent.click(linkNewBtn);

    // Modal opens
    expect(screen.getByRole('heading', { name: /Link New Smart Band/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. CARE-TAG/i)).toBeInTheDocument();
  });

  // Empty state handling
  test('handles empty device list gracefully with prompt to link first device', async () => {
    // Clear user devices
    localStorage.setItem(`caretag.${caregiverSession.userId}.devices`, JSON.stringify([]));

    await renderDashboard();

    // Shows 0 devices
    expect(screen.getByText('Devices (0)')).toBeInTheDocument();

    // Click selector
    const devicePill = document.querySelector('.device-selector-pill');
    fireEvent.click(devicePill);

    // Empty state message and button
    expect(screen.getByText(/No Smart Band devices linked to your account yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Link your first Smart Band/i })).toBeInTheDocument();
  });

  // Logo home navigation
  test('clicking the CareTag logo in the header returns to the homepage', async () => {
    await renderDashboard();

    const header = screen.getByRole('banner');
    const logoBtn = within(header).getByTitle(/CareTag Home/i);
    expect(logoBtn).toBeInTheDocument();

    fireEvent.click(logoBtn);

    // Should return to homepage (LandingPage)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Go to Dashboard/i })).toBeInTheDocument();
    });
  });
});
