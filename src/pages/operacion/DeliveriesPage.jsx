import React, { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MdDeliveryDining, MdMap, MdPhone, MdPlace, MdCheckCircle, MdDirectionsBike, MdRefresh, MdUndo, MdAccountBalanceWallet } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { Badge, Card, Empty, Field, Kpi, PageHead, Spinner, useToast } from '../../components/ui'
import { formatDateTime, formatMoney, minutesLabel } from '../../utils/format'
import { since } from './common'

const TONE = { por_despachar: 'warn', en_camino: 'brand', entregado: 'ok' }
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
const fullAddress = (address, city) => [address, city].filter(Boolean).join(', ')
const mapUrl = (address, city) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress(address, city))}&travelmode=driving`
// Ruta con varias paradas desde el local: Google Maps admite hasta 9 paradas intermedias.
const routeUrl = (origin, stops) => {
  const list = stops.slice(0, 10)
  const p = new URLSearchParams({ api: '1', travelmode: 'driving', destination: list[list.length - 1] })
  const from = fullAddress(origin.address, origin.city)
  if (from) p.set('origin', from)
  if (list.length > 1) p.set('waypoints', list.slice(0, -1).join('|'))
  return `https://www.google.com/maps/dir/?${p.toString()}`
}
const shareLabel = (rule) => (rule.mode === 'todo' ? 'Todo el domicilio' : `${rule.percent} % del domicilio`)

