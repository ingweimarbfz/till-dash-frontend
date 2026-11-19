import React, { useState } from 'react'
import { MdPersonAdd } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { Field, Modal, Spinner } from '../../components/ui'
import { formErrors } from '../../utils/validate'

// =====================================================================
// Datos del domiciliario (TD-022): base de la empresa o propia, externo y vehículo con o sin placa.
// =====================================================================
export const VEHICLES = [['moto', 'Moto'], ['carro', 'Carro'], ['bicicleta', 'Bicicleta'], ['patineta', 'Patineta eléctrica'], ['a_pie', 'A pie'], ['otro', 'Otro']]
const WITH_PLATE = ['moto', 'carro']
const NO_PLATE = ['bicicleta', 'patineta', 'a_pie']
export const hasPlate = (f) => (WITH_PLATE.includes(f.vehicleType) ? true : NO_PLATE.includes(f.vehicleType) || !f.vehicleType ? false : Boolean(f.vehicleHasPlate))
export const normPlate = (v) => String(v || '').toUpperCase().replace(/[\s.-]/g, '')
export const EMPTY_COURIER = { courierFloat: 'empresa', courierExternal: false, vehicleType: '', vehicleHasPlate: false, vehiclePlate: '' }
export const courierForm = (u) => ({ courierFloat: u?.courierFloat || 'empresa', courierExternal: Boolean(u?.courierExternal), vehicleType: u?.vehicleType || '', vehicleHasPlate: Boolean(u?.vehicleHasPlate), vehiclePlate: u?.vehiclePlate || '' })
// Errores del vehículo para mostrar antes de guardar.
export const vehicleErrors = (f) => {
  if (!hasPlate(f)) return []
  const p = normPlate(f.vehiclePlate)
  if (!p) return [`Escribe la placa ${f.vehicleType === 'moto' ? 'de la moto' : f.vehicleType === 'carro' ? 'del carro' : 'del vehículo'}.`]
  return /^[A-Z0-9]{4,8}$/.test(p) ? [] : ['La placa solo admite letras y números (4 a 8), por ejemplo ABC123 o ABC12D.']
}
export const courierBody = (f) => ({ courierFloat: f.courierFloat, courierExternal: f.courierExternal, vehicleType: f.vehicleType || null, vehicleHasPlate: hasPlate(f), vehiclePlate: hasPlate(f) ? normPlate(f.vehiclePlate) : null })
// Texto de un domiciliario en las listas: "Pedro · Externo · Moto ABC12D".
export const courierText = (c) => [c.name, c.external ? 'Externo' : null, c.vehicle].filter(Boolean).join(' · ')

