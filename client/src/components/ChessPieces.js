/**
 * ChessPieces.js
 * Staunton-style SVG chess pieces.
 * Render <SvgDefs /> once in the app root so gradient IDs are available globally.
 */

import React from 'react';

/* ── Shared gradient definitions ───────────────────────────────── */
export function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute', overflow: 'hidden' }}>
      <defs>
        {/* White piece: cream highlight → warm tan shadow */}
        <linearGradient id="kf-w-grad" x1="25%" y1="0%" x2="75%" y2="100%">
          <stop offset="0%"   stopColor="#FFFAF2" />
          <stop offset="55%"  stopColor="#F0E6D0" />
          <stop offset="100%" stopColor="#C8B898" />
        </linearGradient>
        {/* White piece inner highlight spot */}
        <radialGradient id="kf-w-shine" cx="30%" cy="25%" r="55%">
          <stop offset="0%"   stopColor="#FFFAF2" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#F0E6D0" stopOpacity="0" />
        </radialGradient>

        {/* Black piece: warm dark brown → near-black */}
        <linearGradient id="kf-b-grad" x1="25%" y1="0%" x2="75%" y2="100%">
          <stop offset="0%"   stopColor="#3D2410" />
          <stop offset="50%"  stopColor="#1A0A02" />
          <stop offset="100%" stopColor="#080402" />
        </linearGradient>
        {/* Black piece inner shine */}
        <radialGradient id="kf-b-shine" cx="30%" cy="25%" r="55%">
          <stop offset="0%"   stopColor="#7A4A20" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#1A0A02" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/* ── Piece renderer ─────────────────────────────────────────────── */
const SW = 1.4; // stroke width

