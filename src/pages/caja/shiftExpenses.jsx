import React, { useCallback, useEffect, useState } from 'react'
import { MdShoppingCart, MdPanTool, MdCheck, MdClose, MdAccountBalance } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { Badge, Card, Empty, Field, Modal, Spinner } from '../../components/ui'
import { MoneyInput } from '../../components/forms'
import { formatDateTime, formatMoney } from '../../utils/format'
import SupplierField from '../../components/SupplierField'

// =====================================================================
// Gastos del turno (hielo, limones, un domicilio): salen del efectivo de la caja abierta y quedan como
// gasto en Finanzas. Cada gasto tiene un tope; para compras mayores se piden recursos al administrador,
// que los aprueba desde el fondo de la sucursal (o el general) y entran a la caja.
// =====================================================================
const NO_SITE = { params: { sede: undefined } }
const REQ_TONE = { pendiente: 'warn', aprobada: 'ok', rechazada: 'bad' }

export const ShiftExpenseModal = ({ session, info, admin, onClose, onDone, onAskFunds }) => {
  const [f, setF] = useState({ category: 'insumos', description: '', supplierId: null, supplier: '', amount: '' })
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v?.target ? v.target.value : v }))
  const over = !admin && info.limit > 0 && Number(f.amount) > info.limit
  const submit = async (e) => {
    e.preventDefault(); setError(''); setSaving(true)
    try { const { data } = await api.post(`/caja/turnos/${session.id}/gastos`, f, NO_SITE); onDone(data) } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  return (
    <Modal title="Gasto del turno" onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button>
        {over ? <button type="button" className="btn btn-primary" onClick={() => onAskFunds({ amount: f.amount, reason: f.description })}><MdPanTool /> Pedir recursos</button>
          : <button type="submit" form="sx-form" className="btn btn-primary" disabled={saving}>{saving ? <Spinner /> : <MdShoppingCart />} Registrar gasto</button>}</>}>
      <form id="sx-form" className="form-grid" onSubmit={submit} noValidate>
        <div className="span-2 chip-list">{Object.entries(info.categories).map(([k, l]) => <button key={k} type="button" className={`pchip${f.category === k ? ' on' : ''}`} onClick={() => set('category')(k)}>{l}</button>)}</div>
        <div className="span-2"><Field label="¿Qué se compró o pagó?" htmlFor="sxd" required><input id="sxd" value={f.description} onChange={set('description')} placeholder="Ej. 2 bolsas de hielo" autoFocus /></Field></div>
        <Field label="Valor" htmlFor="sxa" required hint={info.limit > 0 ? `Tope por gasto: ${formatMoney(info.limit)}` : null}><MoneyInput id="sxa" value={f.amount} onChange={set('amount')} /></Field>
        <SupplierField id="sxs" label="Proveedor o dónde (opcional)" value={f} onChange={(v) => setF((x) => ({ ...x, ...v }))} allowFree />
        {over && <div className="alert warn span-2">Supera el tope de {formatMoney(info.limit)} por gasto. Pide los recursos al administrador: cuando los apruebe entran a esta caja.</div>}
        <small className="muted span-2">Sale del efectivo de la caja y queda como gasto en Finanzas. No entra al inventario.</small>
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>
  )
}

export const FundsRequestModal = ({ session, initial, onClose, onDone }) => {
  const [f, setF] = useState({ amount: initial?.amount || '', reason: initial?.reason || '' })
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setError(''); setSaving(true)
    try { const { data } = await api.post(`/caja/turnos/${session.id}/solicitudes`, f, NO_SITE); onDone(data) } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  return (
    <Modal title="Pedir recursos al administrador" onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="fr-form" className="btn btn-primary" disabled={saving}>{saving ? <Spinner /> : <MdPanTool />} Enviar solicitud</button></>}>
      <form id="fr-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="¿Cuánto necesitas?" htmlFor="fra" required><MoneyInput id="fra" value={f.amount} onChange={(v) => setF((x) => ({ ...x, amount: v }))} autoFocus /></Field>
        <div />
        <div className="span-2"><Field label="¿Para qué?" htmlFor="frr" required><input id="frr" value={f.reason} onChange={(e) => setF((x) => ({ ...x, reason: e.target.value }))} placeholder="Ej. compra de licor para el fin de semana" /></Field></div>
        <small className="muted span-2">El administrador recibe el aviso. Si la aprueba, el dinero entra a esta caja ({session.register} · {session.number}).</small>
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>
  )
}

