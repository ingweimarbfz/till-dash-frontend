import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { MdAdd, MdEdit, MdSearch, MdLocalShipping, MdPhone, MdWhatsapp, MdEmail, MdPlace, MdAccountBalance, MdInventory2, MdReceiptLong, MdShoppingCart, MdSave, MdDelete, MdDownload } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { Badge, Card, Empty, Field, Kpi, Modal, PageHead, Spinner, useToast } from '../../components/ui'
import { SitePicker, siteNamesOf, Tabs, useSites } from '../../components/forms'
import { Bars } from '../../components/charts'
import { loadSuppliers, SUPPLIER_CATEGORIES } from '../../components/SupplierField'
import { formatDate, formatMoney } from '../../utils/format'
import { download } from '../../utils/range'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const EMPTY = {
  name: '', legalName: '', docType: 'NIT', docNumber: '', category: 'bebidas', contactName: '', phone: '', whatsapp: '', email: '', address: '', city: '',
  paymentTerms: 0, bankName: '', bankAccountType: '', bankAccount: '', deliveryDays: [], notes: '', siteIds: [], active: true
}
const termsLabel = (d) => (d > 0 ? `Crédito a ${d} días` : 'De contado')
const waLink = (n) => `https://wa.me/${String(n).replace(/\D/g, '').replace(/^(?=3\d{9}$)/, '57')}`

