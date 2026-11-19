import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MdAdd, MdEdit, MdDelete, MdQrCode2, MdRestaurantMenu, MdSchedule, MdPlace, MdArrowUpward, MdArrowDownward, MdStar, MdVisibilityOff, MdSave, MdBolt, MdRoomService, MdReceipt, MdCheckCircle } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { usePlan } from '../../context/PlanContext'
import { Badge, Card, Empty, Field, Modal, PageHead, Spinner, useToast } from '../../components/ui'
import { PhotoInput, Tabs } from '../../components/forms'
import MenuView from '../../components/menu/MenuView'

const ADMIN = ['superadmin', 'admin']
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const scheduleText = (m) => {
  const d = m.days.length === 7 ? 'Todos los días' : m.days.map((x) => DAYS[x]).join(', ')
  return m.timeFrom ? `${d} · ${m.timeFrom} a ${m.timeTo}` : d
}

// ---------- Vista: la carta como la ve el cliente ----------
const Preview = ({ menus }) => {
  const [menuId, setMenuId] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    setData(null)
    api.get('/cartas/vista', { params: { carta: menuId || undefined } }).then(({ data: d }) => { setData(d); setError('') }).catch((e) => setError(errorMessage(e)))
  }, [menuId])
  const now = menus?.find((m) => m.now)
  return (
    <div className="carta-preview">
      <div className="toolbar">
        <select value={menuId} onChange={(e) => setMenuId(e.target.value)} aria-label="Carta">
          <option value="">La que ve el cliente ahora{now ? ` (${now.name})` : ''}</option>
          {(menus || []).map((m) => <option key={m.id} value={m.id}>{m.name}{m.active ? '' : ' · inactiva'}</option>)}
        </select>
        {data && <small className="muted">{data.products.length} productos · {data.categories.length} secciones{data.orderMode !== 'none' ? ' · el cliente puede pedir desde el QR' : ''}</small>}
      </div>
      {error && <div className="alert bad">{error}</div>}
      {!data ? <div className="splash" style={{ minHeight: 240 }}><Spinner /></div> : (
        <div className="carta-phone"><div className="menu-page" style={{ '--brand': data.business?.primary, '--menu-dark': data.business?.secondary, '--accent': data.business?.accent }}>
          <MenuView data={data} showDirect={data.orderMode === 'mixto'} header={<span className="menu-table">Vista previa</span>} />
        </div></div>
      )}
    </div>
  )
}