export function ChessPiece({ code, size = 42 }) {
  const isWhite = code[0] === 'w';
  const type    = code[1];

  const fill       = isWhite ? 'url(#kf-w-grad)'   : 'url(#kf-b-grad)';
  const shine      = isWhite ? 'url(#kf-w-shine)'  : 'url(#kf-b-shine)';
  const stroke     = isWhite ? '#1A0A02'            : '#B8962E';
  const detailFill = isWhite ? 'rgba(26,10,2,0.18)' : 'rgba(184,150,46,0.22)';

  const common = {
    fill, stroke,
    strokeWidth: SW,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  return (
    <svg
      width={size} height={size}
      viewBox="0 0 45 45"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {type === 'P' && <Pawn    {...common} shine={shine} detailFill={detailFill} />}
      {type === 'R' && <Rook    {...common} shine={shine} detailFill={detailFill} />}
      {type === 'N' && <Knight  {...common} shine={shine} stroke={stroke} detailFill={detailFill} isWhite={isWhite} />}
      {type === 'B' && <Bishop  {...common} shine={shine} detailFill={detailFill} />}
      {type === 'Q' && <Queen   {...common} shine={shine} detailFill={detailFill} />}
      {type === 'K' && <King    {...common} shine={shine} detailFill={detailFill} isWhite={isWhite} />}
    </svg>
  );
}

/* ── Individual piece shapes ────────────────────────────────────── */

function Pawn({ fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin, shine }) {
  const s = { fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin };
  return (
    <g>
      {/* Head */}
      <circle cx="22.5" cy="9.5" r="4.5" {...s} />
      {/* Neck + body */}
      <path d="M 20.2 14 Q 17 22.5 15 28 L 30 28 Q 28 22.5 24.8 14 Z" {...s} />
      {/* Base step 1 */}
      <rect x="12.5" y="28" width="20" height="4" rx="1" {...s} />
      {/* Base step 2 */}
      <rect x="10"   y="32" width="25" height="5.5" rx="1.5" {...s} />
      {/* Shine overlay */}
      <circle cx="22.5" cy="9.5" r="4.5" fill={shine} stroke="none" />
    </g>
  );
}

function Rook({ fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin, shine, detailFill }) {
  const s = { fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin };
  return (
    <g>
      {/* 3 battlements */}
      <rect x="10"    y="9"  width="6"   height="6" rx="0.5" {...s} />
      <rect x="19.5"  y="9"  width="6"   height="6" rx="0.5" {...s} />
      <rect x="29"    y="9"  width="6"   height="6" rx="0.5" {...s} />
      {/* Connector strip between battlements */}
      <rect x="10" y="14" width="25" height="1.5" fill={fill} stroke="none" />
      {/* Tower body */}
      <rect x="10" y="15" width="25" height="14" {...s} />
      {/* Inner window line */}
      <line x1="11" y1="22" x2="34" y2="22" stroke={detailFill} strokeWidth="1" fill="none" />
      {/* Base step 1 */}
      <rect x="7.5" y="29"   width="30" height="4"   rx="1"   {...s} />
      {/* Base step 2 */}
      <rect x="6"   y="33"   width="33" height="5.5" rx="1.5" {...s} />
      {/* Shine on tower */}
      <rect x="10" y="15" width="25" height="14" fill={shine} stroke="none" />
    </g>
  );
}

function Knight({ fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin, shine, detailFill, isWhite }) {
  const s = { fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin };
  const eyeFill   = isWhite ? '#1A0A02' : '#C9A84C';
  const muzzleFill = isWhite ? 'rgba(26,10,2,0.12)' : 'rgba(201,168,76,0.15)';
  return (
    <g>
      {/* Horse head profile (facing right) */}
      <path
        d={`
          M 15.5 35
          L 15.5 27
          C 12.5 24 10 19 11.5 14
          C 13 9.5 17 7.5 21 7
          C 25 6.5 30 8 32.5 12
          C 35 16 34.5 22 32 26
          C 30.5 28.5 28.5 29.5 27 31
          L 29.5 35
          Z
        `}
        {...s}
      />
      {/* Muzzle bump */}
      <path
        d="M 11.5 14 C 13 11.5 16.5 11 17.5 14"
        fill={muzzleFill} stroke={stroke} strokeWidth="1"
      />
      {/* Eye */}
      <circle cx="26.5" cy="16.5" r="2" fill={eyeFill} stroke="none" />
      <circle cx="27"   cy="15.8" r="0.6" fill="rgba(255,255,255,0.5)" stroke="none" />
      {/* Mane detail */}
      <path
        d="M 19 10 C 17.5 14 16 18 16.5 22"
        fill="none" stroke={detailFill} strokeWidth="1"
      />
      {/* Base step 1 */}
      <rect x="10"  y="35" width="25" height="4"   rx="1"   fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      {/* Base step 2 */}
      <rect x="7.5" y="39" width="30" height="3.5" rx="1.5" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      {/* Shine */}
      <path
        d="M 15.5 35 L 15.5 27 C 12.5 24 10 19 11.5 14 C 13 9.5 17 7.5 21 7 C 25 6.5 30 8 32.5 12 C 35 16 34.5 22 32 26 C 30.5 28.5 28.5 29.5 27 31 L 29.5 35 Z"
        fill={shine} stroke="none"
      />
    </g>
  );
}

function Bishop({ fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin, shine, detailFill }) {
  const s = { fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin };
  return (
    <g>
      {/* Pin tip */}
      <circle cx="22.5" cy="5"  r="1.3" {...s} />
      {/* Ball finial */}
      <circle cx="22.5" cy="10" r="4.2" {...s} />
      {/* Notch (slot cut into ball) */}
      <line x1="19.5" y1="10" x2="25.5" y2="10"
        stroke={detailFill} strokeWidth="1.5" fill="none" />
      {/* Body */}
      <path
        d="M 22.5 14.2 C 20 17.5 17 22 15.5 28.5 L 29.5 28.5 C 28 22 25 17.5 22.5 14.2 Z"
        {...s}
      />
      {/* Base step 1 */}
      <rect x="12.5" y="28.5" width="20"  height="4"   rx="1"   {...s} />
      {/* Base step 2 */}
      <rect x="10"   y="32.5" width="25"  height="5.5" rx="1.5" {...s} />
      {/* Shine */}
      <circle cx="22.5" cy="10" r="4.2" fill={shine} stroke="none" />
      <path
        d="M 22.5 14.2 C 20 17.5 17 22 15.5 28.5 L 29.5 28.5 C 28 22 25 17.5 22.5 14.2 Z"
        fill={shine} stroke="none"
      />
    </g>
  );
}

function Queen({ fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin, shine, detailFill }) {
  const s = { fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin };
  // Crown ball positions
  const balls = [11.5, 17, 22.5, 28, 33.5];
  const ballY  = [10,    7,   6,   7,   10];
  return (
    <g>
      {/* Crown balls */}
      {balls.map((cx, i) => (
        <circle key={i} cx={cx} cy={ballY[i]} r="2.5" {...s} />
      ))}
      {/* Body — concave waist */}
      <path
        d={`
          M 11 13
          C 13 18.5 14.5 22.5 14 29
          L 31 29
          C 30.5 22.5 32 18.5 34 13
          C 30 16.5 27 18  22.5 18
          C 18 18  15 16.5 11 13
          Z
        `}
        {...s}
      />
      {/* Crown ring above body */}
      <path
        d="M 11 13 Q 22.5 11 34 13"
        fill="none" stroke={detailFill} strokeWidth="1"
      />
      {/* Base step 1 */}
      <rect x="9"   y="29" width="27" height="4"   rx="1"   {...s} />
      {/* Base step 2 */}
      <rect x="7"   y="33" width="31" height="5.5" rx="1.5" {...s} />
      {/* Shine overlays */}
      {balls.map((cx, i) => (
        <circle key={i} cx={cx} cy={ballY[i]} r="2.5" fill={shine} stroke="none" />
      ))}
      <path
        d="M 11 13 C 13 18.5 14.5 22.5 14 29 L 31 29 C 30.5 22.5 32 18.5 34 13 C 30 16.5 27 18 22.5 18 C 18 18 15 16.5 11 13 Z"
        fill={shine} stroke="none"
      />
    </g>
  );
}

function King({ fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin, shine, detailFill, isWhite }) {
  const s = { fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin };
  const crossFill = isWhite ? '#C9A84C' : '#C9A84C'; // gold cross for both
  return (
    <g>
      {/* Cross — vertical */}
      <rect x="20.5" y="1.5" width="4.5" height="9"  rx="1"
        fill={crossFill} stroke={stroke} strokeWidth={strokeWidth} />
      {/* Cross — horizontal */}
      <rect x="15.5" y="4.5" width="14"  height="4"  rx="1"
        fill={crossFill} stroke={stroke} strokeWidth={strokeWidth} />
      {/* Body ball */}
      <circle cx="22.5" cy="15.5" r="4.2" {...s} />
      {/* Body — concave sides */}
      <path
        d={`
          M 17 19.5
          C 15.5 23 14.5 25.5 14 30
          L 31 30
          C 30.5 25.5 29.5 23 28 19.5
          C 26 22 24.5 22.5 22.5 22.5
          C 20.5 22.5 19 22 17 19.5
          Z
        `}
        {...s}
      />
      {/* Waist ring */}
      <path
        d="M 17 19.5 Q 22.5 17.5 28 19.5"
        fill="none" stroke={detailFill} strokeWidth="1"
      />
      {/* Base step 1 */}
      <rect x="9"  y="30" width="27" height="4"   rx="1"   {...s} />
      {/* Base step 2 */}
      <rect x="7"  y="34" width="31" height="5.5" rx="1.5" {...s} />
      {/* Shine */}
      <circle cx="22.5" cy="15.5" r="4.2" fill={shine} stroke="none" />
      <path
        d="M 17 19.5 C 15.5 23 14.5 25.5 14 30 L 31 30 C 30.5 25.5 29.5 23 28 19.5 C 26 22 24.5 22.5 22.5 22.5 C 20.5 22.5 19 22 17 19.5 Z"
        fill={shine} stroke="none"
      />
    </g>
  );
}
