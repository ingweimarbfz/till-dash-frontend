import React, { useCallback, useEffect, useState } from 'react'
import { MdAdd, MdEdit, MdLocalOffer } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Badge, Card, Empty, Field, Modal, PageHead, Spinner, useToast } from '../../components/ui'
import { MoneyInput, SitePicker, siteNamesOf, Tabs, useSites } from '../../components/forms'
import { PromotionsTab } from './promotions'
import { DISCOUNT_ICONS, DiscountIcon, discountValue, PALETTE } from './common'

const ADMIN = ['superadmin', 'admin']

const DiscountForm = ({ initial, onClose, onSaved }) => {
  const editing = Boolean(initial?.id)
  const [f, setF] = useState({ name: '', type: 'porcentaje', value: '', icon: 'tag', color: PALETTE[0], description: '', requiresReason: false, active: true, siteIds: [], ...(initial || {}) })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setError('')
    if (!f.name.trim()) return setError('El nombre es requerido.')
    if (!(Number(f.value) > 0)) return setError('Ingresa un valor mayor que cero.')
    if (f.type === 'porcentaje' && Number(f.value) > 100) return setError('El porcentaje no puede superar 100.')
    setSaving(true)
    try { const body = { ...f, value: Number(f.value) }; editing ? await api.put(`/descuentos/${f.id}`, body) : await api.post('/descuentos', body); onSaved(editing) } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  return (
    <Modal title={editing ? 'Editar descuento' : 'Nuevo descuento'} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="disc-form" className="btn btn-primary" disabled={saving}>{saving && <Spinner />} Guardar</button></>}>
      <form id="disc-form" className="form-grid" onSubmit={submit} noValidate>
        <div className="span-2 disc-preview"><DiscountIcon d={f} size={44} /><div><strong>{f.name || 'Nombre del descuento'}</strong><small className="block">{f.value ? discountValue({ ...f, value: Number(f.value) }) : '—'}{f.description ? ` · ${f.description}` : ''}</small></div></div>
        <div className="span-2"><Field label="Nombre" htmlFor="dn" required><input id="dn" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ej. Cliente frecuente, Cumpleañero, Empleados" autoFocus /></Field></div>
        <Field label="Tipo" htmlFor="dt"><select id="dt" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="porcentaje">Porcentaje (%)</option><option value="valor">Valor fijo ($)</option></select></Field>
        <Field label={f.type === 'porcentaje' ? 'Porcentaje' : 'Valor'} htmlFor="dv" required>{f.type === 'porcentaje' ? <input id="dv" inputMode="decimal" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} placeholder="10" /> : <MoneyInput id="dv" value={f.value} onChange={(v) => setF({ ...f, value: v })} />}</Field>
        <div className="span-2"><Field label="Ícono">
          <div className="disc-icons">{Object.entries(DISCOUNT_ICONS).map(([k, I]) => (
            <button key={k} type="button" className={f.icon === k ? 'on' : ''} aria-label={k} aria-pressed={f.icon === k} onClick={() => setF({ ...f, icon: k })} style={f.icon === k ? { borderColor: f.color, color: f.color, background: `${f.color}14` } : undefined}><I /></button>
          ))}</div>
        </Field></div>
        <div className="span-2"><Field label="Color" hint="Identifica el descuento en pedidos y reportes">
          <div className="disc-colors">{PALETTE.map((c) => (
            <button key={c} type="button" className={f.color === c ? 'on' : ''} style={{ background: c }} aria-label={`Color ${c}`} aria-pressed={f.color === c} onClick={() => setF({ ...f, color: c })} />
          ))}</div>
        </Field></div>
        <div className="span-2"><Field label="Descripción" htmlFor="dd"><input id="dd" value={f.description || ''} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="A quién aplica" /></Field></div>
        <label className="check span-2"><input type="checkbox" checked={f.requiresReason} onChange={(e) => setF({ ...f, requiresReason: e.target.checked })} /> Pedir el motivo cuando se aplique</label>
        <SitePicker value={f.siteIds || []} onChange={(v) => setF((x) => ({ ...x, siteIds: v }))} hint="Sin elegir ninguna, el descuento se puede usar en todas las sucursales." />
        {editing && <label className="check span-2"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Activo</label>}
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>
  )
}

const DiscountsTab = ({ admin, toast }) => {
  const [rows, setRows] = useState(null)
  const [modal, setModal] = useState(null)
  const sites = useSites()
  const load = useCallback(() => { api.get('/descuentos').then(({ data }) => setRows(data)).catch(() => setRows([])) }, [])
  useEffect(() => { load() }, [load])
  return (
    <Card flush title="Descuentos" subtitle="Se aplican al total de un pedido al cobrar (etapa 3)" icon={<MdLocalOffer />} actions={admin && <button type="button" className="btn btn-sm btn-primary" onClick={() => setModal({})}><MdAdd /> Descuento</button>}>
      {!rows ? <div className="splash" style={{ minHeight: 120 }}><Spinner /></div> : !rows.length ? <Empty>Sin descuentos. Crea, por ejemplo, “Cliente frecuente 10 %”.</Empty> : (
        <ul className="wh-list">{rows.map((d) => (
          <li key={d.id} style={d.active ? undefined : { opacity: 0.55 }}>
            <DiscountIcon d={d} />
            <div className="grow"><strong>{d.name} <span className="badge" style={{ background: `${d.color}1F`, color: d.color }}>{discountValue(d)}</span></strong> {!d.active && <Badge tone="muted">Inactivo</Badge>}<small>{d.description || (d.type === 'porcentaje' ? 'Porcentaje sobre el total' : 'Valor fijo')}{d.requiresReason ? ' · pide motivo' : ''}{sites.length > 1 && d.siteIds?.length ? ` · solo en ${siteNamesOf(sites, d.siteIds)}` : ''}</small></div>
            {admin && <button type="button" className="btn btn-ghost btn-icon" aria-label={`Editar ${d.name}`} onClick={() => setModal(d)}><MdEdit /></button>}
          </li>
        ))}</ul>
      )}
      {modal && <DiscountForm initial={modal.id ? modal : null} onClose={() => setModal(null)} onSaved={(e) => { setModal(null); toast(e ? 'Descuento actualizado' : 'Descuento creado'); load() }} />}
    </Card>
  )
}

// Promociones (precio especial automático) y descuentos (al cobrar un pedido).
const PromotionsPage = () => {
  const { user } = useAuth()
  const admin = ADMIN.includes(user.role)
  const [tab, setTab] = useState(() => (new URLSearchParams(window.location.search).get('tab') === 'descuentos' ? 'descuentos' : 'promociones'))
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [toast, toastNode] = useToast()
  useEffect(() => {
    api.get('/inventario/categorias').then(({ data }) => setCategories(data)).catch(() => {})
    api.get('/inventario/productos', { params: { activos: 1, sede: undefined } }).then(({ data }) => setProducts(data)).catch(() => {})
  }, [])
  return (
    <div className="stack">
      <PageHead title="Promociones y descuentos" subtitle="Las promociones cambian el precio solas según la fecha, la hora y el día. Los descuentos se aplican al cobrar." />
      <Tabs value={tab} onChange={setTab} tabs={[['promociones', 'Promociones'], ['descuentos', 'Descuentos']]} />
      {tab === 'promociones' && <PromotionsTab admin={admin} categories={categories} products={products} toast={toast} onChanged={() => {}} />}
      {tab === 'descuentos' && <DiscountsTab admin={admin} toast={toast} />}
      {toastNode}
    </div>
  )
}

export default PromotionsPage
