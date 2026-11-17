import React, { useEffect, useState } from 'react'
import { MdUpload, MdDelete, MdPalette, MdTextFields, MdImage, MdRestartAlt, MdTableRestaurant, MdReceiptLong } from 'react-icons/md'
import api, { errorMessage } from '../api/client'
import { useSettings } from '../context/SettingsContext'
import { Card, Field, Kpi, PageHead, Spinner, useToast } from '../components/ui'
import { fileToDataUrl } from '../utils/image'
import { BrandLogo } from '../components/Logo'
import { applyTheme, contrastOn, DEFAULT_THEME } from '../utils/theme'

// Paletas listas para elegir con un clic. La primera es la de fábrica de TillDash+.
const PRESETS = [
  ['TillDash+', { primary: '#E4572E', secondary: '#1F2933', accent: '#F2A541' }],
  ['Bistró', { primary: '#9C2C2C', secondary: '#2A1E1A', accent: '#D9A441' }],
  ['Cervecería', { primary: '#D98E04', secondary: '#1E1B18', accent: '#F4D35E' }],
  ['Discoteca', { primary: '#8E44FF', secondary: '#120E2A', accent: '#00D1FF' }],
  ['Café', { primary: '#7A4B2A', secondary: '#2B211C', accent: '#E3B87F' }],
  ['Mercado', { primary: '#2F9E6E', secondary: '#1C2B24', accent: '#F2C14E' }]
]
const MODES = [['claro', 'Claro'], ['oscuro', 'Oscuro'], ['sistema', 'Según el dispositivo']]

// Apariencia del establecimiento: solo superadmin. Los cambios se ven al instante y se guardan al confirmar.
const AppearancePage = () => {
  const { settings, setSettings } = useSettings()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, toastNode] = useToast()

  useEffect(() => {
    api.get('/configuracion').then(({ data }) => setForm(data)).catch((e) => toast(errorMessage(e), 'bad'))
  }, [toast])
  // Vista previa en vivo; al salir sin guardar se vuelve a la apariencia guardada.
  useEffect(() => { if (form) applyTheme(form) }, [form])
  useEffect(() => () => applyTheme(settings), [settings])

  const setColor = (k) => (e) => setForm((f) => ({ ...f, colors: { ...f.colors, [k]: e.target.value.toUpperCase() } }))
  const onImage = (k, max) => async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try { const url = await fileToDataUrl(file, { max, type: 'image/png' }); setForm((f) => ({ ...f, [k]: url })) } catch (err) { toast(err.message, 'bad') }
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await api.put('/configuracion/apariencia', { colors: form.colors, fontFamily: form.fontFamily, themeMode: form.themeMode, logoUrl: form.logoUrl, faviconUrl: form.faviconUrl })
      setForm(data)
      setSettings({ ...settings, ...data })
      toast('Apariencia guardada')
    } catch (err) { toast(errorMessage(err), 'bad') } finally { setSaving(false) }
  }

  if (!form) return <div className="splash" style={{ minHeight: 240 }}><Spinner /></div>
  const c = form.colors
  return (
    <form className="stack" onSubmit={submit} noValidate>
      <PageHead title="Apariencia" subtitle="Colores, logo y tipo de letra. Se aplican al sistema, a la carta por QR y a los tiquetes.">
        <button type="button" className="btn" onClick={() => setForm((f) => ({ ...f, ...DEFAULT_THEME, colors: { ...DEFAULT_THEME.colors } }))}><MdRestartAlt /> Valores de fábrica</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving && <Spinner />} Guardar apariencia</button>
      </PageHead>
      <div className="grid grid-2-1">
        <div className="stack">
          <Card title="Colores" icon={<MdPalette />}>
            <div className="chips" style={{ marginBottom: 16 }}>
              {PRESETS.map(([name, colors]) => (
                <button key={name} type="button" className="btn btn-sm preset" onClick={() => setForm((f) => ({ ...f, colors }))}>
                  <span className="swatches">{Object.values(colors).map((v) => <i key={v} style={{ background: v }} />)}</span>{name}
                </button>
              ))}
            </div>
            <div className="form-grid three">
              {[['primary', 'Principal', 'Botones y acciones'], ['secondary', 'Secundario', 'Menú lateral y encabezados'], ['accent', 'Acento', 'Destacados, promociones y alertas']].map(([k, label, hint]) => (
                <Field key={k} label={label} htmlFor={`c-${k}`} hint={hint}>
                  <div className="color-field">
                    <input type="color" id={`c-${k}`} value={c[k]} onChange={setColor(k)} aria-label={label} />
                    <input value={c[k]} onChange={setColor(k)} maxLength={7} aria-label={`${label} en hexadecimal`} />
                  </div>
                </Field>
              ))}
            </div>
          </Card>
          <Card title="Tipo de letra y modo" icon={<MdTextFields />}>
            <div className="form-grid">
              <Field label="Fuente" htmlFor="font">
                <select id="font" value={form.fontFamily} onChange={(e) => setForm((f) => ({ ...f, fontFamily: e.target.value }))}>
                  {(form.fonts || [form.fontFamily]).map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </Field>
              <Field label="Modo" htmlFor="mode">
                <select id="mode" value={form.themeMode} onChange={(e) => setForm((f) => ({ ...f, themeMode: e.target.value }))}>
                  {MODES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
            </div>
          </Card>
          <Card title="Vista previa">
            <div className="preview-row">
              <Kpi label="Ventas del día" value="$ 1.250.000" note="42 órdenes" icon={MdReceiptLong} tone="brand" />
              <Kpi label="Mesas abiertas" value="8 / 20" note="3 por cobrar" icon={MdTableRestaurant} />
            </div>
            <div className="row-actions" style={{ marginTop: 12 }}>
              <button type="button" className="btn btn-primary">Cobrar mesa</button>
              <button type="button" className="btn">Trasladar</button>
              <span className="badge" style={{ background: c.accent, color: contrastOn(c.accent) }}>2x1 en cócteles</span>
            </div>
          </Card>
        </div>
        <div className="stack">
          <Card title="Logo" icon={<MdImage />} subtitle="Se muestra en el menú lateral y en la carta. PNG con fondo transparente.">
            <div className="logo-preview">{form.logoUrl ? <img src={form.logoUrl} alt="Logo del establecimiento" /> : <BrandLogo size={30} onDark />}</div>
            <div className="row-actions">
              <label className="btn"><MdUpload /> Subir logo<input type="file" accept="image/*" hidden onChange={onImage('logoUrl', 400)} /></label>
              {form.logoUrl && <button type="button" className="btn btn-ghost" onClick={() => setForm((f) => ({ ...f, logoUrl: null }))}><MdDelete /> Quitar</button>}
            </div>
          </Card>
          <Card title="Ícono de la pestaña" subtitle="Cuadrado, de 64 × 64 px o más.">
            <div className="row-actions">
              {form.faviconUrl && <img src={form.faviconUrl} alt="" width={40} height={40} style={{ borderRadius: 8 }} />}
              <label className="btn"><MdUpload /> Subir ícono<input type="file" accept="image/*" hidden onChange={onImage('faviconUrl', 128)} /></label>
              {form.faviconUrl && <button type="button" className="btn btn-ghost" onClick={() => setForm((f) => ({ ...f, faviconUrl: null }))}><MdDelete /> Quitar</button>}
            </div>
          </Card>
        </div>
      </div>
      {toastNode}
    </form>
  )
}

export default AppearancePage