// ---------- Tarjeta de un domicilio ----------
const DeliveryCard = ({ d, data, onAction, busy }) => {
  const city = data.origin.city
  const next = d.deliveryStatus === 'por_despachar' ? { status: 'en_camino', label: 'Salí con el pedido', icon: <MdDirectionsBike /> } : d.deliveryStatus === 'en_camino' ? { status: 'entregado', label: 'Entregado', icon: <MdCheckCircle /> } : null
  return (
    <li className={`delivery-card st-${d.deliveryStatus}`}>
      <div className="row-between">
        <span><Link to={`/pedidos/${d.id}`}><strong>{d.number}</strong></Link> <Badge tone={TONE[d.deliveryStatus]}>{d.deliveryStatusLabel}</Badge></span>
        <small className="muted">{d.deliveryStatus === 'entregado' && d.minutes !== null ? `Entregado en ${minutesLabel(d.minutes)}` : d.deliveryStatus === 'en_camino' ? `Salió ${since(d.dispatchedAt)}` : `Pedido ${since(d.openedAt)}`}</small>
      </div>
      <div className="delivery-who">
        <strong>{d.customerName || 'Cliente'}</strong>
        {d.customerPhone && <a href={`tel:${d.customerPhone}`} className="btn btn-sm btn-ghost"><MdPhone /> {d.customerPhone}</a>}
      </div>
      <a className="delivery-address" href={mapUrl(d.address, city)} target="_blank" rel="noreferrer"><MdPlace /> <span>{d.address}{city ? <small className="muted"> · {city}</small> : null}</span></a>
      {d.note && <small className="muted">📝 {d.note}</small>}
      {d.items.length > 0 && <small className="muted delivery-items">{d.items.map((i) => `${i.quantity} ${i.name}`).join(' · ')}</small>}
      <div className="delivery-money">
        <div><span>{d.paid ? 'Pagado' : 'Cobrar al cliente'}</span><b className={d.paid ? '' : 'text-warn'}>{formatMoney(d.total)}</b></div>
        <div><span>Domicilio</span><b>{d.deliveryFee ? formatMoney(d.deliveryFee) : 'No se cobró'}</b></div>
        <div><span>Le toca</span><b>{formatMoney(d.share + (d.paid ? d.tip : 0))}</b>{d.tip > 0 && <small className="muted">con {formatMoney(d.tip)} de propina</small>}</div>
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        {!data.mine && (
          <select value={d.courier?.id ?? ''} onChange={(e) => onAction(d, { courierId: e.target.value ? Number(e.target.value) : null })} aria-label={`Domiciliario de ${d.number}`} disabled={busy}>
            <option value="">Sin domiciliario</option>
            {data.couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            {d.courier && !data.couriers.some((c) => c.id === d.courier.id) && <option value={d.courier.id}>{d.courier.name}</option>}
          </select>
        )}
        <span className="grow" />
        {d.deliveryStatus !== 'por_despachar' && <button type="button" className="btn btn-sm btn-ghost" onClick={() => onAction(d, { status: d.deliveryStatus === 'entregado' ? 'en_camino' : 'por_despachar' })} disabled={busy} title="Deshacer"><MdUndo /></button>}
        <a href={mapUrl(d.address, city)} target="_blank" rel="noreferrer" className="btn btn-sm"><MdMap /> Ruta</a>
        {next && <button type="button" className="btn btn-sm btn-primary" onClick={() => onAction(d, { status: next.status })} disabled={busy}>{next.icon} {next.label}</button>}
      </div>
    </li>
  )
}

// ---------- Lista del día ----------
const DayTab = ({ onPickCourier }) => {
  const [toast, toastNode] = useToast()
  const [day, setDay] = useState(today())
  const [courier, setCourier] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => {
    api.get('/domicilios', { params: { dia: day, domiciliario: courier || undefined } }).then(({ data: d }) => { setData(d); setError('') }).catch((e) => setError(errorMessage(e)))
  }, [day, courier])
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [load])
  const onAction = async (d, body) => {
    setBusy(true)
    try {
      if ('courierId' in body) { await api.post(`/domicilios/${d.id}/asignar`, body); toast(body.courierId ? 'Domiciliario asignado' : 'Domiciliario quitado') } else { await api.post(`/domicilios/${d.id}/estado`, body); toast(body.status === 'entregado' ? `${d.number} entregado` : body.status === 'en_camino' ? `${d.number} en camino` : 'Estado actualizado') }
      load()
    } catch (err) { toast(errorMessage(err), 'bad') } finally { setBusy(false) }
  }
  if (error) return <div className="alert bad">{error}</div>
  if (!data) return <div className="splash" style={{ minHeight: 200 }}><Spinner /></div>
  const t = data.totals
  const active = data.deliveries.filter((d) => d.deliveryStatus !== 'entregado')
  const stops = active.map((d) => fullAddress(d.address, data.origin.city))
  const groups = [['por_despachar', 'Por despachar'], ['en_camino', 'En camino'], ['entregado', 'Entregados']]
  return (
    <div className="stack">
      {toastNode}
      <div className="row wrap" style={{ gap: 10, alignItems: 'flex-end' }}>
        <Field label="Día" htmlFor="dd"><input id="dd" type="date" value={day} max={today()} onChange={(e) => setDay(e.target.value || today())} /></Field>
        {!data.mine && (
          <Field label="Domiciliario" htmlFor="dc"><select id="dc" value={courier} onChange={(e) => setCourier(e.target.value)}><option value="">Todos</option>{data.couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        )}
        <span className="grow" />
        <button type="button" className="btn" onClick={load}><MdRefresh /> Actualizar</button>
        {stops.length > 0 && <a className="btn btn-primary" href={routeUrl(data.origin, stops)} target="_blank" rel="noreferrer"><MdMap /> Ruta con {stops.length > 10 ? 'las primeras 10' : `${stops.length}`} parada{stops.length === 1 ? '' : 's'}</a>}
      </div>
      <div className="kpis">
        <Kpi label={data.mine ? 'Mis domicilios' : 'Domicilios'} value={t.deliveries} note={`${t.delivered} entregados · ${t.onTheWay} en camino · ${t.pending} por despachar`} icon={MdDeliveryDining} tone="brand" />
        <Kpi label="Valor de domicilios cobrados" value={formatMoney(t.fees)} note={shareLabel(data.rule) + ' para el domiciliario'} />
        <Kpi label={data.mine ? 'Me toca hoy' : 'Les toca a los domiciliarios'} value={formatMoney(t.earned)} note={`${formatMoney(t.share)} domicilios + ${formatMoney(t.tips)} propinas`} icon={MdAccountBalanceWallet} tone="dark" />
        <Kpi label="Por cobrar a clientes" value={formatMoney(t.toCollect)} note="Pedidos aún sin pagar" tone={t.toCollect ? 'warn' : ''} />
      </div>
      {!data.mine && data.byCourier.length > 0 && (
        <Card title="Por domiciliario" icon={<MdDirectionsBike />} flush>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Domiciliario</th><th className="num">Domicilios</th><th className="num hide-sm">Entregados</th><th className="num hide-sm">Domicilios $</th><th className="num">Le toca</th><th className="num hide-sm">Propinas</th><th className="num">Total</th><th /></tr></thead>
            <tbody>{data.byCourier.map((c) => (
              <tr key={c.id ?? 'none'}><td><strong>{c.name}</strong></td><td className="num">{c.deliveries}</td><td className="num hide-sm">{c.delivered}</td><td className="num money hide-sm">{formatMoney(c.fees)}</td>
                <td className="num money">{formatMoney(c.share)}</td><td className="num money hide-sm">{formatMoney(c.tips)}</td><td className="num money"><b>{formatMoney(c.earned)}</b></td>
                <td>{c.id && <button type="button" className="btn btn-sm btn-ghost" onClick={() => onPickCourier(c.id)}>Cuenta</button>}</td></tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}
      {!data.deliveries.length ? <Card><Empty icon={<MdDeliveryDining />}>{data.mine ? 'No tienes domicilios asignados este día.' : 'No hay domicilios este día.'}</Empty></Card> : (
        <div className="delivery-cols">
          {groups.map(([k, label]) => {
            const list = data.deliveries.filter((d) => d.deliveryStatus === k)
            return (
              <section key={k}>
                <h4 className="label-sm">{label} <Badge tone={TONE[k]}>{list.length}</Badge></h4>
                {!list.length ? <small className="muted">Ninguno.</small> : <ul className="delivery-list">{list.map((d) => <DeliveryCard key={d.id} d={d} data={data} onAction={onAction} busy={busy} />)}</ul>}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------- Cuenta del domiciliario ----------
const AccountTab = ({ courierId, setCourierId }) => {
  const [range, setRange] = useState(() => { const to = today(); return { from: new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10), to } })
  const [couriers, setCouriers] = useState(null)
  const [mine, setMine] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api.get('/domicilios').then(({ data: d }) => { setMine(d.mine); setCouriers(d.couriers); if (!d.mine && !courierId && d.couriers.length) setCourierId(d.couriers[0].id) }).catch((e) => setError(errorMessage(e))) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (couriers === null || (!mine && !courierId)) return
    setData(null)
    api.get('/domicilios/cuenta', { params: { domiciliario: mine ? undefined : courierId, desde: range.from, hasta: range.to } }).then(({ data: d }) => { setData(d); setError('') }).catch((e) => setError(errorMessage(e)))
  }, [couriers, mine, courierId, range])
  if (error) return <div className="alert bad">{error}</div>
  if (couriers === null) return <Spinner />
  if (!mine && !couriers.length) return <Card><Empty icon={<MdDirectionsBike />}>No hay domiciliarios. Créalos en <Link to="/usuarios">Usuarios</Link> con el cargo Domiciliario.</Empty></Card>
  const t = data?.totals
  return (
    <div className="stack">
      <div className="row wrap" style={{ gap: 10, alignItems: 'flex-end' }}>
        {!mine && <Field label="Domiciliario" htmlFor="ac"><select id="ac" value={courierId || ''} onChange={(e) => setCourierId(Number(e.target.value))}>{couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
        <Field label="Desde" htmlFor="af"><input id="af" type="date" value={range.from} max={range.to} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value || r.from }))} /></Field>
        <Field label="Hasta" htmlFor="at"><input id="at" type="date" value={range.to} max={today()} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value || r.to }))} /></Field>
      </div>
      {!data ? <Spinner /> : <>
        <div className="kpis">
          <Kpi label="Domicilios" value={t.deliveries} note={`${formatMoney(t.fees)} en domicilios cobrados`} icon={MdDeliveryDining} tone="brand" />
          <Kpi label={mine ? 'Me tocó' : 'Le tocó'} value={formatMoney(t.earned)} note={`${formatMoney(t.share)} domicilios (${shareLabel(data.rule).toLowerCase()}) + ${formatMoney(t.tips)} propinas`} icon={MdAccountBalanceWallet} tone="dark" />
          <Kpi label="Pagado en los cierres de caja" value={formatMoney(t.paid)} note={`${data.payouts.length} pago${data.payouts.length === 1 ? '' : 's'}`} />
          <Kpi label="Pendiente por pagar" value={formatMoney(t.pending)} note="Se paga al cerrar la caja del turno" tone={t.pending ? 'warn' : ''} />
        </div>
        <div className="grid grid-2">
          <Card title="Por día" flush>
            {!data.days.length ? <Empty icon={<MdDeliveryDining />}>Sin domicilios en estas fechas.</Empty> : (
              <div className="table-wrap"><table className="table">
                <thead><tr><th>Día</th><th className="num">Domicilios</th><th className="num hide-sm">Tiempo prom.</th><th className="num">Domicilios $</th><th className="num">Propinas</th><th className="num">Total</th></tr></thead>
                <tbody>{data.days.map((d) => <tr key={d.date}><td>{d.date}</td><td className="num">{d.deliveries}</td><td className="num hide-sm">{d.avgMinutes === null ? '—' : minutesLabel(d.avgMinutes)}</td><td className="num money">{formatMoney(d.share)}</td><td className="num money">{formatMoney(d.tips)}</td><td className="num money"><b>{formatMoney(d.earned)}</b></td></tr>)}</tbody>
              </table></div>
            )}
          </Card>
          <Card title="Pagos en los cierres de caja" flush>
            {!data.payouts.length ? <Empty icon={<MdAccountBalanceWallet />}>Aún no hay pagos en estas fechas.</Empty> : (
              <ul className="list padded">{data.payouts.map((p) => (
                <li key={p.id}><span><strong>{p.session}</strong> <small className="muted">{p.register} · {formatDateTime(p.createdAt)} · {p.deliveries} domicilio{p.deliveries === 1 ? '' : 's'}{p.tips ? ` · ${formatMoney(p.tips)} propinas` : ''}</small></span><b className="money">{formatMoney(p.amount)}</b></li>
              ))}</ul>
            )}
          </Card>
        </div>
      </>}
    </div>
  )
}

const DeliveriesPage = () => {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'cuentas' ? 'cuentas' : 'dia'
  const [courierId, setCourierId] = useState(Number(params.get('domiciliario')) || null)
  const go = (t, extra = {}) => setParams({ ...(t === 'cuentas' ? { tab: 'cuentas' } : {}), ...extra })
  return (
    <div className="stack">
      <PageHead title="Domicilios" subtitle="Quién lleva cada pedido, la ruta, lo que se cobra y lo que le toca a cada domiciliario." />
      <div className="seg">
        <button type="button" className={`btn btn-sm${tab === 'dia' ? ' on' : ''}`} onClick={() => go('dia')}><MdDeliveryDining /> Domicilios del día</button>
        <button type="button" className={`btn btn-sm${tab === 'cuentas' ? ' on' : ''}`} onClick={() => go('cuentas')}><MdAccountBalanceWallet /> Cuentas</button>
      </div>
      {tab === 'dia' ? <DayTab onPickCourier={(id) => { setCourierId(id); go('cuentas') }} /> : <AccountTab courierId={courierId} setCourierId={setCourierId} />}
    </div>
  )
}

// ---------- Inicio del domiciliario (dashboard) ----------
export const CourierHome = () => {
  const [data, setData] = useState(null)
  useEffect(() => { api.get('/domicilios').then(({ data: d }) => setData(d)).catch(() => setData(false)) }, [])
  if (!data) return null
  const t = data.totals
  const active = data.deliveries.filter((d) => d.deliveryStatus !== 'entregado')
  return (
    <Card title="Mis domicilios de hoy" icon={<MdDeliveryDining />} actions={<Link to="/domicilios" className="btn btn-sm btn-primary">Ver domicilios</Link>}>
      <div className="usage-kpis">
        <div><span>Por llevar</span><strong>{t.pending + t.onTheWay}</strong><small>{t.onTheWay} en camino</small></div>
        <div><span>Entregados</span><strong>{t.delivered}</strong><small>de {t.deliveries} asignados</small></div>
        <div><span>Me toca hoy</span><strong>{formatMoney(t.earned)}</strong><small>{formatMoney(t.share)} domicilios + {formatMoney(t.tips)} propinas</small></div>
        <div><span>Cobrar a clientes</span><strong>{formatMoney(t.toCollect)}</strong><small>Pedidos sin pagar</small></div>
      </div>
      {active.length > 0 && <ul className="list" style={{ marginTop: 10 }}>{active.slice(0, 5).map((d) => (
        <li key={d.id}><span><Link to={`/pedidos/${d.id}`}><strong>{d.number}</strong></Link> <small className="muted">{d.address}</small></span><Badge tone={TONE[d.deliveryStatus]}>{d.deliveryStatusLabel}</Badge></li>
      ))}</ul>}
    </Card>
  )
}

// ---------- Bloque de domicilio dentro del pedido ----------
const STATUS_LABEL = { por_despachar: 'Por despachar', en_camino: 'En camino', entregado: 'Entregado' }
export const DeliveryBox = ({ order, canAssign, onChanged }) => {
  const [toast, toastNode] = useToast()
  const [couriers, setCouriers] = useState([])
  const [city, setCity] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { api.get('/domicilios').then(({ data }) => { setCouriers(data.couriers || []); setCity(data.origin?.city || '') }).catch(() => {}) }, [])
  const st = order.deliveryStatus || 'por_despachar'
  const act = async (url, body, msg) => {
    setBusy(true)
    try { await api.post(url, body); toast(msg); onChanged() } catch (err) { toast(errorMessage(err), 'bad') } finally { setBusy(false) }
  }
  return (
    <Card title="Domicilio" icon={<MdDeliveryDining />} actions={<Badge tone={TONE[st]}>{STATUS_LABEL[st]}</Badge>}>
      <div className="stack" style={{ gap: 10 }}>
        {toastNode}
        <a className="delivery-address" href={mapUrl(order.customerAddress, city)} target="_blank" rel="noreferrer"><MdPlace /> <span>{order.customerAddress}</span></a>
        {order.customerPhone && <a href={`tel:${order.customerPhone}`} className="muted"><MdPhone /> {order.customerName ? `${order.customerName} · ` : ''}{order.customerPhone}</a>}
        {canAssign ? (
          <Field label="Domiciliario" htmlFor="dbx"><select id="dbx" value={order.courier?.id ?? ''} disabled={busy} onChange={(e) => act(`/domicilios/${order.id}/asignar`, { courierId: e.target.value ? Number(e.target.value) : null }, 'Domiciliario actualizado')}>
            <option value="">Sin domiciliario</option>
            {couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            {order.courier && !couriers.some((c) => c.id === order.courier.id) && <option value={order.courier.id}>{order.courier.name}</option>}
          </select></Field>
        ) : <span>Domiciliario: <strong>{order.courier?.name || 'sin asignar'}</strong></span>}
        <div className="row wrap" style={{ gap: 8 }}>
          <a href={mapUrl(order.customerAddress, city)} target="_blank" rel="noreferrer" className="btn btn-sm"><MdMap /> Ruta</a>
          {st === 'por_despachar' && <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => act(`/domicilios/${order.id}/estado`, { status: 'en_camino' }, 'En camino')}><MdDirectionsBike /> Salió</button>}
          {st === 'en_camino' && <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => act(`/domicilios/${order.id}/estado`, { status: 'entregado' }, 'Entregado')}><MdCheckCircle /> Entregado</button>}
        </div>
      </div>
    </Card>
  )
}

export default DeliveriesPage
