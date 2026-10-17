import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';
import deviceStore from '../deviceStore';

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

describe('CareTag — Dashboard Visual Polish, Responsive Layout & Dialog Refinement', () => {
  const caregiverSession = {
    userId: 'usr_singla_be23',
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

  test('1. Desktop composition: Top of right panel displays device identity card aligned with map', async () => {
    await renderDashboard();

    // Map pane exists and contains aria-label
    const mapPane = screen.getByLabelText(/Live Geofence Map/i);
    expect(mapPane).toBeInTheDocument();

    // Content pane exists
    const contentPane = screen.getByLabelText(/Dashboard Views/i);
    expect(contentPane).toBeInTheDocument();

    // First card inside content pane is the "Currently monitoring" device identity card
    const currentlyMonitoringSection = screen.getByLabelText(/Currently monitoring/i);
    expect(currentlyMonitoringSection).toBeInTheDocument();
    expect(within(currentlyMonitoringSection).getByText(/Currently monitoring/i)).toBeInTheDocument();
    expect(within(currentlyMonitoringSection).getByText('Leon')).toBeInTheDocument();
    expect(within(currentlyMonitoringSection).getByText(/Caregiver:/i)).toBeInTheDocument();
    expect(within(currentlyMonitoringSection).getByText('Bhavishya Singla')).toBeInTheDocument();
  });

  test('2. Card headers: Today\'s Movement and Configured Safe Places render full text without clipping', async () => {
    await renderDashboard();

    // Verify Movement card heading
    expect(screen.getByRole('heading', { level: 4, name: /Today's Movement/i })).toBeInTheDocument();
    expect(screen.getByText(/Today's Timeline/i)).toBeInTheDocument();

    // Verify Safe Places card heading
    expect(screen.getByRole('heading', { level: 4, name: /Configured Safe Places/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Manage Places/i })).toBeInTheDocument();
  });

  test('3. Rename Device Dialog: opens with backdrop, read-only hardware ID and nickname input', async () => {
    await renderDashboard();

    // Click Rename button on device card
    const renameBtn = screen.getByRole('button', { name: /Rename device/i });
    fireEvent.click(renameBtn);

    // Modal dialog is present
    const dialog = screen.getByRole('dialog', { name: /Rename Device/i });
    expect(dialog).toBeInTheDocument();

    // Read-only hardware ID
    expect(within(dialog).getByText('CARE-TAG-01')).toBeInTheDocument();
    expect(within(dialog).getByText(/Immutable hardware ID/i)).toBeInTheDocument();

    // Nickname input populated with Leon
    const input = within(dialog).getByLabelText(/Device Nickname/i);
    expect(input.value).toBe('Leon');

    // Action buttons
    expect(within(dialog).getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Save Nickname/i })).toBeInTheDocument();

    // Close dialog
    fireEvent.click(within(dialog).getByRole('button', { name: /Close dialog/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Rename Device/i })).not.toBeInTheDocument();
    });
  });

  test('4. Device Switcher / Manage Dialog: opens with authorized device card and link button', async () => {
    await renderDashboard();

    // Click Manage device pill
    const manageBtn = screen.getByTitle(/Manage authorized Smart Band/i);
    fireEvent.click(manageBtn);

    // Modal dialog opens
    const dialog = screen.getByRole('dialog', { name: /Caregiver Authorized Devices/i });
    expect(dialog).toBeInTheDocument();

    // Displays caregiver name and 1 registered
    expect(within(dialog).getByText(/Caregiver account:/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Bhavishya Singla/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/\(1 registered\)/i)).toBeInTheDocument();

    // Single device card displays Leon, CARE-TAG-01, and active badge
    expect(within(dialog).getByText('Leon')).toBeInTheDocument();
    expect(within(dialog).getByText('CARE-TAG-01')).toBeInTheDocument();
    expect(within(dialog).getByText('Active')).toBeInTheDocument();

    // Action buttons inside card
    expect(within(dialog).getByRole('button', { name: /Rename device/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Link another Smart Band/i })).toBeInTheDocument();

    // Close dialog
    fireEvent.click(within(dialog).getByRole('button', { name: /Close dialog/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Caregiver Authorized Devices/i })).not.toBeInTheDocument();
    });
  });

  test('5. Scroll resets: Window and content pane reset scroll on view enter and tab switches', async () => {
    await renderDashboard();

    // Verify window.scrollTo was called on entering dashboard
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);

    // Switch tab to Safe Places
    const safePlacesTab = within(screen.getByRole('banner')).getByRole('button', { name: /^Safe Places/i });
    fireEvent.click(safePlacesTab);

    // Verify window.scrollTo was called on tab switch
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });
});
