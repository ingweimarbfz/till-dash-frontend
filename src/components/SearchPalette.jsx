import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { MdSearch, MdPersonAdd, MdPlace, MdWarehouse, MdManageAccounts, MdNorthEast, MdKeyboardReturn, MdAddBusiness, MdRestaurantMenu, MdCategory, MdLocalOffer, MdMoveToInbox, MdReceiptLong, MdTableRestaurant, MdRequestQuote } from 'react-icons/md'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { navFor } from '../utils/nav'
import { usePlan } from '../context/PlanContext'
import { Spinner } from './ui'

// Acciones rápidas por rol (aparecen sin escribir nada, y se filtran al escribir).
const ADMIN_ACTIONS = [
  { label: 'Nuevo usuario', hint: 'Mesero, cajero, cocina…', to: '/usuarios?nuevo=1', icon: MdPersonAdd, words: 'crear registrar usuario empleado mesero cajero' },
  { label: 'Nueva sucursal', hint: 'Con su propia bodega', to: '/sucursales?nueva=1', icon: MdAddBusiness, words: 'crear sucursal sede local' },
  { label: 'Nuevo producto', hint: 'Plato, bebida o artículo de la carta', to: '/productos?nuevo=1', icon: MdRestaurantMenu, words: 'crear producto plato bebida carta menu' },
  { label: 'Nueva categoría', hint: 'Bebidas, comida rápida, postres…', to: '/categorias?nueva=1', icon: MdCategory, words: 'crear categoria carta' },
  { label: 'Entrada o traslado de inventario', hint: 'Compras, ajustes, bajas y traslados', to: '/inventario?tab=movimientos', icon: MdMoveToInbox, words: 'inventario entrada compra traslado bodega ajuste baja stock' }
]
const ACTIONS = { superadmin: ADMIN_ACTIONS, admin: ADMIN_ACTIONS }
const GROUP_ICON = { pedidos: MdReceiptLong, mesas: MdTableRestaurant, cuentas: MdRequestQuote, productos: MdRestaurantMenu, categorias: MdCategory, promociones: MdLocalOffer, usuarios: MdManageAccounts, sucursales: MdPlace, bodegas: MdWarehouse }
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export const useSearchShortcut = (open) => {
  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open() } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
}

// Buscador global: usuarios, sucursales, bodegas y pantallas. Ignora tildes. Cada etapa suma fuentes
// (productos, mesas, órdenes por número…).
const SearchPalette = ({ onClose }) => {
  const { user } = useAuth()
  const { has } = usePlan()
  const navigate = useNavigate()
  const input = useRef(null)
  const listRef = useRef(null)
  const [q, setQ] = useState('')
  const [remote, setRemote] = useState({ q: '', groups: [] })
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)

  useEffect(() => { input.current?.focus() }, [])
  useEffect(() => {
    const t = q.trim()
    if (t.length < 2) { setRemote({ q: t, groups: [] }); setLoading(false); return undefined }
    setLoading(true)
    const timer = setTimeout(() => {
      api.get('/buscar', { params: { q: t } }).then(({ data }) => setRemote(data)).catch(() => setRemote({ q: t, groups: [] })).finally(() => setLoading(false))
    }, 220)
    return () => clearTimeout(timer)
  }, [q])

  const groups = useMemo(() => {
    const t = norm(q.trim())
    const pages = navFor(user.role, user.positions, has).flatMap((s) => s.items.filter((i) => !i.soon).map((i) => ({ id: i.to, title: i.label, subtitle: s.title, to: i.to, icon: i.icon })))
    const acts = (ACTIONS[user.role] || []).map((a) => ({ id: a.to, title: a.label, subtitle: a.hint, to: a.to, icon: a.icon, words: a.words }))
    const match = (x) => !t || norm(`${x.title} ${x.subtitle} ${x.words || ''}`).includes(t)
    const out = []
    if (!t) out.push({ key: 'acciones', label: 'Acciones rápidas', items: acts })
    const remoteGroups = remote.q === q.trim() ? remote.groups : []
    out.push(...remoteGroups.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i, icon: GROUP_ICON[g.key] })) })))
    if (t) {
      const a = acts.filter(match)
      if (a.length) out.push({ key: 'acciones', label: 'Acciones', items: a })
    }
    const p = pages.filter(match).slice(0, t ? 5 : 8)
    if (p.length) out.push({ key: 'paginas', label: 'Ir a', items: p })
    return out
  }, [q, remote, user.role])
  const flat = useMemo(() => groups.flatMap((g) => g.items.map((i) => ({ ...i, key: `${g.key}-${i.id}` }))), [groups])
  useEffect(() => { setActive(0) }, [groups])
  useEffect(() => { listRef.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest' }) }, [active])

  const go = (item) => { if (!item) return; onClose(); navigate(item.to) }
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); go(flat[active]) }
    else if (e.key === 'Escape') onClose()
  }
  const searched = q.trim().length >= 2 && !loading && remote.q === q.trim()
  const nothing = searched && !remote.groups.length
  let idx = -1

  return createPortal(
    <div className="palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-label="Buscar">
        <div className="palette-input">
          <MdSearch />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Buscar usuario, cédula, sucursal, bodega o pantalla…" aria-label="Buscar" />
          {loading ? <Spinner /> : <kbd className="kbd">Esc</kbd>}
        </div>
        <div className="palette-list" ref={listRef}>
          {nothing && <div className="palette-empty">Sin resultados para "{q.trim()}". Prueba con la cédula, el celular o el número del crédito.</div>}
          {groups.map((g) => (
            <div key={g.key} className="palette-group">
              <div className="palette-label">{g.label}</div>
              {g.items.map((i) => {
                idx += 1
                const n = idx
                const Icon = i.icon || MdNorthEast
                return (
                  <button key={`${g.key}-${i.id}`} type="button" className={`palette-item${n === active ? ' on' : ''}`} onMouseMove={() => setActive(n)} onClick={() => go(i)}>
                    {i.image ? <img src={i.image} alt="" /> : <span className="palette-icon"><Icon /></span>}
                    <span className="grow"><strong>{i.title}</strong>{i.subtitle && <small>{i.subtitle}</small>}</span>
                    {i.badge && <span className="badge muted">{i.badge}</span>}
                    {n === active && <MdKeyboardReturn className="palette-enter" />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        <div className="palette-foot hide-sm"><span><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> moverse</span><span><kbd className="kbd">Enter</kbd> abrir</span><span><kbd className="kbd">Ctrl</kbd><kbd className="kbd">K</kbd> buscar desde cualquier pantalla</span></div>
      </div>
    </div>,
    document.body
  )
}

export default SearchPalette
