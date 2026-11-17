import React, { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MdRequestQuote, MdSearch, MdPayments, MdBlock } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Badge, Card, Empty, Field, Kpi, Modal, PageHead, Spinner, useToast } from '../../components/ui'
import { MoneyInput, Tabs } from '../../components/forms'
import { formatDate, formatDateTime, formatMoney } from '../../utils/format'
import { ADMIN, PAY_METHODS } from '../operacion/common'

const STATUS = { pendiente: 'Pendiente', pagada: 'Pagada', anulada: 'Anulada' }
const TONE = { pendiente: 'warn', pagada: 'ok', anulada: 'muted' }

const Detail = ({ id, admin, onClose, onChanged }) => {
  const [r, setR] = useState(null)
  const [f, setF] = useState({ amount: '', method: 'efectivo', reference: '' })
  const [voiding, setVoiding] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const load = useCallback(() => api.get(`/cuentas-por-cobrar/${id}`, { params: { sede: undefined } }).then(({ data }) => { setR(data); setF((x) => ({ ...x, amount: data.balance })) }).catch((e) => setError(errorMessage(e))), [id])
  useEffect(() => { load() }, [load])
  const pay = async (e) => {
    e.preventDefault(); setError(''); setSaving(true)
    try { await api.post(`/cuentas-por-cobrar/${id}/abonos`, f); onChanged('Abono registrado'); await load() } catch (err) { setError(errorMessage(err)) }
    setSaving(false)
  }
  const doVoid = async () => {
    try { await api.post(`/cuentas-por-cobrar/${id}/anular`, { reason }); onChanged('Cuenta anulada'); onClose() } catch (err) { setError(errorMessage(err)) }
  }
  return (
    <Modal size="lg" title={r ? `${r.number} · ${r.customerName}` : 'Cuenta por cobrar'} onClose={onClose}>
      {!r ? <Spinner /> : (
        <div className="stack">
          <div className="kpis">
            <Kpi label="Valor" value={formatMoney(r.amount)} />
            <Kpi label="Abonado" value={formatMoney(r.paid)} />
            <Kpi label="Saldo" value={formatMoney(r.balance)} tone={r.balance > 0 ? (r.overdue ? 'bad' : 'warn') : ''} note={r.dueDate ? `Vence ${formatDate(r.dueDate)}` : null} />
          </div>
          <small className="muted">{[r.customerDoc && `Doc. ${r.customerDoc}`, r.customerPhone, r.order && <span key="o">Pedido <Link to={`/pedidos/${r.orderId}`}>{r.order}</Link></span>, r.site, `creada ${formatDateTime(r.createdAt)}`].filter(Boolean).reduce((a, x, i) => [...a, i ? ' · ' : '', x], [])}</small>
          {r.payments.length > 0 && (
            <ul className="list">{r.payments.map((p) => <li key={p.id}><span><strong>{p.methodLabel}</strong> <small>{[p.reference, p.user, formatDateTime(p.createdAt)].filter(Boolean).join(' · ')}</small></span><span className="money">{formatMoney(p.amount)}</span></li>)}</ul>
          )}
          {r.status === 'pendiente' && (
            <form className="form-grid cxc-box" onSubmit={pay} noValidate>
              <div className="span-2"><strong className="label-sm">Registrar abono</strong></div>
              <Field label="Valor" htmlFor="pa"><MoneyInput id="pa" value={f.amount} onChange={(v) => setF({ ...f, amount: v })} /></Field>
              <Field label="Forma de pago" htmlFor="pm"><select id="pm" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{Object.entries(PAY_METHODS).filter(([k]) => k !== 'cuenta_por_cobrar').map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
              {f.method !== 'efectivo' && <div className="span-2"><Field label="Referencia" htmlFor="pr"><input id="pr" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field></div>}
              <div className="span-2 row-end">
                {admin && <button type="button" className="btn btn-sm btn-ghost" onClick={() => setVoiding(true)}><MdBlock /> Anular cuenta</button>}
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <Spinner /> : <MdPayments />} Abonar</button>
              </div>
            </form>
          )}
          {voiding && <div className="row"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo de la anulación" style={{ flex: 1 }} aria-label="Motivo" /><button type="button" className="btn btn-sm" onClick={doVoid}>Confirmar</button></div>}
          {error && <div className="alert bad">{error}</div>}
        </div>
      )}
    </Modal>
  )
}

// Cuentas por cobrar: lo que los clientes quedaron debiendo al cobrar un pedido, con sus abonos.
const ReceivablesPage = () => {
  const { user } = useAuth()
  const admin = ADMIN.includes(user.role)
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState('pendiente')
  const [q, setQ] = useState('')
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(Number(params.get('id')) || null)
  const [toast, toastNode] = useToast()
  const load = useCallback(() => api.get('/cuentas-por-cobrar', { params: { estado: tab === 'todas' ? undefined : tab, q: q || undefined } }).then(({ data: d }) => setData(d)).catch(() => setData({ rows: [], pending: 0 })), [tab, q])
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])
  useEffect(() => { if (params.get('id')) setParams({}, { replace: true }) }, [params, setParams])
  return (
    <div className="stack">
      <PageHead title="Cuentas por cobrar" subtitle="Se crean al cobrar un pedido con la forma de pago “Cuenta por cobrar”. Los abonos entran al turno de caja abierto." />
      <div className="kpis"><Kpi label="Saldo pendiente" value={formatMoney(data?.pending || 0)} icon={MdRequestQuote} tone="brand" /><Kpi label="Cuentas pendientes" value={data ? data.rows.filter((r) => r.status === 'pendiente').length : '—'} /><Kpi label="Vencidas" value={data ? data.rows.filter((r) => r.overdue).length : '—'} tone={data?.rows.some((r) => r.overdue) ? 'bad' : ''} /></div>
      <Tabs value={tab} onChange={setTab} tabs={[['pendiente', 'Pendientes'], ['pagada', 'Pagadas'], ['anulada', 'Anuladas'], ['todas', 'Todas']]} />
      <Card flush>
        <div className="toolbar"><div className="input-icon grow"><MdSearch /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cliente, documento o número" aria-label="Buscar" /></div></div>
        {!data ? <div className="splash" style={{ minHeight: 140 }}><Spinner /></div> : !data.rows.length ? <Empty icon={<MdRequestQuote />}>No hay cuentas con ese filtro.</Empty> : (
          <div className="table-wrap"><table className="table hover">
            <thead><tr><th>Cuenta</th><th>Cliente</th><th className="hide-sm">Pedido</th><th className="hide-md">Vence</th><th className="num">Valor</th><th className="num">Saldo</th><th>Estado</th></tr></thead>
            <tbody>{data.rows.map((r) => (
              <tr key={r.id} onClick={() => setOpen(r.id)} style={{ cursor: 'pointer' }} className={r.overdue ? 'row-overdue' : ''}>
                <td><strong>{r.number}</strong><small className="block muted">{formatDate(r.createdAt)}</small></td>
                <td>{r.customerName}{r.customerPhone && <small className="block muted">{r.customerPhone}</small>}</td>
                <td className="hide-sm">{r.order || '—'}</td><td className="hide-md">{r.dueDate ? formatDate(r.dueDate) : '—'}</td>
                <td className="num money">{formatMoney(r.amount)}</td><td className="num money"><strong>{formatMoney(r.balance)}</strong></td>
                <td><Badge tone={r.overdue ? 'bad' : TONE[r.status]}>{r.overdue ? 'Vencida' : STATUS[r.status]}</Badge></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
      {open && <Detail id={open} admin={admin} onClose={() => setOpen(null)} onChanged={(m) => { toast(m); load() }} />}
      {toastNode}
    </div>
  )
}

export default ReceivablesPage
