import React, { useMemo, useState } from 'react'
import { MdSearch, MdAdd, MdRemove, MdStar, MdBolt } from 'react-icons/md'
import { BrandLogo } from '../Logo'
import { formatMoney } from '../../utils/format'

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Botón para agregar al pedido (solo en la carta del cliente cuando puede pedir).
const AddControl = ({ p, n, setQty }) => (n ? (
  <div className="qty-step sm">
    <button type="button" onClick={() => setQty(p.id, n - 1)} aria-label={`Quitar un ${p.name}`}><MdRemove /></button>
    <b>{n}</b>
    <button type="button" onClick={() => setQty(p.id, n + 1)} aria-label={`Agregar otro ${p.name}`} disabled={n >= 20}><MdAdd /></button>
  </div>
) : <button type="button" className="menu-add" onClick={() => setQty(p.id, 1)} aria-label={`Agregar ${p.name}`}><MdAdd /> Agregar</button>)

const Price = ({ p }) => (p.soldOut ? <span className="badge muted">Agotado</span> : p.promo ? <><s>{formatMoney(p.price)}</s><b>{formatMoney(p.finalPrice)}</b></> : <b>{formatMoney(p.price)}</b>)

// Carta con la presentación configurada: portada, bienvenida, destacados, secciones y productos (lista o cuadrícula).
// La usan la carta del cliente (QR) y el módulo Carta del personal.
const MenuView = ({ data, header = null, top = null, cart = {}, setQty = null, canOrder = false, showDirect = false }) => {
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const b = data.business || {}
  const m = data.menu || {}
  const grid = m.layout === 'cuadricula'
  const products = useMemo(() => {
    const f = norm(q.trim())
    return (data.products || []).filter((p) => (cat === 'all' || p.categoryId === Number(cat)) && (!f || norm(p.name).includes(f)))
  }, [data, cat, q])
  const cats = data.categories.filter((c) => products.some((p) => p.categoryId === c.id))
  const featured = (m.featured || []).map((id) => data.products.find((p) => p.id === id)).filter(Boolean)
  const item = (p) => {
    const n = cart[p.id] || 0
    return (
      <li key={p.id} className={p.soldOut ? 'sold' : ''}>
        {p.photoUrl && <img src={p.photoUrl} alt="" loading="lazy" />}
        <div className="grow">
          <strong>{p.name}</strong>
          {p.description && <small>{p.description}</small>}
          <span className="menu-tags">
            {p.promo && <span className="menu-promo" style={{ background: p.promo.color }}>{p.promo.emoji} {p.promo.tag || p.promo.name}</span>}
            {showDirect && p.direct && <span className="menu-direct" title="Va directo a cocina y bar"><MdBolt /> Directo</span>}
          </span>
        </div>
        <div className="menu-price">
          <Price p={p} />
          {canOrder && setQty && !p.soldOut && <AddControl p={p} n={n} setQty={setQty} />}
        </div>
      </li>
    )
  }
  return (
    <>
      <header className={`menu-hero${m.coverUrl ? ' cover' : ''}`} style={m.coverUrl ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.25), rgba(0,0,0,.72)), url(${m.coverUrl})` } : undefined}>
        {b.logoUrl ? <img src={b.logoUrl} alt={b.name} className="menu-logo" /> : <BrandLogo size={34} onDark />}
        <h1>{m.title || b.name}</h1>
        {(m.welcome || b.slogan) && <p>{m.welcome || b.slogan}</p>}
        {header}
      </header>
      {top}
      {featured.length > 0 && cat === 'all' && !q && (
        <section className="menu-featured" aria-label="Recomendados">
          <h2><MdStar /> Recomendados</h2>
          <div className="menu-featured-row">{featured.map((p) => (
            <div key={p.id} className={`menu-feat${p.soldOut ? ' sold' : ''}`}>
              {p.photoUrl ? <img src={p.photoUrl} alt="" loading="lazy" /> : <span className="ph" aria-hidden="true">★</span>}
              <strong>{p.name}</strong>
              <div className="menu-price"><Price p={p} />{canOrder && setQty && !p.soldOut && <AddControl p={p} n={cart[p.id] || 0} setQty={setQty} />}</div>
            </div>
          ))}</div>
        </section>
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
          <ul className={`menu-list${grid ? ' grid' : ''}`}>{products.filter((p) => p.categoryId === c.id).map(item)}</ul>
        </section>
      ))}
      {!cats.length && <p className="muted" style={{ textAlign: 'center' }}>{data.products.length ? 'No hay productos con ese filtro.' : 'Esta carta aún no tiene productos.'}</p>}
      {m.footerNote && <p className="menu-note">{m.footerNote}</p>}
      <footer className="menu-foot">Hecho con TillDash+</footer>
    </>
  )
}

export default MenuView
