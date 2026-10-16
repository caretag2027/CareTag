import React, { useState, useEffect } from 'react';
import {
  Shield, Activity, Bell, Compass, ArrowRight,
  ShieldAlert
} from 'lucide-react';
import taggyImg from '../assets/taggy.png';
import CareTagLogo from './CareTagLogo';
import HeroRoutineSimulation from './HeroRoutineSimulation';

// Verified Capstone Project Team (Thapar Institute of Engineering & Technology, Batch of 2027)
const teamMembers = [
  { id: 1, name: 'Kinjal', role: 'Computer Engineering' },
  { id: 2, name: 'Guneev Taneja', role: 'Computer Engineering' },
  { id: 3, name: 'Bhavishya Singla', role: 'Computer Engineering' },
  { id: 4, name: 'Manya Sharma', role: 'Computer Engineering' },
  { id: 5, name: 'Anureet', role: 'Computer Engineering' },
];

/**
 * CareTag Public Homepage — Clean on-brand layout with essential header navigation
 * & Built-by team showcase
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
      {/* ── 1. Floating Frosted-Glass Header (Important Links Only) ── */}
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

          {/* Navigation links in the middle: Essential sections only */}
          <nav className="floating-nav" aria-label="Main Navigation">
            <a href="#how-it-works" className="floating-nav-link">How it works</a>
            <a href="#preview" className="floating-nav-link">Features</a>
            <a href="#team" className="floating-nav-link">Built by</a>
          </nav>

          {/* Dominant Pill CTA button on the right */}
          <div className="floating-actions">
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

      {/* ── 2. Modern Airy Centered Hero Section (Solid Brand Colors, No Gradients) ── */}
      <section className="hero-section">
        <div className="hero-container">
          {/* Headline with Clean Brand Color */}
          <h1 className="hero-title">
            Safety that understands <span className="hero-title-highlight">routines.</span>
          </h1>

          {/* Concise Subhead */}
          <p className="hero-subtitle">
            Location boundaries and routine awareness to help caregivers notice unexpected movement.
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
              <span>See how it works ↓</span>
            </a>
          </div>

          {/* ── 3. Visual 4-Day Routine Awareness Demonstration (Home ↔ School) ── */}
          <div className="hero-product-showcase" id="preview">
            <div className="showcase-browser-frame">
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
            <h2 className="section-title">Three steps to routine awareness</h2>
            <p className="section-lead">
              From daily habits to clear, contextual location alerts.
            </p>
          </div>

          <div className="steps-grid">
            {/* Step 1 */}
            <div className="step-card">
              <div className="step-card-top">
                <div className="step-icon-box">
                  <Compass size={22} />
                </div>
                <span className="step-number-indicator">01</span>
              </div>
              <h3>Learn movement patterns</h3>
              <p>
                CareTag uses historical GPS trajectories to model recurring places and times.
              </p>
            </div>

            {/* Step 2 */}
            <div className="step-card">
              <div className="step-card-top">
                <div className="step-icon-box">
                  <Activity size={22} />
                </div>
                <span className="step-number-indicator">02</span>
              </div>
              <h3>Check location and routine</h3>
              <p>
                Evaluates safe-place boundaries and routine deviation independently.
              </p>
            </div>

            {/* Step 3 */}
            <div className="step-card">
              <div className="step-card-top">
                <div className="step-icon-box">
                  <Bell size={22} />
                </div>
                <span className="step-number-indicator">03</span>
              </div>
              <h3>Review useful context</h3>
              <p>
                Review alert details, deviation confidence, and location context.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. What Makes CareTag Different ── */}
      <section id="difference" className="different-section">
        <div className="section-container">
          <div className="section-header text-center">
            <h2 className="section-title">Location is only part of the picture.</h2>
            <p className="section-lead">
              Not just where someone is. Whether their movement looks unusual for them.
            </p>
          </div>

          <div className="different-grid">
            <div className="different-card">
              <div className="different-card-icon">
                <Activity size={22} />
              </div>
              <h3>Routine-aware</h3>
              <p>
                Considers when and where a person normally moves, distinguishing habitual daily trips
                from unexpected departures.
              </p>
            </div>

            <div className="different-card">
              <div className="different-card-icon">
                <ShieldAlert size={22} />
              </div>
              <h3>Two independent checks</h3>
              <p>
                Safe-zone breaches and behavioral deviations can each raise an alert, catching unusual
                wandering even within a wide boundary.
              </p>
            </div>

            <div className="different-card">
              <div className="different-card-icon">
                <Shield size={22} />
              </div>
              <h3>Contextual alerts</h3>
              <p>
                Surfaces the deviation score and location details to support caregiver review,
                providing clear context rather than alarmist panic.
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
              <h3 className="taggy-strip-title">Meet Taggy, your CareTag companion.</h3>
              <p className="taggy-strip-desc">
                Friendly guidance for safe-place setup and safety alerts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. Built By: University Capstone Team Section ── */}
      <section id="team" className="team-section">
        <div className="section-container">
          <div className="section-header text-center">
            <h2 className="section-title">The team behind CareTag</h2>
            <p className="section-lead team-subtitle">
              Thapar Institute of Engineering &amp; Technology · Batch of 2027 · Capstone Project
            </p>
          </div>

          <div className="team-grid">
            {teamMembers.map((member) => (
              <div key={member.id} className="team-card">
                <h3 className="team-name">{member.name}</h3>
                <span className="team-role">{member.role}</span>
              </div>
            ))}
          </div>

          <div className="team-mentor-wrap">
            <p className="team-mentor-line">
              Faculty Mentor: <strong>Dr. Kapil Tomar</strong>, Associate Professor, CSED
            </p>
          </div>
        </div>
      </section>

      {/* ── 8. Final Closing CTA ── */}
      <section className="final-cta-section">
        <div className="section-container">
          <div className="final-cta-card">
            <h2>Explore the CareTag dashboard.</h2>
            <p>
              Configure safe places and explore routine-aware location monitoring in real time.
            </p>
            <button
              type="button"
              className="btn-hero-primary"
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