// ---------- Editor de una carta ----------
const MenuEditor = ({ initial, catalog, onClose, onSaved }) => {
  const editing = Boolean(initial?.id)
  const [f, setF] = useState({
    name: '', title: '', welcome: '', coverUrl: null, layout: 'lista', showPhotos: true, showDescriptions: true, soldOut: 'marcar', footerNote: '',
    siteIds: [], days: [0, 1, 2, 3, 4, 5, 6], timeFrom: '', timeTo: '', categoryIds: [], featuredIds: [], hiddenProductIds: [], active: true, sortOrder: 0, ...(initial || {})
  })
  const [q, setQ] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v?.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v }))
  const toggleIn = (k, id) => setF((x) => ({ ...x, [k]: x[k].includes(id) ? x[k].filter((y) => y !== id) : [...x[k], id] }))
  // TD-025: con sucursales elegidas, solo lo que se vende en al menos una de ellas.
  const sold = (ids) => !f.siteIds.length || !ids?.length || ids.some((id) => f.siteIds.includes(id))
  const menuCats = catalog.categories.filter((c) => c.active && c.showInMenu && sold(c.siteIds))
  // Secciones elegidas en su orden; si no eligió ninguna, la carta muestra todas.
  const chosen = f.categoryIds.length ? f.categoryIds : []
  const move = (id, d) => setF((x) => {
    const list = [...x.categoryIds]; const i = list.indexOf(id); const j = i + d
    if (i < 0 || j < 0 || j >= list.length) return x
    ;[list[i], list[j]] = [list[j], list[i]]
    return { ...x, categoryIds: list }
  })
  const prods = catalog.products.filter((p) => p.active && p.showInMenu && sold(p.siteIds) && sold(p.categorySiteIds) && (!chosen.length || chosen.includes(p.categoryId)) && (!q || p.name.toLowerCase().includes(q.toLowerCase())))
  const submit = async (e) => {
    e.preventDefault(); setError(''); setSaving(true)
    const body = { ...f, timeFrom: f.timeFrom || null, timeTo: f.timeTo || null }
    try {
      const { data } = editing ? await api.put(`/cartas/${initial.id}`, body) : await api.post('/cartas', body)
      onSaved(data, editing)
    } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  return (
    <Modal size="xl" title={editing ? `Carta · ${initial.name}` : 'Nueva carta'} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="menu-form" className="btn btn-primary" disabled={saving}>{saving ? <Spinner /> : <MdSave />} Guardar carta</button></>}>
      <form id="menu-form" className="carta-editor" onSubmit={submit} noValidate>
        <section className="stack" style={{ gap: 12 }}>
          <h4 className="section-title">Presentación</h4>
          <div className="form-grid">
            <Field label="Nombre interno" htmlFor="mn" required hint="Ej. Carta de día, Carta de noche, Licores"><input id="mn" value={f.name} onChange={set('name')} autoFocus /></Field>
            <Field label="Título para el cliente" htmlFor="mt" hint="Vacío: el nombre del establecimiento"><input id="mt" value={f.title || ''} onChange={set('title')} /></Field>
            <div className="span-2"><Field label="Mensaje de bienvenida" htmlFor="mw"><input id="mw" value={f.welcome || ''} onChange={set('welcome')} maxLength={300} placeholder="Ej. Happy hour de 5 a 7 p. m. en cócteles" /></Field></div>
            <Field label="Diseño" htmlFor="ml"><select id="ml" value={f.layout} onChange={set('layout')}><option value="lista">Lista</option><option value="cuadricula">Cuadrícula con fotos grandes</option></select></Field>
            <Field label="Productos agotados" htmlFor="ms"><select id="ms" value={f.soldOut} onChange={set('soldOut')}><option value="marcar">Mostrar como agotados</option><option value="ocultar">Ocultarlos</option></select></Field>
            <label className="check"><input type="checkbox" checked={f.showPhotos} onChange={set('showPhotos')} /> Mostrar fotos</label>
            <label className="check"><input type="checkbox" checked={f.showDescriptions} onChange={set('showDescriptions')} /> Mostrar descripciones</label>
            <div className="span-2"><Field label="Nota al final" htmlFor="mf"><input id="mf" value={f.footerNote || ''} onChange={set('footerNote')} maxLength={200} placeholder="Ej. Precios con impuestos incluidos. La propina es voluntaria." /></Field></div>
            <div className="span-2"><Field label="Foto de portada"><PhotoInput value={f.coverUrl} onChange={set('coverUrl')} label="Elegir portada" round={false} withThumb /></Field></div>
          </div>
          <h4 className="section-title">¿Cuándo y dónde se muestra?</h4>
          <div className="chip-list">{DAYS.map((d, i) => <button key={d} type="button" className={`pchip${f.days.includes(i) ? ' on' : ''}`} onClick={() => toggleIn('days', i)}>{d}</button>)}</div>
          <div className="form-grid">
            <Field label="Desde" htmlFor="mtf" hint="Vacío: todo el día"><input id="mtf" type="time" value={f.timeFrom || ''} onChange={set('timeFrom')} /></Field>
            <Field label="Hasta" htmlFor="mtt" hint="Si es menor, pasa la medianoche"><input id="mtt" type="time" value={f.timeTo || ''} onChange={set('timeTo')} /></Field>
          </div>
          {catalog.sites.length > 1 && (
            <div>
              <span className="label-sm">Sucursales {f.siteIds.length ? '' : '· todas'}</span>
              <div className="chip-list" style={{ marginTop: 6 }}>{catalog.sites.map((s) => <button key={s.id} type="button" className={`pchip${f.siteIds.includes(s.id) ? ' on' : ''}`} onClick={() => toggleIn('siteIds', s.id)}>{s.name}</button>)}</div>
            </div>
          )}
          <div className="form-grid">
            <Field label="Prioridad" htmlFor="mp" hint="Si dos cartas aplican a la vez, gana la de número menor"><input id="mp" type="number" min={0} value={f.sortOrder} onChange={set('sortOrder')} /></Field>
            <label className="check" style={{ alignSelf: 'end' }}><input type="checkbox" checked={f.active} onChange={set('active')} /> Carta activa</label>
          </div>
        </section>
        <section className="stack" style={{ gap: 12 }}>
          <h4 className="section-title">Secciones {chosen.length ? `· ${chosen.length} elegidas` : '· todas'}</h4>
          <small className="muted">Toca para incluir una sección y ordénala con las flechas. Si no eliges ninguna, la carta muestra todas.</small>
          <ul className="carta-sections">
            {[...chosen.map((id) => menuCats.find((c) => c.id === id)).filter(Boolean), ...menuCats.filter((c) => !chosen.includes(c.id))].map((c) => {
              const on = chosen.includes(c.id)
              return (
                <li key={c.id} className={on ? 'on' : ''}>
                  <label className="check"><input type="checkbox" checked={on} onChange={() => toggleIn('categoryIds', c.id)} /> {c.emoji} {c.name}</label>
                  {on && <span className="row" style={{ gap: 2 }}><button type="button" className="btn btn-ghost btn-icon" aria-label="Subir" onClick={() => move(c.id, -1)}><MdArrowUpward /></button><button type="button" className="btn btn-ghost btn-icon" aria-label="Bajar" onClick={() => move(c.id, 1)}><MdArrowDownward /></button></span>}
                </li>
              )
            })}
            {!menuCats.length && <li className="muted"><small>No hay categorías marcadas "en la carta". Créalas en Categorías.</small></li>}
          </ul>
          <h4 className="section-title">Productos · destacados y ocultos</h4>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto" aria-label="Buscar producto" />
          <ul className="carta-products">
            {prods.map((p) => (
              <li key={p.id} className={f.hiddenProductIds.includes(p.id) ? 'off' : ''}>
                <span className="grow"><strong>{p.name}</strong><small className="muted">{p.categoryEmoji} {p.category}</small></span>
                <button type="button" className={`btn btn-sm${f.featuredIds.includes(p.id) ? ' on' : ''}`} title="Destacar al inicio de la carta" onClick={() => toggleIn('featuredIds', p.id)}><MdStar /> {f.featuredIds.includes(p.id) ? 'Destacado' : 'Destacar'}</button>
                <button type="button" className={`btn btn-sm${f.hiddenProductIds.includes(p.id) ? ' on' : ''}`} title="No mostrar en esta carta" onClick={() => toggleIn('hiddenProductIds', p.id)}><MdVisibilityOff /> {f.hiddenProductIds.includes(p.id) ? 'Oculto' : 'Ocultar'}</button>
              </li>
            ))}
            {!prods.length && <li className="muted"><small>No hay productos en la carta con ese filtro.</small></li>}
          </ul>
          {error && <div className="alert bad">{error}</div>}
        </section>
      </form>
    </Modal>
  )
}

