import React, { useEffect, useState } from 'react'
import { MdStorefront, MdPercent, MdPalette, MdChevronRight, MdQrCode2, MdPointOfSale } from 'react-icons/md'
import { MoneyInput } from '../components/forms'
import { Link } from 'react-router-dom'
import api, { errorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { Card, Field, PageHead, Spinner, useToast } from '../components/ui'

// Qué puede hacer el cliente al escanear el QR de la mesa.
const QR_MODES = [
  ['llamar', 'Solo llamar al mesero', 'Ve la carta y su cuenta, llama al mesero o pide la cuenta. Los pedidos los toma el mesero.'],
  ['confirmar', 'Pedir con confirmación', 'El cliente arma su pedido en la carta y el mesero lo acepta antes de que llegue a cocina y bar.'],
  ['directo', 'Pedir directo', 'El pedido entra a la cuenta de la mesa y a las comandas al instante. El personal recibe el aviso.']
]
const TYPES = [['restaurante', 'Restaurante'], ['bar', 'Bar'], ['social_bar', 'Social bar'], ['discoteca', 'Discoteca'], ['market', 'Market'], ['cafeteria', 'Cafetería'], ['otro', 'Otro']]

// Configuración general del establecimiento (superadmin y admin). La apariencia es solo del superadmin.
const SettingsPage = () => {
  const { user } = useAuth()
  const { settings, setSettings } = useSettings()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, toastNode] = useToast()

  useEffect(() => { api.get('/configuracion').then(({ data }) => setForm(data)).catch((e) => toast(errorMessage(e), 'bad')) }, [toast])
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const setSocial = (k) => (e) => setForm((f) => ({ ...f, social: { ...(f.social || {}), [k]: e.target.value } }))

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await api.put('/configuracion', { ...form, tipPercent: Number(form.tipPercent) })
      setForm(data)
      setSettings({ ...settings, ...data })
      toast('Configuración guardada')
    } catch (err) { toast(errorMessage(err), 'bad') } finally { setSaving(false) }
  }

  if (!form) return <div className="splash" style={{ minHeight: 240 }}><Spinner /></div>
  return (
    <form className="stack" onSubmit={submit} noValidate>
      <PageHead title="Configuración" subtitle="Datos del establecimiento, propina y textos de los tiquetes.">
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving && <Spinner />} Guardar cambios</button>
      </PageHead>
      <div className="grid grid-2-1">
        <Card title="Datos del establecimiento" icon={<MdStorefront />}>
          <div className="form-grid">
            <Field label="Nombre del establecimiento" htmlFor="bn" required><input id="bn" value={form.businessName || ''} onChange={set('businessName')} /></Field>
            <Field label="Tipo" htmlFor="bt"><select id="bt" value={form.businessType} onChange={set('businessType')}>{TYPES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Nombre corto" htmlFor="sn"><input id="sn" value={form.shortName || ''} onChange={set('shortName')} /></Field>
            <Field label="Eslogan" htmlFor="sl"><input id="sl" value={form.slogan || ''} onChange={set('slogan')} placeholder="El mejor sabor de la ciudad" /></Field>
            <Field label="NIT o documento" htmlFor="nit"><input id="nit" data-only="nit" maxLength={15} value={form.nit || ''} onChange={set('nit')} placeholder="900123456-7" /></Field>
            <Field label="Teléfono" htmlFor="ph"><input id="ph" minLength={7} maxLength={10} value={form.phone || ''} onChange={set('phone')} inputMode="numeric" /></Field>
            <Field label="Correo" htmlFor="em"><input id="em" type="email" value={form.email || ''} onChange={set('email')} /></Field>
            <Field label="Ciudad" htmlFor="ci"><input id="ci" data-only="letters" value={form.city || ''} onChange={set('city')} /></Field>
            <div className="span-2"><Field label="Dirección" htmlFor="ad"><input id="ad" value={form.address || ''} onChange={set('address')} /></Field></div>
            <Field label="Instagram" htmlFor="ig"><input id="ig" value={form.social?.instagram || ''} onChange={setSocial('instagram')} placeholder="@miestablecimiento" /></Field>
            <Field label="WhatsApp" htmlFor="wa"><input id="wa" inputMode="numeric" maxLength={12} value={form.social?.whatsapp || ''} onChange={setSocial('whatsapp')} placeholder="573001234567" /></Field>
            <div className="span-2"><Field label="Pie del tiquete" htmlFor="rf" hint="Texto al final de las cuentas y tiquetes de cobro"><textarea id="rf" rows={3} value={form.receiptFooter || ''} onChange={set('receiptFooter')} /></Field></div>
          </div>
        </Card>
        <div className="stack">
          <Card title="Propina" icon={<MdPercent />} subtitle="Se sugiere al cobrar cada cuenta. El cliente puede aceptarla o no.">
            <div className="form-grid">
              <Field label="Porcentaje" htmlFor="tp"><div className="input-prefix"><span>%</span><input id="tp" inputMode="decimal" value={form.tipPercent} onChange={set('tipPercent')} /></div></Field>
              <label className="check span-2"><input type="checkbox" checked={form.tipSuggested} onChange={set('tipSuggested')} /> Sugerir la propina en todas las cuentas</label>
            </div>
          </Card>
          <Card title="Gastos de caja" icon={<MdPointOfSale />} subtitle="Gastos menores del turno (hielo, limones, domicilios) que salen del efectivo de la caja.">
            <Field label="Tope por gasto" htmlFor="cel" hint="Si un gasto lo supera, el cajero debe pedir los recursos al administrador. 0: sin tope.">
              <MoneyInput id="cel" value={form.cashExpenseLimit} onChange={(v) => setForm((f) => ({ ...f, cashExpenseLimit: v === '' ? 0 : v }))} />
            </Field>
          </Card>
          <Card title="Carta por QR" icon={<MdQrCode2 />} subtitle="Lo que puede hacer el cliente al escanear el código de su mesa.">
            <div className="stack" style={{ gap: 8 }} role="radiogroup" aria-label="Pedidos desde el QR">
              {QR_MODES.map(([k, l, d]) => (
                <label key={k} className={`check-card${form.qrOrdering === k ? ' on' : ''}`}>
                  <input type="radio" name="qrOrdering" value={k} checked={form.qrOrdering === k} onChange={set('qrOrdering')} />
                  <span><b>{l}</b><small>{d}</small></span>
                </label>
              ))}
              <small className="muted">Sin un turno de caja abierto en la sucursal, el cliente solo puede llamar al mesero.</small>
            </div>
          </Card>
          {user.role === 'superadmin' && (
            <Card title="Apariencia" icon={<MdPalette />} subtitle="Colores, logo y tipo de letra del sistema y de la carta.">
              <Link to="/configuracion/apariencia" className="btn btn-block">Cambiar apariencia <MdChevronRight /></Link>
            </Card>
          )}
        </div>
      </div>
      {toastNode}
    </form>
  )
}

export default SettingsPage
