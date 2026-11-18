import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  MdPointOfSale, MdLockOpen, MdLock, MdAdd, MdRemove, MdAccountBalance, MdHistory, MdEdit, MdArrowUpward, MdArrowDownward, MdReceiptLong, MdLockReset, MdCheck, MdClose
} from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { ShiftExpenseModal, FundsRequestModal, ShiftExpensesCard, RequestsTab } from './shiftExpenses'
import { useAuth } from '../../context/AuthContext'
import { Badge, Card, Empty, Field, Kpi, Modal, PageHead, Spinner, useToast } from '../../components/ui'
import { MoneyInput, Tabs } from '../../components/forms'
import { formatDateTime, formatMoney } from '../../utils/format'
import { ADMIN, since } from '../operacion/common'

// ---------- Abrir turno ----------
const OpenModal = ({ register, admin, onClose, onDone }) => {
  const carry = register.floatAmount || 0
  const fund = register.siteFund || 0
  const [amount, setAmount] = useState(carry > 0 ? carry : '')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const base = Number(amount) || 0
  const fromFund = Math.max(0, base - carry)
  const short = fromFund > fund
  const submit = async (e) => {
    e.preventDefault(); setError(''); setSaving(true)
    try { const { data } = await api.post('/caja/turnos', { registerId: register.id, openingAmount: base, note }); onDone(data) } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  const noMoney = carry + fund <= 0
  return (
    <Modal title={`Abrir turno · ${register.name}`} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="open-cash" className="btn btn-primary" disabled={saving || !base || short}>{saving ? <Spinner /> : <MdLockOpen />} Abrir turno</button></>}>
      <form id="open-cash" className="form-grid" onSubmit={submit} noValidate>
        <div className="span-2 cash-cover">
          <div><span>Quedó en esta caja</span><strong className="money">{formatMoney(carry)}</strong></div>
          <div><span>Fondo de {register.site || 'la sucursal'}</span><strong className="money">{formatMoney(fund)}</strong></div>
          <div><span>Disponible para la base</span><strong className="money">{formatMoney(carry + fund)}</strong></div>
        </div>
        {noMoney ? (
          <div className="alert warn span-2">La sucursal no tiene fondos para la base. {admin ? <Link to="/finanzas?tab=fondos">Ingresa dinero a la sucursal en Finanzas</Link> : 'Pide al administrador que ingrese dinero al fondo de la sucursal.'}</div>
        ) : (
          <div className="span-2"><Field label="Base en efectivo" htmlFor="ob" hint={short ? `Faltan ${formatMoney(fromFund - fund)} en el fondo de la sucursal` : fromFund > 0 ? `${formatMoney(fromFund)} salen del fondo de la sucursal` : base && base < carry ? `${formatMoney(carry - base)} vuelven al fondo de la sucursal` : 'El dinero con el que arranca la caja para dar cambio'}><MoneyInput id="ob" value={amount} onChange={setAmount} autoFocus /></Field></div>
        )}
        <div className="span-2"><Field label="Nota" htmlFor="on"><input id="on" value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>
  )
}

// ---------- Ingreso / egreso ----------
const MoveModal = ({ session, admin, onClose, onDone }) => {
  const [type, setType] = useState('ingreso')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const submit = async (e) => {
    e.preventDefault(); setError('')
    try { await api.post(`/caja/turnos/${session.id}/movimientos`, { type, amount, note }); onDone(type) } catch (err) { setError(errorMessage(err)) }
  }
  return (
    <Modal title="Otro movimiento de efectivo" onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="cash-move" className="btn btn-primary">Registrar</button></>}>
      <form id="cash-move" className="form-grid" onSubmit={submit} noValidate>
        <div className="seg span-2">
          {admin && <button type="button" className={`btn btn-sm${type === 'egreso' ? ' on' : ''}`} onClick={() => setType('egreso')}><MdRemove /> Egreso</button>}
          <button type="button" className={`btn btn-sm${type === 'ingreso' ? ' on' : ''}`} onClick={() => setType('ingreso')}><MdAdd /> Ingreso</button>
          <button type="button" className={`btn btn-sm${type === 'propina_pagada' ? ' on' : ''}`} onClick={() => setType('propina_pagada')}>Pago de propinas</button>
        </div>
        <Field label="Valor" htmlFor="mv" required><MoneyInput id="mv" value={amount} onChange={setAmount} autoFocus /></Field>
        <Field label="Concepto" htmlFor="mc" required><input id="mc" value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === 'egreso' ? 'Ej. compra de hielo' : type === 'ingreso' ? 'Ej. cambio desde la bóveda' : 'Ej. propinas del turno a meseros'} /></Field>
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>
  )
}

