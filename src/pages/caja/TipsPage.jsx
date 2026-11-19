import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MdVolunteerActivism, MdPayments, MdHistory, MdPointOfSale, MdAccountBalance, MdPhoneIphone } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Badge, Card, Empty, Field, Kpi, PageHead, Spinner, useToast } from '../../components/ui'
import { MoneyInput } from '../../components/forms'
import { formatDateTime, formatMoney } from '../../utils/format'
import { positionLabel } from '../../utils/nav'
import { ADMIN } from '../operacion/common'

// Propinas (TD-020): ya no se pagan al cerrar el turno. Se acumulan y se pagan aquí cuando se quiera
// (al final del día, de la semana o del mes), a uno o varios empleados.
const SOURCE_ICON = { caja: MdPointOfSale, fondo: MdAccountBalance, transferencia: MdPhoneIphone }

// Reparte un valor entre varios empleados en partes iguales, con un % adicional opcional para uno.
export const splitEqual = (total, ids, bonusId = null, bonusPct = 0) => {
  if (!ids.length || !(total > 0)) return {}
  const w = ids.map((id) => (bonusId && id === bonusId ? 1 + bonusPct / 100 : 1))
  const sumW = w.reduce((a, x) => a + x, 0)
  const parts = ids.map((_, i) => Math.floor((total * w[i]) / sumW))
  const rest = Math.round(total) - parts.reduce((a, x) => a + x, 0)
  const iTop = bonusId ? Math.max(0, ids.indexOf(bonusId)) : 0
  parts[iTop] += rest
  return Object.fromEntries(ids.map((id, i) => [id, parts[i]]))
}

