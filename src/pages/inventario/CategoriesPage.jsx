import React, { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MdAdd, MdEdit, MdCategory } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Badge, Card, Empty, Field, Modal, PageHead, Spinner, useToast } from '../../components/ui'
import { AREAS, PALETTE } from './common'
import { SitePicker, siteNamesOf, useSites } from '../../components/forms'

const ADMIN = ['superadmin', 'admin']
const EMOJIS = ['🍺', '🍹', '🍷', '🥃', '☕', '🥤', '🍔', '🍕', '🌮', '🍟', '🥗', '🍝', '🥩', '🍣', '🍰', '🍨', '🛒', '🚬']
const AREA_HINT = { cocina: 'Los pedidos van a la pantalla de cocina', bar: 'Los pedidos van a la barra', barista: 'Los pedidos van al barista', ninguna: 'Se entrega directo (empacados, cigarrillos…)' }

const CategoryForm = ({ initial, onClose, onSaved }) => {
  const [f, setF] = useState({ name: '', description: '', emoji: '', color: PALETTE[0], area: 'cocina', sortOrder: 0, showInMenu: true, active: true, siteIds: [], ...(initial || {}) })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }))
  const submit = async (e) => {
    e.preventDefault(); setError('')
    if (!f.name.trim()) return setError('Escribe el nombre de la categoría.')
    setSaving(true)
    try { f.id ? await api.put(`/inventario/categorias/${f.id}`, f) : await api.post('/inventario/categorias', f); onSaved(Boolean(f.id)) } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  return (
    <Modal title={f.id ? 'Editar categoría' : 'Nueva categoría'} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="cat-form" className="btn btn-primary" disabled={saving}>{saving && <Spinner />} Guardar</button></>}>
      <form id="cat-form" className="form-grid" onSubmit={submit} noValidate>
        <div className="span-2 disc-preview"><span className="icon-bubble" style={{ background: `${f.color}22`, color: f.color, fontSize: 22 }}>{f.emoji || <MdCategory />}</span><div><strong>{f.name || 'Nombre de la categoría'}</strong><small className="block">{AREAS[f.area]}{f.showInMenu ? '' : ' · no sale en la carta'}</small></div></div>
        <div className="span-2"><Field label="Nombre" htmlFor="cn" required><input id="cn" value={f.name} onChange={set('name')} placeholder="Ej. Bebidas, Comida rápida, Postres" autoFocus /></Field></div>
        <div className="span-2"><Field label="Emoji">
          <div className="emoji-pick">
            {EMOJIS.map((em) => <button key={em} type="button" className={f.emoji === em ? 'on' : ''} onClick={() => setF((x) => ({ ...x, emoji: em }))} aria-label={`Emoji ${em}`}>{em}</button>)}
            <input className="emoji-free" value={f.emoji || ''} onChange={set('emoji')} aria-label="Otro emoji" placeholder="Otro" />
          </div>
        </Field></div>
        <div className="span-2"><Field label="Color">
          <div className="disc-colors">{PALETTE.map((c) => <button key={c} type="button" className={f.color === c ? 'on' : ''} style={{ background: c }} aria-label={`Color ${c}`} aria-pressed={f.color === c} onClick={() => setF((x) => ({ ...x, color: c }))} />)}</div>
        </Field></div>
        <Field label="Área de preparación" htmlFor="ca" hint={AREA_HINT[f.area]}><select id="ca" value={f.area} onChange={set('area')}>{Object.entries(AREAS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Orden en la carta" htmlFor="co" hint="Menor número, más arriba"><input id="co" type="number" value={f.sortOrder} onChange={set('sortOrder')} /></Field>
        <div className="span-2"><Field label="Descripción" htmlFor="cd"><input id="cd" value={f.description || ''} onChange={set('description')} /></Field></div>
        <SitePicker value={f.siteIds || []} onChange={(v) => setF((x) => ({ ...x, siteIds: v }))} hint="Sin elegir ninguna, la categoría y sus productos se venden en todas las sucursales." />
        <label className="check"><input type="checkbox" checked={f.showInMenu} onChange={set('showInMenu')} /> Mostrar en la carta</label>
        {f.id && <label className="check"><input type="checkbox" checked={f.active} onChange={set('active')} /> Activa</label>}
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>
  )
}

// Categorías de la carta: emoji, color, orden y a qué área de preparación van sus pedidos.
const CategoriesPage = () => {
  const { user } = useAuth()
  const admin = ADMIN.includes(user.role)
  const [rows, setRows] = useState(null)
  const [modal, setModal] = useState(null)
  const [toast, toastNode] = useToast()
  const [params, setParams] = useSearchParams()
  const sites = useSites()
  const load = useCallback(() => { api.get('/inventario/categorias').then(({ data }) => setRows(data)).catch((e) => { setRows([]); toast(errorMessage(e), 'bad') }) }, [toast])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (params.get('nueva') && admin) { setModal({}); setParams({}, { replace: true }) } }, [params, setParams, admin])
  return (
    <div className="stack">
      <PageHead title="Categorías" subtitle="Agrupan los productos en la carta y deciden a qué área (cocina, bar o barista) va cada pedido.">
        {admin && <button type="button" className="btn btn-primary" onClick={() => setModal({})}><MdAdd /> Categoría</button>}
      </PageHead>
      {!rows ? <div className="splash" style={{ minHeight: 160 }}><Spinner /></div> : !rows.length ? (
        <Card><Empty icon={<MdCategory />}>Aún no hay categorías. Crea las de tu carta: bebidas, comida rápida, postres…</Empty></Card>
      ) : (
        <div className="cat-grid">{rows.map((c) => (
          <div key={c.id} className="cat-card" style={{ '--cat': c.color, opacity: c.active ? 1 : 0.55 }}>
            <span className="cat-emoji">{c.emoji || <MdCategory />}</span>
            <div className="grow">
              <strong>{c.name}</strong>
              <small>{c.products ?? 0} producto{c.products === 1 ? '' : 's'} · {c.areaLabel}</small>
              <span className="badges">{c.siteIds?.length > 0 && sites.length > 1 && <Badge tone="info">{siteNamesOf(sites, c.siteIds)}</Badge>}{!c.showInMenu && <Badge tone="muted">No sale en la carta</Badge>}{!c.active && <Badge tone="muted">Inactiva</Badge>}</span>
            </div>
            {admin && <button type="button" className="btn btn-ghost btn-icon" aria-label={`Editar ${c.name}`} onClick={() => setModal(c)}><MdEdit /></button>}
          </div>
        ))}</div>
      )}
      {modal && <CategoryForm initial={modal.id ? modal : null} onClose={() => setModal(null)} onSaved={(e) => { setModal(null); toast(e ? 'Categoría actualizada' : 'Categoría creada'); load() }} />}
      {toastNode}
    </div>
  )
}

export default CategoriesPage
