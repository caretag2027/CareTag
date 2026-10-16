import React from 'react';
import symbolImg from '../assets/caretag-symbol.png';

/**
 * Official CareTag Logo Component
 * Incorporates the official raster assets with responsive vector scaling and dark mode support
 */
export function CareTagSymbol({ size = 36, className = '', isDark = false, glow = false }) {
  return (
    <img
      src={symbolImg}
      alt="CareTag Symbol"
      width={size}
      height={size}
      className={`caretag-symbol ${className}`}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        objectFit: 'contain',
        filter: glow ? 'drop-shadow(0 2px 8px rgba(255, 255, 255, 0.45)) drop-shadow(0 0 10px rgba(20, 184, 166, 0.5))' : 'none'
      }}
    />
  );
}

export default function CareTagLogo({
  variant = 'horizontal',
  size = 'md',
  showTagline = false,
  className = '',
  onClick
}) {
  const isDark = variant === 'dark';
  const isStacked = variant === 'stacked';
  const isSymbolOnly = variant === 'symbol';

  // Dimension scaling
  const sizes = {
    sm: { height: 28, symbol: 26 },
    md: { height: 38, symbol: 36 },
    lg: { height: 48, symbol: 46 },
    xl: { height: 64, symbol: 60 }
  };
  const s = sizes[size] || sizes.md;

  if (isSymbolOnly) {
    return (
      <span
        className={`caretag-logo-symbol-only ${className}`}
        onClick={onClick}
        style={{ cursor: onClick ? 'pointer' : 'default', display: 'inline-flex' }}
      >
        <CareTagSymbol size={s.symbol} isDark={isDark} />
      </span>
    );
  }

  // If dark background is needed, the logo text can be white + teal
  if (isDark) {
    return (
      <div
        className={`caretag-logo caretag-logo--dark ${className}`}
        onClick={onClick}
        style={{
          display: 'inline-flex',
          flexDirection: isStacked ? 'column' : 'row',
          alignItems: 'center',
          gap: isStacked ? '6px' : '10px',
          cursor: onClick ? 'pointer' : 'default',
          textDecoration: 'none',
          userSelect: 'none'
        }}
      >
        <div style={{
          background: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '10px',
          padding: '3px 5px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(255, 255, 255, 0.15)'
        }}>
          <CareTagSymbol size={s.symbol} glow />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: isStacked ? 'center' : 'flex-start', lineHeight: 1.1 }}>
          <span
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 700,
              fontSize: `${s.height * 0.65}px`,
              letterSpacing: '-0.02em',
              display: 'inline-flex',
              alignItems: 'baseline'
            }}
          >
            <span style={{ color: '#FFFFFF' }}>Care</span>
            <span style={{ color: '#14B8A6' }}>Tag</span>
          </span>
          {showTagline && (
            <span
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: `${s.height * 0.22}px`,
                fontWeight: 600,
                letterSpacing: '0.18em',
                color: '#93C5FD',
                textTransform: 'uppercase',
                marginTop: '2px',
                whiteSpace: 'nowrap'
              }}
            >
              Safety Beyond Boundaries
            </span>
          )}
        </div>
      </div>
    );
  }

  // Light / Standard version using official symbol + crisp brand typography
  return (
    <div
      className={`caretag-logo caretag-logo--horizontal ${className}`}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '9px',
        cursor: onClick ? 'pointer' : 'default',
        textDecoration: 'none',
        userSelect: 'none'
      }}
    >
      <CareTagSymbol size={s.symbol} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 700,
            fontSize: `${s.height * 0.72}px`,
            letterSpacing: '-0.025em',
            display: 'inline-flex',
            alignItems: 'baseline'
          }}
        >
          <span style={{ color: '#0F2748' }}>Care</span>
          <span style={{ color: '#0D9488' }}>Tag</span>
        </span>
        {showTagline && (
          <span
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: `${s.height * 0.24}px`,
              fontWeight: 600,
              letterSpacing: '0.14em',
              color: '#64748B',
              textTransform: 'uppercase',
              marginTop: '3px'
            }}
          >
            Safety Beyond Boundaries
          </span>
        )}
      </div>
    </div>
  );
}
