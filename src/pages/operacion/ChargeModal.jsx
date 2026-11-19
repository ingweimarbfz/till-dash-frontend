import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MdAdd, MdDelete, MdPointOfSale, MdWarningAmber, MdPrint, MdCallSplit } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { useSettings } from '../../context/SettingsContext'
import { Field, Modal, Spinner } from '../../components/ui'
import { MoneyInput } from '../../components/forms'
import { formatMoney } from '../../utils/format'
import { PAY_METHODS } from './common'
import { orderTicket, splitTickets } from '../../utils/ticket'
import SplitBill from './SplitBill'

const round = (v) => Math.round(Number(v) || 0)

// Cobro de un pedido: descuento, propina sugerida, una o varias formas de pago y cuenta por cobrar.
const ChargeModal = ({ order, tipWanted = null, onClose, onCharged }) => {
  const { settings } = useSettings()
  const tipPct = Number(settings.tipPercent ?? 10)
  const [discounts, setDiscounts] = useState([])
  const [sessions, setSessions] = useState(null)
  const [sessionId, setSessionId] = useState('')
  const [discountId, setDiscountId] = useState('')
  const [reason, setReason] = useState('')
  // La propina solo se suma si el cliente la acepta (casilla). Por defecto, lo que dijo en la precuenta.
  const [tipOn, setTipOn] = useState(Boolean(tipWanted))
  const [tipMode, setTipMode] = useState('pct')
  const [tipCustom, setTipCustom] = useState('')
  // Domicilio: se cobra o no, con un valor que se escribe a mano (precargado con el del pedido o el sugerido).
  const isDelivery = order.type === 'domicilio'
  const suggestedFee = Number(order.deliveryFee) || Number(settings.deliveryFeeDefault) || 0
  const [feeOn, setFeeOn] = useState(isDelivery && suggestedFee > 0)
  const [feeValue, setFeeValue] = useState(suggestedFee || '')
  const [pays, setPays] = useState([{ method: (order.type === 'domicilio' && order.deliveryPayMethod) || 'efectivo', amount: '', received: (order.type === 'domicilio' && order.deliveryPayMethod === 'efectivo' && order.deliveryCashWith) || '', reference: '' }])
  const [cxc, setCxc] = useState({ customerName: order.customerName || '', customerDoc: '', customerPhone: order.customerPhone || '', dueDate: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(null)
  // Cuenta dividida entre personas (TD-014): SplitBill reporta las partes, los pagos de cada una y si cuadra.
  const [splitOn, setSplitOn] = useState(false)
  const [split, setSplit] = useState(null)

  useEffect(() => {
    api.get('/descuentos').then(({ data }) => setDiscounts(data.filter((d) => d.active))).catch(() => {})
    api.get('/caja/cajas', { params: { sede: order.siteId } }).then(({ data }) => {
      const open = data.filter((r) => r.session && r.siteId === order.siteId).map((r) => r.session)
      setSessions(open); if (open.length) setSessionId(String(open[0].id))
    }).catch(() => setSessions([]))
  }, [order.siteId])

  const disc = discounts.find((d) => d.id === Number(discountId))
  const discountTotal = !disc ? 0 : disc.type === 'porcentaje' ? round(order.subtotal * disc.value / 100) : Math.min(round(disc.value), order.subtotal)
  const base = order.subtotal - discountTotal
  const tip = !tipOn ? 0 : tipMode === 'pct' ? round(base * tipPct / 100) : round(tipCustom)
  const fee = isDelivery && feeOn ? round(feeValue) : 0
  const total = base + tip + fee
  const splitting = splitOn && split
  // Pagos efectivos: los de la cuenta única o los de todas las personas (con el índice de quién paga).
  const allPays = splitting ? split.persons.flatMap((p, n) => p.pays.map((x) => ({ ...x, person: n }))) : pays
  const paid = allPays.reduce((a, p) => a + round(p.amount), 0)
  const left = total - paid
  const hasCxc = allPays.some((p) => p.method === 'cuenta_por_cobrar')
  const cash = allPays.filter((p) => p.method === 'efectivo')
  const change = cash.reduce((a, p) => a + Math.max(0, round(p.received) - round(p.amount)), 0)

  // El primer pago se ajusta solo al total mientras haya una sola forma de pago.
  useEffect(() => { setPays((list) => (list.length === 1 ? [{ ...list[0], amount: total }] : list)) }, [total])
  const setPay = (n, k) => (v) => setPays((list) => list.map((p, j) => (j === n ? { ...p, [k]: v?.target ? v.target.value : v } : p)))
  const addPay = () => setPays((list) => [...list, { method: 'tarjeta', amount: Math.max(0, left), received: '', reference: '' }])
  const quick = useMemo(() => [...new Set([total, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000, Math.ceil(total / 100000) * 100000])].filter((v) => v >= total).slice(0, 4), [total])

  const submit = async (e) => {
    e.preventDefault(); setError('')
    if (splitting && split.error) return setError(split.error)
    if (left !== 0) return setError(left > 0 ? `Faltan ${formatMoney(left)} por asignar a una forma de pago.` : `Los pagos superan el total en ${formatMoney(-left)}.`)
    if (disc?.requiresReason && !reason.trim()) return setError(`Escribe el motivo del descuento "${disc.name}".`)
    if (isDelivery && feeOn && !(fee > 0)) return setError('Escribe el valor del domicilio o desmarca la casilla.')
    // Dividida: si nadie escribió el nombre, la cuenta por cobrar queda a nombre de quien la pidió.
    const cxcData = hasCxc && splitting && !cxc.customerName.trim() ? { ...cxc, customerName: split.persons[allPays.find((p) => p.method === 'cuenta_por_cobrar').person].name } : cxc
    if (hasCxc && !cxcData.customerName.trim()) return setError('Escribe a nombre de quién queda la cuenta por cobrar.')
    const needsSession = allPays.some((p) => p.method !== 'cuenta_por_cobrar')
    if (needsSession && !sessionId) return setError('No hay un turno de caja abierto en esta sucursal.')
    setSaving(true)
    try {
      const { data } = await api.post(`/pedidos/${order.id}/cobrar`, {
        sessionId: Number(sessionId) || undefined, tip, deliveryFee: isDelivery ? fee : undefined, discountId: disc?.id, discountReason: reason,
        payments: allPays.map((p) => ({ method: p.method, amount: round(p.amount), received: p.method === 'efectivo' && p.received !== '' ? round(p.received) : undefined, reference: p.reference, person: splitting ? p.person : undefined })),
        receivable: hasCxc ? cxcData : undefined,
        split: splitting ? { mode: split.mode, persons: split.persons.map((p) => ({ name: p.name, amount: p.amount, items: p.items })) } : undefined
      })
      setDone({
        ...data, tip, fee, discount: discountTotal, total, payments: allPays.map((p) => ({ label: `${splitting ? `${split.persons[p.person].name} · ` : ''}${PAY_METHODS[p.method] || p.method}`, amount: round(p.amount) })),
        split: splitting ? { mode: split.mode, persons: split.persons.map((p) => ({ ...p, change: p.pays.filter((x) => x.method === 'efectivo').reduce((a, x) => a + Math.max(0, round(x.received) - round(x.amount)), 0) })) } : null
      })
    } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }

  if (done) {
    return (
      <Modal title={`Pedido ${done.number} cobrado`} onClose={() => onCharged(done)}
        footer={<>{done.split && <button type="button" className="btn" onClick={() => splitTickets({ o: order, settings, persons: done.split.persons, mode: done.split.mode, kind: 'cuenta', tip: done.tip, payLabels: PAY_METHODS })}><MdPrint /> Tiquete por persona</button>}<button type="button" className="btn" onClick={() => orderTicket({ o: order, settings, kind: 'cuenta', tip: done.tip, tipPct: tipMode === 'pct' ? tipPct : null, discount: done.discount, deliveryFee: done.fee, total: done.total, payments: done.payments })}><MdPrint /> Imprimir tiquete</button><button type="button" className="btn btn-primary" onClick={() => onCharged(done)} autoFocus>Listo</button></>}>
        <div className="charge-done">
          <span className="charge-ok"><MdPointOfSale /></span>
          <strong>{formatMoney(done.total)}</strong>
          {done.change > 0 && <div className="charge-change">Cambio: <b>{formatMoney(done.change)}</b></div>}
          {done.receivable && <small>Quedó la cuenta por cobrar {done.receivable}.</small>}
          {done.split && (
            <div className="split-done">
              {done.split.persons.map((p) => <div key={p.name}><span><b>{p.name}</b>{p.change > 0 && <small className="muted"> · cambio {formatMoney(p.change)}</small>}</span><span className="money">{formatMoney(p.amount)}</span></div>)}
            </div>
          )}
        </div>
      </Modal>
    )
  }

  return (
    <Modal size="lg" title={`Cobrar ${order.table || order.typeLabel} · ${order.number}`} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button>{splitting && <button type="button" className="btn" disabled={!split.persons.every((p) => p.amount > 0)} onClick={() => splitTickets({ o: order, settings, persons: split.persons, mode: split.mode, tip })}><MdPrint /> Precuenta por persona</button>}<button type="submit" form="charge-form" className="btn btn-primary" disabled={saving || sessions === null}>{saving ? <Spinner /> : <MdPointOfSale />} Cobrar {formatMoney(total)}</button></>}>
      <form id="charge-form" className="charge" onSubmit={submit} noValidate>
        <div className="stack" style={{ gap: 14 }}>
          {sessions && !sessions.length && <div className="alert warn"><MdWarningAmber /> No hay un turno de caja abierto en esta sucursal. <Link to="/caja">Abrir turno</Link>. Solo puedes dejarlo como cuenta por cobrar.</div>}
          {sessions && sessions.length > 1 && <Field label="Turno de caja" htmlFor="cs"><select id="cs" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>{sessions.map((s) => <option key={s.id} value={s.id}>{s.register} · {s.number} · {s.openedBy}</option>)}</select></Field>}
          <div className="form-grid">
            <Field label="Descuento" htmlFor="cd"><select id="cd" value={discountId} onChange={(e) => setDiscountId(e.target.value)}><option value="">Sin descuento</option>{discounts.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.type === 'porcentaje' ? `${d.value} %` : formatMoney(d.value)})</option>)}</select></Field>
            {disc ? <Field label="Motivo" htmlFor="cr" required={disc.requiresReason}><input id="cr" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={disc.description || ''} /></Field> : <span />}
          </div>
          {isDelivery && (
            <div className="tip-box">
              <label className={`check-card${feeOn ? ' on' : ''}`}>
                <input type="checkbox" checked={feeOn} onChange={(e) => setFeeOn(e.target.checked)} />
                <span><b>Cobrar el domicilio</b><small>{feeOn ? 'Se suma a la cuenta. No le aplica el descuento.' : 'Sin marcar, el domicilio no se le cobra al cliente.'}</small></span>
              </label>
              {feeOn && <div style={{ maxWidth: 200, marginTop: 8 }}><Field label="Valor del domicilio" htmlFor="cdf"><MoneyInput id="cdf" value={feeValue} onChange={setFeeValue} /></Field></div>}
            </div>
          )}
          <div className="tip-box">
            <label className={`check-card${tipOn ? ' on' : ''}`}>
              <input type="checkbox" checked={tipOn} onChange={(e) => setTipOn(e.target.checked)} />
              <span><b>El cliente desea incluir la propina</b><small>{tipOn ? 'Se suma a la cuenta.' : 'Pregúntale al cliente. Sin marcar, la propina no se cobra ni aparece en la cuenta.'}</small></span>
            </label>
            {tipOn && (
              <div className="seg seg-wrap" style={{ marginTop: 8 }}>
                <button type="button" className={`btn btn-sm${tipMode === 'pct' ? ' on' : ''}`} onClick={() => setTipMode('pct')}>Sugerida {tipPct} % · {formatMoney(round(base * tipPct / 100))}</button>
                <button type="button" className={`btn btn-sm${tipMode === 'custom' ? ' on' : ''}`} onClick={() => setTipMode('custom')}>Otro valor</button>
                {tipMode === 'custom' && <div style={{ width: 150 }}><MoneyInput value={tipCustom} onChange={setTipCustom} aria-label="Valor de la propina" /></div>}
              </div>
            )}
          </div>
          <div className="seg seg-wrap" aria-label="Quién paga">
            <button type="button" className={`btn btn-sm${!splitOn ? ' on' : ''}`} onClick={() => setSplitOn(false)}>Una sola cuenta</button>
            <button type="button" className={`btn btn-sm${splitOn ? ' on' : ''}`} onClick={() => setSplitOn(true)}><MdCallSplit /> Dividir entre personas</button>
          </div>
          {splitOn && <SplitBill order={order} total={total} onChange={setSplit} />}
          {!splitOn && <div className="stack" style={{ gap: 8 }}>
            <strong className="label-sm">Formas de pago</strong>
            {pays.map((p, n) => (
              <div key={n} className="pay-row">
                <select value={p.method} onChange={setPay(n, 'method')} aria-label="Forma de pago">{Object.entries(PAY_METHODS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                <MoneyInput value={p.amount} onChange={setPay(n, 'amount')} aria-label="Valor" />
                {p.method === 'efectivo'
                  ? <MoneyInput value={p.received} onChange={setPay(n, 'received')} placeholder="Recibido" aria-label="Efectivo recibido" />
                  : p.method === 'cuenta_por_cobrar' ? <span /> : <input value={p.reference} onChange={setPay(n, 'reference')} placeholder="Referencia o voucher" aria-label="Referencia" />}
                {pays.length > 1 ? <button type="button" className="btn btn-ghost btn-icon" aria-label="Quitar pago" onClick={() => setPays(pays.filter((_, j) => j !== n))}><MdDelete /></button> : <span />}
              </div>
            ))}
            {pays.length === 1 && pays[0].method === 'efectivo' && (
              <div className="chip-list">{quick.map((v) => <button key={v} type="button" className="pchip" onClick={() => setPay(0, 'received')(v)}>{formatMoney(v)}</button>)}</div>
            )}
            <button type="button" className="btn btn-sm btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={addPay}><MdAdd /> Otra forma de pago</button>
          </div>}
          {hasCxc && (
            <div className="form-grid cxc-box">
              <div className="span-2"><strong className="label-sm">Cuenta por cobrar a nombre de</strong></div>
              <Field label="Nombre" htmlFor="xn" required><input id="xn" value={cxc.customerName} onChange={(e) => setCxc({ ...cxc, customerName: e.target.value })} /></Field>
              <Field label="Documento" htmlFor="xd"><input id="xd" value={cxc.customerDoc} onChange={(e) => setCxc({ ...cxc, customerDoc: e.target.value })} /></Field>
              <Field label="Celular" htmlFor="xp"><input id="xp" inputMode="tel" value={cxc.customerPhone} onChange={(e) => setCxc({ ...cxc, customerPhone: e.target.value })} /></Field>
              <Field label="Paga a más tardar" htmlFor="xf" hint={order.customerId ? 'Vacío: el plazo de crédito del cliente' : undefined}><input id="xf" type="date" value={cxc.dueDate} onChange={(e) => setCxc({ ...cxc, dueDate: e.target.value })} /></Field>
            </div>
          )}
          {error && <div className="alert bad">{error}</div>}
        </div>
        <aside className="charge-sum">
          <dl>
            <div><dt>Consumo</dt><dd>{formatMoney(order.gross)}</dd></div>
            {order.courtesyTotal > 0 && <div><dt>Cortesías</dt><dd>−{formatMoney(order.courtesyTotal)}</dd></div>}
            {discountTotal > 0 && <div><dt>Descuento</dt><dd>−{formatMoney(discountTotal)}</dd></div>}
            {fee > 0 && <div><dt>Domicilio</dt><dd>{formatMoney(fee)}</dd></div>}
            {tip > 0 && <div><dt>Propina</dt><dd>{formatMoney(tip)}</dd></div>}
            <div className="total"><dt>Total</dt><dd>{formatMoney(total)}</dd></div>
            <div className={left === 0 ? 'ok' : 'bad'}><dt>{left >= 0 ? 'Por asignar' : 'Sobra'}</dt><dd>{formatMoney(Math.abs(left))}</dd></div>
            {change > 0 && <div className="change"><dt>Cambio</dt><dd>{formatMoney(change)}</dd></div>}
          </dl>
        </aside>
      </form>
    </Modal>
  )
}

export default ChargeModal
