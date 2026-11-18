import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { MdPeople, MdPrint, MdDownload, MdRefresh, MdLabel } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { useSettings } from '../../context/SettingsContext'
import { Empty, Field, Modal, Spinner } from '../../components/ui'
import { MoneyInput } from '../../components/forms'

// El QR lleva la dirección pública de la app (VITE_PUBLIC_APP_URL): así funciona aunque el sistema se use desde localhost.
export const PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_APP_URL || 'https://till-dash.vercel.app').replace(/\/$/, '')
export const menuUrl = (token) => `${PUBLIC_APP_URL}/carta/${token}`
export const ALIAS_MAX = 40
const ALIAS_IDEAS = ['Chica de rojo', 'Solo hombres', 'Cumpleaños', 'Pareja', 'Ejecutivos']

// ---------- Abrir mesa (con alias opcional) o pedido para llevar / domicilio ----------
export const OpenOrderModal = ({ table, type = 'mesa', siteId, onClose, onOpened, inline = false }) => {
  const { settings } = useSettings()
  const suggestedFee = Number(settings.deliveryFeeDefault) || 0
  const [fee, setFee] = useState({ on: suggestedFee > 0, value: suggestedFee || '' })
  const [f, setF] = useState({ alias: '', guests: table ? String(Math.min(table.seats, 2)) : '', customerName: '', customerPhone: '', customerAddress: '', note: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const submit = async (e) => {
    e.preventDefault(); setError('')
    if (type === 'domicilio' && !f.customerAddress.trim()) return setError('Escribe la dirección del domicilio.')
    if (type === 'domicilio' && fee.on && !(Number(fee.value) > 0)) return setError('Escribe el valor del domicilio o desmarca la casilla.')
    setSaving(true)
    try {
      const { data } = await api.post('/pedidos', { type, tableId: table?.id, siteId, alias: f.alias, guests: Number(f.guests) || undefined, customerName: f.customerName, customerPhone: f.customerPhone, customerAddress: f.customerAddress, note: f.note, deliveryFee: type === 'domicilio' && fee.on ? Number(fee.value) : undefined })
      onOpened(data)
    } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  const title = table ? `Abrir ${table.name}` : type === 'domicilio' ? 'Nuevo domicilio' : 'Pedido para llevar'
  const footer = <><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="open-form" className="btn btn-primary" disabled={saving}>{saving && <Spinner />} {table ? 'Abrir y agregar productos' : 'Abrir pedido'}</button></>
  const form = (
      <form id="open-form" className="form-grid" onSubmit={submit} noValidate>
        {table && <div className="span-2">
          <Field label="Alias de la mesa (opcional)" htmlFor="oal" hint="Para reconocerla mientras está abierta. Se borra al cerrar la mesa.">
            <input id="oal" value={f.alias} maxLength={ALIAS_MAX} onChange={set('alias')} placeholder="Ej. chica de rojo" autoFocus />
          </Field>
          <div className="chip-list" style={{ marginTop: 6 }}>{ALIAS_IDEAS.map((a) => <button key={a} type="button" className={`pchip sm${f.alias === a ? ' on' : ''}`} onClick={() => setF((x) => ({ ...x, alias: x.alias === a ? '' : a }))}>{a}</button>)}</div>
        </div>}
        {table && <Field label="Personas" htmlFor="og" hint={`La mesa es para ${table.seats}`}><input id="og" type="number" min="1" value={f.guests} onChange={set('guests')} /></Field>}
        <Field label={table ? 'Nombre del cliente (opcional)' : 'Nombre del cliente'} htmlFor="on"><input id="on" value={f.customerName} onChange={set('customerName')} autoFocus={!table} /></Field>
        {type !== 'mesa' && <Field label="Celular" htmlFor="op"><input id="op" inputMode="tel" value={f.customerPhone} onChange={set('customerPhone')} /></Field>}
        {type === 'domicilio' && <div className="span-2"><Field label="Dirección" htmlFor="oa" required><input id="oa" value={f.customerAddress} onChange={set('customerAddress')} /></Field></div>}
        {type === 'domicilio' && <div className="span-2 fee-row">
          <label className="check"><input type="checkbox" checked={fee.on} onChange={(e) => setFee((x) => ({ ...x, on: e.target.checked }))} /> Cobrar el domicilio al cliente</label>
          {fee.on && <div style={{ maxWidth: 200 }}><MoneyInput value={fee.value} onChange={(v) => setFee((x) => ({ ...x, value: v }))} aria-label="Valor del domicilio" placeholder="Valor" /></div>}
        </div>}
        <div className="span-2"><Field label="Nota" htmlFor="ot"><input id="ot" value={f.note} onChange={set('note')} placeholder="Ej. celebran un cumpleaños" /></Field></div>
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
  )
  if (inline) return <div className="open-inline"><div className="row-between"><h3 style={{ margin: 0 }}>{title}</h3>{table?.seats ? <small className="muted">{table.seats} puestos</small> : null}</div>{form}<div className="row-end">{footer}</div></div>
  return <Modal title={title} onClose={onClose} footer={footer}>{form}</Modal>
}

// ---------- Alias temporal de una mesa ocupada ----------
export const AliasModal = ({ order, tableName, onClose, onSaved }) => {
  const [alias, setAlias] = useState(order.alias || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const save = async (value) => {
    setSaving(true); setError('')
    try { const { data } = await api.put(`/pedidos/${order.id}`, { alias: value }); onSaved(data) } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  return (
    <Modal title={`Alias de ${tableName}`} onClose={onClose}
      footer={<>
        {order.alias && <button type="button" className="btn btn-ghost" onClick={() => save('')} disabled={saving}>Quitar alias</button>}
        <button type="button" className="btn" onClick={onClose}>Cancelar</button>
        <button type="submit" form="alias-form" className="btn btn-primary" disabled={saving}>{saving && <Spinner />} Guardar</button>
      </>}>
      <form id="alias-form" className="stack" onSubmit={(e) => { e.preventDefault(); save(alias) }} noValidate>
        <Field label="Alias" htmlFor="al" hint="Solo mientras la mesa esté abierta. Al cobrar o anular el pedido se borra solo.">
          <input id="al" value={alias} maxLength={ALIAS_MAX} onChange={(e) => setAlias(e.target.value)} placeholder="Ej. chica de rojo, solo hombres" autoFocus />
        </Field>
        <div className="chip-list">{ALIAS_IDEAS.map((a) => <button key={a} type="button" className={`pchip sm${alias === a ? ' on' : ''}`} onClick={() => setAlias(a)}>{a}</button>)}</div>
        {error && <div className="alert bad">{error}</div>}
      </form>
    </Modal>
  )
}

// ---------- Trasladar el pedido a una mesa libre ----------
export const MoveModal = ({ order, fromName, onClose, onMoved }) => {
  const [tables, setTables] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)
  useEffect(() => { api.get('/mesas', { params: { sede: order.siteId } }).then(({ data }) => setTables(data.tables.filter((t) => t.status === 'libre'))).catch((e) => setError(errorMessage(e))) }, [order.siteId])
  const move = async (t) => {
    setBusy(t.id); setError('')
    try { const { data } = await api.put(`/pedidos/${order.id}`, { tableId: t.id }); onMoved(data, t) } catch (e) { setError(errorMessage(e)); setBusy(null) }
  }
  return (
    <Modal title={`Trasladar ${fromName || 'el pedido'}`} onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>Elige la mesa libre a la que pasa el pedido {order.number}{order.alias ? ` (${order.alias})` : ''}. Se lleva los productos, las comandas y el alias.</p>
      {error && <div className="alert bad">{error}</div>}
      {!tables ? <Spinner /> : !tables.length ? <Empty>No hay mesas libres.</Empty> : (
        <div className="tbl-grid sm">{tables.map((t) => (
          <button key={t.id} type="button" className="tbl tbl-libre tbl-main" onClick={() => move(t)} disabled={Boolean(busy)}>
            <strong>{t.name}</strong><small>{busy === t.id ? <Spinner /> : <><MdPeople /> {t.seats}</>}</small>
          </button>
        ))}</div>
      )}
    </Modal>
  )
}

// ---------- QR de la mesa ----------
export const QrModal = ({ table, admin, onClose, onRegenerated }) => {
  const { settings } = useSettings()
  const [src, setSrc] = useState('')
  const [busy, setBusy] = useState(false)
  const url = menuUrl(table.qrToken)
  useEffect(() => { QRCode.toDataURL(url, { width: 640, margin: 1, color: { dark: '#1F2933', light: '#FFFFFF' } }).then(setSrc).catch(() => setSrc('')) }, [url])
  const print = () => {
    const w = window.open('', '_blank', 'width=560,height=860')
    if (!w) return
    w.document.write(`<html><head><title>${table.name}</title><style>body{font-family:system-ui,sans-serif;text-align:center;padding:24px}img{width:300px}h1{margin:8px 0 2px}p{margin:4px 0;color:#555}</style></head><body><h2>${settings.businessName}</h2><img src="${src}" alt="QR"/><h1>${table.name}</h1><p>Escanea para ver la carta y llamar al mesero</p><script>window.onload=()=>{window.print()}<\/script></body></html>`)
    w.document.close()
  }
  const regenerate = async () => {
    if (!window.confirm('El QR impreso que tiene la mesa dejará de funcionar. ¿Generar uno nuevo?')) return
    setBusy(true)
    try { const { data } = await api.post(`/mesas/${table.id}/qr`); onRegenerated(data) } catch { setBusy(false) }
  }
  return (
    <Modal title={`QR de ${table.name}`} onClose={onClose}
      footer={<>
        {admin && <button type="button" className="btn" onClick={regenerate} disabled={busy}><MdRefresh /> Nuevo QR</button>}
        <a className="btn" href={src} download={`QR-${table.name}.png`}><MdDownload /> Descargar</a>
        <button type="button" className="btn btn-primary" onClick={print} disabled={!src}><MdPrint /> Imprimir</button>
      </>}>
      <div className="qr-box">
        {src ? <img src={src} alt={`Código QR de ${table.name}`} /> : <Spinner />}
        <strong>{table.name}</strong>
        <small className="muted">El cliente escanea, ve la carta con los precios del momento y puede llamar al mesero o pedir la cuenta.</small>
        <a href={url} target="_blank" rel="noreferrer" className="qr-link">{url}</a>
      </div>
    </Modal>
  )
}

export const AliasTag = ({ alias }) => (alias ? <span className="tbl-alias"><MdLabel /> {alias}</span> : null)
