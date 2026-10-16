import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, ArrowRight, ShieldCheck, Mail, Lock, Eye, EyeOff,
  AlertTriangle, Check, Sparkles, Heart, BatteryCharging,
  Thermometer, Activity, Radio, Shield, Compass, Zap
} from 'lucide-react';
import CareTagLogo from './CareTagLogo';
import Taggy from './Taggy';
import auth, { DEDICATED_ACCOUNTS } from '../auth';
import './AuthPage.css';

/**
 * CareTag World-Class Caregiver Access Portal
 * 
 * Features:
 * - High-contrast, brand-compliant Poppins typography (#0B2D5B on #FFFFFF / #F8FAFC)
 * - Eliminates washed-out / invisible text bug
 * - Responsive 2-column split layout with live telemetry hero preview
 * - 1-Click institutional test persona auto-fill (Bhavishya Singla, Dr. Rajesh Sharma, Priya Singla)
 * - Direct Instant Demo Sign In for effortless evaluation
 * - Live radar simulation and biometric telemetry stream
 * - AES-256 Cloudflare Edge Worker authentication with local fallback
 */
export default function AuthPage({ onLogin, onBackToLanding }) {
  // Primary institutional account is Bhavishya Singla by default
  const defaultAccount = DEDICATED_ACCOUNTS && DEDICATED_ACCOUNTS.length > 0
    ? DEDICATED_ACCOUNTS[0]
    : { email: 'Singla_BE23@thapar.edu', password: '12345', name: 'Bhavishya Singla' };

  const [email, setEmail] = useState(defaultAccount.displayEmail || defaultAccount.email);
  const [password, setPassword] = useState(defaultAccount.password || '12345');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState(defaultAccount.id || 'usr_singla_be23');

  // Simulated live telemetry vitals
  const [heartRate, setHeartRate] = useState(74);
  const [routineScore, setRoutineScore] = useState(0.04);

  // Subtle telemetry pulse simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setHeartRate(prev => {
        const delta = Math.floor(Math.random() * 3) - 1; // -1, 0, or +1
        const next = prev + delta;
        return next >= 70 && next <= 78 ? next : 74;
      });
      setRoutineScore(prev => {
        const jitter = (Math.random() * 0.02 - 0.01);
        const next = Math.max(0.02, Math.min(0.08, +(prev + jitter).toFixed(3)));
        return next;
      });
    }, 3500);

    return () => clearInterval(timer);
  }, []);

  const handleSelectPersona = (account) => {
    setSelectedPersonaId(account.id);
    setEmail(account.displayEmail || account.email);
    setPassword(account.password || '12345');
    setError('');
    setAutoFilled(true);
    setTimeout(() => setAutoFilled(false), 2200);
  };

  const handleQuickLoginAsSelected = async (account) => {
    const targetEmail = account ? (account.displayEmail || account.email) : email;
    const targetPassword = account ? (account.password || '12345') : password;
    
    if (account) {
      setSelectedPersonaId(account.id);
      setEmail(targetEmail);
      setPassword(targetPassword);
    }

    setError('');
    setLoading(true);
    try {
      const result = await auth.login(targetEmail, targetPassword);
      if (result.ok) {
        onLogin(result.user);
      } else {
        setError(result.error || 'Authentication failed. Please verify your credentials.');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    if (!email.trim()) {
      setError('Please provide your Login ID or institutional email.');
      return;
    }
    if (!password) {
      setError('Please enter your session password.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const result = await auth.login(email, password);
      if (result.ok) {
        onLogin(result.user);
      } else {
        setError(result.error || 'Authentication failed. Please check your credentials.');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Display top 3 personas in tray
  const quickPersonas = DEDICATED_ACCOUNTS ? DEDICATED_ACCOUNTS.slice(0, 3) : [];

  return (
    <div className="auth-split-wrapper">
      {/* ────────────────────────────────────────────────────────────
          LEFT COLUMN: Clean, High-Contrast Caregiver Portal
          ──────────────────────────────────────────────────────────── */}
      <div className="auth-portal-pane">
        {/* Navigation Bar */}
        <div className="auth-portal-nav">
          <button
            type="button"
            className="auth-back-link"
            onClick={onBackToLanding}
            title="Return to CareTag Overview"
            aria-label="Back to Home"
          >
            <ArrowLeft size={16} />
            <span>Back to Home</span>
          </button>

          <div className="auth-security-badge" title="Cloudflare Workers KV Session Gateway Active">
            <span className="auth-pulse-dot" />
            <span>Secure Edge Gateway</span>
          </div>
        </div>

        {/* Form Body Container */}
        <div className="auth-card-body">
          <div className="auth-brand-lockup">
            <CareTagLogo variant="horizontal" size="md" showTagline={false} />

            <div className="auth-category-pill">
              <ShieldCheck size={13} />
              <span>Institutional &amp; Caregiver Access</span>
            </div>

            <h1 className="auth-main-title" id="auth-portal-title">
              Caregiver Access Portal
            </h1>
            <p className="auth-main-subtitle">
              Sign in to monitor real-time smart band telemetry, geofence safe zones &amp; routine deviation alerts.
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="auth-credentials-form" noValidate>
            <div className="auth-input-group">
              <div className="auth-label-row">
                <label htmlFor="auth-user-email" className="auth-field-label">
                  Login ID / Institutional Email
                </label>
                <span className="auth-field-hint">e.g. Thapar University ID</span>
              </div>
              <div className="auth-field-input-wrapper">
                <Mail size={16} className="auth-field-icon" />
                <input
                  id="auth-user-email"
                  type="text"
                  autoComplete="username"
                  placeholder="e.g. Singla_BE23@thapar.edu"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                  className="auth-text-input"
                  required
                />
              </div>
            </div>

            <div className="auth-input-group">
              <div className="auth-label-row">
                <label htmlFor="auth-user-password" className="auth-field-label">
                  Session Password
                </label>
                <span className="auth-field-hint">Test key: 12345</span>
              </div>
              <div className="auth-field-input-wrapper">
                <Lock size={16} className="auth-field-icon" />
                <input
                  id="auth-user-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter session password"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  className="auth-text-input"
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(p => !p)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="auth-alert-banner" role="alert">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="auth-primary-submit"
              disabled={loading}
              id="auth-submit-btn"
            >
              {loading ? (
                <>
                  <span className="auth-loading-spinner" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          {/* Dedicated Institutional Personas Tray */}
          <div className="auth-persona-box">
            <div className="auth-persona-header">
              <div className="auth-persona-label">
                <Sparkles size={14} color="#2563EB" />
                <span>Dedicated Test Accounts</span>
              </div>
              {autoFilled && (
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#059669', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Check size={13} />
                  <span>Filled</span>
                </span>
              )}
            </div>

            <div className="auth-persona-chips">
              {quickPersonas.map(acc => {
                const isSelected = selectedPersonaId === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    className={`auth-persona-btn ${isSelected ? 'is-active' : ''}`}
                    onClick={() => handleSelectPersona(acc)}
                    title={`Click to fill ${acc.name} (${acc.role})`}
                  >
                    <span className="auth-persona-role">{acc.role}</span>
                    <span className="auth-persona-name">{acc.name}</span>
                    <span className="auth-persona-email">{acc.displayEmail || acc.email}</span>
                  </button>
                );
              })}
            </div>

            <div className="auth-quick-actions">
              <button
                type="button"
                className={`auth-quick-fill-btn ${autoFilled ? 'is-filled' : ''}`}
                onClick={() => {
                  const current = quickPersonas.find(a => a.id === selectedPersonaId) || defaultAccount;
                  handleSelectPersona(current);
                }}
              >
                {autoFilled ? <Check size={13} /> : <Sparkles size={13} />}
                <span>{autoFilled ? 'Credentials Loaded' : 'Fill Selected ID'}</span>
              </button>

              <button
                type="button"
                className="auth-instant-login-btn"
                onClick={() => {
                  const current = quickPersonas.find(a => a.id === selectedPersonaId) || defaultAccount;
                  handleQuickLoginAsSelected(current);
                }}
                disabled={loading}
                title="Immediately sign in without manual clicking"
              >
                <Zap size={13} />
                <span>Instant Demo Sign In</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Security Assurance */}
        <div className="auth-footer-assurance">
          <Shield size={13} color="#64748B" />
          <span>Protected Session &bull; 256-Bit Cloudflare KV &bull; Authorized Institutional Access Only</span>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────
          RIGHT COLUMN: Live Smart Band Telemetry & Radar Showcase
          ──────────────────────────────────────────────────────────── */}
      <div className="auth-showcase-pane">
        <div className="auth-ambient-orb-1" />
        <div className="auth-ambient-orb-2" />

        <div className="auth-showcase-inner">
          {/* Header Stream Badge */}
          <div className="auth-stream-badge">
            <span className="auth-stream-beacon" />
            <span className="auth-stream-text">Live Smart Band Stream Preview</span>
          </div>

          <h2 className="auth-showcase-title">
            Safety Beyond Boundaries.<br />
            <span>Context-Aware Intelligence.</span>
          </h2>

          {/* Telemetry Card */}
          <div className="auth-telemetry-card">
            <div className="auth-telemetry-top">
              <div className="auth-device-meta">
                <div className="auth-device-icon-box">
                  <Radio size={20} />
                </div>
                <div>
                  <h3 className="auth-device-name">Taggy Smart Band (v2.4)</h3>
                  <p className="auth-device-sub">Aarav Sharma &bull; Hardware ID #CARE-TAG-01</p>
                </div>
              </div>

              <div className="auth-telemetry-status-pill">
                <span className="auth-pulse-dot" />
                <span>4G LTE + GPS</span>
              </div>
            </div>

            {/* 4-Stat Biometric Telemetry */}
            <div className="auth-vitals-grid">
              <div className="auth-vital-cell">
                <div className="auth-vital-icon heart">
                  <Heart size={16} />
                </div>
                <div className="auth-vital-info">
                  <div className="auth-vital-val">
                    <span>{heartRate}</span>
                    <span className="auth-vital-unit">BPM</span>
                  </div>
                  <span className="auth-vital-title">Heart Rate (Normal)</span>
                </div>
              </div>

              <div className="auth-vital-cell">
                <div className="auth-vital-icon battery">
                  <BatteryCharging size={16} />
                </div>
                <div className="auth-vital-info">
                  <div className="auth-vital-val">
                    <span>94%</span>
                    <span className="auth-vital-unit">~26 hrs</span>
                  </div>
                  <span className="auth-vital-title">Battery Health</span>
                </div>
              </div>

              <div className="auth-vital-cell">
                <div className="auth-vital-icon temp">
                  <Thermometer size={16} />
                </div>
                <div className="auth-vital-info">
                  <div className="auth-vital-val">
                    <span>36.6</span>
                    <span className="auth-vital-unit">&deg;C</span>
                  </div>
                  <span className="auth-vital-title">Skin Temp (Optimal)</span>
                </div>
              </div>

              <div className="auth-vital-cell">
                <div className="auth-vital-icon routine">
                  <Activity size={16} />
                </div>
                <div className="auth-vital-info">
                  <div className="auth-vital-val">
                    <span>{routineScore}</span>
                    <span className="auth-vital-unit">score</span>
                  </div>
                  <span className="auth-vital-title">Routine Verification</span>
                </div>
              </div>
            </div>
          </div>

          {/* Active Geofence Radar Card */}
          <div className="auth-radar-card">
            <div className="auth-radar-visual">
              <div className="auth-radar-ring" />
              <div className="auth-radar-sweep" />
              <div className="auth-radar-blip" />
            </div>
            <div className="auth-radar-details">
              <div className="auth-radar-zone-name">
                Thapar University Campus (Safe Haven)
              </div>
              <div className="auth-radar-zone-desc">
                Current Location: 30.3533&deg; N, 76.3687&deg; E &bull; Radius: 350m &bull; Inside boundary
              </div>
            </div>
          </div>

          {/* Mascot Reassurance Bar */}
          <div className="auth-mascot-companion">
            <Taggy size={72} animate={true} />
            <div className="auth-mascot-speech">
              <strong>Hi! I'm Taggy.</strong> All safe zones are active, routine deviation modeling is running, and alerts will stream to your dashboard immediately.
            </div>
          </div>

          {/* Trust proof points */}
          <div className="auth-showcase-trust-pills">
            <div className="auth-trust-pill">
              <Zap size={14} />
              <span>&lt; 1.2s Alert Latency</span>
            </div>
            <div className="auth-trust-pill">
              <Shield size={14} />
              <span>Zero Unencrypted Storage</span>
            </div>
            <div className="auth-trust-pill">
              <Compass size={14} />
              <span>LSTM Routine Model</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