// ---------- Cierre con arqueo ----------
const CloseModal = ({ session, summary, onClose, onDone }) => {
  const [counted, setCounted] = useState('')
  const [nextFloat, setNextFloat] = useState(session.openingAmount || '')
  const [note, setNote] = useState('')
  const [staff, setStaff] = useState(null)
  const [tips, setTips] = useState({})
  // Domiciliarios: su parte de los domicilios cobrados en el turno más las propinas de sus entregas.
  const [cour, setCour] = useState(null)
  const [courPay, setCourPay] = useState({})
  const [showAll, setShowAll] = useState(false)
  const [force, setForce] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    api.get(`/caja/turnos/${session.id}/propinas`, { params: { sede: undefined } }).then(({ data }) => {
      setStaff(data)
      setTips(Object.fromEntries(data.employees.filter((x) => x.suggested > 0).map((x) => [x.id, x.suggested])))
    }).catch(() => setStaff({ total: 0, employees: [] }))
    api.get(`/caja/turnos/${session.id}/domiciliarios`).then(({ data }) => {
      setCour(data); setCourPay(Object.fromEntries(data.rows.map((r) => [r.userId, r.suggested])))
    }).catch(() => setCour({ rows: [], total: 0 }))
  }, [session.id])
  const courTotal = Object.values(courPay).reduce((a, v) => a + (Number(v) || 0), 0)
  const tipTotal = Object.values(tips).reduce((a, v) => a + (Number(v) || 0), 0)
  const cnt = counted === '' ? null : Number(counted)
  const diff = cnt === null ? null : cnt - summary.expectedCash
  const toVault = cnt === null ? null : cnt - tipTotal - courTotal - (Number(nextFloat) || 0)
  const picked = Object.keys(tips).map(Number)
  const shown = staff ? staff.employees.filter((x) => showAll || x.served || picked.includes(x.id)) : []
  const toggle = (id) => setTips((t) => { const n = { ...t }; if (id in n) delete n[id]; else n[id] = ''; return n })
  // Reparto: en grupo (partes iguales, con bonificación opcional al mejor calificado) o individual (lo de sus mesas).
  const [mode, setMode] = useState('individual')
  const [bonusOn, setBonusOn] = useState(false)
  const [bonusPct, setBonusPct] = useState('20')
  const score = (x) => (x.rating ? x.rating.avg * 100 + x.rating.count : x.ratingMonth ? x.ratingMonth.avg * 100 - 1000 + x.ratingMonth.count : -1e9)
  const groupIds = () => (picked.length ? picked : staff.employees.filter((x) => x.served).map((x) => x.id))
  const best = staff && mode === 'grupo' ? staff.employees.filter((x) => groupIds().includes(x.id) && (x.rating || x.ratingMonth)).sort((a, b) => score(b) - score(a))[0] || null : null
  const split = (opts = {}) => {
    const ids = groupIds()
    if (!ids.length) return
    const on = opts.bonusOn ?? bonusOn
    const pctV = Math.max(0, Math.min(200, Number(String(opts.bonusPct ?? bonusPct).replace(',', '.')) || 0))
    const top = on && ids.length > 1 ? (opts.best ?? best) : null
    const w = ids.map((id) => (top && id === top.id ? 1 + pctV / 100 : 1))
    const sumW = w.reduce((a, x) => a + x, 0)
    const parts = ids.map((id, i) => Math.floor(summary.tips * w[i] / sumW))
    const rest = summary.tips - parts.reduce((a, x) => a + x, 0)
    const iTop = top ? ids.indexOf(top.id) : 0
    parts[iTop >= 0 ? iTop : 0] += rest
    setTips(Object.fromEntries(ids.map((id, i) => [id, parts[i]])))
  }
  const toGroup = () => { setMode('grupo'); setTimeout(() => split(), 0) }
  const toIndividual = () => { setMode('individual'); setBonusOn(false); setTips(Object.fromEntries(staff.employees.filter((x) => x.suggested > 0).map((x) => [x.id, x.suggested]))) }
  const submit = async (e) => {
    e.preventDefault(); setError('')
    if (cnt === null) return setError('Cuenta el efectivo y escribe el total.')
    if (toVault < 0) return setError('El efectivo contado no alcanza para las propinas, los domiciliarios y la base. Ajusta los valores.')
    setSaving(true)
    try {
      const { data } = await api.post(`/caja/turnos/${session.id}/cerrar`, { countedCash: cnt, nextFloat: Number(nextFloat) || 0, tips: Object.entries(tips).filter(([, v]) => Number(v) > 0).map(([userId, amount]) => ({ userId: Number(userId), amount: Number(amount) })), couriers: Object.entries(courPay).filter(([, v]) => Number(v) > 0).map(([userId, amount]) => ({ userId: Number(userId), amount: Number(amount) })), note, force })
      onDone(data)
    } catch (err) {
      const msg = errorMessage(err); setError(msg); setSaving(false)
      if (/pedidos? abiertos?/.test(msg)) setForce(true)
    }
  }
  return (
    <Modal size="xl" title={`Cerrar turno ${session.number} · ${session.register}`} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="close-cash" className="btn btn-primary" disabled={saving}>{saving ? <Spinner /> : <MdLock />} {force ? 'Cerrar igualmente' : 'Cerrar turno'}</button></>}>
      <form id="close-cash" className="close-grid" onSubmit={submit} noValidate>
        <section className="close-step">
          <h4><span>1</span> Arqueo</h4>
          <div className="arqueo-sales">
            <div className="row-between"><strong>Cobrado en el turno</strong><small className="muted">{summary.orders} pedido{summary.orders === 1 ? '' : 's'}</small></div>
            {!summary.byMethod.length ? <small className="muted">No hubo cobros en este turno.</small> : (
              <dl className="order-totals" style={{ margin: 0 }}>
                {[...summary.byMethod].sort((a, b) => (a.method === 'efectivo' ? -1 : b.method === 'efectivo' ? 1 : b.amount - a.amount)).map((x) => (
                  <div key={x.method}><dt>{x.label || x.method}{x.method !== 'efectivo' && <small className="muted"> · no entra a la caja</small>}</dt><dd>{formatMoney(x.amount)}</dd></div>
                ))}
                <div className="total"><dt>Total cobrado</dt><dd>{formatMoney(summary.byMethod.reduce((a, x) => a + x.amount, 0))}</dd></div>
              </dl>
            )}
          </div>
          <small className="muted">Efectivo que debe haber en la caja</small>
          <dl className="order-totals" style={{ margin: 0 }}>
            <div><dt>Base de apertura</dt><dd>{formatMoney(session.openingAmount)}</dd></div>
            <div><dt>Ventas y abonos en efectivo</dt><dd>{formatMoney(summary.byMethod.find((m) => m.method === 'efectivo')?.amount || 0)}</dd></div>
            <div><dt>Ingresos − egresos</dt><dd>{formatMoney(summary.income - summary.expenses)}</dd></div>
            <div className="total"><dt>Efectivo esperado</dt><dd>{formatMoney(summary.expectedCash)}</dd></div>
          </dl>
          <Field label="Efectivo contado en la caja" htmlFor="cc" required><MoneyInput id="cc" value={counted} onChange={setCounted} autoFocus /></Field>
          {diff !== null && <div className={`alert ${diff === 0 ? 'ok' : diff > 0 ? 'warn' : 'bad'}`}>{diff === 0 ? 'La caja cuadra exacto.' : diff > 0 ? `Sobrante de ${formatMoney(diff)}.` : `Faltante de ${formatMoney(-diff)}.`}</div>}
        </section>

        <section className="close-step">
          <h4><span>2</span> Propinas <small className="muted">· {formatMoney(summary.tips)} en el turno</small></h4>
          {!staff ? <Spinner /> : <>
            <div className="seg seg-wrap">
              <button type="button" className={`btn btn-sm${mode === 'individual' ? ' on' : ''}`} onClick={toIndividual}>Individual · según sus mesas</button>
              <button type="button" className={`btn btn-sm${mode === 'grupo' ? ' on' : ''}`} onClick={toGroup} disabled={!summary.tips}>En grupo · partes iguales</button>
              {Object.keys(tips).length > 0 && <button type="button" className="btn btn-sm btn-ghost" onClick={() => setTips({})}>Ninguna</button>}
            </div>
            {mode === 'grupo' && (
              <div className="tip-bonus">
                <label className="check"><input type="checkbox" checked={bonusOn} disabled={!best} onChange={(e) => { setBonusOn(e.target.checked); split({ bonusOn: e.target.checked }) }} />
                  <span><strong>Dar más propina al mejor calificado</strong><small className="block muted">{best ? `${best.name} · ${(best.rating || best.ratingMonth).avg} ★ (${(best.rating || best.ratingMonth).count} calificaciones${best.rating ? ' en el turno' : ' en 30 días'})` : 'Aún no hay calificaciones del personal elegido.'}</small></span>
                </label>
                {bonusOn && best && <div className="input-prefix" style={{ width: 120 }}><span>+%</span><input inputMode="decimal" value={bonusPct} onChange={(e) => { setBonusPct(e.target.value); split({ bonusPct: e.target.value }) }} aria-label="Porcentaje adicional" /></div>}
                <button type="button" className="btn btn-sm" onClick={() => split()}>Recalcular</button>
              </div>
            )}
            <ul className="tip-list">
              {shown.map((x) => (
                <li key={x.id} className={x.id in tips ? 'on' : ''}>
                  <label className="check"><input type="checkbox" checked={x.id in tips} onChange={() => toggle(x.id)} /> <span><strong>{x.name}</strong>{best?.id === x.id && bonusOn && <Badge tone="brand">+{bonusPct} %</Badge>}<small className="block muted">{x.positions.length ? x.positions.join(', ') : x.role}{x.suggested > 0 ? ` · ${formatMoney(x.suggested)} de sus mesas` : ''}{(x.rating || x.ratingMonth) ? ` · ${(x.rating || x.ratingMonth).avg} ★` : ''}</small></span></label>
                  {x.id in tips && <MoneyInput id={`tip-${x.id}`} value={tips[x.id]} onChange={(v) => setTips((t) => ({ ...t, [x.id]: v }))} aria-label={`Propina para ${x.name}`} />}
                </li>
              ))}
              {!shown.length && <li className="muted"><small>Nadie atendió pedidos con propina en este turno.</small></li>}
            </ul>
            {staff.employees.length > shown.length && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAll(true)}>Ver todo el personal ({staff.employees.length})</button>}
            <div className="row-between"><span className="muted">Total a pagar en efectivo</span><strong className="money">{formatMoney(tipTotal)}</strong></div>
            {tipTotal > summary.tips && <small className="text-warn">Repartes más de lo que dejaron de propina en el turno.</small>}
          </>}
          {cour?.rows.length > 0 && (
            <div className="courier-close">
              <h5>🛵 Domiciliarios <small className="muted">· {cour.rule.mode === 'todo' ? 'les toca todo el domicilio' : `les toca el ${cour.rule.percent} % del domicilio`} + propinas de sus entregas</small></h5>
              <ul className="tip-list">{cour.rows.map((r) => (
                <li key={r.userId} className="on">
                  <span><strong>{r.name}</strong><small className="block muted">{r.deliveries} domicilio{r.deliveries === 1 ? '' : 's'} · {formatMoney(r.share)} de {formatMoney(r.fees)} en domicilios{r.tips > 0 ? ` · ${formatMoney(r.tips)} propinas` : ''}</small></span>
                  <MoneyInput id={`cour-${r.userId}`} value={courPay[r.userId] ?? ''} onChange={(v) => setCourPay((t) => ({ ...t, [r.userId]: v }))} aria-label={`Pago a ${r.name}`} />
                </li>
              ))}</ul>
              <div className="row-between"><span className="muted">Total a domiciliarios en efectivo</span><strong className="money">{formatMoney(courTotal)}</strong></div>
              {cour.businessShare > 0 && <small className="muted">Al negocio le quedan {formatMoney(cour.businessShare)} de los domicilios.</small>}
            </div>
          )}
        </section>

        <section className="close-step">
          <h4><span>3</span> ¿A dónde va el efectivo?</h4>
          <Field label="Queda en la caja para el próximo turno" htmlFor="cf" hint="Base para dar cambio mañana"><MoneyInput id="cf" value={nextFloat} onChange={setNextFloat} /></Field>
          <div className={`vault-box${toVault !== null && toVault < 0 ? ' bad' : ''}`}>
            <span>Pasa a la bóveda</span>
            <strong>{toVault === null ? '—' : formatMoney(toVault)}</strong>
            <small>{cnt === null ? 'Escribe el efectivo contado' : `${formatMoney(cnt)} contado − ${formatMoney(tipTotal)} propinas${courTotal ? ` − ${formatMoney(courTotal)} domiciliarios` : ''} − ${formatMoney(Number(nextFloat) || 0)} base`}</small>
          </div>
          <Field label="Observaciones del cierre" htmlFor="cn"><textarea id="cn" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. faltante por un billete falso, se pagó el hielo con caja" /></Field>
        </section>
        {error && <div className="alert bad close-full">{error}</div>}
      </form>
    </Modal>
  )
}

