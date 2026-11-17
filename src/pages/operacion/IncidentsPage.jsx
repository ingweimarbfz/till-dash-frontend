import React, { useCallback, useEffect, useState } from 'react'
import { MdReportProblem, MdAdd, MdSearch, MdCheckCircle, MdBlock, MdReplay, MdEdit } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Badge, Card, Empty, Field, Kpi, Modal, PageHead, Spinner, useToast } from '../../components/ui'
import { MoneyInput, Tabs } from '../../components/forms'
import { formatDateTime, formatMoney } from '../../utils/format'
import { useCan } from './common'

export const INCIDENT_TYPES = {
  rotura: { label: 'Rotura', emoji: '🍽️', hint: 'Platos, vasos, copas o botellas' },
  dano: { label: 'Daño', emoji: '🛠️', hint: 'Equipos, muebles o el local' },
  faltante: { label: 'Faltante', emoji: '📦', hint: 'Producto o dinero que no aparece' },
  accidente: { label: 'Accidente', emoji: '🚑', hint: 'Caídas, cortes o quemaduras' },
  queja: { label: 'Queja de cliente', emoji: '🗣️', hint: 'Reclamos del servicio' },
  otro: { label: 'Otro', emoji: '⚠️', hint: 'Cualquier otra novedad' }
}
const STATUS_TONE = { abierto: 'warn', resuelto: '', descartado: 'muted' }
const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }
const toLocal = (iso) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }

// ---------- Reportar o editar ----------
const IncidentForm = ({ initial, onClose, onSaved }) => {
  const editing = Boolean(initial?.id)
  const [f, setF] = useState({
    type: initial?.type || 'rotura', title: initial?.title || '', description: initial?.description || '', cost: initial?.cost || '',
    quantity: initial?.quantity || '', productId: initial?.productId ? String(initial.productId) : '', responsibleId: initial?.responsibleId ? String(initial.responsibleId) : '',
    chargeToResponsible: initial?.chargeToResponsible || false, occurredAt: initial?.occurredAt ? toLocal(initial.occurredAt) : nowLocal()
  })
  const [staff, setStaff] = useState([])
  const [products, setProducts] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    api.get('/incidentes/personal').then(({ data }) => setStaff(data)).catch(() => {})
    api.get('/inventario/productos', { params: { activos: 1, sede: undefined } }).then(({ data }) => setProducts(data)).catch(() => {})
  }, [])
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const submit = async (e) => {
    e.preventDefault(); setError('')
    if (f.title.trim().length < 3) return setError('Describe en pocas palabras qué pasó.')
    setSaving(true)
    const body = { ...f, occurredAt: new Date(f.occurredAt).toISOString(), cost: f.cost === '' ? 0 : f.cost }
    try { const { data } = editing ? await api.put(`/incidentes/${initial.id}`, body) : await api.post('/incidentes', body); onSaved(data, editing) } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  return (
    <Modal size="lg" title={editing ? `Editar ${initial.number}` : 'Reportar incidente'} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="inc-form" className="btn btn-primary" disabled={saving}>{saving && <Spinner />} {editing ? 'Guardar' : 'Reportar'}</button></>}>
      <form id="inc-form" className="form-grid" onSubmit={submit} noValidate>
        <div className="span-2">
          <span className="label-sm">Tipo</span>
          <div className="inc-types">{Object.entries(INCIDENT_TYPES).map(([k, t]) => (
            <button key={k} type="button" className={`inc-type${f.type === k ? ' on' : ''}`} onClick={() => setF((x) => ({ ...x, type: k }))} aria-pressed={f.type === k}>
              <span className="inc-emoji" aria-hidden="true">{t.emoji}</span><strong>{t.label}</strong><small>{t.hint}</small>
            </button>
          ))}</div>
        </div>
        <div className="span-2"><Field label="¿Qué pasó?" htmlFor="it" required><input id="it" value={f.title} onChange={set('title')} maxLength={120} placeholder="Ej. se rompieron 3 copas de vino en la barra" autoFocus /></Field></div>
        <div className="span-2"><Field label="Detalle" htmlFor="id"><textarea id="id" rows={3} value={f.description} onChange={set('description')} placeholder="Cómo pasó, quién estaba, qué se hizo" /></Field></div>
        <Field label="Producto afectado (opcional)" htmlFor="ip"><select id="ip" value={f.productId} onChange={set('productId')}><option value="">Ninguno</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Cantidad" htmlFor="iq"><input id="iq" type="number" min="0" step="any" value={f.quantity} onChange={set('quantity')} placeholder="Ej. 3" /></Field>
        <Field label="Costo estimado" htmlFor="ic" hint="Lo que cuesta reponer o reparar"><MoneyInput id="ic" value={f.cost} onChange={(v) => setF((x) => ({ ...x, cost: v }))} /></Field>
        <Field label="Fecha y hora" htmlFor="io"><input id="io" type="datetime-local" value={f.occurredAt} max={nowLocal()} onChange={set('occurredAt')} /></Field>
        <Field label="Responsable (opcional)" htmlFor="ir"><select id="ir" value={f.responsibleId} onChange={set('responsibleId')}><option value="">Sin responsable</option>{staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        <label className="check" style={{ alignSelf: 'end', paddingBottom: 10 }}><input type="checkbox" checked={f.chargeToResponsible} onChange={set('chargeToResponsible')} disabled={!f.responsibleId} /> Se le descuenta al responsable</label>
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>
  )
}

