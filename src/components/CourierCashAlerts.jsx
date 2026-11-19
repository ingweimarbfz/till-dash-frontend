import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdPayments, MdClose, MdPointOfSale } from 'react-icons/md'
import api from '../api/client'
import { beep, since } from '../pages/operacion/common'
import { formatMoney } from '../utils/format'

// =====================================================================
// TD-015 · Dinero recibido del domiciliario: cuando el cliente le paga en efectivo, el domiciliario lo marca
// y al personal de la sucursal (administrador, cajero, mesero…) le llega un aviso con sonido y una
// notificación del sistema para cobrarlo en caja. El aviso sigue hasta que el pedido se cobra.
// Se consulta cada 10 segundos, igual que los llamados de mesa.
// =====================================================================
const POLL_MS = 10000
const canNotify = () => typeof window !== 'undefined' && 'Notification' in window

const systemNotice = (a) => {
  if (!canNotify() || Notification.permission !== 'granted') return
  try {
    const n = new Notification(`${a.courier?.name || 'El domiciliario'} recibió ${formatMoney(a.amount)}`, { body: `${a.number}${a.customerName ? ` · ${a.customerName}` : ''} · cóbralo en caja`, tag: `td-cash-${a.id}`, renotify: true })
    n.onclick = () => { window.focus(); n.close() }
  } catch { /* algunos navegadores solo permiten notificaciones desde un service worker */ }
}

const CourierCashAlerts = () => {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [hidden, setHidden] = useState(() => new Set())
  const known = useRef(null)
  const poll = useCallback(() => api.get('/domicilios/avisos').then(({ data }) => {
    const fresh = known.current ? data.filter((a) => !known.current.has(a.id)) : []
    if (fresh.length) {
      beep(2)
      fresh.forEach(systemNotice)
      setHidden((s) => { const x = new Set(s); fresh.forEach((a) => x.delete(a.id)); return x })
    }
    known.current = new Set(data.map((a) => a.id))
    setRows(data)
  }).catch(() => {}), [])
  useEffect(() => { poll(); const t = setInterval(poll, POLL_MS); return () => clearInterval(t) }, [poll])
  const shown = rows.filter((a) => !hidden.has(a.id))
  if (!shown.length) return null
  return (
    <div className="call-toasts" role="alert" aria-live="assertive">
      {shown.slice(0, 3).map((a) => (
        <div key={a.id} className="call-toast cash">
          <span className="call-icon"><MdPayments /></span>
          <div className="grow">
            <strong>{a.courier?.name || 'El domiciliario'} recibió {formatMoney(a.amount)}</strong>
            <small>{a.number}{a.customerName ? ` · ${a.customerName}` : ''} · {since(a.receivedAt)} · cóbralo en caja</small>
          </div>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => { setHidden((s) => new Set([...s, a.id])); navigate(`/pedidos/${a.id}`) }}><MdPointOfSale /> Cobrar</button>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Ocultar aviso" onClick={() => setHidden((s) => new Set([...s, a.id]))}><MdClose /></button>
        </div>
      ))}
      {shown.length > 3 && <div className="call-toast more">Y {shown.length - 3} domicilios más con dinero recibido.</div>}
    </div>
  )
}

export default CourierCashAlerts
