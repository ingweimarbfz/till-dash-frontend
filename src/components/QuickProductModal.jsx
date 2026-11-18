import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { MdAdd } from 'react-icons/md'
import api, { errorMessage } from '../api/client'
import { Field, Modal, Spinner } from './ui'
import { MoneyInput } from './forms'

const UNITS = { und: 'Unidad', porcion: 'Porción', botella: 'Botella', g: 'Gramos', kg: 'Kilos', ml: 'Mililitros', l: 'Litros' }

// Alta rápida de un producto desde una entrada de inventario: lo mínimo para venderlo y llevar su stock.
// La foto, la descripción y el resto se completan luego en Productos.
const QuickProductModal = ({ initialName = '', supplierId = null, onClose, onSaved }) => {
  const [cats, setCats] = useState(null)
  const [f, setF] = useState({ name: initialName, categoryId: '', unit: 'und', price: '', cost: '', sku: '', minStock: '' })
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }))
  useEffect(() => { api.get('/inventario/categorias').then(({ data }) => setCats((data || []).filter((c) => c.active))).catch(() => setCats([])) }, [])
  // Escape cierra solo este modal, no la entrada de inventario que lo abrió.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])
  const submit = async (e) => {
    e.preventDefault(); e.stopPropagation(); setError('')
    if (!f.name.trim()) return setError('Escribe el nombre del producto.')
    if (!f.categoryId) return setError('Elige la categoría.')
    if (f.price === '') return setError('Escribe el precio de venta.')
    setSaving(true)
    try {
      const { data } = await api.post('/inventario/productos', { ...f, price: Number(f.price) || 0, cost: f.cost === '' ? 0 : Number(f.cost), trackStock: true, showInMenu: true, active: true, supplierId: supplierId || undefined })
      onSaved(data)
    } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  return createPortal(
    <Modal title="Nuevo producto" onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="qp-form" className="btn btn-primary" disabled={saving || !cats}>{saving ? <Spinner /> : <MdAdd />} Crear y agregar</button></>}>
      <form id="qp-form" className="form-grid" onSubmit={submit} noValidate>
        <div className="span-2"><Field label="Nombre" htmlFor="qpn" required><input id="qpn" value={f.name} onChange={set('name')} autoFocus placeholder="Ej. Cerveza Club Colombia 330 ml" /></Field></div>
        <Field label="Categoría" htmlFor="qpc" required>
          <select id="qpc" value={f.categoryId} onChange={set('categoryId')} disabled={!cats}>
            <option value="">{cats ? (cats.length ? 'Elige…' : 'Crea primero una categoría') : 'Cargando…'}</option>
            {(cats || []).map((c) => <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.name}</option>)}
          </select>
        </Field>
        <Field label="Unidad de medida" htmlFor="qpu"><select id="qpu" value={f.unit} onChange={set('unit')}>{Object.entries(UNITS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Precio de venta" htmlFor="qpp" required><MoneyInput id="qpp" value={f.price} onChange={set('price')} /></Field>
        <Field label="Costo" htmlFor="qpk" hint="Lo puedes ajustar en la entrada"><MoneyInput id="qpk" value={f.cost} onChange={set('cost')} /></Field>
        <Field label="Código (SKU)" htmlFor="qps"><input id="qps" value={f.sku} onChange={set('sku')} placeholder="Opcional" /></Field>
        <Field label="Stock mínimo" htmlFor="qpm" hint="Avisa cuando quede poco"><input id="qpm" type="number" min="0" step="any" inputMode="decimal" value={f.minStock} onChange={set('minStock')} /></Field>
        <small className="muted span-2">Queda con inventario y visible en la carta. La foto y la descripción se agregan luego en Productos.</small>
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>,
    document.body
  )
}

export default QuickProductModal
