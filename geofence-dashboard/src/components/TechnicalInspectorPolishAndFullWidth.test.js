import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TechnicalInspector from './TechnicalInspector';

// Mock Firebase diagnostics probe
jest.mock('../firebase', () => ({
  diagnoseFirebaseOperations: jest.fn().mockResolvedValue({
    totalDurationMs: 140,
    timestamp: new Date().toISOString(),
    results: {
      readTelemetry: { ok: true, latencyMs: 28, status: 'Healthy' },
      readSafeZones: { ok: true, latencyMs: 32, status: 'Healthy' },
      createSafeZone: { ok: true, latencyMs: 35, status: 'Healthy' },
      editSafeZone: { ok: true, latencyMs: 25, status: 'Healthy' },
      deleteSafeZone: { ok: true, latencyMs: 22, status: 'Healthy' },
      persistRoutineHistory: { ok: true, latencyMs: 30, status: 'Healthy' },
      loadRoutineProfile: { ok: true, latencyMs: 24, status: 'Healthy' },
      saveAlerts: { ok: true, latencyMs: 26, status: 'Healthy' },
    }
  }),
}));

describe('CareTag System Inspector — Premium Layout, UX Refinement & Full-Width Workspace', () => {
  const mockPacket = {
    latitude: 30.3491,
    longitude: 76.4117,
    batteryPercent: 92,
    timestamp: '2026-10-17T01:00:00.000Z',
    capturedAtUtc: '2026-10-17T01:00:00.000Z',
    speedKph: 2.5,
    motionState: 'stationary',
    deviceKey: 'CARE-TAG-01',
    gps: { valid: true, satellites: 8 },
    isHardware: true,
  };

  const mockGeofences = [
    {
      id: 'zone-1',
      label: "Parent's Workplace",
      centerLatitude: 30.3491,
      centerLongitude: 76.4117,
      radiusMeters: 450,
      enabled: true,
      schedule: { mode: 'all_day' }
    }
  ];

  const mockActiveProfile = {
    deviceKey: 'CARE-TAG-01',
    nickname: 'Leon',
    relation: 'Primary Monitored Band',
  };

  test('1. Inspector Header: Page identity, navigation, and essential actions are clean and well-structured', () => {
    const handleClose = jest.fn();

    render(
      <TechnicalInspector
        packet={mockPacket}
        geofences={mockGeofences}
        hardwareStatus={{ connected: false, deviceStatus: 'offline', lastVerifiedAt: '2026-10-17T01:00:00.000Z' }}
        simRunning={false}
        selectedDeviceKey="CARE-TAG-01"
        activeProfile={mockActiveProfile}
        caregiverName="Bhavishya Singla"
        onClose={handleClose}
      />
    );

    // Row A: Page Identity
    expect(screen.getByRole('button', { name: /Back to Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /System Inspector/i })).toBeInTheDocument();
    expect(screen.getByText(/Device health, location diagnostics and safety verification/i)).toBeInTheDocument();

    // Row B: Essential Actions
    expect(screen.getByRole('button', { name: /Copy JSON/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retest/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Exit Inspector/i })).toBeInTheDocument();

    // Test Exit button triggers onClose
    fireEvent.click(screen.getByRole('button', { name: /Exit Inspector/i }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  test('2. Inspector Context Row: Explicitly separates operating mode from connection status (never green when offline)', () => {
    render(
      <TechnicalInspector
        packet={mockPacket}
        geofences={mockGeofences}
        hardwareStatus={{ connected: false, deviceStatus: 'offline', lastVerifiedAt: '2026-10-17T01:00:00.000Z' }}
        simRunning={false}
        selectedDeviceKey="CARE-TAG-01"
        activeProfile={mockActiveProfile}
        caregiverName="Bhavishya Singla"
      />
    );

    // Device identity
    expect(screen.getAllByText('Leon')[0]).toBeInTheDocument();
    expect(screen.getAllByText('CARE-TAG-01')[0]).toBeInTheDocument();

    // Caregiver
    expect(screen.getByText(/Caregiver:/i)).toBeInTheDocument();
    expect(screen.getByText('Bhavishya Singla')).toBeInTheDocument();

    // Mode is "Live Device Data" with calm styling
    expect(screen.getByText(/Mode:/i)).toBeInTheDocument();
    expect(screen.getByText(/Live Device Data/i)).toBeInTheDocument();

    // Connection is "Offline" with neutral styling, NOT marked as connected or green
    expect(screen.getByText(/Connection:/i)).toBeInTheDocument();
    const connectionTag = screen.getByText(/Connection:/i).closest('.inspector-conn-tag');
    expect(connectionTag).toHaveClass('conn-tag--offline');
    expect(connectionTag).not.toHaveClass('conn-tag--live');
  });

  test('3. Inspector Navigation: Concise labels with zero duplicate parentheses text', () => {
    render(
      <TechnicalInspector
        packet={mockPacket}
        geofences={mockGeofences}
        hardwareStatus={{ connected: false, deviceStatus: 'offline' }}
        simRunning={false}
      />
    );

    const expectedLabels = [
      'Overview',
      'Backend & Firebase',
      'Device & Telemetry',
      'GPS & Geofence',
      'Routine AI',
      'Alerts & Voice',
      'Capstone Scenarios',
      'Technical Reference',
    ];

    expectedLabels.forEach(label => {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    });

    // Verify absence of legacy parenthetical duplication
    expect(screen.queryByText(/Overview \(Overview\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Firebase & Diagnostics/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Judge & Code Guide/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Raw Telemetry/i)).not.toBeInTheDocument();
  });

  test('4. Overview Tab: Displays balanced summary and 6 diagnostic health categories', () => {
    render(
      <TechnicalInspector
        packet={mockPacket}
        geofences={mockGeofences}
        hardwareStatus={{ connected: true, deviceStatus: 'live' }}
        simRunning={false}
        selectedDeviceKey="CARE-TAG-01"
        activeProfile={mockActiveProfile}
      />
    );

    // Summary banner
    expect(screen.getByText(/CareTag System Health & Diagnostic Overview/i)).toBeInTheDocument();

    // 6 Core Cards
    expect(screen.getAllByText('Backend & Firebase').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Smart Band Connection').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('GPS & Location').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Routine AI Readiness').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('CareTag Safety Engine').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Alerts & Voice').length).toBeGreaterThanOrEqual(1);
  });

  test('5. Tab Switching: Clicking sidebar navigation switches active panel cleanly', () => {
    render(
      <TechnicalInspector
        packet={mockPacket}
        geofences={mockGeofences}
        hardwareStatus={{ connected: true, deviceStatus: 'live' }}
        simRunning={false}
      />
    );

    // Click GPS & Geofence
    fireEvent.click(screen.getByRole('tab', { name: 'GPS & Geofence' }));
    expect(screen.getByText(/GPS & Geofence Math Engine/i)).toBeInTheDocument();
    expect(screen.getByText(/WGS84 Great-Circle Haversine Formula/i)).toBeInTheDocument();

    // Click Alerts & Voice
    fireEvent.click(screen.getByRole('tab', { name: 'Alerts & Voice' }));
    expect(screen.getByText(/Safety Alerts & Voice Announcement Diagnostics/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Test Voice Alert/i })).toBeInTheDocument();

    // Click Technical Reference
    fireEvent.click(screen.getByRole('tab', { name: 'Technical Reference' }));
    expect(screen.getByText(/Capstone Presentation Guide/i)).toBeInTheDocument();
    expect(screen.getByText(/CareTag Edge-Cloud Architecture/i)).toBeInTheDocument();
  });
});
