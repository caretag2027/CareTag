import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import fs from 'fs';
import path from 'path';
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
  fetchGeofences: jest.fn().mockResolvedValue([]),
  subscribeSafeZones: jest.fn((deviceKey, userId, cb) => {
    cb([]);
    return jest.fn();
  }),
  saveGeofence: jest.fn().mockResolvedValue({ ok: true }),
  updateGeofence: jest.fn().mockResolvedValue({ ok: true }),
  deleteGeofence: jest.fn().mockResolvedValue({ ok: true }),
}));

describe('CareTag — Map Zoom Controls Placement & Floating Toolbar Non-Overlap', () => {
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

  test('renders the map pane with floating action toolbar and device filter group', async () => {
    await renderDashboard();

    // Wait for the map pane
    const mapPane = screen.getByLabelText(/Live Geofence Map/i);
    expect(mapPane).toBeInTheDocument();

    // Map controls toolbar should exist
    const toolbar = screen.getByRole('toolbar', { name: /Map Controls/i });
    expect(toolbar).toBeInTheDocument();
    expect(toolbar).toHaveClass('map-floating-toolbar');

    // Device map filter group should exist inside the toolbar
    const filterGroup = within(toolbar).getByRole('group', { name: /Device Map Filter/i });
    expect(filterGroup).toBeInTheDocument();
    expect(filterGroup).toHaveClass('map-view-filter-group');

    // Verify filter buttons inside toolbar
    expect(within(toolbar).getByRole('button', { name: /CareTag 1|Leon/i })).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: /All Devices/i })).toBeInTheDocument();

    // Verify map action buttons inside toolbar
    expect(within(toolbar).getByRole('button', { name: /Recenter/i })).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: /Safe Places/i })).toBeInTheDocument();
  });

  test('CSS verifies Leaflet zoom control is offset cleanly beneath floating toolbar to prevent overlap', () => {
    const cssPath = path.resolve(__dirname, '../index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Verify .caretag-map-pane .leaflet-top.leaflet-left has sufficient top clearance (76px or greater)
    const zoomPositionMatch = cssContent.match(/\.caretag-map-pane\s+\.leaflet-top\.leaflet-left\s*\{([^}]+)\}/);
    expect(zoomPositionMatch).toBeTruthy();
    const zoomPositionRules = zoomPositionMatch[1];
    expect(zoomPositionRules).toMatch(/top:\s*(?:7[6-9]|[89]\d|1\d\d)px/);

    // Verify .map-view-filter-group is configured as inline-flex to keep device filters on a single row
    const filterGroupMatch = cssContent.match(/\.map-view-filter-group\s*\{([^}]+)\}/);
    expect(filterGroupMatch).toBeTruthy();
    const filterGroupRules = filterGroupMatch[1];
    expect(filterGroupRules).toContain('display: inline-flex');
    expect(filterGroupRules).toContain('align-items: center');

    // Verify .map-floating-toolbar has flex-wrap: nowrap to prevent multi-row wrapping that causes vertical collision
    const toolbarMatch = cssContent.match(/\.map-floating-toolbar\s*\{([^}]+)\}/);
    expect(toolbarMatch).toBeTruthy();
    const toolbarRules = toolbarMatch[1];
    expect(toolbarRules).toContain('flex-wrap: nowrap');
  });
});