// ---------- Lista de cartas ----------
const MenusTab = ({ menus, catalog, onReload, toast }) => {
  const [modal, setModal] = useState(null)
  const del = async (m) => {
    if (!window.confirm(`¿Eliminar la carta "${m.name}"?`)) return // eslint-disable-line no-alert
    try { await api.delete(`/cartas/${m.id}`); toast('Carta eliminada'); onReload() } catch (e) { toast(errorMessage(e), 'bad') }
  }
  const siteNames = (ids) => (ids.length ? ids.map((id) => catalog.sites.find((s) => s.id === id)?.name).filter(Boolean).join(', ') : 'Todas las sucursales')
  return (
    <div className="stack">
      <div className="alert"><span>Arma una o varias cartas: por ejemplo, <b>Desayunos</b> de 7 a 11 a. m. y <b>Carta de noche</b> desde las 6 p. m. El QR muestra la carta activa que aplica a la sucursal en ese momento; si ninguna aplica, muestra todos los productos marcados "en la carta".</span></div>
      <div className="carta-grid">
        {menus.map((m) => (
          <Card key={m.id} title={m.name} subtitle={m.title || null} icon={<MdRestaurantMenu />}
            actions={<div className="card-actions"><button type="button" className="btn btn-ghost btn-icon" aria-label={`Editar ${m.name}`} onClick={() => setModal(m)}><MdEdit /></button><button type="button" className="btn btn-ghost btn-icon" aria-label={`Eliminar ${m.name}`} onClick={() => del(m)}><MdDelete /></button></div>}>
            <div className="stack" style={{ gap: 6 }}>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {m.now ? <Badge tone="ok">Se muestra ahora</Badge> : m.active ? <Badge>Activa</Badge> : <Badge tone="muted">Inactiva</Badge>}
                <Badge tone="muted">{m.layout === 'cuadricula' ? 'Cuadrícula' : 'Lista'}</Badge>
                {m.featuredIds.length > 0 && <Badge tone="brand">{m.featuredIds.length} destacados</Badge>}
              </div>
              <small><MdSchedule /> {scheduleText(m)}</small>
              <small><MdPlace /> {siteNames(m.siteIds)}</small>
              <small className="muted">{m.categoryIds.length ? `${m.categoryIds.length} secciones` : 'Todas las secciones'}{m.hiddenProductIds.length ? ` · ${m.hiddenProductIds.length} productos ocultos` : ''}</small>
            </div>
          </Card>
        ))}
        <button type="button" className="carta-new" onClick={() => setModal({})}><MdAdd /> Nueva carta</button>
      </div>
      {modal && <MenuEditor initial={modal.id ? modal : null} catalog={catalog} onClose={() => setModal(null)} onSaved={(d, e) => { setModal(null); toast(e ? 'Carta guardada' : `Carta ${d.name} creada`); onReload() }} />}
    </div>
  )
}

