import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MdAdd, MdEdit, MdSearch, MdRestaurantMenu, MdVisibility, MdMoveToInbox } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Badge, Card, Empty, Field, Modal, PageHead, Spinner, useToast } from '../../components/ui'
import { MoneyInput, PhotoInput } from '../../components/forms'
import { formatMoney } from '../../utils/format'
import { PromoTag, PromoPrice } from './promotions'
import { AREAS, fmtQty, MovementModal, UNITS, useWarehouses, WarehouseOptions } from './common'
import { notifyStock } from '../../components/StockAlerts'

const ADMIN = ['superadmin', 'admin']

// ---------------------------------------------------------------- Formulario del producto
const ProductForm = ({ initial, categories, sites, warehouses, main, onClose, onSaved }) => {
  const editing = Boolean(initial?.id)
  const [form, setForm] = useState({
    sku: '', name: '', categoryId: '', description: '', unit: 'und', cost: '', price: '', trackStock: true, minStock: 0,
    initialStock: 0, warehouseId: main?.id || '', photoUrl: null, gallery: [], showInMenu: true, active: true, ...(initial || {})
  })
  const [loadingGallery, setLoadingGallery] = useState(editing)
  // La lista no trae la galería: al editar se carga la ficha completa.
  useEffect(() => { if (editing) api.get(`/inventario/productos/${initial.id}`).then(({ data }) => setForm((f) => ({ ...f, gallery: data.gallery || [] }))).finally(() => setLoadingGallery(false)) }, [editing, initial?.id])
  const setGallery = (i) => (v) => setForm((f) => { const g = [...(f.gallery || [])]; g[i] = v; return { ...f, gallery: g } })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }))
  const submit = async (e) => {
    e.preventDefault(); setError('')
    if (!form.name.trim()) return setError('Escribe el nombre del producto.')
    if (!form.categoryId) return setError('Selecciona la categoría. Si no existe, créala en Categorías.')
    setSaving(true)
    try {
      const body = { ...form, gallery: (form.gallery || []).filter(Boolean) }
      if (loadingGallery) delete body.gallery
      const { data } = editing ? await api.put(`/inventario/productos/${initial.id}`, body) : await api.post('/inventario/productos', body)
      onSaved(data, editing)
    } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  const margin = Number(form.price) && Number(form.cost) ? Math.round(((form.price - form.cost) / form.price) * 100) : null
  const activeCats = categories.filter((c) => c.active || c.id === Number(form.categoryId))
  return (
    <Modal size="lg" title={editing ? 'Editar producto' : 'Nuevo producto'} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="product-form" className="btn btn-primary" disabled={saving}>{saving && <Spinner />} Guardar</button></>}>
      <form id="product-form" className="form-grid" onSubmit={submit} noValidate>
        <div className="span-2"><PhotoInput value={form.photoUrl} round={false} label="Foto principal" onChange={set('photoUrl')} /></div>
        <div className="span-2"><Field label="Imágenes adicionales (opcionales, hasta 3)" hint="Se ven en la ficha del producto y en la carta por QR.">
          {loadingGallery ? <Spinner /> : <div className="gallery-inputs">{[0, 1, 2].map((i) => <PhotoInput key={i} value={form.gallery?.[i] || null} round={false} label={`Imagen ${i + 2}`} onChange={setGallery(i)} />)}</div>}
        </Field></div>
        <Field label="Nombre" htmlFor="pn" required><input id="pn" value={form.name} onChange={set('name')} placeholder="Ej. Hamburguesa doble, Cerveza Club Colombia" /></Field>
        <Field label="Categoría" htmlFor="pc" required hint={activeCats.length ? null : 'Primero crea una categoría'}>
          <select id="pc" value={form.categoryId || ''} onChange={set('categoryId')}><option value="">Selecciona…</option>{activeCats.map((c) => <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.name}</option>)}</select>
        </Field>
        <Field label="Código (SKU)" htmlFor="ps"><input id="ps" value={form.sku || ''} onChange={set('sku')} /></Field>
        <Field label="Unidad de medida" htmlFor="pu"><select id="pu" value={form.unit} onChange={set('unit')}>{Object.entries(UNITS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Precio de venta" htmlFor="ppr" required hint={margin !== null ? `Margen ${margin} %` : null}><MoneyInput id="ppr" value={form.price} onChange={set('price')} /></Field>
        <Field label="Costo" htmlFor="pco" hint="Se actualiza con cada entrada"><MoneyInput id="pco" value={form.cost} onChange={set('cost')} /></Field>
        <div className="span-2"><label className="check"><input type="checkbox" checked={form.trackStock} onChange={set('trackStock')} /> Maneja inventario (desmárcalo para platos que se preparan al momento)</label></div>
        {form.trackStock && <Field label="Stock mínimo por bodega" htmlFor="pmin" hint="Al llegar aquí avisa con un toast y por Telegram"><input id="pmin" type="number" step="any" min="0" value={form.minStock} onChange={set('minStock')} /></Field>}
        {form.trackStock && !editing && <Field label="Stock inicial" htmlFor="pini"><input id="pini" type="number" step="any" min="0" value={form.initialStock} onChange={set('initialStock')} /></Field>}
        {form.trackStock && !editing && Number(form.initialStock) > 0 && <div className="span-2"><Field label="Bodega del stock inicial" htmlFor="pwh"><select id="pwh" value={form.warehouseId} onChange={set('warehouseId')}><WarehouseOptions sites={sites} warehouses={warehouses} /></select></Field></div>}
        <div className="span-2"><Field label="Descripción" htmlFor="pd" hint="Ingredientes o detalle que verá el cliente en la carta"><textarea id="pd" rows={2} value={form.description || ''} onChange={set('description')} /></Field></div>
        <label className="check"><input type="checkbox" checked={form.showInMenu} onChange={set('showInMenu')} /> Mostrar en la carta</label>
        {editing && <label className="check"><input type="checkbox" checked={form.active} onChange={set('active')} /> Producto activo</label>}
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------- Página
const ProductsPage = () => {
  const { user } = useAuth()
  const admin = ADMIN.includes(user.role)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [products, setProducts] = useState(null)
  const [categories, setCategories] = useState([])
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('')
  const [modal, setModal] = useState(null)
  const [toast, toastNode] = useToast()
  const { sites, warehouses, main } = useWarehouses()
  const load = useCallback(() => {
    api.get('/inventario/productos').then(({ data }) => setProducts(data)).catch((e) => { setProducts([]); toast(errorMessage(e), 'bad') })
    api.get('/inventario/categorias').then(({ data }) => setCategories(data)).catch(() => setCategories([]))
  }, [toast])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (params.get('nuevo') && admin) { setModal({ product: {} }); setParams({}, { replace: true }) } }, [params, setParams, admin])

  const shown = useMemo(() => (products || []).filter((p) =>
    (!cat || (cat === 'bajo' ? p.lowStock : cat === 'promo' ? p.promo : cat === 'inactivos' ? !p.active : String(p.categoryId) === cat)) &&
    (cat === 'inactivos' || p.active || !cat) &&
    (!query || `${p.name} ${p.sku || ''}`.toLowerCase().includes(query.toLowerCase()))), [products, query, cat])

  const changed = (msg, alerts) => { setModal(null); toast(msg); notifyStock(alerts); load() }

  return (
    <div className="stack">
      <PageHead title="Productos" subtitle="La carta del establecimiento: precio, costo, foto y existencias. Las promociones vigentes cambian el precio solas.">
        {admin && <>
          <button type="button" className="btn" onClick={() => setModal({ move: {} })}><MdMoveToInbox /> Entrada</button>
          <button type="button" className="btn btn-primary" onClick={() => setModal({ product: {} })}><MdAdd /> Producto</button>
        </>}
      </PageHead>
      <Card flush>
        <div className="toolbar">
          <div className="input-icon grow"><MdSearch /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre o código" /></div>
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filtro">
            <option value="">Todas las categorías</option>
            <option value="bajo">Con stock bajo</option>
            <option value="promo">En promoción</option>
            <option value="inactivos">Inactivos</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.name}</option>)}
          </select>
        </div>
        {!products ? <div className="splash" style={{ minHeight: 160 }}><Spinner /></div>
          : !shown.length ? <Empty icon={<MdRestaurantMenu />}>{products.length ? 'Ningún producto coincide.' : admin ? 'Aún no hay productos. Crea primero las categorías y luego tus productos.' : 'Aún no hay productos.'}</Empty> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Producto</th><th className="hide-sm">Categoría</th>{admin && <th className="num hide-md">Costo</th>}<th className="num">Precio</th><th className="num">Existencias</th><th className="hide-md">Por bodega</th><th /></tr></thead>
              <tbody>{shown.map((p) => (
                <tr key={p.id} style={p.active ? undefined : { opacity: 0.55 }}>
                  <td><div className="person">{p.photoUrl ? <img className="thumb sq" src={p.photoUrl} alt="" /> : <span className="thumb sq">{p.categoryEmoji}</span>}<div>
                    <button type="button" className="link-btn" onClick={() => navigate(`/productos/${p.id}`)}><strong>{p.name}</strong></button>{p.promo && <> <PromoTag p={p.promo} size="sm" /></>}
                    <small>{[p.sku, UNITS[p.unit], !p.showInMenu && 'no sale en la carta', !p.active && 'inactivo'].filter(Boolean).join(' · ')}</small>
                  </div></div></td>
                  <td className="hide-sm"><Badge>{p.category || 'Sin categoría'}</Badge><small className="block muted">{AREAS[p.area] || ''}</small></td>
                  {admin && <td className="num money hide-md">{formatMoney(p.cost)}</td>}
                  <td className="num money"><PromoPrice product={p} /></td>
                  <td className="num">{!p.trackStock ? <small className="muted">No aplica</small> : p.lowStock ? <Badge tone={p.stock > 0 ? 'warn' : 'bad'}>{fmtQty(p.stock, p.unit)}</Badge> : <strong>{fmtQty(p.stock, p.unit)}</strong>}</td>
                  <td className="hide-md"><small>{p.byWarehouse?.length ? p.byWarehouse.map((w) => `${w.name}: ${fmtQty(w.stock)}`).join(' · ') : '—'}</small></td>
                  <td className="right nowrap">
                    <button type="button" className="btn btn-ghost btn-icon" title="Ver ficha" aria-label={`Ver ${p.name}`} onClick={() => navigate(`/productos/${p.id}`)}><MdVisibility /></button>
                    {admin && <button type="button" className="btn btn-ghost btn-icon" title="Editar" aria-label={`Editar ${p.name}`} onClick={() => setModal({ product: p })}><MdEdit /></button>}
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
      </Card>
      {modal?.product && <ProductForm initial={modal.product.id ? modal.product : null} categories={categories} sites={sites} warehouses={warehouses} main={main}
        onClose={() => setModal(null)} onSaved={(p, was) => changed(was ? 'Producto actualizado' : 'Producto creado')} />}
      {modal?.move && products && <MovementModal products={products} sites={sites} warehouses={warehouses} defaults={{ warehouseId: main ? String(main.id) : '' }} onClose={() => setModal(null)} onSaved={changed} />}
      {toastNode}
    </div>
  )
}

export default ProductsPage
export { ProductForm }
