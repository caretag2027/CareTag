import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldAlert, Play, Pause, RotateCcw, CheckCircle2 } from 'lucide-react';
import studentImg from '../assets/student.png';
import schoolImg from '../assets/school.png';
import homeImg from '../assets/home.png';

/**
 * Cubic Bézier interpolation formula:
 * B(t) = (1-t)³ P0 + 3(1-t)² t C1 + 3(1-t) t² C2 + t³ P3
 */
function getCubicBezierPoint(t, p0, c1, c2, p3) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x: mt3 * p0.x + 3 * mt2 * t * c1.x + 3 * mt * t2 * c2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * c1.y + 3 * mt * t2 * c2.y + t3 * p3.y
  };
}

// Route Definitions on a 800 x 300 canvas
// Perfectly aligned with Home perimeter (cx=135, cy=150, r=88) and School perimeter (cx=665, cy=150, r=88)
// Every route begins and ends at the geofence circumference — never passing through circle centers
const MAIN_ROUTE = {
  p0: { x: 223, y: 150 }, // Home geofence eastern perimeter exit (r=88, cx=135, cy=150)
  c1: { x: 330, y: 118 },
  c2: { x: 470, y: 178 },
  p3: { x: 577, y: 150 }  // School geofence western perimeter entrance (r=88, cx=665, cy=150)
};

// Day 4 deviation: exits Home geofence at a dedicated south-eastern boundary point (214, 188)
// Curves cleanly into lower open area towards (365, 245), never crossing or overlapping the commute corridor
const FORK_ROUTE = {
  p0: { x: 214, y: 188 }, // Home geofence lower-right perimeter side-exit
  c1: { x: 260, y: 212 },
  c2: { x: 315, y: 236 },
  p3: { x: 365, y: 245 }  // Off-road destination marker
};

const DAYS = [
  {
    id: 1,
    step: 'Day 1',
    statusShort: 'Learning',
    type: 'learning',
    theme: 'blue',
    statusTitle: 'Learning the route',
    statusSubtitle: 'Day 1 of 3'
  },
  {
    id: 2,
    step: 'Day 2',
    statusShort: 'Learning',
    type: 'learning',
    theme: 'blue',
    statusTitle: 'Routine becoming familiar',
    statusSubtitle: 'Day 2 of 3'
  },
  {
    id: 3,
    step: 'Day 3',
    statusShort: 'Routine learned',
    type: 'learned',
    theme: 'green',
    statusTitle: 'Routine learned ✓',
    statusSubtitle: 'Usual route: 8:15 AM'
  },
  {
    id: 4,
    step: 'Day 4',
    statusShort: 'Route deviation',
    type: 'deviation',
    theme: 'red',
    statusTitle: 'Unexpected route detected',
    statusSubtitle: 'Off usual 8:15 AM path'
  }
];