// Tarjeta del turno con sus gastos y solicitudes.
export const ShiftExpensesCard = ({ session, version, open, onExpense, onRequest }) => {
  const [d, setD] = useState(null)
  useEffect(() => { api.get(`/caja/turnos/${session.id}/gastos`, NO_SITE).then(({ data }) => setD(data)).catch(() => setD({ limit: 0, categories: {}, expenses: [], requests: [] })) }, [session.id, version])
  if (!d) return null
  const total = d.expenses.filter((e) => e.status === 'activo').reduce((a, e) => a + e.amount, 0)
  return (
    <Card title="Gastos del turno" subtitle={total ? `${formatMoney(total)} en ${d.expenses.length} gasto${d.expenses.length === 1 ? '' : 's'}${d.limit ? ` · tope ${formatMoney(d.limit)} por gasto` : ''}` : d.limit ? `Tope ${formatMoney(d.limit)} por gasto` : null} icon={<MdShoppingCart />} flush
      actions={open && <div className="card-actions"><button type="button" className="btn btn-sm" onClick={() => onRequest(null)}><MdPanTool /> Pedir recursos</button><button type="button" className="btn btn-sm btn-primary" onClick={() => onExpense(d)}><MdShoppingCart /> Gasto</button></div>}>
      {!d.expenses.length && !d.requests.length ? <Empty icon={<MdShoppingCart />}>Registra aquí el hielo, los limones o un domicilio pagado con el efectivo de la caja.</Empty> : (
        <ul className="list padded">
          {d.requests.map((r) => (
            <li key={`r${r.id}`}>
              <span><MdPanTool /> <strong>Solicitud {r.number}</strong> <small>{r.reason}{r.resolution ? ` · ${r.resolution}` : ''}</small></span>
              <span className="row" style={{ gap: 8 }}><Badge tone={REQ_TONE[r.status]}>{r.statusLabel}</Badge><b className="money">{formatMoney(r.approvedAmount ?? r.amount)}</b></span>
            </li>
          ))}
          {d.expenses.map((e) => (
            <li key={e.id} className={e.status === 'anulado' ? 'voided' : ''}>
              <span><strong>{e.description}</strong> <small>{e.number} · {e.categoryLabel}{e.supplier ? ` · ${e.supplier}` : ''} · {formatDateTime(e.createdAt)}</small></span>
              <b className="money text-bad">−{formatMoney(e.amount)}</b>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// Pestaña del administrador: solicitudes de recursos de las cajas.
const ApproveModal = ({ req, onClose, onDone }) => {
  const [f, setF] = useState({ amount: req.amount, fromGeneral: req.siteFund < req.amount && req.generalFund >= req.amount, note: '' })
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const fund = f.fromGeneral ? req.generalFund : req.siteFund
  const submit = async (e) => {
    e.preventDefault(); setError(''); setSaving(true)
    try { await api.post(`/caja/solicitudes/${req.id}/aprobar`, f, NO_SITE); onDone() } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  return (
    <Modal title={`Aprobar ${req.number}`} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="ap-form" className="btn btn-primary" disabled={saving || Number(f.amount) > fund}>{saving ? <Spinner /> : <MdCheck />} Aprobar y enviar a la caja</button></>}>
      <form id="ap-form" className="form-grid" onSubmit={submit} noValidate>
        <p className="span-2 muted" style={{ margin: 0 }}>{req.requestedBy} pide {formatMoney(req.amount)} para {req.register} ({req.session}): {req.reason}</p>
        <Field label="Valor que se aprueba" htmlFor="apa"><MoneyInput id="apa" value={f.amount} onChange={(v) => setF((x) => ({ ...x, amount: v }))} /></Field>
        <Field label="Sale del fondo" htmlFor="apf">
          <select id="apf" value={f.fromGeneral ? 'g' : 's'} onChange={(e) => setF((x) => ({ ...x, fromGeneral: e.target.value === 'g' }))}>
            <option value="s">{req.site} · {formatMoney(req.siteFund)}</option>
            <option value="g">Fondo general · {formatMoney(req.generalFund)}</option>
          </select>
        </Field>
        {Number(f.amount) > fund && <div className="alert warn span-2">El fondo no alcanza. Ingresa dinero en Finanzas o elige el otro fondo.</div>}
        <div className="span-2"><Field label="Nota (opcional)" htmlFor="apn"><input id="apn" value={f.note} onChange={(e) => setF((x) => ({ ...x, note: e.target.value }))} /></Field></div>
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>
  )
}

export const RequestsTab = ({ onCount }) => {
  const [d, setD] = useState(null)
  const [estado, setEstado] = useState('pendiente')
  const [modal, setModal] = useState(null)
  const [reject, setReject] = useState({ id: null, note: '' })
  const [error, setError] = useState('')
  const load = useCallback(() => api.get('/caja/solicitudes', { params: { estado: estado || undefined } }).then(({ data }) => { setD(data); if (estado === 'pendiente') onCount?.(data.pending) }).catch((e) => setError(errorMessage(e))), [estado, onCount])
  useEffect(() => { load() }, [load])
  const doReject = async (r) => {
    setError('')
    try { await api.post(`/caja/solicitudes/${r.id}/rechazar`, { note: reject.note }, NO_SITE); setReject({ id: null, note: '' }); load() } catch (e) { setError(errorMessage(e)) }
  }
  return (
    <div className="stack">
      <div className="chip-list">{[['pendiente', 'Pendientes'], ['aprobada', 'Aprobadas'], ['rechazada', 'Rechazadas'], ['', 'Todas']].map(([k, l]) => <button key={k} type="button" className={`pchip${estado === k ? ' on' : ''}`} onClick={() => setEstado(k)}>{l}</button>)}</div>
      {error && <div className="alert bad">{error}</div>}
      <Card title="Solicitudes de recursos" subtitle="Lo que piden las cajas para compras que superan el tope por gasto" icon={<MdPanTool />} flush>
        {!d ? <Spinner /> : !d.rows.length ? <Empty icon={<MdPanTool />}>No hay solicitudes {estado ? `${estado}s` : ''}.</Empty> : (
          <ul className="list padded">{d.rows.map((r) => (
            <li key={r.id} className="req-row">
              <div className="grow">
                <strong>{formatMoney(r.amount)} · {r.reason}</strong>
                <small className="block muted">{r.number} · {r.register} ({r.session}) · {r.site} · {r.requestedBy} · {formatDateTime(r.createdAt)}</small>
                {r.status !== 'pendiente' && <small className="block muted">{r.statusLabel} por {r.resolvedBy}{r.approvedAmount !== null ? ` · ${formatMoney(r.approvedAmount)} desde ${r.fromGeneral ? 'el fondo general' : 'el fondo de la sucursal'}` : ''}{r.resolution ? ` · ${r.resolution}` : ''}</small>}
                {reject.id === r.id && (
                  <div className="row" style={{ gap: 6, marginTop: 8 }}>
                    <input value={reject.note} onChange={(e) => setReject((x) => ({ ...x, note: e.target.value }))} placeholder="Motivo del rechazo" aria-label="Motivo del rechazo" autoFocus />
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => doReject(r)} disabled={!reject.note.trim()}>Rechazar</button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => setReject({ id: null, note: '' })}>Cancelar</button>
                  </div>
                )}
              </div>
              {r.status === 'pendiente' ? (r.sessionOpen ? (
                <div className="row" style={{ gap: 6 }}>
                  <button type="button" className="btn btn-sm" onClick={() => setReject({ id: r.id, note: '' })}><MdClose /> Rechazar</button>
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => setModal(r)}><MdAccountBalance /> Aprobar</button>
                </div>
              ) : <Badge>Turno cerrado</Badge>) : <Badge tone={REQ_TONE[r.status]}>{r.statusLabel}</Badge>}
            </li>
          ))}</ul>
        )}
      </Card>
      {modal && <ApproveModal req={modal} onClose={() => setModal(null)} onDone={() => { setModal(null); load() }} />}
    </div>
  )
}
