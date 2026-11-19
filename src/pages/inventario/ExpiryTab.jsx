import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MdEventBusy, MdHourglassTop, MdEvent, MdLocalOffer, MdDeleteSweep, MdEdit, MdLightbulb, MdFirstPage } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { Badge, Card, Empty, Field, Kpi, Modal, Spinner } from '../../components/ui'
import { formatDate, formatMoney } from '../../utils/format'
import { fmtQty } from './common'

// ---------- TD-016 · Productos próximos a vencer ----------
export const EXPIRY_TONES = { vencido: 'bad', urgente: 'warn', proximo: 'brand', ok: 'muted' }
export const EXPIRY_LABELS = { vencido: 'Vencido', urgente: 'Vence ya', proximo: 'Por vencer', ok: 'Al día' }
export const daysText = (d) => (d < 0 ? `Venció hace ${-d} día${d === -1 ? '' : 's'}` : d === 0 ? 'Vence hoy' : d === 1 ? 'Vence mañana' : `Vence en ${d} días`)

// Corregir la fecha de un lote mal escrito al recibirlo.
const LotDateModal = ({ lot, onClose, onSaved }) => {
  const [date, setDate] = useState(lot.expiresOn)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true); setError('')
    try {
      const { data } = await api.patch(`/inventario/lotes/${lot.id}`, { expiresOn: date })
      onSaved(data.merged ? 'Fecha corregida: el lote se unió con el que ya tenía esa fecha' : 'Fecha del lote corregida')
    } catch (e) { setError(errorMessage(e)); setSaving(false) }
  }
  return (
    <Modal title={`Fecha del lote · ${lot.product?.name}`} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-primary" onClick={save} disabled={saving || !date}>{saving ? <Spinner /> : <MdEdit />} Guardar</button></>}>
      <div className="stack" style={{ gap: 12 }}>
        <small className="muted">{lot.warehouse?.name} · {fmtQty(lot.quantity, lot.product?.unit)} · entró con {lot.ref || '—'}</small>
        <Field label="Vence el" htmlFor="lde"><input id="lde" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <small className="hint">Úsalo solo si la fecha se escribió mal. Lo vencido de verdad se da de baja.</small>
        {error && <div className="alert bad">{error}</div>}
      </div>
    </Modal>
  )
}

// Cómo se controla un producto próximo a vencer (en el sistema y en la bodega).
const Guide = ({ windowDays, urgentDays }) => (
  <Card title="Cómo se controla" icon={<MdLightbulb />}>
    <ol className="expiry-guide">
      <li><b>Al recibir:</b> escribe la fecha de vencimiento de cada producto en la entrada. Si llegan dos fechas distintas, regístralas como dos entradas.</li>
      <li><b>En el estante (FEFO):</b> lo que vence primero va adelante y a la mano; lo nuevo, atrás. El sistema marca cada lote con <Badge tone="dark"><MdFirstPage /> Va adelante</Badge>.</li>
      <li><b>Al vender:</b> el sistema descuenta primero el lote que vence antes. En la toma de pedidos el producto sale con el aviso <Badge tone="warn">Recomiéndalo</Badge> para que el mesero lo ofrezca.</li>
      <li><b>{windowDays} días antes:</b> aparece aquí como “Por vencer”. A {urgentDays} días o menos pasa a “Vence ya”: ponle una promoción, ofrécelo en combo o como recomendado del día.</li>
      <li><b>Vencido:</b> se retira del estante, se separa en una caja marcada “VENCIDO – NO VENDER” y se da de baja aquí. El sistema no deja venderlo.</li>
    </ol>
  </Card>
)

