import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import CaregiverOverview from './CaregiverOverview';

// Mock testHardwareConnection
jest.mock('../firebase', () => ({
  testHardwareConnection: jest.fn().mockResolvedValue({
    ok: true,
    latencyMs: 38,
    data: { uptime_ms: 15000 }
  }),
}));

describe('Mobile-First Responsive UI & UX Specification Tests', () => {
  const mockPacket = {
    latitude: 30.3491,
    longitude: 76.4117,
    batteryPercent: 88,
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
      label: 'Home Safe Zone',
      centerLatitude: 30.3491,
      centerLongitude: 76.4117,
      radiusMeters: 400,
      enabled: true,
      schedule: { mode: 'all_day' }
    }
  ];

  const mockHardwareStatus = {
    connected: true,
    isHardwareStreaming: true,
    deviceStatus: 'live',
    ageSeconds: 3,
    formattedAge: '3s ago',
  };

  const mockProfilesList = [
    {
      id: 'profile-1',
      deviceKey: 'CARE-TAG-01',
      childName: 'Diya Singla',
      hardwareModel: 'CareTag Band S2',
      relation: 'Daughter',
      avatarColor: '#2563EB'
    },
    {
      id: 'profile-2',
      deviceKey: 'CARE-TAG-02',
      childName: 'Aarav Singla',
      hardwareModel: 'CareTag Band S1',
      relation: 'Son',
      avatarColor: '#14B8A6'
    }
  ];

  const testViewports = [
    { name: 'Small phone (320x568)', width: 320, height: 568 },
    { name: 'Compact Android (360x800)', width: 360, height: 800 },
    { name: 'Modern iPhone (390x844)', width: 390, height: 844 },
    { name: 'Large phone (430x932)', width: 430, height: 932 },
    { name: 'Tablet portrait (768x1024)', width: 768, height: 1024 },
    { name: 'Small desktop/tablet landscape (1024x768)', width: 1024, height: 768 },
    { name: 'Standard desktop (1440x900)', width: 1440, height: 900 }
  ];

  // ── 1. Monitored Person and Device Hierarchy ──
  test('renders clear visual distinction between signed-in Caregiver, Monitored Person, and Device ID', () => {
    render(
      <CaregiverOverview
        packet={mockPacket}
        geofences={mockGeofences}
        alerts={[]}
        hardwareStatus={mockHardwareStatus}
        simRunning={false}
        isLiveHardwareMode={true}
        caregiverName="Bhavishya Singla"
        activeProfile={mockProfilesList[0]}
        devicesList={mockProfilesList}
        selectedDeviceKey="CARE-TAG-01"
      />
    );

    // Caregiver Account Badge is clearly shown
    expect(screen.getByText(/Caregiver:/i)).toBeInTheDocument();
    expect(screen.getByText(/Bhavishya Singla/i)).toBeInTheDocument();

    // Monitored Person is prominent
    expect(screen.getByRole('heading', { name: 'Diya Singla' })).toBeInTheDocument();

    // Assigned Device Key is displayed in mono badge
    expect(screen.getByText('CARE-TAG-01')).toBeInTheDocument();
    expect(screen.getByText('CareTag Band S2')).toBeInTheDocument();
    expect(screen.getByText('Daughter')).toBeInTheDocument();

    // Switch profile button exists
    expect(screen.getByRole('button', { name: /Switch/i })).toBeInTheDocument();
  });

  // ── 2. Device/Person Switching Bottom Sheet Flow ──
  test('opens mobile bottom sheet to switch monitored person and allows profile selection', () => {
    const handleSwitchDevice = jest.fn();
    const handleOpenLinkDevice = jest.fn();

    render(
      <CaregiverOverview
        packet={mockPacket}
        geofences={mockGeofences}
        alerts={[]}
        hardwareStatus={mockHardwareStatus}
        simRunning={false}
        isLiveHardwareMode={true}
        caregiverName="Bhavishya Singla"
        activeProfile={mockProfilesList[0]}
        devicesList={mockProfilesList}
        selectedDeviceKey="CARE-TAG-01"
        onSwitchDevice={handleSwitchDevice}
        onOpenLinkDevice={handleOpenLinkDevice}
      />
    );

    // Open the switch modal
    const switchBtn = screen.getByRole('button', { name: /Switch/i });
    fireEvent.click(switchBtn);

    // Modal opens with dialog role
    const modal = screen.getByRole('dialog', { name: /Switch Monitored Person/i });
    expect(modal).toBeInTheDocument();

    // Active profile is marked as Active
    expect(within(modal).getByText(/^Active$/i)).toBeInTheDocument();

    // Secondary profile (Aarav Singla) is selectable
    const aaravOption = screen.getByText('Aarav Singla');
    expect(aaravOption).toBeInTheDocument();

    // Click Aarav Singla
    fireEvent.click(aaravOption.closest('button'));
    expect(handleSwitchDevice).toHaveBeenCalledWith('CARE-TAG-02');

    // Link another band button is present
    fireEvent.click(switchBtn);
    const linkBandBtn = screen.getByRole('button', { name: /Link Another Smart Band/i });
    expect(linkBandBtn).toBeInTheDocument();
    fireEvent.click(linkBandBtn);
    expect(handleOpenLinkDevice).toHaveBeenCalled();
  });

  // ── 3. Quick Actions Navigation ──
  test('quick action bar provides direct touch-friendly shortcuts to high-value actions', () => {
    const handleOpenSafeZones = jest.fn();
    const handleOpenAlerts = jest.fn();
    const handleOpenMap = jest.fn();
    const handleOpenInspector = jest.fn();

    render(
      <CaregiverOverview
        packet={mockPacket}
        geofences={mockGeofences}
        alerts={[]}
        hardwareStatus={mockHardwareStatus}
        simRunning={false}
        isLiveHardwareMode={true}
        caregiverName="Bhavishya Singla"
        activeProfile={mockProfilesList[0]}
        devicesList={mockProfilesList}
        onOpenSafeZones={handleOpenSafeZones}
        onOpenAlerts={handleOpenAlerts}
        onOpenMap={handleOpenMap}
        onOpenTechInspector={handleOpenInspector}
      />
    );

    // Quick Actions navigation bar
    const quickActions = screen.getByLabelText('Caregiver Quick Actions');

    // Safe Places action
    const safePlacesBtn = within(quickActions).getByRole('button', { name: /Safe places/i });
    fireEvent.click(safePlacesBtn);
    expect(handleOpenSafeZones).toHaveBeenCalled();

    // View alerts action
    const alertsBtn = within(quickActions).getByRole('button', { name: /Alerts/i });
    fireEvent.click(alertsBtn);
    expect(handleOpenAlerts).toHaveBeenCalled();

    // Diagnostics action
    const diagBtn = within(quickActions).getByRole('button', { name: /Diagnostics/i });
    fireEvent.click(diagBtn);
    expect(handleOpenInspector).toHaveBeenCalled();
  });

  // ── 4. Urgent Alert Prioritization ──
  test('places urgent incident banner at the top of the mobile hierarchy when alert exists', () => {
    const activeBreachAlert = [
      {
        id: 'alert-urgent-1',
        type: 'boundary_breach',
        title: 'Safe Boundary Breach Detected',
        message: 'Diya Singla crossed outside Home Safe Zone boundary.',
        acknowledged: false,
        timestamp: new Date().toISOString(),
        anomalyScore: 82,
        zoneName: 'Home Safe Zone'
      }
    ];

    const handleAcknowledge = jest.fn();
    const handleRecenter = jest.fn();

    render(
      <CaregiverOverview
        packet={mockPacket}
        geofences={mockGeofences}
        alerts={activeBreachAlert}
        hardwareStatus={mockHardwareStatus}
        simRunning={false}
        isLiveHardwareMode={true}
        caregiverName="Bhavishya Singla"
        activeProfile={mockProfilesList[0]}
        devicesList={mockProfilesList}
        onAcknowledgeAlert={handleAcknowledge}
        onRecenterMap={handleRecenter}
      />
    );

    // Urgent banner is prominently displayed
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Immediate Caregiver Action Needed/i)).toBeInTheDocument();
    expect(screen.getByText(/Action Required: Boundary Breach/i)).toBeInTheDocument();

    // Recenter and Acknowledge buttons are operational
    const recenterBtn = screen.getAllByRole('button', { name: /Recenter Map/i })[0];
    fireEvent.click(recenterBtn);
    expect(handleRecenter).toHaveBeenCalled();

    const ackBtn = screen.getByRole('button', { name: /Acknowledge Alert/i });
    fireEvent.click(ackBtn);
    expect(handleAcknowledge).toHaveBeenCalledWith('alert-urgent-1');
  });

  // ── 5. Honest Status Reporting (Never imply GPS fix when missing) ──
  test('reports GPS searching truthfully when coordinates are missing or invalid', () => {
    const packetNoGps = {
      ...mockPacket,
      latitude: null,
      longitude: null,
      gps: { valid: false }
    };

    render(
      <CaregiverOverview
        packet={packetNoGps}
        geofences={mockGeofences}
        alerts={[]}
        hardwareStatus={mockHardwareStatus}
        simRunning={false}
        isLiveHardwareMode={true}
        caregiverName="Bhavishya Singla"
        activeProfile={mockProfilesList[0]}
      />
    );

    // Honest reporting: says "GPS Searching", NOT a false confident location
    expect(screen.getByText(/GPS Searching/i)).toBeInTheDocument();
    expect(screen.getByText(/GPS fix pending/i)).toBeInTheDocument();
  });

  // ── 6. Viewport Matrix Adaptability ──
  describe('Viewport Compatibility Matrix', () => {
    testViewports.forEach(vp => {
      test(`mounts cleanly and stably at ${vp.name}`, () => {
        // Set window dimensions
        window.innerWidth = vp.width;
        window.innerHeight = vp.height;
        window.dispatchEvent(new Event('resize'));

        const { container } = render(
          <CaregiverOverview
            packet={mockPacket}
            geofences={mockGeofences}
            alerts={[]}
            hardwareStatus={mockHardwareStatus}
            simRunning={false}
            isLiveHardwareMode={true}
            caregiverName="Bhavishya Singla"
            activeProfile={mockProfilesList[0]}
            devicesList={mockProfilesList}
          />
        );

        expect(container.querySelector('.caregiver-overview')).toBeInTheDocument();
        expect(container.querySelector('.monitored-context-card')).toBeInTheDocument();
        expect(container.querySelector('.dashboard-quick-actions')).toBeInTheDocument();
        expect(container.querySelector('.overview-row')).toBeInTheDocument();
        expect(container.querySelector('.summary-row')).toBeInTheDocument();
      });
    });
  });
});
