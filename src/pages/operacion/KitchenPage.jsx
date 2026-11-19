import React, { useCallback, useEffect, useRef, useState } from 'react'
import { MdSoupKitchen, MdPlayArrow, MdCheck, MdDoneAll, MdVolumeUp, MdVolumeOff } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { Badge, Card, Empty, PageHead, Spinner, useToast } from '../../components/ui'
import { AREA_LABEL, beep, ITEM_STATUS, ITEM_TONE, minutes, Qty } from './common'
import { refreshMenuBadges } from '../../components/MenuBadges'

const POLL_MS = 10000

// Comandas de cocina, bar y barista: cada pedido es una tarjeta; se marca preparando y listo.
// Suena cuando llega una comanda nueva. Más de 15 min en espera se pinta en rojo.
const KitchenPage = () => {
  const [data, setData] = useState(null)
  const [area, setArea] = useState('')
  const [error, setError] = useState('')
  const [sound, setSound] = useState(() => { try { return localStorage.getItem('td_kitchen_sound') !== 'off' } catch { return true } })
  const [, tick] = useState(0)
  const [toast, toastNode] = useToast()
  const known = useRef(null)
  const load = useCallback(() => api.get('/comandas', { params: { area: area || undefined } }).then(({ data: d }) => {
    const ids = new Set(d.tickets.flatMap((t) => t.items.filter((i) => i.status === 'pendiente').map((i) => i.id)))
    if (known.current && [...ids].some((x) => !known.current.has(x)) && sound) beep(3)
    known.current = ids
    setData(d); setError('')
  }).catch((e) => setError(errorMessage(e))), [area, sound])
  useEffect(() => { load(); const t = setInterval(load, POLL_MS); const m = setInterval(() => tick((x) => x + 1), 30000); return () => { clearInterval(t); clearInterval(m) } }, [load])
  const toggleSound = () => setSound((s) => { try { localStorage.setItem('td_kitchen_sound', s ? 'off' : 'on') } catch { /* nada */ } if (!s) beep(1); return !s })
  const mark = async (ids, status) => {
    try { await api.put(`/comandas/${ids[0]}`, { ids, status }); load(); refreshMenuBadges() } catch (e) { toast(errorMessage(e), 'bad') }
  }
  if (error && !data) return <Card><Empty icon={<MdSoupKitchen />}>{error}</Empty></Card>
  if (!data) return <div className="splash"><Spinner /></div>
  const pending = data.tickets.filter((t) => t.items.some((i) => i.status !== 'listo'))
  const ready = data.tickets.filter((t) => t.items.every((i) => i.status === 'listo'))
  return (
    <div className="stack">
      <PageHead title="Comandas" subtitle={`${data.areas.map((a) => AREA_LABEL[a]).join(', ')} · se actualiza solo cada 10 segundos`}>
        <button type="button" className="btn btn-icon" onClick={toggleSound} aria-label={sound ? 'Silenciar' : 'Activar sonido'} title={sound ? 'Sonido activado' : 'Sonido apagado'}>{sound ? <MdVolumeUp /> : <MdVolumeOff />}</button>
      </PageHead>
      <div className="chip-list">
        {['', 'cocina', 'bar', 'barista'].map((a) => <button key={a || 'mine'} type="button" className={`pchip${area === a ? ' on' : ''}`} onClick={() => setArea(a)}>{a ? AREA_LABEL[a] : 'Mis áreas'}</button>)}
      </div>
      {!pending.length && !ready.length ? <Card><Empty icon={<MdSoupKitchen />}>No hay comandas pendientes. 🎉</Empty></Card> : (
        <div className="kds">
          {[...pending, ...ready].map((t) => {
            const wait = minutes(t.since)
            const open = t.items.filter((i) => i.status !== 'listo')
            return (
              <div key={`${t.orderId}-${t.area}`} className={`kds-card${wait >= 15 && open.length ? ' late' : ''}${!open.length ? ' done' : ''}`}>
                <header>
                  <div><strong>{t.table || t.type}</strong> <small>{t.number}</small></div>
                  <span className="kds-time">{wait} min</span>
                </header>
                <small className="muted">{[t.alias && `“${t.alias}”`, AREA_LABEL[t.area], t.waiter, t.customer].filter(Boolean).join(' · ')}</small>
                <ul>{t.items.map((i) => (
                  <li key={i.id} className={i.status}>
                    <button type="button" className="kds-item" onClick={() => mark([i.id], i.status === 'pendiente' ? 'preparando' : i.status === 'preparando' ? 'listo' : 'preparando')} title="Toca para avanzar el estado">
                      <b><Qty value={i.quantity} />×</b> <span className="kds-name">{i.name}{i.courtesy && ' 🎁'}{i.note && <em>“{i.note}”</em>}</span>
                      <Badge tone={ITEM_TONE[i.status]}>{ITEM_STATUS[i.status]}</Badge>
                    </button>
                  </li>
                ))}</ul>
                {open.length > 0 && <footer>
                  {open.some((i) => i.status === 'pendiente') && <button type="button" className="btn btn-sm" onClick={() => mark(open.filter((i) => i.status === 'pendiente').map((i) => i.id), 'preparando')}><MdPlayArrow /> Preparar todo</button>}
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => mark(open.map((i) => i.id), 'listo')}><MdCheck /> Todo listo</button>
                </footer>}
                {!open.length && <footer><button type="button" className="btn btn-sm" onClick={() => mark(t.items.map((i) => i.id), 'entregado')}><MdDoneAll /> Entregado</button></footer>}
              </div>
            )
          })}
        </div>
      )}
      {toastNode}
    </div>
  )
}

export default KitchenPage