// Base y vehículo. `form` y `setForm` del formulario que lo contiene.
export const CourierFields = ({ form, setForm, showExternal = true, idPrefix = 'cf' }) => {
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const plate = hasPlate(form)
  return (
    <>
      <span className="profile-checks-title">¿Con qué base trabaja?</span>
      <div className="seg seg-wrap" style={{ gridColumn: '1 / -1' }}>
        {[['empresa', 'Con base de la empresa'], ['propia', 'Con su propia base']].map(([k, l]) => (
          <button key={k} type="button" className={`btn btn-sm${form.courierFloat === k ? ' on' : ''}`} onClick={() => set({ courierFloat: k })} aria-pressed={form.courierFloat === k}>{l}</button>
        ))}
      </div>
      <small className="hint" style={{ gridColumn: '1 / -1' }}>{form.courierFloat === 'propia' ? 'Da el cambio con su dinero: no se le entrega base de la caja. Igual trae a caja lo que cobró de sus domicilios.' : 'La caja le entrega base de cambio en Domicilios y la liquida al final de la jornada.'}</small>
      {showExternal && (
        <label className={`check-card${form.courierExternal ? ' on' : ''}`} style={{ gridColumn: '1 / -1' }}>
          <input type="checkbox" checked={form.courierExternal} onChange={(e) => set({ courierExternal: e.target.checked })} />
          <span><b>No trabaja para la empresa (externo)</b><small>Puede no usar la app: el personal también marca sus domicilios como entregados.</small></span>
        </label>
      )}
      <Field label="Vehículo" htmlFor={`${idPrefix}-vt`}>
        <select id={`${idPrefix}-vt`} value={form.vehicleType} onChange={(e) => set({ vehicleType: e.target.value })}>
          <option value="">Sin registrar</option>
          {VEHICLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
      {form.vehicleType === 'otro' ? (
        <label className="check" style={{ alignSelf: 'end' }}><input type="checkbox" checked={form.vehicleHasPlate} onChange={(e) => set({ vehicleHasPlate: e.target.checked })} /> Tiene placa</label>
      ) : <div className="hide-sm" />}
      {plate ? (
        <Field label="Placa" htmlFor={`${idPrefix}-vp`} required hint={form.vehicleType === 'moto' ? 'Ej. ABC12D' : form.vehicleType === 'carro' ? 'Ej. ABC123' : null}>
          <input id={`${idPrefix}-vp`} value={form.vehiclePlate} maxLength={10} autoCapitalize="characters" onChange={(e) => set({ vehiclePlate: e.target.value.toUpperCase() })} placeholder="ABC123" />
        </Field>
      ) : form.vehicleType ? <small className="hint" style={{ gridColumn: '1 / -1' }}>{form.vehicleType === 'otro' ? 'Sin placa.' : 'No lleva placa.'}</small> : null}
    </>
  )
}

// ---------- Registro rápido del domiciliario externo ----------
// Desde Domicilios: nombre, celular y vehículo. Si viene de un domicilio, queda asignado.
export const QuickCourierModal = ({ order, onClose, onDone }) => {
  const [form, setForm] = useState({ name: '', lastName: '', phone: '', identification: '', ...EMPTY_COURIER, courierFloat: 'propia', courierExternal: true, vehicleType: 'moto' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const submit = async (e) => {
    e.preventDefault(); setError('')
    const errs = [...formErrors({ name: ['name', form.name, true], lastName: ['name', form.lastName], phone: ['phone', form.phone, true], identification: ['doc', form.identification] }), ...vehicleErrors(form)]
    if (errs.length) return setError(errs.join(' '))
    setSaving(true)
    try {
      const { data } = await api.post('/domicilios/domiciliarios', { name: form.name, lastName: form.lastName, phone: form.phone, identification: form.identification, orderId: order?.id, ...courierBody(form) })
      onDone(data)
    } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  return (
    <Modal size="lg" title="Registrar domiciliario externo" onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="quick-courier" className="btn btn-primary" disabled={saving}>{saving ? <Spinner /> : <MdPersonAdd />} {order ? `Registrar y asignar al ${order.number}` : 'Registrar'}</button></>}>
      <form id="quick-courier" className="form-grid" onSubmit={submit} noValidate>
        <p className="muted span-2" style={{ margin: 0 }}>Para el domiciliario que no trabaja para la empresa. Queda en Usuarios con el cargo Domiciliario y puedes completar sus datos después.</p>
        <Field label="Nombres" htmlFor="qc-n" required><input id="qc-n" data-only="letters" value={form.name} onChange={set('name')} autoFocus /></Field>
        <Field label="Apellidos" htmlFor="qc-l"><input id="qc-l" data-only="letters" value={form.lastName} onChange={set('lastName')} /></Field>
        <Field label="Celular" htmlFor="qc-p" required><input id="qc-p" value={form.phone} onChange={set('phone')} inputMode="numeric" maxLength={10} placeholder="3001234567" /></Field>
        <Field label="Identificación" htmlFor="qc-i" hint="Opcional. Si la dejas vacía se usa el celular"><input id="qc-i" value={form.identification} onChange={set('identification')} inputMode="numeric" maxLength={15} /></Field>
        <div className="span-2 profile-checks">
          <CourierFields form={form} setForm={setForm} showExternal={false} idPrefix="qc" />
        </div>
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>
  )
}
