import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MdRoomService, MdReceipt, MdSearch, MdCheckCircle } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { BrandLogo } from '../../components/Logo'
import { Spinner } from '../../components/ui'
import { formatMoney } from '../../utils/format'

// Carta pública de la mesa (QR): productos con el precio del momento, la cuenta abierta,
// y botones para llamar al mesero o pedir la cuenta. No pide iniciar sesión.
const MenuPage = () => {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [sent, setSent] = useState('')
  const [busy, setBusy] = useState('')
  const load = useCallback(() => api.get(`/carta/${token}`, { params: { sede: undefined } }).then(({ data: d }) => { setData(d); setError('') }).catch((e) => setError(errorMessage(e))), [token])
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [load])
  useEffect(() => { if (data?.business) document.title = `${data.business.name} · Carta` }, [data])
  const call = async (kind) => {
    setBusy(kind)
    try { const { data: r } = await api.post(`/carta/${token}/llamar`, { kind }, { params: { sede: undefined } }); setSent(r.message); load() } catch (e) { setSent(errorMessage(e)) }
    setBusy('')
  }
  const products = useMemo(() => {
    const f = q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return (data?.products || []).filter((p) => (cat === 'all' || p.categoryId === Number(cat)) && (!f || p.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(f)))
  }, [data, cat, q])

  if (error && !data) return <div className="menu-page"><div className="menu-error"><BrandLogo size={36} /><p>{error}</p></div></div>
  if (!data) return <div className="splash"><Spinner /></div>
  const b = data.business || {}
  const style = { '--brand': b.primary, '--menu-dark': b.secondary, '--accent': b.accent, fontFamily: b.font ? `'${b.font}', system-ui, sans-serif` : undefined }
  const cats = data.categories.filter((c) => products.some((p) => p.categoryId === c.id))
  return (
    <div className="menu-page" style={style}>
      <header className="menu-hero">
        {b.logoUrl ? <img src={b.logoUrl} alt={b.name} className="menu-logo" /> : <BrandLogo size={34} onDark />}
        <h1>{b.name}</h1>
        {b.slogan && <p>{b.slogan}</p>}
        <span className="menu-table">{data.table.name}{data.table.site ? ` · ${data.table.site}` : ''}</span>
      </header>

      <div className="menu-actions">
        <button type="button" className="btn btn-primary" onClick={() => call('mesero')} disabled={Boolean(busy) || data.calls.includes('mesero')}>{busy === 'mesero' ? <Spinner /> : <MdRoomService />} {data.calls.includes('mesero') ? 'Mesero en camino' : 'Llamar al mesero'}</button>
        <button type="button" className="btn" onClick={() => call('cuenta')} disabled={Boolean(busy) || data.calls.includes('cuenta') || !data.order}>{busy === 'cuenta' ? <Spinner /> : <MdReceipt />} {data.calls.includes('cuenta') ? 'Cuenta pedida' : 'Pedir la cuenta'}</button>
      </div>
      {sent && <div className="menu-sent" role="status"><MdCheckCircle /> {sent}</div>}

      {data.order && data.order.items.length > 0 && (
        <details className="menu-bill">
          <summary>Tu cuenta · {formatMoney(data.order.total)}</summary>
          <ul>{data.order.items.map((i, n) => <li key={n}><span>{i.quantity} × {i.name}{i.courtesy ? ' 🎁' : ''}</span><span>{i.courtesy ? 'Cortesía' : formatMoney(i.quantity * i.price)}</span></li>)}</ul>
          <small>Pedido {data.order.number}. La propina es voluntaria.</small>
        </details>
      )}

      <div className="menu-filters">
        <div className="input-icon"><MdSearch /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en la carta" aria-label="Buscar en la carta" /></div>
        <div className="chip-list scroll-x">
          <button type="button" className={`pchip${cat === 'all' ? ' on' : ''}`} onClick={() => setCat('all')}>Todo</button>
          {data.categories.map((c) => <button key={c.id} type="button" className={`pchip${cat === String(c.id) ? ' on' : ''}`} onClick={() => setCat(String(c.id))}>{c.emoji} {c.name}</button>)}
        </div>
      </div>

      {cats.map((c) => (
        <section key={c.id} className="menu-section">
          <h2>{c.emoji} {c.name}</h2>
          {c.description && <p className="muted">{c.description}</p>}
          <ul className="menu-list">{products.filter((p) => p.categoryId === c.id).map((p) => (
            <li key={p.id} className={p.soldOut ? 'sold' : ''}>
              {p.photoUrl && <img src={p.photoUrl} alt="" loading="lazy" />}
              <div className="grow">
                <strong>{p.name}</strong>
                {p.description && <small>{p.description}</small>}
                {p.promo && <span className="menu-promo" style={{ background: p.promo.color }}>{p.promo.emoji} {p.promo.tag || p.promo.name}</span>}
              </div>
              <div className="menu-price">
                {p.soldOut ? <span className="badge muted">Agotado</span> : p.promo ? <><s>{formatMoney(p.price)}</s><b>{formatMoney(p.finalPrice)}</b></> : <b>{formatMoney(p.price)}</b>}
              </div>
            </li>
          ))}</ul>
        </section>
      ))}
      {!cats.length && <p className="muted" style={{ textAlign: 'center' }}>No hay productos con ese filtro.</p>}
      <footer className="menu-foot">Hecho con TillDash+</footer>
    </div>
  )
}

export default MenuPage