// ---------- Crear o editar ----------
const SupplierModal = ({ initial, onClose, onSaved }) => {
  const editing = Boolean(initial?.id)
  const [f, setF] = useState({ ...EMPTY, ...(initial || {}) })
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const toggleDay = (d) => setF((x) => ({ ...x, deliveryDays: x.deliveryDays.includes(d) ? x.deliveryDays.filter((y) => y !== d) : [...x.deliveryDays, d] }))
  const submit = async (e) => {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      const body = { ...f, paymentTerms: Number(f.paymentTerms) || 0 }
      const { data } = editing ? await api.put(`/proveedores/${initial.id}`, body) : await api.post('/proveedores', body)
      loadSuppliers(true).catch(() => {})
      onSaved(data, editing)
    } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  return (
    <Modal size="lg" title={editing ? `Proveedor · ${initial.name}` : 'Nuevo proveedor'} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="sup-form" className="btn btn-primary" disabled={saving}>{saving ? <Spinner /> : <MdSave />} Guardar</button></>}>
      <form id="sup-form" className="stack" style={{ gap: 16 }} onSubmit={submit} noValidate>
        <h4 className="section-title">Datos principales</h4>
        <div className="form-grid">
          <Field label="Nombre comercial" htmlFor="sn" required><input id="sn" value={f.name} onChange={set('name')} autoFocus placeholder="Ej. Distribuidora El Mono" /></Field>
          <Field label="Razón social" htmlFor="sl"><input id="sl" value={f.legalName || ''} onChange={set('legalName')} placeholder="Ej. Distribuciones El Mono S.A.S." /></Field>
          <Field label="Tipo de documento" htmlFor="st"><select id="st" value={f.docType} onChange={set('docType')}>{['NIT', 'CC', 'CE', 'RUT', 'Otro'].map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Número de documento" htmlFor="sd"><input id="sd" value={f.docNumber || ''} onChange={set('docNumber')} placeholder="900123456-7" /></Field>
          <Field label="¿Qué surte?" htmlFor="sc"><select id="sc" value={f.category} onChange={set('category')}>{Object.entries(SUPPLIER_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <label className="check" style={{ alignSelf: 'end' }}><input type="checkbox" checked={f.active} onChange={set('active')} /> Proveedor activo</label>
        </div>
        <h4 className="section-title">Contacto</h4>
        <div className="form-grid">
          <Field label="Persona de contacto" htmlFor="sk"><input id="sk" value={f.contactName || ''} onChange={set('contactName')} placeholder="Vendedor o asesor" /></Field>
          <Field label="Correo" htmlFor="se"><input id="se" type="email" value={f.email || ''} onChange={set('email')} /></Field>
          <Field label="Teléfono" htmlFor="sp"><input id="sp" inputMode="tel" value={f.phone || ''} onChange={set('phone')} /></Field>
          <Field label="WhatsApp" htmlFor="sw"><input id="sw" inputMode="tel" value={f.whatsapp || ''} onChange={set('whatsapp')} placeholder="3001234567" /></Field>
          <Field label="Dirección" htmlFor="sa"><input id="sa" value={f.address || ''} onChange={set('address')} /></Field>
          <Field label="Ciudad" htmlFor="sci"><input id="sci" value={f.city || ''} onChange={set('city')} /></Field>
        </div>
        <div>
          <span className="label-sm">Días de visita o entrega</span>
          <div className="chip-list" style={{ marginTop: 6 }}>{DAYS.map((d, i) => <button key={d} type="button" className={`pchip${f.deliveryDays.includes(i) ? ' on' : ''}`} onClick={() => toggleDay(i)}>{d}</button>)}</div>
        </div>
        <h4 className="section-title">Pago</h4>
        <div className="form-grid">
          <Field label="Días de crédito" htmlFor="sterm" hint="0: se paga de contado"><input id="sterm" type="number" min={0} max={365} value={f.paymentTerms} onChange={set('paymentTerms')} /></Field>
          <Field label="Banco" htmlFor="sb"><input id="sb" value={f.bankName || ''} onChange={set('bankName')} placeholder="Ej. Bancolombia" /></Field>
          <Field label="Tipo de cuenta" htmlFor="sbt"><select id="sbt" value={f.bankAccountType || ''} onChange={set('bankAccountType')}><option value="">—</option><option value="ahorros">Ahorros</option><option value="corriente">Corriente</option></select></Field>
          <Field label="Número de cuenta" htmlFor="sba"><input id="sba" value={f.bankAccount || ''} onChange={set('bankAccount')} /></Field>
          <div className="span-2"><Field label="Notas" htmlFor="sno"><textarea id="sno" rows={2} value={f.notes || ''} onChange={set('notes')} placeholder="Ej. pedido mínimo, horario de entrega, descuentos por volumen" /></Field></div>
          <SitePicker value={f.siteIds || []} onChange={(v) => setF((x) => ({ ...x, siteIds: v }))} label="Le surte a" hint="Sin elegir ninguna, el proveedor aparece en todas las sucursales." />
        </div>
        {error && <div className="alert bad">{error}</div>}
      </form>
    </Modal>
  )
}

// ---------- Ficha ----------
const SupplierDetail = ({ id, onClose, onEdit, onDeleted, toast }) => {
  const [d, setD] = useState(null)
  const [tab, setTab] = useState('compras')
  const sites = useSites()
  useEffect(() => { api.get(`/proveedores/${id}`).then(({ data }) => setD(data)).catch((e) => { toast(errorMessage(e), 'bad'); onClose() }) }, [id, toast, onClose])
  const del = async () => {
    if (!window.confirm(`¿Eliminar el proveedor ${d.name}?`)) return // eslint-disable-line no-alert
    try { await api.delete(`/proveedores/${id}`); loadSuppliers(true).catch(() => {}); onDeleted(d) } catch (e) { toast(errorMessage(e), 'bad') }
  }
  if (!d) return <Modal size="xl" title="Proveedor" onClose={onClose}><div className="splash" style={{ minHeight: 200 }}><Spinner /></div></Modal>
  const monthly = d.monthly.map((m) => ({ label: `${MONTHS[Number(m.month.slice(5, 7)) - 1]} ${m.month.slice(2, 4)}`, value: m.total }))
  return (
    <Modal size="xl" title={d.name} onClose={onClose}
      footer={<><button type="button" className="btn btn-ghost" onClick={del}><MdDelete /> Eliminar</button><span className="grow" /><button type="button" className="btn" onClick={onClose}>Cerrar</button><button type="button" className="btn btn-primary" onClick={() => onEdit(d)}><MdEdit /> Editar</button></>}>
      <div className="stack" style={{ gap: 16 }}>
        <div className="sup-head">
          <div className="stack" style={{ gap: 4 }}>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <Badge tone="brand">{d.categoryLabel}</Badge>
              {d.active ? <Badge tone="ok">Activo</Badge> : <Badge tone="muted">Inactivo</Badge>}
              <Badge tone="muted">{termsLabel(d.paymentTerms)}</Badge>
            </div>
            {d.legalName && <small>{d.legalName}</small>}
            {d.docNumber && <small className="muted">{d.docType} {d.docNumber}</small>}
          </div>
          <ul className="sup-contact">
            {d.contactName && <li><b>{d.contactName}</b></li>}
            {d.phone && <li><MdPhone /> <a href={`tel:${d.phone}`}>{d.phone}</a></li>}
            {d.whatsapp && <li><MdWhatsapp /> <a href={waLink(d.whatsapp)} target="_blank" rel="noreferrer">{d.whatsapp}</a></li>}
            {d.email && <li><MdEmail /> <a href={`mailto:${d.email}`}>{d.email}</a></li>}
            {(d.address || d.city) && <li><MdPlace /> {[d.address, d.city].filter(Boolean).join(', ')}</li>}
            {d.bankAccount && <li><MdAccountBalance /> {d.bankName} · {d.bankAccountType === 'corriente' ? 'Corriente' : 'Ahorros'} {d.bankAccount}</li>}
            {sites.length > 1 && <li><MdPlace /> {siteNamesOf(sites, d.siteIds)}</li>}
            {d.deliveryDays.length > 0 && <li><MdLocalShipping /> Visita: {d.deliveryDays.map((x) => DAYS[x]).join(', ')}</li>}
          </ul>
        </div>
        {d.notes && <div className="alert"><span>{d.notes}</span></div>}
        <div className="kpis">
          <Kpi label="Comprado" value={formatMoney(d.totals.purchases)} icon={MdShoppingCart} tone="dark" note={`${d.totals.purchaseCount} entradas de inventario`} />
          <Kpi label="Pagado en gastos" value={formatMoney(d.totals.paid)} icon={MdReceiptLong} note={`${d.payments.filter((p) => p.status === 'activo').length} pagos`} />
          <Kpi label="Productos que surte" value={d.products.length} icon={MdInventory2} />
          <Kpi label="Última compra" value={d.totals.lastPurchase ? formatDate(d.totals.lastPurchase) : '—'} icon={MdLocalShipping} />
        </div>
        {monthly.length > 0 && <Card title="Compras y pagos por mes"><Bars data={monthly} height={150} ariaLabel="Compras y pagos por mes" /></Card>}
        <Tabs value={tab} onChange={setTab} tabs={[['compras', `Compras (${d.purchases.length})`], ['pagos', `Pagos (${d.payments.length})`], ['productos', `Productos (${d.products.length})`]]} />
        {tab === 'compras' && (d.purchases.length ? (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Fecha</th><th>Entrada</th><th>Productos</th><th>Bodega</th><th className="num">Total</th></tr></thead>
            <tbody>{d.purchases.map((p) => (
              <tr key={p.ref || p.date}>
                <td>{formatDate(p.date)}</td>
                <td><strong>{p.ref}</strong>{p.invoiceRef && <small className="block muted">Fact. {p.invoiceRef}</small>}</td>
                <td><small>{p.items.map((i) => `${i.quantity} ${i.name}`).join(', ')}</small></td>
                <td><small>{p.warehouse}</small></td>
                <td className="num money">{formatMoney(p.total)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <Empty icon={<MdShoppingCart />}>Aún no hay entradas de inventario de este proveedor. Elígelo al registrar una entrada en Inventario.</Empty>)}
        {tab === 'pagos' && (d.payments.length ? (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Fecha</th><th>Gasto</th><th>Concepto</th><th className="num">Valor</th></tr></thead>
            <tbody>{d.payments.map((p) => (
              <tr key={p.id} className={p.status === 'anulado' ? 'voided' : ''}>
                <td>{formatDate(p.paidOn)}</td>
                <td><strong>{p.number}</strong>{p.invoiceRef && <small className="block muted">Fact. {p.invoiceRef}</small>}</td>
                <td>{p.description}{p.status === 'anulado' && <> <Badge tone="muted">Anulado</Badge></>}</td>
                <td className="num money">{formatMoney(p.amount)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <Empty icon={<MdReceiptLong />}>Aún no hay gastos pagados a este proveedor.</Empty>)}
        {tab === 'productos' && (d.products.length ? (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Producto</th><th>Categoría</th><th className="num">Costo</th><th className="num">Precio</th><th className="num">Existencias</th></tr></thead>
            <tbody>{d.products.map((p) => (
              <tr key={p.id}><td><strong>{p.name}</strong>{p.sku && <small className="block muted">{p.sku}</small>}</td><td>{p.categoryEmoji} {p.category}</td><td className="num money">{formatMoney(p.cost)}</td><td className="num money">{formatMoney(p.price)}</td><td className="num">{p.stock}</td></tr>
            ))}</tbody>
          </table></div>
        ) : <Empty icon={<MdInventory2 />}>Ningún producto tiene a este proveedor como habitual. Asígnalo en la ficha del producto.</Empty>)}
      </div>
    </Modal>
  )
}

const SuppliersPage = () => {
  const [data, setData] = useState(null)
  const sites = useSites()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [edit, setEdit] = useState(null)
  const [view, setView] = useState(null)
  const [toast, toastNode] = useToast()
  const load = useCallback(() => api.get('/proveedores').then(({ data: d }) => setData(d)).catch((e) => toast(errorMessage(e), 'bad')), [toast])
  useEffect(() => { load() }, [load])
  const rows = useMemo(() => (data?.rows || []).filter((s) => (showInactive || s.active) && (!cat || s.category === cat) &&
    (!q || [s.name, s.legalName, s.docNumber, s.contactName, s.city].some((v) => v && v.toLowerCase().includes(q.toLowerCase())))), [data, q, cat, showInactive])
  const closeView = useCallback(() => setView(null), [])
  if (!data) return <div className="splash"><Spinner /></div>
  const active = data.rows.filter((s) => s.active)
  const used = [...new Set(data.rows.map((s) => s.category))]
  return (
    <div className="stack">
      <PageHead title="Proveedores" subtitle="Datos de quienes te surten. Se eligen al registrar entradas de inventario, gastos y en cada producto.">
        <button type="button" className="btn" onClick={() => download('proveedores', [['Nombre', 'name'], ['Razón social', 'legalName'], ['Documento', 'docType'], ['Número', 'docNumber'], ['Categoría', 'categoryLabel'], ['Contacto', 'contactName'], ['Teléfono', 'phone'], ['WhatsApp', 'whatsapp'], ['Correo', 'email'], ['Ciudad', 'city'], ['Días de crédito', 'paymentTerms'], ['Banco', 'bankName'], ['Cuenta', 'bankAccount'], ['Compras 90 días', 'purchases90']], rows)}><MdDownload /> Exportar</button>
        <button type="button" className="btn btn-primary" onClick={() => setEdit({})}><MdAdd /> Nuevo proveedor</button>
      </PageHead>
      <div className="kpis">
        <Kpi label="Proveedores activos" value={active.length} icon={MdLocalShipping} tone="dark" note={`${data.rows.length - active.length} inactivos`} />
        <Kpi label="Compras · 90 días" value={formatMoney(active.reduce((a, s) => a + s.purchases90, 0))} icon={MdShoppingCart} note="Entradas de inventario" />
        <Kpi label="Pagos · 90 días" value={formatMoney(active.reduce((a, s) => a + s.paid90, 0))} icon={MdReceiptLong} note="Gastos pagados a proveedores" />
        <Kpi label="Con crédito" value={active.filter((s) => s.paymentTerms > 0).length} icon={MdAccountBalance} note="Te dan días para pagar" />
      </div>
      <div className="toolbar">
        <div className="input-icon grow"><MdSearch /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, NIT, contacto o ciudad" aria-label="Buscar proveedor" /></div>
        <div className="chip-list">
          <button type="button" className={`pchip${!cat ? ' on' : ''}`} onClick={() => setCat('')}>Todos</button>
          {used.map((k) => <button key={k} type="button" className={`pchip${cat === k ? ' on' : ''}`} onClick={() => setCat(k)}>{SUPPLIER_CATEGORIES[k]}</button>)}
        </div>
        <label className="check"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Ver inactivos</label>
      </div>
      {!rows.length ? (
        <Card><Empty icon={<MdLocalShipping />}>{data.rows.length ? 'Ningún proveedor coincide con la búsqueda.' : 'Registra tu primer proveedor: la distribuidora de bebidas, el de carnes, el de desechables…'}</Empty></Card>
      ) : (
        <Card flush>
          <div className="table-wrap"><table className="table table-click">
            <thead><tr><th>Proveedor</th><th>Contacto</th><th>Pago</th><th className="num">Productos</th><th className="num">Compras 90 días</th><th>Última compra</th><th /></tr></thead>
            <tbody>{rows.map((s) => (
              <tr key={s.id} onClick={() => setView(s.id)} className={s.active ? '' : 'voided'}>
                <td><strong>{s.name}</strong><small className="block muted">{[s.docNumber && `${s.docType} ${s.docNumber}`, s.categoryLabel, sites.length > 1 && s.siteIds?.length > 0 && `solo en ${siteNamesOf(sites, s.siteIds)}`].filter(Boolean).join(' · ')}</small></td>
                <td><small>{s.contactName || '—'}</small>{(s.whatsapp || s.phone) && <small className="block muted">{s.whatsapp || s.phone}</small>}</td>
                <td><small>{termsLabel(s.paymentTerms)}</small></td>
                <td className="num">{s.products}</td>
                <td className="num money">{formatMoney(s.purchases90)}</td>
                <td><small>{s.lastPurchase ? formatDate(s.lastPurchase) : '—'}</small></td>
                <td className="num"><button type="button" className="btn btn-ghost btn-icon" aria-label={`Editar ${s.name}`} onClick={(e) => { e.stopPropagation(); setEdit(s) }}><MdEdit /></button></td>
              </tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}
      {view && <SupplierDetail id={view} onClose={closeView} toast={toast} onEdit={(s) => { setView(null); setEdit(s) }} onDeleted={(s) => { setView(null); toast(`Proveedor ${s.name} eliminado`); load() }} />}
      {edit && <SupplierModal initial={edit.id ? edit : null} onClose={() => setEdit(null)} onSaved={(s, e) => { setEdit(null); toast(e ? 'Proveedor guardado' : `Proveedor ${s.name} creado`); load() }} />}
      {toastNode}
    </div>
  )
}

export default SuppliersPage
