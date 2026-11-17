// Aplica la apariencia del establecimiento (colores, fuente, modo) sobre los tokens de tokens.css.
// La llama SettingsContext al cargar la configuración y la página de Apariencia para la vista previa.

const hexToRgb = (hex) => {
  const n = parseInt(String(hex).slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const rgbToHex = (r, g, b) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
// Mezcla un color con otro: t = 0 deja el color, t = 1 llega al otro.
export const mix = (hex, other, t) => {
  const a = hexToRgb(hex); const b = hexToRgb(other)
  return rgbToHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)
}
// Luminancia relativa (WCAG) para elegir texto blanco o oscuro sobre un color.
export const luminance = (hex) => {
  const c = hexToRgb(hex).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
export const contrastOn = (hex) => (luminance(hex) > 0.45 ? '#1F2933' : '#FFFFFF')

export const FONT_URL = (font) => `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replace(/%20/g, '+')}:wght@400;500;600;700;800&display=swap`

export const DEFAULT_THEME = { colors: { primary: '#E4572E', secondary: '#1F2933', accent: '#F2A541' }, fontFamily: 'Outfit', themeMode: 'claro' }

export const applyTheme = (t = DEFAULT_THEME) => {
  const { primary, secondary, accent } = { ...DEFAULT_THEME.colors, ...(t.colors || {}) }
  const root = document.documentElement.style
  const dark = t.themeMode === 'oscuro' || (t.themeMode === 'sistema' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  // Tonos suaves: sobre blanco en modo claro y sobre la superficie oscura en modo oscuro.
  const base = dark ? '#1A2128' : '#FFFFFF'
  root.setProperty('--brand', primary)
  root.setProperty('--brand-600', mix(primary, '#000000', 0.15))
  root.setProperty('--brand-50', mix(primary, base, dark ? 0.84 : 0.92))
  root.setProperty('--brand-100', mix(primary, base, dark ? 0.68 : 0.8))
  root.setProperty('--on-brand', contrastOn(primary))
  root.setProperty('--sidebar', secondary)
  root.setProperty('--sidebar-2', mix(secondary, '#FFFFFF', 0.07))
  root.setProperty('--sidebar-line', mix(secondary, '#FFFFFF', 0.14))
  root.setProperty('--accent', accent)
  root.setProperty('--accent-50', mix(accent, base, dark ? 0.84 : 0.88))
  root.setProperty('--on-accent', contrastOn(accent) === '#FFFFFF' ? '#FFFFFF' : secondary)
  const font = t.fontFamily || DEFAULT_THEME.fontFamily
  root.setProperty('--font-family', `'${font}'`)
  const link = document.getElementById('app-font')
  if (link && !link.href.includes(encodeURIComponent(font).replace(/%20/g, '+'))) link.href = FONT_URL(font)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', primary)
  setFavicon(t.faviconUrl || symbolDataUrl(primary, accent, secondary))
}

// El símbolo de TillDash+ como SVG con los colores del establecimiento, para la pestaña del navegador.
export const symbolDataUrl = (primary, accent, secondary) => {
  const on = contrastOn(primary)
  const onAccent = contrastOn(accent) === '#FFFFFF' ? '#FFFFFF' : secondary
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect x="4" y="4" width="112" height="112" rx="30" fill="${primary}"/><rect x="20" y="30" width="64" height="15" rx="7.5" fill="${on}"/><path d="M40 40 H64 V86 L58 92 L52 86 L46 92 L40 86 Z" fill="${on}" stroke="${on}" stroke-width="3" stroke-linejoin="round"/><path d="M46 58 H58 M46 68 H58" stroke="${primary}" stroke-width="4" stroke-linecap="round"/><circle cx="91" cy="30" r="15" fill="${accent}" stroke="${primary}" stroke-width="4"/><path d="M91 22.5 V37.5 M83.5 30 H98.5" stroke="${onAccent}" stroke-width="5" stroke-linecap="round"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const setFavicon = (href) => {
  let link = document.querySelector('link[rel="icon"][data-dynamic]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    link.dataset.dynamic = ''
    document.head.appendChild(link)
  }
  if (link.href !== href) link.href = href
}
