import React, { useEffect, useRef, useState } from 'react'
import { MdSearch, MdClose, MdStorefront, MdPlace } from 'react-icons/md'
import api from '../../api/client'
import { Badge } from '../../components/ui'
import { formatMoney } from '../../utils/format'

// Buscador de clientes del directorio para abrir un pedido. Busca por nombre, celular, NIT o dirección.
// value: cliente elegido (o null). onPick(cliente | null).
const CustomerPicker = ({ value, onPick, autoFocus = false }) => {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const box = useRef(null)
  useEffect(() => {
    if (value || q.trim().length < 2) { setRows([]); return undefined }
    const t = setTimeout(() => {
      api.get('/clientes', { params: { q: q.trim(), ligero: 1, limite: 8 } }).then(({ data }) => { setRows(data); setActive(0); setOpen(true) }).catch(() => setRows([]))
    }, 220)
    return () => clearTimeout(t)
  }, [q, value])
  useEffect(() => {
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  const pick = (c) => { onPick(c); setQ(''); setOpen(false) }
  const onKey = (e) => {
    if (!open || !rows.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(rows.length - 1, a + 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
    if (e.key === 'Enter') { e.preventDefault(); pick(rows[active]) }
    if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) }
  }
  if (value) {
    return (
      <div className="cust-picked">
        <MdStorefront aria-hidden="true" />
        <div className="grow">
          <strong>{value.name}</strong> {value.kindLabel && value.kind !== 'persona' && <Badge>{value.kindLabel}</Badge>} {value.zone && <Badge tone="brand"><MdPlace /> {value.zone}</Badge>}
          <small className="block muted">{[value.phone, [value.address, value.neighborhood].filter(Boolean).join(', '), value.deliveryFee === 0 ? 'Domicilio sin costo' : value.deliveryFee ? `Domicilio ${formatMoney(value.deliveryFee)}` : null, value.creditDays ? `Crédito a ${value.creditDays} días` : null].filter(Boolean).join(' · ')}</small>
        </div>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => onPick(null)} aria-label="Quitar cliente"><MdClose /></button>
      </div>
    )
  }
  return (
    <div className="cust-search" ref={box}>
      <div className="input-icon"><MdSearch />
        <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => rows.length && setOpen(true)} onKeyDown={onKey} autoFocus={autoFocus}
          placeholder="Buscar cliente por nombre, celular o dirección" aria-label="Buscar cliente" role="combobox" aria-expanded={open} aria-controls="cust-list" />
      </div>
      {open && (
        <ul className="cust-list" id="cust-list" role="listbox">
          {!rows.length ? <li className="muted"><small>Sin coincidencias. Escribe los datos abajo y márcalo para guardarlo.</small></li> : rows.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === active}>
              <button type="button" className={i === active ? 'on' : ''} onMouseEnter={() => setActive(i)} onClick={() => pick(c)}>
                <strong>{c.name}</strong>{c.zone && <small> · {c.zone}</small>}
                <small className="block muted">{[c.phone, [c.address, c.neighborhood].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || c.kindLabel}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default CustomerPicker
