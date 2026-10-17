import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import LandingPage from './LandingPage';

describe('CareTag Mobile Landing Page Refinement & Interaction Tests', () => {
  const mockOnLaunchDashboard = jest.fn();
  const mockOnOpenAuth = jest.fn();
  const mockOnOpenInspector = jest.fn();
  const mockOnLogout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    window.scrollTo = jest.fn();
    window.history.pushState = jest.fn();
  });

  afterEach(() => {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  });

  // ── 1. Mobile Header & Proportions ──
  describe('Mobile Header & Proportions', () => {
    test('renders CareTag logo, compact Dashboard button, and hamburger toggle', () => {
      render(
        <LandingPage
          onLaunchDashboard={mockOnLaunchDashboard}
          onOpenAuth={mockOnOpenAuth}
          onOpenInspector={mockOnOpenInspector}
        />
      );

      const header = screen.getByRole('banner');
      expect(within(header).getByTitle('CareTag Home')).toBeInTheDocument();

      // Compact Dashboard button exists with compact text
      const dashboardBtn = within(header).getByRole('button', { name: /Open dashboard/i });
      expect(dashboardBtn).toBeInTheDocument();
      expect(dashboardBtn.querySelector('.btn-cta-text-compact')).toHaveTextContent('Dashboard');

      // Hamburger button exists with accessible label
      const hamburgerBtn = screen.getByRole('button', { name: /Open navigation menu/i });
      expect(hamburgerBtn).toBeInTheDocument();
      expect(hamburgerBtn).toHaveAttribute('aria-expanded', 'false');
    });

    test('clicking header dashboard button invokes onLaunchDashboard', () => {
      render(
        <LandingPage
          onLaunchDashboard={mockOnLaunchDashboard}
          onOpenAuth={mockOnOpenAuth}
        />
      );

      const header = screen.getByRole('banner');
      const dashboardBtn = within(header).getByRole('button', { name: /Open dashboard/i });
      fireEvent.click(dashboardBtn);
      expect(mockOnLaunchDashboard).toHaveBeenCalledTimes(1);
    });
  });

  // ── 2. Hamburger Navigation & Interaction Fixes ──
  describe('Hamburger Navigation & Interaction Fixes', () => {
    test('opens mobile drawer when hamburger toggle is tapped and locks body overflow', () => {
      render(
        <LandingPage
          onLaunchDashboard={mockOnLaunchDashboard}
          onOpenAuth={mockOnOpenAuth}
        />
      );

      const hamburgerBtn = screen.getByRole('button', { name: /Open navigation menu/i });
      fireEvent.click(hamburgerBtn);

      // Drawer dialog is visible
      const drawer = screen.getByRole('dialog', { name: 'Mobile Navigation' });
      expect(drawer).toBeInTheDocument();
      expect(screen.getByText('Menu')).toBeInTheDocument();
      expect(document.body.style.overflow).toBe('hidden');
    });

    test('drawer close button (X) closes menu and restores body scroll', () => {
      render(
        <LandingPage
          onLaunchDashboard={mockOnLaunchDashboard}
          onOpenAuth={mockOnOpenAuth}
        />
      );

      // Open drawer
      fireEvent.click(screen.getByRole('button', { name: /Open navigation menu/i }));
      const drawer = screen.getByRole('dialog', { name: 'Mobile Navigation' });
      expect(drawer).toBeInTheDocument();

      // Click Close button inside drawer header
      const closeBtn = within(drawer).getByRole('button', { name: /Close navigation menu/i });
      fireEvent.click(closeBtn);

      expect(screen.queryByRole('dialog', { name: 'Mobile Navigation' })).not.toBeInTheDocument();
      expect(document.body.style.overflow).toBe('');
    });

    test('backdrop click closes menu and restores body scroll', () => {
      const { container } = render(
        <LandingPage
          onLaunchDashboard={mockOnLaunchDashboard}
          onOpenAuth={mockOnOpenAuth}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Open navigation menu/i }));
      const backdrop = container.querySelector('.mobile-menu-backdrop');
      expect(backdrop).toBeInTheDocument();

      fireEvent.click(backdrop);
      expect(screen.queryByRole('dialog', { name: 'Mobile Navigation' })).not.toBeInTheDocument();
      expect(document.body.style.overflow).toBe('');
    });

    test('Escape key closes menu and restores body scroll', () => {
      render(
        <LandingPage
          onLaunchDashboard={mockOnLaunchDashboard}
          onOpenAuth={mockOnOpenAuth}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Open navigation menu/i }));
      expect(screen.getByRole('dialog', { name: 'Mobile Navigation' })).toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByRole('dialog', { name: 'Mobile Navigation' })).not.toBeInTheDocument();
      expect(document.body.style.overflow).toBe('');
    });

    test('drawer "How it works" link scrolls to #how-it-works, updates hash, and restores scroll', async () => {
      render(
        <LandingPage
          onLaunchDashboard={mockOnLaunchDashboard}
          onOpenAuth={mockOnOpenAuth}
        />
      );

      // Open drawer
      fireEvent.click(screen.getByRole('button', { name: /Open navigation menu/i }));
      const drawer = screen.getByRole('dialog', { name: 'Mobile Navigation' });

      // Click "How it works"
      const link = within(drawer).getByRole('link', { name: /How it works/i });
      fireEvent.click(link);

      // Verify scroll lock released immediately
      expect(document.body.style.overflow).toBe('');
      expect(window.history.pushState).toHaveBeenCalledWith(null, '', '#how-it-works');

      // Verify window.scrollTo was called
      expect(window.scrollTo).toHaveBeenCalled();

      // Drawer closes after animation frame
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Mobile Navigation' })).not.toBeInTheDocument();
      });
    });

    test('drawer "Features" link scrolls to #features and updates hash', async () => {
      render(
        <LandingPage
          onLaunchDashboard={mockOnLaunchDashboard}
          onOpenAuth={mockOnOpenAuth}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Open navigation menu/i }));
      const drawer = screen.getByRole('dialog', { name: 'Mobile Navigation' });

      const link = within(drawer).getByRole('link', { name: /Features/i });
      fireEvent.click(link);

      expect(document.body.style.overflow).toBe('');
      expect(window.history.pushState).toHaveBeenCalledWith(null, '', '#features');
      expect(window.scrollTo).toHaveBeenCalled();

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Mobile Navigation' })).not.toBeInTheDocument();
      });
    });

    test('drawer "Built by" link scrolls to #team and updates hash', async () => {
      render(
        <LandingPage
          onLaunchDashboard={mockOnLaunchDashboard}
          onOpenAuth={mockOnOpenAuth}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Open navigation menu/i }));
      const drawer = screen.getByRole('dialog', { name: 'Mobile Navigation' });

      const link = within(drawer).getByRole('link', { name: /Built by/i });
      fireEvent.click(link);

      expect(document.body.style.overflow).toBe('');
      expect(window.history.pushState).toHaveBeenCalledWith(null, '', '#team');
      expect(window.scrollTo).toHaveBeenCalled();

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Mobile Navigation' })).not.toBeInTheDocument();
      });
    });

    test('drawer "Go to Dashboard" button executes onLaunchDashboard and closes drawer', () => {
      render(
        <LandingPage
          onLaunchDashboard={mockOnLaunchDashboard}
          onOpenAuth={mockOnOpenAuth}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Open navigation menu/i }));
      const drawer = screen.getByRole('dialog', { name: 'Mobile Navigation' });

      const ctaBtn = within(drawer).getByRole('button', { name: /Open dashboard/i });
      fireEvent.click(ctaBtn);

      expect(mockOnLaunchDashboard).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog', { name: 'Mobile Navigation' })).not.toBeInTheDocument();
      expect(document.body.style.overflow).toBe('');
    });

    test('drawer "Sign in" button executes onOpenAuth and closes drawer', () => {
      render(
        <LandingPage
          onLaunchDashboard={mockOnLaunchDashboard}
          onOpenAuth={mockOnOpenAuth}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Open navigation menu/i }));
      const drawer = screen.getByRole('dialog', { name: 'Mobile Navigation' });

      const signInBtn = within(drawer).getByRole('button', { name: /^Sign in$/i });
      fireEvent.click(signInBtn);

      expect(mockOnOpenAuth).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog', { name: 'Mobile Navigation' })).not.toBeInTheDocument();
      expect(document.body.style.overflow).toBe('');
    });

    test('drawer renders signed-in caregiver profile and launches dashboard when tapped', () => {
      const mockSession = {
        name: 'Bhavishya Singla',
        email: 'singla_be23@thapar.edu',
        role: 'admin'
      };

      render(
        <LandingPage
          onLaunchDashboard={mockOnLaunchDashboard}
          onOpenAuth={mockOnOpenAuth}
          session={mockSession}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Open navigation menu/i }));
      const drawer = screen.getByRole('dialog', { name: 'Mobile Navigation' });

      const userCard = within(drawer).getByRole('button', { name: /Bhavishya Singla/i });
      expect(userCard).toBeInTheDocument();
      expect(within(userCard).getByText('Caregiver')).toBeInTheDocument();

      fireEvent.click(userCard);
      expect(mockOnLaunchDashboard).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog', { name: 'Mobile Navigation' })).not.toBeInTheDocument();
    });
  });

  // ── 3. Routine Simulation Presentation ──
  describe('Hero Routine Simulation Presentation', () => {
    test('renders Day 1 to Day 4 selectors and allows switching between days', () => {
      render(
        <LandingPage
          onLaunchDashboard={mockOnLaunchDashboard}
          onOpenAuth={mockOnOpenAuth}
        />
      );

      const day1 = screen.getByRole('tab', { name: /Day 1/i });
      const day2 = screen.getByRole('tab', { name: /Day 2/i });
      const day3 = screen.getByRole('tab', { name: /Day 3/i });
      const day4 = screen.getByRole('tab', { name: /Day 4/i });

      expect(day1).toBeInTheDocument();
      expect(day2).toBeInTheDocument();
      expect(day3).toBeInTheDocument();
      expect(day4).toBeInTheDocument();

      // Click Day 2
      fireEvent.click(day2);
      expect(day2).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText(/Routine becoming familiar/i)).toBeInTheDocument();

      // Click Day 3
      fireEvent.click(day3);
      expect(day3).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText(/Routine learned ✓/i)).toBeInTheDocument();

      // Click Day 4
      fireEvent.click(day4);
      expect(day4).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText(/Unexpected route detected/i)).toBeInTheDocument();
    });

    test('renders playback and reset controls', () => {
      render(
        <LandingPage
          onLaunchDashboard={mockOnLaunchDashboard}
          onOpenAuth={mockOnOpenAuth}
        />
      );

      expect(screen.getByRole('button', { name: /^(Play|Pause) demonstration/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Replay demonstration from Day 1/i })).toBeInTheDocument();
    });

    test('renders Home and School geofence labels, map anchors, and student avatar', () => {
      render(
        <LandingPage
          onLaunchDashboard={mockOnLaunchDashboard}
          onOpenAuth={mockOnOpenAuth}
        />
      );

      expect(screen.getByText('Home Geofence')).toBeInTheDocument();
      expect(screen.getByText('School Geofence')).toBeInTheDocument();
      expect(screen.getByAltText('Home Safe Zone')).toBeInTheDocument();
      expect(screen.getByAltText('School Safe Zone')).toBeInTheDocument();
      expect(screen.getByAltText('Student traveling')).toBeInTheDocument();
    });

    test('renders Learn, Recognize, and Alert story cards', () => {
      render(
        <LandingPage
          onLaunchDashboard={mockOnLaunchDashboard}
          onOpenAuth={mockOnOpenAuth}
        />
      );

      expect(screen.getByRole('heading', { name: 'Learn' })).toBeInTheDocument();
      expect(screen.getByText('CareTag observes the usual journey.')).toBeInTheDocument();

      expect(screen.getByRole('heading', { name: 'Recognize' })).toBeInTheDocument();
      expect(screen.getByText('Three consistent days establish the routine.')).toBeInTheDocument();

      expect(screen.getByRole('heading', { name: 'Alert' })).toBeInTheDocument();
      expect(screen.getByText('An unexpected route triggers a deviation alert.')).toBeInTheDocument();
    });
  });

  // ── 4. Mobile CTA Section Order ──
  describe('CTA Section Structure & Functionality', () => {
    test('renders READY TO EXPLORE badge, 3D illustration, heading, description, and both buttons', () => {
      render(
        <LandingPage
          onLaunchDashboard={mockOnLaunchDashboard}
          onOpenAuth={mockOnOpenAuth}
        />
      );

      const ctaSection = document.getElementById('action-cta');
      expect(ctaSection).toBeInTheDocument();

      // 1. Badge
      expect(within(ctaSection).getByText('READY TO EXPLORE')).toBeInTheDocument();

      // 2. Illustration
      const previewImg = within(ctaSection).getByAltText(/CareTag routine monitoring dashboard preview/i);
      expect(previewImg).toBeInTheDocument();

      // 3. Heading
      expect(within(ctaSection).getByRole('heading', { name: /See CareTag in action\./i })).toBeInTheDocument();

      // 4. Description
      expect(within(ctaSection).getByText(/Explore safe zones, routine-aware monitoring, and contextual alerts/i)).toBeInTheDocument();

      // 5. Open Dashboard button
      const openDashBtn = within(ctaSection).getByRole('button', { name: /Open dashboard/i });
      expect(openDashBtn).toBeInTheDocument();
      fireEvent.click(openDashBtn);
      expect(mockOnLaunchDashboard).toHaveBeenCalled();

      // 6. Try interactive demo button
      const demoBtn = within(ctaSection).getByRole('button', { name: /Try the interactive demo/i });
      expect(demoBtn).toBeInTheDocument();
      fireEvent.click(demoBtn);
      expect(window.scrollTo).toHaveBeenCalled();
    });
  });

  // ── 5. Symmetrical Mobile Footer ──
  describe('Symmetrical Mobile Footer', () => {
    test('renders Brand block (logo + tagline), 5 navigation links, copyright, divider, and legal links', () => {
      const { container } = render(
        <LandingPage
          onLaunchDashboard={mockOnLaunchDashboard}
          onOpenAuth={mockOnOpenAuth}
        />
      );

      const footer = container.querySelector('.landing-footer');
      expect(footer).toBeInTheDocument();

      // 1. Brand lockup
      expect(within(footer).getByText(/Safety Beyond Boundaries/i)).toBeInTheDocument();

      // 2. Navigation links (5 items)
      expect(within(footer).getByRole('link', { name: 'How it works' })).toBeInTheDocument();
      expect(within(footer).getByRole('link', { name: 'Features' })).toBeInTheDocument();
      expect(within(footer).getByRole('link', { name: 'Built by' })).toBeInTheDocument();
      expect(within(footer).getByRole('button', { name: 'Open dashboard' })).toBeInTheDocument();
      expect(within(footer).getByRole('button', { name: 'Sign in' })).toBeInTheDocument();

      // 3. Copyright
      expect(within(footer).getByText(/© 2026 CareTag\. All rights reserved\./i)).toBeInTheDocument();

      // 4. Legal divider
      expect(footer.querySelector('.footer-legal-divider')).toBeInTheDocument();

      // 5. Legal links
      expect(within(footer).getByRole('button', { name: 'Privacy Policy' })).toBeInTheDocument();
      expect(within(footer).getByRole('button', { name: 'Terms of Service' })).toBeInTheDocument();
      expect(within(footer).getByRole('button', { name: 'Safety Disclaimer' })).toBeInTheDocument();
    });

    test('legal links dispatch caretag:open-legal event with correct tab', () => {
      const eventSpy = jest.fn();
      window.addEventListener('caretag:open-legal', eventSpy);

      const { container } = render(
        <LandingPage
          onLaunchDashboard={mockOnLaunchDashboard}
          onOpenAuth={mockOnOpenAuth}
        />
      );

      const footer = container.querySelector('.landing-footer');
      const privacyBtn = within(footer).getByRole('button', { name: 'Privacy Policy' });
      fireEvent.click(privacyBtn);

      expect(eventSpy).toHaveBeenCalled();
      const customEvent = eventSpy.mock.calls[0][0];
      expect(customEvent.detail.tab).toBe('privacy');

      window.removeEventListener('caretag:open-legal', eventSpy);
    });
  });

  // ── 6. Mobile Viewport Adaptability Matrix ──
  describe('Mobile Viewport Adaptability Matrix', () => {
    const viewports = [
      { width: 320, height: 568, name: '320px (iPhone SE 1st gen)' },
      { width: 360, height: 640, name: '360px (Compact Android)' },
      { width: 375, height: 667, name: '375px (iPhone SE 2nd/3rd gen)' },
      { width: 390, height: 844, name: '390px (iPhone 12/13/14)' },
      { width: 412, height: 915, name: '412px (Samsung Galaxy S20+)' },
      { width: 430, height: 932, name: '430px (iPhone 14/15 Pro Max)' },
      { width: 1280, height: 800, name: '1280px (Standard Desktop Baseline)' },
    ];

    viewports.forEach(({ width, height, name }) => {
      test(`mounts and operates cleanly at ${name}`, () => {
        window.innerWidth = width;
        window.innerHeight = height;
        window.dispatchEvent(new Event('resize'));

        const { container } = render(
          <LandingPage
            onLaunchDashboard={mockOnLaunchDashboard}
            onOpenAuth={mockOnOpenAuth}
          />
        );

        expect(container.querySelector('.landing-page')).toBeInTheDocument();
        expect(container.querySelector('.floating-header')).toBeInTheDocument();
        expect(container.querySelector('.sim-story-container')).toBeInTheDocument();
        expect(container.querySelector('.final-cta-panel')).toBeInTheDocument();
        expect(container.querySelector('.landing-footer')).toBeInTheDocument();
      });
    });
  });
});
