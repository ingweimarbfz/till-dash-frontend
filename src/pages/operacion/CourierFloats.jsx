import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MdAdd, MdPayments, MdCheckCircle, MdPointOfSale } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { Badge, Card, Empty, Field, Modal, Spinner, useToast } from '../../components/ui'
import { MoneyInput } from '../../components/forms'
import { formatDateTime, formatMoney } from '../../utils/format'

// ---------- Dar base ----------
const GiveModal = ({ couriers, busyIds, onClose, onDone }) => {
  const [courierId, setCourierId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const free = couriers.filter((c) => !busyIds.includes(c.id))
  const submit = async (e) => {
    e.preventDefault(); setError('')
    if (!courierId) return setError('Elige el domiciliario.')
    if (!(Number(amount) > 0)) return setError('Escribe el valor de la base.')
    setSaving(true)
    try { await api.post('/domicilios/bases', { courierId: Number(courierId), amount: Number(amount), note }); onDone() } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  return (
    <Modal title="Dar base de cambio" onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="give-float" className="btn btn-primary" disabled={saving}>{saving ? <Spinner /> : <MdPayments />} Entregar base</button></>}>
      <form id="give-float" className="stack" style={{ gap: 12 }} onSubmit={submit} noValidate>
        <p className="muted" style={{ margin: 0 }}>Sale del efectivo de la caja. Al final de la jornada el domiciliario devuelve la base más lo que cobró en efectivo de sus domicilios.</p>
        <Field label="Domiciliario" htmlFor="gfc" required>
          <select id="gfc" value={courierId} onChange={(e) => setCourierId(e.target.value)} autoFocus>
            <option value="">Elige…</option>
            {free.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        {free.length < couriers.length && <small className="muted">Los que ya tienen una base sin liquidar no aparecen.</small>}
        <Field label="Valor de la base" htmlFor="gfa" required><MoneyInput id="gfa" value={amount} onChange={setAmount} /></Field>
        <div className="chip-list">{[20000, 50000, 100000].map((v) => <button key={v} type="button" className={`pchip${Number(amount) === v ? ' on' : ''}`} onClick={() => setAmount(v)}>{formatMoney(v)}</button>)}</div>
        <Field label="Nota" htmlFor="gfn"><input id="gfn" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. billetes de $2.000 y $5.000" /></Field>
        {error && <div className="alert bad">{error}</div>}
      </form>
    </Modal>
  )
}

// ---------- Liquidar base ----------
const SettleModal = ({ f, onClose, onDone, onChanged }) => {
  const [returned, setReturned] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const unpaid = f.orders.filter((o) => !o.paid)
  const expected = f.amount + f.ordersCash
  const diff = returned === '' ? null : Number(returned) - expected
  // Cobra en efectivo un domicilio que el domiciliario trae pagado, en el turno donde salió la base.
  const charge = async (o) => {
    setBusy(`c${o.id}`); setError('')
    try { await api.post(`/pedidos/${o.id}/cobrar`, { sessionId: f.sessionId, tip: 0, payments: [{ method: 'efectivo', amount: o.total }] }); onChanged() } catch (err) { setError(errorMessage(err)) } finally { setBusy('') }
  }
  const submit = async (e) => {
    e.preventDefault(); setError('')
    if (unpaid.length) return setError('Primero cobra los domicilios que trae pagados.')
    if (returned === '') return setError('Escribe cuánto dinero entregó.')
    setBusy('save')
    try { await api.post(`/domicilios/bases/${f.id}/liquidar`, { returned: Number(returned), note }); onDone() } catch (err) { setError(errorMessage(err)); setBusy('') }
  }
  return (
    <Modal size="lg" title={`Liquidar base de ${f.name}`} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="settle-float" className="btn btn-primary" disabled={!!busy || unpaid.length > 0}>{busy === 'save' ? <Spinner /> : <MdCheckCircle />} Liquidar</button></>}>
      <form id="settle-float" className="stack" style={{ gap: 14 }} onSubmit={submit} noValidate>
        <div>
          <strong className="label-sm">Domicilios en efectivo</strong>
          {!f.orders.length ? <p className="muted" style={{ margin: '6px 0 0' }}>No tiene domicilios en efectivo desde que recibió la base.</p> : (
            <ul className="list">{f.orders.map((o) => (
              <li key={o.id}>
                <span><Link to={`/pedidos/${o.id}`}><strong>{o.number}</strong></Link> <small className="muted">{o.customerName || ''} · {o.address}</small></span>
                {o.paid ? <span className="row" style={{ gap: 8 }}><Badge tone="ok">Cobrado</Badge><b className="money">{formatMoney(o.cash)}</b></span>
                  : <button type="button" className="btn btn-sm btn-primary" disabled={!!busy} onClick={() => charge(o)}>{busy === `c${o.id}` ? <Spinner /> : <MdPointOfSale />} Cobrar {formatMoney(o.total)} en efectivo</button>}
              </li>
            ))}</ul>
          )}
        </div>
        <dl className="order-totals" style={{ margin: 0 }}>
          <div><dt>Base entregada</dt><dd>{formatMoney(f.amount)}</dd></div>
          <div><dt>Efectivo de sus domicilios</dt><dd>{formatMoney(f.ordersCash)}</dd></div>
          {unpaid.length > 0 && <div><dt>Sin cobrar todavía</dt><dd className="text-warn">{formatMoney(f.unpaid)}</dd></div>}
          <div className="total"><dt>Debe entregar</dt><dd>{formatMoney(expected + (f.unpaid || 0))}</dd></div>
        </dl>
        <Field label="Dinero que entregó" htmlFor="sfr" required><MoneyInput id="sfr" value={returned} onChange={setReturned} /></Field>
        {!unpaid.length && <button type="button" className="btn btn-sm btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setReturned(expected)}>Entregó completo: {formatMoney(expected)}</button>}
        {diff !== null && !unpaid.length && <div className={`alert ${diff === 0 ? 'ok' : diff > 0 ? 'warn' : 'bad'}`}>{diff === 0 ? 'Cuadra exacto.' : diff > 0 ? `Sobrante de ${formatMoney(diff)}.` : `Faltante de ${formatMoney(-diff)}.`}</div>}
        <Field label="Observaciones" htmlFor="sfn"><input id="sfn" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        {error && <div className="alert bad">{error}</div>}
      </form>
    </Modal>
  )
}

// ---------- Tarjeta de bases (Domicilios) ----------
export const FloatsCard = ({ couriers, canManage, mine, version, onChanged }) => {
  const [toast, toastNode] = useToast()
  const [rows, setRows] = useState(null)
  const [modal, setModal] = useState(null)
  const load = useCallback(() => api.get('/domicilios/bases').then(({ data }) => setRows(data.rows)).catch(() => setRows([])), [])
  useEffect(() => { load() }, [load, version])
  if (rows === null) return null
  const open = rows.filter((r) => r.status === 'abierta')
  const settled = rows.filter((r) => r.status === 'liquidada')
  if (mine && !rows.length) return null
  const current = modal?.settle ? open.find((r) => r.id === modal.settle) : null
  return (
    <Card title={mine ? 'Mi base de cambio' : 'Bases de cambio'} icon={<MdPayments />} subtitle={mine ? 'Al final de la jornada entregas la base más el efectivo de tus domicilios' : 'Dinero para dar cambio; se liquida con lo que traen de los domicilios'}
      actions={canManage && couriers.length > 0 ? <button type="button" className="btn btn-sm btn-primary" onClick={() => setModal('give')}><MdAdd /> Dar base</button> : null} flush>
      {toastNode}
      {!open.length && !settled.length ? <Empty icon={<MdPayments />}>Nadie tiene base hoy.</Empty> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Domiciliario</th><th className="num">Base</th><th className="num">Efectivo cobrado</th><th className="num hide-sm">Sin cobrar</th><th className="num">Debe entregar</th><th /></tr></thead>
          <tbody>
            {open.map((r) => (
              <tr key={r.id}>
                <td><strong>{r.name}</strong><small className="block muted">Desde {formatDateTime(r.createdAt)} · {r.session}</small></td>
                <td className="num money">{formatMoney(r.amount)}</td>
                <td className="num money">{formatMoney(r.ordersCash)}</td>
                <td className={`num money hide-sm${r.unpaid ? ' text-warn' : ''}`}>{formatMoney(r.unpaid)}</td>
                <td className="num money"><b>{formatMoney(r.toReturn)}</b></td>
                <td>{canManage && <button type="button" className="btn btn-sm" onClick={() => setModal({ settle: r.id })}>Liquidar</button>}</td>
              </tr>
            ))}
            {settled.map((r) => (
              <tr key={r.id} className="muted">
                <td>{r.name} <Badge tone={r.difference === 0 ? 'ok' : r.difference > 0 ? 'warn' : 'bad'}>{r.difference === 0 ? 'Liquidada' : r.difference > 0 ? `Sobró ${formatMoney(r.difference)}` : `Faltó ${formatMoney(-r.difference)}`}</Badge></td>
                <td className="num money">{formatMoney(r.amount)}</td><td className="num money">{formatMoney(r.ordersCash)}</td><td className="num hide-sm">—</td>
                <td className="num money">{formatMoney(r.returned)}<small className="block">entregó</small></td><td />
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
      {modal === 'give' && <GiveModal couriers={couriers} busyIds={open.map((r) => r.userId)} onClose={() => setModal(null)} onDone={() => { setModal(null); toast('Base entregada'); load(); onChanged?.() }} />}
      {current && <SettleModal f={current} onClose={() => setModal(null)} onChanged={() => { load(); onChanged?.() }} onDone={() => { setModal(null); toast('Base liquidada'); load(); onChanged?.() }} />}
    </Card>
  )
}
