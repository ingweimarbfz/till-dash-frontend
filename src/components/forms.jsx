import React, { useEffect, useRef, useState } from 'react'
import { MdPhotoCamera, MdPhotoLibrary, MdDelete, MdMyLocation, MdPictureAsPdf, MdReceipt, MdAttachFile } from 'react-icons/md'
import { fileToDataUrl } from '../utils/image'
import { Spinner } from './ui'
import api from '../api/client'

// Campo de dinero: muestra separadores de miles y entrega un número.
export const MoneyInput = ({ value, onChange, id, placeholder = '0', ...rest }) => {
  const shown = value === '' || value === null || value === undefined ? '' : Number(value).toLocaleString('es-CO')
  return (
    <div className="input-prefix">
      <span>$</span>
      <input id={id} inputMode="numeric" value={shown} placeholder={placeholder} {...rest}
        onChange={(e) => { const digits = e.target.value.replace(/\D/g, ''); onChange(digits === '' ? '' : Number(digits)) }} />
    </div>
  )
}

// Foto tomada con la cámara (en celular) o cargada desde la galería o el equipo.
// Entrega { photo, thumb } en data URL.
// doc: formato de tarjeta (documento de identidad), con más resolución para que se lea.
export const PhotoInput = ({ value, onChange, label = 'Tomar foto', round = true, capture = 'environment', withThumb = false, doc = false, placeholder = null }) => {
  const ref = useRef(null)
  const gallery = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true); setError('')
    try {
      const photo = await fileToDataUrl(file, { max: doc ? 1100 : 640, quality: doc ? 0.78 : 0.8 })
      const thumb = withThumb ? await fileToDataUrl(file, { max: 120, quality: 0.75 }) : null
      onChange(withThumb ? { photo, thumb } : photo)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return (
    <div className={`photo-input${round && !doc ? ' round' : ''}${doc ? ' doc' : ''}`}>
      <button type="button" className="photo-box" onClick={() => gallery.current?.click()} aria-label={label}>
        {value ? <img src={value} alt="" /> : busy ? <Spinner /> : <>{placeholder || <MdPhotoCamera />}</>}
      </button>
      <div className="photo-actions">
        <button type="button" className="btn btn-sm" onClick={() => ref.current?.click()} title="Tomar foto con la cámara">{busy ? <Spinner /> : <MdPhotoCamera />} {value ? 'Tomar otra' : label}</button>
        <button type="button" className="btn btn-sm" onClick={() => gallery.current?.click()} title="Cargar una foto guardada"><MdPhotoLibrary /> Cargar</button>
        {value && <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange(withThumb ? { photo: null, thumb: null } : null)}><MdDelete /> Quitar</button>}
        {error && <small className="error">{error}</small>}
      </div>
      <input ref={ref} type="file" accept="image/*" capture={capture} hidden onChange={pick} />
      <input ref={gallery} type="file" accept="image/*" hidden onChange={pick} />
    </div>
  )
}

