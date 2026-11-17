import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  MdArrowBack, MdSearch, MdAdd, MdRemove, MdSend, MdReceipt, MdPointOfSale, MdBlock, MdCardGiftcard, MdSwapHoriz, MdPrint, MdDelete, MdNotes, MdPeople, MdClose
} from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { useSettings } from '../../context/SettingsContext'
import { Badge, Card, Empty, Field, Modal, Spinner, useToast } from '../../components/ui'
import { formatDateTime, formatMoney } from '../../utils/format'
import { AREA_LABEL, ITEM_STATUS, ITEM_TONE, ORDER_STATUS, ORDER_TONE, PAY_METHODS, Qty, since, useCan } from './common'
import ChargeModal from './ChargeModal'

// Motivo obligatorio para cortesías y anulaciones.
const ReasonModal = ({ title, label, placeholder, confirm, danger, onClose, onConfirm }) => {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    if (!reason.trim()) return setError('Escribe el motivo.')
    setSaving(true)
    try { await onConfirm(reason.trim()) } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  return (
    <Modal title={title} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="reason-form" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={saving}>{saving && <Spinner />} {confirm}</button></>}>
      <form id="reason-form" onSubmit={submit} noValidate className="stack">
        <Field label={label} htmlFor="rr" required><input id="rr" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} autoFocus /></Field>
        {error && <div className="alert bad">{error}</div>}
      </form>
    </Modal>
  )
}

const MoveModal = ({ order, onClose, onMoved }) => {
  const [tables, setTables] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api.get('/mesas', { params: { sede: order.siteId } }).then(({ data }) => setTables(data.tables.filter((t) => t.status === 'libre'))).catch((e) => setError(errorMessage(e))) }, [order.siteId])
  const move = async (t) => { try { onMoved(await api.put(`/pedidos/${order.id}`, { tableId: t.id }), t) } catch (e) { setError(errorMessage(e)) } }
  return (
    <Modal title="Mover a otra mesa" onClose={onClose}>
      {error && <div className="alert bad">{error}</div>}
      {!tables ? <Spinner /> : !tables.length ? <Empty>No hay mesas libres.</Empty> : (
        <div className="tbl-grid sm">{tables.map((t) => <button key={t.id} type="button" className="tbl tbl-libre tbl-main" onClick={() => move(t)}><strong>{t.name}</strong><small><MdPeople /> {t.seats}</small></button>)}</div>
      )}
    </Modal>
  )
}

// Precuenta impresa (no es factura).
const printBill = (o, settings) => {
  const w = window.open('', '_blank', 'width=380,height=640')
  if (!w) return
  const rows = o.items.filter((i) => i.status !== 'anulado').map((i) => `<tr><td>${i.quantity} ${i.name}${i.courtesy ? ' (cortesía)' : ''}</td><td style="text-align:right">${i.courtesy ? '$0' : formatMoney(i.total)}</td></tr>`).join('')
  const tip = Math.round((o.subtotal - o.discountTotal) * Number(settings.tipPercent ?? 10) / 100)
  w.document.write(`<html><head><title>Precuenta ${o.number}</title><style>body{font-family:ui-monospace,monospace;font-size:12px;padding:10px;width:280px}h3,p{text-align:center;margin:4px 0}table{width:100%;border-collapse:collapse}td{padding:2px 0}hr{border:0;border-top:1px dashed #000}</style></head><body>
<h3>${settings.businessName}</h3><p>PRECUENTA · ${o.number}</p><p>${o.table || o.typeLabel} · ${new Date().toLocaleString('es-CO')}</p><hr/><table>${rows}</table><hr/>
<table><tr><td>Subtotal</td><td style="text-align:right">${formatMoney(o.subtotal)}</td></tr><tr><td>Propina sugerida (${settings.tipPercent ?? 10} %)</td><td style="text-align:right">${formatMoney(tip)}</td></tr>
<tr><td><b>Total con propina</b></td><td style="text-align:right"><b>${formatMoney(o.subtotal + tip)}</b></td></tr></table><hr/><p>La propina es voluntaria.</p><p>Este documento no es una factura.</p>
<script>window.onload=()=>{window.print()}<\/script></body></html>`)
  w.document.close()
}