// ---------- Opciones del QR ----------
// TD-025: generales o por sucursal. Una sucursal sin opciones propias usa las generales.
const QrOptions = ({ catalog, toast }) => {
  const [o, setO] = useState(null)
  const [saving, setSaving] = useState(false)
  const [site, setSite] = useState('')
  const sites = (catalog.sites || []).filter((s) => s.active !== false)
  useEffect(() => { setO(null); api.get('/cartas/opciones', { params: site ? { sucursal: site } : {} }).then(({ data }) => setO(data)).catch((e) => toast(errorMessage(e), 'bad')) }, [toast, site])
  if (!o) return <div className="splash" style={{ minHeight: 200 }}><Spinner /></div>
  if (!o.qrModule) return <Card><Empty icon={<MdQrCode2 />}>Tu plan no incluye la carta por QR. <Link to="/mi-plan">Ver Mi plan</Link>.</Empty></Card>
  const set = (k) => (e) => setO((x) => ({ ...x, [k]: e.target.checked }))
  const both = o.orderConfirm && o.orderDirect
  const save = async () => {
    setSaving(true)
    try { const { data } = await api.put('/cartas/opciones', { ...o, siteId: site || null }); setO(data); toast(site ? 'Opciones del QR de la sucursal guardadas' : 'Opciones del QR guardadas') } catch (e) { toast(errorMessage(e), 'bad') } finally { setSaving(false) }
  }
  const useGeneral = async () => {
    setSaving(true)
    try { const { data } = await api.put('/cartas/opciones', { siteId: site, useGeneral: true }); setO(data); toast('La sucursal vuelve a usar las opciones generales') } catch (e) { toast(errorMessage(e), 'bad') } finally { setSaving(false) }
  }
  const siteName = sites.find((s) => s.id === Number(site))?.name
  const siteCats = catalog.categories.filter((c) => c.active && c.showInMenu && (!site || !c.siteIds?.length || c.siteIds.includes(Number(site))))
  const OPTS = [
    ['callWaiter', <MdRoomService key="i" />, 'Llamar al mesero', 'El cliente avisa que necesita atención; el personal recibe el aviso con sonido.'],
    ['requestBill', <MdReceipt key="i" />, 'Pedir la cuenta', 'La mesa queda marcada "por cobrar" en el salón.'],
    ['orderConfirm', <MdCheckCircle key="i" />, 'Pedir con confirmación', 'El cliente arma su pedido y el mesero lo acepta antes de que llegue a cocina y bar.'],
    ['orderDirect', <MdBolt key="i" />, 'Pedir directo', 'El pedido entra a la cuenta de la mesa y a las comandas al instante.']
  ]
  return (
    <div className="grid grid-2-1">
      <Card title="¿Qué puede hacer el cliente al escanear el QR?" subtitle="Activa todas las opciones que quieras al mismo tiempo." icon={<MdQrCode2 />}
        actions={<button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? <Spinner /> : <MdSave />} Guardar</button>}>
        <div className="stack" style={{ gap: 8 }}>
          {sites.length > 1 && (
            <div className="qr-direct">
              <b><MdPlace /> ¿Para qué sucursal?</b>
              <div className="chip-list">
                <button type="button" className={`pchip${site ? '' : ' on'}`} onClick={() => setSite('')}>Generales (todas)</button>
                {sites.map((s) => <button key={s.id} type="button" className={`pchip${Number(site) === s.id ? ' on' : ''}`} onClick={() => setSite(String(s.id))}>{s.name}</button>)}
              </div>
              {site && (o.own
                ? <small className="muted">{siteName} tiene sus propias opciones. <button type="button" className="link-btn" onClick={useGeneral} disabled={saving}>Volver a las generales</button></small>
                : <small className="muted">{siteName} usa las opciones generales. Si cambias algo y guardas, la sucursal queda con las suyas.</small>)}
              {!site && <small className="muted">Aplican en las sucursales que no tienen opciones propias.</small>}
            </div>
          )}
          {OPTS.map(([k, icon, l, d]) => (
            <label key={k} className={`check-card${o[k] ? ' on' : ''}`}>
              <input type="checkbox" checked={o[k]} onChange={set(k)} />
              <span><b>{icon} {l}</b><small>{d}</small></span>
            </label>
          ))}
          {both && (
            <div className="qr-direct">
              <b>¿Qué va directo a cocina y bar?</b>
              <small className="muted">Las categorías marcadas entran de una vez; el resto lo confirma el mesero. Ej. bebidas directo y platos fuertes con confirmación.</small>
              <div className="chip-list">{siteCats.map((c) => {
                const on = o.directCategories.includes(c.id)
                return <button key={c.id} type="button" className={`pchip${on ? ' on' : ''}`} onClick={() => setO((x) => ({ ...x, directCategories: on ? x.directCategories.filter((y) => y !== c.id) : [...x.directCategories, c.id] }))}>{c.emoji} {c.name}</button>
              })}</div>
            </div>
          )}
          <div className="qr-direct">
            <b><MdReceipt /> ¿Qué ve el cliente de su cuenta?</b>
            <small className="muted">Si prefieres que el cliente disfrute sin estar pendiente del valor, muestra solo lo que pidió o nada.</small>
            <div className="seg seg-wrap">
              {[['completa', 'Cuenta completa', 'Productos, valores y total'], ['sin_valores', 'Solo lo pedido', 'Productos y su estado, sin valores'], ['oculta', 'Nada', 'No se muestra la cuenta']].map(([k, l, d]) => (
                <button key={k} type="button" className={`btn btn-sm${(o.billView || 'completa') === k ? ' on' : ''}`} onClick={() => setO((x) => ({ ...x, billView: k }))} title={d}>{l}</button>
              ))}
            </div>
            <small className="muted">{{ completa: 'El cliente ve cada producto con su valor y el total de la cuenta.', sin_valores: 'El cliente ve lo que pidió y si está en preparación, pero no los valores ni el total.', oculta: 'El cliente no ve su cuenta en la carta; el mesero se la presenta al cobrar.' }[o.billView || 'completa']}</small>
          </div>
          <small className="muted">Sin un turno de caja abierto en la sucursal, el cliente no puede pedir; solo llamar al mesero o pedir la cuenta.</small>
        </div>
      </Card>
      <Card title="Códigos QR de las mesas" icon={<MdQrCode2 />}>
        <p className="muted" style={{ marginTop: 0 }}>Cada mesa tiene su código. Imprímelo desde la configuración de mesas y pégalo en la mesa.</p>
        <Link to="/configuracion/mesas" className="btn btn-block">Imprimir QR de las mesas</Link>
      </Card>
    </div>
  )
}

