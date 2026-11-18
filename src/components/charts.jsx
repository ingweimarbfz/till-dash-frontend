import React from 'react'
import { formatMoney, formatShort } from '../utils/format'

// Barras verticales simples (ventas por día, por hora). Cada barra lleva su valor en el título.
export const Bars = ({ data, value = 'value', label = 'label', format = formatMoney, height = 180, ariaLabel, highlightMax = true }) => {
  const max = Math.max(1, ...data.map((d) => Number(d[value]) || 0))
  const many = data.length > 16
  return (
    <div className="vbars" style={{ height }} role="img" aria-label={ariaLabel}>
      {data.map((d, i) => {
        const v = Number(d[value]) || 0
        return (
          <div key={i} className="vbar" title={`${d.title || d[label]} · ${format(v)}`}>
            {!many && v > 0 && <em>{formatShort(v)}</em>}
            <span style={{ height: `${Math.max(2, (v / max) * 100)}%` }} className={`${v ? '' : 'zero'}${highlightMax && v === max && v > 0 ? ' top' : ''}`} />
            <small>{d[label]}</small>
          </div>
        )
      })}
    </div>
  )
}

// Ranking con barras horizontales (productos, meseros, formas de pago).
export const Ranking = ({ rows, value = 'value', label = 'label', note, format = formatMoney, limit = 10 }) => {
  const max = Math.max(1, ...rows.map((r) => Number(r[value]) || 0))
  return (
    <ul className="ranking">
      {rows.slice(0, limit).map((r, i) => (
        <li key={i}>
          <div className="row-between"><span className="rk-name"><b>{i + 1}</b> {r[label]}</span><strong className="money">{format(Number(r[value]) || 0)}</strong></div>
          <div className="rk-track"><span style={{ width: `${Math.max(1, ((Number(r[value]) || 0) / max) * 100)}%` }} /></div>
          {note && <small className="muted">{note(r)}</small>}
        </li>
      ))}
    </ul>
  )
}

// Barra apilada de participación (formas de pago, tipos de pedido).
const PALETTE = ['var(--brand)', 'var(--ink)', 'var(--accent)', '#2F9E6E', '#5B8DEF', '#9B6BDF', '#94A3B8']
export const Share = ({ rows, value = 'value', label = 'label', format = formatMoney }) => {
  const total = rows.reduce((a, r) => a + (Number(r[value]) || 0), 0) || 1
  return (
    <div className="share">
      <div className="share-bar">{rows.map((r, i) => <span key={i} style={{ width: `${((Number(r[value]) || 0) / total) * 100}%`, background: PALETTE[i % PALETTE.length] }} title={`${r[label]} · ${format(Number(r[value]) || 0)}`} />)}</div>
      <ul className="share-legend">{rows.map((r, i) => (
        <li key={i}><i style={{ background: PALETTE[i % PALETTE.length] }} /> <span>{r[label]}</span> <strong>{format(Number(r[value]) || 0)}</strong> <small className="muted">{Math.round(((Number(r[value]) || 0) / total) * 100)} %</small></li>
      ))}</ul>
    </div>
  )
}
