import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import QRCode from 'qrcode'
import {
  MdAdd, MdEdit, MdQrCode2, MdTableRestaurant, MdPeople, MdShoppingBag, MdSettings, MdCheck, MdPrint, MdDownload, MdRefresh, MdRoomService, MdReceipt, MdDeliveryDining
} from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { Badge, Card, Empty, Field, Modal, PageHead, Spinner, useToast } from '../../components/ui'
import { formatMoney } from '../../utils/format'
import { ADMIN, since, TABLE_STATUS, useCan } from './common'

const POLL_MS = 15000
export const menuUrl = (token) => `${window.location.origin}/carta/${token}`

// ---------- Abrir mesa o pedido para llevar / domicilio ----------
export const OpenOrderModal = ({ table, type = 'mesa', siteId, onClose, onOpened }) => {
  const [f, setF] = useState({ guests: table ? String(Math.min(table.seats, 2)) : '', customerName: '', customerPhone: '', customerAddress: '', note: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const submit = async (e) => {
    e.preventDefault(); setError('')
    if (type === 'domicilio' && !f.customerAddress.trim()) return setError('Escribe la dirección del domicilio.')
    setSaving(true)
    try {
      const { data } = await api.post('/pedidos', { type, tableId: table?.id, siteId, guests: Number(f.guests) || undefined, customerName: f.customerName, customerPhone: f.customerPhone, customerAddress: f.customerAddress, note: f.note })
      onOpened(data)
    } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  const title = table ? `Abrir ${table.name}` : type === 'domicilio' ? 'Nuevo domicilio' : 'Pedido para llevar'
  return (
    <Modal title={title} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="open-form" className="btn btn-primary" disabled={saving}>{saving && <Spinner />} Abrir pedido</button></>}>
      <form id="open-form" className="form-grid" onSubmit={submit} noValidate>
        {table && <Field label="Personas" htmlFor="og" hint={`La mesa es para ${table.seats}`}><input id="og" type="number" min="1" value={f.guests} onChange={set('guests')} autoFocus /></Field>}
        <Field label={table ? 'Nombre del cliente (opcional)' : 'Nombre del cliente'} htmlFor="on"><input id="on" value={f.customerName} onChange={set('customerName')} autoFocus={!table} /></Field>
        {type !== 'mesa' && <Field label="Celular" htmlFor="op"><input id="op" inputMode="tel" value={f.customerPhone} onChange={set('customerPhone')} /></Field>}
        {type === 'domicilio' && <div className="span-2"><Field label="Dirección" htmlFor="oa" required><input id="oa" value={f.customerAddress} onChange={set('customerAddress')} /></Field></div>}
        <div className="span-2"><Field label="Nota" htmlFor="ot"><input id="ot" value={f.note} onChange={set('note')} placeholder="Ej. celebran un cumpleaños" /></Field></div>
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>
  )
}

// ---------- QR de la mesa ----------
const QrModal = ({ table, admin, onClose, onRegenerated }) => {
  const { settings } = useSettings()
  const [src, setSrc] = useState('')
  const [busy, setBusy] = useState(false)
  const url = menuUrl(table.qrToken)
  useEffect(() => { QRCode.toDataURL(url, { width: 640, margin: 1, color: { dark: '#1F2933', light: '#FFFFFF' } }).then(setSrc).catch(() => setSrc('')) }, [url])
  const print = () => {
    const w = window.open('', '_blank', 'width=480,height=640')
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

// ---------- Configuración de zonas y mesas (administrador) ----------
const AreaForm = ({ initial, siteId, onClose, onSaved }) => {
  const [name, setName] = useState(initial?.name || '')
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0)
  const [active, setActive] = useState(initial?.active ?? true)
  const [error, setError] = useState('')
  const submit = async (e) => {
    e.preventDefault(); setError('')
    try {
      initial?.id ? await api.put(`/mesas/zonas/${initial.id}`, { name, sortOrder, active }) : await api.post('/mesas/zonas', { name, sortOrder, siteId })
      onSaved()
    } catch (err) { setError(errorMessage(err)) }
  }
  return (
    <Modal title={initial?.id ? 'Editar zona' : 'Nueva zona'} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="area-form" className="btn btn-primary">Guardar</button></>}>
      <form id="area-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="Nombre" htmlFor="an" required><input id="an" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Salón, Terraza, Segundo piso" autoFocus /></Field>
        <Field label="Orden" htmlFor="ao"><input id="ao" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} /></Field>
        {initial?.id && <label className="check span-2"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Activa</label>}
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>
  )
}

const TableForm = ({ initial, areas, siteId, onClose, onSaved }) => {
  const editing = Boolean(initial?.id)
  const [bulk, setBulk] = useState(!editing)
  const [f, setF] = useState({ name: '', count: '10', prefix: 'Mesa', seats: '4', shape: 'cuadrada', areaId: areas[0]?.id ? String(areas[0].id) : '', active: true, ...(initial ? { ...initial, seats: String(initial.seats), areaId: initial.areaId ? String(initial.areaId) : '' } : {}) })
  const [error, setError] = useState('')
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const submit = async (e) => {
    e.preventDefault(); setError('')
    try {
      if (editing) await api.put(`/mesas/${f.id}`, f)
      else await api.post('/mesas', bulk ? { ...f, name: undefined, siteId } : { ...f, count: undefined, siteId })
      onSaved(editing)
    } catch (err) { setError(errorMessage(err)) }
  }
  return (
    <Modal title={editing ? `Editar ${initial.name}` : 'Agregar mesas'} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="table-form" className="btn btn-primary">Guardar</button></>}>
      <form id="table-form" className="form-grid" onSubmit={submit} noValidate>
        {!editing && <div className="seg span-2"><button type="button" className={`btn btn-sm${bulk ? ' on' : ''}`} onClick={() => setBulk(true)}>Varias a la vez</button><button type="button" className={`btn btn-sm${!bulk ? ' on' : ''}`} onClick={() => setBulk(false)}>Una mesa</button></div>}
        {bulk && !editing ? <>
          <Field label="Cuántas" htmlFor="tc" required><input id="tc" type="number" min="1" max="60" value={f.count} onChange={set('count')} /></Field>
          <Field label="Nombre" htmlFor="tp" hint={`Quedan: ${f.prefix || 'Mesa'} 1, ${f.prefix || 'Mesa'} 2…`}><input id="tp" value={f.prefix} onChange={set('prefix')} /></Field>
        </> : <div className="span-2"><Field label="Nombre o número" htmlFor="tn" required><input id="tn" value={f.name} onChange={set('name')} placeholder="Ej. Mesa 12, Barra 3, VIP 1" autoFocus /></Field></div>}
        <Field label="Puestos" htmlFor="ts"><input id="ts" type="number" min="1" value={f.seats} onChange={set('seats')} /></Field>
        <Field label="Forma" htmlFor="tf"><select id="tf" value={f.shape} onChange={set('shape')}><option value="cuadrada">Cuadrada</option><option value="redonda">Redonda</option><option value="barra">Barra</option></select></Field>
        <div className="span-2"><Field label="Zona" htmlFor="ta"><select id="ta" value={f.areaId} onChange={set('areaId')}><option value="">Sin zona</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field></div>
        {editing && <label className="check span-2"><input type="checkbox" checked={f.active} onChange={set('active')} /> Activa</label>}
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>
  )
}

