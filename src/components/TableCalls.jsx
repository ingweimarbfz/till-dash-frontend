import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdRoomService, MdReceipt, MdCheck, MdClose } from 'react-icons/md'
import api from '../api/client'
import { beep, since } from '../pages/operacion/common'

// =====================================================================
// Llamados de mesa (TD-003): el cliente toca "Llamar al mesero" o "Pedir la cuenta" en la carta QR
// y al personal de la sucursal le llega un aviso con sonido. Se consulta cada 15 segundos.
// =====================================================================
const POLL_MS = 15000

const TableCalls = () => {
  const navigate = useNavigate()
  const [calls, setCalls] = useState([])
  const [hidden, setHidden] = useState(() => new Set())
  const known = useRef(null)
  const poll = useCallback(() => api.get('/llamados').then(({ data }) => {
    const ids = new Set(data.map((c) => c.id))
    if (known.current && data.some((c) => !known.current.has(c.id))) { beep(2); window.dispatchEvent(new CustomEvent('td:calls')) }
    known.current = ids
    setCalls(data)
  }).catch(() => {}), [])
  useEffect(() => { poll(); const t = setInterval(poll, POLL_MS); return () => clearInterval(t) }, [poll])
  const attend = async (c) => {
    setCalls((list) => list.filter((x) => x.id !== c.id))
    try { await api.post(`/llamados/${c.id}/atender`); window.dispatchEvent(new CustomEvent('td:calls')) } catch { /* se reintenta en el próximo ciclo */ }
  }
  const shown = calls.filter((c) => !hidden.has(c.id))
  if (!shown.length) return null
  return (
    <div className="call-toasts" role="alert" aria-live="assertive">
      {shown.slice(0, 3).map((c) => (
        <div key={c.id} className={`call-toast ${c.kind}`}>
          <span className="call-icon">{c.kind === 'cuenta' ? <MdReceipt /> : <MdRoomService />}</span>
          <div className="grow">
            <strong>{c.table} {c.kind === 'cuenta' ? 'pide la cuenta' : 'llama al mesero'}</strong>
            <small>{since(c.createdAt)}{c.note ? ` · ${c.note}` : ''}</small>
          </div>
          <button type="button" className="btn btn-sm" onClick={() => navigate(`/mesas?mesa=${c.tableId}`)}>Ver</button>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => attend(c)} title="Marcar como atendido"><MdCheck /> Atendido</button>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Ocultar aviso" onClick={() => setHidden((s) => new Set([...s, c.id]))}><MdClose /></button>
        </div>
      ))}
      {shown.length > 3 && <div className="call-toast more">Y {shown.length - 3} llamados más.</div>}
    </div>
  )
}

export default TableCalls