const PayForm = ({ data, admin, onPaid }) => {
  const people = data.people
  // Según lo que le falta a cada uno (lo de sus mesas o entregas menos lo que ya recibió) o en partes iguales.
  const [mode, setMode] = useState('individual')
  const owed = useMemo(() => Object.fromEntries(people.filter((x) => x.pending > 0).map((x) => [x.userId, x.pending])), [people])
  const [pay, setPay] = useState(owed)
  const [pool, setPool] = useState(data.pending || '')
  const [bonusOn, setBonusOn] = useState(false)
  const [bonusPct, setBonusPct] = useState('20')
  const [showAll, setShowAll] = useState(false)
  const [source, setSource] = useState(data.sessions.length ? 'caja' : admin ? 'fondo' : 'transferencia')
  const [sessionId, setSessionId] = useState(data.sessions[0]?.id || '')
  const [method, setMethod] = useState('nequi')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { setPay(owed); setPool(data.pending || '') }, [owed, data.pending])

  const picked = Object.keys(pay).map(Number)
  const shown = people.filter((x) => showAll || x.pending > 0 || x.generated > 0 || picked.includes(x.userId))
  const best = mode === 'grupo' ? people.filter((x) => picked.includes(x.userId) && x.rating).sort((a, b) => b.rating.avg - a.rating.avg || b.rating.count - a.rating.count)[0] || null : null
  const regroup = (ids, opts = {}) => {
    const total = Number(opts.pool ?? pool) || 0
    const on = opts.bonusOn ?? bonusOn
    const top = on && ids.length > 1 ? people.filter((x) => ids.includes(x.userId) && x.rating).sort((a, b) => b.rating.avg - a.rating.avg || b.rating.count - a.rating.count)[0] : null
    const pct = Math.max(0, Math.min(200, Number(String(opts.bonusPct ?? bonusPct).replace(',', '.')) || 0))
    setPay(ids.length ? (total > 0 ? splitEqual(total, ids, top?.userId, pct) : Object.fromEntries(ids.map((id) => [id, '']))) : {})
  }
  const toIndividual = () => { setMode('individual'); setBonusOn(false); setPay(owed) }
  const toGroup = () => {
    setMode('grupo')
    const ids = picked.length > 1 ? picked : shown.filter((x) => x.generated > 0 || x.pending > 0).map((x) => x.userId)
    regroup(ids.length ? ids : shown.map((x) => x.userId))
  }
  const toggle = (id) => {
    const ids = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]
    if (mode === 'grupo') return regroup(ids)
    setPay((t) => { const n = { ...t }; if (id in n) delete n[id]; else n[id] = owed[id] || ''; return n })
  }

  const total = Object.values(pay).reduce((a, v) => a + (Number(v) || 0), 0)
  const sess = data.sessions.find((s) => s.id === Number(sessionId))
  const short = source === 'caja' ? (sess ? total > sess.cash : true) : source === 'fondo' ? total > (data.fund || 0) : false

  const submit = async (e) => {
    e.preventDefault(); setError('')
    if (!total) return setError('Escribe cuánto se le paga a cada empleado.')
    if (source === 'caja' && !sess) return setError('No hay una caja abierta en la sucursal. Elige otra forma de pago.')
    setSaving(true)
    try {
      const { data: r } = await api.post('/propinas/pagos', {
        siteId: data.siteId, source, sessionId: source === 'caja' ? Number(sessionId) : undefined, method: source === 'transferencia' ? method : undefined, note,
        payments: Object.entries(pay).filter(([, v]) => Number(v) > 0).map(([userId, amount]) => ({ userId: Number(userId), amount: Number(amount) }))
      })
      setNote(''); onPaid(r)
    } catch (err) { setError(errorMessage(err)) }
    setSaving(false)
  }

  return (
    <form className="tips-pay" onSubmit={submit} noValidate>
      <div className="seg seg-wrap">
        <button type="button" className={`btn btn-sm${mode === 'individual' ? ' on' : ''}`} onClick={toIndividual}>Individual · lo que le falta a cada uno</button>
        <button type="button" className={`btn btn-sm${mode === 'grupo' ? ' on' : ''}`} onClick={toGroup}>En grupo · partes iguales</button>
        {picked.length > 0 && <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPay({})}>Ninguno</button>}
      </div>
      {mode === 'grupo' && (
        <div className="tip-bonus">
          <Field label="Valor a repartir" htmlFor="tp-pool" hint={`Por pagar: ${formatMoney(data.pending)}`}><MoneyInput id="tp-pool" value={pool} onChange={(v) => { setPool(v); regroup(picked, { pool: v }) }} /></Field>
          <label className="check"><input type="checkbox" checked={bonusOn} disabled={!best && !bonusOn} onChange={(e) => { setBonusOn(e.target.checked); regroup(picked, { bonusOn: e.target.checked }) }} />
            <span><strong>Dar más al mejor calificado</strong><small className="block muted">{best ? `${best.name} · ${best.rating.avg} ★ (${best.rating.count} calificaciones en 30 días)` : 'Aún no hay calificaciones del personal elegido.'}</small></span>
          </label>
          {bonusOn && best && <div className="input-prefix bonus-pct"><span>+</span><input inputMode="decimal" value={bonusPct} onChange={(e) => { setBonusPct(e.target.value); regroup(picked, { bonusPct: e.target.value }) }} aria-label="Porcentaje adicional" /><i aria-hidden="true">%</i></div>}
        </div>
      )}
      <ul className="tip-list tips-people">
        {shown.map((x) => (
          <li key={x.userId} className={x.userId in pay ? 'on' : ''}>
            <label className="check"><input type="checkbox" checked={x.userId in pay} onChange={() => toggle(x.userId)} />
              <span><strong>{x.name}</strong>{best?.userId === x.userId && bonusOn && <> <Badge tone="brand">+{bonusPct} %</Badge></>}
                <small className="block muted">{[x.positions.length ? x.positions.map((p) => positionLabel(p)).join(', ') : null, `generó ${formatMoney(x.generated)}`, `recibió ${formatMoney(x.received)}`, x.rating ? `${x.rating.avg} ★` : null].filter(Boolean).join(' · ')}</small>
                {x.pending > 0 && <small className="block text-warn">Le faltan {formatMoney(x.pending)}</small>}
              </span>
            </label>
            {x.userId in pay && <MoneyInput id={`tp-${x.userId}`} value={pay[x.userId]} onChange={(v) => setPay((t) => ({ ...t, [x.userId]: v }))} aria-label={`Propina para ${x.name}`} />}
          </li>
        ))}
        {!shown.length && <li className="muted"><small>Nadie tiene propinas por cobrar.</small></li>}
      </ul>
      {people.length > shown.length && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAll(true)}>Ver todo el personal ({people.length})</button>}

      <div className="form-grid">
        <div className="span-2">
          <span className="label-sm">¿De dónde sale el dinero?</span>
          <div className="seg seg-wrap" style={{ marginTop: 6 }}>
            <button type="button" className={`btn btn-sm${source === 'caja' ? ' on' : ''}`} onClick={() => setSource('caja')} disabled={!data.sessions.length}><MdPointOfSale /> Caja abierta</button>
            {admin && <button type="button" className={`btn btn-sm${source === 'fondo' ? ' on' : ''}`} onClick={() => setSource('fondo')}><MdAccountBalance /> Fondo de la sucursal</button>}
            <button type="button" className={`btn btn-sm${source === 'transferencia' ? ' on' : ''}`} onClick={() => setSource('transferencia')}><MdPhoneIphone /> Transferencia</button>
          </div>
        </div>
        {source === 'caja' && (
          <Field label="Caja" htmlFor="tp-s" hint={sess ? `Efectivo en la caja: ${formatMoney(sess.cash)}` : null}>
            <select id="tp-s" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
              {data.sessions.map((s) => <option key={s.id} value={s.id}>{s.register} · {s.number}</option>)}
            </select>
          </Field>
        )}
        {source === 'fondo' && <div className="muted" style={{ alignSelf: 'end' }}><small>Saldo del fondo: <strong>{formatMoney(data.fund || 0)}</strong>. Aquí quedó el efectivo de los cierres.</small></div>}
        {source === 'transferencia' && (
          <Field label="Medio" htmlFor="tp-m" hint="No sale efectivo de la caja ni del fondo.">
            <select id="tp-m" value={method} onChange={(e) => setMethod(e.target.value)}>{Object.entries(data.transferMethods).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </Field>
        )}
        <Field label="Nota" htmlFor="tp-n"><input id="tp-n" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Ej. propinas de la semana 10 al 16 de noviembre" /></Field>
      </div>
      {!data.sessions.length && source !== 'caja' && <small className="muted">No hay una caja abierta en la sucursal; para pagar en efectivo de la caja, ábrela primero en <Link to="/caja">Caja</Link>.</small>}
      {short && total > 0 && <div className="alert warn">{source === 'caja' ? 'La caja no tiene ese efectivo.' : 'El fondo no tiene ese saldo.'}</div>}
      {total > data.pending && data.pending >= 0 && total > 0 && <small className="text-warn">Pagas {formatMoney(total - data.pending)} más de lo que hay por pagar.</small>}
      {error && <div className="alert bad">{error}</div>}
      <div className="row-between tips-total">
        <span className="muted">Total a pagar · {picked.filter((id) => Number(pay[id]) > 0).length} empleado{picked.filter((id) => Number(pay[id]) > 0).length === 1 ? '' : 's'}</span>
        <button type="submit" className="btn btn-primary" disabled={saving || !total}>{saving ? <Spinner /> : <MdPayments />} Pagar {formatMoney(total)}</button>
      </div>
    </form>
  )
}

