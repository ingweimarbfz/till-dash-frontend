import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MdQrCodeScanner, MdRoomService, MdReceipt, MdCheckCircle, MdAdd, MdRemove, MdShoppingBag, MdClose, MdPerson, MdPeople, MdSchedule, MdPlace, MdHourglassTop, MdStar } from 'react-icons/md'
import MenuView from '../../components/menu/MenuView'
import api, { errorMessage } from '../../api/client'
import { BrandLogo } from '../../components/Logo'
import { Spinner } from '../../components/ui'
import { formatMoney } from '../../utils/format'

const NO_SITE = { params: { sede: undefined } }
// Sin tocar la carta por este tiempo, se cierra: deja de consultar y para volver a usarla hay que escanear el QR.
const IDLE_MS = 10 * 60e3
const ACTIVITY = ['pointerdown', 'keydown', 'scroll', 'touchstart']
const ITEM_STATUS = { pendiente: 'En cola', preparando: 'Preparando', listo: 'Listo', entregado: 'Entregado' }
const since = (d) => { const m = Math.max(0, Math.round((Date.now() - new Date(d)) / 60000)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min` }
const cartKey = (token) => `td_cart_${token}`
const loadCart = (token) => { try { return JSON.parse(sessionStorage.getItem(cartKey(token)) || '{}') } catch { return {} } }
const saveCart = (token, c) => { try { sessionStorage.setItem(cartKey(token), JSON.stringify(c)) } catch { /* sin almacenamiento */ } }

// Carrito: hoja inferior con los productos elegidos, nombre opcional y nota.
const CartSheet = ({ cart, products, mode, onQty, onClose, onSend, sending, error }) => {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const lines = Object.entries(cart).map(([id, q]) => ({ p: products.find((x) => x.id === Number(id)), q })).filter((l) => l.p && l.q > 0)
  const total = lines.reduce((a, l) => a + l.q * l.p.finalPrice, 0)
  return (
    <div className="menu-sheet-backdrop" onClick={onClose}>
      <div className="menu-sheet" role="dialog" aria-label="Tu pedido" onClick={(e) => e.stopPropagation()}>
        <div className="row-between"><h3>Tu pedido</h3><button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Cerrar"><MdClose /></button></div>
        {!lines.length ? <p className="muted">Aún no agregas productos.</p> : (
          <ul className="menu-cart">{lines.map(({ p, q }) => (
            <li key={p.id}>
              <div className="grow"><strong>{p.name}</strong><small>{formatMoney(p.finalPrice)} c/u</small></div>
              <div className="qty-step">
                <button type="button" onClick={() => onQty(p.id, q - 1)} aria-label={`Quitar un ${p.name}`}><MdRemove /></button>
                <b>{q}</b>
                <button type="button" onClick={() => onQty(p.id, q + 1)} aria-label={`Agregar un ${p.name}`} disabled={q >= 20}><MdAdd /></button>
              </div>
              <b className="money">{formatMoney(q * p.finalPrice)}</b>
            </li>
          ))}</ul>
        )}
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Tu nombre (opcional)" aria-label="Tu nombre" />
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} placeholder="Nota para la cocina o el bar (opcional)" aria-label="Nota" />
        {error && <div className="alert bad">{error}</div>}
        <button type="button" className="btn btn-primary btn-block menu-send" disabled={!lines.length || sending} onClick={() => onSend({ name, note, items: lines.map(({ p, q }) => ({ productId: p.id, quantity: q })) })}>
          {sending ? <Spinner /> : <MdShoppingBag />} {mode === 'directo' ? 'Pedir' : mode === 'mixto' ? 'Enviar pedido' : 'Enviar al mesero'} · {formatMoney(total)}
        </button>
        <small className="muted" style={{ textAlign: 'center' }}>{mode === 'directo' ? 'Tu pedido va directo a la cocina y el bar, y se suma a tu cuenta.' : mode === 'mixto' ? 'Lo marcado como "Directo" va de una vez a la cocina y el bar; lo demás lo confirma tu mesero.' : 'Tu mesero confirma el pedido y lo envía a la cocina y el bar.'}</small>
      </div>
    </div>
  )
}

// Calificación del servicio (1 a 5 estrellas y un comentario opcional).
const RateBox = ({ rating, onSend, busy }) => {
  const [stars, setStars] = useState(rating.stars || 0)
  const [comment, setComment] = useState(rating.comment || '')
  const [open, setOpen] = useState(!rating.stars)
  if (!open) return <div className="menu-rate"><span>Calificaste el servicio con {'★'.repeat(rating.stars)} <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>Cambiar</button></span></div>
  return (
    <div className="menu-rate">
      <strong>¿Cómo te atendimos?</strong>
      <div className="stars" role="radiogroup" aria-label="Calificación del servicio">
        {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} estrella${n > 1 ? 's' : ''}`} className={n <= stars ? 'on' : ''} onClick={() => setStars(n)}>★</button>)}
      </div>
      {stars > 0 && <>
        <textarea rows={2} maxLength={300} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={stars >= 4 ? '¿Qué fue lo que más te gustó? (opcional)' : '¿Qué podemos mejorar? (opcional)'} aria-label="Comentario" />
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={async () => { if (await onSend({ stars, comment })) setOpen(false) }}>{busy ? <Spinner /> : <MdStar />} Enviar calificación</button>
      </>}
    </div>
  )
}

