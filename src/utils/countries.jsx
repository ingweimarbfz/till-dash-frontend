import React from 'react'

// Países y monedas (KU-026). Las banderas son SVG locales en /public/flags.
export const Flag = ({ code, size = 20, className = '' }) => code
  ? <img className={`flag ${className}`} src={`/flags/${String(code).toLowerCase()}.svg`} alt="" width={Math.round(size * 4 / 3)} height={size} loading="lazy" />
  : null

// Monedas sin centavos en el uso diario.
const NO_DECIMALS = new Set(['COP', 'CLP', 'PYG', 'ARS'])
export const moneyIn = (value, currency = 'COP', locale = 'es-CO') => {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  const dec = NO_DECIMALS.has(currency) || Number.isInteger(n) ? 0 : 2
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n)
  } catch {
    return `${currency} ${n.toLocaleString(locale)}`
  }
}

// "🇨🇴 Colombia · COP" como etiqueta de selector (texto) y como componente.
export const CountryLabel = ({ c, showName = true }) => c
  ? <span className="country-label"><Flag code={c.code} size={14} />{showName && <span>{c.name}</span>}<b className="cur">{c.currency}</b></span>
  : null

export const limitText = (v, unit = '') => (v === null || v === undefined ? 'Ilimitado' : `${Number(v).toLocaleString('es-CO')}${unit ? ` ${unit}` : ''}`)

// Selector de país con bandera y código de moneda (un <select> nativo no muestra imágenes).
export const CountrySelect = ({ countries = [], value, onChange, id, placeholder = 'Selecciona el país', dark = false }) => {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef(null)
  React.useEffect(() => {
    const onDoc = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  const cur = countries.find((c) => c.code === value)
  return (
    <div className={`country-select${dark ? ' dark' : ''}`} ref={ref}>
      <button type="button" id={id} className="country-select-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {cur ? <CountryLabel c={cur} /> : <span className="muted">{placeholder}</span>}
        <span className="caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul className="country-select-list" role="listbox">
          {countries.map((c) => (
            <li key={c.code} role="option" aria-selected={c.code === value}>
              <button type="button" className={c.code === value ? 'on' : ''} onClick={() => { onChange(c.code); setOpen(false) }}>
                <CountryLabel c={c} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Nombre corto de cada funcionalidad para chips.
export const FEATURE_SHORT = {
  mesas: 'Mesas y pedidos', caja: 'Caja y propinas', productos: 'Carta e inventario', comandas: 'Comandas', carta_qr: 'Carta QR',
  cuentas_por_cobrar: 'Cuentas por cobrar', promociones: 'Promociones', incidentes: 'Incidentes', reportes: 'Reportes',
  finanzas: 'Finanzas y socios', bitacora: 'Bitácora', telegram: 'Telegram', marca: 'Marca propia'
}

// Igual que el backend: anual con descuento, redondeado según el tamaño del precio.
export const annualPrice = (month, discount) => {
  const p = Number(month)
  const step = p >= 100000 ? 1000 : p >= 1000 ? 100 : 1
  return Math.round((p * 12 * (1 - Number(discount || 0) / 100)) / step) * step
}