// Módulo Carta: todo el personal la consulta; el administrador arma las cartas y las opciones del QR.
const CartaPage = () => {
  const { user } = useAuth()
  const plan = usePlan()
  const admin = ADMIN.includes(user.role)
  const [params, setParams] = useSearchParams()
  const [tab, setTabState] = useState(admin && ['cartas', 'qr'].includes(params.get('tab')) ? params.get('tab') : 'ver')
  const setTab = (t) => { setTabState(t); setParams(t === 'ver' ? {} : { tab: t }, { replace: true }) }
  const [menus, setMenus] = useState(null)
  const [catalog, setCatalog] = useState(null)
  const [toast, toastNode] = useToast()
  const loadMenus = useCallback(() => api.get('/cartas').then(({ data }) => setMenus(data.rows)).catch(() => setMenus([])), [])
  useEffect(() => { loadMenus() }, [loadMenus])
  useEffect(() => {
    if (!admin) return
    Promise.all([api.get('/inventario/categorias'), api.get('/inventario/productos'), api.get('/sedes')])
      .then(([c, p, s]) => setCatalog({ categories: c.data, products: p.data, sites: (s.data || []).filter((x) => x.active) }))
      .catch((e) => toast(errorMessage(e), 'bad'))
  }, [admin, toast])
  const tabs = useMemo(() => [['ver', 'Ver carta'], ...(admin ? [['cartas', 'Cartas'], ...(plan.has('carta_qr') ? [['qr', 'Opciones del QR']] : [])] : [])], [admin, plan])
  return (
    <div className="stack">
      <PageHead title="Carta" subtitle={admin ? 'Así ve el cliente la carta. Arma cartas por horario y sucursal, y elige qué puede hacer desde el QR.' : 'La carta tal como la ve el cliente: precios, promociones y productos agotados.'} />
      {tabs.length > 1 && <Tabs value={tab} onChange={setTab} tabs={tabs} />}
      {tab === 'ver' && <Preview menus={menus} />}
      {tab === 'cartas' && admin && (!menus || !catalog ? <div className="splash" style={{ minHeight: 200 }}><Spinner /></div> : <MenusTab menus={menus} catalog={catalog} onReload={loadMenus} toast={toast} />)}
      {tab === 'qr' && admin && (!catalog ? <div className="splash" style={{ minHeight: 200 }}><Spinner /></div> : <QrOptions catalog={catalog} toast={toast} />)}
      {toastNode}
    </div>
  )
}

export default CartaPage
