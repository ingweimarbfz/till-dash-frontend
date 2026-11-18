import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MdWarningAmber, MdRemoveShoppingCart, MdClose } from 'react-icons/md'
import api from '../api/client'

// =====================================================================
// Avisos de stock bajo tipo toast (TD-002)
// · Cada minuto se consulta /inventario/alertas (bodegas de la sucursal elegida o la del empleado).
// · Cada producto y bodega se avisa una vez por sesión; si se repone y vuelve a bajar, se avisa de nuevo.
// · Las pantallas que registran movimientos llaman notifyStock() para avisar al instante.
// =====================================================================
const EVENT = 'td:stock-alerts'
const KEY = 'td_stock_seen'
const POLL_MS = 60000
const SHOW_MS = 12000
const MAX = 3

export const notifyStock = (alerts) => { if (alerts?.length) window.dispatchEvent(new CustomEvent(EVENT, { detail: alerts })) }

const keyOf = (a) => `${a.warehouseId}-${a.productId}-${a.out ? 'out' : 'low'}`
const loadSeen = () => { try { return new Set(JSON.parse(sessionStorage.getItem(KEY) || '[]')) } catch { return new Set() } }
const saveSeen = (s) => { try { sessionStorage.setItem(KEY, JSON.stringify([...s])) } catch { /* sin almacenamiento */ } }
const qty = (v) => Number(v || 0).toLocaleString('es-CO', { maximumFractionDigits: 3 })

const StockAlerts = () => {
  const [toasts, setToasts] = useState([])
  const seen = useRef(loadSeen())

  const show = useCallback((alerts, { full = false } = {}) => {
    const fresh = alerts.filter((a) => !seen.current.has(keyOf(a)))
    // Con la lista completa, lo que ya no está bajo se olvida para volver a avisar si baja otra vez.
    if (full) seen.current = new Set([...seen.current].filter((k) => alerts.some((a) => keyOf(a) === k)))
    fresh.forEach((a) => seen.current.add(keyOf(a)))
    saveSeen(seen.current)
    if (!fresh.length) return
    const now = Date.now()
    const items = fresh.slice(0, MAX).map((a, i) => ({ id: `${keyOf(a)}-${now}-${i}`, a }))
    if (fresh.length > MAX) items.push({ id: `more-${now}`, more: fresh.length - MAX })
    setToasts((t) => [...items, ...t].slice(0, MAX + 1))
    items.forEach((x) => setTimeout(() => setToasts((t) => t.filter((y) => y.id !== x.id)), SHOW_MS))
  }, [])

  useEffect(() => {
    let alive = true
    const poll = () => api.get('/inventario/alertas').then(({ data }) => { if (alive) show(data, { full: true }) }).catch(() => {})
    poll()
    const t = setInterval(poll, POLL_MS)
    const onEvent = (e) => show(e.detail || [])
    window.addEventListener(EVENT, onEvent)
    return () => { alive = false; clearInterval(t); window.removeEventListener(EVENT, onEvent) }
  }, [show])

  if (!toasts.length) return null
  const close = (id) => setToasts((t) => t.filter((y) => y.id !== id))
  return (
    <div className="stock-toasts" role="status" aria-live="polite">
      {toasts.map(({ id, a, more }) => more ? (
        <div key={id} className="stock-toast more"><span>Y {more} producto{more === 1 ? '' : 's'} más con stock bajo.</span><Link to="/inventario?tab=resumen" onClick={() => close(id)}>Ver todos</Link></div>
      ) : (
        <div key={id} className={`stock-toast ${a.out ? 'out' : 'low'}`}>
          <span className="stock-toast-icon">{a.out ? <MdRemoveShoppingCart /> : <MdWarningAmber />}</span>
          <div>
            <strong>{a.out ? 'Agotado' : 'Stock bajo'}: {a.name}</strong>
            <small>{a.out ? 'No queda' : `Quedan ${qty(a.stock)} ${a.unit}`} en {a.warehouse.name}{a.warehouse.site ? ` · ${a.warehouse.site}` : ''}{!a.out ? ` (mínimo ${qty(a.minStock)})` : ''}</small>
            <Link to={`/productos/${a.productId}`} onClick={() => close(id)}>Ver producto</Link>
          </div>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Cerrar aviso" onClick={() => close(id)}><MdClose /></button>
        </div>
      ))}
    </div>
  )
}

export default StockAlerts
