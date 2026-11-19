import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  MdArrowBack, MdSearch, MdAdd, MdRemove, MdSend, MdReceipt, MdPointOfSale, MdBlock, MdCardGiftcard, MdSwapHoriz, MdPrint, MdDelete, MdNotes, MdClose, MdLabel, MdOpenInFull
} from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { useSettings } from '../../context/SettingsContext'
import { Badge, Card, Empty, Field, Modal, Spinner, useToast } from '../../components/ui'
import { formatDateTime, formatMoney } from '../../utils/format'
import { AREA_LABEL, ITEM_STATUS, ITEM_TONE, ORDER_STATUS, ORDER_TONE, PAY_METHODS, Qty, since, useCan } from './common'
import ChargeModal from './ChargeModal'
import { orderTicket } from '../../utils/ticket'
import { getPrinterConfig } from '../../utils/printer'
import { DeliveryBox } from './DeliveriesPage'
import { AliasModal, MoveModal } from './tableModals'

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

// Precuenta: antes de imprimir se le pregunta al cliente si quiere incluir la propina.
// beforeCharge (TD-018): se abrió desde Cobrar; además de imprimir se puede imprimir y seguir al cobro.
const TipAskModal = ({ o, settings, initial, onClose, onDone, beforeCharge = false }) => {
  const pct = Number(settings.tipPercent ?? 10)
  const tipValue = Math.round((o.subtotal - o.discountTotal) * pct / 100)
  const [want, setWant] = useState(Boolean(initial))
  const print = (charge = false) => { orderTicket({ o, settings, tip: want ? tipValue : 0, tipPct: pct }); onDone(want, charge) }
  return (
    <Modal title={`Precuenta ${o.number}`} onClose={onClose}
      footer={beforeCharge
        ? <><button type="button" className="btn" onClick={() => print(false)}><MdPrint /> Imprimir y cobrar después</button><button type="button" className="btn btn-primary" onClick={() => print(true)} autoFocus><MdPointOfSale /> Imprimir y cobrar</button></>
        : <><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-primary" onClick={() => print(false)} autoFocus><MdPrint /> Imprimir precuenta</button></>}>
      <div className="stack" style={{ gap: 12 }}>
        <p className="muted" style={{ margin: 0 }}>Pregúntale al cliente si desea incluir la propina. Si no la quiere, no aparece en la precuenta ni se suma a la cuenta.</p>
        <label className={`check-card${want ? ' on' : ''}`}>
          <input type="checkbox" checked={want} onChange={(e) => setWant(e.target.checked)} />
          <span><b>El cliente desea incluir la propina ({pct} %)</b><small>Se suma {formatMoney(tipValue)}: total {formatMoney(o.subtotal - o.discountTotal + tipValue)}</small></span>
        </label>
        <div className="row-between"><span>Total a pagar</span><strong className="money">{formatMoney(o.subtotal - o.discountTotal + (want ? tipValue : 0))}</strong></div>
      </div>
    </Modal>
  )
}

// Pedido: agregar productos (con precio de promoción), enviar la comanda, cortesías, anulaciones y cobro.
// embedded: se muestra en el panel lateral de Mesas (sin salir del salón); onClose cierra el panel
// y onChanged refresca las mesas.
export const OrderView = ({ id, embedded = false, onClose, onChanged }) => {
  const navigate = useNavigate()
  const [pane, setPane] = useState(null)
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
  // Lo que respondió el cliente sobre la propina en la precuenta (se lleva al cobro).
  // Se guarda por pedido en esta pestaña: si ya se imprimió la precuenta, Cobrar ya no vuelve a preguntar (TD-018).
  const billKey = `td_precuenta_${id}`
  const [tipWanted, setTipWantedState] = useState(() => { try { const v = sessionStorage.getItem(billKey); return v === null ? null : v === '1' } catch { return null } })
  const setTipWanted = (w) => { setTipWantedState(w); try { sessionStorage.setItem(billKey, w ? '1' : '0') } catch { /* sin almacenamiento */ } }
  // Cobrar: si la precuenta no se ha impreso, primero se pregunta si se imprime para llevársela al cliente.
  const startCharge = () => setModal(tipWanted === null && getPrinterConfig().askBeforeCharge !== false ? 'ask-bill' : 'charge')
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
    const list = products.filter((p) => (cat === 'all' || (cat === 'vence' ? p.expiry?.expiresOn : p.categoryId === Number(cat))) && (!f || `${p.name} ${p.sku || ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(f)))
    // TD-016: lo que vence pronto sale primero para recomendarlo.
    const soon = (p) => (p.expiry?.expiresOn ? p.expiry.days : Infinity)
    return [...list].sort((a, b) => soon(a) - soon(b))
  }, [products, cat, q])
  const expiring = products.filter((p) => p.expiry?.expiresOn).length

  // Un toque suma a la línea cobrada del producto; las líneas de cortesía quedan aparte.
  const add = (p) => setCart((c) => { const i = c.findIndex((x) => x.product.id === p.id && !x.note && !x.courtesy); return i >= 0 ? c.map((x, j) => (j === i ? { ...x, quantity: x.quantity + 1 } : x)) : [...c, { product: p, quantity: 1, note: '' }] })
  const bump = (n, d) => setCart((c) => c.map((x, j) => (j === n ? { ...x, quantity: x.quantity + d } : x)).filter((x) => x.quantity > 0))
  const linePrice = (x) => x.product.finalPrice ?? x.product.price
  const cartTotal = cart.reduce((a, x) => a + (x.courtesy ? 0 : x.quantity * linePrice(x)), 0)
  // Cortesía al agregar (TD-013): el motivo se propone con el producto más caro que sí se cobra.
  const toggleCourtesy = (n, on) => setCart((c) => {
    const paid = c.filter((y, j) => j !== n && !y.courtesy).sort((a, b) => linePrice(b) - linePrice(a))[0]
    return c.map((y, j) => (j === n ? { ...y, courtesy: on, courtesyReason: on ? (y.courtesyReason || (paid ? `Cortesía con ${paid.product.name}` : 'Cortesía de la casa')) : y.courtesyReason } : y))
  })

  const send = async () => {
    setSending(true)
    try {
      const { data } = await api.post(`/pedidos/${o.id}/items`, { items: cart.map((x) => ({ productId: x.product.id, quantity: x.quantity, note: x.note, ...(x.courtesy ? { courtesy: true, courtesyReason: x.courtesyReason } : {}) })) })
      setO((prev) => ({ ...prev, ...data })); setCart([]); toast('Comanda enviada'); onChanged?.(); if (embedded) setPane('pedido')
    } catch (e) { toast(errorMessage(e), 'bad') }
    setSending(false)
  }
  const act = async (fn, msg) => { try { const { data } = await fn(); setO((prev) => ({ ...prev, ...data })); setModal(null); if (msg) toast(msg); onChanged?.() } catch (e) { toast(errorMessage(e), 'bad'); throw e } }

  if (error) return <Card><Empty>{error}</Empty></Card>
  if (!o) return <div className="splash"><Spinner /></div>
  const open = o.status === 'abierto'
  const live = o.items.filter((i) => i.status !== 'anulado')
  const voided = o.items.filter((i) => i.status === 'anulado')
  const back = () => (embedded ? onClose?.() : navigate(o.type === 'mesa' && open ? '/mesas' : -1))
  const view = embedded ? (pane || (live.length ? 'pedido' : 'carta')) : null
  const showMenu = open && seller && (!embedded || view === 'carta')
  const showOrder = !embedded || view === 'pedido' || !(open && seller)

  return (
    <div className={`stack${embedded ? ' order-embedded' : ''}`}>
      <div className="row-between wrap" style={{ gap: 10 }}>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <button type="button" className="btn btn-ghost btn-icon" onClick={back} aria-label={embedded ? 'Cerrar panel' : 'Volver'} title={embedded ? 'Cerrar' : 'Volver'}>{embedded ? <MdClose /> : <MdArrowBack />}</button>
          <div>
            {embedded && <button type="button" className="btn btn-ghost btn-sm panel-expand" onClick={() => navigate(`/pedidos/${o.id}`)} title="Abrir en pantalla completa"><MdOpenInFull /></button>}
            <h1 className="page-title" style={{ margin: 0 }}>{o.table || o.typeLabel} <small className="muted">· {o.number}</small> <Badge tone={ORDER_TONE[o.status]}>{ORDER_STATUS[o.status]}</Badge>{o.alias && <button type="button" className="tbl-alias as-btn" onClick={() => open && seller && setModal('alias')} title="Editar alias"><MdLabel /> {o.alias}</button>}{o.billRequestedAt && open && <Badge tone="warn">Pidió la cuenta</Badge>}</h1>
            <small className="muted">{[o.waiter?.name, o.guests && `${o.guests} personas`, o.customerName, `abierto ${since(o.openedAt)}`, o.site].filter(Boolean).join(' · ')}</small>
          </div>
        </div>
        {open && <div className="row-end wrap">
          <button type="button" className="btn btn-sm" onClick={() => setModal('bill')} disabled={!live.length}><MdPrint /> Precuenta</button>
          {o.type === 'mesa' && seller && <button type="button" className="btn btn-sm" onClick={() => setModal('move')}><MdSwapHoriz /> Trasladar</button>}
          {o.type === 'mesa' && seller && !o.alias && <button type="button" className="btn btn-sm" onClick={() => setModal('alias')}><MdLabel /> Alias</button>}
          <button type="button" className="btn btn-sm" onClick={() => act(() => api.post(`/pedidos/${o.id}/cuenta`, { cancel: Boolean(o.billRequestedAt) }), o.billRequestedAt ? 'Se quitó la solicitud de cuenta' : 'Cuenta pedida: la caja ya la ve')}><MdReceipt /> {o.billRequestedAt ? 'Quitar cuenta' : 'Pedir cuenta'}</button>
          {cashier && <button type="button" className="btn btn-sm btn-danger-ghost" onClick={() => setModal('void')}><MdBlock /> Anular</button>}
          {cashier && <button type="button" className="btn btn-primary" onClick={startCharge} disabled={!live.length || cart.length > 0} title={cart.length ? 'Envía o borra los productos sin enviar' : ''}><MdPointOfSale /> Cobrar {formatMoney(o.total)}</button>}
        </div>}
      </div>

      {embedded && open && seller && (
        <div className="seg panel-seg" role="tablist">
          <button type="button" role="tab" aria-selected={view === 'carta'} className={`btn btn-sm${view === 'carta' ? ' on' : ''}`} onClick={() => setPane('carta')}><MdAdd /> Agregar productos{cart.length > 0 && <Badge tone="brand">{cart.reduce((a, x) => a + x.quantity, 0)}</Badge>}</button>
          <button type="button" role="tab" aria-selected={view === 'pedido'} className={`btn btn-sm${view === 'pedido' ? ' on' : ''}`} onClick={() => setPane('pedido')}><MdNotes /> Pedido · {formatMoney(o.total)}</button>
        </div>
      )}
      <div className={open && seller && !embedded ? 'order-layout' : embedded ? 'stack' : ''}>
        {showMenu && (
          <Card flush className="order-menu">
            <div className="order-menu-head">
              <div className="input-icon"><MdSearch /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto o código" aria-label="Buscar producto" /></div>
              <div className="chip-list scroll-x">
                <button type="button" className={`pchip${cat === 'all' ? ' on' : ''}`} onClick={() => setCat('all')}>Todo</button>
                {expiring > 0 && <button type="button" className={`pchip${cat === 'vence' ? ' on' : ''}`} onClick={() => setCat('vence')} title="Productos que vencen pronto: recomiéndalos">⏳ Por vencer ({expiring})</button>}
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
                  {/* TD-016: lo que vence pronto se recomienda al cliente (y se vende primero el lote que vence antes). */}
                  {p.expiry?.expiresOn && <span className={`prod-expiry ${p.expiry.status}`} title={`Lote más próximo: vence el ${p.expiry.expiresOn.split('-').reverse().join('/')}`}>⏳ Recomiéndalo · {p.expiry.days === 0 ? 'vence hoy' : `${p.expiry.days} d`}</span>}
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
                <li key={`${x.product.id}-${n}`} className={x.courtesy ? 'courtesy' : ''}>
                  <div className="cart-qty"><button type="button" className="btn btn-icon btn-sm" onClick={() => bump(n, -1)} aria-label="Menos"><MdRemove /></button><b>{x.quantity}</b><button type="button" className="btn btn-icon btn-sm" onClick={() => bump(n, 1)} aria-label="Más"><MdAdd /></button></div>
                  <div className="grow"><strong>{x.product.name}</strong>
                    <input className="cart-note" value={x.note} onChange={(e) => setCart((c) => c.map((y, j) => (j === n ? { ...y, note: e.target.value } : y)))} placeholder="Nota: sin hielo, término medio…" aria-label={`Nota para ${x.product.name}`} />
                    {x.product.courtesyAllowed && <label className="cart-courtesy" title="No se cobra, pero sí sale del inventario"><input type="checkbox" checked={Boolean(x.courtesy)} onChange={(e) => toggleCourtesy(n, e.target.checked)} /> <MdCardGiftcard /> Cortesía (no se cobra)</label>}
                    {x.courtesy && <input className="cart-note" value={x.courtesyReason || ''} onChange={(e) => setCart((c) => c.map((y, j) => (j === n ? { ...y, courtesyReason: e.target.value } : y)))} placeholder="Motivo de la cortesía" aria-label={`Motivo de la cortesía de ${x.product.name}`} maxLength={200} />}
                  </div>
                  <span className="money">{x.courtesy ? <><s>{formatMoney(x.quantity * linePrice(x))}</s> $0</> : formatMoney(x.quantity * linePrice(x))}</span>
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Quitar" onClick={() => setCart((c) => c.filter((_, j) => j !== n))}><MdDelete /></button>
                </li>
              ))}</ul>
              <div className="cart-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCart([])}><MdClose /> Borrar</button>
                <button type="button" className="btn btn-primary" onClick={send} disabled={sending}>{sending ? <Spinner /> : <MdSend />} Enviar {formatMoney(cartTotal)}</button>
              </div>
            </Card>
          )}

          {showOrder && <>
          {o.type === 'domicilio' && o.status !== 'anulado' && <DeliveryBox order={o} canAssign={seller} onChanged={load} />}
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
              {o.deliveryFee > 0 && <div><dt>Domicilio</dt><dd>{formatMoney(o.deliveryFee)}</dd></div>}
              {o.tip > 0 && <div><dt>Propina</dt><dd>{formatMoney(o.tip)}</dd></div>}
              <div className="total"><dt>Total</dt><dd>{formatMoney(o.total)}</dd></div>
            </dl>
          </Card>

          {!open && o.payments?.length > 0 && (
            <Card title={o.split ? `Pagos · cuenta dividida ${o.split.label?.toLowerCase() || ''} entre ${o.split.persons?.length} personas` : 'Pagos'} flush>
              <ul className="list padded">{o.payments.map((p) => <li key={p.id}><span><strong>{p.payer ? `${p.payer} · ` : ''}{PAY_METHODS[p.method]}</strong> <small>{[p.reference, p.change ? `cambio ${formatMoney(p.change)}` : null, p.user, formatDateTime(p.createdAt)].filter(Boolean).join(' · ')}</small></span><span className="money">{formatMoney(p.amount)}</span></li>)}</ul>
              {o.receivables?.map((r) => <div key={r.id} className="alert warn" style={{ margin: 12 }}>Cuenta por cobrar {r.number} a {r.customerName}: debe {formatMoney(r.amount - r.paid)}</div>)}
            </Card>
          )}
          {o.status === 'anulado' && <div className="alert bad">Pedido anulado: {o.voidReason}</div>}
          {voided.length > 0 && (
            <details className="voided"><summary>{voided.length} producto{voided.length === 1 ? '' : 's'} anulado{voided.length === 1 ? '' : 's'}</summary>
              <ul className="list">{voided.map((i) => <li key={i.id}><span><s>{i.quantity} × {i.name}</s> <small>{i.voidReason}</small></span><small>{i.user}</small></li>)}</ul>
            </details>
          )}
          </>}
        </div>
      </div>

      {modal === 'ask-bill' && (
        <Modal title={`Cobrar ${o.table || o.typeLabel || ''} · ${o.number}`} onClose={() => setModal(null)}
          footer={<><button type="button" className="btn" onClick={() => setModal('charge')}><MdPointOfSale /> Cobrar sin imprimir</button><button type="button" className="btn btn-primary" onClick={() => setModal('bill-charge')} autoFocus><MdPrint /> Imprimir la cuenta</button></>}>
          <div className="stack" style={{ gap: 10 }}>
            <p style={{ margin: 0 }}><b>¿Deseas imprimir primero la cuenta?</b></p>
            <p className="muted" style={{ margin: 0 }}>Para llevársela al cliente y que la revise antes de pagar. Total {formatMoney(o.total)}.</p>
          </div>
        </Modal>
      )}
      {modal === 'bill-charge' && <TipAskModal o={o} settings={settings} initial={tipWanted} beforeCharge onClose={() => setModal(null)} onDone={(w, charge) => { setTipWanted(w); setModal(charge ? 'charge' : null); if (!charge) toast('Cuenta impresa. Cuando el cliente pague, presiona Cobrar.') }} />}
      {modal === 'bill' && <TipAskModal o={o} settings={settings} initial={tipWanted} onClose={() => setModal(null)} onDone={(w) => { setTipWanted(w); setModal(null) }} />}
      {modal === 'charge' && <ChargeModal order={o} tipWanted={tipWanted} onClose={() => setModal(null)} onCharged={() => { setModal(null); if (embedded) { onChanged?.(); onClose?.() } else navigate(o.type === 'mesa' ? '/mesas' : '/pedidos') }} />}
      {modal === 'move' && <MoveModal order={o} fromName={o.table} onClose={() => setModal(null)} onMoved={(data, t) => { setO((p) => ({ ...p, ...data })); setModal(null); toast(`Pedido trasladado a ${t.name}`) }} />}
      {modal === 'alias' && <AliasModal order={o} tableName={o.table || o.number} onClose={() => setModal(null)} onSaved={(data) => { setO((p) => ({ ...p, ...data })); setModal(null); toast(data.alias ? `Alias: ${data.alias}` : 'Alias quitado') }} />}
      {modal === 'void' && <ReasonModal title={`Anular el pedido ${o.number}`} label="Motivo" placeholder="Ej. el cliente se fue sin consumir" confirm="Anular pedido" danger onClose={() => setModal(null)} onConfirm={(reason) => act(() => api.post(`/pedidos/${o.id}/anular`, { reason }), 'Pedido anulado: el inventario volvió a la bodega')} />}
      {modal?.voidItem && <ReasonModal title={`Anular ${modal.voidItem.name}`} label="Motivo" placeholder="Ej. el cliente cambió de opinión" confirm="Anular" danger onClose={() => setModal(null)} onConfirm={(reason) => act(() => api.post(`/pedidos/${o.id}/items/${modal.voidItem.id}/anular`, { reason }), 'Producto anulado')} />}
      {modal?.courtesy && <ReasonModal title={`Cortesía: ${modal.courtesy.name}`} label="Motivo de la cortesía" placeholder="Ej. demora en la cocina, cliente frecuente" confirm="Dar cortesía" onClose={() => setModal(null)} onConfirm={(reason) => act(() => api.post(`/pedidos/${o.id}/items/${modal.courtesy.id}/cortesia`, { reason }), 'Cortesía aplicada')} />}
      {toastNode}
    </div>
  )
}

const OrderPage = () => {
  const { id } = useParams()
  return <OrderView key={id} id={id} />
}

export default OrderPage
