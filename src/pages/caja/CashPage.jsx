import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  MdPointOfSale, MdLockOpen, MdLock, MdAdd, MdRemove, MdAccountBalance, MdHistory, MdEdit, MdArrowUpward, MdArrowDownward, MdReceiptLong, MdLockReset, MdCheck, MdClose, MdVolunteerActivism
} from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { ShiftExpenseModal, FundsRequestModal, ShiftExpensesCard, RequestsTab } from './shiftExpenses'
import { SessionTransfers, SessionTransfersCard, TransfersTab, transferSummaryText, useSessionTransfers } from './transfers'
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
        </div>
        <Field label="Valor" htmlFor="mv" required><MoneyInput id="mv" value={amount} onChange={setAmount} autoFocus /></Field>
        <Field label="Concepto" htmlFor="mc" required><input id="mc" value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === 'egreso' ? 'Ej. compra de hielo' : 'Ej. cambio desde la bóveda'} /></Field>
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>
  )
}

// ---------- Cierre con arqueo ----------
const TRANSFER_METHODS = ['transferencia', 'nequi', 'daviplata']
// Junto a cada medio: cuántas transferencias ya se verificaron.
const TransferDot = ({ rows }) => {
  if (!rows.length) return null
  const ok = rows.filter((t) => t.status === 'verificada').length
  const bad = rows.some((t) => t.status === 'no_llego')
  return <span className={bad ? 'text-bad' : ok === rows.length ? 'text-ok' : 'text-warn'}>{ok === rows.length ? '✓' : bad ? '✕' : '○'} {ok} de {rows.length} verificada{rows.length === 1 ? '' : 's'}</span>
}
// ¿Recibe el pago ahora (sale del efectivo de la caja) o queda pendiente en Pagos al personal?
const PayNow = ({ value, onChange, name }) => (
  <div className="seg pay-now" role="group" aria-label={`Pago a ${name}`}>
    <button type="button" className={`btn btn-sm${value ? ' on' : ''}`} onClick={() => onChange(true)} aria-pressed={value}>Lo recibe ahora</button>
    <button type="button" className={`btn btn-sm${!value ? ' on' : ''}`} onClick={() => onChange(false)} aria-pressed={!value}>Queda pendiente</button>
  </div>
)
const CloseModal = ({ session, summary, admin, onClose, onDone }) => {
  const [counted, setCounted] = useState('')
  // Transferencias (TD-017): se confirma en la cuenta o el celular que llegaron. Las que no se revisen quedan por verificar.
  const transfers = useSessionTransfers(session.id)
  const [toastTr, toastTrNode] = useToast()
  const [pendingOk, setPendingOk] = useState(false)
  const trPending = transfers.totals?.pendiente || { count: 0, amount: 0 }
  const [nextFloat, setNextFloat] = useState(session.openingAmount || '')
  const [note, setNote] = useState('')
  // Domiciliarios: su parte de los domicilios cobrados en el turno. Sus propinas se pagan en Caja → Propinas.
  const [cour, setCour] = useState(null)
  const [courPay, setCourPay] = useState({})
  const [courNow, setCourNow] = useState({})
  // Empleados que se pagan por turno: horas × valor de la hora; pagar ahora o dejar pendiente.
  const [crew, setCrew] = useState(null)
  const [shifts, setShifts] = useState({})
  const [showCrew, setShowCrew] = useState(false)
  const [force, setForce] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    api.get(`/caja/turnos/${session.id}/domiciliarios`).then(({ data }) => {
      setCour(data); setCourPay(Object.fromEntries(data.rows.map((r) => [r.userId, r.suggested])))
    }).catch(() => setCour({ rows: [], total: 0 }))
    api.get(`/caja/turnos/${session.id}/personal`).then(({ data }) => {
      setCrew(data)
      setShifts(Object.fromEntries(data.employees.filter((x) => x.worked).map((x) => [x.id, { hours: data.hours, amount: Math.round(data.hours * x.hourRate), now: true }])))
    }).catch(() => setCrew({ hours: 0, employees: [] }))
  }, [session.id])
  // Por horas: horas × valor de la hora + horas extra × valor de la hora extra. Valor fijo: se escribe el valor.
  const num = (v) => Number(String(v ?? '').replace(',', '.')) || 0
  const shiftAmount = (x, v) => (v.fixed ? v.amount : Math.round(num(v.hours) * x.hourRate + num(v.extra) * (x.overtimeRate || x.hourRate)))
  const newShift = (x) => ({ hours: crew.hours, extra: '', fixed: false, amount: Math.round(crew.hours * x.hourRate), now: true })
  const toggleShift = (x) => setShifts((t) => { const n = { ...t }; if (n[x.id]) delete n[x.id]; else n[x.id] = newShift(x); return n })
  const patchShift = (x, patch) => setShifts((t) => { const v = { ...t[x.id], ...patch }; return { ...t, [x.id]: { ...v, amount: shiftAmount(x, v) } } })
  const staffNow = Object.values(shifts).filter((v) => v.now).reduce((a, v) => a + (Number(v.amount) || 0), 0)
  const staffLater = Object.values(shifts).filter((v) => !v.now).reduce((a, v) => a + (Number(v.amount) || 0), 0)
  const crewShown = crew ? crew.employees.filter((x) => showCrew || x.worked || shifts[x.id]) : []
  const courTotal = Object.entries(courPay).filter(([id]) => courNow[id] !== false).reduce((a, [, v]) => a + (Number(v) || 0), 0)
  const courLater = Object.entries(courPay).filter(([id]) => courNow[id] === false).reduce((a, [, v]) => a + (Number(v) || 0), 0)
  const cnt = counted === '' ? null : Number(counted)
  const diff = cnt === null ? null : cnt - summary.expectedCash
  const toVault = cnt === null ? null : cnt - courTotal - staffNow - (Number(nextFloat) || 0)
  const submit = async (e) => {
    e.preventDefault(); setError('')
    if (cnt === null) return setError('Cuenta el efectivo y escribe el total.')
    if (toVault < 0) return setError('El efectivo contado no alcanza para lo que se paga ahora (domiciliarios y turnos) y la base. Deja algún pago pendiente o ajusta la base.')
    if (trPending.count && !pendingOk) {
      setPendingOk(true)
      return setError(`Quedan ${trPending.count} transferencia${trPending.count === 1 ? '' : 's'} por verificar (${formatMoney(trPending.amount)}). Si cierras así, quedan pendientes en Caja → Transferencias para revisarlas después.`)
    }
    setSaving(true)
    try {
      const { data } = await api.post(`/caja/turnos/${session.id}/cerrar`, { countedCash: cnt, nextFloat: Number(nextFloat) || 0, couriers: Object.entries(courPay).filter(([, v]) => Number(v) > 0).map(([userId, amount]) => ({ userId: Number(userId), amount: Number(amount), payNow: courNow[userId] !== false })),
        staff: Object.entries(shifts).filter(([, v]) => Number(v.amount) > 0).map(([userId, v]) => { const x = crew.employees.find((e) => e.id === Number(userId)); return { userId: Number(userId), hours: num(v.hours) || null, extraHours: v.fixed ? null : num(v.extra) || null, rate: x?.hourRate, extraRate: x?.overtimeRate || x?.hourRate, fixed: v.fixed, amount: Number(v.amount), payNow: v.now } }),
        note, force })
      onDone(data)
    } catch (err) {
      const msg = errorMessage(err); setError(msg); setSaving(false)
      if (/pedidos? abiertos?/.test(msg)) setForce(true)
    }
  }
  return (
    <Modal size="xl" title={`Cerrar turno ${session.number} · ${session.register}`} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="close-cash" className="btn btn-primary" disabled={saving}>{saving ? <Spinner /> : <MdLock />} {force ? 'Cerrar igualmente' : pendingOk && trPending.count ? 'Cerrar con transferencias pendientes' : 'Cerrar turno'}</button></>}>
      <form id="close-cash" className="close-grid" onSubmit={submit} noValidate>
        <section className="close-step">
          <h4><span>1</span> Arqueo</h4>
          <div className="arqueo-sales">
            <div className="row-between"><strong>Cobrado en el turno</strong><small className="muted">{summary.orders} pedido{summary.orders === 1 ? '' : 's'}</small></div>
            {!summary.byMethod.length ? <small className="muted">No hubo cobros en este turno.</small> : (
              <dl className="order-totals" style={{ margin: 0 }}>
                {[...summary.byMethod].sort((a, b) => (a.method === 'efectivo' ? -1 : b.method === 'efectivo' ? 1 : b.amount - a.amount)).map((x) => (
                  <div key={x.method} className="pay-line"><dt><span>{x.label || x.method}</span>{x.method !== 'efectivo' && <small className="pay-note"><span>No entra a la caja</span>{TRANSFER_METHODS.includes(x.method) && transfers.rows && <TransferDot rows={transfers.rows.filter((t) => t.method === x.method)} />}</small>}</dt><dd>{formatMoney(x.amount)}</dd></div>
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
            {summary.courierFloats ? <div><dt>Bases de domiciliarios (salida − devolución)</dt><dd>{formatMoney(summary.courierFloats)}</dd></div> : null}
            {(summary.tipsPaid || 0) + (summary.couriersPaid || 0) + (summary.staffPaid || 0) > 0 ? <div><dt>Pagos al personal y propinas</dt><dd>−{formatMoney((summary.tipsPaid || 0) + (summary.couriersPaid || 0) + (summary.staffPaid || 0))}</dd></div> : null}
            <div className="total"><dt>Efectivo esperado</dt><dd>{formatMoney(summary.expectedCash)}</dd></div>
          </dl>
          <Field label="Efectivo contado en la caja" htmlFor="cc" required><MoneyInput id="cc" value={counted} onChange={setCounted} autoFocus /></Field>
          {diff !== null && <div className={`alert ${diff === 0 ? 'ok' : diff > 0 ? 'warn' : 'bad'}`}>{diff === 0 ? 'La caja cuadra exacto.' : diff > 0 ? `Sobrante de ${formatMoney(diff)}.` : `Faltante de ${formatMoney(-diff)}.`}</div>}
        </section>

        <section className="close-step">
          <h4><span>2</span> Pagos al personal</h4>
          <div className="alert info tip-later">
            <MdVolunteerActivism aria-hidden="true" />
            <span>Los clientes dejaron <strong>{formatMoney(summary.tips)}</strong> de propina en este turno. Las propinas ya no se pagan al cerrar: quedan acumuladas y se pagan cuando se quiera en <Link to="/propinas">Pagos al personal</Link>.</span>
          </div>
          {cour?.rows.length > 0 && (
            <div className="courier-close">
              <h5>🛵 Domiciliarios <small className="muted">· {cour.rule.mode === 'todo' ? 'les toca todo el domicilio' : `les toca el ${cour.rule.percent} % del domicilio`} · sus propinas se pagan en Pagos al personal</small></h5>
              <ul className="tip-list">{cour.rows.map((r) => (
                <li key={r.userId} className="on">
                  <span><strong>{r.name}</strong><small className="block muted">{r.deliveries} domicilio{r.deliveries === 1 ? '' : 's'} · {formatMoney(r.share)} de {formatMoney(r.fees)} en domicilios{r.tips > 0 ? ` · ${formatMoney(r.tips)} de propina, se pagan aparte` : ''}</small></span>
                  <div className="pay-row">
                    <MoneyInput id={`cour-${r.userId}`} value={courPay[r.userId] ?? ''} onChange={(v) => setCourPay((t) => ({ ...t, [r.userId]: v }))} aria-label={`Pago a ${r.name}`} />
                    <PayNow name={r.name} value={courNow[r.userId] !== false} onChange={(v) => setCourNow((t) => ({ ...t, [r.userId]: v }))} />
                  </div>
                </li>
              ))}</ul>
              <div className="row-between"><span className="muted">Se pagan ahora en efectivo{courLater ? ` · ${formatMoney(courLater)} pendientes` : ''}</span><strong className="money">{formatMoney(courTotal)}</strong></div>
              {cour.businessShare > 0 && <small className="muted">Al negocio le quedan {formatMoney(cour.businessShare)} de los domicilios.</small>}
            </div>
          )}
          {crew?.employees.length > 0 && (
            <div className="courier-close">
              <h5>🕒 Turnos <small className="muted">· por horas (horas × valor de la hora + horas extra) o un valor fijo</small></h5>
              <ul className="tip-list">{crewShown.map((x) => {
                const v = shifts[x.id]
                return (
                  <li key={x.id} className={v ? 'on' : ''}>
                    <label className="check"><input type="checkbox" checked={Boolean(v)} onChange={() => toggleShift(x)} /> <span><strong>{x.name}</strong><small className="block muted">{formatMoney(x.hourRate)} la hora{x.overtimeRate ? ` · ${formatMoney(x.overtimeRate)} la extra` : ''}{x.positions.length ? ` · ${x.positions.join(', ')}` : ''}</small></span></label>
                    {v && <>
                      <div className="seg pay-now" role="group" aria-label={`Cómo se paga el turno de ${x.name}`}>
                        <button type="button" className={`btn btn-sm${!v.fixed ? ' on' : ''}`} onClick={() => patchShift(x, { fixed: false })} aria-pressed={!v.fixed}>Por horas</button>
                        <button type="button" className={`btn btn-sm${v.fixed ? ' on' : ''}`} onClick={() => patchShift(x, { fixed: true })} aria-pressed={v.fixed}>Valor fijo</button>
                      </div>
                      <div className="pay-row">
                        {!v.fixed && <>
                          <label className="input-prefix hours-in" title="Horas del turno"><input inputMode="decimal" value={v.hours} onChange={(e) => patchShift(x, { hours: e.target.value })} aria-label={`Horas de ${x.name}`} /><i aria-hidden="true">h</i></label>
                          <label className="input-prefix hours-in extra" title="Horas extra"><span>+</span><input inputMode="decimal" value={v.extra} placeholder="0" onChange={(e) => patchShift(x, { extra: e.target.value })} aria-label={`Horas extra de ${x.name}`} /><i aria-hidden="true">h ext.</i></label>
                          <strong className="money shift-total">{formatMoney(v.amount)}</strong>
                        </>}
                        {v.fixed && <MoneyInput id={`shift-${x.id}`} value={v.amount} onChange={(a) => setShifts((t) => ({ ...t, [x.id]: { ...t[x.id], amount: a } }))} aria-label={`Valor fijo del turno de ${x.name}`} />}
                      </div>
                      {!v.fixed && num(v.extra) > 0 && <small className="muted">{num(v.hours)} h × {formatMoney(x.hourRate)} + {num(v.extra)} h extra × {formatMoney(x.overtimeRate || x.hourRate)}{x.overtimeRate ? '' : ' (sin valor de hora extra configurado, se usa el normal)'}</small>}
                      <PayNow name={x.name} value={v.now} onChange={(now) => setShifts((t) => ({ ...t, [x.id]: { ...t[x.id], now } }))} />
                    </>}
                  </li>
                )
              })}</ul>
              {crew.employees.length > crewShown.length && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCrew(true)}>Ver todos los que se pagan por turno ({crew.employees.length})</button>}
              <div className="row-between"><span className="muted">Se pagan ahora en efectivo{staffLater ? ` · ${formatMoney(staffLater)} pendientes` : ''}</span><strong className="money">{formatMoney(staffNow)}</strong></div>
            </div>
          )}
          {(courLater + staffLater) > 0 && <small className="muted">Lo pendiente ({formatMoney(courLater + staffLater)}) se paga después en <Link to="/propinas?tab=pendientes">Pagos al personal</Link>.</small>}
        </section>

        <section className="close-step">
          <h4><span>3</span> ¿A dónde va el efectivo?</h4>
          <Field label="Queda en la caja para el próximo turno" htmlFor="cf" hint="Base para dar cambio mañana"><MoneyInput id="cf" value={nextFloat} onChange={setNextFloat} /></Field>
          <div className={`vault-box${toVault !== null && toVault < 0 ? ' bad' : ''}`}>
            <span>Pasa a la bóveda</span>
            <strong>{toVault === null ? '—' : formatMoney(toVault)}</strong>
            <small>{cnt === null ? 'Escribe el efectivo contado' : `${formatMoney(cnt)} contado${staffNow ? ` − ${formatMoney(staffNow)} turnos` : ''}${courTotal ? ` − ${formatMoney(courTotal)} domiciliarios` : ''} − ${formatMoney(Number(nextFloat) || 0)} base`}</small>
          </div>
          <Field label="Observaciones del cierre" htmlFor="cn"><textarea id="cn" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. faltante por un billete falso, se pagó el hielo con caja" /></Field>
        </section>
        {transfers.rows?.length > 0 && (
          <section className="close-step close-full">
            <h4><span>✓</span> Transferencias <small className="muted">· no entran a la caja: revisa la cuenta o el celular y marca si llegaron{transfers.totals ? ` · ${transferSummaryText(transfers.totals)}` : ''}</small></h4>
            <SessionTransfers data={transfers} canEdit admin={admin} toast={toastTr} />
          </section>
        )}
        {error && <div className={`alert ${pendingOk && trPending.count && /por verificar/.test(error) ? 'warn' : 'bad'} close-full`}>{error}</div>}
      </form>
      {toastTrNode}
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
        <div className="alert warn">Al reabrir se anula el cierre: vuelven a la caja los {formatMoney(snap.toVault)} que pasaron a la bóveda, {snap.tipsPaid > 0 ? `las propinas pagadas en ese cierre (${formatMoney(snap.tipsPaid)}), ` : ''}lo pagado a los domiciliarios y por turnos en ese cierre, y la base que quedaba. Lo pagado en Pagos al personal no se anula. Corrige lo necesario y cierra el turno de nuevo.</div>
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
        {m.courtesies > 0 && <Kpi label="Cortesías" value={formatMoney(m.courtesies)} note={m.courtesyCost > 0 ? `Costo ${formatMoney(m.courtesyCost)}` : 'a precio de venta'} />}
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
      {m.courtesyItems?.length > 0 && (
        <Card title="Cortesías del turno" subtitle="No se cobraron, pero salieron del inventario: es el valor que asume el establecimiento" flush>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Pedido</th><th>Producto</th><th className="num">Precio de venta</th><th className="num">Costo</th></tr></thead>
            <tbody>{m.courtesyItems.map((x) => (
              <tr key={x.id}><td><Link to={`/pedidos/${x.orderId}`}>{x.order}</Link></td>
                <td>{x.quantity} × {x.name}{x.reason && <small className="block muted">🎁 {x.reason}</small>}</td>
                <td className="num money">{formatMoney(x.value)}</td><td className="num money">{formatMoney(x.cost)}</td></tr>
            ))}</tbody>
            <tfoot><tr><th colSpan={2}>Total asumido</th><th className="num money">{formatMoney(m.courtesies)}</th><th className="num money">{formatMoney(m.courtesyCost)}</th></tr></tfoot>
          </table></div>
        </Card>
      )}
      <SessionTransfersCard key={`tr-${s.status}-${ver}`} sessionId={s.id} open={open} canEdit admin={admin} />
      <ShiftExpensesCard session={s} version={ver} open={open && canClose} onExpense={(info) => setModal({ expense: info })} onRequest={(initial) => setModal({ request: initial || {} })} />
      {modal?.expense && <ShiftExpenseModal session={s} info={modal.expense} admin={admin} onClose={() => setModal(null)} onAskFunds={(initial) => setModal({ request: initial })} onDone={(d) => { setModal(null); toast(`Gasto ${d.number} registrado`); setVer((v) => v + 1); load() }} />}
      {modal?.request && <FundsRequestModal session={s} initial={modal.request} onClose={() => setModal(null)} onDone={(d) => { setModal(null); toast(`Solicitud ${d.number} enviada al administrador`); setVer((v) => v + 1) }} />}
      {modal === 'move' && <MoveModal session={s} admin={admin} onClose={() => setModal(null)} onDone={(t) => { setModal(null); toast(t === 'ingreso' ? 'Ingreso registrado' : 'Egreso registrado'); load() }} />}
      {modal === 'close' && <CloseModal session={s} summary={m} admin={admin} onClose={() => { setModal(null); setVer((v) => v + 1) }} onDone={(d) => { setModal(null); setS(d); load(); setVer((v) => v + 1); toast(`Turno ${d.number} cerrado`); onChanged() }} />}
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
  const [tab, setTab] = useState(params.get('tab') === 'transferencias' ? 'transferencias' : ['boveda', 'solicitudes', 'reaperturas'].includes(params.get('tab')) && admin ? params.get('tab') : 'turno')
  const [trPending, setTrPending] = useState(0)
  useEffect(() => { api.get('/caja/transferencias').then(({ data }) => setTrPending(data.totals.pendiente.count)).catch(() => {}) }, [])
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
      <Tabs value={tab} onChange={(t) => { setTab(t); if (t === 'turno') setCurrent(null) || load() }} tabs={[['turno', 'Turnos'], ['historial', 'Historial'], ['transferencias', trPending ? `Transferencias (${trPending})` : 'Transferencias'], ...(admin ? [['solicitudes', pending ? `Solicitudes (${pending})` : 'Solicitudes'], ['reaperturas', reopenPending ? `Reabrir turnos (${reopenPending})` : 'Reabrir turnos'], ['boveda', 'Bóveda']] : [])]} />
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
      {tab === 'transferencias' && <TransfersTab admin={admin} onCount={setTrPending} />}
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
