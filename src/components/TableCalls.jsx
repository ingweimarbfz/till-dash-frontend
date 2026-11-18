import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdRoomService, MdReceipt, MdCheck, MdClose, MdShoppingBag, MdNotificationsActive } from 'react-icons/md'
import api, { errorMessage } from '../api/client'
import { beep, since } from '../pages/operacion/common'
import { formatMoney } from '../utils/format'

// =====================================================================
// Llamados de mesa: el cliente toca "Llamar al mesero", "Pedir la cuenta" o hace un pedido en la carta QR
// y al personal de la sucursal le llega un aviso con sonido y una notificación del sistema (aunque la
// pestaña esté en segundo plano). Se consulta cada 10 segundos.
// · Pedido por confirmar: Aceptar lo pasa a la cuenta de la mesa y a las comandas; Rechazar lo descarta.
// · Pedido directo: ya entró a la cuenta; "Visto" quita el aviso.
// =====================================================================
const POLL_MS = 10000
const TITLES = { mesero: 'llama al mesero', cuenta: 'pide la cuenta', pedido: 'hizo un pedido' }
// Firma del llamado: cambia si un pedido directo suma productos al mismo aviso.
const sig = (c) => `${c.id}:${c.items?.length || 0}`
const canNotify = () => typeof window !== 'undefined' && 'Notification' in window

const systemNotice = (c) => {
  if (!canNotify() || Notification.permission !== 'granted') return
  try {
    const body = c.kind === 'pedido' ? (c.items || []).map((i) => `${i.quantity} × ${i.name}`).join(', ') : c.note || ''
    const n = new Notification(`${c.table} ${TITLES[c.kind]}`, { body, tag: `td-call-${c.id}`, renotify: true, requireInteraction: c.kind === 'pedido' })
    n.onclick = () => { window.focus(); n.close() }
  } catch { /* algunos navegadores solo permiten notificaciones desde un service worker */ }
}

const TableCalls = () => {
  const navigate = useNavigate()
  const [calls, setCalls] = useState([])
  const [hidden, setHidden] = useState(() => new Set())
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const [perm, setPerm] = useState(() => (canNotify() ? Notification.permission : 'unsupported'))
  const known = useRef(null)
  const poll = useCallback(() => api.get('/llamados').then(({ data }) => {
    const fresh = known.current ? data.filter((c) => !known.current.has(sig(c))) : []
    if (fresh.length) {
      beep(fresh.some((c) => c.kind === 'pedido') ? 3 : 2)
      fresh.forEach(systemNotice)
      setHidden((s) => { const x = new Set(s); fresh.forEach((c) => x.delete(c.id)); return x })
      window.dispatchEvent(new CustomEvent('td:calls'))
    }
    known.current = new Set(data.map(sig))
    setCalls(data)
  }).catch(() => {}), [])
  useEffect(() => { poll(); const t = setInterval(poll, POLL_MS); return () => clearInterval(t) }, [poll])
  const askPermission = () => { if (canNotify()) Notification.requestPermission().then(setPerm).catch(() => {}) }
  const attend = async (c, reason) => {
    setCalls((list) => list.filter((x) => x.id !== c.id))
    try { await api.post(`/llamados/${c.id}/atender`, reason ? { reason } : {}); window.dispatchEvent(new CustomEvent('td:calls')) } catch { /* se reintenta en el próximo ciclo */ }
  }
  const accept = async (c) => {
    setBusy(c.id); setError('')
    try {
      const { data } = await api.post(`/llamados/${c.id}/aceptar`)
      setCalls((list) => list.filter((x) => x.id !== c.id))
      window.dispatchEvent(new CustomEvent('td:calls'))
      navigate(`/pedidos/${data.orderId}`)
    } catch (e) { setError(errorMessage(e)) }
    setBusy(null)
  }
  const shown = calls.filter((c) => !hidden.has(c.id))
  const askNotice = perm === 'default' && calls.length > 0
  if (!shown.length && !askNotice) return null
  return (
    <div className="call-toasts" role="alert" aria-live="assertive">
      {askNotice && (
        <div className="call-toast more">
          <MdNotificationsActive /> <span className="grow">Activa las notificaciones para enterarte aunque estés en otra pestaña.</span>
          <button type="button" className="btn btn-sm btn-primary" onClick={askPermission}>Activar</button>
        </div>
      )}
      {error && <div className="call-toast more"><span className="grow">{error}</span><button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Cerrar" onClick={() => setError('')}><MdClose /></button></div>}
      {shown.slice(0, 3).map((c) => (
        <div key={c.id} className={`call-toast ${c.kind}`}>
          <span className="call-icon">{c.kind === 'cuenta' ? <MdReceipt /> : c.kind === 'pedido' ? <MdShoppingBag /> : <MdRoomService />}</span>
          <div className="grow">
            <strong>{c.table} {TITLES[c.kind]}{c.kind === 'pedido' && c.result === 'directo' ? ' (ya va a cocina)' : ''}</strong>
            <small>{since(c.createdAt)}{c.customerName ? ` · ${c.customerName}` : ''}{c.note ? ` · ${c.note}` : ''}</small>
            {c.kind === 'pedido' && (
              <ul className="call-items">
                {(c.items || []).slice(0, 6).map((i, n) => <li key={n}><span>{i.quantity} × {i.name}</span><span>{formatMoney(i.quantity * i.price)}</span></li>)}
                {(c.items || []).length > 6 && <li><span>Y {(c.items || []).length - 6} más</span></li>}
                {c.total !== null && <li><b>Total</b><b>{formatMoney(c.total)}</b></li>}
              </ul>
            )}
            {c.kind === 'pedido' && !c.orderId && (
              <div className="row" style={{ gap: 6, marginTop: 6 }}>
                <button type="button" className="btn btn-sm btn-primary" onClick={() => accept(c)} disabled={busy === c.id}><MdCheck /> Aceptar y enviar</button>
                <button type="button" className="btn btn-sm" onClick={() => attend(c, 'Rechazado por el mesero')} disabled={busy === c.id}>Rechazar</button>
              </div>
            )}
          </div>
          {c.kind === 'pedido' && c.orderId
            ? <button type="button" className="btn btn-sm btn-primary" onClick={() => { attend(c); navigate(`/pedidos/${c.orderId}`) }}><MdCheck /> Visto</button>
            : c.kind !== 'pedido' && <>
              <button type="button" className="btn btn-sm" onClick={() => navigate(`/mesas?mesa=${c.tableId}`)}>Ver</button>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => attend(c)} title="Marcar como atendido"><MdCheck /> Atendido</button>
            </>}
          <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Ocultar aviso" onClick={() => setHidden((s) => new Set([...s, c.id]))}><MdClose /></button>
        </div>
      ))}
      {shown.length > 3 && <div className="call-toast more">Y {shown.length - 3} llamados más.</div>}
    </div>
  )
}

export default TableCalls
