import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { MdAdd, MdEdit, MdStorefront, MdWorkspacePremium, MdInbox, MdTrendingUp, MdHourglassTop, MdEventRepeat, MdCheck, MdClose, MdPhone, MdStar, MdGavel } from 'react-icons/md'
import papi from './api'
import { errorMessage } from '../api/client'
import { Badge, Card, Empty, Field, Kpi, Modal, PageHead, Spinner, useToast } from '../components/ui'
import { formatDate, formatDateTime } from '../utils/format'
import { OrgLegalModal } from './legalPages'
import { CountryLabel, CountrySelect, Flag, FEATURE_SHORT, annualPrice, limitText, moneyIn } from '../utils/countries'

const GROUPS = { operacion: 'Operación', catalogo: 'Catálogo', clientes: 'Clientes', control: 'Control', marca: 'Marca' }
export const BUSINESS_TYPES = { restaurante: 'Restaurante', bar: 'Bar', social_bar: 'Social bar', discoteca: 'Discoteca', cafeteria: 'Cafetería', market: 'Market', otro: 'Otro' }
const STATUS = { activa: ['Activo', 'brand'], prueba: ['En prueba', 'warn'], suspendida: ['Suspendido', 'bad'], cancelada: ['Cancelado', 'muted'] }
const REQ = { pendiente: ['Pendiente', 'warn'], contactado: ['Contactado', 'dark'], aplicada: ['Aplicada', 'brand'], rechazada: ['Rechazada', 'muted'] }
const LIMITS = [
  ['sites', 'Sucursales'], ['admins', 'Administradores'], ['employees', 'Empleados'],
  ['tables', 'Mesas'], ['products', 'Productos']
]
const USAGE_KEY = { sites: 'sites', admins: 'admins', employees: 'employees', tables: 'tables', products: 'products' }

// Carga del catálogo (países y funcionalidades), común a varias páginas.
const useCatalog = () => {
  const [cat, setCat] = useState(null)
  const load = useCallback(() => papi.get('/plataforma/catalogo').then(({ data }) => setCat(data)).catch(() => setCat({ countries: [], features: [] })), [])
  useEffect(() => { load() }, [load])
  return [cat, load]
}

const Loading = () => <div className="splash"><Spinner /></div>