// ---------- Reabrir un turno cerrado ----------
// El cajero pide reabrir con el motivo; el administrador aprueba (o, si lo pide él, se reabre de una vez).
const ReopenModal = ({ session, admin, onClose, onDone }) => {
  const [reason, setReason] = useState('')
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setError('')
    if (reason.trim().length < 5) return setError('Explica el motivo para reabrir el turno.')
    setSaving(true)
    try { const { data } = await api.post(`/caja/turnos/${session.id}/reabrir`, { reason }); onDone(data) } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  const snap = session
  return (
    <Modal title={`${admin ? 'Reabrir' : 'Pedir reabrir'} el turno ${session.number}`} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="reopen-form" className="btn btn-primary" disabled={saving}>{saving ? <Spinner /> : <MdLockReset />} {admin ? 'Reabrir turno' : 'Enviar solicitud'}</button></>}>
      <form id="reopen-form" className="stack" style={{ gap: 12 }} onSubmit={submit} noValidate>
        <div className="alert warn">Al reabrir se anula el cierre: vuelven a la caja los {formatMoney(snap.toVault)} que pasaron a la bóveda, las propinas pagadas ({formatMoney(snap.tipsPaid)}) y la base que quedaba. Corrige lo necesario y cierra el turno de nuevo.</div>
        <Field label="Motivo de la reapertura" htmlFor="rr" required hint={admin ? 'Queda en la auditoría y se avisa por Telegram.' : 'El administrador recibe la solicitud con este motivo.'}>
          <textarea id="rr" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus placeholder="Ej. registré un pago en efectivo que fue por Nequi; conté mal los billetes de 50.000" />
        </Field>
        {session.reopen?.until && <small className="muted">Se puede reabrir hasta el {formatDateTime(session.reopen.until)}, siempre que no se abra otro turno en esta caja.</small>}
        {error && <div className="alert bad">{error}</div>}
      </form>
    </Modal>
  )
}

