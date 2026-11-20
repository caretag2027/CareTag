/**
 * Simple Dashboard — what the caregiver actually sees.
 * The band is faked: tests push packets in exactly as Firebase would.
 */
import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import SimpleDashboard from './SimpleDashboard';
import alertStore from '../alertStore';
import voiceAlarm from '../voiceAlarm';
import { subscribeHardwareTelemetry } from '../firebase';
import api from '../api';

jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Circle: () => <div data-testid="zone-circle" />,
  Marker: () => <div data-testid="child-marker" />,
  Polyline: () => <div data-testid="trail" />,
  useMap: () => ({ flyTo: jest.fn(), getZoom: () => 16 }),
  useMapEvents: () => null,
}));
jest.mock('leaflet', () => ({ divIcon: () => ({}) }));
jest.mock('../voiceAlarm', () => ({ __esModule: true, default: { trigger: jest.fn() } }));

const HOME = { id: 'home', label: 'Home', centerLatitude: 30.3532, centerLongitude: 76.3713, radiusMeters: 100 };
let mockZones = [HOME];
jest.mock('../api', () => ({
  __esModule: true,
  default: { fetchGeofences: jest.fn(), subscribeSafeZones: jest.fn(), createGeofence: jest.fn(), deleteGeofence: jest.fn() },
}));
jest.mock('../firebase', () => ({ subscribeHardwareTelemetry: jest.fn() }));

// Fake band: tests call sendPacket / sendStatus.
let sendPacket;
let sendStatus;

const session = { userId: 'usr_test', name: 'Test Caregiver', deviceKey: 'CARE-TAG-01' };

/** Packet like parseHardwareTelemetry produces; `meters` east of Home, or no GPS. */
function packet(meters) {
  if (meters == null) return { latitude: 30.349, longitude: 76.41, gps: { valid: false } };
  return {
    latitude: HOME.centerLatitude,
    longitude: HOME.centerLongitude + meters / (111320 * Math.cos((HOME.centerLatitude * Math.PI) / 180)),
    gps: { valid: true },
  };
}

async function renderDashboard() {
  render(<SimpleDashboard session={session} onLogout={jest.fn()} onGoToLanding={jest.fn()} />);
  await screen.findByText('Home'); // safe places loaded
}
const banner = () => screen.getByTestId('status-banner');
const bandOnline = () => act(() => sendStatus({ deviceStatus: 'live', lastVerifiedAt: new Date().toISOString() }));
const bandAt = (m) => act(() => sendPacket(packet(m)));

beforeEach(() => {
  localStorage.clear();
  mockZones = [HOME];
  window.scrollTo = jest.fn();
  // (CRA resets mock implementations before every test, so set them here.)
  api.fetchGeofences.mockImplementation(() => Promise.resolve(mockZones));
  api.subscribeSafeZones.mockImplementation(() => () => {});
  subscribeHardwareTelemetry.mockImplementation((onPacket, onStatus) => {
    sendPacket = onPacket;
    sendStatus = onStatus;
    return () => {};
  });
});