// ======================= Resumen =======================
export const SummaryPage = () => {
  const [d, setD] = useState(null)
  const [cat] = useCatalog()
  useEffect(() => { papi.get('/plataforma/resumen').then(({ data }) => setD(data)).catch(() => setD(false)) }, [])
  if (d === null || !cat) return <Loading />
  if (!d) return <Card><Empty>No se pudo cargar el resumen.</Empty></Card>
  const localeOf = (cur) => cat.countries.find((c) => c.currency === cur)?.locale || 'es-CO'
  return (
    <div className="stack">
      <PageHead title="Resumen de la plataforma" subtitle="Establecimientos que usan TillDash+, ingreso mensual por moneda y renovaciones próximas." />
      <div className="grid grid-kpi">
        <Kpi label="Establecimientos activos" value={d.byStatus.activa || 0} icon={MdStorefront} tone="brand" note={`${d.organizations} en total`} />
        <Kpi label="En prueba" value={d.byStatus.prueba || 0} icon={MdHourglassTop} note="Aún no pagan" />
        <Kpi label="Solicitudes pendientes" value={d.pendingRequests} icon={MdInbox} tone={d.pendingRequests ? 'warn' : ''} note="Cambios de plan por atender" />
        <Kpi label="Planes ofrecidos" value={d.plans} icon={MdWorkspacePremium} note={`En ${d.countries} países`} />
      </div>
      <div className="grid grid-2">
        <Card title="Ingreso mensual recurrente" subtitle="Establecimientos activos; los anuales cuentan su valor dividido en 12." icon={<MdTrendingUp />}>
          {!d.mrr.length ? <Empty>Aún no hay establecimientos activos con plan.</Empty> : (
            <div className="mrr-list">
              {d.mrr.map((m) => <div key={m.currency}><b className="cur">{m.currency}</b><strong>{moneyIn(m.value, m.currency, localeOf(m.currency))}</strong></div>)}
            </div>
          )}
        </Card>
        <Card title="Establecimientos por país">
          {!d.byCountry.length ? <Empty>Sin establecimientos.</Empty> : (
            <div className="mini-list">
              {d.byCountry.map((c) => <div key={c.code} className="mini-row"><CountryLabel c={c} /><strong>{c.organizations}</strong></div>)}
            </div>
          )}
          <div className="chip-list" style={{ marginTop: 12 }}>
            {d.byPlan.map((p) => <Badge key={p.name} tone="dark">{p.name}: {p.organizations}</Badge>)}
          </div>
        </Card>
      </div>
      <Card title="Renovaciones en los próximos 15 días" icon={<MdEventRepeat />} flush>
        {!d.renewals.length ? <Empty>No hay renovaciones próximas.</Empty> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Establecimiento</th><th>País</th><th>Plan</th><th>Estado</th><th>Renueva</th></tr></thead>
            <tbody>{d.renewals.map((o) => (
              <tr key={o.id}><td><strong>{o.name}</strong></td><td><CountryLabel c={o.country} /></td><td>{o.planName || '—'}</td><td><Badge tone={STATUS[o.status][1]}>{STATUS[o.status][0]}</Badge></td><td>{formatDate(o.renewalDate)}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  )
}

// ======================= Planes =======================
const emptyPlan = (countries) => ({
  code: '', name: '', tagline: '', badge: '', support: '', highlight: false, active: true,
  limits: { sites: 1, admins: 1, employees: 5, tables: 15, products: 150 },
  features: [], bullets: [], annualDiscount: 16.7, trialDays: 15, sortOrder: 0,
  prices: countries.map((c) => ({ country: c.code, month: '' }))
})

const PlanForm = ({ initial, cat, onClose, onSaved }) => {
  const editing = !!initial?.id
  const [f, setF] = useState(() => {
    const base = editing ? { ...initial } : emptyPlan(cat.countries)
    // Una fila de precio por país, aunque el plan no se venda en alguno.
    base.prices = cat.countries.map((c) => ({ country: c.code, month: base.prices?.find((p) => p.country === c.code)?.month ?? '' }))
    base.limits = Object.fromEntries(LIMITS.map(([k]) => [k, base.limits?.[k] ?? '']))
    base.bulletsText = (base.bullets || []).join('\n')
    return base
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const setLimit = (k, v) => setF((x) => ({ ...x, limits: { ...x.limits, [k]: v } }))
  const setPrice = (code, v) => setF((x) => ({ ...x, prices: x.prices.map((p) => (p.country === code ? { ...p, month: v } : p)) }))
  const toggle = (key) => setF((x) => ({ ...x, features: x.features.includes(key) ? x.features.filter((k) => k !== key) : [...x.features, key] }))
  const annual = (m) => (m === '' ? '' : annualPrice(m, f.annualDiscount))
  const groups = useMemo(() => Object.entries(GROUPS).map(([g, label]) => ({ g, label, items: cat.features.filter((x) => x.group === g) })).filter((x) => x.items.length), [cat.features])
  const save = async () => {
    setSaving(true); setError('')
    const body = { ...f, bullets: f.bulletsText.split('\n').map((s) => s.trim()).filter(Boolean), limits: Object.fromEntries(Object.entries(f.limits).map(([k, v]) => [k, v === '' ? null : Number(v)])) }
    delete body.bulletsText
    try {
      const { data } = editing ? await papi.put(`/plataforma/planes/${initial.id}`, body) : await papi.post('/plataforma/planes', body)
      onSaved(data, editing)
    } catch (e) { setError(errorMessage(e)); setSaving(false) }
  }
  return (
    <Modal title={editing ? `Editar plan ${initial.name}` : 'Nuevo plan'} size="lg" onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-primary" disabled={saving} onClick={save}>{saving && <Spinner />} Guardar plan</button></>}>
      <div className="stack">
        <div className="form-grid">
          <Field label="Nombre" required htmlFor="pn"><input id="pn" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Profesional" /></Field>
          <Field label="Código" required htmlFor="pc" hint="En minúsculas, sin espacios. Identifica el plan en los sitios."><input id="pc" value={f.code} onChange={(e) => set('code', e.target.value.toLowerCase())} placeholder="profesional" /></Field>
          <Field label="Frase corta" htmlFor="pt"><input id="pt" value={f.tagline || ''} onChange={(e) => set('tagline', e.target.value)} placeholder="Para el establecimiento con buen movimiento" /></Field>
          <Field label="Soporte" htmlFor="ps"><input id="ps" value={f.support || ''} onChange={(e) => set('support', e.target.value)} placeholder="WhatsApp y llamada" /></Field>
          <Field label="Etiqueta destacada" htmlFor="pb"><input id="pb" value={f.badge || ''} onChange={(e) => set('badge', e.target.value)} placeholder="Más elegido" /></Field>
          <Field label="Orden en los sitios" htmlFor="po"><input id="po" type="number" value={f.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} /></Field>
        </div>
        <div className="chip-list">
          <label className="check"><input type="checkbox" checked={f.highlight} onChange={(e) => set('highlight', e.target.checked)} /><span>Resaltar como recomendado</span></label>
          <label className="check"><input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} /><span>Se ofrece (activo)</span></label>
        </div>

        <div className="plt-section">
          <h4>Límites del plan</h4>
          <small className="hint">Cuántos puede crear el establecimiento. Vacío = ilimitado; 0 = no incluido.</small>
          <div className="limit-grid">
            {LIMITS.map(([k, label]) => (
              <Field key={k} label={label} htmlFor={`l-${k}`}><input id={`l-${k}`} type="number" min="0" value={f.limits[k]} onChange={(e) => setLimit(k, e.target.value)} placeholder="Ilimitado" /></Field>
            ))}
          </div>
        </div>

        <div className="plt-section">
          <h4>Funcionalidades incluidas</h4>
          <div className="feature-groups">
            {groups.map((g) => (
              <div key={g.g}>
                <small className="muted">{g.label}</small>
                {g.items.map((x) => (
                  <label key={x.key} className="check" title={x.description}>
                    <input type="checkbox" checked={x.core || f.features.includes(x.key)} disabled={x.core} onChange={() => toggle(x.key)} />
                    <span>{x.label}{x.core && <small className="muted"> · siempre</small>}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="plt-section">
          <h4>Precio por país</h4>
          <small className="hint">Precio mensual en la moneda de cada país. Deja vacío un país donde este plan no se vende. El anual aplica el descuento.</small>
          <div className="form-grid" style={{ maxWidth: 420 }}>
            <Field label="Descuento anual (%)" htmlFor="pd"><input id="pd" type="number" min="0" max="90" step="0.1" value={f.annualDiscount} onChange={(e) => set('annualDiscount', e.target.value)} /></Field>
            <Field label="Días de prueba" htmlFor="pdt"><input id="pdt" type="number" min="0" value={f.trialDays} onChange={(e) => set('trialDays', e.target.value)} /></Field>
          </div>
          <div className="table-wrap"><table className="table price-table">
            <thead><tr><th>País</th><th>Moneda</th><th>Mensual</th><th className="right">Anual</th></tr></thead>
            <tbody>{cat.countries.map((c) => {
              const p = f.prices.find((x) => x.country === c.code)
              return (
                <tr key={c.code} className={!c.active ? 'muted' : ''}>
                  <td><span className="country-label"><Flag code={c.code} size={14} /><span>{c.name}</span></span>{!c.active && <small className="muted"> · inactivo</small>}</td>
                  <td><b className="cur">{c.currency}</b></td>
                  <td><div className="input-prefix"><span>{c.currency}</span><input type="number" min="0" step="any" value={p.month} onChange={(e) => setPrice(c.code, e.target.value)} placeholder="No se vende" aria-label={`Precio mensual en ${c.name}`} /></div></td>
                  <td className="right num">{p.month === '' ? '—' : moneyIn(annual(p.month), c.currency, c.locale)}</td>
                </tr>
              )
            })}</tbody>
          </table></div>
        </div>

        <Field label="Puntos clave para los sitios (uno por línea)" htmlFor="pbl"><textarea id="pbl" rows={4} value={f.bulletsText} onChange={(e) => set('bulletsText', e.target.value)} placeholder={'3 sucursales y 25 empleados\nHasta 60 mesas'} /></Field>
        {error && <div className="alert bad">{error}</div>}
      </div>
    </Modal>
  )
}

export const PlansPage = () => {
  const [cat] = useCatalog()
  const [plans, setPlans] = useState(null)
  const [country, setCountry] = useState('CO')
  const [modal, setModal] = useState(null)
  const [toast, toastNode] = useToast()
  const load = useCallback(() => papi.get('/plataforma/planes').then(({ data }) => setPlans(data)).catch((e) => { toast(errorMessage(e), 'bad'); setPlans([]) }), [toast])
  useEffect(() => { load() }, [load])
  if (!plans || !cat) return <Loading />
  const c = cat.countries.find((x) => x.code === country)
  const remove = async (p) => {
    try { const { data } = await papi.delete(`/plataforma/planes/${p.id}`); toast(data.message || 'Plan eliminado'); load() } catch (e) { toast(errorMessage(e), 'bad') }
  }
  return (
    <div className="stack">
      <PageHead title="Planes y precios" subtitle="Cada plan define cuántos usuarios, sedes y clientes permite, qué módulos incluye y su precio en cada país.">
        <div className="plt-country"><small>Ver precios en</small><CountrySelect countries={cat.countries} value={country} onChange={setCountry} /></div>
        <button type="button" className="btn btn-primary" onClick={() => setModal({})}><MdAdd /> Nuevo plan</button>
      </PageHead>
      <div className="plan-admin-grid">
        {plans.map((p) => {
          const price = p.prices.find((x) => x.country === country)
          return (
            <Card key={p.id} className={`plan-admin${p.highlight ? ' hl' : ''}${!p.active ? ' off' : ''}`}>
              <div className="row-between">
                <div>
                  <h3>{p.name} {p.badge && <Badge tone="brand"><MdStar /> {p.badge}</Badge>}</h3>
                  <small>{p.tagline}</small>
                </div>
                {!p.active && <Badge tone="muted">Inactivo</Badge>}
              </div>
              <div className="plan-admin-price">
                {price ? (<><strong>{moneyIn(price.month, price.currency, c?.locale)}</strong><span>/ mes · {price.currency}</span><small>Anual {moneyIn(price.year, price.currency, c?.locale)}</small></>) : <span className="muted">No se vende en {c?.name}</span>}
              </div>
              <div className="limit-chips">
                {LIMITS.map(([k, label]) => <div key={k}><small>{label}</small><strong>{limitText(p.limits[k])}</strong></div>)}
              </div>
              <div className="chip-list">
                {cat.features.filter((x) => p.features.includes(x.key)).map((x) => <Badge key={x.key}>{FEATURE_SHORT[x.key] || x.label}</Badge>)}
              </div>
              <div className="row-between" style={{ marginTop: 'auto' }}>
                <small className="muted">{p.organizations} establecimiento(s) · {p.prices.length} país(es)</small>
                <div className="row-end">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(p)} title={p.organizations ? 'Se desactiva porque tiene establecimientos' : 'Eliminar'}>{p.organizations ? 'Desactivar' : 'Eliminar'}</button>
                  <button type="button" className="btn btn-sm" onClick={() => setModal(p)}><MdEdit /> Editar</button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
      {modal && <PlanForm initial={modal.id ? modal : null} cat={cat} onClose={() => setModal(null)} onSaved={(d, e) => { setModal(null); load(); toast(e ? 'Plan actualizado' : `Plan ${d.name} creado`) }} />}
      {toastNode}
    </div>
  )
}

// ======================= Establecimientos =======================
const OrgForm = ({ initial, cat, plans, onClose, onSaved }) => {
  const editing = !!initial?.id
  const [f, setF] = useState(() => editing
    ? { ...initial, planId: initial.planId || '' }
    : { name: '', businessType: 'restaurante', nit: '', phone: '', email: '', city: '', address: '', countryCode: 'CO', planId: plans.find((p) => p.highlight)?.id || '', billingCycle: 'mensual', status: 'prueba', startDate: '', renewalDate: '', contactName: '', notes: '', extraFeatures: [], admin: { identification: '', name: '', lastName: '', username: '', email: '', phone: '' } })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const setA = (k, v) => setF((x) => ({ ...x, admin: { ...x.admin, [k]: v } }))
  const country = cat.countries.find((c) => c.code === f.countryCode)
  const plan = plans.find((p) => p.id === Number(f.planId))
  const price = plan?.prices.find((x) => x.country === f.countryCode)
  const extras = cat.features.filter((x) => !x.core && plan && !plan.features.includes(x.key))
  const save = async () => {
    setSaving(true); setError('')
    try {
      const body = { ...f, planId: f.planId ? Number(f.planId) : null }
      const { data } = editing ? await papi.put(`/plataforma/organizaciones/${initial.id}`, body) : await papi.post('/plataforma/organizaciones', body)
      onSaved(data, editing)
    } catch (e) { setError(errorMessage(e)); setSaving(false) }
  }
  return (
    <Modal title={editing ? `Editar ${initial.name}` : 'Nuevo establecimiento'} size="lg" onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-primary" disabled={saving} onClick={save}>{saving && <Spinner />} {editing ? 'Guardar' : 'Crear establecimiento'}</button></>}>
      <div className="stack">
        <div className="form-grid">
          <Field label="Nombre del establecimiento" required htmlFor="on"><input id="on" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Tipo" htmlFor="obt"><select id="obt" value={f.businessType || 'restaurante'} onChange={(e) => set('businessType', e.target.value)}>{Object.entries(BUSINESS_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="NIT / RUC / documento fiscal" htmlFor="oi"><input id="oi" data-only="nit" maxLength={15} value={f.nit || ''} onChange={(e) => set('nit', e.target.value)} /></Field>
          <Field label="País" required htmlFor="oc" hint={country ? `Moneda ${country.currency} (${country.currencyName}) · ${country.phonePrefix}` : null}><CountrySelect id="oc" countries={cat.countries.filter((c) => c.active || c.code === f.countryCode)} value={f.countryCode} onChange={(v) => set('countryCode', v)} /></Field>
          <Field label="Ciudad" htmlFor="ocity"><input id="ocity" data-only="letters" value={f.city || ''} onChange={(e) => set('city', e.target.value)} /></Field>
          <Field label="Contacto" htmlFor="ocn"><input id="ocn" data-only="letters" value={f.contactName || ''} onChange={(e) => set('contactName', e.target.value)} /></Field>
          <Field label="Teléfono" htmlFor="op"><input id="op" inputMode="numeric" minLength={7} maxLength={10} value={f.phone || ''} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="Correo" htmlFor="oe"><input id="oe" type="email" value={f.email || ''} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label="Dirección" htmlFor="oa"><input id="oa" value={f.address || ''} onChange={(e) => set('address', e.target.value)} /></Field>
        </div>
        <div className="plt-section">
          <h4>Plan y servicio</h4>
          <div className="form-grid">
            <Field label="Plan" htmlFor="opl" hint={plan ? (price ? `${moneyIn(f.billingCycle === 'anual' ? price.year : price.month, price.currency, country?.locale)} ${f.billingCycle === 'anual' ? 'al año' : 'al mes'} en ${country?.name}` : `Este plan no tiene precio en ${country?.name}`) : 'Sin plan: no tiene restricciones'}>
              <select id="opl" value={f.planId} onChange={(e) => set('planId', e.target.value)}>
                <option value="">Sin plan</option>
                {plans.filter((p) => p.active || p.id === Number(f.planId)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Ciclo de pago" htmlFor="ocy"><select id="ocy" value={f.billingCycle} onChange={(e) => set('billingCycle', e.target.value)}><option value="mensual">Mensual</option><option value="anual">Anual</option></select></Field>
            <Field label="Estado" htmlFor="ost"><select id="ost" value={f.status} onChange={(e) => set('status', e.target.value)}>{Object.entries(STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            <Field label="Inicio" htmlFor="osd"><input id="osd" type="date" value={f.startDate || ''} onChange={(e) => set('startDate', e.target.value)} /></Field>
            <Field label="Renovación" htmlFor="ord" hint={!editing ? 'Vacío: se calcula con la prueba o el ciclo' : null}><input id="ord" type="date" value={f.renewalDate || ''} onChange={(e) => set('renewalDate', e.target.value)} /></Field>
          </div>
          {!!extras.length && (
            <div className="stack" style={{ gap: 6 }}>
              <small className="muted">Funcionalidades adicionales a las del plan</small>
              <div className="chip-list">{extras.map((x) => (
                <label key={x.key} className="check"><input type="checkbox" checked={f.extraFeatures.includes(x.key)} onChange={() => set('extraFeatures', f.extraFeatures.includes(x.key) ? f.extraFeatures.filter((k) => k !== x.key) : [...f.extraFeatures, x.key])} /><span>{x.label}</span></label>
              ))}</div>
            </div>
          )}
          <Field label="Notas internas" htmlFor="ono"><textarea id="ono" rows={2} value={f.notes || ''} onChange={(e) => set('notes', e.target.value)} /></Field>
        </div>
        {!editing && (
          <div className="plt-section">
            <h4>Super administrador del establecimiento</h4>
            <small className="hint">Entra a la app con su usuario y su número de documento como contraseña; después la puede cambiar.</small>
            <div className="form-grid">
              <Field label="Documento" required htmlFor="ai"><input id="ai" inputMode="numeric" minLength={5} maxLength={15} value={f.admin.identification} onChange={(e) => setA('identification', e.target.value)} /></Field>
              <Field label="Usuario" required htmlFor="au"><input id="au" value={f.admin.username} onChange={(e) => setA('username', e.target.value.toLowerCase())} placeholder="nombre.apellido" /></Field>
              <Field label="Nombres" required htmlFor="an"><input id="an" data-only="letters" value={f.admin.name} onChange={(e) => setA('name', e.target.value)} /></Field>
              <Field label="Apellidos" htmlFor="al"><input id="al" data-only="letters" value={f.admin.lastName} onChange={(e) => setA('lastName', e.target.value)} /></Field>
              <Field label="Correo" htmlFor="ae"><input id="ae" type="email" value={f.admin.email} onChange={(e) => setA('email', e.target.value)} /></Field>
              <Field label="Teléfono" htmlFor="ap"><input id="ap" inputMode="numeric" minLength={7} maxLength={10} value={f.admin.phone} onChange={(e) => setA('phone', e.target.value)} /></Field>
            </div>
          </div>
        )}
        {error && <div className="alert bad">{error}</div>}
      </div>
    </Modal>
  )
}

const UsageBar = ({ used, max }) => {
  const pct = max === null || max === undefined || max === 0 ? 0 : Math.min(100, Math.round((used / max) * 100))
  return (
    <div className={`usebar${max && used > max ? ' full' : pct >= 80 ? ' near' : ''}`}>
      <span>{used}{max === null || max === undefined ? '' : ` / ${max}`}</span>
      {max !== null && max !== undefined && <i style={{ width: `${pct}%` }} />}
    </div>
  )
}

export const OrgsPage = () => {
  const [cat] = useCatalog()
  const [orgs, setOrgs] = useState(null)
  const [plans, setPlans] = useState([])
  const [modal, setModal] = useState(null)
  const [legal, setLegal] = useState(null)
  const [q, setQ] = useState('')
  const [toast, toastNode] = useToast()
  const load = useCallback(() => {
    papi.get('/plataforma/organizaciones').then(({ data }) => setOrgs(data)).catch((e) => { toast(errorMessage(e), 'bad'); setOrgs([]) })
    papi.get('/plataforma/planes').then(({ data }) => setPlans(data)).catch(() => {})
  }, [toast])
  useEffect(() => { load() }, [load])
  if (!orgs || !cat) return <Loading />
  const shown = orgs.filter((o) => !q || `${o.name} ${o.city || ''} ${o.country?.name || ''} ${o.planName || ''}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="stack">
      <PageHead title="Establecimientos" subtitle="Cada establecimiento tiene su país (moneda), su plan y el uso de sus límites.">
        <button type="button" className="btn btn-primary" onClick={() => setModal({})}><MdAdd /> Nuevo establecimiento</button>
      </PageHead>
      <Card flush>
        <div className="toolbar"><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, ciudad, país o plan" aria-label="Buscar establecimiento" /></div>
        {!shown.length ? <Empty icon={<MdStorefront />}>No hay establecimientos.</Empty> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Establecimiento</th><th>País</th><th>Plan</th><th>Estado</th><th>Empleados</th><th>Mesas</th><th>Sucursales</th><th className="right">Valor mensual</th><th>Renueva</th><th /></tr></thead>
            <tbody>{shown.map((o) => (
              <tr key={o.id}>
                <td className="org-cell"><strong>{o.name}</strong><br /><small>{[o.city, o.contactName].filter(Boolean).join(' · ') || `Desde ${formatDate(o.startDate || o.createdAt)}`}</small></td>
                <td><CountryLabel c={o.country} /></td>
                <td>{o.planName || <span className="muted">Sin plan</span>}<br /><small>{o.billingCycle === 'anual' ? 'Anual' : 'Mensual'}</small></td>
                <td><Badge tone={STATUS[o.status][1]}>{STATUS[o.status][0]}</Badge></td>
                <td><UsageBar used={o.usage.employees} max={o.limits?.employees} /></td>
                <td><UsageBar used={o.usage.tables} max={o.limits?.tables} /></td>
                <td><UsageBar used={o.usage.sites} max={o.limits?.sites} /></td>
                <td className="right num">{o.monthly === null ? '—' : moneyIn(o.monthly, o.currency, o.country?.locale)}</td>
                <td>{formatDate(o.renewalDate)}</td>
                <td className="nowrap"><button type="button" className="btn btn-ghost btn-icon" title="Documentos legales" aria-label={`Documentos legales de ${o.name}`} onClick={() => setLegal(o)}><MdGavel /></button><button type="button" className="btn btn-ghost btn-icon" title="Editar" aria-label={`Editar ${o.name}`} onClick={() => setModal(o)}><MdEdit /></button></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
      {legal && <OrgLegalModal org={legal} onClose={() => setLegal(null)} />}
      {modal && <OrgForm initial={modal.id ? modal : null} cat={cat} plans={plans} onClose={() => setModal(null)} onSaved={(d, e) => { setModal(null); load(); toast(e ? 'Establecimiento actualizado' : `Establecimiento ${d.name} creado. Su administrador entra con el usuario ${d.admin?.username} y su documento.`) }} />}
      {toastNode}
    </div>
  )
}

// ======================= Solicitudes =======================
const RequestModal = ({ r, onClose, onSaved }) => {
  const [response, setResponse] = useState(r.response || '')
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')
  const act = async (status) => {
    setSaving(status); setError('')
    try { const { data } = await papi.put(`/plataforma/solicitudes/${r.id}`, { status, response }); onSaved(data) } catch (e) { setError(errorMessage(e)); setSaving('') }
  }
  return (
    <Modal title={`Solicitud de ${r.orgName}`} onClose={onClose}
      footer={<>
        <button type="button" className="btn" disabled={!!saving} onClick={() => act('rechazada')}><MdClose /> Rechazar</button>
        <button type="button" className="btn" disabled={!!saving} onClick={() => act('contactado')}><MdPhone /> Marcar contactado</button>
        <button type="button" className="btn btn-primary" disabled={!!saving} onClick={() => act('aplicada')}>{saving === 'aplicada' && <Spinner />}<MdCheck /> Aplicar plan</button>
      </>}>
      <div className="stack">
        <div className="stat-list">
          <div><small>Plan actual</small><strong>{r.fromPlan || 'Sin plan'}</strong></div>
          <div><small>Plan pedido</small><strong>{r.toPlan} · {r.billingCycle}</strong></div>
          <div><small>Teléfono</small><strong>{r.contactPhone || '—'}</strong></div>
          <div><small>Fecha</small><strong>{formatDateTime(r.createdAt)}</strong></div>
        </div>
        {r.message && <div className="alert">{r.message}</div>}
        <small className="hint">Aplicar cambia el plan y el ciclo del establecimiento de inmediato y lo deja activo.</small>
        <Field label="Respuesta (la ve el establecimiento en Mi plan)" htmlFor="rr"><textarea id="rr" rows={3} value={response} onChange={(e) => setResponse(e.target.value)} /></Field>
        {error && <div className="alert bad">{error}</div>}
      </div>
    </Modal>
  )
}

export const RequestsPage = () => {
  const [rows, setRows] = useState(null)
  const [status, setStatus] = useState('pendiente')
  const [open, setOpen] = useState(null)
  const [toast, toastNode] = useToast()
  const load = useCallback(() => papi.get('/plataforma/solicitudes', { params: { estado: status || undefined } }).then(({ data }) => setRows(data)).catch(() => setRows([])), [status])
  useEffect(() => { load() }, [load])
  return (
    <div className="stack">
      <PageHead title="Solicitudes de cambio de plan" subtitle="Las envía el administrador de cada establecimiento desde Mi plan." />
      <div className="chips">
        {[['pendiente', 'Pendientes'], ['contactado', 'Contactados'], ['aplicada', 'Aplicadas'], ['rechazada', 'Rechazadas'], ['', 'Todas']].map(([k, l]) => (
          <button key={k} type="button" className={`pchip${status === k ? ' on' : ''}`} onClick={() => setStatus(k)}>{l}</button>
        ))}
      </div>
      <Card flush>
        {!rows ? <Loading /> : !rows.length ? <Empty icon={<MdInbox />}>No hay solicitudes.</Empty> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Fecha</th><th>Establecimiento</th><th>Cambio</th><th>Mensaje</th><th>Estado</th><th /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <td className="nowrap">{formatDateTime(r.createdAt)}</td>
                <td><span className="country-label"><Flag code={r.countryCode} size={14} /><strong>{r.orgName}</strong></span></td>
                <td>{r.fromPlan || 'Sin plan'} → <strong>{r.toPlan}</strong> <small>({r.billingCycle})</small></td>
                <td><small>{r.message || '—'}</small></td>
                <td><Badge tone={REQ[r.status][1]}>{REQ[r.status][0]}</Badge></td>
                <td><button type="button" className="btn btn-sm" onClick={() => setOpen(r)}>Atender</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
      {open && <RequestModal r={open} onClose={() => setOpen(null)} onSaved={(d) => { setOpen(null); load(); toast(d.status === 'aplicada' ? `Plan ${d.toPlan} aplicado a ${d.orgName}` : 'Solicitud actualizada') }} />}
      {toastNode}
    </div>
  )
}

// ======================= Países =======================
export const CountriesPage = () => {
  const [cat, load] = useCatalog()
  const [edit, setEdit] = useState(null)
  const [toast, toastNode] = useToast()
  if (!cat) return <Loading />
  const save = async (code, body, msg) => {
    try { await papi.put(`/plataforma/paises/${code}`, body); await load(); setEdit(null); toast(msg) } catch (e) { toast(errorMessage(e), 'bad') }
  }
  return (
    <div className="stack">
      <PageHead title="Países y monedas" subtitle="Dónde se ofrece TillDash+. Cada país tiene su moneda: los precios de los planes y los valores de la app se muestran en ella." />
      <Card flush>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>País</th><th>Moneda</th><th>Formato</th><th>Zona horaria</th><th>Indicativo</th><th>Estado</th><th /></tr></thead>
          <tbody>{cat.countries.map((c) => (
            <tr key={c.code}>
              <td><span className="country-label"><Flag code={c.code} size={16} /><strong>{c.name}</strong></span></td>
              <td><b className="cur">{c.currency}</b> <small>{c.currencyName}</small></td>
              <td className="num">{moneyIn(c.currency === 'COP' || c.currency === 'PYG' || c.currency === 'CLP' || c.currency === 'ARS' ? 150000 : 1500.5, c.currency, c.locale)}</td>
              <td><small>{c.timezone}</small></td>
              <td>{c.phonePrefix}</td>
              <td>
                <label className="check"><input type="checkbox" checked={c.active} onChange={(e) => save(c.code, { active: e.target.checked }, `${c.name} ${e.target.checked ? 'activado' : 'desactivado'}`)} /><span>{c.active ? 'Se ofrece' : 'Inactivo'}</span></label>
              </td>
              <td><button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...c })}><MdEdit /> Moneda</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      </Card>
      {edit && (
        <Modal title={`Moneda de ${edit.name}`} onClose={() => setEdit(null)}
          footer={<><button type="button" className="btn" onClick={() => setEdit(null)}>Cancelar</button><button type="button" className="btn btn-primary" onClick={() => save(edit.code, { currency: edit.currency.toUpperCase(), currencyName: edit.currencyName }, 'Moneda actualizada')}>Guardar</button></>}>
          <div className="stack">
            <div className="form-grid">
              <Field label="Código ISO" htmlFor="cc" hint="3 letras: COP, USD, VES…"><input id="cc" data-only="letters" maxLength={3} value={edit.currency} onChange={(e) => setEdit({ ...edit, currency: e.target.value.toUpperCase() })} /></Field>
              <Field label="Nombre" htmlFor="cn"><input id="cn" value={edit.currencyName} onChange={(e) => setEdit({ ...edit, currencyName: e.target.value })} /></Field>
            </div>
            <div className="alert warn">Los precios de los planes en {edit.name} quedan en la nueva moneda con el mismo número: revísalos en Planes.</div>
          </div>
        </Modal>
      )}
      {toastNode}
    </div>
  )
}

// ======================= Funcionalidades =======================
export const FeaturesPage = () => {
  const [cat, load] = useCatalog()
  const [edit, setEdit] = useState(null)
  const [toast, toastNode] = useToast()
  if (!cat) return <Loading />
  const save = async () => {
    try { await papi.put(`/plataforma/funcionalidades/${edit.key}`, edit); await load(); setEdit(null); toast('Funcionalidad actualizada') } catch (e) { toast(errorMessage(e), 'bad') }
  }
  return (
    <div className="stack">
      <PageHead title="Funcionalidades" subtitle="Módulos que un plan puede incluir. Cada uno habilita sus pantallas y su parte de la API; las marcadas como núcleo van en todos los planes." />
      {Object.entries(GROUPS).map(([g, label]) => {
        const items = cat.features.filter((x) => x.group === g)
        if (!items.length) return null
        return (
          <Card key={g} title={label} flush>
            <div className="table-wrap"><table className="table">
              <tbody>{items.map((x) => (
                <tr key={x.key}>
                  <td style={{ width: '32%' }}><strong>{x.label}</strong>{x.core && <> <Badge tone="brand">Núcleo</Badge></>}<br /><small className="muted">{x.key}</small></td>
                  <td><small>{x.description}</small></td>
                  <td className="right"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...x })}><MdEdit /> Editar</button></td>
                </tr>
              ))}</tbody>
            </table></div>
          </Card>
        )
      })}
      {edit && (
        <Modal title="Editar funcionalidad" onClose={() => setEdit(null)}
          footer={<><button type="button" className="btn" onClick={() => setEdit(null)}>Cancelar</button><button type="button" className="btn btn-primary" onClick={save}>Guardar</button></>}>
          <div className="stack">
            <Field label="Nombre (se ve en los sitios y en Mi plan)" htmlFor="fl"><input id="fl" value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} /></Field>
            <Field label="Descripción" htmlFor="fd"><textarea id="fd" rows={3} value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
      {toastNode}
    </div>
  )
}