const ReopenBox = ({ s, admin, onAsk, onResolved, toast }) => {
  const r = s.reopen
  const [busy, setBusy] = useState('')
  if (!r || s.status !== 'cerrada') return null
  const resolve = async (action) => {
    const note = action === 'rechazar' ? window.prompt('Motivo del rechazo') : ''
    if (action === 'rechazar' && !note) return
    setBusy(action)
    try { await api.post(`/caja/reaperturas/${r.pending.id}/${action}`, { note }); toast(action === 'aprobar' ? `Turno ${s.number} reabierto` : 'Solicitud rechazada'); onResolved() } catch (e) { toast(errorMessage(e), 'bad') }
    setBusy('')
  }
  if (r.pending) {
    return (
      <div className="alert warn reopen-box">
        <MdLockReset />
        <div className="grow"><strong>{r.pending.requestedBy} pidió reabrir este turno</strong><small className="block">{r.pending.reason}</small></div>
        {admin && <div className="card-actions">
          <button type="button" className="btn btn-sm" onClick={() => resolve('rechazar')} disabled={Boolean(busy)}>{busy === 'rechazar' ? <Spinner /> : <MdClose />} Rechazar</button>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => resolve('aprobar')} disabled={Boolean(busy) || !r.allowed}>{busy === 'aprobar' ? <Spinner /> : <MdCheck />} Reabrir</button>
        </div>}
      </div>
    )
  }
  if (!r.allowed) return r.hours > 0 ? <small className="muted">🔒 Este turno ya no se puede reabrir. {r.why}</small> : null
  return (
    <div className="reopen-box">
      <small className="muted grow">¿Hubo un error en el cierre? Se puede reabrir hasta el {formatDateTime(r.until)}{admin ? '' : ' con autorización del administrador'}.</small>
      <button type="button" className="btn btn-sm" onClick={onAsk}><MdLockReset /> {admin ? 'Reabrir turno' : 'Pedir reabrir'}</button>
    </div>
  )
}

