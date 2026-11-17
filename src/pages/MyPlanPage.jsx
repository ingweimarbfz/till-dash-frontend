import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MdCheckCircle, MdRemoveCircleOutline, MdWorkspacePremium, MdStar, MdSend, MdEventRepeat, MdHourglassTop, MdGavel, MdDescription } from 'react-icons/md'
import api, { errorMessage } from '../api/client'
import { Badge, Card, Empty, Field, Modal, PageHead, Spinner, useToast } from '../components/ui'
import { formatDate, formatDateTime } from '../utils/format'
import { Flag, limitText, moneyIn } from '../utils/countries'
import { usePlan } from '../context/PlanContext'

// Contrato y acuerdo de datos firmados, y los términos que acepta cada usuario.
const LegalCard = () => {
  const [st, setSt] = useState(null)
  useEffect(() => { api.get('/legal/estado').then(({ data }) => setSt(data)).catch(() => setSt(false)) }, [])
  if (!st) return null
  return (
    <Card title="Documentos legales" icon={<MdGavel />} subtitle="Firmados electrónicamente (Ley 527 de 1999). Ábrelos para imprimirlos o guardarlos en PDF.">
      <div className="legal-list">
        {st.documents.map((d) => {
          const c = d.signatures.find((x) => x.party === 'cliente')
          const p = d.signatures.find((x) => x.party === 'proveedor')
          return (
            <div key={d.kind} className="legal-row">
              <MdDescription />
              <div className="grow"><strong>{d.title}</strong><small>{d.code} · versión {d.version}{c ? ` · firmado por ${c.signerName} el ${formatDate(c.signedAt)}` : ''}</small></div>
              <Badge tone={p ? 'brand' : 'warn'}>{p ? 'Firmado por ambas partes' : 'Falta la firma de TillDash+'}</Badge>
              <Link className="btn btn-sm" to={`/legal/${d.kind}`}>Ver / PDF</Link>
            </div>
          )
        })}
        <div className="legal-row">
          <MdDescription />
          <div className="grow"><strong>Términos y condiciones de uso</strong><small>TD-LEG-003 · los acepta cada usuario al entrar por primera vez</small></div>
          <Link className="btn btn-sm" to="/legal/terminos">Ver</Link>
        </div>
      </div>
    </Card>
  )
}

const LIMITS = [
  ['sites', 'Sucursales'], ['admins', 'Administradores'], ['employees', 'Empleados'],
  ['tables', 'Mesas'], ['products', 'Productos']
]
const GROUPS = { operacion: 'Operación', catalogo: 'Catálogo', clientes: 'Clientes', control: 'Control', marca: 'Marca' }
const STATUS = { activa: ['Activo', 'brand'], prueba: ['En prueba', 'warn'], suspendida: ['Suspendido', 'bad'], cancelada: ['Cancelado', 'muted'] }
const REQ = { pendiente: ['Pendiente', 'warn'], contactado: ['TillDash+ te contactó', 'dark'], aplicada: ['Aplicada', 'brand'], rechazada: ['No aplicada', 'muted'] }

const Meter = ({ label, used, max }) => {
  const unlimited = max === null || max === undefined
  const pct = unlimited || max === 0 ? 0 : Math.min(100, Math.round((used / max) * 100))
  // En el límite: ámbar (ya no puede crear más). Por encima (p. ej. tras bajar de plan): rojo.
  const tone = unlimited || max === 0 ? (max === 0 ? 'none' : '') : used > max ? 'full' : pct >= 80 ? 'near' : ''
  return (
    <div className={`plan-meter ${tone}`}>
      <div className="row-between"><small>{label}</small><strong>{used}<span> / {max === 0 ? 'no incluido' : limitText(max)}</span></strong></div>
      <div className="plan-meter-track"><i style={{ width: unlimited ? '0%' : `${pct}%` }} /></div>
    </div>
  )
}