// Pedido: agregar productos (con precio de promoción), enviar la comanda, cortesías, anulaciones y cobro.
const OrderPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { settings } = useSettings()
  const can = useCan()
  const [o, setO] = useState(null)
  const [error, setError] = useState('')
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [cart, setCart] = useState([])
  const [sending, setSending] = useState(false)
  const [modal, setModal] = useState(null)
  const [toast, toastNode] = useToast()
  const seller = can('mesero', 'cajero', 'host', 'bartender', 'barista')
  const cashier = can('cajero')

  const load = useCallback(() => api.get(`/pedidos/${id}`, { params: { sede: undefined } }).then(({ data }) => setO(data)).catch((e) => setError(errorMessage(e))), [id])
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t) }, [load])
  useEffect(() => {
    api.get('/inventario/categorias', { params: { activas: 1 } }).then(({ data }) => setCategories(data.filter((c) => c.showInMenu || c.products))).catch(() => {})
    api.get('/inventario/productos', { params: { activos: 1, sede: undefined } }).then(({ data }) => setProducts(data.filter((p) => p.price > 0))).catch(() => {})
  }, [])

  const shown = useMemo(() => {
    const f = q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return products.filter((p) => (cat === 'all' || p.categoryId === Number(cat)) && (!f || `${p.name} ${p.sku || ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(f)))
  }, [products, cat, q])

  const add = (p) => setCart((c) => { const i = c.findIndex((x) => x.product.id === p.id && !x.note); return i >= 0 ? c.map((x, j) => (j === i ? { ...x, quantity: x.quantity + 1 } : x)) : [...c, { product: p, quantity: 1, note: '' }] })
  const bump = (n, d) => setCart((c) => c.map((x, j) => (j === n ? { ...x, quantity: x.quantity + d } : x)).filter((x) => x.quantity > 0))
  const cartTotal = cart.reduce((a, x) => a + x.quantity * (x.product.finalPrice ?? x.product.price), 0)

  const send = async () => {
    setSending(true)
    try {
      const { data } = await api.post(`/pedidos/${o.id}/items`, { items: cart.map((x) => ({ productId: x.product.id, quantity: x.quantity, note: x.note })) })
      setO((prev) => ({ ...prev, ...data })); setCart([]); toast('Comanda enviada')
    } catch (e) { toast(errorMessage(e), 'bad') }
    setSending(false)
  }
  const act = async (fn, msg) => { try { const { data } = await fn(); setO((prev) => ({ ...prev, ...data })); setModal(null); if (msg) toast(msg) } catch (e) { toast(errorMessage(e), 'bad'); throw e } }

  if (error) return <Card><Empty>{error}</Empty></Card>
  if (!o) return <div className="splash"><Spinner /></div>
  const open = o.status === 'abierto'
  const live = o.items.filter((i) => i.status !== 'anulado')
  const voided = o.items.filter((i) => i.status === 'anulado')
  const back = () => navigate(o.type === 'mesa' && open ? '/mesas' : -1)

  return (
    <div className="stack">
      <div className="row-between wrap" style={{ gap: 10 }}>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <button type="button" className="btn btn-ghost btn-icon" onClick={back} aria-label="Volver"><MdArrowBack /></button>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>{o.table || o.typeLabel} <small className="muted">· {o.number}</small> <Badge tone={ORDER_TONE[o.status]}>{ORDER_STATUS[o.status]}</Badge>{o.billRequestedAt && open && <Badge tone="warn">Pidió la cuenta</Badge>}</h1>
            <small className="muted">{[o.waiter?.name, o.guests && `${o.guests} personas`, o.customerName, `abierto ${since(o.openedAt)}`, o.site].filter(Boolean).join(' · ')}</small>
          </div>
        </div>
        {open && <div className="row-end wrap">
          <button type="button" className="btn btn-sm" onClick={() => printBill(o, settings)} disabled={!live.length}><MdPrint /> Precuenta</button>
          {o.type === 'mesa' && seller && <button type="button" className="btn btn-sm" onClick={() => setModal('move')}><MdSwapHoriz /> Mover</button>}
          <button type="button" className="btn btn-sm" onClick={() => act(() => api.post(`/pedidos/${o.id}/cuenta`, { cancel: Boolean(o.billRequestedAt) }), o.billRequestedAt ? 'Se quitó la solicitud de cuenta' : 'Cuenta pedida: la caja ya la ve')}><MdReceipt /> {o.billRequestedAt ? 'Quitar cuenta' : 'Pedir cuenta'}</button>
          {cashier && <button type="button" className="btn btn-sm btn-danger-ghost" onClick={() => setModal('void')}><MdBlock /> Anular</button>}
          {cashier && <button type="button" className="btn btn-primary" onClick={() => setModal('charge')} disabled={!live.length || cart.length > 0} title={cart.length ? 'Envía o borra los productos sin enviar' : ''}><MdPointOfSale /> Cobrar {formatMoney(o.total)}</button>}
        </div>}
      </div>

      <div className={open && seller ? 'order-layout' : ''}>
        {open && seller && (
          <Card flush className="order-menu">
            <div className="order-menu-head">
              <div className="input-icon"><MdSearch /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto o código" aria-label="Buscar producto" /></div>
              <div className="chip-list scroll-x">
                <button type="button" className={`pchip${cat === 'all' ? ' on' : ''}`} onClick={() => setCat('all')}>Todo</button>
                {categories.map((c) => <button key={c.id} type="button" className={`pchip${cat === String(c.id) ? ' on' : ''}`} onClick={() => setCat(String(c.id))}>{c.emoji} {c.name}</button>)}
              </div>
            </div>
            <div className="prod-tiles">
              {shown.map((p) => (
                <button key={p.id} type="button" className="prod-tile" onClick={() => add(p)} style={{ '--cat': p.categoryColor || 'var(--brand)' }}>
                  {p.photoUrl ? <img src={p.photoUrl} alt="" /> : <span className="prod-emoji">{p.categoryEmoji || '🍽️'}</span>}
                  <strong>{p.name}</strong>
                  <span className="prod-price">{p.promo ? <><s>{formatMoney(p.price)}</s> <b style={{ color: p.promo.color }}>{formatMoney(p.finalPrice)}</b></> : formatMoney(p.price)}</span>
                  {p.promo && <span className="prod-promo" style={{ background: p.promo.color }}>{p.promo.emoji} {p.promo.tag || p.promo.name}</span>}
                </button>
              ))}
              {!shown.length && <Empty>No hay productos con ese filtro.</Empty>}
            </div>
          </Card>
        )}

        <div className="stack">
          {cart.length > 0 && (
            <Card title="Por enviar" subtitle="Revisa y envía la comanda" flush className="cart-card">
              <ul className="cart">{cart.map((x, n) => (
                <li key={`${x.product.id}-${n}`}>
                  <div className="cart-qty"><button type="button" className="btn btn-icon btn-sm" onClick={() => bump(n, -1)} aria-label="Menos"><MdRemove /></button><b>{x.quantity}</b><button type="button" className="btn btn-icon btn-sm" onClick={() => bump(n, 1)} aria-label="Más"><MdAdd /></button></div>
                  <div className="grow"><strong>{x.product.name}</strong>
                    <input className="cart-note" value={x.note} onChange={(e) => setCart((c) => c.map((y, j) => (j === n ? { ...y, note: e.target.value } : y)))} placeholder="Nota: sin hielo, término medio…" aria-label={`Nota para ${x.product.name}`} />
                  </div>
                  <span className="money">{formatMoney(x.quantity * (x.product.finalPrice ?? x.product.price))}</span>
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Quitar" onClick={() => setCart((c) => c.filter((_, j) => j !== n))}><MdDelete /></button>
                </li>
              ))}</ul>
              <div className="cart-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCart([])}><MdClose /> Borrar</button>
                <button type="button" className="btn btn-primary" onClick={send} disabled={sending}>{sending ? <Spinner /> : <MdSend />} Enviar {formatMoney(cartTotal)}</button>
              </div>
            </Card>
          )}

          <Card title="Pedido" subtitle={`${live.length} producto${live.length === 1 ? '' : 's'}`} flush>
            {!live.length ? <Empty icon={<MdNotes />}>{open ? 'Toca los productos de la carta para agregarlos.' : 'Sin productos.'}</Empty> : (
              <ul className="order-items">{live.map((i) => (
                <li key={i.id} className={i.courtesy ? 'courtesy' : ''}>
                  <span className="oi-qty"><Qty value={i.quantity} /></span>
                  <div className="grow">
                    <strong>{i.name}</strong> {i.area !== 'ninguna' && <Badge tone={ITEM_TONE[i.status]}>{ITEM_STATUS[i.status]}</Badge>}
                    <small className="block muted">{[AREA_LABEL[i.area], i.promotion && `🏷️ ${i.promotion}`, i.note && `“${i.note}”`, i.courtesy && `🎁 Cortesía: ${i.courtesyReason}`].filter(Boolean).join(' · ')}</small>
                  </div>
                  <span className="money">{i.courtesy ? <><s>{formatMoney(i.total)}</s> $0</> : formatMoney(i.total)}</span>
                  {open && <span className="oi-actions">
                    {cashier && <button type="button" className="btn btn-ghost btn-icon btn-sm" title={i.courtesy ? 'Quitar cortesía' : 'Cortesía'} aria-label={`Cortesía ${i.name}`} onClick={() => (i.courtesy ? act(() => api.post(`/pedidos/${o.id}/items/${i.id}/cortesia`, { on: false }), 'Cortesía quitada').catch(() => {}) : setModal({ courtesy: i }))}><MdCardGiftcard /></button>}
                    {(cashier || (seller && i.status === 'pendiente')) && <button type="button" className="btn btn-ghost btn-icon btn-sm" title="Anular" aria-label={`Anular ${i.name}`} onClick={() => setModal({ voidItem: i })}><MdBlock /></button>}
                  </span>}
                </li>
              ))}</ul>
            )}
            <dl className="order-totals">
              <div><dt>Consumo</dt><dd>{formatMoney(o.gross)}</dd></div>
              {o.courtesyTotal > 0 && <div><dt>Cortesías</dt><dd>−{formatMoney(o.courtesyTotal)}</dd></div>}
              {o.discountTotal > 0 && <div><dt>Descuento {o.discount?.name}</dt><dd>−{formatMoney(o.discountTotal)}</dd></div>}
              {o.tip > 0 && <div><dt>Propina</dt><dd>{formatMoney(o.tip)}</dd></div>}
              <div className="total"><dt>Total</dt><dd>{formatMoney(o.total)}</dd></div>
            </dl>
          </Card>

          {!open && o.payments?.length > 0 && (
            <Card title="Pagos" flush>
              <ul className="list padded">{o.payments.map((p) => <li key={p.id}><span><strong>{PAY_METHODS[p.method]}</strong> <small>{[p.reference, p.change ? `cambio ${formatMoney(p.change)}` : null, p.user, formatDateTime(p.createdAt)].filter(Boolean).join(' · ')}</small></span><span className="money">{formatMoney(p.amount)}</span></li>)}</ul>
              {o.receivables?.map((r) => <div key={r.id} className="alert warn" style={{ margin: 12 }}>Cuenta por cobrar {r.number} a {r.customerName}: debe {formatMoney(r.amount - r.paid)}</div>)}
            </Card>
          )}
          {o.status === 'anulado' && <div className="alert bad">Pedido anulado: {o.voidReason}</div>}
          {voided.length > 0 && (
            <details className="voided"><summary>{voided.length} producto{voided.length === 1 ? '' : 's'} anulado{voided.length === 1 ? '' : 's'}</summary>
              <ul className="list">{voided.map((i) => <li key={i.id}><span><s>{i.quantity} × {i.name}</s> <small>{i.voidReason}</small></span><small>{i.user}</small></li>)}</ul>
            </details>
          )}
        </div>
      </div>

      {modal === 'charge' && <ChargeModal order={o} onClose={() => setModal(null)} onCharged={() => { setModal(null); navigate(o.type === 'mesa' ? '/mesas' : '/pedidos') }} />}
      {modal === 'move' && <MoveModal order={o} onClose={() => setModal(null)} onMoved={({ data }, t) => { setO((p) => ({ ...p, ...data })); setModal(null); toast(`Pedido movido a ${t.name}`) }} />}
      {modal === 'void' && <ReasonModal title={`Anular el pedido ${o.number}`} label="Motivo" placeholder="Ej. el cliente se fue sin consumir" confirm="Anular pedido" danger onClose={() => setModal(null)} onConfirm={(reason) => act(() => api.post(`/pedidos/${o.id}/anular`, { reason }), 'Pedido anulado: el inventario volvió a la bodega')} />}
      {modal?.voidItem && <ReasonModal title={`Anular ${modal.voidItem.name}`} label="Motivo" placeholder="Ej. el cliente cambió de opinión" confirm="Anular" danger onClose={() => setModal(null)} onConfirm={(reason) => act(() => api.post(`/pedidos/${o.id}/items/${modal.voidItem.id}/anular`, { reason }), 'Producto anulado')} />}
      {modal?.courtesy && <ReasonModal title={`Cortesía: ${modal.courtesy.name}`} label="Motivo de la cortesía" placeholder="Ej. demora en la cocina, cliente frecuente" confirm="Dar cortesía" onClose={() => setModal(null)} onConfirm={(reason) => act(() => api.post(`/pedidos/${o.id}/items/${modal.courtesy.id}/cortesia`, { reason }), 'Cortesía aplicada')} />}
      {toastNode}
    </div>
  )
}

export default OrderPage
