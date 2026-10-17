/**
 * CareTag Voice Alarm System
 * 
 * Uses the Web Speech API (speechSynthesis) to give audible voice 
 * warnings when critical safety events occur. Falls back to an 
 * Audio beep when speech synthesis is unavailable.
 * 
 * Features:
 *   - 30s cooldown per alert type to avoid spam
 *   - User can toggle voice alarm on/off
 *   - Manual dismiss/acknowledge
 *   - Browser autoplay policy handled gracefully
 */

const COOLDOWN_MS = 60000; // 60 seconds between same alert type / event to avoid spam
const SETTING_KEY = 'caretag.voiceAlarm.enabled';

class VoiceAlarm {
  constructor() {
    this.enabled = this._loadEnabled();
    this._lastAlertTimes = {}; // { alertType: timestamp }
    this._speaking = false;
    this._currentUtterance = null;
    this._audioCtx = null;
  }

  // ── Settings ──

  _loadEnabled() {
    try { return localStorage.getItem(SETTING_KEY) === 'true'; }
    catch { return false; }
  }

  isEnabled() {
    return this.enabled;
  }

  setEnabled(val) {
    this.enabled = !!val;
    try { localStorage.setItem(SETTING_KEY, String(this.enabled)); } catch {}
    if (!this.enabled) this.stop();
  }

  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  // ── Cooldown ──

  _canAlert(type) {
    const now = Date.now();
    const last = this._lastAlertTimes[type] || 0;
    return (now - last) >= COOLDOWN_MS;
  }

  _recordAlert(type) {
    this._lastAlertTimes[type] = Date.now();
  }

  // ── Speech ──

  _speak(text) {
    if (!('speechSynthesis' in window)) {
      this._beepFallback();
      return;
    }

    try {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      utterance.lang = 'en-US';

      utterance.onstart = () => { this._speaking = true; };
      utterance.onend = () => { this._speaking = false; this._currentUtterance = null; };
      utterance.onerror = () => {
        this._speaking = false;
        this._currentUtterance = null;
        // Fallback to beep if speech fails (autoplay policy)
        this._beepFallback();
      };

      this._currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    } catch {
      this._beepFallback();
    }
  }

  _beepFallback() {
    try {
      if (!this._audioCtx) {
        this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = this._audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      // Alarm pattern: two quick beeps
      osc.type = 'square';
      osc.frequency.value = 880;
      gain.gain.value = 0.3;

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);

      // Second beep
      setTimeout(() => {
        try {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.type = 'square';
          osc2.frequency.value = 1100;
          gain2.gain.value = 0.3;
          osc2.start(ctx.currentTime);
          osc2.stop(ctx.currentTime + 0.2);
        } catch {}
      }, 250);
    } catch {
      // Audio completely unavailable — silent fail
    }
  }

  // ── Public API ──

  /**
   * Trigger a voice alarm for an alert event.
   * @param {string} type — 'out_of_zone' | 'boundary_breach' | 'anomaly' | 'route_deviation' | 'low_battery'
   * @param {{ childName?: string, alertId?: string, nearestGeofence?: string, distance?: number, deviationScore?: number, batteryPercent?: number }} details
   */
  trigger(type, details = {}) {
    if (!this.enabled) return false;
    const dedupeKey = details.alertId ? `${type}_${details.alertId}` : type;
    if (!this._canAlert(dedupeKey)) return false;

    const child = details.childName?.trim() || 'Your child';
    let message = '';

    switch (type) {
      case 'out_of_zone':
      case 'boundary_breach':
      case 'breach':
        if (details.customMessage) {
          message = details.customMessage;
        } else if (details.nearestGeofence) {
          const zoneText = details.nearestGeofence.toLowerCase().startsWith('the ')
            ? details.nearestGeofence
            : `the ${details.nearestGeofence}`;
          message = `CareTag alert. ${child} has left ${zoneText}.`;
        } else {
          message = `CareTag alert. ${child} has left a configured safe place.`;
        }
        break;

      case 'anomaly':
      case 'route_deviation':
        if (details.customMessage) {
          message = details.customMessage;
        } else if (details.routeName) {
          message = `CareTag alert. An unusual movement pattern has been detected on the ${details.routeName} route.`;
        } else {
          message = `CareTag alert. ${child} has deviated from the learned routine.`;
          if (details.nearestGeofence) {
            message += ` Near ${details.nearestGeofence}.`;
          }
        }
        break;

      case 'low_battery':
        message = `CareTag notice. Smart Band battery is low at ${details.batteryPercent || 20} percent.`;
        break;

      default:
        message = details.customMessage || `CareTag notice. A safety notification was recorded for ${child}.`;
    }

    this._speak(message);
    this._recordAlert(dedupeKey);
    return true;
  }

  /**
   * Speak arbitrary text directly (e.g. for testing audio permissions)
   */
  speak(text) {
    if (!this.enabled) return false;
    this._speak(text);
    return true;
  }

  /**
   * Test speech synthesis output to verify browser audio permissions
   */
  testVoice() {
    return this.speak('CareTag voice alert system active. Audio synthesis verified.');
  }

  /**
   * Stop any ongoing alarm.
   */
  stop() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this._speaking = false;
    this._currentUtterance = null;
  }

  /**
   * Is the alarm currently speaking?
   */
  isSpeaking() {
    return this._speaking;
  }
}

// Singleton
const voiceAlarm = new VoiceAlarm();
export default voiceAlarm;
