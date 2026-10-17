import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, Activity, Bell, Compass, ArrowRight,
  ShieldAlert, Sparkles, Menu, X
} from 'lucide-react';
import taggyImg from '../assets/taggy.png';
import CareTagLogo from './CareTagLogo';
import HeroRoutineSimulation from './HeroRoutineSimulation';

// Team member profile photos
import bhavishyaImg from '../assets/team/bhavishya-singla.png';
import manyaImg from '../assets/team/manya-sharma.png';
import guneevImg from '../assets/team/guneev-taneja.png';
import anureetImg from '../assets/team/anureet.jpg';
import kinjalImg from '../assets/team/kinjal.jpg';

// Standard LinkedIn brand icon
function LinkedinIcon({ size = 14, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.64a1.65 1.65 0 0 0-1.66 1.66 1.66 1.66 0 0 0 1.66 1.66 1.66 1.66 0 0 0 1.66-1.66c0-.92-.74-1.66-1.66-1.66Z" />
    </svg>
  );
}

// Verified Capstone Project Team (Thapar Institute of Engineering & Technology, Batch of 2027)
const teamMembers = [
  {
    id: 1,
    name: 'Bhavishya Singla',
    initials: 'BS',
    role: 'Computer Engineering',
    image: bhavishyaImg,
    linkedin: 'https://www.linkedin.com/in/bhavishyasingla1/',
  },
  {
    id: 2,
    name: 'Manya Sharma',
    initials: 'MS',
    role: 'Computer Engineering',
    image: manyaImg,
    linkedin: 'https://www.linkedin.com/in/manya-sharma-0568112a6/',
  },
  {
    id: 3,
    name: 'Guneev Taneja',
    initials: 'GT',
    role: 'Computer Engineering',
    image: guneevImg,
    linkedin: 'https://www.linkedin.com/in/guneev-taneja-97b7a11aa/',
  },
  {
    id: 4,
    name: 'Anureet',
    initials: 'AN',
    role: 'Computer Engineering',
    image: anureetImg,
    linkedin: 'https://www.linkedin.com/in/anureet-sokhal/',
  },
  {
    id: 5,
    name: 'Kinjal',
    initials: 'KS',
    role: 'Computer Engineering',
    image: kinjalImg,
    linkedin: 'https://www.linkedin.com/in/kinjal-tiet/',
  },
];

/**
 * CareTag Public Homepage
 *
 * Implements strict brand guidelines: Poppins typography, CareTag Navy (#0B2D5B),
 * CareTag Blue (#2563EB), Mint/Teal (#14B8A6), ample vertical spacing,
 * and clear visual hierarchy.
 */