// Cambiar de plan: el administrador elige y TillDash+ aplica el cambio.
const ChangeModal = ({ current, onClose, onSent }) => {
  const [opts, setOpts] = useState(null)
  const [f, setF] = useState({ planId: '', billingCycle: 'mensual', message: '', phone: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { api.get('/plan/opciones').then(({ data }) => { setOpts(data); setF((x) => ({ ...x, planId: data.plans.find((p) => p.id !== data.currentPlanId)?.id || '' })) }).catch((e) => setError(errorMessage(e))) }, [])
  const send = async () => {
    setSaving(true); setError('')
    try { await api.post('/plan/solicitud', f); onSent() } catch (e) { setError(errorMessage(e)); setSaving(false) }
  }
  const c = opts?.country
  return (
    <Modal title="Cambiar de plan" size="lg" onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-primary" disabled={saving || !f.planId} onClick={send}>{saving && <Spinner />}<MdSend /> Enviar solicitud</button></>}>
      {!opts ? <Spinner /> : (
        <div className="stack">
          <div className="row-between">
            <small className="hint">Precios para <Flag code={c.code} size={12} /> {c.name} en {c.currency}.</small>
            <div className="seg">
              <button type="button" className={`btn btn-sm${f.billingCycle === 'mensual' ? ' on' : ''}`} onClick={() => setF({ ...f, billingCycle: 'mensual' })}>Mensual</button>
              <button type="button" className={`btn btn-sm${f.billingCycle === 'anual' ? ' on' : ''}`} onClick={() => setF({ ...f, billingCycle: 'anual' })}>Anual</button>
            </div>
          </div>
          <div className="plan-pick">
            {opts.plans.map((p) => (
              <button key={p.id} type="button" className={`plan-pick-card${Number(f.planId) === p.id ? ' on' : ''}${p.id === opts.currentPlanId ? ' cur' : ''}`} onClick={() => setF({ ...f, planId: p.id })} disabled={p.id === opts.currentPlanId && f.billingCycle === current?.billingCycle}>
                <div className="row-between"><strong>{p.name}</strong>{p.id === opts.currentPlanId ? <Badge>Actual</Badge> : p.badge && <Badge tone="brand"><MdStar /> {p.badge}</Badge>}</div>
                <b className="price">{moneyIn(f.billingCycle === 'anual' ? p.priceYear : p.priceMonth, p.currency, c.locale)}<small>{f.billingCycle === 'anual' ? ' / año' : ' / mes'}</small></b>
                <small>{limitText(p.limits.employees)} empleados · {limitText(p.limits.tables)} mesas · {limitText(p.limits.sites)} sucursales</small>
              </button>
            ))}
          </div>
          <div className="form-grid">
            <Field label="Teléfono de contacto" htmlFor="cp" hint="Si lo dejas vacío usamos el de tu usuario"><input id="cp" inputMode="numeric" minLength={7} maxLength={10} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="Mensaje" htmlFor="cm"><input id="cm" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="Ej. abrimos una sucursal nueva" /></Field>
          </div>
          {error && <div className="alert bad">{error}</div>}
        </div>
      )}
    </Modal>
  )
}

const MyPlanPage = () => {
  const [d, setD] = useState(null)
  const [changing, setChanging] = useState(false)
  const [toast, toastNode] = useToast()
  const { refresh } = usePlan()
  const load = useCallback(() => api.get('/plan/actual').then(({ data }) => setD(data)).catch((e) => { toast(errorMessage(e), 'bad'); setD(false) }), [toast])
  useEffect(() => { load() }, [load])
  if (d === null) return <div className="splash"><Spinner /></div>
  if (!d) return <Card><Empty>No se pudo cargar tu plan.</Empty></Card>
  const c = d.country
  const st = STATUS[d.org?.status] || STATUS.activa
  const open = d.lastRequest && ['pendiente', 'contactado'].includes(d.lastRequest.status)
  return (
    <div className="stack">
      <PageHead title="Mi plan" subtitle="Lo que incluye tu plan, cuánto has usado de cada límite y cómo pedir un cambio.">
        <button type="button" className="btn btn-primary" disabled={open} onClick={() => setChanging(true)}><MdWorkspacePremium /> Cambiar de plan</button>
      </PageHead>
      <div className="grid grid-2-1">
        <Card className="plan-hero">
          <div className="row-between">
            <div>
              <small className="muted">Plan actual</small>
              <h2>{d.plan?.name || 'Sin plan (todo habilitado)'}</h2>
              {d.plan?.tagline && <p className="muted" style={{ margin: '4px 0 0' }}>{d.plan.tagline}</p>}
            </div>
            <Badge tone={st[1]}>{st[0]}</Badge>
          </div>
          <div className="plan-hero-facts">
            <div><small>País y moneda</small><strong className="country-label"><Flag code={c?.code} size={16} /> {c?.name} · {c?.currency}</strong></div>
            <div><small>Valor</small><strong>{d.price ? `${moneyIn(d.org?.billingCycle === 'anual' ? d.price.year : d.price.month, d.price.currency, c?.locale)} ${d.org?.billingCycle === 'anual' ? 'al año' : 'al mes'}` : '—'}</strong></div>
            <div><small>{d.org?.status === 'prueba' ? <><MdHourglassTop /> Prueba hasta</> : <><MdEventRepeat /> Renovación</>}</small><strong>{formatDate(d.org?.renewalDate)}</strong></div>
            <div><small>Soporte</small><strong>{d.plan?.support || '—'}</strong></div>
          </div>
        </Card>
        <Card title="Solicitud de cambio">
          {!d.lastRequest ? <Empty>No has pedido cambios de plan.</Empty> : (
            <div className="stack" style={{ gap: 8 }}>
              <div className="row-between"><strong>{d.lastRequest.toPlan} · {d.lastRequest.billingCycle}</strong><Badge tone={REQ[d.lastRequest.status][1]}>{REQ[d.lastRequest.status][0]}</Badge></div>
              <small>Enviada {formatDateTime(d.lastRequest.createdAt)}</small>
              {d.lastRequest.response && <div className="alert">{d.lastRequest.response}</div>}
              {open && <small className="hint">TillDash+ te contactará para confirmar el cambio.</small>}
            </div>
          )}
        </Card>
      </div>
      <Card title="Uso de tu plan" subtitle="Al llegar al límite no podrás crear más hasta cambiar de plan o desactivar alguno.">
        <div className="plan-meters">
          {LIMITS.map(([k, l]) => <Meter key={k} label={l} used={d.usage[k]} max={d.limits ? d.limits[k] : null} />)}
        </div>
      </Card>
      <Card title="Módulos">
        <div className="plan-features">
          {Object.entries(GROUPS).map(([g, label]) => {
            const items = d.features.filter((f) => f.group === g)
            if (!items.length) return null
            return (
              <div key={g}>
                <small className="muted">{label}</small>
                {items.map((f) => (
                  <div key={f.key} className={`plan-feature${f.included ? '' : ' off'}`} title={f.description}>
                    {f.included ? <MdCheckCircle /> : <MdRemoveCircleOutline />}<span>{f.label}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </Card>
      <LegalCard />
      {changing && <ChangeModal current={d.org} onClose={() => setChanging(false)} onSent={() => { setChanging(false); load(); refresh(); toast('Solicitud enviada. TillDash+ te contactará pronto.') }} />}
      {toastNode}
    </div>
  )
}

export default MyPlanPage
