import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MdCheck, MdClose, MdPhotoCamera, MdUndo, MdEdit, MdImage } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { Badge, Card, Empty, Field, Spinner, useToast } from '../../components/ui'
import { Tabs } from '../../components/forms'
import { formatDateTime, formatMoney } from '../../utils/format'
import { fileToDataUrl } from '../../utils/image'

// =====================================================================
// Verificación de transferencias (TD-017)
// Nequi, Daviplata y transferencias no entran al efectivo de la caja: se revisa la cuenta o el celular
// y se marca cada una como "Llegó" o "No llegó", con foto del comprobante si se quiere.
// Lo que no se revisa queda "Por verificar".
// =====================================================================
const TONE = { pendiente: 'warn', verificada: 'tr-ok', no_llego: 'bad' }
const ICON = { nequi: '💜', daviplata: '❤️', transferencia: '🏦' }

export const transferSummaryText = (t) => {
  if (!t?.count) return null
  if (t.verificada.count === t.count) return `${t.count} verificada${t.count === 1 ? '' : 's'}`
  return [t.pendiente.count ? `${t.pendiente.count} por verificar` : null, t.no_llego.count ? `${t.no_llego.count} no llegó` : null, t.verificada.count ? `${t.verificada.count} verificada${t.verificada.count === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ')
}

// Totales: verificado, por verificar y no llegó.
export const TransferTotals = ({ totals }) => (
  <div className="tr-totals">
    <div className="ok"><small>Llegó</small><strong>{formatMoney(totals.verificada.amount)}</strong><small>{totals.verificada.count} de {totals.count}</small></div>
    <div className={totals.pendiente.count ? 'warn' : ''}><small>Por verificar</small><strong>{formatMoney(totals.pendiente.amount)}</strong><small>{totals.pendiente.count}</small></div>
    <div className={totals.no_llego.count ? 'bad' : ''}><small>No llegó</small><strong>{formatMoney(totals.no_llego.amount)}</strong><small>{totals.no_llego.count}</small></div>
  </div>
)

const TransferRow = ({ t, canEdit, showSession, onSaved, toast }) => {
  const [edit, setEdit] = useState(null) // { status, account, note, proof? }
  const [proof, setProof] = useState(null) // comprobante ya guardado, para verlo
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const file = useRef(null)
  const save = async (body) => {
    setSaving(true); setError('')
    try {
      const { data } = await api.put(`/caja/transferencias/${t.id}`, body)
      setEdit(null); setProof(null); onSaved(data)
    } catch (err) { setError(errorMessage(err)) } finally { setSaving(false) }
  }
  const open = (status) => setEdit({ status, account: t.account || '', note: t.checkNote || '' })
  const pickPhoto = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const data = await fileToDataUrl(f, { max: 1400, quality: 0.8 })
      setEdit((x) => ({ ...(x || { status: 'verificada', account: t.account || '', note: t.checkNote || '' }), proof: data }))
    } catch (err) { toast(err.message, 'bad') }
  }
  const viewProof = async () => {
    if (proof) return setProof(null)
    try { const { data } = await api.get(`/caja/transferencias/${t.id}/comprobante`); setProof(data.proof) } catch (err) { toast(errorMessage(err), 'bad') }
  }
  const what = t.orderId ? <Link to={`/pedidos/${t.orderId}`}>{t.ref}</Link> : <>{t.type === 'abono' ? 'Abono' : ''} {t.ref}</>
  return (
    <li className={`tr-row ${t.status}`}>
      <div className="tr-main">
        <span className="tr-icon" aria-hidden>{ICON[t.method] || '🏦'}</span>
        <div className="grow">
          <div><strong>{t.methodLabel}</strong> · {what}{t.table && <span className="muted"> · {t.table}</span>}{showSession && t.session && <small className="muted"> · {t.session}{t.register ? ` ${t.register}` : ''}</small>}</div>
          <small className="muted block">
            {formatDateTime(t.createdAt)}{t.payer ? ` · pagó ${t.payer}` : ''}{t.reference ? ` · ref. ${t.reference}` : ''}{t.chargedBy ? ` · cobró ${t.chargedBy}` : ''}
          </small>
          {t.status !== 'pendiente' && (
            <small className="block tr-check">
              {t.status === 'verificada' ? '✔️' : '❌'} {t.statusLabel}{t.account ? ` a ${t.account}` : ''} · {t.checkedBy} {formatDateTime(t.checkedAt)}{t.checkNote ? ` · ${t.checkNote}` : ''}
            </small>
          )}
        </div>
        <div className="tr-side">
          <strong className="money">{formatMoney(t.amount)}</strong>
          <Badge tone={TONE[t.status]}>{t.statusLabel}</Badge>
        </div>
      </div>
      <div className="tr-actions">
        {canEdit && t.status === 'pendiente' && !edit && <>
          <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={() => save({ status: 'verificada' })}>{saving ? <Spinner /> : <MdCheck />} Llegó</button>
          <button type="button" className="btn btn-sm" onClick={() => file.current?.click()}><MdPhotoCamera /> Llegó, con foto</button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => open('no_llego')}><MdClose /> No llegó</button>
        </>}
        {canEdit && t.status !== 'pendiente' && !edit && <>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => open(t.status)}><MdEdit /> Editar</button>
          <button type="button" className="btn btn-sm btn-ghost" disabled={saving} onClick={() => save({ status: 'pendiente' })}><MdUndo /> Deshacer</button>
        </>}
        {t.hasProof && <button type="button" className="btn btn-sm btn-ghost" onClick={viewProof}><MdImage /> {proof ? 'Ocultar comprobante' : 'Ver comprobante'}</button>}
        {canEdit && t.status === 'pendiente' && !edit && <button type="button" className="btn btn-sm btn-ghost" onClick={() => open('verificada')}>Más datos…</button>}
        <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={pickPhoto} />
      </div>
      {proof && <img className="tr-proof" src={proof} alt={`Comprobante de ${t.methodLabel} ${t.ref}`} />}
      {edit && (
        <div className="tr-edit">
          <div className="seg">
            <button type="button" className={`btn btn-sm${edit.status === 'verificada' ? ' on' : ''}`} onClick={() => setEdit({ ...edit, status: 'verificada' })}><MdCheck /> Llegó</button>
            <button type="button" className={`btn btn-sm${edit.status === 'no_llego' ? ' on' : ''}`} onClick={() => setEdit({ ...edit, status: 'no_llego' })}><MdClose /> No llegó</button>
          </div>
          <div className="tr-edit-fields">
            <Field label="Cuenta o celular donde se revisó" htmlFor={`tra-${t.id}`}><input id={`tra-${t.id}`} value={edit.account} onChange={(e) => setEdit({ ...edit, account: e.target.value })} placeholder="Ej. Nequi 300 123 4567, Bancolombia ahorros" /></Field>
            <Field label={edit.status === 'no_llego' ? 'Qué pasó' : 'Nota'} htmlFor={`trn-${t.id}`} required={edit.status === 'no_llego'}><input id={`trn-${t.id}`} value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} placeholder={edit.status === 'no_llego' ? 'Ej. el cliente mostró un pantallazo falso; se le pidió pagar en efectivo' : 'Opcional'} /></Field>
          </div>
          <div className="tr-photo">
            {edit.proof ? <><img src={edit.proof} alt="Comprobante nuevo" /><button type="button" className="btn btn-sm btn-ghost" onClick={() => setEdit({ ...edit, proof: undefined })}>Quitar foto</button></>
              : <button type="button" className="btn btn-sm" onClick={() => file.current?.click()}><MdPhotoCamera /> {t.hasProof ? 'Cambiar foto del comprobante' : 'Foto del comprobante'}</button>}
            {!edit.proof && t.hasProof && <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEdit({ ...edit, proof: null })}>Quitar la foto guardada</button>}
            {edit.proof === null && <small className="muted">Se quitará la foto guardada.</small>}
          </div>
          {error && <div className="alert bad">{error}</div>}
          <div className="tr-actions">
            <button type="button" className="btn btn-sm" onClick={() => { setEdit(null); setError('') }}>Cancelar</button>
            <button type="button" className="btn btn-sm btn-primary" disabled={saving || (edit.status === 'no_llego' && !edit.note.trim())}
              onClick={() => save({ status: edit.status, account: edit.account, note: edit.note, ...(edit.proof !== undefined ? { proof: edit.proof } : {}) })}>{saving ? <Spinner /> : <MdCheck />} Guardar</button>
          </div>
        </div>
      )}
      {!edit && error && <div className="alert bad">{error}</div>}
    </li>
  )
}

export const TransferList = ({ rows, canEdit, showSession, onSaved, toast }) => (
  <ul className="tr-list">
    {rows.map((t) => <TransferRow key={t.id} t={t} canEdit={canEdit(t)} showSession={showSession} onSaved={onSaved} toast={toast} />)}
  </ul>
)

const totalsOf = (rows) => {
  const t = { count: 0, amount: 0, verificada: { count: 0, amount: 0 }, pendiente: { count: 0, amount: 0 }, no_llego: { count: 0, amount: 0 } }
  for (const r of rows) { t.count++; t.amount += r.amount; t[r.status].count++; t[r.status].amount += r.amount }
  return t
}

// Transferencias de un turno: en el cierre y en el detalle del turno.
export const useSessionTransfers = (sessionId) => {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const load = useCallback(() => api.get(`/caja/turnos/${sessionId}/transferencias`).then(({ data }) => { setRows(data.rows); setError('') }).catch((e) => { setRows([]); setError(errorMessage(e)) }), [sessionId])
  useEffect(() => { load() }, [load])
  const update = (t) => t && setRows((rs) => rs.map((r) => (r.id === t.id ? t : r)))
  return { rows, error, totals: rows ? totalsOf(rows) : null, update, reload: load }
}

export const SessionTransfers = ({ data, canEdit, admin, toast }) => {
  if (!data.rows) return <Spinner />
  if (data.error) return <div className="alert bad">No se pudieron cargar las transferencias: {data.error}</div>
  if (!data.rows.length) return <small className="muted">No hubo cobros por Nequi, Daviplata ni transferencia.</small>
  return <>
    <TransferTotals totals={data.totals} />
    <TransferList rows={data.rows} canEdit={(t) => canEdit && (admin || t.sessionOpen || t.status === 'pendiente')} onSaved={data.update} toast={toast} />
  </>
}

export const SessionTransfersCard = ({ sessionId, open, canEdit, admin }) => {
  const data = useSessionTransfers(sessionId)
  const [toast, toastNode] = useToast()
  if (data.rows && !data.rows.length && !data.error) return null
  const t = data.totals
  return (
    <Card title="Transferencias del turno" subtitle={open ? 'Revisa la cuenta o el celular y marca cada una. No entran al efectivo de la caja.' : t?.pendiente.count ? 'Quedaron transferencias sin verificar: revísalas en la cuenta o el celular.' : 'Revisadas en la cuenta o el celular al cerrar.'}>
      <SessionTransfers data={data} canEdit={canEdit} admin={admin} toast={toast} />
      {toastNode}
    </Card>
  )
}

// Pestaña de Caja: transferencias de la sucursal en los últimos días, por estado.
export const TransfersTab = ({ admin, onCount }) => {
  const [estado, setEstado] = useState('pendiente')
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [toast, toastNode] = useToast()
  const load = useCallback(() => api.get('/caja/transferencias', { params: { dias: days } }).then(({ data: d }) => { setData(d); onCount?.(d.totals.pendiente.count) }).catch((e) => { setData({ rows: [], totals: totalsOf([]) }); toast(errorMessage(e), 'bad') }), [days, onCount, toast])
  useEffect(() => { load() }, [load])
  const rows = data ? data.rows.filter((r) => estado === 'todas' || r.status === estado) : []
  const saved = (t) => { if (!t) return; setData((d) => { const all = d.rows.map((r) => (r.id === t.id ? t : r)); onCount?.(all.filter((r) => r.status === 'pendiente').length); return { ...d, rows: all, totals: totalsOf(all) } }) }
  return (
    <div className="stack">
      <Card title="Transferencias" subtitle="Nequi, Daviplata y transferencias cobradas. Confirma en la cuenta o el celular que cada una llegó; pide el comprobante al cliente si hace falta.">
        {!data ? <Spinner /> : <>
          <TransferTotals totals={data.totals} />
          <div className="row-between" style={{ flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <Tabs value={estado} onChange={setEstado} tabs={[['pendiente', `Por verificar (${data.totals.pendiente.count})`], ['no_llego', `No llegó (${data.totals.no_llego.count})`], ['verificada', `Llegó (${data.totals.verificada.count})`], ['todas', 'Todas']]} />
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Periodo" style={{ width: "auto" }}>
              {[7, 30, 90, 180].map((d) => <option key={d} value={d}>Últimos {d} días</option>)}
            </select>
          </div>
          {!rows.length ? <Empty>{estado === 'pendiente' ? '✅ No hay transferencias por verificar.' : 'No hay transferencias en este estado.'}</Empty>
            : <TransferList rows={rows} showSession canEdit={(t) => admin || t.sessionOpen || t.status === 'pendiente'} onSaved={saved} toast={toast} />}
        </>}
      </Card>
      {toastNode}
    </div>
  )
}
