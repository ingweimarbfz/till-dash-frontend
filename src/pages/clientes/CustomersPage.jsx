import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MdAdd, MdEdit, MdSearch, MdStorefront, MdPlace, MdPhone, MdDeliveryDining, MdShoppingBag, MdRequestQuote, MdDownload, MdWhatsapp } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { Badge, Card, Empty, Field, Kpi, Modal, PageHead, Spinner, useToast } from '../../components/ui'
import { MoneyInput } from '../../components/forms'
import { formatDate, formatDateTime, formatMoney } from '../../utils/format'
import { download } from '../../utils/range'
import { usePlan } from '../../context/PlanContext'
import { useCan, ADMIN, ORDER_STATUS, ORDER_TONE } from '../operacion/common'
import { OpenOrderModal } from '../operacion/tableModals'
import { useAuth } from '../../context/AuthContext'

export const CUSTOMER_KINDS = [['persona', 'Persona'], ['tienda', 'Tienda'], ['licorera', 'Licorera'], ['bar', 'Bar'], ['restaurante', 'Restaurante'], ['minimercado', 'Minimercado'], ['empresa', 'Empresa'], ['otro', 'Otro']]
const PAY = [['', 'Sin preferencia'], ['efectivo', 'Efectivo'], ['transferencia', 'Transferencia'], ['nequi', 'Nequi'], ['daviplata', 'Daviplata'], ['tarjeta', 'Tarjeta'], ['otro', 'Otro']]
const DELIVERY_LABEL = { por_despachar: 'Por despachar', en_camino: 'En camino', entregado: 'Entregado' }
const SELLERS = ['mesero', 'cajero', 'host', 'bartender', 'barista']
const wa = (phone) => { const d = String(phone || '').replace(/\D/g, ''); return d.length >= 10 ? `https://wa.me/${d.length === 10 ? `57${d}` : d}` : null }