// Solicitudes de reapertura (administrador).
const ReopenTab = ({ onCount, onOpenSession }) => {
  const [d, setD] = useState(null)
  const [toast, toastNode] = useToast()
  const load = useCallback(() => api.get('/caja/reaperturas').then(({ data }) => { setD(data); onCount?.(data.pending) }).catch(() => setD({ rows: [], hours: 0 })), [onCount])
  useEffect(() => { load() }, [load])
  const resolve = async (r, action) => {
    const note = action === 'rechazar' ? window.prompt('Motivo del rechazo') : ''
    if (action === 'rechazar' && !note) return
    try { await api.post(`/caja/reaperturas/${r.id}/${action}`, { note }); toast(action === 'aprobar' ? `Turno ${r.session} reabierto` : 'Solicitud rechazada'); load(); if (action === 'aprobar') onOpenSession?.() } catch (e) { toast(errorMessage(e), 'bad') }
  }
  if (!d) return <div className="splash" style={{ minHeight: 160 }}><Spinner /></div>
  return (
    <Card title="Reabrir turnos" subtitle={d.hours > 0 ? `Un turno se puede reabrir hasta ${d.hours} h después del cierre y antes de abrir otro en la misma caja. Cámbialo en Configuración.` : 'La reapertura está desactivada (0 horas en Configuración).'} icon={<MdLockReset />} flush>
      {!d.rows.length ? <Empty icon={<MdLockReset />}>No hay solicitudes para reabrir turnos.</Empty> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Turno</th><th>Motivo</th><th className="hide-sm">Pidió</th><th>Estado</th><th /></tr></thead>
          <tbody>{d.rows.map((r) => (
            <tr key={r.id}>
              <td><strong>{r.session}</strong><small className="block muted">{r.register}{r.site ? ` · ${r.site}` : ''}</small></td>
              <td>{r.reason}{r.resolution && <small className="block muted">💬 {r.resolution}</small>}{r.snapshot && <small className="block muted">Cierre anulado: contado {formatMoney(r.snapshot.counted)}, diferencia {formatMoney(r.snapshot.difference)}</small>}</td>
              <td className="hide-sm">{r.requestedBy}<small className="block muted">{formatDateTime(r.createdAt)}</small></td>
              <td><Badge tone={r.status === 'pendiente' ? 'warn' : r.status === 'aprobada' ? 'ok' : 'muted'}>{r.status === 'aprobada' ? 'Reabierto' : r.statusLabel}</Badge></td>
              <td className="num">{r.status === 'pendiente' && <div className="card-actions"><button type="button" className="btn btn-sm" onClick={() => resolve(r, 'rechazar')}><MdClose /> Rechazar</button><button type="button" className="btn btn-sm btn-primary" onClick={() => resolve(r, 'aprobar')}><MdCheck /> Reabrir</button></div>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {toastNode}
    </Card>
  )
}

// ---------- Detalle de un turno ----------
const SessionView = ({ id, canClose, onChanged }) => {
  const { user } = useAuth()
  const admin = ADMIN.includes(user.role)
  const [ver, setVer] = useState(0)
  const [s, setS] = useState(null)
  const [modal, setModal] = useState(null)
  const [toast, toastNode] = useToast()
  const [loadError, setLoadError] = useState('')
  const load = useCallback(() => api.get(`/caja/turnos/${id}`, { params: { sede: undefined } }).then(({ data }) => { setS(data); setLoadError('') }).catch((e) => setLoadError(errorMessage(e))), [id])
  useEffect(() => { load() }, [load])
  if (loadError && !s) return <div className="alert bad">No se pudo abrir el turno: {loadError} <button type="button" className="btn btn-sm" onClick={load}>Reintentar</button></div>
  if (!s) return <div className="splash" style={{ minHeight: 160 }}><Spinner /></div>
  const m = s.summary
  const open = s.status === 'abierta'
  return (
    <div className="stack">
      {s.reopenCount > 0 && open && <div className="alert info">🔓 Turno reabierto {s.reopenCount === 1 ? '' : `${s.reopenCount} veces `}el {formatDateTime(s.reopenedAt)}. Corrige lo necesario y ciérralo de nuevo.</div>}
      <ReopenBox s={s} admin={admin} onAsk={() => setModal('reopen')} onResolved={() => { load(); onChanged() }} toast={toast} />
      <div className="kpis">
        <Kpi label="Ventas" value={formatMoney(m.sales)} note={`${m.orders} pedidos`} icon={MdPointOfSale} tone="brand" />
        <Kpi label="Propinas" value={formatMoney(m.tips)} />
        <Kpi label="Efectivo esperado" value={formatMoney(m.expectedCash)} note={`Base ${formatMoney(s.openingAmount)}`} tone="dark" />
        {!open && <Kpi label="Diferencia" value={formatMoney(s.difference)} tone={s.difference === 0 ? '' : s.difference > 0 ? 'warn' : 'bad'} note={`Contado ${formatMoney(s.countedCash)}`} />}
        {m.discounts > 0 && <Kpi label="Descuentos" value={formatMoney(m.discounts)} />}
        {m.courtesies > 0 && <Kpi label="Cortesías" value={formatMoney(m.courtesies)} />}
      </div>
      <div className="grid grid-2-1">
        <Card title="Movimientos" subtitle={`${s.register} · ${s.number} · abrió ${s.openedBy} ${since(s.openedAt)}`} flush
          actions={open && canClose && <div className="card-actions"><button type="button" className="btn btn-sm" onClick={() => setModal('move')}><MdAdd /> Otro movimiento</button><button type="button" className="btn btn-sm btn-primary" onClick={() => setModal('close')}><MdLock /> Cerrar turno</button></div>}>
          {!m.movements.length ? <Empty>Sin movimientos.</Empty> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Hora</th><th>Concepto</th><th className="hide-sm">Forma</th><th className="num">Valor</th></tr></thead>
              <tbody>{m.movements.map((x) => (
                <tr key={x.id}><td><small>{formatDateTime(x.createdAt)}</small></td>
                  <td>{x.orderId ? <Link to={`/pedidos/${x.orderId}`}>{x.typeLabel} {x.ref}</Link> : <>{x.typeLabel}{x.note && <small className="block muted">{x.note}</small>}</>}</td>
                  <td className="hide-sm">{x.methodLabel}</td>
                  <td className={`num money ${x.amount < 0 ? 'text-bad' : ''}`}>{formatMoney(x.amount)}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
        <Card title="Por forma de pago">
          {!m.byMethod.length ? <small className="muted">Aún no hay cobros.</small> : (
            <dl className="order-totals" style={{ margin: 0 }}>{m.byMethod.map((x) => <div key={x.method}><dt>{x.label}</dt><dd>{formatMoney(x.amount)}</dd></div>)}
              <div className="total"><dt>Total</dt><dd>{formatMoney(m.byMethod.reduce((a, x) => a + x.amount, 0))}</dd></div></dl>
          )}
          {(m.income > 0 || m.expenses > 0 || m.toVault > 0) && <dl className="order-totals" style={{ marginTop: 12 }}>
            {m.income > 0 && <div><dt>Ingresos</dt><dd>{formatMoney(m.income)}</dd></div>}
            {m.expenses > 0 && <div><dt>Egresos</dt><dd>−{formatMoney(m.expenses)}</dd></div>}
            {m.toVault > 0 && <div><dt>A la bóveda</dt><dd>{formatMoney(m.toVault)}</dd></div>}
          </dl>}
          {!open && <dl className="order-totals" style={{ marginTop: 12 }}>
            <div><dt>Propinas pagadas</dt><dd>{formatMoney(s.tipsPaid)}</dd></div>
            {s.couriersPaid > 0 && <div><dt>Pagado a domiciliarios</dt><dd>{formatMoney(s.couriersPaid)}</dd></div>}
            <div><dt>Quedó en caja para el próximo turno</dt><dd>{formatMoney(s.nextFloat)}</dd></div>
          </dl>}
          {!open && m.tipPayouts?.length > 0 && <ul className="list" style={{ marginTop: 8 }}>{m.tipPayouts.map((t) => <li key={t.id}><span>🤝 {t.name}</span><span className="money">{formatMoney(t.amount)}</span></li>)}</ul>}
          {!open && m.courierPayouts?.length > 0 && <ul className="list" style={{ marginTop: 8 }}>{m.courierPayouts.map((t) => <li key={t.id}><span>🛵 {t.name} <small className="muted">{t.deliveries} domicilio{t.deliveries === 1 ? '' : 's'}</small></span><span className="money">{formatMoney(t.amount)}</span></li>)}</ul>}
          {!open && s.closeNote && <p className="hint">📝 {s.closeNote}</p>}
        </Card>
      </div>
      <ShiftExpensesCard session={s} version={ver} open={open && canClose} onExpense={(info) => setModal({ expense: info })} onRequest={(initial) => setModal({ request: initial || {} })} />
      {modal?.expense && <ShiftExpenseModal session={s} info={modal.expense} admin={admin} onClose={() => setModal(null)} onAskFunds={(initial) => setModal({ request: initial })} onDone={(d) => { setModal(null); toast(`Gasto ${d.number} registrado`); setVer((v) => v + 1); load() }} />}
      {modal?.request && <FundsRequestModal session={s} initial={modal.request} onClose={() => setModal(null)} onDone={(d) => { setModal(null); toast(`Solicitud ${d.number} enviada al administrador`); setVer((v) => v + 1) }} />}
      {modal === 'move' && <MoveModal session={s} admin={admin} onClose={() => setModal(null)} onDone={(t) => { setModal(null); toast(t === 'ingreso' ? 'Ingreso registrado' : 'Egreso registrado'); load() }} />}
      {modal === 'close' && <CloseModal session={s} summary={m} onClose={() => setModal(null)} onDone={(d) => { setModal(null); setS(d); load(); toast(`Turno ${d.number} cerrado`); onChanged() }} />}
      {modal === 'reopen' && <ReopenModal session={s} admin={admin} onClose={() => setModal(null)} onDone={(d) => { setModal(null); toast(d.reopened ? `Turno ${s.number} reabierto. Corrige y ciérralo de nuevo.` : 'Solicitud enviada al administrador'); load(); onChanged() }} />}
      {toastNode}
    </div>
  )
}

// ---------- Bóveda ----------
const VaultTab = () => {
  const [v, setV] = useState(null)
  const [modal, setModal] = useState(false)
  const [f, setF] = useState({ type: 'consignacion', amount: '', note: '' })
  const [error, setError] = useState('')
  const [toast, toastNode] = useToast()
  const load = useCallback(() => api.get('/caja/boveda').then(({ data }) => setV(data)).catch((e) => setError(errorMessage(e))), [])
  useEffect(() => { load() }, [load])
  const submit = async (e) => {
    e.preventDefault(); setError('')
    try { await api.post('/caja/boveda/movimientos', { ...f, siteId: v.siteId }); setModal(false); setF({ type: 'consignacion', amount: '', note: '' }); toast('Movimiento registrado'); load() } catch (err) { setError(errorMessage(err)) }
  }
  if (!v) return error ? <div className="alert bad">{error}</div> : <div className="splash" style={{ minHeight: 160 }}><Spinner /></div>
  return (
    <div className="stack">
      <div className="kpis">
        <Kpi label={`Bóveda ${v.site}`} value={formatMoney(v.balance)} icon={MdAccountBalance} tone="brand" />
        {v.bySite.length > 1 && <Kpi label="Todas las bóvedas" value={formatMoney(v.total)} note={v.bySite.map((x) => `${x.site}: ${formatMoney(x.balance)}`).join(' · ')} />}
      </div>
      <Card title="Movimientos de la bóveda" subtitle="La bóveda es el fondo de la sucursal: de aquí sale la base para abrir sus cajas" flush actions={<div className="card-actions"><Link to="/finanzas?tab=fondos" className="btn btn-sm">Ingresar dinero</Link><button type="button" className="btn btn-sm btn-primary" onClick={() => setModal(true)}><MdEdit /> Registrar</button></div>}>
        {!v.movements.length ? <Empty icon={<MdAccountBalance />}>La bóveda recibe el efectivo al cerrar cada turno de caja.</Empty> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Fecha</th><th>Tipo</th><th className="hide-sm">Detalle</th><th className="num">Valor</th><th className="num hide-sm">Saldo</th></tr></thead>
            <tbody>{v.movements.map((m) => (
              <tr key={m.id}><td><small>{formatDateTime(m.createdAt)}</small></td><td>{m.amount > 0 ? <MdArrowUpward className="text-ok" /> : <MdArrowDownward className="text-bad" />} {m.typeLabel}</td>
                <td className="hide-sm"><small>{[m.ref, m.note, m.user].filter(Boolean).join(' · ')}</small></td>
                <td className={`num money ${m.amount < 0 ? 'text-bad' : 'text-ok'}`}>{formatMoney(m.amount)}</td><td className="num money hide-sm">{formatMoney(m.balanceAfter)}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
      {modal && (
        <Modal title="Movimiento de bóveda" onClose={() => setModal(false)}
          footer={<><button type="button" className="btn" onClick={() => setModal(false)}>Cancelar</button><button type="submit" form="vault-form" className="btn btn-primary">Registrar</button></>}>
          <form id="vault-form" className="form-grid" onSubmit={submit} noValidate>
            <div className="span-2"><Field label="Tipo" htmlFor="vt"><select id="vt" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              <option value="consignacion">Consignación al banco (sale)</option><option value="retiro">Retiro (sale)</option><option value="deposito">Depósito (entra)</option>
            </select></Field></div>
            <Field label="Valor" htmlFor="va" required><MoneyInput id="va" value={f.amount} onChange={(x) => setF({ ...f, amount: x })} /></Field>
            <Field label="Concepto o referencia" htmlFor="vn" required={f.type !== 'deposito'}><input id="vn" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Ej. consignación Bancolombia 0012" /></Field>
            {error && <div className="alert bad span-2">{error}</div>}
          </form>
        </Modal>
      )}
      {toastNode}
    </div>
  )
}

// ---------- Historial de turnos ----------
const HistoryTab = ({ onPick }) => {
  const [rows, setRows] = useState(null)
  useEffect(() => { api.get('/caja/turnos').then(({ data }) => setRows(data)).catch(() => setRows([])) }, [])
  if (!rows) return <div className="splash" style={{ minHeight: 160 }}><Spinner /></div>
  return (
    <Card flush>
      {!rows.length ? <Empty icon={<MdHistory />}>Aún no hay turnos.</Empty> : (
        <div className="table-wrap"><table className="table hover">
          <thead><tr><th>Turno</th><th>Caja</th><th className="hide-sm">Abrió</th><th className="hide-md">Cerró</th><th className="num">Esperado</th><th className="num">Diferencia</th><th>Estado</th></tr></thead>
          <tbody>{rows.map((s) => (
            <tr key={s.id} onClick={() => onPick(s)} style={{ cursor: 'pointer' }}>
              <td><strong>{s.number}</strong><small className="block muted">{formatDateTime(s.openedAt)}</small></td>
              <td>{s.register}{s.site && <small className="block muted">{s.site}</small>}</td>
              <td className="hide-sm">{s.openedBy}</td><td className="hide-md">{s.closedBy || '—'}</td>
              <td className="num money">{s.expectedCash === null ? '—' : formatMoney(s.expectedCash)}</td>
              <td className={`num money ${s.difference < 0 ? 'text-bad' : s.difference > 0 ? 'text-warn' : ''}`}>{s.difference === null ? '—' : formatMoney(s.difference)}</td>
              <td><Badge tone={s.status === 'abierta' ? 'ok' : 'muted'}>{s.status === 'abierta' ? 'Abierta' : 'Cerrada'}</Badge></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </Card>
  )
}

// Caja: turnos por caja (apertura, movimientos, cierre con arqueo), historial y bóveda.
const CashPage = () => {
  const { user } = useAuth()
  const admin = ADMIN.includes(user.role)
  const [params] = useSearchParams()
  const [tab, setTab] = useState(['boveda', 'solicitudes', 'reaperturas'].includes(params.get('tab')) && admin ? params.get('tab') : 'turno')
  const [pending, setPending] = useState(0)
  const [reopenPending, setReopenPending] = useState(0)
  useEffect(() => {
    if (!admin) return
    api.get('/caja/solicitudes', { params: { estado: 'pendiente' } }).then(({ data }) => setPending(data.pending)).catch(() => {})
    api.get('/caja/reaperturas', { params: { estado: 'pendiente' } }).then(({ data }) => setReopenPending(data.pending)).catch(() => {})
  }, [admin])
  const [registers, setRegisters] = useState(null)
  const [current, setCurrent] = useState(null)
  const [modal, setModal] = useState(null)
  const [name, setName] = useState('')
  const [toast, toastNode] = useToast()
  // "Ver turno" lleva al detalle del turno (movimientos, cobros y cierre), que va debajo de las cajas.
  const sessionRef = useRef(null)
  const showSession = () => setTimeout(() => sessionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  const load = useCallback(() => api.get('/caja/cajas').then(({ data }) => {
    setRegisters(data)
    setCurrent((c) => c || data.find((r) => r.session && r.session.openedById === user.id)?.session || data.find((r) => r.session)?.session || null)
  }).catch(() => setRegisters([])), [user.id])
  useEffect(() => { load() }, [load])
  const addRegister = async (e) => { e.preventDefault(); try { await api.post('/caja/cajas', { name }); setModal(null); setName(''); toast('Caja creada'); load() } catch (err) { toast(errorMessage(err), 'bad') } }

  return (
    <div className="stack">
      <PageHead title="Caja" subtitle="Abre el turno con la base, cobra los pedidos y ciérralo contando el efectivo. Lo que sobra pasa a la bóveda.">
        <Link to="/cuentas-por-cobrar" className="btn"><MdReceiptLong /> Cuentas por cobrar</Link>
        {admin && <button type="button" className="btn" onClick={() => setModal('register')}><MdAdd /> Caja</button>}
      </PageHead>
      <Tabs value={tab} onChange={(t) => { setTab(t); if (t === 'turno') setCurrent(null) || load() }} tabs={[['turno', 'Turnos'], ['historial', 'Historial'], ...(admin ? [['solicitudes', pending ? `Solicitudes (${pending})` : 'Solicitudes'], ['reaperturas', reopenPending ? `Reabrir turnos (${reopenPending})` : 'Reabrir turnos'], ['boveda', 'Bóveda']] : [])]} />
      {tab === 'turno' && (!registers ? <div className="splash" style={{ minHeight: 160 }}><Spinner /></div> : <>
        <div className="register-grid">{registers.filter((r) => r.active).map((r) => (
          <div key={r.id} className={`register${r.session ? ' open' : ''}${current && r.session?.id === current.id ? ' on' : ''}`}>
            <div><strong>{r.name}</strong><small className="block muted">{r.site}</small></div>
            {r.session ? <>
              <small>{r.session.number} · {r.session.openedBy} · {since(r.session.openedAt)}</small>
              {current && r.session.id === current.id
                ? <button type="button" className="btn btn-sm btn-primary" onClick={showSession}>Viendo este turno ↓</button>
                : <button type="button" className="btn btn-sm" onClick={() => { setCurrent(r.session); showSession() }}>Ver turno</button>}
            </> : <button type="button" className="btn btn-sm btn-primary" onClick={() => setModal({ open: r })}><MdLockOpen /> Abrir turno</button>}
          </div>
        ))}</div>
        {!registers.length && <Card><Empty icon={<MdPointOfSale />}>No hay cajas en esta sucursal.</Empty></Card>}
        {current && (
          <div ref={sessionRef} className="session-anchor">
            <h3 className="section-title">Turno {current.number} · {current.register}</h3>
            <SessionView key={current.id} id={current.id} canClose onChanged={load} />
          </div>
        )}
      </>)}
      {tab === 'historial' && (current && current.fromHistory ? <><button type="button" className="btn btn-ghost btn-sm" onClick={() => setCurrent(null)}>← Volver al historial</button><SessionView key={current.id} id={current.id} canClose={false} onChanged={load} /></> : <HistoryTab onPick={(s) => setCurrent({ ...s, fromHistory: true })} />)}
      {tab === 'boveda' && admin && <VaultTab />}
      {tab === 'solicitudes' && admin && <RequestsTab onCount={setPending} />}
      {tab === 'reaperturas' && admin && <ReopenTab onCount={setReopenPending} onOpenSession={load} />}
      {modal?.open && <OpenModal register={modal.open} admin={admin} onClose={() => setModal(null)} onDone={(s) => { setModal(null); toast(`Turno ${s.number} abierto`); setCurrent(s); load() }} />}
      {modal === 'register' && (
        <Modal title="Nueva caja" onClose={() => setModal(null)} footer={<><button type="button" className="btn" onClick={() => setModal(null)}>Cancelar</button><button type="submit" form="reg-form" className="btn btn-primary">Crear</button></>}>
          <form id="reg-form" onSubmit={addRegister}><Field label="Nombre" htmlFor="rn" required hint="Se crea en la sucursal elegida arriba (o la principal)"><input id="rn" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Caja 2, Caja barra" autoFocus /></Field></form>
        </Modal>
      )}
      {toastNode}
    </div>
  )
}

export default CashPage
