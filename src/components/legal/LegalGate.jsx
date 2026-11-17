import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MdGavel, MdVerified, MdDescription, MdPrint, MdArrowBack, MdLogout, MdHourglassTop, MdDraw, MdCheckCircle } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Spinner } from '../ui'
import { BrandSymbol } from '../Logo'
import SignaturePad from '../SignaturePad'
import LegalDoc from './LegalDoc'
import './legal.css'

const BRAND = 'TillDash+'

// Vista de un documento (para leer, imprimir o guardar en PDF).
const DocViewer = ({ kind, onBack }) => {
  const [doc, setDoc] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { api.get(`/legal/documento/${kind}`).then(({ data }) => setDoc(data)).catch((e) => setErr(errorMessage(e))) }, [kind])
  useEffect(() => {
    if (!doc) return undefined
    const t = document.title
    document.title = `${doc.code}_${doc.title}`
    return () => { document.title = t }
  }, [doc])
  if (err) return <div className="lgate-alert" style={{ margin: 20 }}>{err}</div>
  if (!doc) return <div className="splash"><Spinner /></div>
  return <LegalDoc doc={doc} toolbar={<><button type="button" onClick={onBack}><MdArrowBack /> Volver</button><button type="button" className="primary" onClick={() => window.print()}><MdPrint /> Imprimir / Guardar PDF</button></>} />
}