// Botón para tomar la ubicación actual del dispositivo.
export const LocationButton = ({ lat, lng, onChange }) => {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const locate = () => {
    if (!navigator.geolocation) { setError('Este dispositivo no permite ubicar'); return }
    setBusy(true); setError('')
    navigator.geolocation.getCurrentPosition(
      (p) => { setBusy(false); onChange({ lat: Number(p.coords.latitude.toFixed(6)), lng: Number(p.coords.longitude.toFixed(6)) }) },
      () => { setBusy(false); setError('No se pudo obtener la ubicación. Revisa el permiso del navegador.') },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }
  return (
    <div className="location-input">
      <button type="button" className="btn btn-sm" onClick={locate} disabled={busy}>{busy ? <Spinner /> : <MdMyLocation />} {lat ? 'Actualizar ubicación' : 'Usar mi ubicación'}</button>
      {lat && lng ? <a className="small-link" href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer">{lat}, {lng}</a> : <small>Sin ubicación</small>}
      {error && <small className="error">{error}</small>}
    </div>
  )
}

export const Tabs = ({ tabs, value, onChange }) => (
  <div className="tabs" role="tablist">
    {tabs.map(([k, label]) => (
      <button key={k} type="button" role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{label}</button>
    ))}
  </div>
)

// Silueta de documento de identidad para los recuadros de foto.
export const DocIcon = ({ side = 'front' }) => (
  <svg viewBox="0 0 64 40" width="64" height="40" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="2" width="60" height="36" rx="5" />
    {side === 'front' ? (<><circle cx="18" cy="17" r="6" /><path d="M9 32c2-5 16-5 18 0" /><path d="M34 13h20M34 20h20M34 27h12" /></>) : (<><path d="M8 10h48" strokeWidth="5" /><path d="M10 22h30M10 29h22" /><rect x="44" y="20" width="12" height="12" rx="2" /></>)}
  </svg>
)

// Comprobante de pago. Foto con la cámara o archivo (imagen o PDF de hasta 3 MB).
const readRaw = (file) => new Promise((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(r.result)
  r.onerror = () => reject(new Error('No se pudo leer el archivo'))
  r.readAsDataURL(file)
})
export const ReceiptInput = ({ value, onChange, required = false }) => {
  const cam = useRef(null)
  const file = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pick = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setBusy(true); setError('')
    try {
      if (f.type === 'application/pdf') {
        if (f.size > 3 * 1024 * 1024) throw new Error('El PDF supera 3 MB')
        onChange(await readRaw(f))
      } else {
        onChange(await fileToDataUrl(f, { max: 1400, quality: 0.8 }))
      }
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const pdf = typeof value === 'string' && value.startsWith('data:application/pdf')
  return (
    <div className={`receipt-input${required && !value ? ' missing' : ''}`}>
      {value
        ? (pdf ? <div className="receipt-file"><MdPictureAsPdf /> Comprobante en PDF</div> : <img src={value} alt="Comprobante" />)
        : <div className="receipt-empty">{busy ? <Spinner /> : <MdReceipt />}<span>{required ? 'Adjunta la foto del comprobante de la transferencia' : 'Comprobante (opcional)'}</span></div>}
      <div className="photo-actions">
        <button type="button" className="btn btn-sm" onClick={() => cam.current?.click()} disabled={busy}><MdPhotoCamera /> Tomar foto</button>
        <button type="button" className="btn btn-sm" onClick={() => file.current?.click()} disabled={busy}><MdAttachFile /> Adjuntar archivo</button>
        {value && <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange(null)}><MdDelete /> Quitar</button>}
      </div>
      {error && <small className="error">{error}</small>}
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      <input ref={file} type="file" accept="image/*,application/pdf" hidden onChange={pick} />
    </div>
  )
}

// ---------------------------------------------------------------- Sucursales (TD-024)
// Sucursales activas del establecimiento, cargadas una sola vez por sesión de la página.
let sitesCache = null
export const useSites = () => {
  const [sites, setSites] = useState(sitesCache || [])
  useEffect(() => {
    if (sitesCache) return
    api.get('/sedes', { params: { activas: 1, sede: undefined } })
      .then(({ data }) => { sitesCache = (data || []).map((s) => ({ id: s.id, name: s.name, isMain: Boolean(s.isMain) })); setSites(sitesCache) }).catch(() => {})
  }, [])
  return sites
}
export const siteNamesOf = (sites, ids) => (!ids?.length ? 'Todas las sucursales' : ids.map((id) => sites.find((s) => s.id === id)?.name).filter(Boolean).join(', ') || 'Todas las sucursales')

// Elegir en qué sucursales aplica: ninguna elegida = todas. Con una sola sucursal no se muestra.
export const SitePicker = ({ value = [], onChange, label = 'Sucursales', hint = 'Sin elegir ninguna, aplica en todas las sucursales.' }) => {
  const sites = useSites()
  if (sites.length < 2) return null
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  return (
    <div className="span-2">
      <span className="label-sm">{label} {value.length ? '' : '· todas'}</span>
      <div className="chip-list" style={{ marginTop: 6 }}>
        <button type="button" className={`pchip${value.length ? '' : ' on'}`} onClick={() => onChange([])}>Todas</button>
        {sites.map((s) => <button key={s.id} type="button" className={`pchip${value.includes(s.id) ? ' on' : ''}`} onClick={() => toggle(s.id)}>{s.name}</button>)}
      </div>
      {hint && <small className="muted block" style={{ marginTop: 4 }}>{hint}</small>}
    </div>
  )
}

// Precio del producto en cada sucursal: vacío = el precio general.
export const SitePrices = ({ value = [], onChange, basePrice, siteIds = [] }) => {
  const sites = useSites()
  if (sites.length < 2) return null
  const shown = siteIds.length ? sites.filter((s) => siteIds.includes(s.id)) : sites
  const priceOf = (id) => value.find((x) => x.siteId === id)?.price ?? ''
  const setPrice = (id, price) => onChange([...value.filter((x) => x.siteId !== id), ...(price === '' ? [] : [{ siteId: id, price }])])
  return (
    <div className="span-2">
      <span className="label-sm">Precio por sucursal (opcional)</span>
      <small className="muted block" style={{ marginBottom: 6 }}>Déjalo vacío para usar el precio general{basePrice ? ` (${Number(basePrice).toLocaleString('es-CO')})` : ''}.</small>
      <div className="form-grid">
        {shown.map((s) => (
          <label key={s.id} className="field"><span className="label-sm">{s.name}</span>
            <MoneyInput value={priceOf(s.id)} onChange={(v) => setPrice(s.id, v)} placeholder={basePrice ? Number(basePrice).toLocaleString('es-CO') : '0'} aria-label={`Precio en ${s.name}`} />
          </label>
        ))}
      </div>
    </div>
  )
}
