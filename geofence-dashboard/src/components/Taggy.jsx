import React from 'react';
import taggyImg from '../assets/taggy.png';

/**
 * Official Taggy Mascot Component
 * CareTag's friendly safety companion robot.
 * Uses the official transparent 3D character asset with contextual pose styling and accessories.
 */
export default function Taggy({
  pose = 'wave',
  size = 120,
  className = '',
  animate = false,
  badgeText = null,
  style = {}
}) {
  return (
    <div
      className={`taggy-container taggy--${pose} ${animate ? 'taggy--float' : ''} ${className}`}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        userSelect: 'none',
        ...style
      }}
      aria-label="Taggy, CareTag safety companion robot"
    >
      <img
        src={taggyImg}
        alt="Taggy, CareTag safety companion"
        style={{
          width: `${size}px`,
          height: 'auto',
          maxHeight: `${size * 1.3}px`,
          objectFit: 'contain',
          filter: 'drop-shadow(0 8px 20px rgba(6, 26, 51, 0.35))'
        }}
      />
      {badgeText && (
        <span
          style={{
            marginTop: '-6px',
            background: '#0B2D5B',
            color: '#14B8A6',
            border: '1px solid #14B8A6',
            fontSize: '0.65rem',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '999px',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}
        >
          {badgeText}
        </span>
      )}
    </div>
  );
}