export default function LandingPage({ onLaunchDashboard, onOpenAuth, session }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const userName = session?.childName || session?.name || 'Bhavishya Singla';
  const userInitial = (userName && userName.charAt(0).toUpperCase()) || 'B';
  // On initial page load/refresh, reset window scroll to top
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
      }
      window.scrollTo(0, 0);
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on resize beyond tablet/mobile breakpoint
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavClick = useCallback((targetId) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(targetId);
    if (element) {
      const headerOffset = 76;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: 'smooth'
      });
    }
  }, []);

  return (
    <div className="landing-page">
      {/* ── 1. Floating Frosted-Glass Header ── */}
      <div className="floating-header-wrapper">
        <header className={`floating-header ${scrolled ? 'is-scrolled' : ''}`}>
          {/* Logo on the left */}
          <div
            className="floating-brand"
            onClick={() => {
              setMobileMenuOpen(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            title="CareTag Home"
          >
            <CareTagLogo variant="horizontal" size="sm" showTagline={false} />
          </div>

          {/* Navigation links in the middle (Desktop & Tablet) */}
          <nav className="floating-nav" aria-label="Main Navigation">
            <a
              href="#how-it-works"
              className="floating-nav-link"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick('how-it-works');
              }}
            >
              How it works
            </a>
            <a
              href="#features"
              className="floating-nav-link"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick('features');
              }}
            >
              Features
            </a>
            <a
              href="#team"
              className="floating-nav-link"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick('team');
              }}
            >
              Built by
            </a>
          </nav>

          {/* Actions on the right */}
          <div className="floating-actions">
            {session ? (
              <button
                type="button"
                className="floating-signin-link floating-user-pill"
                onClick={onLaunchDashboard}
                title={`Signed in as ${userName}`}
              >
                <span className="header-avatar-circle">{userInitial}</span>
                <span>{userName}</span>
              </button>
            ) : (
              <button
                type="button"
                className="floating-signin-link"
                onClick={onOpenAuth}
              >
                Sign in
              </button>
            )}

            <button
              type="button"
              className="btn-floating-pill-cta"
              onClick={onLaunchDashboard}
            >
              <span>{session ? 'Go to Dashboard' : 'Open dashboard'}</span>
              <ArrowRight size={14} />
            </button>

            {/* Mobile Hamburger / Close Toggle Button */}
            <button
              type="button"
              className="floating-mobile-toggle"
              onClick={() => setMobileMenuOpen(open => !open)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              title={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </header>

        {/* ── Mobile Navigation Dropdown Sheet ── */}
        {mobileMenuOpen && (
          <div className="floating-mobile-menu" role="dialog" aria-modal="true" aria-label="Mobile Navigation">
            <nav className="mobile-menu-links">
              <a
                href="#how-it-works"
                className="mobile-menu-link"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('how-it-works');
                }}
              >
                <Compass size={17} className="text-blue" />
                <span>How it works</span>
              </a>
              <a
                href="#features"
                className="mobile-menu-link"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('features');
                }}
              >
                <Activity size={17} className="text-teal" />
                <span>Features</span>
              </a>
              <a
                href="#team"
                className="mobile-menu-link"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('team');
                }}
              >
                <Shield size={17} className="text-blue" />
                <span>Built by</span>
              </a>
            </nav>

            <div className="mobile-menu-divider" />

            <div className="mobile-menu-actions">
              {session ? (
                <button
                  type="button"
                  className="mobile-menu-user-btn"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLaunchDashboard();
                  }}
                >
                  <span className="header-avatar-circle">{userInitial}</span>
                  <div className="mobile-user-info">
                    <strong>{userName}</strong>
                    <span>Logged In Profile</span>
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-mobile-secondary"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth();
                  }}
                >
                  Sign in
                </button>
              )}

              <button
                type="button"
                className="btn-hero-primary mobile-menu-cta"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLaunchDashboard();
                }}
              >
                <span>{session ? 'Go to Dashboard' : 'Open dashboard'}</span>
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                className="mobile-taggy-btn"
                onClick={() => {
                  setMobileMenuOpen(false);
                  window.dispatchEvent(new CustomEvent('caretag:open-taggy'));
                }}
              >
                <Sparkles size={15} />
                <span>Chat with Taggy Safety AI</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 2. Modern Airy Hero Section ── */}
      <section className="hero-section">
        <div className="hero-container">
          {/* Main Hero Headline */}
          <h1 className="hero-title">
            Safety that understands <span className="hero-title-highlight">routines.</span>
          </h1>

          {/* Concise Subhead */}
          <p className="hero-subtitle">
            Routine-aware location monitoring that helps caregivers notice unexpected movement.
          </p>

          {/* Centered CTA Row */}
          <div className="hero-cta-row">
            <button
              type="button"
              className="btn-hero-primary"
              onClick={onLaunchDashboard}
            >
              <span>Open dashboard</span>
              <ArrowRight size={16} />
            </button>

            <button
              type="button"
              className="btn-hero-secondary"
              onClick={() => handleNavClick('routine-demo')}
            >
              <span>See how it works &darr;</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── 3. Visual 4-Day Routine Awareness Demonstration (Home ↔ School) ── */}
      <section id="routine-demo" className="routine-demo-section">
        <div className="section-container">
          <div className="section-header text-center">
            <div className="section-eyebrow-pill">
              <Activity size={13} />
              <span>INTERACTIVE DEMO</span>
            </div>
            <h2 className="section-title">See how a routine becomes familiar.</h2>
            <p className="section-lead">
              Explore how CareTag compares a usual route with an unexpected change.
            </p>
          </div>

          <div className="showcase-demo-wrapper">
            <div className="showcase-demo-frame">
              <div className="showcase-demo-header-bar">
                <div className="showcase-demo-tag">
                  <span className="showcase-pulse-dot" />
                  <span>Routine-Learning Model &bull; Interactive 4-Day Simulation</span>
                </div>
                <div className="showcase-demo-badge">
                  <span>Interactive Prototype</span>
                </div>
              </div>

              {/* 4-Day Interactive Simulation */}
              <HeroRoutineSimulation />
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Three Steps to Routine Awareness ── */}
      <section id="how-it-works" className="how-it-works-section">
        <div className="section-container">
          <div className="section-header text-center">
            <div className="section-eyebrow-pill">
              <Compass size={13} />
              <span>THREE-STEP METHODOLOGY</span>
            </div>
            <h2 className="section-title">Three steps to routine awareness</h2>
            <p className="section-lead">
              From daily habits to clear, contextual safety alerts without overwhelming the caregiver.
            </p>
          </div>

          <div className="steps-grid">
            {/* Step 1 */}
            <div className="step-card">
              <div className="step-card-top">
                <div className="step-icon-box step-icon-blue">
                  <Compass size={22} />
                </div>
                <span className="step-number-indicator">01</span>
              </div>
              <h3 className="step-card-title">Learn movement patterns</h3>
              <p className="step-card-desc">
                CareTag uses location history to learn familiar places and usual routes.
              </p>
            </div>

            {/* Step 2 */}
            <div className="step-card">
              <div className="step-card-top">
                <div className="step-icon-box step-icon-teal">
                  <Activity size={22} />
                </div>
                <span className="step-number-indicator">02</span>
              </div>
              <h3 className="step-card-title">Check location and routine</h3>
              <p className="step-card-desc">
                It checks safe-zone boundaries and routine deviations independently.
              </p>
            </div>

            {/* Step 3 */}
            <div className="step-card">
              <div className="step-card-top">
                <div className="step-icon-box step-icon-indigo">
                  <Bell size={22} />
                </div>
                <span className="step-number-indicator">03</span>
              </div>
              <h3 className="step-card-title">Show useful context</h3>
              <p className="step-card-desc">
                Caregivers see the deviation score and location details behind an alert.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. What Makes CareTag Different ── */}
      <section id="features" className="different-section">
        <div className="section-container">
          <div className="section-header text-center">
            <div className="section-eyebrow-pill">
              <ShieldAlert size={13} />
              <span>THE CAREGIVER ADVANTAGE</span>
            </div>
            <h2 className="section-title">Location is only half the picture.</h2>
            <p className="section-lead">
              CareTag checks location boundaries and learned routines to give caregivers more context.
            </p>
          </div>

          <div className="different-grid">
            <div className="different-card">
              <div className="different-card-icon icon-blue">
                <Activity size={22} />
              </div>
              <h3 className="different-card-title">Routine-aware</h3>
              <p className="different-card-desc">
                Considers when and where a person usually moves, not just their current position.
              </p>
            </div>

            <div className="different-card">
              <div className="different-card-icon icon-rose">
                <ShieldAlert size={22} />
              </div>
              <h3 className="different-card-title">Two independent checks</h3>
              <p className="different-card-desc">
                Safe-zone breaches and unusual movement can each trigger an alert.
              </p>
            </div>

            <div className="different-card">
              <div className="different-card-icon icon-teal">
                <Shield size={22} />
              </div>
              <h3 className="different-card-title">Contextual, calm alerts</h3>
              <p className="different-card-desc">
                A deviation score and location details help caregivers review what changed.
              </p>
            </div>
          </div>

          <div className="different-footnote">
            <p>Note: A deviation score signals an unexpected departure from a habitual daily routine and is not proof of danger.</p>
          </div>
        </div>
      </section>

      {/* ── 6. Taggy: Balanced Clean Companion Banner ── */}
      <section className="taggy-strip-section">
        <div className="section-container">
          <div className="taggy-strip-card">
            <div className="taggy-strip-media">
              <img
                src={taggyImg}
                alt="Taggy, the CareTag safety companion robot"
                className="taggy-strip-img"
              />
            </div>
            <div className="taggy-strip-main">
              <div className="taggy-pill-label">
                <Sparkles size={13} />
                <span>YOUR CARETAG COMPANION</span>
              </div>
              <h3 className="taggy-strip-title">Meet Taggy.</h3>
              <p className="taggy-strip-desc">
                Get help understanding safe places, routine learning, and CareTag alerts.
              </p>
            </div>
            <div className="taggy-strip-action">
              <button
                type="button"
                className="taggy-strip-btn"
                onClick={() => window.dispatchEvent(new CustomEvent('caretag:open-taggy'))}
                title="Ask Taggy a question"
              >
                <Sparkles size={14} />
                <span>Ask Taggy a question</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. Built By: University Capstone Team Section ── */}
      <section id="team" className="team-section">
        <div className="section-container">
          <div className="section-header text-center">
            <div className="section-eyebrow-pill">
              <span>BATCH OF 2027</span>
            </div>
            <h2 className="section-title">Built by the CareTag team</h2>
            <p className="section-lead team-subtitle">
              Thapar Institute of Engineering &amp; Technology &bull; Computer Engineering Capstone Project
            </p>
          </div>

          <div className="team-grid">
            {teamMembers.map((member) => (
              <div key={member.id} className="team-card">
                <div className="team-avatar-frame">
                  {member.image ? (
                    <img
                      src={member.image}
                      alt={member.name}
                      className="team-avatar-img"
                      loading="lazy"
                    />
                  ) : (
                    <div className="team-avatar-initials">{member.initials}</div>
                  )}
                </div>
                <h3 className="team-name">{member.name}</h3>
                <span className="team-role">{member.role}</span>
                {member.linkedin && (
                  <a
                    href={member.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="team-linkedin-btn"
                    title={`View ${member.name}'s LinkedIn profile`}
                    aria-label={`${member.name} on LinkedIn`}
                  >
                    <LinkedinIcon size={13} />
                    <span>LinkedIn</span>
                  </a>
                )}
              </div>
            ))}
          </div>

          <div className="team-mentor-wrap">
            <div className="team-mentor-pill">
              <span className="team-mentor-badge">Faculty Mentors</span>
              <span className="team-mentor-text">
                <strong>Dr. Kapil Tomar</strong> &amp; <strong>Dr. Ravindra Kumar</strong>, Associate Professors, CSED
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. Final Closing CTA ── */}
      <section className="final-cta-section">
        <div className="section-container">
          <div className="final-cta-panel">
            <div className="final-cta-left">
              <div className="final-cta-eyebrow">
                <Sparkles size={13} />
                <span>READY TO EXPLORE</span>
              </div>
              <h2 className="final-cta-title">See CareTag in action.</h2>
              <p className="final-cta-desc">
                Explore safe zones, routine-aware monitoring, and contextual alerts in the dashboard.
              </p>
              <div className="final-cta-btn-group">
                <button
                  type="button"
                  className="btn-hero-primary final-cta-primary-btn"
                  onClick={onLaunchDashboard}
                >
                  <span>Open dashboard</span>
                  <ArrowRight size={16} />
                </button>
                <button
                  type="button"
                  className="final-cta-secondary-btn"
                  onClick={() => handleNavClick('routine-demo')}
                >
                  <span>Try the interactive demo</span>
                </button>
              </div>
            </div>

            <div className="final-cta-right" aria-hidden="true">
              <div className="preview-product-card">
                <div className="preview-card-header">
                  <div className="preview-card-dots">
                    <span className="dot dot-red" />
                    <span className="dot dot-yellow" />
                    <span className="dot dot-green" />
                  </div>
                  <span className="preview-card-title">CareTag Dashboard &bull; Live Preview</span>
                  <span className="preview-status-pill">Interactive Demo</span>
                </div>
                <div className="preview-card-body">
                  <div className="preview-map-mock">
                    <div className="preview-zone zone-home">
                      <span className="preview-zone-dot" />
                      <span>Home</span>
                    </div>
                    <div className="preview-corridor" />
                    <div className="preview-zone zone-school">
                      <span className="preview-zone-dot" />
                      <span>School</span>
                    </div>
                    <div className="preview-device-pin">
                      <span className="pin-pulse" />
                      <span className="pin-core" />
                    </div>
                  </div>
                  <div className="preview-telemetry-row">
                    <div className="preview-chip">
                      <span className="chip-dot dot-green" />
                      <span>ESP32 Band: Connected</span>
                    </div>
                    <div className="preview-chip">
                      <span>Battery: 92%</span>
                    </div>
                    <div className="preview-chip chip-highlight">
                      <span>Deviation score: 0.12 (Nominal)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 9. Minimal Clean Light Footer ── */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-main">
            <div className="footer-brand-lockup">
              <CareTagLogo
                variant="horizontal"
                size="sm"
                showTagline={false}
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              />
              <span className="footer-brand-divider" aria-hidden="true">/</span>
              <span className="footer-tagline">Safety Beyond Boundaries</span>
            </div>

            <nav className="footer-nav" aria-label="Footer Navigation">
              <a
                href="#how-it-works"
                className="footer-nav-link"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('how-it-works');
                }}
              >
                How it works
              </a>
              <a
                href="#features"
                className="footer-nav-link"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('features');
                }}
              >
                Features
              </a>
              <a
                href="#team"
                className="footer-nav-link"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('team');
                }}
              >
                Built by
              </a>
              <button type="button" className="footer-nav-btn" onClick={onLaunchDashboard}>
                Open dashboard
              </button>
              <button type="button" className="footer-nav-btn" onClick={onOpenAuth}>
                Sign in
              </button>
            </nav>
          </div>

          <div className="footer-bottom">
            <p className="footer-copyright">&copy; {new Date().getFullYear()} CareTag. All rights reserved.</p>
            <div className="footer-legal-links" aria-label="Legal and Compliance">
              <button
                type="button"
                className="footer-legal-link"
                onClick={() => window.dispatchEvent(new CustomEvent('caretag:open-legal', { detail: { tab: 'privacy' } }))}
              >
                Privacy Policy
              </button>
              <span className="footer-legal-dot" aria-hidden="true">&bull;</span>
              <button
                type="button"
                className="footer-legal-link"
                onClick={() => window.dispatchEvent(new CustomEvent('caretag:open-legal', { detail: { tab: 'terms' } }))}
              >
                Terms of Service
              </button>
              <span className="footer-legal-dot" aria-hidden="true">&bull;</span>
              <button
                type="button"
                className="footer-legal-link"
                onClick={() => window.dispatchEvent(new CustomEvent('caretag:open-legal', { detail: { tab: 'disclaimer' } }))}
              >
                Safety Disclaimer
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
