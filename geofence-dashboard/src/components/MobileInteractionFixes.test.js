import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaggyChatbot from './TaggyChatbot';
import LandingPage from './LandingPage';
import HeroRoutineSimulation from './HeroRoutineSimulation';

// Mock scrollIntoView which jsdom does not implement
window.HTMLElement.prototype.scrollIntoView = jest.fn();

describe('Mobile Interaction Fixes, Map Usability & Responsive Dashboard Refinement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    window.scrollTo = jest.fn();
    window.history.pushState = jest.fn();
    global.fetch = jest.fn(() => Promise.reject(new Error('Network offline in tests')));
  });

  afterEach(() => {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  });

  // ── 1. Taggy Chatbot Input & Message Sending Tests ──
  describe('Taggy Chatbot Input & Sending (Mobile)', () => {
    test('renders compact composer anchored to bottom of chat panel with input and Send button', () => {
      render(<TaggyChatbot />);
      fireEvent.click(screen.getByRole('button', { name: /open taggy ai chatbot/i }));

      const chatDialog = screen.getByRole('dialog', { name: /taggy ai companion chat/i });
      expect(chatDialog).toBeInTheDocument();

      const input = screen.getByPlaceholderText('Ask Taggy anything...');
      expect(input).toBeInTheDocument();

      const sendBtn = screen.getByRole('button', { name: /send message/i });
      expect(sendBtn).toBeInTheDocument();
      // Send button should be disabled when input is empty
      expect(sendBtn).toBeDisabled();
    });

    test('send button enables when text is entered and disables on empty whitespace', () => {
      render(<TaggyChatbot />);
      fireEvent.click(screen.getByRole('button', { name: /open taggy ai chatbot/i }));

      const input = screen.getByPlaceholderText('Ask Taggy anything...');
      const sendBtn = screen.getByRole('button', { name: /send message/i });

      // Initially disabled
      expect(sendBtn).toBeDisabled();

      // Enter whitespace only - remains disabled
      fireEvent.change(input, { target: { value: '   ' } });
      expect(sendBtn).toBeDisabled();

      // Enter text - becomes enabled
      fireEvent.change(input, { target: { value: 'Where is Bhavishya?' } });
      expect(sendBtn).toBeEnabled();

      // Clear text - disables again
      fireEvent.change(input, { target: { value: '' } });
      expect(sendBtn).toBeDisabled();
    });

    test('submitting a message via form submission sends user message, clears input, and renders response', async () => {
      render(<TaggyChatbot currentView="dashboard" />);
      fireEvent.click(screen.getByRole('button', { name: /open taggy ai chatbot/i }));

      const input = screen.getByPlaceholderText('Ask Taggy anything...');
      fireEvent.change(input, { target: { value: 'What is battery status?' } });

      const form = input.closest('form');
      fireEvent.submit(form);

      // Input should be cleared immediately
      expect(input.value).toBe('');

      // User message should appear in chat feed
      expect(screen.getByText('What is battery status?')).toBeInTheDocument();

      // Bot reply should appear
      await waitFor(() => {
        expect(screen.getAllByText(/battery/i).length).toBeGreaterThan(0);
      });
    });

    test('suggested questions are hidden by default and expand via single toggle', () => {
      render(<TaggyChatbot />);
      fireEvent.click(screen.getByRole('button', { name: /open taggy ai chatbot/i }));

      // Suggestions toggle is present and collapsed by default
      const toggleBtn = screen.getByRole('button', { name: /show suggested questions/i });
      expect(toggleBtn).toBeInTheDocument();
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');

      // Question chips are not in DOM while collapsed
      expect(screen.queryByRole('button', { name: 'How do I set up a safe place?' })).not.toBeInTheDocument();

      // Expand questions
      fireEvent.click(toggleBtn);
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('button', { name: 'How do I set up a safe place?' })).toBeInTheDocument();

      // Clicking a question sends prompt and collapses suggestions
      fireEvent.click(screen.getByRole('button', { name: 'How do I set up a safe place?' }));
      expect(screen.queryByRole('button', { name: 'How do I set up a safe place?' })).not.toBeInTheDocument();
    });

    test('Taggy locks background page scroll on mobile and restores it when closed', () => {
      // Simulate mobile width
      window.innerWidth = 375;
      render(<TaggyChatbot />);

      // Initially unlocked
      expect(document.body.style.overflow).toBe('');

      // Open Taggy
      fireEvent.click(screen.getByRole('button', { name: /open taggy ai chatbot/i }));
      expect(document.body.style.overflow).toBe('hidden');

      // Close Taggy via close button
      const closeBtn = screen.getByRole('button', { name: /close chat/i });
      fireEvent.click(closeBtn);

      expect(document.body.style.overflow).toBe('');
    });

    test('Escape key closes Taggy chatbot and restores body scroll', () => {
      window.innerWidth = 375;
      render(<TaggyChatbot />);

      fireEvent.click(screen.getByRole('button', { name: /open taggy ai chatbot/i }));
      expect(screen.getByRole('dialog', { name: /taggy ai companion chat/i })).toBeInTheDocument();
      expect(document.body.style.overflow).toBe('hidden');

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByRole('dialog', { name: /taggy ai companion chat/i })).not.toBeInTheDocument();
      expect(document.body.style.overflow).toBe('');
    });
  });

  // ── 2. Mobile Navigation Links Tests ──
  describe('Mobile Hamburger Navigation Links', () => {
    const mockLaunchDashboard = jest.fn();
    const mockOpenAuth = jest.fn();

    test('hamburger drawer opens, items are clickable, and section navigation executes cleanly', async () => {
      render(
        <LandingPage
          onLaunchDashboard={mockLaunchDashboard}
          onOpenAuth={mockOpenAuth}
        />
      );

      // Open hamburger menu
      const toggle = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(toggle);

      const drawer = screen.getByRole('dialog', { name: 'Mobile Navigation' });
      expect(drawer).toBeInTheDocument();
      expect(document.body.style.overflow).toBe('hidden');

      // Test "How it works" link
      const howItWorksLink = within(drawer).getByRole('link', { name: /how it works/i });
      fireEvent.click(howItWorksLink);

      expect(document.body.style.overflow).toBe('');
      expect(window.history.pushState).toHaveBeenCalledWith(null, '', '#how-it-works');
      expect(window.scrollTo).toHaveBeenCalled();

      // Drawer closes after navigation
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Mobile Navigation' })).not.toBeInTheDocument();
      });
    });

    test('Features and Built by links navigate to respective section hashes', async () => {
      render(
        <LandingPage
          onLaunchDashboard={mockLaunchDashboard}
          onOpenAuth={mockOpenAuth}
        />
      );

      // Test Features
      fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }));
      let drawer = screen.getByRole('dialog', { name: 'Mobile Navigation' });
      fireEvent.click(within(drawer).getByRole('link', { name: /features/i }));

      expect(window.history.pushState).toHaveBeenCalledWith(null, '', '#features');
      expect(window.scrollTo).toHaveBeenCalled();

      // Test Built by
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Mobile Navigation' })).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }));
      drawer = screen.getByRole('dialog', { name: 'Mobile Navigation' });
      fireEvent.click(within(drawer).getByRole('link', { name: /built by/i }));

      expect(window.history.pushState).toHaveBeenCalledWith(null, '', '#team');
      expect(window.scrollTo).toHaveBeenCalled();
    });

    test('Go to Dashboard button in mobile drawer launches dashboard and restores scroll', () => {
      render(
        <LandingPage
          onLaunchDashboard={mockLaunchDashboard}
          onOpenAuth={mockOpenAuth}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }));
      const drawer = screen.getByRole('dialog', { name: 'Mobile Navigation' });

      const ctaBtn = within(drawer).getByRole('button', { name: /open dashboard/i });
      fireEvent.click(ctaBtn);

      expect(mockLaunchDashboard).toHaveBeenCalledTimes(1);
      expect(document.body.style.overflow).toBe('');
      expect(screen.queryByRole('dialog', { name: 'Mobile Navigation' })).not.toBeInTheDocument();
    });

    test('Sign In button in mobile drawer opens auth modal and restores scroll', () => {
      render(
        <LandingPage
          onLaunchDashboard={mockLaunchDashboard}
          onOpenAuth={mockOpenAuth}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }));
      const drawer = screen.getByRole('dialog', { name: 'Mobile Navigation' });

      const signInBtn = within(drawer).getByRole('button', { name: /sign in/i });
      fireEvent.click(signInBtn);

      expect(mockOpenAuth).toHaveBeenCalledTimes(1);
      expect(document.body.style.overflow).toBe('');
    });
  });

  // ── 3. Simulation Controls Tests ──
  describe('Hero Routine Simulation Controls', () => {
    test('renders all 4 day tabs with accessible labels and allows switching days', () => {
      render(<HeroRoutineSimulation />);

      const tab1 = screen.getByRole('tab', { name: /Day 1/i });
      const tab2 = screen.getByRole('tab', { name: /Day 2/i });
      const tab3 = screen.getByRole('tab', { name: /Day 3/i });
      const tab4 = screen.getByRole('tab', { name: /Day 4/i });

      expect(tab1).toBeInTheDocument();
      expect(tab2).toBeInTheDocument();
      expect(tab3).toBeInTheDocument();
      expect(tab4).toBeInTheDocument();

      // Click Day 3
      fireEvent.click(tab3);
      expect(tab3).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText(/Routine learned ✓/i)).toBeInTheDocument();

      // Click Day 4
      fireEvent.click(tab4);
      expect(tab4).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText(/Unexpected route detected/i)).toBeInTheDocument();
    });

    test('playback controls have Pause/Play and Restart with accessible labels', () => {
      render(<HeroRoutineSimulation />);

      // Play/Pause button
      const playBtn = screen.getByRole('button', { name: /^(Play|Pause) demonstration/i });
      expect(playBtn).toBeInTheDocument();

      // Restart button
      const resetBtn = screen.getByRole('button', { name: /Replay demonstration from Day 1/i });
      expect(resetBtn).toBeInTheDocument();
      expect(screen.getByText('Restart')).toBeInTheDocument();

      // Tapping restart resets to Day 1
      fireEvent.click(resetBtn);
      const tab1 = screen.getByRole('tab', { name: /Day 1/i });
      expect(tab1).toHaveAttribute('aria-selected', 'true');
    });
  });
});
