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
    expect(screen.getByText(/Firebase Realtime DB/i)).toBeInTheDocument();
    expect(screen.getByText(/Smart Band Wearable/i)).toBeInTheDocument();
    expect(screen.getByText(/CareTag Safety Engine/i)).toBeInTheDocument();
  });

  test('renders layman "What this means" callouts on cards', () => {
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

    // Multiple "What this means" explanations
    const whatThisMeansHeaders = screen.getAllByText(/What this means:/i);
    expect(whatThisMeansHeaders.length).toBeGreaterThanOrEqual(4);

    // Verify plain English parent reassurance
    expect(screen.getByText(/The child is comfortably within your pre-approved perimeter/i)).toBeInTheDocument();
    expect(screen.getByText(/The wearable band's GPS sensor is actively tracking satellite coordinates/i)).toBeInTheDocument();
    expect(screen.getByText(/The wearable band is powered on and streaming packets/i)).toBeInTheDocument();
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

    const recenterBtn = screen.getByText(/Recenter Map/i);
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

  test('renders caregiver starting priority cards: Wearable Status, Current Location, Today Journey, and Routine', () => {
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

    // 1. Wearable Device Active / Live Status
    expect(screen.getByText(/Is the Smart Band Active & Streaming\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Wearable Active & Transmitting/i)).toBeInTheDocument();
    expect(screen.getByText(/Live Data Stream/i)).toBeInTheDocument();

    // 2. Where He Is Right Now
    expect(screen.getByText(/Where is the Child Right Now\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Safe Inside Boundary/i)).toBeInTheDocument();

    // 3. First Location Today & Where He Went Today
    expect(screen.getByText(/Where He Went Today & First Location/i)).toBeInTheDocument();
    expect(screen.getByText(/First Location Today/i)).toBeInTheDocument();
    expect(screen.getByText(/Where He Went Today \(Chronological Timeline\)/i)).toBeInTheDocument();

    // 4. Usual Daily Routine
    expect(screen.getByText(/Are they following their daily routine\?/i)).toBeInTheDocument();
  });
});