export const ExpiryTab = ({ bodega, admin, onBaja, version }) => {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [days, setDays] = useState('')
  const [only, setOnly] = useState('')
  const [edit, setEdit] = useState(null)
  const [msg, setMsg] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    setData(null)
    api.get('/inventario/vencimientos', { params: { ...(bodega ? { bodega, sede: undefined } : {}), dias: days || undefined } })
      .then(({ data: d }) => setData(d)).catch((e) => setData({ error: errorMessage(e) }))
  }, [bodega, days, version, reload])
  const rows = useMemo(() => (data?.rows || []).filter((r) => !only || r.status === only), [data, only])
  if (!data) return <div className="splash" style={{ minHeight: 200 }}><Spinner /></div>
  if (data.error) return <Card><Empty icon={<MdEventBusy />}>{data.error}</Empty></Card>
  const s = data.summary
  return (
    <div className="stack">
      <div className="kpis">
        <Kpi label="Vencidos" value={s.expired.lots} note={s.expired.lots ? `${formatMoney(s.expired.costValue)} al costo · dar de baja` : 'Nada vencido'} icon={MdEventBusy} tone={s.expired.lots ? 'bad' : ''} />
        <Kpi label={`Vencen en ${data.urgentDays} días o menos`} value={s.urgent.lots} note={s.urgent.lots ? `${formatMoney(s.urgent.saleValue)} en venta` : 'Sin urgencias'} icon={MdHourglassTop} tone={s.urgent.lots ? 'warn' : ''} />
        <Kpi label={`Por vencer (${data.windowDays} días)`} value={s.soon.lots} note={`${formatMoney(s.soon.saleValue)} en venta`} icon={MdEvent} tone="brand" />
        <Kpi label="Lotes con fecha" value={s.trackedLots} note={`${s.products} producto(s) en el tablero`} icon={MdEvent} tone="dark" />
      </div>
      {msg && <div className="alert ok">{msg}</div>}
      <Card flush title="Productos próximos a vencer" subtitle="Del que vence primero al último, por bodega. Lo de la ventana de aviso y lo vencido." icon={<MdHourglassTop />}>
        <div className="toolbar">
          <select value={only} onChange={(e) => setOnly(e.target.value)} aria-label="Estado">
            <option value="">Todos</option><option value="vencido">Vencidos</option><option value="urgente">Vencen ya</option><option value="proximo">Por vencer</option>
          </select>
          <select value={days} onChange={(e) => setDays(e.target.value)} aria-label="Ventana">
            <option value="">Aviso: {data.windowDays} días (configuración)</option>
            {[7, 15, 30, 60, 90].filter((d) => d !== data.windowDays).map((d) => <option key={d} value={d}>Próximos {d} días</option>)}
          </select>
        </div>
        {!rows.length ? <Empty icon={<MdEvent />}>{s.trackedLots ? 'Nada vence en este periodo.' : 'Aún no hay productos con fecha de vencimiento. Escríbela al registrar una entrada.'}</Empty> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Producto</th><th>Bodega</th><th>Vence</th><th className="num">Cantidad</th><th className="hide-md">Qué hacer</th>{admin && <th />}</tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className={r.status === 'vencido' ? 'row-expired' : ''}>
                <td><Link to={`/productos/${r.product?.id}`}><strong>{r.product?.emoji} {r.product?.name}</strong></Link><small className="block">{[r.product?.sku, r.ref].filter(Boolean).join(' · ')}</small></td>
                <td>{r.warehouse?.name}<small className="block">{r.warehouse?.isMain ? 'Principal' : r.warehouse?.site}</small></td>
                <td><Badge tone={EXPIRY_TONES[r.status]}>{EXPIRY_LABELS[r.status]}</Badge>{r.first && <> <Badge tone="dark"><MdFirstPage /> Va adelante</Badge></>}<small className="block">{formatDate(r.expiresOn)} · {daysText(r.days)}</small></td>
                <td className="num"><strong>{fmtQty(r.quantity, r.product?.unit)}</strong><small className="block">{formatMoney(r.saleValue)}</small></td>
                <td className="hide-md"><small>{r.advice.text}</small></td>
                {admin && <td className="right nowrap">
                  {r.status === 'vencido'
                    ? <button type="button" className="btn btn-sm" onClick={() => onBaja(r)} title="Dar de baja este lote"><MdDeleteSweep /> Dar de baja</button>
                    : r.status === 'urgente' && <button type="button" className="btn btn-sm" onClick={() => navigate(`/promociones?producto=${r.product?.id}&nombre=${encodeURIComponent(r.product?.name || '')}`)} title="Crear una promoción para venderlo antes"><MdLocalOffer /> Promoción</button>}
                  <button type="button" className="btn btn-ghost btn-icon" aria-label="Corregir la fecha" title="Corregir la fecha" onClick={() => setEdit(r)}><MdEdit /></button>
                </td>}
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
      <Guide windowDays={data.windowDays} urgentDays={data.urgentDays} />
      {edit && <LotDateModal lot={edit} onClose={() => setEdit(null)} onSaved={(m) => { setEdit(null); setMsg(m); setReload((x) => x + 1) }} />}
    </div>
  )
}

// Lotes de un producto (ficha del producto).
export const LotsCard = ({ lots, unit, windowDays }) => (
  <Card title="Lotes y vencimientos" subtitle={`Lo que vence primero se vende primero. Aviso ${windowDays} días antes.`} icon={<MdHourglassTop />} flush>
    {!lots?.length ? <Empty>Sin lotes con fecha. Escribe la fecha de vencimiento al registrar una entrada.</Empty> : (
      <table className="table"><tbody>{lots.map((l) => (
        <tr key={l.id}>
          <td><strong>{formatDate(l.expiresOn)}</strong> {l.first && <Badge tone="dark"><MdFirstPage /> Va adelante</Badge>}<small className="block">{l.warehouse?.name} · {daysText(l.days)}</small></td>
          <td><Badge tone={EXPIRY_TONES[l.status]}>{EXPIRY_LABELS[l.status]}</Badge></td>
          <td className="num"><strong>{fmtQty(l.quantity, unit)}</strong><small className="block">de {fmtQty(l.received, unit)}</small></td>
        </tr>
      ))}</tbody></table>
    )}
  </Card>
)
