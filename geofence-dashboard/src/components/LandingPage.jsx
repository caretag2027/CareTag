import React, { useState, useEffect } from 'react';
import {
  Shield, Activity, Bell, Compass, ArrowRight,
  ShieldAlert, Sparkles
} from 'lucide-react';
import taggyImg from '../assets/taggy.png';
import CareTagLogo from './CareTagLogo';
import HeroRoutineSimulation from './HeroRoutineSimulation';

// Verified Capstone Project Team (Thapar Institute of Engineering & Technology, Batch of 2027)
const teamMembers = [
  { id: 1, name: 'Kinjal', initials: 'KS', role: 'Computer Engineering' },
  { id: 2, name: 'Guneev Taneja', initials: 'GT', role: 'Computer Engineering' },
  { id: 3, name: 'Bhavishya Singla', initials: 'BS', role: 'Computer Engineering' },
  { id: 4, name: 'Manya Sharma', initials: 'MS', role: 'Computer Engineering' },
  { id: 5, name: 'Anureet', initials: 'AN', role: 'Computer Engineering' },
];

/**
 * CareTag Public Homepage
 *
 * Implements strict brand guidelines: Poppins typography, CareTag Navy (#0B2D5B),
 * CareTag Blue (#2563EB), Mint/Teal (#14B8A6), ample vertical spacing,
 * and clear visual hierarchy.
 */
