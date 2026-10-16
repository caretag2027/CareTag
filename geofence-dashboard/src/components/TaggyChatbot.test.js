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
});