// Carta pública de la mesa (QR): datos de la mesa y su cuenta, productos con el precio del momento,
// llamar al mesero o pedir la cuenta y, si el establecimiento lo permite, hacer el pedido.
const MenuPage = () => {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [sent, setSent] = useState('')
  const [busy, setBusy] = useState('')
  const [cart, setCart] = useState(() => loadCart(token))
  const [sheet, setSheet] = useState(false)
  const [sendError, setSendError] = useState('')
  const session = useRef(null)
  const lastActive = useRef(Date.now())
  const [expired, setExpired] = useState('')
  const opts = () => ({ ...NO_SITE, headers: session.current ? { 'x-carta-session': session.current } : {} })
  const onFail = (e) => { if (e?.response?.data?.expired) { setExpired(e.response.data.message); return true } return false }
  const load = useCallback(() => api.get(`/carta/${token}`, opts()).then(({ data: d }) => { session.current = d.session; setData(d); setError('') })
    .catch((e) => { if (!onFail(e)) setError(errorMessage(e)) }), [token]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (expired) return undefined
    load()
    // Se actualiza sola: cada 8 s con la carta a la vista y al volver a ella (por ejemplo, al desbloquear el celular),
    // para que el cliente vea cuando el mesero confirma o entrega sin recargar.
    const tick = () => {
      if (Date.now() - lastActive.current > IDLE_MS) { setExpired('La carta se cerró por inactividad. Escanea de nuevo el código QR de tu mesa para llamar al mesero o pedir.'); return }
      if (document.visibilityState === 'visible') load()
    }
    const t = setInterval(tick, 8000)
    const onShow = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onShow)
    window.addEventListener('focus', onShow)
    window.addEventListener('online', onShow)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onShow); window.removeEventListener('focus', onShow); window.removeEventListener('online', onShow) }
  }, [load, expired])
  // El aviso de "listo" se va solo después de unos segundos.
  useEffect(() => { if (!sent) return undefined; const t = setTimeout(() => setSent(''), 8000); return () => clearTimeout(t) }, [sent])
  useEffect(() => {
    const mark = () => { lastActive.current = Date.now() }
    ACTIVITY.forEach((ev) => window.addEventListener(ev, mark, { passive: true }))
    return () => ACTIVITY.forEach((ev) => window.removeEventListener(ev, mark))
  }, [])
  useEffect(() => { if (data?.business) document.title = `${data.business.name} · Carta` }, [data])
  useEffect(() => { saveCart(token, cart) }, [token, cart])
  const call = async (kind) => {
    setBusy(kind)
    try { const { data: r } = await api.post(`/carta/${token}/llamar`, { kind }, opts()); setSent(r.message); load() } catch (e) { if (!onFail(e)) setSent(errorMessage(e)) }
    setBusy('')
  }
  const setQty = (id, n) => setCart((c) => { const x = { ...c }; if (n > 0) x[id] = Math.min(20, n); else delete x[id]; return x })
  const send = async (body) => {
    setBusy('pedido'); setSendError('')
    try { const { data: r } = await api.post(`/carta/${token}/pedido`, body, opts()); setCart({}); setSheet(false); setSent(r.message); load(); window.scrollTo({ top: 0, behavior: 'smooth' }) } catch (e) { if (!onFail(e)) setSendError(errorMessage(e)) }
    setBusy('')
  }
  const rate = async (body) => {
    setBusy('rate')
    try { const { data: r } = await api.post(`/carta/${token}/calificar`, body, opts()); setSent(r.message); load(); setBusy(''); return true } catch (e) { if (!onFail(e)) setSent(errorMessage(e)); setBusy(''); return false }
  }

  if (expired) {
    const b = data?.business || {}
    return (
      <div className="menu-page" style={{ '--brand': b.primary, '--menu-dark': b.secondary }}>
        <div className="menu-error">
          {b.logoUrl ? <img src={b.logoUrl} alt={b.name} className="menu-logo" /> : <BrandLogo size={36} />}
          <MdQrCodeScanner className="menu-expired-icon" aria-hidden="true" />
          <h2>Escanea de nuevo</h2>
          <p>{expired}</p>
        </div>
      </div>
    )
  }
  if (error && !data) return <div className="menu-page"><div className="menu-error"><BrandLogo size={36} /><p>{error}</p></div></div>
  if (!data) return <div className="splash"><Spinner /></div>
  const b = data.business || {}
  const style = { '--brand': b.primary, '--menu-dark': b.secondary, '--accent': b.accent, fontFamily: b.font ? `'${b.font}', system-ui, sans-serif` : undefined }
  const canOrder = data.canOrder && !data.pendingOrder
  const count = Object.values(cart).reduce((a, n) => a + n, 0)
  const cartTotal = Object.entries(cart).reduce((a, [id, n]) => a + n * (data.products.find((p) => p.id === Number(id))?.finalPrice || 0), 0)
  const o = data.order
  const actions = data.actions || { callWaiter: true, requestBill: true }
  return (
    <div className={`menu-page${canOrder && count ? ' has-cart' : ''}`} style={style}>
      <MenuView data={data} cart={cart} setQty={setQty} canOrder={canOrder} showDirect={data.ordering === 'mixto'}
        header={<span className="menu-table">{data.table.name}</span>}
        top={<>
          <section className="menu-info" aria-label="Tu mesa">
            {data.table.area && <span><MdPlace /> {data.table.area}{data.table.site ? ` · ${data.table.site}` : ''}</span>}
            {!data.table.area && data.table.site && <span><MdPlace /> {data.table.site}</span>}
            <span><MdPeople /> {o?.guests ? `${o.guests} de ${data.table.seats} puestos` : `${data.table.seats} puestos`}</span>
            {o?.waiter && <span><MdPerson /> Te atiende {o.waiter}</span>}
            {o?.openedAt && <span><MdSchedule /> En la mesa hace {since(o.openedAt)}</span>}
          </section>
          {(actions.callWaiter || actions.requestBill) && (
            <div className="menu-actions">
              {actions.callWaiter && <button type="button" className="btn btn-primary" onClick={() => call('mesero')} disabled={Boolean(busy) || data.calls.includes('mesero')}>{busy === 'mesero' ? <Spinner /> : <MdRoomService />} {data.calls.includes('mesero') ? 'Mesero en camino' : 'Llamar al mesero'}</button>}
              {actions.requestBill && <button type="button" className="btn" onClick={() => call('cuenta')} disabled={Boolean(busy) || data.calls.includes('cuenta') || !o}>{busy === 'cuenta' ? <Spinner /> : <MdReceipt />} {data.calls.includes('cuenta') ? 'Cuenta pedida' : 'Pedir la cuenta'}</button>}
            </div>
          )}
          {sent && <div className="menu-sent" role="status"><MdCheckCircle /> {sent}</div>}
          {data.pendingOrder && (
            <div className="menu-pending" role="status">
              <MdHourglassTop />
              <div><strong>Tu pedido está esperando al mesero</strong><small>{data.pendingOrder.items.map((i) => `${i.quantity} × ${i.name}`).join(', ')}{data.pendingOrder.total !== null && ` · ${formatMoney(data.pendingOrder.total)}`}</small></div>
            </div>
          )}
          {o && o.items.length > 0 && (
            <details className="menu-bill" open={o.items.some((i) => i.status === 'pendiente' || i.status === 'preparando')}>
              <summary>{o.total === null ? 'Tu pedido' : <>Tu cuenta · {formatMoney(o.total)}</>}</summary>
              <ul>{o.items.map((i, n) => (
                <li key={n}>
                  <span>{i.quantity} × {i.name}{i.courtesy ? ' 🎁' : ''} {ITEM_STATUS[i.status] && i.status !== 'entregado' && <em className={`menu-st ${i.status}`}>{ITEM_STATUS[i.status]}</em>}</span>
                  {i.price !== null ? <span>{i.courtesy ? 'Cortesía' : formatMoney(i.quantity * i.price)}</span> : i.status === 'entregado' ? <span className="menu-st entregado">Entregado</span> : null}
                </li>
              ))}</ul>
              <small>Pedido {o.number}.{o.total !== null && ' La propina es voluntaria.'}</small>
            </details>
          )}
          {data.rating?.canRate && <RateBox key={data.rating.stars || 0} rating={data.rating} onSend={rate} busy={busy === 'rate'} />}
        </>}
      />

      {canOrder && count > 0 && (
        <button type="button" className="menu-cart-bar" onClick={() => { setSendError(''); setSheet(true) }}>
          <span className="menu-cart-count">{count}</span> Ver mi pedido <b className="money">{formatMoney(cartTotal)}</b>
        </button>
      )}
      {sheet && <CartSheet cart={cart} products={data.products} mode={data.ordering} onQty={setQty} onClose={() => setSheet(false)} onSend={send} sending={busy === 'pedido'} error={sendError} />}
    </div>
  )
}

export default MenuPage
