import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaggyChatbot from './TaggyChatbot';

// Mock scrollIntoView which jsdom does not implement
window.HTMLElement.prototype.scrollIntoView = jest.fn();

describe('TaggyChatbot Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(() => Promise.reject(new Error('Network offline in tests')));
  });

  test('renders launcher button and opens chatbot on click', () => {
    render(<TaggyChatbot />);
    
    // Launcher button should be present
    const launcherBtn = screen.getByRole('button', { name: /open taggy ai chatbot/i });
    expect(launcherBtn).toBeInTheDocument();

    // Click to open chat
    fireEvent.click(launcherBtn);

    // Chat window should now be in the document
    expect(screen.getByRole('dialog', { name: /taggy ai companion chat/i })).toBeInTheDocument();
  });

  test('displays caregiver-first header with "Online · Here to help"', () => {
    render(<TaggyChatbot />);
    fireEvent.click(screen.getByRole('button', { name: /open taggy ai chatbot/i }));

    expect(screen.getByRole('heading', { level: 3, name: /Taggy/i })).toBeInTheDocument();
    expect(screen.getByText('AI Companion')).toBeInTheDocument();
    expect(screen.getByText(/Online · Here to help/i)).toBeInTheDocument();
  });

  test('displays friendly caregiver welcome message without technical jargon', () => {
    render(<TaggyChatbot />);
    fireEvent.click(screen.getByRole('button', { name: /open taggy ai chatbot/i }));

    expect(screen.getByText(/Hi, I'm/i)).toBeInTheDocument();
    expect(screen.getByText(/I can help you set up safe places, understand alerts, and use your CareTag dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/What would you like help with\?/i)).toBeInTheDocument();

    // Verify technical jargon is NOT in welcome text
    expect(screen.queryByText(/LSTM/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/GeoLife/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ESP32/i)).not.toBeInTheDocument();
  });

  test('renders the 4 caregiver starter questions', () => {
    render(<TaggyChatbot />);
    fireEvent.click(screen.getByRole('button', { name: /open taggy ai chatbot/i }));

    expect(screen.getByRole('button', { name: 'How do I set up a safe place?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'What happens if my child leaves a safe place?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Why haven't I received an alert?" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'What should I do if the band goes offline?' })).toBeInTheDocument();
  });

  test('clicking a question chip triggers direct caregiver response', async () => {
    render(
      <TaggyChatbot
        currentView="dashboard"
        geofences={[{ id: '1', label: 'Home' }, { id: '2', label: 'School' }]}
        hardwareStatus={{ connected: true, batteryPercent: 88 }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /open taggy ai chatbot/i }));

    const safePlaceChip = screen.getByRole('button', { name: 'How do I set up a safe place?' });
    fireEvent.click(safePlaceChip);

    await waitFor(() => {
      expect(screen.getAllByText(/Safe Places/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Add a Place/i).length).toBeGreaterThan(0);
    });

    // Should not contain LSTM, stay-point extraction or sensor specs in ordinary response
    expect(screen.queryByText(/dual-input LSTM/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/MPU-6050/i)).not.toBeInTheDocument();
  });

  test('collapsible technical disclosure exists and is closed by default', async () => {
    render(<TaggyChatbot />);
    fireEvent.click(screen.getByRole('button', { name: /open taggy ai chatbot/i }));

    // Send question that includes optional tech details
    const input = screen.getByPlaceholderText('Ask Taggy anything...');
    fireEvent.change(input, { target: { value: 'How does CareTag work?' } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() => {
      expect(screen.getAllByText(/CareTag helps you check your child's latest reported location/i).length).toBeGreaterThan(0);
    });

    // Technical disclosure trigger should be present
    const techToggle = screen.getByRole('button', { name: /How does this work technically\?/i });
    expect(techToggle).toBeInTheDocument();

    // Details should be closed by default
    expect(screen.queryByText(/CareTag combines an ESP32 wearable/i)).not.toBeInTheDocument();

    // Clicking disclosure expands it
    fireEvent.click(techToggle);
    expect(screen.getByText(/CareTag combines an ESP32 wearable/i)).toBeInTheDocument();
  });

  test('toggles expanded reader view when clicking maximize icon', () => {
    render(<TaggyChatbot />);
    fireEvent.click(screen.getByRole('button', { name: /open taggy ai chatbot/i }));

    const chatWindow = screen.getByRole('dialog', { name: /taggy ai companion chat/i });
    expect(chatWindow.className).not.toContain('taggy-window--expanded');

    const expandBtn = screen.getByRole('button', { name: /expand view/i });
    fireEvent.click(expandBtn);

    expect(chatWindow.className).toContain('taggy-window--expanded');

    const collapseBtn = screen.getByRole('button', { name: /standard view/i });
    fireEvent.click(collapseBtn);

    expect(chatWindow.className).not.toContain('taggy-window--expanded');
  });

  test('refresh button clears the conversation', async () => {
    render(<TaggyChatbot />);
    fireEvent.click(screen.getByRole('button', { name: /open taggy ai chatbot/i }));

    // Send a message
    const chip = screen.getByRole('button', { name: 'What should I do if the band goes offline?' });
    fireEvent.click(chip);

    await waitFor(() => {
      expect(screen.getAllByText(/connection status/i).length).toBeGreaterThan(0);
    }, { timeout: 3500 });

    // Click refresh
    const refreshBtn = screen.getByRole('button', { name: /start new conversation/i });
    fireEvent.click(refreshBtn);

    // Chat cleared back to welcome
    expect(screen.getByText(/What would you like help with\?/i)).toBeInTheDocument();
    expect(screen.queryByText(/connection status/i)).not.toBeInTheDocument();
  });

  test('renders landing page mode with marketing welcome and product questions', async () => {
    const handleLaunchDashboard = jest.fn();
    render(
      <TaggyChatbot
        currentView="landing"
        onLaunchDashboard={handleLaunchDashboard}
      />
    );

    // Open chat
    fireEvent.click(screen.getByRole('button', { name: /open taggy ai chatbot/i }));

    // Verify Product Guide role tag
    expect(screen.getByText('Product Guide')).toBeInTheDocument();

    // Verify landing page marketing welcome text
    expect(screen.getByText(/Welcome to CareTag/i)).toBeInTheDocument();
    expect(screen.getByText(/routine-learning AI, battery life, and how CareTag keeps kids safe without false alarms/i)).toBeInTheDocument();

    // Verify popular product questions
    expect(screen.getByRole('button', { name: 'What makes CareTag different from regular GPS trackers?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'How does the AI routine learning work?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'What hardware and sensors are used in the smart band?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Can I try the live demonstration dashboard?' })).toBeInTheDocument();

    // Click demo question
    const demoBtn = screen.getByRole('button', { name: 'Can I try the live demonstration dashboard?' });
    fireEvent.click(demoBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/live interactive dashboard/i).length).toBeGreaterThan(0);
    });

    // Action button to launch dashboard should appear
    const launchBtn = screen.getByRole('button', { name: /Open Dashboard/i });
    expect(launchBtn).toBeInTheDocument();
    fireEvent.click(launchBtn);
    expect(handleLaunchDashboard).toHaveBeenCalled();
  });

  test('provides operational assistance with live location and recenters map in dashboard mode', async () => {
    const handleRecenter = jest.fn();
    render(
      <TaggyChatbot
        currentView="dashboard"
        latest={{
          latitude: 30.3491,
          longitude: 76.4117,
          nearestGeofence: 'Thapar Campus',
          motionState: 'Walking',
          speedKph: 4,
          batteryPercent: 88,
          isAnomaly: false
        }}
        onRecenterMap={handleRecenter}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /open taggy ai chatbot/i }));

    const input = screen.getByPlaceholderText('Ask Taggy anything...');
    fireEvent.change(input, { target: { value: 'Where is my child right now?' } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() => {
      expect(screen.getAllByText(/Thapar Campus/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/30.3491/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Walking/i).length).toBeGreaterThan(0);
    });

    const showOnMapBtn = screen.getByRole('button', { name: /Show on Map/i });
    expect(showOnMapBtn).toBeInTheDocument();
    fireEvent.click(showOnMapBtn);
    expect(handleRecenter).toHaveBeenCalled();
  });

  test('provides operational assistance for battery and alerts status in dashboard mode', async () => {
    const handleNavigate = jest.fn();
    render(
      <TaggyChatbot
        currentView="dashboard"
        latest={{ batteryPercent: 94, batteryCharging: false }}
        alerts={[
          {
            id: 'alert-1',
            type: 'boundary_breach',
            message: 'Child stepped outside Home boundary',
            acknowledged: false,
            timestamp: new Date().toISOString()
          }
        ]}
        onNavigateTab={handleNavigate}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /open taggy ai chatbot/i }));

    // Ask about battery
    const input = screen.getByPlaceholderText('Ask Taggy anything...');
    fireEvent.change(input, { target: { value: 'What is the battery level?' } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() => {
      expect(screen.getAllByText(/94%/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/18 to 24 hours/i).length).toBeGreaterThan(0);
    });

    // Ask about alerts
    fireEvent.change(input, { target: { value: 'Are there any alerts?' } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() => {
      expect(screen.getAllByText(/1 active alert/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Boundary Breach/i).length).toBeGreaterThan(0);
    });

    const viewAlertsBtn = screen.getByRole('button', { name: /View Alerts/i });
    expect(viewAlertsBtn).toBeInTheDocument();
    fireEvent.click(viewAlertsBtn);
    expect(handleNavigate).toHaveBeenCalledWith('alerts');
  });

  test('opens when caretag:open-taggy custom event is dispatched', () => {
    render(<TaggyChatbot currentView="landing" />);

    expect(screen.queryByRole('dialog', { name: /taggy ai companion chat/i })).not.toBeInTheDocument();

    // Dispatch global event
    fireEvent(window, new CustomEvent('caretag:open-taggy'));

    expect(screen.getByRole('dialog', { name: /taggy ai companion chat/i })).toBeInTheDocument();
  });

  test('answers teacher/faculty mentor inquiry with both Dr. Kapil Tomar and Dr. Ravindra Kumar', async () => {
    render(<TaggyChatbot currentView="landing" />);
    fireEvent.click(screen.getByRole('button', { name: /open taggy ai chatbot/i }));

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Who is the teacher or faculty mentor for this project?' } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() => {
      expect(screen.getByText(/Dr\. Kapil Tomar/i)).toBeInTheDocument();
      expect(screen.getByText(/Dr\. Ravindra Kumar/i)).toBeInTheDocument();
    });
  });
});