describe('Live band', () => {
  test('band offline → "Band is offline"', async () => {
    await renderDashboard();
    act(() => sendStatus({ deviceStatus: 'offline', lastVerifiedAt: null }));
    expect(banner()).toHaveTextContent('Band is offline');
  });

  test('band online but no GPS → "Waiting for GPS", no alert', async () => {
    await renderDashboard();
    bandOnline();
    bandAt(null);
    expect(banner()).toHaveTextContent('Waiting for GPS');
    expect(alertStore.loadAlerts('usr_test')).toHaveLength(0);
  });

  test('GPS module silent → banner says "GPS module not responding"', async () => {
    await renderDashboard();
    bandOnline();
    act(() => sendPacket({ gps: { valid: false, satellitesReported: 0, chars: 0 } }));
    expect(banner()).toHaveTextContent('GPS module not responding');
  });

  test('searching for satellites → banner shows the count', async () => {
    await renderDashboard();
    bandOnline();
    act(() => sendPacket({ gps: { valid: false, satellitesReported: 2, chars: 4000 } }));
    expect(banner()).toHaveTextContent('Waiting for GPS');
    expect(banner()).toHaveTextContent('2 found, needs 4');
  });

  test('child inside Home → "Safe — inside Home"', async () => {
    await renderDashboard();
    bandOnline();
    bandAt(10);
    expect(banner()).toHaveTextContent('Safe — inside Home');
    expect(screen.getByTestId('child-marker')).toBeInTheDocument();
  });

  test('dummy child walks out of Home → alert banner, alert saved, voice alarm', async () => {
    await renderDashboard();
    bandOnline();
    [0, 50, 90, 150, 250].forEach(bandAt);

    expect(banner()).toHaveTextContent(/Outside safe place — \d+ m from Home/);
    expect(within(screen.getByTestId('alert-list')).getByText(/Left Home/)).toBeInTheDocument();

    const saved = alertStore.loadAlerts('usr_test');
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ nearestGeofence: 'Home', deviceId: 'CARE-TAG-01', source: 'hardware' });
    expect(voiceAlarm.trigger).toHaveBeenCalledWith('boundary_breach', expect.any(Object));
  });

  test('child keeps walking outside → still only ONE alert', async () => {
    await renderDashboard();
    bandOnline();
    [0, 200, 250, 300, 350, 400].forEach(bandAt);
    expect(alertStore.loadAlerts('usr_test').filter((a) => a.category === 'boundary_breach')).toHaveLength(1);
  });

  test('child comes back → banner returns to safe and "Back inside Home" is listed', async () => {
    await renderDashboard();
    bandOnline();
    [0, 250, 0].forEach(bandAt);
    expect(banner()).toHaveTextContent('Safe — inside Home');
    expect(screen.getByText(/Back inside Home/)).toBeInTheDocument();
  });

  test('"Mark alerts as seen" clears the unread badge', async () => {
    await renderDashboard();
    bandOnline();
    [0, 250].forEach(bandAt);
    fireEvent.click(screen.getByRole('button', { name: /Mark alerts as seen/i }));
    expect(screen.queryByRole('button', { name: /Mark alerts as seen/i })).not.toBeInTheDocument();
    expect(alertStore.getUnacknowledgedCount('usr_test')).toBe(0);
  });

  test('no safe places → asks to add one', async () => {
    mockZones = [];
    render(<SimpleDashboard session={session} onLogout={jest.fn()} onGoToLanding={jest.fn()} />);
    expect(await screen.findByText('Add a safe place to start')).toBeInTheDocument();
  });
});

describe('Demo buttons', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const playDemo = (label) => {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(label, 'i') }));
    for (let i = 0; i < 20; i++) act(() => jest.advanceTimersByTime(1000));
  };

  test('"Child leaves safe place" → demo alert shown, real history untouched', async () => {
    await renderDashboard();
    playDemo('Child leaves safe place');
    expect(screen.getByText(/Demo mode/)).toBeInTheDocument();
    expect(banner()).toHaveTextContent(/Outside safe place/);
    expect(screen.getByText(/Left Home/)).toBeInTheDocument();
    expect(screen.getByText('demo')).toBeInTheDocument();
    expect(alertStore.loadAlerts('usr_test')).toHaveLength(0);
  });

  test('"Child stays inside" → stays safe, no alert', async () => {
    await renderDashboard();
    playDemo('Child stays inside');
    expect(banner()).toHaveTextContent('Safe — inside Home');
    expect(screen.queryByTestId('alert-list')).not.toBeInTheDocument();
  });

  test('"Child leaves, then comes back" → alert then back-safe', async () => {
    await renderDashboard();
    playDemo('Child leaves, then comes back');
    expect(screen.getByText(/Left Home/)).toBeInTheDocument();
    expect(screen.getByText(/Back inside Home/)).toBeInTheDocument();
    expect(banner()).toHaveTextContent('Safe — inside Home');
  });

  test('"Band loses GPS signal" → no false alert', async () => {
    await renderDashboard();
    playDemo('Band loses GPS signal');
    expect(screen.queryByText(/Left Home/)).not.toBeInTheDocument();
  });

  test('"Stop demo" goes back to the live band', async () => {
    await renderDashboard();
    playDemo('Child leaves safe place');
    fireEvent.click(screen.getByRole('button', { name: /Stop demo/i }));
    expect(screen.queryByText(/Demo mode/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Left Home/)).not.toBeInTheDocument();
  });
});

test('subscribes to the selected band in Firebase', async () => {
  await renderDashboard();
  expect(subscribeHardwareTelemetry).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), { deviceKey: 'CARE-TAG-01' });
});