// ---------- Tarjeta de mesa ----------
const TableCard = ({ t, config, onOpen, onEdit, onQr, onAttend }) => (
  <div className={`tbl tbl-${t.status}${t.calls.length ? ' calling' : ''}${t.active === false ? ' off' : ''}`}>
    <button type="button" className="tbl-main" onClick={() => onOpen(t)} aria-label={`${t.name}: ${TABLE_STATUS[t.status]}`}>
      <span className="tbl-head"><strong>{t.name}</strong><small><MdPeople /> {t.order?.guests || t.seats}</small></span>
      {t.order ? <>
        <span className="tbl-total">{formatMoney(t.order.total)}</span>
        <small className="tbl-meta">{t.order.number} · {since(t.order.openedAt)}</small>
        <small className="tbl-meta">{t.order.waiter}{t.order.ready ? <b className="tbl-ready"> · {t.order.ready} listo{t.order.ready === 1 ? '' : 's'}</b> : ''}</small>
      </> : <span className="tbl-free">{TABLE_STATUS[t.status]}</span>}
    </button>
    {t.calls.length > 0 && (
      <div className="tbl-calls">{t.calls.map((c) => (
        <button key={c.id} type="button" className="tbl-call" onClick={() => onAttend(c)} title="Marcar como atendido">
          {c.kind === 'cuenta' ? <MdReceipt /> : <MdRoomService />} {c.kind === 'cuenta' ? 'Cuenta' : 'Llama'} <MdCheck />
        </button>
      ))}</div>
    )}
    {config && <div className="tbl-tools">
      <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`QR de ${t.name}`} onClick={() => onQr(t)}><MdQrCode2 /></button>
      <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Editar ${t.name}`} onClick={() => onEdit(t)}><MdEdit /></button>
    </div>}
  </div>
)

// Salón: mesas por zona con su estado, pedidos de mostrador y llamados de los clientes.
const TablesPage = () => {
  const { user } = useAuth()
  const admin = ADMIN.includes(user.role)
  const can = useCan()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [area, setArea] = useState('all')
  const [config, setConfig] = useState(false)
  const [modal, setModal] = useState(null)
  const [toast, toastNode] = useToast()
  const load = useCallback(() => api.get('/mesas', { params: { todas: config ? 1 : undefined } }).then(({ data: d }) => { setData(d); setError('') }).catch((e) => setError(errorMessage(e))), [config])
  useEffect(() => { load(); const t = setInterval(load, POLL_MS); const on = () => load(); window.addEventListener('td:calls', on); return () => { clearInterval(t); window.removeEventListener('td:calls', on) } }, [load])
  // Desde el buscador: /mesas?mesa=ID abre esa mesa.
  useEffect(() => {
    const id = Number(params.get('mesa'))
    if (!id || !data) return
    const t = data.tables.find((x) => x.id === id)
    setParams({}, { replace: true })
    if (t) open(t)
  }, [params, data]) // eslint-disable-line react-hooks/exhaustive-deps

  const open = (t) => {
    if (config) return setModal({ table: t })
    if (t.order) return navigate(`/pedidos/${t.order.id}`)
    if (!can('mesero', 'cajero', 'host', 'bartender', 'barista')) return toast('Tu cargo no abre mesas', 'bad')
    setModal({ open: t })
  }
  const attend = async (c) => { try { await api.post(`/llamados/${c.id}/atender`); toast('Llamado atendido'); load() } catch (e) { toast(errorMessage(e), 'bad') } }

  if (error && !data) return <Card><Empty icon={<MdTableRestaurant />}>{error}</Empty></Card>
  if (!data) return <div className="splash"><Spinner /></div>
  const areas = data.areas.filter((a) => a.active || config)
  const shown = data.tables.filter((t) => area === 'all' || (area === 'none' ? !t.areaId : t.areaId === Number(area)))
  const groups = area === 'all' && areas.length
    ? [...areas.map((a) => ({ key: a.id, title: a.name, area: a, tables: shown.filter((t) => t.areaId === a.id) })), { key: 'none', title: 'Sin zona', tables: shown.filter((t) => !t.areaId || !areas.some((a) => a.id === t.areaId)) }].filter((g) => g.tables.length || (config && g.area))
    : [{ key: 'one', tables: shown }]
  const count = (s) => data.tables.filter((t) => t.status === s && t.active !== false).length
  return (
    <div className="stack">
      <PageHead title="Mesas" subtitle={`${data.site?.name || ''} · ${count('ocupada') + count('por_cobrar')} ocupadas de ${data.tables.filter((t) => t.active !== false).length}`}>
        {!config && <button type="button" className="btn" onClick={() => setModal({ counter: 'llevar' })}><MdShoppingBag /> Para llevar</button>}
        {!config && <button type="button" className="btn" onClick={() => setModal({ counter: 'domicilio' })}><MdDeliveryDining /> Domicilio</button>}
        {admin && <button type="button" className={`btn${config ? ' btn-primary' : ''}`} onClick={() => setConfig((c) => !c)}>{config ? <><MdCheck /> Listo</> : <><MdSettings /> Configurar</>}</button>}
      </PageHead>
      {admin && !user.siteId && <small className="hint">Ves la sucursal {data.site?.name}. Para otra, elígela arriba en el selector de sucursal.</small>}
      <div className="row-between wrap" style={{ gap: 10 }}>
        <div className="chip-list">
          <button type="button" className={`pchip${area === 'all' ? ' on' : ''}`} onClick={() => setArea('all')}>Todas</button>
          {areas.map((a) => <button key={a.id} type="button" className={`pchip${area === String(a.id) ? ' on' : ''}`} onClick={() => setArea(String(a.id))}>{a.name}</button>)}
        </div>
        <div className="tbl-legend"><span className="lg libre" /> Libre {count('libre')}<span className="lg ocupada" /> Ocupada {count('ocupada')}<span className="lg por_cobrar" /> Cuenta {count('por_cobrar')}</div>
      </div>
      {config && <div className="row-end"><button type="button" className="btn btn-sm" onClick={() => setModal({ area: {} })}><MdAdd /> Zona</button><button type="button" className="btn btn-sm btn-primary" onClick={() => setModal({ table: {} })}><MdAdd /> Mesas</button></div>}
      {!data.tables.length ? (
        <Card><Empty icon={<MdTableRestaurant />}>{admin ? <>Aún no hay mesas en esta sucursal. <button type="button" className="btn btn-sm btn-primary" onClick={() => { setConfig(true); setModal({ table: {} }) }}><MdAdd /> Agregar mesas</button></> : 'Aún no hay mesas en tu sucursal. Pide al administrador que las cree.'}</Empty></Card>
      ) : groups.map((g) => (
        <section key={g.key} className="stack" style={{ gap: 10 }}>
          {g.title && <div className="row-between"><h3 className="section-title">{g.title}</h3>{config && g.area && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal({ area: g.area })}><MdEdit /> Zona</button>}</div>}
          <div className="tbl-grid">{g.tables.map((t) => <TableCard key={t.id} t={t} config={config} onOpen={open} onEdit={(x) => setModal({ table: x })} onQr={(x) => setModal({ qr: x })} onAttend={attend} />)}</div>
        </section>
      ))}
      {data.counter.length > 0 && !config && (
        <Card title="Para llevar y domicilios" icon={<MdShoppingBag />} flush>
          <ul className="list padded">{data.counter.map((o) => (
            <li key={o.id} onClick={() => navigate(`/pedidos/${o.id}`)} style={{ cursor: 'pointer' }}>
              <span><strong>{o.number}</strong> <small>{o.customer || 'Sin nombre'} · {since(o.openedAt)}</small></span><Badge>{formatMoney(o.total)}</Badge>
            </li>
          ))}</ul>
        </Card>
      )}
      {modal?.open && <OpenOrderModal table={modal.open} siteId={data.site?.id} onClose={() => setModal(null)} onOpened={(o) => navigate(`/pedidos/${o.id}`)} />}
      {modal?.counter && <OpenOrderModal type={modal.counter} siteId={data.site?.id} onClose={() => setModal(null)} onOpened={(o) => navigate(`/pedidos/${o.id}`)} />}
      {modal?.area && <AreaForm initial={modal.area.id ? modal.area : null} siteId={data.site?.id} onClose={() => setModal(null)} onSaved={() => { setModal(null); toast('Zona guardada'); load() }} />}
      {modal?.table && <TableForm initial={modal.table.id ? modal.table : null} areas={data.areas} siteId={data.site?.id} onClose={() => setModal(null)} onSaved={(e) => { setModal(null); toast(e ? 'Mesa actualizada' : 'Mesas creadas'); load() }} />}
      {modal?.qr && <QrModal table={modal.qr} admin={admin} onClose={() => setModal(null)} onRegenerated={(t) => { setModal({ qr: { ...modal.qr, qrToken: t.qrToken } }); toast('QR nuevo generado: imprímelo y cámbialo en la mesa'); load() }} />}
      {toastNode}
    </div>
  )
}

export default TablesPage