export default function LandingPage({ onLaunchDashboard, onOpenAuth }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="landing-page">
      {/* ── 1. Floating Frosted-Glass Header ── */}
      <div className="floating-header-wrapper">
        <header className={`floating-header ${scrolled ? 'is-scrolled' : ''}`}>
          {/* Logo on the left */}
          <div
            className="floating-brand"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            title="CareTag Home"
          >
            <CareTagLogo variant="horizontal" size="sm" showTagline={false} />
          </div>

          {/* Navigation links in the middle */}
          <nav className="floating-nav" aria-label="Main Navigation">
            <a href="#how-it-works" className="floating-nav-link">How it works</a>
            <a href="#preview" className="floating-nav-link">Features</a>
            <a href="#team" className="floating-nav-link">Built by</a>
          </nav>

          {/* Actions on the right */}
          <div className="floating-actions">
            <button
              type="button"
              className="floating-signin-link"
              onClick={onOpenAuth}
            >
              Sign in
            </button>

            <button
              type="button"
              className="btn-floating-pill-cta"
              onClick={onLaunchDashboard}
            >
              <span>Open dashboard</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </header>
      </div>

      {/* ── 2. Modern Airy Hero Section ── */}
      <section className="hero-section">
        <div className="hero-container">
          {/* Eyebrow Pill */}
          <div className="hero-eyebrow-badge">
            <span className="hero-eyebrow-dot" />
            <span>Context-Aware Child Safety &bull; Thapar University Capstone</span>
          </div>

          {/* Main Hero Headline */}
          <h1 className="hero-title">
            Safety that understands <span className="hero-title-highlight">routines.</span>
          </h1>

          {/* Concise Subhead */}
          <p className="hero-subtitle">
            Location boundaries and routine-learning intelligence to help caregivers notice unexpected movement before it becomes an emergency.
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

            <a href="#how-it-works" className="btn-hero-secondary">
              <span>See how it works &darr;</span>
            </a>
          </div>

          {/* ── 3. Visual 4-Day Routine Awareness Demonstration (Home ↔ School) ── */}
          <div className="hero-product-showcase" id="preview">
            <div className="showcase-browser-frame">
              {/* Browser chrome header for polish */}
              <div className="showcase-browser-bar">
                <div className="showcase-browser-controls">
                  <span className="browser-circle dot-red" />
                  <span className="browser-circle dot-yellow" />
                  <span className="browser-circle dot-green" />
                </div>
                <div className="showcase-browser-address">
                  caretag.app/routine-learning-demo
                </div>
                <div className="showcase-browser-status">
                  <span className="showcase-pulse-dot" />
                  <span>Interactive 4-Day Model</span>
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
                CareTag analyzes historical GPS trajectories to model recurring places, transit corridors, and regular commute hours.
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
              <h3 className="step-card-title">Check location &amp; routine</h3>
              <p className="step-card-desc">
                Continuously evaluates safe-place boundaries and routine deviation independently to flag deviations early.
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
              <h3 className="step-card-title">Review useful context</h3>
              <p className="step-card-desc">
                Surfaces the anomaly confidence score and location context so caregivers can make informed decisions quickly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. What Makes CareTag Different ── */}
      <section id="difference" className="different-section">
        <div className="section-container">
          <div className="section-header text-center">
            <div className="section-eyebrow-pill">
              <ShieldAlert size={13} />
              <span>THE CAREGIVER ADVANTAGE</span>
            </div>
            <h2 className="section-title">Location is only half the picture.</h2>
            <p className="section-lead">
              Standard trackers only display a dot on a map. CareTag understands whether the movement fits habitual daily life.
            </p>
          </div>

          <div className="different-grid">
            <div className="different-card">
              <div className="different-card-icon icon-blue">
                <Activity size={22} />
              </div>
              <h3 className="different-card-title">Routine-aware</h3>
              <p className="different-card-desc">
                Considers when and where a person normally moves, distinguishing habitual daily trips from unexpected departures.
              </p>
            </div>

            <div className="different-card">
              <div className="different-card-icon icon-rose">
                <ShieldAlert size={22} />
              </div>
              <h3 className="different-card-title">Two independent checks</h3>
              <p className="different-card-desc">
                Safe-zone breaches and behavioral deviations can each raise an alert, catching unusual wandering even within a wide boundary.
              </p>
            </div>

            <div className="different-card">
              <div className="different-card-icon icon-teal">
                <Shield size={22} />
              </div>
              <h3 className="different-card-title">Contextual, calm alerts</h3>
              <p className="different-card-desc">
                Surfaces the deviation score and location details to support caregiver review, providing clear context rather than alarmist panic.
              </p>
            </div>
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
                <span>SAFETY COMPANION</span>
              </div>
              <h3 className="taggy-strip-title">Meet Taggy, your CareTag companion.</h3>
              <p className="taggy-strip-desc">
                Friendly guidance for safe-place setup, wearable telemetry status, and contextual safety notifications.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. Built By: University Capstone Team Section ── */}
      <section id="team" className="team-section">
        <div className="section-container">
          <div className="section-header text-center">
            <div className="section-eyebrow-pill">
              <span>ACADEMIC EXCELLENCE &bull; BATCH OF 2027</span>
            </div>
            <h2 className="section-title">The team behind CareTag</h2>
            <p className="section-lead team-subtitle">
              Thapar Institute of Engineering &amp; Technology &bull; Computer Engineering Capstone Project
            </p>
          </div>

          <div className="team-grid">
            {teamMembers.map((member) => (
              <div key={member.id} className="team-card">
                <div className="team-avatar-initials">{member.initials}</div>
                <h3 className="team-name">{member.name}</h3>
                <span className="team-role">{member.role}</span>
              </div>
            ))}
          </div>

          <div className="team-mentor-wrap">
            <div className="team-mentor-pill">
              <span className="team-mentor-badge">Faculty Mentor</span>
              <span className="team-mentor-text">
                <strong>Dr. Kapil Tomar</strong>, Associate Professor, CSED
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. Final Closing CTA ── */}
      <section className="final-cta-section">
        <div className="section-container">
          <div className="final-cta-card">
            <div className="section-eyebrow-pill">
              <span>READY TO BEGIN</span>
            </div>
            <h2 className="final-cta-title">Explore the CareTag dashboard.</h2>
            <p className="final-cta-desc">
              Configure safe places and explore routine-aware location monitoring in real time.
            </p>
            <button
              type="button"
              className="btn-hero-primary final-cta-btn"
              onClick={onLaunchDashboard}
            >
              <span>Open dashboard</span>
              <ArrowRight size={16} />
            </button>
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
              <a href="#how-it-works" className="footer-nav-link">How it works</a>
              <a href="#preview" className="footer-nav-link">Features</a>
              <a href="#team" className="footer-nav-link">Built by</a>
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