// Firma del contrato y del acuerdo de datos por el super administrador (representante legal o su delegado).
const Activation = ({ status, reload }) => {
  const { user, logout } = useAuth()
  const [view, setView] = useState(null)
  const [f, setF] = useState({ signerName: user.fullName, signerId: user.identification || '', signerRole: 'Representante legal' })
  const [accept, setAccept] = useState({})
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [signature, setSignature] = useState(undefined) // undefined: cargando · null: no tiene
  const [draft, setDraft] = useState(null)
  useEffect(() => { api.get('/perfil/firma').then(({ data }) => setSignature(data.signatureUrl || null)).catch(() => setSignature(null)) }, [])
  if (view) return <DocViewer kind={view} onBack={() => setView(null)} />
  const saveSig = async () => {
    if (!draft) return setErr('Dibuja tu firma antes de guardarla.')
    setErr(''); setBusy('sig')
    try { await api.put('/perfil', { signatureUrl: draft }); setSignature(draft) } catch (e) { setErr(errorMessage(e)) } finally { setBusy('') }
  }
  const sign = async (kind) => {
    setErr('')
    if (!accept[kind]) return setErr('Marca la casilla de aceptación del documento.')
    setBusy(kind)
    try { await api.post(`/legal/firmar/${kind}`, { ...f, accept: true }); await reload() } catch (e) { setErr(errorMessage(e)) } finally { setBusy('') }
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <div className="lgate">
      <div className="lgate-card">
        <div className="lgate-head">
          <BrandSymbol size={46} />
          <div>
            <h1>Activación del servicio</h1>
            <p>{status.organization?.name}{status.organization?.planName ? ` · Plan ${status.organization.planName}` : ''}. Antes de usar {BRAND}, el representante legal (o su delegado) debe leer y firmar estos documentos.</p>
          </div>
        </div>
        <div className="lgate-body">
          <div className="lgate-info">El contrato se genera con los datos de tu plan (funcionalidades, límites, valor, soporte y disponibilidad). El acuerdo de datos cumple la Ley 1581 de 2012, porque el sistema guarda datos de tus empleados, clientes y socios. Ambos se firman electrónicamente (Ley 527 de 1999) y quedan disponibles en PDF.</div>
          <div>
            <b style={{ fontSize: 13 }}>Datos de quien firma</b>
            <div className="lgate-form">
              <div><label htmlFor="lg-name">Nombre completo</label><input id="lg-name" value={f.signerName} onChange={set('signerName')} /></div>
              <div><label htmlFor="lg-id">Cédula</label><input id="lg-id" value={f.signerId} onChange={set('signerId')} /></div>
              <div><label htmlFor="lg-role">Cargo</label><input id="lg-role" value={f.signerRole} onChange={set('signerRole')} placeholder="Representante legal" /></div>
            </div>
          </div>
          {signature === null && (
            <div className="lgate-sign">
              <b><MdDraw /> Crea tu firma digital para poder firmar</b>
              <SignaturePad value={null} onChange={setDraft} height={150} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" className="lgate-btn primary" disabled={busy === 'sig'} onClick={saveSig}>{busy === 'sig' ? <Spinner /> : <MdCheckCircle />} Guardar firma</button>
              </div>
              <small style={{ color: 'var(--lm)' }}>Queda guardada en Mi perfil y se usa en todos los documentos que firmes.</small>
            </div>
          )}
          {status.documents.map((d) => {
            const signed = d.signatures.find((s) => s.party === 'cliente')
            return (
              <div key={d.kind} className={`lgate-doc${signed ? ' ok' : ''}`}>
                {signed ? <MdCheckCircle /> : <MdDescription />}
                <div className="grow">
                  <b>{d.title}</b>
                  <small>{d.code} · versión {d.version}{signed ? ` · firmado por ${signed.signerName}` : ''}</small>
                  {!signed && <label className="lgate-check" style={{ marginTop: 8 }}><input type="checkbox" checked={Boolean(accept[d.kind])} onChange={(e) => setAccept({ ...accept, [d.kind]: e.target.checked })} /> Leí el documento completo y lo acepto en nombre del establecimiento.</label>}
                </div>
                <button type="button" className="lgate-btn" onClick={() => setView(d.kind)}><MdDescription /> Leer / PDF</button>
                {!signed && <button type="button" className="lgate-btn primary" disabled={!signature || busy === d.kind} onClick={() => sign(d.kind)}>{busy === d.kind ? <Spinner /> : <MdGavel />} Firmar</button>}
              </div>
            )
          })}
          {err && <div className="lgate-alert" role="alert">{err}</div>}
          <div className="lgate-foot">
            <small>Al firmar quedan registrados el texto, la fecha y hora, tu usuario y la dirección IP.</small>
            <button type="button" className="lgate-btn" onClick={logout}><MdLogout /> Cerrar sesión</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const Waiting = ({ status }) => {
  const { logout } = useAuth()
  return (
    <div className="lgate">
      <div className="lgate-card">
        <div className="lgate-head"><MdHourglassTop style={{ fontSize: 36, color: 'var(--lb)' }} /><div><h1>Servicio pendiente de activación</h1><p>{status.organization?.name}</p></div></div>
        <div className="lgate-body">
          <p style={{ margin: 0 }}>Para empezar a usar {BRAND}, el super administrador del establecimiento debe firmar el contrato de servicio y el acuerdo de tratamiento de datos personales. Vuelve a entrar cuando te confirme que el servicio está activo.</p>
          <div><button type="button" className="lgate-btn" onClick={logout}><MdLogout /> Cerrar sesión</button></div>
        </div>
      </div>
    </div>
  )
}

// Términos y condiciones: cada usuario los acepta la primera vez (y cuando cambia la versión).
const TermsModal = ({ onAccepted }) => {
  const { logout } = useAuth()
  const [doc, setDoc] = useState(null)
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { api.get('/legal/documento/terminos').then(({ data }) => setDoc(data)).catch((e) => setErr(errorMessage(e))) }, [])
  const accept = async () => {
    setBusy(true)
    try { await api.post('/legal/terminos/aceptar', { accept: true }); onAccepted() } catch (e) { setErr(errorMessage(e)); setBusy(false) }
  }
  return (
    <div className="lterms-bg">
      <div className="lterms" role="dialog" aria-modal="true" aria-label="Términos y condiciones">
        <div className="lterms-scroll">{doc ? <LegalDoc doc={doc} /> : <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>}</div>
        <div className="lterms-foot">
          <label className="lgate-check"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> Leí y acepto los términos y condiciones de uso de {BRAND}.</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="lgate-btn" onClick={logout}>Salir</button>
            <button type="button" className="lgate-btn primary" disabled={!ok || busy} onClick={accept}>{busy ? <Spinner /> : <MdVerified />} Aceptar y continuar</button>
          </div>
          {err && <div className="lgate-alert" style={{ width: '100%' }}>{err}</div>}
        </div>
      </div>
    </div>
  )
}

// Envuelve el sistema: exige la activación (contrato y acuerdo de datos firmados) y la aceptación de los términos.
// Los clientes que entran por el QR de la mesa no pasan por aquí.
const LegalGate = ({ children }) => {
  const { user } = useAuth()
  const [status, setStatus] = useState(null)
  const skip = !user || user.role === 'cliente'
  const load = useCallback(() => api.get('/legal/estado').then(({ data }) => setStatus(data))
    .catch(() => setStatus({ activationPending: false, documents: [], terms: { acceptedAt: 'n/a' } })), [])
  useEffect(() => { if (!skip) load() }, [load, skip, user?.id])
  if (skip) return children
  if (!status) return <div className="splash"><Spinner /></div>
  if (status.activationPending) return user.role === 'superadmin' ? <Activation status={status} reload={load} /> : <Waiting status={status} />
  return (
    <>
      {children}
      {!status.terms.acceptedAt && <TermsModal onAccepted={load} />}
    </>
  )
}

// Página /legal/:kind dentro del sistema (consulta e impresión de los documentos firmados).
export const LegalPage = () => {
  const { kind } = useParams()
  const navigate = useNavigate()
  return <DocViewer key={kind} kind={kind} onBack={() => navigate(-1)} />
}

export default LegalGate