export default function HeroRoutineSimulation() {
  const [dayIndex, setDayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false); // Starts false until meaningfully in view
  const [studentCoords, setStudentCoords] = useState(MAIN_ROUTE.p0);
  const [isReturning, setIsReturning] = useState(false);
  const [hasDeviated, setHasDeviated] = useState(false);

  const containerRef = useRef(null);
  const userPausedRef = useRef(false);
  const isInViewRef = useRef(false);

  // Check prefers-reduced-motion
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  // Animation state in a ref to avoid stale closures and frame drops
  const animRef = useRef({
    dayIndex: 0,
    phase: 'outbound', // 'outbound' | 'pause_dest' | 'inbound' | 'pause_home' | 'deviating' | 'alert_hold'
    phaseTimer: 0,
    lastTime: null,
    isPlaying: false
  });

  // Keep animRef playing state in sync
  useEffect(() => {
    animRef.current.isPlaying = isPlaying;
  }, [isPlaying]);

  // Listen for reduced motion preference changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e) => {
      setReducedMotion(e.matches);
      if (e.matches) {
        setIsPlaying(false);
        userPausedRef.current = true;
      }
    };
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // IntersectionObserver: Only run animation when demo is meaningfully in view, pause when off-screen
  useEffect(() => {
    if (!containerRef.current || typeof IntersectionObserver === 'undefined') {
      setIsPlaying(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const inView = entry.isIntersecting && entry.intersectionRatio >= 0.25;
        isInViewRef.current = inView;

        if (inView) {
          // If in view, resume playback unless user explicitly paused or reduced motion is active
          if (!userPausedRef.current && !reducedMotion) {
            setIsPlaying(true);
          }
        } else {
          // Off-screen: pause animation to save battery and GPU cycles
          setIsPlaying(false);
        }
      },
      { threshold: [0, 0.25, 0.5] }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [reducedMotion]);

  // Main 60fps Animation Loop
  useEffect(() => {
    let rAFId;

    const tick = (now) => {
      const state = animRef.current;

      if (!state.isPlaying) {
        state.lastTime = null;
        rAFId = requestAnimationFrame(tick);
        return;
      }

      if (state.lastTime == null) {
        state.lastTime = now;
        rAFId = requestAnimationFrame(tick);
        return;
      }

      const delta = Math.min(now - state.lastTime, 100); // Guard against tab backgrounding spikes
      state.lastTime = now;
      state.phaseTimer += delta;

      const isDevDay = state.dayIndex === 3;

      if (!isDevDay) {
        // ── Days 1–3: Regular Round-trip Commute (Home ➔ School ➔ Home) ──
        const travelDuration = 3600; // 3.6s travel each way
        const pauseDuration = 800;   // 0.8s pause at destination

        if (state.phase === 'outbound') {
          const t = Math.min(1, state.phaseTimer / travelDuration);
          const pos = getCubicBezierPoint(t, MAIN_ROUTE.p0, MAIN_ROUTE.c1, MAIN_ROUTE.c2, MAIN_ROUTE.p3);
          setStudentCoords(pos);
          setIsReturning(false);
          setHasDeviated(false);

          if (t >= 1) {
            state.phase = 'pause_dest';
            state.phaseTimer = 0;
          }
        } else if (state.phase === 'pause_dest') {
          setStudentCoords(MAIN_ROUTE.p3);
          if (state.phaseTimer >= pauseDuration) {
            state.phase = 'inbound';
            state.phaseTimer = 0;
          }
        } else if (state.phase === 'inbound') {
          const t = Math.min(1, state.phaseTimer / travelDuration);
          // Return journey: travels from 1 back to 0
          const pos = getCubicBezierPoint(1 - t, MAIN_ROUTE.p0, MAIN_ROUTE.c1, MAIN_ROUTE.c2, MAIN_ROUTE.p3);
          setStudentCoords(pos);
          setIsReturning(true);

          if (t >= 1) {
            state.phase = 'pause_home';
            state.phaseTimer = 0;
          }
        } else if (state.phase === 'pause_home') {
          setStudentCoords(MAIN_ROUTE.p0);
          setIsReturning(false);

          if (state.phaseTimer >= pauseDuration) {
            // Advance to next day
            const nextDay = (state.dayIndex + 1) % 4;
            state.dayIndex = nextDay;
            state.phase = 'outbound';
            state.phaseTimer = 0;
            setDayIndex(nextDay);
            setStudentCoords(nextDay === 3 ? FORK_ROUTE.p0 : MAIN_ROUTE.p0);
          }
        }
      } else {
        // ── Day 4: Takes unexpected route from Home side-exit (214, 188) to Off-road (365, 245) ──
        const travelDuration = 3200; // 3.2s along unexpected path
        const alertHoldDuration = 4800; // 4.8s hold on alert for easy review

        if (state.phase === 'outbound') {
          const progress = Math.min(1, state.phaseTimer / travelDuration);
          const pos = getCubicBezierPoint(progress, FORK_ROUTE.p0, FORK_ROUTE.c1, FORK_ROUTE.c2, FORK_ROUTE.p3);
          setStudentCoords(pos);
          setIsReturning(false);

          if (progress >= 0.28) {
            setHasDeviated(true);
          }

          if (progress >= 1) {
            state.phase = 'alert_hold';
            state.phaseTimer = 0;
            setHasDeviated(true);
          }
        } else if (state.phase === 'alert_hold') {
          setHasDeviated(true);
          setStudentCoords(FORK_ROUTE.p3);

          if (state.phaseTimer >= alertHoldDuration) {
            // Loop cleanly back to Day 1
            state.dayIndex = 0;
            state.phase = 'outbound';
            state.phaseTimer = 0;
            setDayIndex(0);
            setHasDeviated(false);
            setStudentCoords(MAIN_ROUTE.p0);
          }
        }
      }

      rAFId = requestAnimationFrame(tick);
    };

    rAFId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rAFId);
  }, []);

  // Jump directly to a chosen day
  const handleSelectDay = useCallback((index) => {
    const state = animRef.current;
    state.dayIndex = index;
    state.phase = 'outbound';
    state.phaseTimer = 0;
    state.lastTime = null;
    setDayIndex(index);
    setIsReturning(false);
    setHasDeviated(false);
    setStudentCoords(index === 3 ? FORK_ROUTE.p0 : MAIN_ROUTE.p0);
  }, []);

  // Play / Pause toggle
  const handleTogglePlay = useCallback(() => {
    setIsPlaying(prev => {
      const next = !prev;
      userPausedRef.current = !next;
      return next;
    });
  }, []);

  // Reset to Day 1
  const handleReset = useCallback(() => {
    const state = animRef.current;
    state.dayIndex = 0;
    state.phase = 'outbound';
    state.phaseTimer = 0;
    state.lastTime = null;
    userPausedRef.current = false;
    const shouldPlay = !reducedMotion;
    state.isPlaying = shouldPlay;
    setIsPlaying(shouldPlay);
    setDayIndex(0);
    setIsReturning(false);
    setHasDeviated(false);
    setStudentCoords(MAIN_ROUTE.p0);
  }, [reducedMotion]);

  const currentDay = DAYS[dayIndex];
  const isDeviationDay = currentDay.type === 'deviation';

  return (
    <div ref={containerRef} className="sim-story-container">
      {/* ── A. Day Selector & Playback Controls (Clean Segmented Control) ── */}
      <div className="sim-day-bar">
        <div className="sim-day-stepper" role="tablist" aria-label="Select demonstration day">
          {DAYS.map((day, idx) => {
            const isActive = dayIndex === idx;
            const themeClass =
              isActive
                ? `tab--active tab--active-${day.theme}`
                : 'tab--inactive';

            return (
              <button
                key={day.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`sim-segmented-tab ${themeClass}`}
                onClick={() => handleSelectDay(idx)}
              >
                <span className="tab-step-name">{day.step}</span>
                <span className="tab-step-status">{day.statusShort}</span>
              </button>
            );
          })}
        </div>

        {/* Small accessible playback icon buttons */}
        <div className="sim-playback-controls">
          <button
            type="button"
            className="sim-ctrl-btn"
            onClick={handleTogglePlay}
            aria-label={isPlaying ? 'Pause demonstration' : 'Play demonstration'}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            <span className="ctrl-btn-text">{isPlaying ? 'Pause' : 'Play'}</span>
          </button>
          <button
            type="button"
            className="sim-ctrl-btn"
            onClick={handleReset}
            aria-label="Replay demonstration from Day 1"
            title="Replay from Day 1"
          >
            <RotateCcw size={15} />
            <span className="ctrl-btn-text">Restart</span>
          </button>
        </div>
      </div>

      {/* ── C. One-Line Status Strip ── */}
      <div className={`sim-status-strip strip--${currentDay.theme}`}>
        <div className="status-strip-indicator">
          {currentDay.theme === 'red' ? (
            <span className="status-dot dot--red" />
          ) : currentDay.theme === 'green' ? (
            <CheckCircle2 size={15} className="status-icon-green" />
          ) : (
            <span className="status-dot dot--blue" />
          )}
        </div>
        <div className="status-strip-message">
          <strong className="status-message-title">{currentDay.statusTitle}</strong>
          {currentDay.statusSubtitle && (
            <>
              <span className="status-message-separator">•</span>
              <span className="status-message-sub">{currentDay.statusSubtitle}</span>
            </>
          )}
        </div>
      </div>

      {/* ── D. Main Journey Visualization Canvas ── */}
      <div className={`sim-stage ${hasDeviated ? 'sim-stage--alert-state' : ''}`}>
        <svg
          viewBox="0 0 800 300"
          className="sim-svg-canvas"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Subtle Geofence Radial Fills */}
            <radialGradient id="homeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.16" />
              <stop offset="75%" stopColor="#3B82F6" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
            </radialGradient>

            <radialGradient id="schoolGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0D9488" stopOpacity="0.16" />
              <stop offset="75%" stopColor="#0D9488" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#0D9488" stopOpacity="0.0" />
            </radialGradient>

            {/* Subtle Alert Pulse Glow */}
            <radialGradient id="hazardGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#EF4444" stopOpacity="0.35" />
              <stop offset="70%" stopColor="#EF4444" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#EF4444" stopOpacity="0.0" />
            </radialGradient>
          </defs>

          {/* Canvas Background */}
          <rect x="0" y="0" width="800" height="300" fill="#FAFCFF" />

          {/* ── Subdued Neighborhood Map Context (Faint, Translucent Architecture) ── */}
          <g className="sim-map-layer" aria-hidden="true">
            {/* Soft Green Spaces / Neighborhood Parks (Upper and Lower periphery) */}
            <path
              d="M 345 16 C 385 10, 425 12, 460 16 C 472 28, 468 38, 452 42 C 412 45, 372 44, 340 36 C 334 26, 338 18, 345 16 Z"
              fill="#F0FDF4"
              stroke="#D1FAE5"
              strokeWidth="0.6"
              opacity="0.35"
            />
            {/* South-West Gentle Green Space (South of Home, far periphery) */}
            <path
              d="M 35 258 C 75 252, 130 258, 160 270 C 165 288, 140 298, 100 298 C 55 298, 32 286, 35 258 Z"
              fill="#F0FDF4"
              stroke="#D1FAE5"
              strokeWidth="0.6"
              opacity="0.3"
            />
            {/* South-East Community Green Space (South of School, far periphery) */}
            <path
              d="M 640 258 C 680 254, 735 258, 770 270 C 775 288, 750 298, 710 298 C 665 298, 642 286, 640 258 Z"
              fill="#F0FDF4"
              stroke="#D1FAE5"
              strokeWidth="0.6"
              opacity="0.3"
            />

            {/* Subtle Residential Building Footprints (Pale Slate Tint, Peripheral Only) */}
            {/* Northwest Neighborhood Blocks */}
            <rect x="55" y="24" width="28" height="15" rx="2" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="0.5" opacity="0.25" />
            <rect x="90" y="22" width="24" height="16" rx="2" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="0.5" opacity="0.25" />
            <rect x="165" y="20" width="26" height="18" rx="2" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="0.5" opacity="0.25" />

            {/* North-Central Residential Blocks (Above Route, high in margin) */}
            <rect x="250" y="20" width="30" height="15" rx="2" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="0.5" opacity="0.25" />
            <rect x="288" y="22" width="24" height="14" rx="2" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="0.5" opacity="0.22" />

            {/* Northeast Neighborhood Blocks (Near School, high in margin) */}
            <rect x="525" y="20" width="28" height="16" rx="2" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="0.5" opacity="0.25" />
            <rect x="560" y="18" width="30" height="18" rx="2" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="0.5" opacity="0.25" />
            <rect x="715" y="20" width="32" height="18" rx="2" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="0.5" opacity="0.25" />
            <rect x="755" y="24" width="24" height="14" rx="2" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="0.5" opacity="0.22" />

            {/* Southeast Community Blocks (Low in margin, well clear of routes) */}
            <rect x="475" y="265" width="30" height="16" rx="2" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="0.5" opacity="0.25" />
            <rect x="515" y="262" width="36" height="20" rx="2" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="0.5" opacity="0.25" />
            <rect x="560" y="266" width="28" height="16" rx="2" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="0.5" opacity="0.22" />

            {/* Translucent Connecting Secondary Streets (Faint, peripheral, never crossing routes) */}
            {/* Northern Cross-Street */}
            <path
              d="M 15 44 H 785"
              stroke="#E2E8F0"
              strokeWidth="1.2"
              fill="none"
              strokeLinecap="round"
              opacity="0.28"
            />
            {/* Southern Cross-Street */}
            <path
              d="M 15 270 H 785"
              stroke="#E2E8F0"
              strokeWidth="1.2"
              fill="none"
              strokeLinecap="round"
              opacity="0.28"
            />
          </g>

          {/* 1. Normal Route Roadbed (Begins at Home perimeter 223, 150 and ends at School perimeter 577, 150) */}
          <path
            d="M 223 150 C 330 118, 470 178, 577 150"
            stroke="#EEF2F6"
            strokeWidth="18"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 223 150 C 330 118, 470 178, 577 150"
            stroke="#FFFFFF"
            strokeWidth="10"
            strokeLinecap="round"
            fill="none"
          />

          {/* 2. Expected Commute Line (Boundary-to-boundary, zero penetration through geofence centers) */}
          <path
            d="M 223 150 C 330 118, 470 178, 577 150"
            stroke={
              dayIndex >= 2
                ? '#10B981' // Clean confident green for established routine
                : dayIndex === 1
                ? '#3B82F6' // Defined blue for Day 2
                : '#93C5FD' // Subtle blue for Day 1
            }
            strokeWidth={dayIndex >= 2 ? "3.5" : "3"}
            strokeDasharray={dayIndex >= 2 ? "none" : "6 5"}
            strokeLinecap="round"
            fill="none"
          />

          {/* Fixed Route Label — Positioned cleanly above central commute path */}
          <text
            x="400"
            y="74"
            textAnchor="middle"
            fill={dayIndex >= 2 ? "#059669" : "#64748B"}
            fontSize="11"
            fontWeight={dayIndex >= 2 ? "600" : "500"}
            letterSpacing="0.01em"
          >
            {dayIndex >= 2 ? "Usual Route (8:15 AM)" : "Commute Route"}
          </text>

          {/* 3. Day 4 Deviation Red Path (Exits Home perimeter at 214, 188 to Off-road 365, 245 without crossing green route) */}
          {isDeviationDay && (
            <>
              <path
                d="M 214 188 C 260 212, 315 236, 365 245"
                stroke="#FEF2F2"
                strokeWidth="16"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 214 188 C 260 212, 315 236, 365 245"
                stroke="#EF4444"
                strokeWidth="3.5"
                strokeDasharray="6 5"
                strokeLinecap="round"
                fill="none"
                className="route-line-alert"
              />
            </>
          )}

          {/* 4. HOME GEOFENCE (Radius 88px, distinct dashed boundary & outer wave) */}
          <g>
            <circle cx="135" cy="150" r="88" fill="url(#homeGlow)" />
            <circle
              cx="135"
              cy="150"
              r="88"
              fill="none"
              stroke="#3B82F6"
              strokeWidth="1.75"
              strokeDasharray="6 4"
            />
            {/* Subtle Expanding Ripple Wave */}
            <circle cx="135" cy="150" r="88" fill="none" stroke="rgba(59, 130, 246, 0.45)" strokeWidth="1.2">
              <animate attributeName="r" values="88;122" dur="3s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.6;0" dur="3s" repeatCount="indefinite" />
            </circle>
          </g>

          {/* 5. SCHOOL GEOFENCE (Radius 88px, distinct dashed boundary & outer wave) */}
          <g>
            <circle cx="665" cy="150" r="88" fill="url(#schoolGlow)" />
            <circle
              cx="665"
              cy="150"
              r="88"
              fill="none"
              stroke="#0D9488"
              strokeWidth="1.75"
              strokeDasharray="6 4"
            />
            {/* Subtle Expanding Ripple Wave */}
            <circle cx="665" cy="150" r="88" fill="none" stroke="rgba(13, 148, 136, 0.45)" strokeWidth="1.2">
              <animate attributeName="r" values="88;122" dur="3s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.6;0" dur="3s" repeatCount="indefinite" />
            </circle>
          </g>

          {/* 6. Day 4 Off-road Marker at (365, 245) — Clean lower destination */}
          {isDeviationDay && (
            <g transform="translate(365, 245)">
              {hasDeviated && (
                <circle cx="0" cy="0" r="26" fill="url(#hazardGlow)">
                  <animate attributeName="r" values="14;30;14" dur="1.8s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.8s" repeatCount="indefinite" />
                </circle>
              )}
              <circle
                cx="0"
                cy="0"
                r="7"
                fill={hasDeviated ? "#EF4444" : "#E2E8F0"}
                stroke="#FFFFFF"
                strokeWidth="2"
              />
              <text
                x="0"
                y="18"
                textAnchor="middle"
                fill={hasDeviated ? "#DC2626" : "#94A3B8"}
                fontSize="10"
                fontWeight="600"
              >
                Off-road
              </text>
            </g>
          )}
        </svg>

        {/* ── Home Geofence Label ── */}
        <div className="sim-geofence-label-wrap sim-geofence-label--home">
          <span className="sim-geofence-label label--home">
            <span className="label-indicator-dot dot--blue" />
            <span>Home Geofence</span>
          </span>
        </div>

        {/* ── Home Location Anchor (Centered in geofence circle) ── */}
        <div className="sim-anchor sim-anchor--home">
          <div className="anchor-img-wrap">
            <img src={homeImg} alt="Home Safe Zone" className="anchor-building-img" />
          </div>
        </div>

        {/* ── School Geofence Label ── */}
        <div className="sim-geofence-label-wrap sim-geofence-label--school">
          <span className="sim-geofence-label label--school">
            <span className="label-indicator-dot dot--teal" />
            <span>School Geofence</span>
          </span>
        </div>

        {/* ── School Location Anchor (Centered in geofence circle) ── */}
        <div className="sim-anchor sim-anchor--school">
          <div className="anchor-img-wrap">
            <img src={schoolImg} alt="School Safe Zone" className="anchor-building-img anchor-building-img--school" />
          </div>
        </div>

        {/* ── Student Character (Smooth Movement — NO overlapping labels or cards!) ── */}
        <div
          className={`sim-student-sprite ${hasDeviated ? 'student-sprite--deviated' : ''}`}
          style={{
            left: `${(studentCoords.x / 800) * 100}%`,
            top: `${(studentCoords.y / 300) * 100}%`,
            transform: `translate(-50%, -85%) scaleX(${isReturning ? -1 : 1})`
          }}
        >
          <img
            src={studentImg}
            alt="Student traveling"
            className="student-avatar-img"
          />
          <div className="student-foot-shadow" />
        </div>
      </div>

      {/* ── E. Dedicated Reserved Alert Area ── */}
      <div className={`sim-alert-slot ${isDeviationDay && hasDeviated ? 'has-alert' : ''}`} aria-live="polite">
        <div className={`compact-alert-card ${isDeviationDay && hasDeviated ? 'alert-card--visible' : 'alert-card--hidden'}`}>
          <div className="alert-card-icon-container">
            <ShieldAlert size={19} className="alert-icon-svg" />
          </div>
          <div className="alert-card-body">
            <div className="alert-card-top-row">
              <h4 className="alert-title">Route deviation detected</h4>
              <span className="alert-status-badge">
                <span className="alert-badge-dot" />
                <span>Caregiver notified</span>
              </span>
            </div>
            <p className="alert-description">The student moved away from their expected commute corridor.</p>
            <div className="alert-meta-row">
              <span className="alert-meta-item">
                <span className="meta-time">8:20 AM</span>
                <span className="meta-sep">·</span>
                <span>420 m from usual path</span>
              </span>
              <span className="alert-meta-dot">•</span>
              <span className="alert-meta-item">
                Deviation score: <strong className="meta-confidence">0.94 (High)</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── F. Bottom Story Steps (Clean 3-Step Explanation) ── */}
      <div className="sim-story-steps">
        <div className="story-step-card">
          <div className="story-step-badge">1</div>
          <div className="story-step-info">
            <h4 className="story-step-heading">Learn</h4>
            <p className="story-step-text">CareTag observes the usual journey.</p>
          </div>
        </div>

        <div className="story-step-card">
          <div className="story-step-badge">2</div>
          <div className="story-step-info">
            <h4 className="story-step-heading">Recognize</h4>
            <p className="story-step-text">Three consistent days establish the routine.</p>
          </div>
        </div>

        <div className="story-step-card">
          <div className="story-step-badge">3</div>
          <div className="story-step-info">
            <h4 className="story-step-heading">Alert</h4>
            <p className="story-step-text">An unexpected route triggers a deviation alert.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
