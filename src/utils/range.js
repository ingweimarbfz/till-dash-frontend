// Rangos de fechas (días de Colombia) y exportar a Excel. Lo usan Reportes y Finanzas.
// ---------- Fechas (días de Colombia) ----------
export const bogota = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d)
export const shift = (day, n) => bogota(new Date(new Date(`${day}T12:00:00-05:00`).getTime() + n * 864e5))
export const PRESETS = () => {
  const t = bogota()
  const [y, m] = t.split('-').map(Number)
  const first = `${y}-${String(m).padStart(2, '0')}-01`
  const prevFirst = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`
  return {
    hoy: ['Hoy', t, t], ayer: ['Ayer', shift(t, -1), shift(t, -1)], d7: ['7 días', shift(t, -6), t], d30: ['30 días', shift(t, -29), t],
    mes: ['Este mes', first, t], mesAnt: ['Mes pasado', prevFirst, shift(first, -1)]
  }
}
export const dayLabel = (d, many) => { const x = new Date(`${d}T12:00:00-05:00`); return many ? String(x.getUTCDate()) : x.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', timeZone: 'America/Bogota' }) }

// ---------- Exportar a Excel (CSV con ; y BOM para que Excel en español lo abra bien) ----------
export const toCsv = (cols, rows) => {
  const cell = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return '﻿' + [cols.map((c) => cell(c[0])).join(';'), ...rows.map((r) => cols.map((c) => cell(typeof c[1] === 'function' ? c[1](r) : r[c[1]])).join(';'))].join('\r\n')
}
export const download = (name, cols, rows) => {
  const url = URL.createObjectURL(new Blob([toCsv(cols, rows)], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = `${name}.csv`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