const TipsPage = () => {
  const { user } = useAuth()
  const admin = ADMIN.includes(user.role)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [toast, toastNode] = useToast()
  const load = useCallback(() => api.get('/propinas').then(({ data: d }) => { setData(d); setError('') }).catch((e) => setError(errorMessage(e))), [])
  useEffect(() => { load() }, [load])
  const paid = (r) => { toast(`Pago ${r.number}: ${formatMoney(r.total)} en propinas`); load() }
  return (
    <div className="stack">
      <PageHead title="Propinas" subtitle="Lo que dejan los clientes queda acumulado por empleado. Se paga cuando se quiera: al final del día, de la semana o del mes." />
      {error && <div className="alert bad">{error}</div>}
      {!data ? (!error && <div className="splash" style={{ minHeight: 160 }}><Spinner /></div>) : <>
        <div className="kpis">
          <Kpi label="Por pagar" value={formatMoney(data.pending)} icon={MdVolunteerActivism} tone={data.pending > 0 ? 'brand' : ''} note={data.unassigned > 0 ? `${formatMoney(data.unassigned)} de pedidos sin mesero` : null} />
          <Kpi label="Dejaron los clientes" value={formatMoney(data.generated)} note="Desde el inicio" />
          <Kpi label="Ya pagadas" value={formatMoney(data.paid)} />
        </div>
        <div className="tips-grid">
          <Card title="Pagar propinas" icon={<MdPayments />}>
            <PayForm data={data} admin={admin} onPaid={paid} />
          </Card>
          <Card title="Pagos de propinas" icon={<MdHistory />} flush>
            {!data.payouts.length ? <Empty icon={<MdHistory />}>Aún no se han pagado propinas.</Empty> : (
              <div className="table-wrap"><table className="table">
                <thead><tr><th>Fecha</th><th>Empleado</th><th className="hide-sm">Origen</th><th className="num">Valor</th></tr></thead>
                <tbody>{data.payouts.map((t) => {
                  const Icon = SOURCE_ICON[t.source]
                  return (
                    <tr key={t.id}>
                      <td><small>{formatDateTime(t.createdAt)}</small>{t.number && <small className="block muted">{t.number}</small>}</td>
                      <td>{t.name}{t.note && <small className="block muted">{t.note}</small>}</td>
                      <td className="hide-sm"><span className="row" style={{ gap: 4 }}>{Icon && <Icon aria-hidden="true" />}{t.sourceLabel}{t.source === 'transferencia' ? ` · ${data.transferMethods[t.method] || t.method}` : ''}</span>{(t.session || t.paidBy) && <small className="block muted">{[t.session, t.paidBy].filter(Boolean).join(' · ')}</small>}</td>
                      <td className="num money">{formatMoney(t.amount)}</td>
                    </tr>
                  )
                })}</tbody>
              </table></div>
            )}
          </Card>
        </div>
      </>}
      {toastNode}
    </div>
  )
}

export default TipsPage
