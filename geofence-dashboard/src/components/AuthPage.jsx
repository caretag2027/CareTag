import React, { useState } from 'react';
import {
  ArrowLeft, ArrowRight, Lock, Mail, Eye, EyeOff,
  AlertTriangle, ShieldCheck
} from 'lucide-react';
import CareTagLogo from './CareTagLogo';
import auth, { DEDICATED_ACCOUNTS } from '../auth';
import './AuthPage.css';

/**
 * CareTag Minimalist Caregiver Sign-In Portal
 *
 * Designed for simplicity, clarity, and zero-distraction access.
 * Displays a single primary 1-click login action for Bhavishya Singla (Singla_BE23@thapar.edu)
 * with an optional manual credentials disclosure if needed.
 */
export default function AuthPage({ onLogin, onBackToLanding }) {
  // Primary institutional account: Bhavishya Singla
  const singlaAccount = DEDICATED_ACCOUNTS && DEDICATED_ACCOUNTS.length > 0
    ? DEDICATED_ACCOUNTS[0]
    : {
        id: 'usr_singla_be23',
        name: 'Bhavishya Singla',
        email: 'singla_be23@thapar.edu',
        displayEmail: 'Singla_BE23@thapar.edu',
        password: '12345',
        role: 'admin'
      };

  const [email, setEmail] = useState(singlaAccount.displayEmail || singlaAccount.email);
  const [password, setPassword] = useState(singlaAccount.password || '12345');
  const [showPassword, setShowPassword] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 1-Click direct sign in as Bhavishya Singla
  const handleSinglaLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const targetEmail = singlaAccount.displayEmail || singlaAccount.email;
      const targetPassword = singlaAccount.password || '12345';
      const result = await auth.login(targetEmail, targetPassword);
      if (result.ok) {
        onLogin(result.user);
      } else {
        setError(result.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  // Manual credentials submission
  const handleManualSubmit = async (e) => {
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
      const result = await auth.login(email.trim(), password);
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
  };

  return (
    <div className="auth-minimal-wrapper">
      {/* Top Navigation */}
      <header className="auth-minimal-header">
        <button
          type="button"
          className="auth-minimal-back-btn"
          onClick={onBackToLanding}
          aria-label="Back to Home"
        >
          <ArrowLeft size={16} />
          <span>Back to Home</span>
        </button>
      </header>

      {/* Centered Minimal Container */}
      <main className="auth-minimal-main">
        <div className="auth-minimal-card">
          {/* Brand Header */}
          <div className="auth-minimal-brand">
            <CareTagLogo variant="horizontal" size="md" showTagline={false} />
            <h1 className="auth-minimal-title" id="auth-portal-title">
              Sign In
            </h1>
            <p className="auth-minimal-subtitle">
              CareTag Caregiver &amp; Institutional Access
            </p>
          </div>

          {error && (
            <div className="auth-minimal-alert" role="alert">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* ── Single Primary Login Action: Bhavishya Singla ── */}
          <div className="auth-singla-section">
            <button
              type="button"
              className="auth-singla-card-btn"
              onClick={handleSinglaLogin}
              disabled={loading}
              id="auth-singla-login-btn"
              aria-label="Sign in as Bhavishya Singla"
            >
              <div className="auth-singla-avatar">BS</div>
              <div className="auth-singla-info">
                <div className="auth-singla-name-row">
                  <span className="auth-singla-name">{singlaAccount.name}</span>
                  <span className="auth-singla-role-tag">Primary</span>
                </div>
                <span className="auth-singla-email">
                  {singlaAccount.displayEmail || singlaAccount.email}
                </span>
              </div>
              <div className="auth-singla-action">
                {loading ? (
                  <span className="auth-minimal-spinner" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </div>
            </button>
          </div>

          {/* Subtle manual entry disclosure */}
          <div className="auth-manual-toggle-row">
            <button
              type="button"
              className="auth-manual-toggle-btn"
              onClick={() => setShowManual(v => !v)}
              aria-expanded={showManual}
            >
              {showManual ? 'Hide manual credentials' : 'Or enter credentials manually'}
            </button>
          </div>

          {/* Manual Credentials Form */}
          {showManual && (
            <form onSubmit={handleManualSubmit} className="auth-manual-form" noValidate>
              <div className="auth-field-group">
                <label htmlFor="auth-user-email" className="auth-field-label">
                  Login ID / Institutional Email
                </label>
                <div className="auth-input-wrapper">
                  <Mail size={16} className="auth-input-icon" />
                  <input
                    id="auth-user-email"
                    type="text"
                    autoComplete="username"
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value);
                      if (error) setError('');
                    }}
                    className="auth-input"
                    placeholder="Singla_BE23@thapar.edu"
                    required
                  />
                </div>
              </div>

              <div className="auth-field-group">
                <label htmlFor="auth-user-password" className="auth-field-label">
                  Session Password
                </label>
                <div className="auth-input-wrapper">
                  <Lock size={16} className="auth-input-icon" />
                  <input
                    id="auth-user-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value);
                      if (error) setError('');
                    }}
                    className="auth-input"
                    placeholder="Enter password"
                    required
                  />
                  <button
                    type="button"
                    className="auth-pw-toggle"
                    onClick={() => setShowPassword(p => !p)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="auth-manual-submit-btn"
                disabled={loading}
                id="auth-submit-btn"
              >
                {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
              </button>
            </form>
          )}

          {/* Minimal Security Footer */}
          <div className="auth-minimal-footer">
            <ShieldCheck size={13} color="#64748B" />
            <span>Secure Authorized Session &bull; Thapar University</span>
          </div>
        </div>
      </main>
    </div>
  );
}
