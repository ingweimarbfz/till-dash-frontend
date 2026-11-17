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
  root.setProperty('--brand', primary)
  root.setProperty('--brand-600', mix(primary, '#000000', 0.15))
  root.setProperty('--brand-50', mix(primary, '#FFFFFF', 0.92))
  root.setProperty('--brand-100', mix(primary, '#FFFFFF', 0.8))
  root.setProperty('--on-brand', contrastOn(primary))
  root.setProperty('--sidebar', secondary)
  root.setProperty('--sidebar-2', mix(secondary, '#FFFFFF', 0.07))
  root.setProperty('--sidebar-line', mix(secondary, '#FFFFFF', 0.14))
  root.setProperty('--accent', accent)
  root.setProperty('--accent-50', mix(accent, '#FFFFFF', 0.88))
  const font = t.fontFamily || DEFAULT_THEME.fontFamily
  root.setProperty('--font-family', `'${font}'`)
  const link = document.getElementById('app-font')
  if (link && !link.href.includes(encodeURIComponent(font).replace(/%20/g, '+'))) link.href = FONT_URL(font)
  const dark = t.themeMode === 'oscuro' || (t.themeMode === 'sistema' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', primary)
}
