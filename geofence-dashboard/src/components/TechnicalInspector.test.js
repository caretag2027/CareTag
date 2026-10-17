import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TechnicalInspector from './TechnicalInspector';

// Mock diagnoseFirebaseOperations
jest.mock('../firebase', () => ({
  diagnoseFirebaseOperations: jest.fn().mockResolvedValue({
    totalDurationMs: 140,
    timestamp: new Date().toISOString(),
    results: {
      readTelemetry: { ok: true, latencyMs: 25, status: 'Healthy', details: 'Node active' },
      readSafeZones: { ok: true, latencyMs: 30, status: 'Healthy', details: 'Zones loaded' },
      createSafeZone: { ok: true, latencyMs: 40, status: 'Healthy', details: 'Write verified' },
      editSafeZone: { ok: true, latencyMs: 20, status: 'Healthy', details: 'Patch verified' },
      deleteSafeZone: { ok: true, latencyMs: 25, status: 'Healthy', details: 'Delete verified' },
      persistRoutineHistory: { ok: true, latencyMs: 35, status: 'Healthy', details: 'Partition ok' },
      loadRoutineProfile: { ok: true, latencyMs: 22, status: 'Healthy', details: 'Endpoint ok' },
      saveAlerts: { ok: true, latencyMs: 28, status: 'Healthy', details: 'Alerts ok' },
    }
  }),
}));

describe('TechnicalInspector Component', () => {
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
    accelerometer: { x_ms2: 0.1, y_ms2: 0.2, z_ms2: -9.81, magnitude: 9.81 },
    gyroscope: { x_dps: 0.5, y_dps: 0.2, z_dps: 0.1, magnitude: 0.55 },
    isHardware: true,
  };

  const mockGeofences = [
    {
      id: 'zone-1',
      label: 'Campus Perimeter',
      centerLatitude: 30.3491,
      centerLongitude: 76.4117,
      radiusMeters: 500,
      enabled: true,
      schedule: { mode: 'all_day' }
    }
  ];

  test('renders Judge & Code Guide tab by default with Capstone Pitch and Evaluator protocol', () => {
    render(
      <TechnicalInspector
        packet={mockPacket}
        geofences={mockGeofences}
        hardwareStatus={{ connected: true, deviceStatus: 'live' }}
        simRunning={false}
      />
    );

    expect(screen.getByText(/Capstone Presentation Guide/i)).toBeInTheDocument();
    expect(screen.getByText(/CareTag: Standalone Intelligent Wearable Safety System/i)).toBeInTheDocument();
    expect(screen.getByText(/Evaluator Live Review & Verification Protocol/i)).toBeInTheDocument();
    expect(screen.getByText(/Codebase Architecture & Function Directory/i)).toBeInTheDocument();
  });

  test('lists key functions with descriptions for judges and supports filtering', () => {
    render(
      <TechnicalInspector
        packet={mockPacket}
        geofences={mockGeofences}
        hardwareStatus={{ connected: true, deviceStatus: 'live' }}
        simRunning={false}
      />
    );

    // Verify key functions are documented
    expect(screen.getByText(/extract_stay_points/i)).toBeInTheDocument();
    expect(screen.getByText(/class RoutineLSTM/i)).toBeInTheDocument();
    expect(screen.getByText(/score_trajectory_anomaly/i)).toBeInTheDocument();
    expect(screen.getByText(/subscribeHardwareTelemetry/i)).toBeInTheDocument();

    // Test filtering by module
    const step2Filter = screen.getByRole('button', { name: /Step 2: PyTorch LSTM/i });
    fireEvent.click(step2Filter);

    expect(screen.getByText(/class RoutineLSTM/i)).toBeInTheDocument();
    expect(screen.queryByText(/extract_stay_points/i)).not.toBeInTheDocument();
  });

  test('switches between tabs cleanly (Raw Telemetry, Geofence Math, Routine, Scenarios, Diagnostics)', async () => {
    render(
      <TechnicalInspector
        packet={mockPacket}
        geofences={mockGeofences}
        hardwareStatus={{ connected: true, deviceStatus: 'live' }}
        simRunning={false}
      />
    );

    // Switch to Raw Telemetry
    fireEvent.click(screen.getByRole('tab', { name: /Raw Telemetry/i }));
    expect(screen.getByText(/GPS Coordinate Fix & Accuracy/i)).toBeInTheDocument();
    expect(screen.getByText(/IMU Sensor Readings & Battery/i)).toBeInTheDocument();

    // Switch to Geofence Math Engine
    fireEvent.click(screen.getByRole('tab', { name: /Geofence Math Engine/i }));
    expect(screen.getByText(/WGS84 Great-Circle Haversine Formula/i)).toBeInTheDocument();
    expect(screen.getByText(/Campus Perimeter/i)).toBeInTheDocument();

    // Switch to Routine Model
    fireEvent.click(screen.getByRole('tab', { name: /Routine AI Model/i }));
    expect(screen.getByText(/Per-Device Statistical Baseline/i)).toBeInTheDocument();
    expect(screen.getByText(/Daily Learning Timeline Progression/i)).toBeInTheDocument();

    // Switch to Scenarios
    fireEvent.click(screen.getByRole('tab', { name: /Capstone Scenarios/i }));
    expect(screen.getByText(/Strict Simulation Isolation/i)).toBeInTheDocument();
    expect(screen.getByText(/Run Preset 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Run Preset 2/i)).toBeInTheDocument();

    // Switch to Diagnostics
    fireEvent.click(screen.getByRole('tab', { name: /Firebase & Diagnostics/i }));
    expect(screen.getByText(/Firebase Realtime Database.*Diagnostics/i)).toBeInTheDocument();
  });

  test('executes diagnostics probe when button is clicked', async () => {
    const { diagnoseFirebaseOperations } = require('../firebase');
    render(
      <TechnicalInspector
        packet={mockPacket}
        geofences={mockGeofences}
        hardwareStatus={{ connected: true, deviceStatus: 'live' }}
        simRunning={false}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /Firebase & Diagnostics/i }));

    // Wait for the automatic initial probe to complete
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Run Diagnostics Probe/i })).toBeInTheDocument();
    });

    const runProbeBtn = screen.getByRole('button', { name: /Run Diagnostics Probe/i });
    fireEvent.click(runProbeBtn);

    await waitFor(() => {
      expect(diagnoseFirebaseOperations).toHaveBeenCalled();
    });
  });

  test('renders top Cloud Infrastructure & Write API connectivity console with Test Connections & APIs button', () => {
    render(
      <TechnicalInspector
        packet={mockPacket}
        geofences={mockGeofences}
        hardwareStatus={{ connected: true, deviceStatus: 'live' }}
        simRunning={false}
      />
    );

    expect(screen.getByText(/Cloud Infrastructure & API Connectivity/i)).toBeInTheDocument();
    expect(screen.getByText(/Write & REST APIs/i)).toBeInTheDocument();
    expect(screen.getByText(/Write, PATCH & DELETE Active/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Test Connections & APIs/i })).toBeInTheDocument();
  });
});
