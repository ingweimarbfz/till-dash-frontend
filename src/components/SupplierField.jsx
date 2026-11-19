import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { MdAdd } from 'react-icons/md'
import api, { errorMessage, getSiteFilter } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Field, Modal, Spinner } from './ui'

// Proveedores activos, compartidos entre formularios (se recargan al crear uno).
let cache = null
export const loadSuppliers = (fresh = false) => {
  if (!cache || fresh) cache = api.get('/proveedores', { params: { activos: '1' } }).then(({ data }) => data).catch((e) => { cache = null; throw e })
  return cache
}
export const SUPPLIER_CATEGORIES = {
  bebidas: 'Bebidas', alimentos: 'Alimentos', licores: 'Licores', insumos: 'Insumos y desechables', aseo: 'Aseo y limpieza',
  servicios: 'Servicios públicos', mantenimiento: 'Mantenimiento', tecnologia: 'Tecnología', publicidad: 'Publicidad', otro: 'Otro'
}

// Alta rápida desde cualquier formulario: lo mínimo para registrarlo; el resto se completa en Proveedores.
export const QuickSupplierModal = ({ initialName = '', onClose, onSaved }) => {
  const [f, setF] = useState({ name: initialName, docType: 'NIT', docNumber: '', phone: '', category: 'otro', contactName: '' })
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  // Escape cierra solo este modal, no el formulario que lo abrió.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])
  const submit = async (e) => {
    e.preventDefault(); e.stopPropagation(); setError(''); setSaving(true)
    try { const { data } = await api.post('/proveedores', f); await loadSuppliers(true); onSaved(data) } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  return createPortal(
    <Modal title="Nuevo proveedor" onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="qs-form" className="btn btn-primary" disabled={saving}>{saving ? <Spinner /> : <MdAdd />} Crear proveedor</button></>}>
      <form id="qs-form" className="form-grid" onSubmit={submit} noValidate>
        <div className="span-2"><Field label="Nombre" htmlFor="qsn" required><input id="qsn" value={f.name} onChange={set('name')} autoFocus placeholder="Ej. Distribuidora El Mono" /></Field></div>
        <Field label="Tipo de documento" htmlFor="qst"><select id="qst" value={f.docType} onChange={set('docType')}>{['NIT', 'CC', 'CE', 'RUT', 'Otro'].map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Número" htmlFor="qsd"><input id="qsd" value={f.docNumber} onChange={set('docNumber')} placeholder="900123456-7" /></Field>
        <Field label="Categoría" htmlFor="qsc"><select id="qsc" value={f.category} onChange={set('category')}>{Object.entries(SUPPLIER_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Contacto" htmlFor="qsk"><input id="qsk" value={f.contactName} onChange={set('contactName')} placeholder="Nombre del vendedor" /></Field>
        <Field label="Teléfono" htmlFor="qsp"><input id="qsp" inputMode="tel" value={f.phone} onChange={set('phone')} /></Field>
        <small className="muted span-2">Completa la cuenta bancaria, los días de crédito y el resto de datos en Proveedores.</small>
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>,
    document.body
  )
}

// Selector de proveedor. value: { supplierId, supplier }. allowFree: permite escribir un nombre sin registrarlo
// (ej. "tienda de la esquina" en un gasto de caja).
// TD-025: solo los proveedores de la sucursal (siteId, o la elegida arriba, o la del empleado) y los de todas.
const SupplierField = ({ id = 'supplier', label = 'Proveedor', value, onChange, allowFree = false, hint, placeholder = 'Sin proveedor', siteId = null }) => {
  const { user } = useAuth()
  const site = Number(siteId) || getSiteFilter() || user?.siteId || null
  const admin = ['superadmin', 'admin'].includes(user?.role)
  const [list, setList] = useState(null)
  const [free, setFree] = useState(Boolean(!value?.supplierId && value?.supplier))
  const [modal, setModal] = useState(false)
  const forSite = (rows) => (rows || []).filter((s) => !site || !s.siteIds?.length || s.siteIds.includes(site) || s.id === Number(value?.supplierId))
  useEffect(() => { loadSuppliers().then((d) => setList(forSite(d.rows))).catch(() => setList([])) }, [site]) // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (e) => {
    const v = e.target.value
    if (v === '__free') { setFree(true); onChange({ supplierId: null, supplier: '' }); return }
    if (v === '__new') { setModal(true); return }
    setFree(false)
    const s = (list || []).find((x) => x.id === Number(v))
    onChange({ supplierId: s ? s.id : null, supplier: s ? s.name : '' })
  }
  const selected = free ? '__free' : value?.supplierId ? String(value.supplierId) : ''
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="supplier-field">
        <select id={id} value={selected} onChange={pick} disabled={!list}>
          <option value="">{list ? placeholder : 'Cargando…'}</option>
          {(list || []).map((s) => <option key={s.id} value={s.id}>{s.name}{s.docNumber ? ` · ${s.docType} ${s.docNumber}` : ''}</option>)}
          {allowFree && <option value="__free">Otro (escribir el nombre)</option>}
          {admin && <option value="__new">+ Registrar proveedor nuevo…</option>}
        </select>
        {free && <input aria-label={`${label}: nombre`} value={value?.supplier || ''} onChange={(e) => onChange({ supplierId: null, supplier: e.target.value })} placeholder="Ej. tienda de la esquina" autoFocus />}
      </div>
      {modal && <QuickSupplierModal initialName={free ? value?.supplier : ''} onClose={() => setModal(false)} onSaved={(s) => { setModal(false); setFree(false); loadSuppliers().then((d) => setList(forSite(d.rows))); onChange({ supplierId: s.id, supplier: s.name }) }} />}
    </Field>
  )
}

export default SupplierField