// ---------- Crear o editar un cliente ----------
const EMPTY = { name: '', kind: 'tienda', doc: '', contact: '', phone: '', phone2: '', address: '', neighborhood: '', city: '', zone: '', deliveryFee: '', payMethod: '', creditDays: '', notes: '', active: true }
const CustomerForm = ({ initial, zones, onClose, onSaved }) => {
  const { user } = useAuth()
  const admin = ADMIN.includes(user.role)
  const [f, setF] = useState(() => (initial ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, initial[k] ?? EMPTY[k]])) : EMPTY))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const submit = async (e) => {
    e.preventDefault(); setError('')
    if (!f.name.trim()) return setError('Escribe el nombre del cliente.')
    setSaving(true)
    const body = { ...f, deliveryFee: f.deliveryFee === '' ? null : Number(f.deliveryFee), creditDays: f.creditDays === '' ? null : Number(f.creditDays), payMethod: f.payMethod || null }
    if (!admin || !initial) delete body.active
    try {
      const { data } = initial ? await api.put(`/clientes/${initial.id}`, body) : await api.post('/clientes', body)
      onSaved(data, !initial)
    } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  return (
    <Modal title={initial ? `Editar ${initial.name}` : 'Nuevo cliente'} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="cust-form" className="btn btn-primary" disabled={saving}>{saving && <Spinner />} Guardar</button></>}>
      <form id="cust-form" className="form-grid" onSubmit={submit} noValidate>
        <div className="span-2"><Field label="Nombre o razón social" htmlFor="cn" required><input id="cn" value={f.name} onChange={set('name')} autoFocus placeholder="Ej. Tienda Don Pepe" /></Field></div>
        <Field label="Tipo" htmlFor="ck"><select id="ck" value={f.kind} onChange={set('kind')}>{CUSTOMER_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Cédula o NIT" htmlFor="cd"><input id="cd" value={f.doc} onChange={set('doc')} /></Field>
        <Field label="Celular" htmlFor="cp"><input id="cp" inputMode="tel" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Otro teléfono" htmlFor="cp2"><input id="cp2" inputMode="tel" value={f.phone2} onChange={set('phone2')} /></Field>
        <div className="span-2"><Field label="Persona de contacto" htmlFor="cc"><input id="cc" value={f.contact} onChange={set('contact')} placeholder="Quién recibe o hace los pedidos" /></Field></div>
        <div className="span-2"><Field label="Dirección" htmlFor="ca"><input id="ca" value={f.address} onChange={set('address')} /></Field></div>
        <Field label="Barrio" htmlFor="cb"><input id="cb" value={f.neighborhood} onChange={set('neighborhood')} /></Field>
        <Field label="Ciudad" htmlFor="cci"><input id="cci" value={f.city} onChange={set('city')} /></Field>
        <Field label="Zona o ruta de reparto" htmlFor="cz" hint="Agrupa los domicilios por sector">
          <input id="cz" list="cust-zones" value={f.zone} onChange={set('zone')} placeholder="Ej. Norte" />
          <datalist id="cust-zones">{zones.map((z) => <option key={z.zone} value={z.zone} />)}</datalist>
        </Field>
        <Field label="Valor del domicilio" htmlFor="cf" hint="Vacío: el de Configuración"><MoneyInput id="cf" value={f.deliveryFee} onChange={(v) => setF((x) => ({ ...x, deliveryFee: v }))} placeholder="Por defecto" /></Field>
        <Field label="Forma de pago habitual" htmlFor="cpm"><select id="cpm" value={f.payMethod} onChange={set('payMethod')}>{PAY.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Plazo de crédito (días)" htmlFor="ccd" hint="Fecha de pago de sus cuentas por cobrar"><input id="ccd" type="number" min="0" max="365" value={f.creditDays} onChange={set('creditDays')} placeholder="Sin crédito" /></Field>
        <div className="span-2"><Field label="Notas" htmlFor="cno"><textarea id="cno" rows={2} value={f.notes} onChange={set('notes')} placeholder="Horario de recibo, indicaciones para llegar…" /></Field></div>
        {admin && initial && <label className="check span-2"><input type="checkbox" checked={f.active} onChange={(e) => setF((x) => ({ ...x, active: e.target.checked }))} /> Cliente activo</label>}
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>
  )
}

// ---------- Ficha del cliente: datos, compras y cuentas por cobrar ----------
const CustomerDetail = ({ id, onClose, onEdit, onOrder }) => {
  const navigate = useNavigate()
  const can = useCan()
  const { has, distributor } = usePlan()
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api.get(`/clientes/${id}`).then(({ data }) => setD(data)).catch((e) => setError(errorMessage(e))) }, [id])
  const sells = can(...SELLERS)
  return (
    <Modal title={d?.name || 'Cliente'} onClose={onClose} size="lg"
      footer={d && <>
        {sells && <button type="button" className="btn" onClick={() => onEdit(d)}><MdEdit /> Editar</button>}
        {sells && <button type="button" className="btn" onClick={() => onOrder(d, 'llevar')}><MdShoppingBag /> {distributor ? 'Venta para recoger' : 'Para llevar'}</button>}
        {sells && has('domicilios') && <button type="button" className="btn btn-primary" onClick={() => onOrder(d, 'domicilio')}><MdDeliveryDining /> Nuevo domicilio</button>}
      </>}>
      {error ? <div className="alert bad">{error}</div> : !d ? <div className="splash" style={{ minHeight: 160 }}><Spinner /></div> : (
        <div className="stack">
          <div className="row wrap" style={{ gap: 6 }}>
            <Badge>{d.kindLabel}</Badge>{d.zone && <Badge tone="brand"><MdPlace /> {d.zone}</Badge>}{!d.active && <Badge tone="muted">Inactivo</Badge>}
            {d.creditDays ? <Badge tone="warn">Crédito a {d.creditDays} días</Badge> : null}
          </div>
          <div className="cust-detail-grid">
            <div><span>Celular</span>{d.phone || '—'}{wa(d.phone) && <> · <a href={wa(d.phone)} target="_blank" rel="noreferrer"><MdWhatsapp /> WhatsApp</a></>}{d.phone2 && <small className="block muted">{d.phone2}</small>}</div>
            <div><span>Dirección</span>{[d.address, d.neighborhood, d.city].filter(Boolean).join(', ') || '—'}</div>
            <div><span>Contacto</span>{d.contact || '—'}</div>
            <div><span>Cédula o NIT</span>{d.doc || '—'}</div>
            <div><span>Domicilio</span>{d.deliveryFee === null ? 'El de Configuración' : d.deliveryFee === 0 ? 'No se le cobra' : formatMoney(d.deliveryFee)}</div>
            <div><span>Paga con</span>{PAY.find(([k]) => k === (d.payMethod || ''))?.[1]}</div>
          </div>
          {d.notes && <div className="alert">{d.notes}</div>}
          <div className="kpis">
            <Kpi label="Compras" value={formatMoney(d.bought)} note={`${d.paidOrders} pedidos cobrados`} tone="brand" />
            <Kpi label="Ticket promedio" value={formatMoney(d.paidOrders ? Math.round(d.bought / d.paidOrders) : 0)} />
            <Kpi label="Debe" value={formatMoney(d.owed)} icon={MdRequestQuote} tone={d.owed ? 'warn' : ''} note={d.receivables.filter((r) => r.overdue).length ? `${d.receivables.filter((r) => r.overdue).length} vencidas` : null} />
            <Kpi label="Última compra" value={d.lastOrderAt ? formatDate(d.lastOrderAt) : '—'} note={d.open ? `${d.open} pedido${d.open === 1 ? '' : 's'} abierto${d.open === 1 ? '' : 's'}` : null} />
          </div>
          {d.topProducts.length > 0 && <Card title="Lo que más compra"><div className="chip-list">{d.topProducts.map((p) => <span key={p.name} className="pchip sm">{p.name} · {Number(p.quantity).toLocaleString('es-CO')}</span>)}</div></Card>}
          <Card title="Pedidos" flush>
            {!d.orders.length ? <Empty icon={<MdShoppingBag />}>Aún no tiene pedidos.</Empty> : (
              <div className="table-wrap"><table className="table hover">
                <thead><tr><th>Pedido</th><th className="hide-sm">Fecha</th><th className="hide-sm">Vendedor</th><th className="num">Total</th><th>Estado</th></tr></thead>
                <tbody>{d.orders.map((o) => (
                  <tr key={o.id} onClick={() => navigate(`/pedidos/${o.id}`)} style={{ cursor: 'pointer' }}>
                    <td><strong>{o.number}</strong><small className="block muted">{o.type === 'domicilio' ? `Domicilio${o.deliveryStatus ? ` · ${DELIVERY_LABEL[o.deliveryStatus]}` : ''}` : o.type === 'llevar' ? 'Para recoger' : o.type}</small></td>
                    <td className="hide-sm"><small>{formatDateTime(o.openedAt)}</small></td>
                    <td className="hide-sm">{o.seller || '—'}</td>
                    <td className="num money">{formatMoney(o.total)}</td>
                    <td><Badge tone={ORDER_TONE[o.status]}>{ORDER_STATUS[o.status]}</Badge></td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </Card>
          {has('cuentas_por_cobrar') && d.receivables.length > 0 && (
            <Card title="Cuentas por cobrar" flush>
              <div className="table-wrap"><table className="table">
                <thead><tr><th>Cuenta</th><th className="hide-sm">Pedido</th><th>Vence</th><th className="num">Saldo</th><th>Estado</th></tr></thead>
                <tbody>{d.receivables.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.number}</strong></td>
                    <td className="hide-sm">{r.order}</td>
                    <td>{r.dueDate ? formatDate(r.dueDate) : '—'}{r.overdue && <Badge tone="bad">Vencida</Badge>}</td>
                    <td className="num money">{formatMoney(r.balance)}</td>
                    <td><Badge tone={r.status === 'pagada' ? 'ok' : 'warn'}>{r.status === 'pagada' ? 'Pagada' : 'Pendiente'}</Badge></td>
                  </tr>
                ))}</tbody>
              </table></div>
            </Card>
          )}
        </div>
      )}
    </Modal>
  )
}

// ---------- Directorio de clientes ----------
const CustomersPage = () => {
  const navigate = useNavigate()
  const can = useCan()
  const { user } = useAuth()
  const { distributor } = usePlan()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [zone, setZone] = useState('')
  const [inactive, setInactive] = useState(false)
  const [rows, setRows] = useState(null)
  const [zones, setZones] = useState([])
  const [error, setError] = useState('')
  const [form, setForm] = useState(null)        // { initial }
  const [detail, setDetail] = useState(Number(params.get('id')) || null)
  const [order, setOrder] = useState(null)      // { customer, type }
  const [toast, toastNode] = useToast()
  const admin = ADMIN.includes(user.role)
  const sells = can(...SELLERS)
  const load = useCallback(() => {
    api.get('/clientes', { params: { q: q || undefined, zona: zone || undefined, inactivos: inactive ? 1 : undefined } }).then(({ data }) => { setRows(data); setError('') }).catch((e) => setError(errorMessage(e)))
  }, [q, zone, inactive])
  const loadZones = useCallback(() => api.get('/clientes/zonas').then(({ data }) => setZones(data)).catch(() => {}), [])
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])
  useEffect(() => { loadZones() }, [loadZones])
  useEffect(() => { const id = Number(params.get('id')); if (id) setDetail(id) }, [params])
  const closeDetail = () => { setDetail(null); if (params.get('id')) setParams({}, { replace: true }) }
  const totals = useMemo(() => {
    const list = rows || []
    return { count: list.length, owed: list.reduce((a, c) => a + (c.owed || 0), 0), debtors: list.filter((c) => c.owed > 0).length, bought: list.reduce((a, c) => a + (c.bought || 0), 0) }
  }, [rows])
  const saved = (c, created) => {
    setForm(null); load(); loadZones()
    toast(created ? `${c.name} quedó en tus clientes` : 'Cliente actualizado')
    if (created) setDetail(c.id)
  }
  const exportCsv = () => download('clientes', [['Cliente', 'name'], ['Tipo', 'kindLabel'], ['Cédula o NIT', 'doc'], ['Celular', 'phone'], ['Dirección', 'address'], ['Barrio', 'neighborhood'], ['Ciudad', 'city'], ['Zona', 'zone'], ['Pedidos', 'orders'], ['Compras', 'bought'], ['Debe', 'owed']], rows || [])
  return (
    <div className="stack">
      <PageHead title="Clientes" subtitle={distributor ? 'Tiendas, licoreras, bares y personas a las que les vendes. Elige uno al abrir un domicilio y sus datos se llenan solos.' : 'Tus clientes frecuentes, con su dirección, zona, historial y saldo.'}>
        {admin && <button type="button" className="btn" onClick={exportCsv} disabled={!rows?.length}><MdDownload /> Exportar</button>}
        {sells && <button type="button" className="btn btn-primary" onClick={() => setForm({ initial: null })}><MdAdd /> Nuevo cliente</button>}
      </PageHead>
      <div className="kpis">
        <Kpi label="Clientes" value={totals.count} icon={MdStorefront} tone="brand" note={zones.length ? `${zones.length} zona${zones.length === 1 ? '' : 's'} de reparto` : null} />
        <Kpi label="Compras" value={formatMoney(totals.bought)} note="Pedidos cobrados de estos clientes" />
        <Kpi label="Por cobrar" value={formatMoney(totals.owed)} icon={MdRequestQuote} tone={totals.owed ? 'warn' : ''} note={`${totals.debtors} cliente${totals.debtors === 1 ? '' : 's'} con saldo`} />
      </div>
      <Card flush>
        <div className="toolbar">
          <div className="input-icon grow"><MdSearch /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, celular, NIT o dirección" aria-label="Buscar cliente" /></div>
          <select value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Zona" style={{ maxWidth: 200 }}>
            <option value="">Todas las zonas</option>
            {zones.map((z) => <option key={z.zone} value={z.zone}>{z.zone} ({z.customers})</option>)}
          </select>
          {admin && <label className="check"><input type="checkbox" checked={inactive} onChange={(e) => setInactive(e.target.checked)} /> Ver inactivos</label>}
        </div>
        {error ? <div className="alert bad" style={{ margin: 16 }}>{error}</div> : !rows ? <div className="splash" style={{ minHeight: 160 }}><Spinner /></div> : !rows.length ? (
          <Empty icon={<MdStorefront />}>{q || zone ? 'No hay clientes con ese filtro.' : 'Aún no tienes clientes. Créalos aquí o marca "Guardar como cliente" al abrir un domicilio.'}</Empty>
        ) : (
          <div className="table-wrap"><table className="table hover">
            <thead><tr><th>Cliente</th><th className="hide-sm">Celular</th><th className="hide-md">Dirección</th><th className="num">Compras</th><th className="num hide-sm">Última</th><th className="num">Debe</th></tr></thead>
            <tbody>{rows.map((c) => (
              <tr key={c.id} onClick={() => setDetail(c.id)} style={{ cursor: 'pointer' }}>
                <td><strong>{c.name}</strong>{!c.active && <Badge tone="muted">Inactivo</Badge>}<small className="block muted">{[c.kindLabel, c.zone].filter(Boolean).join(' · ')}</small></td>
                <td className="hide-sm">{c.phone ? <span className="row" style={{ gap: 4 }}><MdPhone /> {c.phone}</span> : '—'}</td>
                <td className="hide-md"><small>{[c.address, c.neighborhood].filter(Boolean).join(', ') || '—'}</small></td>
                <td className="num money">{formatMoney(c.bought || 0)}<small className="block muted">{c.orders || 0} pedidos</small></td>
                <td className="num hide-sm"><small>{c.lastOrderAt ? formatDate(c.lastOrderAt) : '—'}</small></td>
                <td className="num money">{c.owed ? <strong className="text-warn">{formatMoney(c.owed)}</strong> : '—'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
      {detail && !form && !order && <CustomerDetail id={detail} onClose={closeDetail} onEdit={(d) => setForm({ initial: d })} onOrder={(c, type) => setOrder({ customer: c, type })} />}
      {form && <CustomerForm initial={form.initial} zones={zones} onClose={() => setForm(null)} onSaved={saved} />}
      {order && <OpenOrderModal type={order.type} customer={order.customer} onClose={() => setOrder(null)} onOpened={(o) => navigate(`/pedidos/${o.id}`)} />}
      {toastNode}
    </div>
  )
}

export default CustomersPage
