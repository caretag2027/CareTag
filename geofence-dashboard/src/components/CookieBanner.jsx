import React, { useState, useEffect } from 'react';
import './CookieBanner.css';
import { ShieldCheck, X, FileText, Lock, AlertTriangle } from 'lucide-react';

const CONSENT_STORAGE_KEY = 'caretag_cookie_consent_v1';

export default function CookieBanner() {
  const [hasConsent, setHasConsent] = useState(true); // default true to avoid flash before checking
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [activeLegalTab, setActiveLegalTab] = useState('privacy'); // 'privacy' | 'terms' | 'disclaimer'

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
      if (!stored) {
        setHasConsent(false);
      }
    } catch {
      // In case localStorage is blocked
      setHasConsent(false);
    }

    // Listen for custom open-legal events from footer or other components
    const handleOpenLegal = (e) => {
      const tab = e?.detail?.tab || 'privacy';
      setActiveLegalTab(tab);
      setLegalModalOpen(true);
    };

    window.addEventListener('caretag:open-legal', handleOpenLegal);
    return () => window.removeEventListener('caretag:open-legal', handleOpenLegal);
  }, []);

  // Lock background body scroll when legal document modal is open
  useEffect(() => {
    if (legalModalOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [legalModalOpen]);

  const handleAcceptAll = () => {
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, 'accepted');
    } catch {}
    setHasConsent(true);

    // Update Google tag consent if gtag is defined
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: 'granted',
      });
    }

    // Initialize Microsoft Clarity dynamically if defined
    if (typeof window.initCareTagClarity === 'function') {
      window.initCareTagClarity();
    }
  };

  const handleEssentialOnly = () => {
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, 'essential');
    } catch {}
    setHasConsent(true);

    // Keep analytics minimal / denied for tracking cookies
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
      });
    }
  };

  const openDocument = (tab) => {
    setActiveLegalTab(tab);
    setLegalModalOpen(true);
  };

  return (
    <>
      {/* ── 1. Compact Bottom Cookie Consent Banner ── */}
      {!hasConsent && (
        <div className="ct-cookie-banner-wrapper" role="region" aria-label="Cookie and Privacy Notice">
          <div className="ct-cookie-banner">
            <button
              type="button"
              className="ct-cookie-dismiss"
              onClick={handleEssentialOnly}
              aria-label="Dismiss cookie notice with essential cookies only"
              title="Dismiss"
            >
              <X size={15} />
            </button>
            <div className="ct-cookie-content">
              <ShieldCheck size={18} className="ct-cookie-icon" />
              <p className="ct-cookie-text">
                CareTag uses essential session cookies and privacy-first analytics to support routine-monitoring workflows.{' '}
                <button
                  type="button"
                  className="ct-cookie-link"
                  onClick={() => openDocument('privacy')}
                >
                  Privacy Policy
                </button>
                {', '}
                <button
                  type="button"
                  className="ct-cookie-link"
                  onClick={() => openDocument('terms')}
                >
                  Terms
                </button>
                {', and '}
                <button
                  type="button"
                  className="ct-cookie-link"
                  onClick={() => openDocument('disclaimer')}
                >
                  Safety Disclaimer
                </button>
                .
              </p>
            </div>

            <div className="ct-cookie-actions">
              <button
                type="button"
                className="ct-cookie-btn ct-cookie-btn--secondary"
                onClick={handleEssentialOnly}
              >
                Essential only
              </button>
              <button
                type="button"
                className="ct-cookie-btn ct-cookie-btn--primary"
                onClick={handleAcceptAll}
              >
                Accept all
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. Unified Legal Document Modal ── */}
      {legalModalOpen && (
        <div
          className="ct-legal-backdrop"
          onClick={() => setLegalModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="legal-dialog-title"
        >
          <div className="ct-legal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ct-legal-header">
              <div className="ct-legal-title-group">
                {activeLegalTab === 'privacy' && <Lock size={19} color="#2563EB" />}
                {activeLegalTab === 'terms' && <FileText size={19} color="#2563EB" />}
                {activeLegalTab === 'disclaimer' && <AlertTriangle size={19} color="#0D9488" />}
                <h3 id="legal-dialog-title">
                  {activeLegalTab === 'privacy' && 'Privacy Policy'}
                  {activeLegalTab === 'terms' && 'Terms and Conditions'}
                  {activeLegalTab === 'disclaimer' && 'Safety Disclaimer'}
                </h3>
              </div>
              <button
                type="button"
                className="ct-legal-close"
                onClick={() => setLegalModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation Tabs (Mobile Responsive Segments) */}
            <div className="ct-legal-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeLegalTab === 'privacy'}
                className={`ct-legal-tab ${activeLegalTab === 'privacy' ? 'is-active' : ''}`}
                onClick={() => setActiveLegalTab('privacy')}
              >
                <span className="tab-label-full">Privacy Policy</span>
                <span className="tab-label-short">Privacy</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeLegalTab === 'terms'}
                className={`ct-legal-tab ${activeLegalTab === 'terms' ? 'is-active' : ''}`}
                onClick={() => setActiveLegalTab('terms')}
              >
                <span className="tab-label-full">Terms &amp; Conditions</span>
                <span className="tab-label-short">Terms</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeLegalTab === 'disclaimer'}
                className={`ct-legal-tab ${activeLegalTab === 'disclaimer' ? 'is-active' : ''}`}
                onClick={() => setActiveLegalTab('disclaimer')}
              >
                <span className="tab-label-full">Safety Disclaimer</span>
                <span className="tab-label-short">Disclaimer</span>
              </button>
            </div>

            {/* Content Body */}
            <div className="ct-legal-body">
              {activeLegalTab === 'privacy' && (
                <div>
                  <h4>1. Data We Collect</h4>
                  <p>
                    CareTag collects device telemetry necessary to support caregiver awareness: GPS coordinates, motion states (accelerometer and gyroscope readings), device battery percentages, and timestamps. When exploring the website, anonymous analytics (via Google Analytics and Microsoft Clarity) help us understand navigation flow and improve usability.
                  </p>

                  <h4>2. How Telemetry Is Used</h4>
                  <p>
                    Location and movement data are processed strictly to calculate safe-place boundaries, compute routine deviation scores, and generate caregiver alert notifications. We do not sell or monetize personal tracking data.
                  </p>

                  <h4>3. Data Isolation and Storage</h4>
                  <p>
                    User accounts, configured safe places, and alert histories are stored with user-scoped isolation in Cloudflare Key-Value (KV) storage and edge caching. Session tokens expire automatically and can be revoked by logging out.
                  </p>

                  <h4>4. Cookies &amp; Third-Party Services</h4>
                  <ul>
                    <li><strong>Essential Cookies:</strong> Required for authentication sessions and safe-place preferences.</li>
                    <li><strong>Analytics:</strong> Google Tag Manager (G-NK0MBVV3Q2) and Microsoft Clarity (yyrgxx6ob7) to understand aggregate traffic and interface responsiveness.</li>
                  </ul>
                </div>
              )}

              {activeLegalTab === 'terms' && (
                <div>
                  <h4>1. Product Use &amp; Academic Scope</h4>
                  <p>
                    CareTag is developed as an engineering capstone and safety-monitoring prototype (Thapar Institute of Engineering &amp; Technology, Batch of 2027). By accessing this site or dashboard, you agree to use it for authorized evaluation and child safety awareness.
                  </p>

                  <h4>2. Account Security &amp; Access</h4>
                  <p>
                    Users are responsible for safeguarding their login credentials and ensuring that monitoring configurations (safe places, contact details, alert thresholds) accurately represent their intended safety parameters.
                  </p>

                  <h4>3. Intellectual Property</h4>
                  <p>
                    All brand assets, software architecture, machine-learning routine models, and documentation associated with CareTag are the property of the project creators and protected by applicable copyright laws.
                  </p>

                  <h4>4. Service Availability</h4>
                  <p>
                    Because telemetry relies on cellular transmission, GPS satellite visibility, and edge services, continuous uninterrupted availability is not guaranteed.
                  </p>
                </div>
              )}

              {activeLegalTab === 'disclaimer' && (
                <div>
                  <h4>Important Assistive Technology Notice</h4>
                  <p>
                    <strong>CareTag is an assistive location-awareness companion and is not a substitute for active adult supervision or emergency dispatch services.</strong>
                  </p>

                  <h4>System Limitations</h4>
                  <ul>
                    <li><strong>GPS Coverage:</strong> Environmental factors (tall buildings, tunnels, severe weather, indoor structures) can degrade GPS accuracy or cause signal lag.</li>
                    <li><strong>Network Connectivity:</strong> Telemetry updates depend on cellular and internet connection availability. When a device is offline, the last reported location is displayed with an explicit freshness indicator.</li>
                    <li><strong>No Safety Guarantee:</strong> No automated electronic monitoring system can guarantee physical safety or prevent accidents. CareTag provides contextual notifications to assist caregiver judgment.</li>
                  </ul>

                  <h4>Emergency Contact</h4>
                  <p>
                    In an immediate medical, life-threatening, or child welfare emergency, please contact your local emergency services (e.g., 112 / 911) immediately rather than relying on automated digital alerts.
                  </p>
                </div>
              )}
            </div>

            <div className="ct-legal-footer">
              <button
                type="button"
                className="ct-cookie-btn ct-cookie-btn--primary"
                onClick={() => setLegalModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
