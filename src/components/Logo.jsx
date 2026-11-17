import React from 'react'

// Símbolo de TillDash+: una "T" que es a la vez el rollo de la caja registradora y el tiquete que sale de ella,
// con el "+" en ámbar. Usa los colores de fábrica de la marca (no los del establecimiento).
export const BrandSymbol = ({ size = 32, title = 'TillDash+' }) => (
  <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={title} className="brand-symbol">
    <rect x="4" y="4" width="112" height="112" rx="30" fill="#E4572E" />
    <rect x="20" y="30" width="64" height="15" rx="7.5" fill="#FFFFFF" />
    <path d="M40 40 H64 V86 L58 92 L52 86 L46 92 L40 86 Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="3" strokeLinejoin="round" />
    <path d="M46 58 H58 M46 68 H58" stroke="#E4572E" strokeWidth="4" strokeLinecap="round" />
    <circle cx="91" cy="30" r="15" fill="#F2A541" stroke="#E4572E" strokeWidth="4" />
    <path d="M91 22.5 V37.5 M83.5 30 H98.5" stroke="#1F2933" strokeWidth="5" strokeLinecap="round" />
  </svg>
)

// Logotipo horizontal: Till + Dash (paprika) + "+" en ámbar. onDark: para la barra lateral.
export const BrandLogo = ({ size = 34, onDark = false }) => (
  <span className={`brand-logo${onDark ? ' on-dark' : ''}`} style={{ '--logo-size': `${size}px` }}>
    <BrandSymbol size={size} />
    <span className="brand-word">Till<b>Dash</b><sup>+</sup></span>
  </span>
)

export default BrandLogo