// ---------- Resolver / descartar ----------
const ResolveModal = ({ incident, status, onClose, onDone }) => {
  const [resolution, setResolution] = useState('')
  const [error, setError] = useState('')
  const submit = async (e) => {
    e.preventDefault(); setError('')
    try { const { data } = await api.post(`/incidentes/${incident.id}/estado`, { status, resolution }); onDone(data) } catch (err) { setError(errorMessage(err)) }
  }
  return (
    <Modal title={`${status === 'resuelto' ? 'Resolver' : 'Descartar'} ${incident.number}`} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="res-form" className="btn btn-primary">{status === 'resuelto' ? 'Marcar resuelto' : 'Descartar'}</button></>}>
      <form id="res-form" className="stack" onSubmit={submit} noValidate>
        <Field label={status === 'resuelto' ? '¿Cómo se resolvió?' : '¿Por qué se descarta?'} htmlFor="rs" required>
          <textarea id="rs" rows={3} value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder={status === 'resuelto' ? 'Ej. se repusieron las copas, se descontó de la nómina' : 'Ej. reporte duplicado'} autoFocus />
        </Field>
        {error && <div className="alert bad">{error}</div>}
      </form>
    </Modal>
  )
}

// Incidentes: roturas, daños, faltantes, accidentes y quejas con su costo y responsable.
const IncidentsPage = () => {
  const { user } = useAuth()
  const can = useCan()
  const manager = can('cajero')
  const [tab, setTab] = useState('abierto')
  const [type, setType] = useState('')
  const [q, setQ] = useState('')
  const [data, setData] = useState(null)
  const [modal, setModal] = useState(null)
  const [toast, toastNode] = useToast()
  const load = useCallback(() => api.get('/incidentes', { params: { estado: tab === 'todos' ? undefined : tab, tipo: type || undefined, q: q || undefined } }).then(({ data: d }) => setData(d)).catch((e) => { setData({ rows: [], open: 0, costMonth: 0 }); toast(errorMessage(e), 'bad') }), [tab, type, q, toast])
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])
  const reopen = async (i) => { try { await api.post(`/incidentes/${i.id}/estado`, { status: 'abierto' }); toast('Incidente reabierto'); load() } catch (e) { toast(errorMessage(e), 'bad') } }
  return (
    <div className="stack">
      <PageHead title="Incidentes" subtitle="Platos rotos, daños, faltantes, accidentes y quejas. Todo queda en la bitácora.">
        <button type="button" className="btn btn-primary" onClick={() => setModal({ form: {} })}><MdAdd /> Reportar</button>
      </PageHead>
      <div className="kpis">
        <Kpi label="Abiertos" value={data ? data.open : '—'} icon={MdReportProblem} tone={data?.open ? 'warn' : ''} />
        <Kpi label="Costo del mes" value={formatMoney(data?.costMonth || 0)} note="Sin contar los descartados" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[['abierto', 'Abiertos'], ['resuelto', 'Resueltos'], ['descartado', 'Descartados'], ['todos', 'Todos']]} />
      <Card flush>
        <div className="toolbar">
          <div className="input-icon grow"><MdSearch /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número o descripción" aria-label="Buscar" /></div>
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo"><option value="">Todos los tipos</option>{Object.entries(INCIDENT_TYPES).map(([k, t]) => <option key={k} value={k}>{t.emoji} {t.label}</option>)}</select>
        </div>
        {!data ? <div className="splash" style={{ minHeight: 140 }}><Spinner /></div> : !data.rows.length ? <Empty icon={<MdReportProblem />}>{tab === 'abierto' ? 'No hay incidentes abiertos. 🎉' : 'No hay incidentes con ese filtro.'}</Empty> : (
          <ul className="inc-list">{data.rows.map((i) => (
            <li key={i.id}>
              <span className="inc-emoji" aria-hidden="true">{INCIDENT_TYPES[i.type]?.emoji}</span>
              <div className="grow">
                <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}><strong>{i.title}</strong><Badge tone={STATUS_TONE[i.status]}>{i.statusLabel}</Badge>{i.chargeToResponsible && <Badge tone="bad">Se descuenta</Badge>}</div>
                <small className="block muted">{[i.number, i.typeLabel, i.product && `${i.quantity ? `${i.quantity} × ` : ''}${i.product}`, i.responsible && `Responsable: ${i.responsible}`, `reportó ${i.reportedBy}`, formatDateTime(i.occurredAt), i.site].filter(Boolean).join(' · ')}</small>
                {i.description && <p className="inc-desc">{i.description}</p>}
                {i.resolution && <p className="inc-res">{i.status === 'resuelto' ? '✅' : '🚫'} {i.resolution} <small className="muted">· {i.resolvedBy}</small></p>}
              </div>
              <div className="inc-side">
                {i.cost > 0 && <strong className="money">{formatMoney(i.cost)}</strong>}
                <div className="row" style={{ gap: 4 }}>
                  {(manager || (i.reportedById === user.id && i.status === 'abierto')) && <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Editar ${i.number}`} title="Editar" onClick={() => setModal({ form: i })}><MdEdit /></button>}
                  {manager && i.status === 'abierto' && <>
                    <button type="button" className="btn btn-sm" onClick={() => setModal({ resolve: i, status: 'descartado' })} title="Descartar"><MdBlock /></button>
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => setModal({ resolve: i, status: 'resuelto' })}><MdCheckCircle /> Resolver</button>
                  </>}
                  {manager && i.status !== 'abierto' && <button type="button" className="btn btn-sm btn-ghost" onClick={() => reopen(i)}><MdReplay /> Reabrir</button>}
                </div>
              </div>
            </li>
          ))}</ul>
        )}
      </Card>
      {modal?.form && <IncidentForm initial={modal.form.id ? modal.form : null} onClose={() => setModal(null)} onSaved={(d, e) => { setModal(null); toast(e ? 'Incidente actualizado' : `Incidente ${d.number} reportado`); load() }} />}
      {modal?.resolve && <ResolveModal incident={modal.resolve} status={modal.status} onClose={() => setModal(null)} onDone={(d) => { setModal(null); toast(d.status === 'resuelto' ? 'Incidente resuelto' : 'Incidente descartado'); load() }} />}
      {toastNode}
    </div>
  )
}

export default IncidentsPage
