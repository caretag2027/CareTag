import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CaregiverOverview from './CaregiverOverview';

// Mock testHardwareConnection
jest.mock('../firebase', () => ({
  testHardwareConnection: jest.fn().mockResolvedValue({
    ok: true,
    latencyMs: 35,
    data: { uptime_ms: 12000 }
  }),
}));

describe('CaregiverOverview Component', () => {
  const mockPacket = {
    latitude: 30.3491,
    longitude: 76.4117,
    batteryPercent: 92,
    timestamp: new Date().toISOString(),
    capturedAtUtc: new Date().toISOString(),
    speedKph: 0,
    motionState: 'stationary',
    deviceKey: 'CARE-TAG-01',
    gps: { valid: true }
  };

  const mockGeofences = [
    {
      id: 'zone-1',
      label: 'Thapar Campus',
      centerLatitude: 30.3491,
      centerLongitude: 76.4117,
      radiusMeters: 500,
      enabled: true,
      schedule: { mode: 'all_day' }
    }
  ];

  const mockHardwareStatus = {
    connected: true,
    isHardwareStreaming: true,
    deviceStatus: 'live',
    ageSeconds: 2,
    formattedAge: 'Just now',
  };

  test('renders Connection Verification banner on dashboard open', async () => {
    render(
      <CaregiverOverview
        packet={mockPacket}
        geofences={mockGeofences}
        alerts={[]}
        hardwareStatus={mockHardwareStatus}
        simRunning={false}
        isLiveHardwareMode={true}
      />
    );

    // Verify System Connections banner
    expect(screen.getByText(/All Connections Active & Verified/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Firebase Realtime DB/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Smart Band Wearable/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/CareTag Safety Engine/i).length).toBeGreaterThanOrEqual(1);
  });

  test('reveals plain-English parent explanations when detail cards are inspected', () => {
    render(
      <CaregiverOverview
        packet={mockPacket}
        geofences={mockGeofences}
        alerts={[]}
        hardwareStatus={mockHardwareStatus}
        simRunning={false}
        isLiveHardwareMode={true}
      />
    );

    // Click Device Connection card to open details drawer
    const connectionCard = screen.getByText(/Device Connection/i).closest('.bento-card');
    fireEvent.click(connectionCard);

    // Verify plain English parent reassurance inside drawer
    expect(screen.getByText(/What this means/i)).toBeInTheDocument();
    expect(screen.getByText(/The wearable band is powered on and streaming packets/i)).toBeInTheDocument();

    // Close drawer
    fireEvent.click(screen.getByRole('button', { name: /Close Drawer/i }));
  });

  test('reveals location boundary details when location card is inspected', () => {
    render(
      <CaregiverOverview
        packet={mockPacket}
        geofences={mockGeofences}
        alerts={[]}
        hardwareStatus={mockHardwareStatus}
        simRunning={false}
        isLiveHardwareMode={true}
      />
    );

    // Click Location card to open details drawer
    const locationCard = screen.getByText(/Current Location/i).closest('.bento-card');
    fireEvent.click(locationCard);

    expect(screen.getByText(/The child is comfortably within your pre-approved perimeter/i)).toBeInTheDocument();
  });

  test('calls onRecenterMap when clicking Show on Map / Recenter', () => {
    const handleRecenter = jest.fn();
    render(
      <CaregiverOverview
        packet={mockPacket}
        geofences={mockGeofences}
        alerts={[]}
        hardwareStatus={mockHardwareStatus}
        simRunning={false}
        isLiveHardwareMode={true}
        onRecenterMap={handleRecenter}
      />
    );

    const recenterBtn = screen.getByTitle(/Recenter Map on Child/i);
    fireEvent.click(recenterBtn);
    expect(handleRecenter).toHaveBeenCalled();
  });

  test('triggers connection re-test when Test Connections button is clicked', async () => {
    const { testHardwareConnection } = require('../firebase');
    render(
      <CaregiverOverview
        packet={mockPacket}
        geofences={mockGeofences}
        alerts={[]}
        hardwareStatus={mockHardwareStatus}
        simRunning={false}
        isLiveHardwareMode={true}
      />
    );

    // Wait for initial mount check to finish
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Test Connections/i })).toBeInTheDocument();
    });

    const testBtn = screen.getByRole('button', { name: /Test Connections/i });
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(testHardwareConnection).toHaveBeenCalled();
    });
  });

  test('renders active attention card when an unacknowledged breach alert exists', () => {
    const breachAlert = {
      id: 'alert-1',
      type: 'boundary_breach',
      message: 'Child stepped outside safe place boundary by 75m.',
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };

    render(
      <CaregiverOverview
        packet={mockPacket}
        geofences={mockGeofences}
        alerts={[breachAlert]}
        hardwareStatus={mockHardwareStatus}
        simRunning={false}
        isLiveHardwareMode={true}
      />
    );

    expect(screen.getByText(/Action Required: Boundary Breach/i)).toBeInTheDocument();
    expect(screen.getByText(/Child stepped outside safe place boundary/i)).toBeInTheDocument();
  });

  test('renders caregiver core vitals: Smart Band Connection, Current Location, Battery, Daily Routine, and Safe Places', () => {
    render(
      <CaregiverOverview
        packet={mockPacket}
        geofences={mockGeofences}
        alerts={[]}
        hardwareStatus={mockHardwareStatus}
        simRunning={false}
        isLiveHardwareMode={true}
      />
    );

    // 1. Device Connection
    expect(screen.getByText(/Device Connection/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Connected/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Receiving Live Data/i)).toBeInTheDocument();

    // 2. Physical Location
    expect(screen.getByText(/Current Location/i)).toBeInTheDocument();
    expect(screen.getByText(/Inside Thapar Campus/i)).toBeInTheDocument();

    // 3. Battery Health
    expect(screen.getByText(/Battery/i)).toBeInTheDocument();
    expect(screen.getByText(/92%/i)).toBeInTheDocument();

    // 4. Daily Routine
    expect(screen.getByText(/Daily Routine/i)).toBeInTheDocument();

    // 5. Configured Safe Places
    expect(screen.getByText(/Configured Safe Places \(1\)/i)).toBeInTheDocument();
  });
});
