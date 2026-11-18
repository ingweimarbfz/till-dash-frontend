import React from 'react'

// Símbolo de TillDash+: una "T" que es a la vez el rollo de la caja registradora y el tiquete que sale de ella,
// con el "+" en el color de acento. Toma los colores de la apariencia del establecimiento (variables CSS que
// aplica applyTheme) y cae a los colores de fábrica de la marca si no hay tema cargado.
const C = {
  brand: 'var(--brand, #E4572E)',
  onBrand: 'var(--on-brand, #FFFFFF)',
  accent: 'var(--accent, #F2A541)',
  onAccent: 'var(--on-accent, #1F2933)',
}
export const BrandSymbol = ({ size = 32, title = 'TillDash+' }) => (
  <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={title} className="brand-symbol">
    <rect x="4" y="4" width="112" height="112" rx="30" style={{ fill: C.brand }} />
    <rect x="20" y="30" width="64" height="15" rx="7.5" style={{ fill: C.onBrand }} />
    <path d="M40 40 H64 V86 L58 92 L52 86 L46 92 L40 86 Z" strokeWidth="3" strokeLinejoin="round" style={{ fill: C.onBrand, stroke: C.onBrand }} />
    <path d="M46 58 H58 M46 68 H58" strokeWidth="4" strokeLinecap="round" style={{ stroke: C.brand }} />
    <circle cx="91" cy="30" r="15" strokeWidth="4" style={{ fill: C.accent, stroke: C.brand }} />
    <path d="M91 22.5 V37.5 M83.5 30 H98.5" strokeWidth="5" strokeLinecap="round" style={{ stroke: C.onAccent }} />
  </svg>
)

// Logotipo horizontal: Till + Dash (color principal) + "+" (acento). onDark: para la barra lateral.
export const BrandLogo = ({ size = 34, onDark = false }) => (
  <span className={`brand-logo${onDark ? ' on-dark' : ''}`} style={{ '--logo-size': `${size}px` }}>
    <BrandSymbol size={size} />
    <span className="brand-word">Till<b>Dash</b><sup>+</sup></span>
  </span>
)

export default BrandLogo
