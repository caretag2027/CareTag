import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CaregiverOverview from './CaregiverOverview';
import deviceStore from '../deviceStore';

// Mock Leaflet and router dependencies
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="mock-map-container">{children}</div>,
  TileLayer: () => <div data-testid="mock-tile-layer" />,
  Circle: ({ children }) => <div data-testid="mock-circle">{children}</div>,
  Popup: ({ children }) => <div data-testid="mock-popup">{children}</div>,
  Marker: ({ children }) => <div data-testid="mock-marker">{children}</div>,
  useMap: () => ({ setView: jest.fn(), flyTo: jest.fn() }),
}));

describe('CareTag — Selected Device Card & Manage Devices Modal Refinements', () => {
  const mockSingleDevice = [
    {
      id: 'dev_leon_01',
      deviceKey: 'CARE-TAG-01',
      nickname: 'Leon',
      name: 'Leon',
      childName: 'Leon',
      relation: 'Smart Band',
      avatarColor: '#2563EB',
      hardwareModel: 'ESP32-WROOM-32U + NEO-6M',
    },
  ];

  const mockMultiDevices = [
    {
      id: 'dev_leon_01',
      deviceKey: 'CARE-TAG-01',
      nickname: 'Leon',
      name: 'Leon',
      childName: 'Leon',
      relation: 'Smart Band',
      avatarColor: '#2563EB',
      hardwareModel: 'ESP32-WROOM-32U + NEO-6M',
    },
    {
      id: 'dev_band_02',
      deviceKey: 'CARE-TAG-02',
      nickname: 'Diya',
      name: 'Diya',
      childName: 'Diya',
      relation: 'Smart Band',
      avatarColor: '#14B8A6',
      hardwareModel: 'ESP32 Standalone Smart Band',
    },
  ];

  const defaultProps = {
    packet: {
      latitude: 37.7749,
      longitude: -122.4194,
      accuracyMeters: 4.2,
      batteryPercent: 88,
      timestamp: new Date().toISOString(),
      gps: { valid: true, fix: '3D' },
      deviceKey: 'CARE-TAG-01',
    },
    geofences: [],
    alerts: [],
    hardwareStatus: { online: false, status: 'offline' },
    simRunning: false,
    isLiveHardwareMode: false,
    routineProfile: null,
    selectedDeviceKey: 'CARE-TAG-01',
    activeProfile: mockSingleDevice[0],
    devicesList: mockSingleDevice,
    caregiverName: 'Bhavishya Singla',
    onSwitchDevice: jest.fn(),
    onOpenLinkDevice: jest.fn(),
    onRenameDevice: jest.fn(),
  };

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  // ── 1. Currently Monitoring Card Layout & Identity ──
  describe('Currently Monitoring Card', () => {
    test('renders balanced three-part layout: top kicker & caregiver identity, main row device details, and selector', () => {
      render(<CaregiverOverview {...defaultProps} />);

      const card = screen.getByLabelText(/Currently monitoring/i);
      expect(card).toBeInTheDocument();

      // Top row: Kicker and caregiver identity
      expect(within(card).getByText(/Currently monitoring/i)).toBeInTheDocument();
      expect(within(card).getByText(/Caregiver:/i)).toBeInTheDocument();
      expect(within(card).getByText(/Bhavishya Singla/i)).toBeInTheDocument();

      // Main row: Avatar, Nickname, Hardware ID (hardware model moved to Manage Devices)
      expect(within(card).getByText('Leon')).toBeInTheDocument();
      expect(within(card).getByText('CARE-TAG-01')).toBeInTheDocument();
      expect(within(card).queryByText('ESP32-WROOM-32U + NEO-6M')).not.toBeInTheDocument();

      // Avatar displays initial 'L' for Leon
      const avatar = card.querySelector('.monitored-avatar');
      expect(avatar).toBeInTheDocument();
      expect(avatar.textContent.trim()).toBe('L');

      // Compact inline Rename button
      const renameBtn = within(card).getByRole('button', { name: /Rename device/i });
      expect(renameBtn).toBeInTheDocument();

      // Real Device Count & Selector Action
      const selectorBtn = card.querySelector('.device-selector-pill');
      expect(selectorBtn).toBeInTheDocument();
      expect(within(selectorBtn).getByText('Devices (1)')).toBeInTheDocument();
      expect(within(selectorBtn).getByText('Manage devices')).toBeInTheDocument();
    });

    test('derives avatar initial from device nickname and never from generic names or caregiver identity', () => {
      // Custom nickname "Maya"
      const customProfile = {
        ...mockSingleDevice[0],
        nickname: 'Maya',
        name: 'Maya',
      };

      render(
        <CaregiverOverview
          {...defaultProps}
          activeProfile={customProfile}
          devicesList={[customProfile]}
        />
      );

      expect(screen.getByText('Maya')).toBeInTheDocument();
      const avatar = document.querySelector('.monitored-avatar');
      expect(avatar.textContent.trim()).toBe('M');
    });

    test('truthfully displays Offline status without false green connected indicators', () => {
      render(
        <CaregiverOverview
          {...defaultProps}
          hardwareStatus={{ online: false, status: 'offline' }}
          simRunning={false}
          isLiveHardwareMode={false}
        />
      );

      const statusBadge = document.querySelector('.device-connection-badge');
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge.textContent).toContain('Offline');
      expect(statusBadge.classList.contains('status--badge--offline')).toBe(true);

      // Verify no stray green dot in top row kicker
      expect(document.querySelector('.monitored-kicker-wrap .dot--active')).toBeNull();
    });

    test('displays Connected status when device has active live hardware connection', () => {
      render(
        <CaregiverOverview
          {...defaultProps}
          hardwareStatus={{ online: true, status: 'online' }}
          simRunning={false}
          isLiveHardwareMode={true}
        />
      );

      const statusBadge = document.querySelector('.device-connection-badge');
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge.textContent).toContain('Connected');
      expect(statusBadge.classList.contains('status--badge--connected')).toBe(true);
    });
  });

  // ── 2. Manage Devices Modal ──
  describe('Manage Devices Modal', () => {
    test('opens with concise title, short description, padded body, and distinct status badges', () => {
      render(<CaregiverOverview {...defaultProps} />);

      // Open modal
      const selectorBtn = document.querySelector('.device-selector-pill');
      fireEvent.click(selectorBtn);

      const modal = screen.getByRole('dialog', { name: /Manage devices/i });
      expect(modal).toBeInTheDocument();

      // Header title and subtitle
      expect(within(modal).getByRole('heading', { name: /^Manage devices$/i })).toBeInTheDocument();
      expect(within(modal).getByText(/View your linked Smart Bands, rename a device, or connect another one\./i)).toBeInTheDocument();

      // Close button
      expect(within(modal).getByRole('button', { name: /Close dialog/i })).toBeInTheDocument();

      // Descriptive paragraph with padding
      expect(within(modal).getByText(/Caregiver account:/i)).toBeInTheDocument();
      expect(within(modal).getByText(/Bhavishya Singla/i)).toBeInTheDocument();
      expect(within(modal).getByText(/\(1 registered\)/i)).toBeInTheDocument();

      // Single device card: Left avatar 'L', Nickname 'Leon', Selected badge, Offline badge, Hardware info
      const devCard = modal.querySelector('.manage-dev-card');
      expect(devCard).toBeInTheDocument();
      expect(within(devCard).getByText('Leon')).toBeInTheDocument();
      expect(within(devCard).getByText('L')).toBeInTheDocument();
      expect(within(devCard).getByText('CARE-TAG-01')).toBeInTheDocument();
      expect(within(devCard).getByText('ESP32-WROOM-32U + NEO-6M')).toBeInTheDocument();

      // Distinct concepts: Selected vs Offline (No conflicting "Active" badge when offline)
      expect(within(devCard).getByText(/^Selected$/i)).toBeInTheDocument();
      expect(within(devCard).getByText(/^Offline$/i)).toBeInTheDocument();

      // Modal actions at bottom: Rename device & Link another Smart Band
      const renameAction = within(modal).getByRole('button', { name: /^Rename device$/i });
      const linkAction = within(modal).getByRole('button', { name: /^Link another Smart Band$/i });
      expect(renameAction).toBeInTheDocument();
      expect(linkAction).toBeInTheDocument();
    });

    test('rename device action from modal opens Rename Device dialog and preserves persistence', async () => {
      const handleRename = jest.fn();
      render(
        <CaregiverOverview
          {...defaultProps}
          onRenameDevice={handleRename}
        />
      );

      // Open manage devices modal
      fireEvent.click(document.querySelector('.device-selector-pill'));
      const manageModal = screen.getByRole('dialog', { name: /Manage devices/i });

      // Click Rename device
      const renameBtn = within(manageModal).getByRole('button', { name: /^Rename device$/i });
      fireEvent.click(renameBtn);

      // Rename dialog opens
      const renameModal = screen.getByRole('dialog', { name: /Rename Device/i });
      expect(renameModal).toBeInTheDocument();
      expect(within(renameModal).getByText('CARE-TAG-01')).toBeInTheDocument();

      // Input field contains 'Leon'
      const input = screen.getByLabelText(/Device Nickname/i);
      expect(input.value).toBe('Leon');

      // Change input to 'Runner Tag' and submit
      fireEvent.change(input, { target: { value: 'Runner Tag' } });
      fireEvent.click(screen.getByRole('button', { name: /Save Nickname/i }));

      expect(handleRename).toHaveBeenCalledWith('CARE-TAG-01', 'Runner Tag');
    });

    test('link another smart band button in modal triggers onOpenLinkDevice callback', () => {
      const handleOpenLink = jest.fn();
      render(
        <CaregiverOverview
          {...defaultProps}
          onOpenLinkDevice={handleOpenLink}
        />
      );

      fireEvent.click(document.querySelector('.device-selector-pill'));
      const modal = screen.getByRole('dialog', { name: /Manage devices/i });

      const linkBtn = within(modal).getByRole('button', { name: /^Link another Smart Band$/i });
      fireEvent.click(linkBtn);

      expect(handleOpenLink).toHaveBeenCalled();
    });

    test('multi-device view lists each device, highlights Selected device, and allows switching without changing caregiver', () => {
      const handleSwitch = jest.fn();
      render(
        <CaregiverOverview
          {...defaultProps}
          devicesList={mockMultiDevices}
          selectedDeviceKey="CARE-TAG-01"
          onSwitchDevice={handleSwitch}
        />
      );

      // Selector reflects Devices (2)
      const selectorBtn = document.querySelector('.device-selector-pill');
      expect(within(selectorBtn).getByText('Devices (2)')).toBeInTheDocument();

      // Open modal
      fireEvent.click(selectorBtn);
      const modal = screen.getByRole('dialog', { name: /Manage devices/i });

      // Both devices listed
      expect(within(modal).getByText('Leon')).toBeInTheDocument();
      expect(within(modal).getByText('Diya')).toBeInTheDocument();

      // CARE-TAG-01 is marked Selected
      const leonCard = within(modal).getByText('Leon').closest('.manage-dev-card');
      expect(within(leonCard).getByText(/^Selected$/i)).toBeInTheDocument();

      // Switch to Diya (CARE-TAG-02)
      const diyaBtn = within(modal).getByText('Diya').closest('button');
      fireEvent.click(diyaBtn);

      expect(handleSwitch).toHaveBeenCalledWith('CARE-TAG-02');
    });
  });

  // ── 3. DeviceStore Sanitization ──
  describe('deviceStore Sanitization', () => {
    test('cleanses legacy Device 1 placeholder and restores Leon for CARE-TAG-01', () => {
      const userId = 'caregiver_test_user';
      const legacyDevices = [
        {
          id: 'dev_leon_01',
          deviceKey: 'CARE-TAG-01',
          nickname: 'Device 1',
          name: 'Device 1',
          avatarColor: '#2563EB',
          hardwareModel: 'ESP32-WROOM-32U + NEO-6M',
        },
      ];
      localStorage.setItem(`caretag.${userId}.devices`, JSON.stringify(legacyDevices));

      const loaded = deviceStore.loadUserDevices(userId);
      expect(loaded[0].deviceKey).toBe('CARE-TAG-01');
      expect(['CareTag 1', 'Leon']).toContain(loaded[0].nickname);
      expect(['CareTag 1', 'Leon']).toContain(loaded[0].name);
    });
  });
});
