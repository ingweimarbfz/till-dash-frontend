import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MdVolunteerActivism, MdPayments, MdHistory, MdPointOfSale, MdAccountBalance, MdPhoneIphone, MdSchedule, MdBadge } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Badge, Card, Empty, Field, Kpi, PageHead, Spinner, useToast } from '../../components/ui'
import { MoneyInput, Tabs } from '../../components/forms'
import { formatDate, formatDateTime, formatMoney } from '../../utils/format'
import { positionLabel } from '../../utils/nav'
import { ADMIN } from '../operacion/common'

// Pagos al personal (TD-020):
// · Propinas: ya no se pagan al cerrar el turno. Se acumulan y se pagan aquí cuando se quiera.
// · Turnos y domicilios: lo que en el cierre quedó pendiente (el empleado no lo recibió ese día).
// · Nómina: a quien se le paga por quincena o por mes (configurado en Usuarios).
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

// ¿De dónde sale el dinero? Caja abierta, fondo de la sucursal (administrador) o transferencia.
const useSource = (data, admin) => {
  const [source, setSource] = useState(data.sessions.length ? 'caja' : admin ? 'fondo' : 'transferencia')
  const [sessionId, setSessionId] = useState(data.sessions[0]?.id || '')
  const [method, setMethod] = useState('nequi')
  const sess = data.sessions.find((x) => x.id === Number(sessionId))
  const shortOf = (total) => (source === 'caja' ? (sess ? total > sess.cash : true) : source === 'fondo' ? total > (data.fund || 0) : false)
  const body = { siteId: data.siteId, source, sessionId: source === 'caja' ? Number(sessionId) : undefined, method: source === 'transferencia' ? method : undefined }
  return { source, setSource, sessionId, setSessionId, method, setMethod, sess, shortOf, body }
}
const SourcePicker = ({ data, admin, src, note, setNote, total }) => (
  <>
    <div className="form-grid">
      <div className="span-2">
        <span className="label-sm">¿De dónde sale el dinero?</span>
        <div className="seg seg-wrap" style={{ marginTop: 6 }}>
          <button type="button" className={`btn btn-sm${src.source === 'caja' ? ' on' : ''}`} onClick={() => src.setSource('caja')} disabled={!data.sessions.length}><MdPointOfSale /> Caja abierta</button>
          {admin && <button type="button" className={`btn btn-sm${src.source === 'fondo' ? ' on' : ''}`} onClick={() => src.setSource('fondo')}><MdAccountBalance /> Fondo de la sucursal</button>}
          <button type="button" className={`btn btn-sm${src.source === 'transferencia' ? ' on' : ''}`} onClick={() => src.setSource('transferencia')}><MdPhoneIphone /> Transferencia</button>
        </div>
      </div>
      {src.source === 'caja' && (
        <Field label="Caja" htmlFor="pp-s" hint={src.sess ? `Efectivo en la caja: ${formatMoney(src.sess.cash)}` : null}>
          <select id="pp-s" value={src.sessionId} onChange={(e) => src.setSessionId(e.target.value)}>
            {data.sessions.map((x) => <option key={x.id} value={x.id}>{x.register} · {x.number}</option>)}
          </select>
        </Field>
      )}
      {src.source === 'fondo' && <div className="muted" style={{ alignSelf: 'end' }}><small>Saldo del fondo: <strong>{formatMoney(data.fund || 0)}</strong>. Aquí quedó el efectivo de los cierres.</small></div>}
      {src.source === 'transferencia' && (
        <Field label="Medio" htmlFor="pp-m" hint="No sale efectivo de la caja ni del fondo.">
          <select id="pp-m" value={src.method} onChange={(e) => src.setMethod(e.target.value)}>{Object.entries(data.transferMethods).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </Field>
      )}
      <Field label="Nota" htmlFor="pp-n"><input id="pp-n" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Ej. semana del 10 al 16 de noviembre" /></Field>
    </div>
    {!data.sessions.length && src.source !== 'caja' && <small className="muted">No hay una caja abierta en la sucursal; para pagar con el efectivo de la caja, ábrela primero en <Link to="/caja">Caja</Link>.</small>}
    {src.shortOf(total) && total > 0 && <div className="alert warn">{src.source === 'caja' ? 'La caja no tiene ese efectivo.' : 'El fondo no tiene ese saldo.'}</div>}
  </>
)

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
  const src = useSource(data, admin)
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

  const submit = async (e) => {
    e.preventDefault(); setError('')
    if (!total) return setError('Escribe cuánto se le paga a cada empleado.')
    if (src.source === 'caja' && !src.sess) return setError('No hay una caja abierta en la sucursal. Elige otra forma de pago.')
    setSaving(true)
    try {
      const { data: r } = await api.post('/propinas/pagos', {
        ...src.body, note,
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

      <SourcePicker data={data} admin={admin} src={src} note={note} setNote={setNote} total={total} />
      {total > data.pending && data.pending >= 0 && total > 0 && <small className="text-warn">Pagas {formatMoney(total - data.pending)} más de lo que hay por pagar.</small>}
      {error && <div className="alert bad">{error}</div>}
      <div className="row-between tips-total">
        <span className="muted">Total a pagar · {picked.filter((id) => Number(pay[id]) > 0).length} empleado{picked.filter((id) => Number(pay[id]) > 0).length === 1 ? '' : 's'}</span>
        <button type="submit" className="btn btn-primary" disabled={saving || !total}>{saving ? <Spinner /> : <MdPayments />} Pagar {formatMoney(total)}</button>
      </div>
    </form>
  )
}

const SourceCell = ({ source, label, method, methods }) => {
  const Icon = SOURCE_ICON[source]
  return <span className="row" style={{ gap: 4 }}>{Icon && <Icon aria-hidden="true" />}{label}{source === 'transferencia' ? ` · ${methods[method] || method}` : ''}</span>
}

// ---------- Propinas
const TipsTab = ({ admin, toast }) => {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const load = useCallback(() => api.get('/propinas').then(({ data: d }) => { setData(d); setError('') }).catch((e) => setError(errorMessage(e))), [])
  useEffect(() => { load() }, [load])
  const paid = (r) => { toast(`Pago ${r.number}: ${formatMoney(r.total)} en propinas`); load() }
  if (error) return <div className="alert bad">{error}</div>
  if (!data) return <div className="splash" style={{ minHeight: 160 }}><Spinner /></div>
  return <>
    <div className="kpis">
      <Kpi label="Propinas por pagar" value={formatMoney(data.pending)} icon={MdVolunteerActivism} tone={data.pending > 0 ? 'brand' : ''} note={data.unassigned > 0 ? `${formatMoney(data.unassigned)} de pedidos sin mesero` : null} />
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
            <tbody>{data.payouts.map((t) => (
              <tr key={t.id}>
                <td><small>{formatDateTime(t.createdAt)}</small>{t.number && <small className="block muted">{t.number}</small>}</td>
                <td>{t.name}{t.note && <small className="block muted">{t.note}</small>}</td>
                <td className="hide-sm"><SourceCell source={t.source} label={t.sourceLabel} method={t.method} methods={data.transferMethods} />{(t.session || t.paidBy) && <small className="block muted">{[t.session, t.paidBy].filter(Boolean).join(' · ')}</small>}</td>
                <td className="num money">{formatMoney(t.amount)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  </>
}

// ---------- Turnos y domicilios pendientes, y nómina
const usePersonal = () => {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const load = useCallback(() => api.get('/personal/pagos').then(({ data: d }) => { setData(d); setError('') }).catch((e) => setError(errorMessage(e))), [])
  useEffect(() => { load() }, [load])
  return { data, error, load }
}
const periodLabel = (from, to) => `${formatDate(from)} al ${formatDate(to)}`

const PendingForm = ({ data, admin, onPaid }) => {
  const [picked, setPicked] = useState(() => new Set(data.pending.map((e) => e.id)))
  const src = useSource(data, admin)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { setPicked(new Set(data.pending.map((e) => e.id))) }, [data.pending])
  const total = data.pending.filter((e) => picked.has(e.id)).reduce((a, e) => a + e.amount, 0)
  const byPerson = useMemo(() => {
    const m = new Map()
    for (const e of data.pending) { if (!m.has(e.userId)) m.set(e.userId, { name: e.name, rows: [] }); m.get(e.userId).rows.push(e) }
    return [...m.entries()]
  }, [data.pending])
  const toggle = (id) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const submit = async (e) => {
    e.preventDefault(); setError('')
    if (!picked.size) return setError('Elige qué se va a pagar.')
    if (src.source === 'caja' && !src.sess) return setError('No hay una caja abierta en la sucursal. Elige otra forma de pago.')
    setSaving(true)
    try { const { data: r } = await api.post('/personal/pagos', { ...src.body, note, earnings: [...picked] }); setNote(''); onPaid(r) } catch (err) { setError(errorMessage(err)) }
    setSaving(false)
  }
  if (!data.pending.length) return <Empty icon={<MdSchedule />}>No hay turnos ni domicilios pendientes. Cuando en el cierre alguien no reciba su pago, aparece aquí.</Empty>
  return (
    <form className="tips-pay" onSubmit={submit} noValidate>
      <ul className="tip-list tips-people">
        {byPerson.map(([uid, p]) => (
          <li key={uid} className={p.rows.some((r) => picked.has(r.id)) ? 'on' : ''}>
            <strong>{p.name} <small className="muted">· {formatMoney(p.rows.reduce((a, r) => a + r.amount, 0))}</small></strong>
            {p.rows.map((r) => (
              <label key={r.id} className="check">
                <input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} />
                <span className="grow">{r.kind === 'domicilios' ? `Domicilios del turno ${r.session || ''}${r.deliveries ? ` (${r.deliveries})` : ''}` : `Turno ${r.session || ''}${r.hours ? ` · ${r.hours} h × ${formatMoney(r.rate || 0)}` : ''}`}<small className="block muted">{formatDateTime(r.createdAt)}</small></span>
                <span className="money">{formatMoney(r.amount)}</span>
              </label>
            ))}
          </li>
        ))}
      </ul>
      <SourcePicker data={data} admin={admin} src={src} note={note} setNote={setNote} total={total} />
      {error && <div className="alert bad">{error}</div>}
      <div className="row-between tips-total">
        <span className="muted">Turnos y nómina quedan como gasto de Nómina; lo de los domicilios no.</span>
        <button type="submit" className="btn btn-primary" disabled={saving || !total}>{saving ? <Spinner /> : <MdPayments />} Pagar {formatMoney(total)}</button>
      </div>
    </form>
  )
}

const PayrollForm = ({ data, admin, onPaid }) => {
  const due = data.payroll.filter((p) => p.due)
  const [pay, setPay] = useState(() => Object.fromEntries(due.map((p) => [p.userId, p.salary])))
  const src = useSource(data, admin)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { setPay(Object.fromEntries(data.payroll.filter((p) => p.due).map((p) => [p.userId, p.salary]))) }, [data.payroll])
  const total = Object.values(pay).reduce((a, v) => a + (Number(v) || 0), 0)
  const submit = async (e) => {
    e.preventDefault(); setError('')
    const list = data.payroll.filter((p) => p.due && Number(pay[p.userId]) > 0).map((p) => ({ userId: p.userId, amount: Number(pay[p.userId]), from: p.due.from, to: p.due.to }))
    if (!list.length) return setError('Elige a quién se le paga la nómina.')
    if (src.source === 'caja' && !src.sess) return setError('No hay una caja abierta en la sucursal. Elige otra forma de pago.')
    setSaving(true)
    try { const { data: r } = await api.post('/personal/pagos', { ...src.body, note, payroll: list }); setNote(''); onPaid(r) } catch (err) { setError(errorMessage(err)) }
    setSaving(false)
  }
  if (!data.payroll.length) return <Empty icon={<MdBadge />}>Nadie se paga por nómina. Configúralo en <Link to="/usuarios">Usuarios</Link>: edita al empleado y en “¿Cómo se le paga?” elige Nómina.</Empty>
  return (
    <form className="tips-pay" onSubmit={submit} noValidate>
      <ul className="tip-list tips-people">
        {data.payroll.map((p) => (
          <li key={p.userId} className={p.userId in pay ? 'on' : ''}>
            <label className="check"><input type="checkbox" disabled={!p.due} checked={p.userId in pay} onChange={() => setPay((t) => { const n = { ...t }; if (p.userId in n) delete n[p.userId]; else n[p.userId] = p.salary; return n })} />
              <span><strong>{p.name}</strong>
                <small className="block muted">{p.period === 'quincenal' ? 'Quincenal' : 'Mensual'} · {formatMoney(p.salary)}{p.last ? ` · último pago: ${periodLabel(p.last.from, p.last.to)}` : ''}</small>
                {p.due ? <small className={`block ${p.due.current ? 'muted' : 'text-warn'}`}>{p.due.current ? 'Periodo actual' : 'Pendiente'}: {periodLabel(p.due.from, p.due.to)}</small> : <small className="block text-ok">Al día</small>}
              </span>
            </label>
            {p.userId in pay && <MoneyInput id={`nm-${p.userId}`} value={pay[p.userId]} onChange={(v) => setPay((t) => ({ ...t, [p.userId]: v }))} aria-label={`Nómina de ${p.name}`} />}
          </li>
        ))}
      </ul>
      <SourcePicker data={data} admin={admin} src={src} note={note} setNote={setNote} total={total} />
      {error && <div className="alert bad">{error}</div>}
      <div className="row-between tips-total">
        <span className="muted">Queda como gasto de Nómina en Finanzas.</span>
        <button type="submit" className="btn btn-primary" disabled={saving || !total}>{saving ? <Spinner /> : <MdPayments />} Pagar {formatMoney(total)}</button>
      </div>
    </form>
  )
}

const PersonalTab = ({ kind, admin, toast }) => {
  const { data, error, load } = usePersonal()
  const paid = (r) => { toast(`Pago ${r.number}: ${formatMoney(r.total)}`); load() }
  if (error) return <div className="alert bad">{error}</div>
  if (!data) return <div className="splash" style={{ minHeight: 160 }}><Spinner /></div>
  const history = data.history.filter((e) => (kind === 'nomina' ? e.kind === 'nomina' : e.kind !== 'nomina'))
  return <>
    {kind === 'pendientes' && <div className="kpis">
      <Kpi label="Pendiente por pagar" value={formatMoney(data.pendingTotal)} icon={MdSchedule} tone={data.pendingTotal > 0 ? 'brand' : ''} note={`${data.pending.length} pago${data.pending.length === 1 ? '' : 's'} de turnos y domicilios`} />
    </div>}
    <div className="tips-grid">
      <Card title={kind === 'nomina' ? 'Pagar nómina' : 'Pagar turnos y domicilios'} icon={<MdPayments />}>
        {kind === 'nomina' ? <PayrollForm data={data} admin={admin} onPaid={paid} /> : <PendingForm data={data} admin={admin} onPaid={paid} />}
      </Card>
      <Card title="Pagos hechos" icon={<MdHistory />} flush>
        {!history.length ? <Empty icon={<MdHistory />}>Aún no hay pagos.</Empty> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Fecha</th><th>Empleado</th><th className="hide-sm">Origen</th><th className="num">Valor</th></tr></thead>
            <tbody>{history.map((e) => (
              <tr key={e.id}>
                <td><small>{formatDateTime(e.paidAt)}</small>{e.paidNumber && <small className="block muted">{e.paidNumber}</small>}</td>
                <td>{e.name}<small className="block muted">{e.kind === 'nomina' ? `Nómina ${periodLabel(e.periodFrom, e.periodTo)}` : e.kind === 'domicilios' ? `Domicilios ${e.session || ''}` : `Turno ${e.session || ''}${e.hours ? ` · ${e.hours} h` : ''}`}</small></td>
                <td className="hide-sm"><SourceCell source={e.paidSource} label={e.paidSourceLabel} method={e.paidMethod} methods={data.transferMethods} />{e.paidBy && <small className="block muted">{e.paidBy}</small>}</td>
                <td className="num money">{formatMoney(e.amount)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  </>
}

const TABS = { propinas: 'Propinas', pendientes: 'Turnos y domicilios', nomina: 'Nómina' }
const PersonalPaymentsPage = () => {
  const { user } = useAuth()
  const admin = ADMIN.includes(user.role)
  const [params, setParams] = useSearchParams()
  const tab = TABS[params.get('tab')] && (params.get('tab') !== 'nomina' || admin) ? params.get('tab') : 'propinas'
  const [toast, toastNode] = useToast()
  return (
    <div className="stack">
      <PageHead title="Pagos al personal" subtitle="Propinas, turnos y domicilios que quedaron pendientes, y nómina. Se paga cuando se quiera, desde la caja, el fondo o por transferencia." />
      <Tabs value={tab} onChange={(t) => setParams(t === 'propinas' ? {} : { tab: t }, { replace: true })} tabs={Object.entries(TABS).filter(([k]) => k !== 'nomina' || admin)} />
      {tab === 'propinas' ? <TipsTab admin={admin} toast={toast} /> : <PersonalTab key={tab} kind={tab} admin={admin} toast={toast} />}
      {toastNode}
    </div>
  )
}

export default PersonalPaymentsPage
