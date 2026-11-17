import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MdSave, MdGavel, MdDescription, MdCheckCircle, MdHourglassTop, MdPrint, MdArrowBack } from 'react-icons/md'
import papi from './api'
import { errorMessage } from '../api/client'
import { Badge, Card, Field, Modal, PageHead, Spinner, useToast } from '../components/ui'
import LegalDoc from '../components/legal/LegalDoc'

const FIELDS = [
  ['legal_name', 'Razón social o nombre del proveedor'], ['nit', 'NIT o cédula'], ['legal_rep', 'Representante legal'], ['legal_rep_id', 'Cédula del representante'],
  ['city', 'Ciudad (domicilio)'], ['address', 'Dirección'], ['email', 'Correo de soporte'], ['phone', 'Teléfono'], ['privacy_email', 'Correo para datos personales']
]
const Loading = () => <div className="splash"><Spinner /></div>

// Datos del proveedor que aparecen en el contrato y en el acuerdo de datos.
export const ProviderPage = () => {
  const [f, setF] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, toastNode] = useToast()
  useEffect(() => { papi.get('/plataforma/proveedor').then(({ data }) => setF(data)).catch((e) => toast(errorMessage(e), 'bad')) }, [toast])
  if (!f) return <Loading />
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = async () => {
    setBusy(true)
    try { const { data } = await papi.put('/plataforma/proveedor', f); setF(data); toast('Datos del proveedor guardados') } catch (e) { toast(errorMessage(e), 'bad') } finally { setBusy(false) }
  }
  return (
    <div className="stack">
      <PageHead title="Proveedor y documentos legales" subtitle="Estos datos se insertan en el contrato de servicio y en el acuerdo de datos de cada establecimiento.">
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>{busy ? <Spinner /> : <MdSave />} Guardar</button>
      </PageHead>
      <Card title="Datos del proveedor" icon={<MdGavel />}>
        <div className="form-grid">
          {FIELDS.map(([k, l]) => <Field key={k} label={l} htmlFor={`pv-${k}`}><input id={`pv-${k}`} value={f[k] || ''} onChange={set(k)} /></Field>)}
          <div className="span-2"><Field label="Horario de soporte" htmlFor="pv-sh"><input id="pv-sh" value={f.support_hours || ''} onChange={set('support_hours')} /></Field></div>
          <div className="span-2"><Field label="Infraestructura en la nube (subencargados)" htmlFor="pv-host" hint="Aparece en el acuerdo de datos como transmisión internacional."><textarea id="pv-host" rows={2} value={f.hosting || ''} onChange={set('hosting')} /></Field></div>
        </div>
      </Card>
      <Card title="Cómo funciona" icon={<MdDescription />}>
        <ul className="legal-how">
          <li><b>Contrato de servicio (TD-LEG-001):</b> se arma con el plan, sus límites, el valor en la moneda del país, el ciclo de pago, las fechas, el soporte y la disponibilidad de cada establecimiento.</li>
          <li><b>Acuerdo de datos (TD-LEG-002):</b> el establecimiento es responsable y TillDash+ es encargado del tratamiento de los datos de empleados, clientes y socios (Ley 1581 de 2012 y Decreto 1074 de 2015).</li>
          <li><b>Activación:</b> al entrar, el super administrador del establecimiento firma ambos documentos con su firma digital; hasta entonces el sistema queda bloqueado para todo su personal.</li>
          <li><b>Términos y condiciones (TD-LEG-003):</b> cada usuario los acepta la primera vez que entra.</li>
          <li>Tú contrafirmas cada documento desde <i>Establecimientos</i>, con el botón de documentos legales de cada fila. Todo queda en PDF con el formato de TillDash+.</li>
        </ul>
        <small className="hint">Los textos son una plantilla basada en la normativa colombiana. Se recomienda que un abogado los revise antes de usarlos comercialmente.</small>
      </Card>
      {toastNode}
    </div>
  )
}

// Estado de los documentos de un establecimiento (desde Establecimientos).
export const OrgLegalModal = ({ org, onClose }) => {
  const navigate = useNavigate()
  const [docs, setDocs] = useState(null)
  const [busy, setBusy] = useState('')
  const [toast, toastNode] = useToast()
  const load = useCallback(() => papi.get(`/plataforma/organizaciones/${org.id}/legal`).then(({ data }) => setDocs(data)).catch((e) => { toast(errorMessage(e), 'bad'); setDocs([]) }), [org.id, toast])
  useEffect(() => { load() }, [load])
  const sign = async (kind) => {
    setBusy(kind)
    try { await papi.post(`/plataforma/organizaciones/${org.id}/legal/${kind}/firmar`); toast('Firmado por el proveedor'); load() } catch (e) { toast(errorMessage(e), 'bad') } finally { setBusy('') }
  }
  return (
    <Modal title={`Documentos legales · ${org.name}`} onClose={onClose} footer={<button type="button" className="btn" onClick={onClose}>Cerrar</button>}>
      {!docs ? <Loading /> : (
        <div className="legal-list">
          {docs.map((d) => {
            const c = d.signatures.find((s) => s.party === 'cliente')
            const p = d.signatures.find((s) => s.party === 'proveedor')
            return (
              <div key={d.kind} className="legal-row">
                <div className="grow">
                  <strong>{d.title}</strong><small>{d.code} · versión {d.version}</small>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    <Badge tone={c ? 'brand' : 'warn'}>{c ? <MdCheckCircle /> : <MdHourglassTop />} Establecimiento: {c ? c.signerName : 'pendiente'}</Badge>
                    <Badge tone={p ? 'brand' : 'warn'}>{p ? <MdCheckCircle /> : <MdHourglassTop />} Proveedor: {p ? 'firmado' : 'pendiente'}</Badge>
                  </div>
                </div>
                <button type="button" className="btn btn-sm" onClick={() => navigate(`/plataforma/legal/${org.id}/${d.kind}`)}><MdDescription /> Ver / PDF</button>
                {!p && <button type="button" className="btn btn-primary btn-sm" disabled={busy === d.kind} onClick={() => sign(d.kind)}>{busy === d.kind ? <Spinner /> : <MdGavel />} Firmar como proveedor</button>}
              </div>
            )
          })}
          <div className="alert"><span>La firma del proveedor usa la firma digital de tu usuario de TillDash+ (Mi perfil) y los datos de <i>Proveedor y legales</i>.</span></div>
        </div>
      )}
      {toastNode}
    </Modal>
  )
}

// Documento de un establecimiento con el formato de TillDash+ (imprimible).
export const OrgLegalDoc = () => {
  const { orgId, kind } = useParams()
  const navigate = useNavigate()
  const [doc, setDoc] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { papi.get(`/plataforma/organizaciones/${orgId}/legal/${kind}`).then(({ data }) => setDoc(data)).catch((e) => setErr(errorMessage(e))) }, [orgId, kind])
  useEffect(() => {
    if (!doc) return undefined
    const t = document.title
    document.title = `${doc.code}_${doc.organization?.name || ''}`
    return () => { document.title = t }
  }, [doc])
  if (err) return <div className="alert bad">{err}</div>
  if (!doc) return <Loading />
  return <LegalDoc doc={doc} toolbar={<><button type="button" onClick={() => navigate('/plataforma/establecimientos')}><MdArrowBack /> Establecimientos</button><button type="button" className="primary" onClick={() => window.print()}><MdPrint /> Imprimir / Guardar PDF</button></>} />
}
