import React, { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { MdDeliveryDining, MdMap, MdPhone, MdPlace, MdCheckCircle, MdDirectionsBike, MdRefresh, MdUndo, MdAccountBalanceWallet } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { Badge, Card, Empty, Field, Kpi, PageHead, Spinner, useToast } from '../../components/ui'
import { formatDateTime, formatMoney, minutesLabel } from '../../utils/format'
import { since, useCan } from './common'
import { FloatsCard } from './CourierFloats'
import { useAuth } from '../../context/AuthContext'
import { OpenOrderModal } from './tableModals'

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
const PAY_LABEL = { efectivo: 'Efectivo', transferencia: 'Transferencia', nequi: 'Nequi', daviplata: 'Daviplata', tarjeta: 'Tarjeta', otro: 'Otro' }
const payText = (d) => (!d.payMethod ? null : d.payMethod === 'efectivo' ? `💵 Paga en efectivo al domiciliario${d.cashWith ? ` con ${formatMoney(d.cashWith)} · llevar ${formatMoney(d.change || 0)} de cambio` : ''}` : `📲 Paga por ${PAY_LABEL[d.payMethod] || d.payMethod}${d.paid ? '' : d.mustPayFirst ? ' · cobrar antes de enviar' : ' · transfiere al llegar'}`)
// TD-012: el domicilio lo entrega solo el domiciliario asignado (o el domiciliario que lo toma si no tiene).
const isCourier = (user) => user?.role === 'empleado' && (user.positions || []).includes('domiciliario')
const deliversIt = (user, courier) => isCourier(user) && (!courier || courier.id === user.id)
// Acciones de un domicilio según su estado y quién lo mira.
const deliveryActions = ({ user, status, courier, mustPayFirst, dispatchBlock }) => {
  const mine = deliversIt(user, courier)
  if (status === 'por_despachar') {
    if (mustPayFirst) return { payFirst: true }
    if (dispatchBlock) return { blocked: dispatchBlock }
    if (!courier && !mine) return { blocked: 'Asígnale un domiciliario para despacharlo.' }
    return { next: { status: 'en_camino', label: mine ? 'Salí con el pedido' : 'Salió con el pedido', icon: <MdDirectionsBike /> } }
  }
  if (status === 'en_camino') {
    return { next: mine ? { status: 'entregado', label: 'Entregado', icon: <MdCheckCircle /> } : null, waiting: mine ? null : `Lo marca entregado ${courier?.name || 'el domiciliario'}.`, undo: 'por_despachar' }
  }
  return { undo: mine ? 'en_camino' : null }
}
// Cambia el estado o el domiciliario de un domicilio y avisa.
const useDeliveryAction = (load) => {
  const [toast, toastNode] = useToast()
  const [busy, setBusy] = useState(false)
  const onAction = async (d, body) => {
    setBusy(true)
    try {
      if ('courierId' in body) { await api.post(`/domicilios/${d.id}/asignar`, body); toast('Domiciliario asignado') } else { await api.post(`/domicilios/${d.id}/estado`, body); toast(body.status === 'entregado' ? `${d.number} entregado` : body.status === 'en_camino' ? `${d.number} en camino` : 'Estado actualizado') }
      load()
    } catch (err) { toast(errorMessage(err), 'bad') } finally { setBusy(false) }
  }
  return { onAction, busy, toastNode }
}
const shareLabel = (rule) => (rule.mode === 'todo' ? 'Todo el domicilio' : `${rule.percent} % del domicilio`)

// ---------- Tarjeta de un domicilio ----------
const DeliveryCard = ({ d, data, onAction, busy }) => {
  const { user } = useAuth()
  const city = data.origin.city
  const act = deliveryActions({ user, status: d.deliveryStatus, courier: d.courier, mustPayFirst: d.mustPayFirst, dispatchBlock: d.dispatchBlock })
  return (
    <li className={`delivery-card st-${d.deliveryStatus}`}>
      <div className="row-between">
        <span><Link to={`/pedidos/${d.id}`}><strong>{d.number}</strong></Link> <Badge tone={TONE[d.deliveryStatus]}>{d.deliveryStatusLabel}</Badge></span>
        <small className="muted">{d.deliveryStatus === 'entregado' && d.minutes !== null ? `Entregado en ${minutesLabel(d.minutes)}` : d.deliveryStatus === 'en_camino' ? `Salió ${since(d.dispatchedAt)}` : `Pedido ${since(d.openedAt)}`}</small>
      </div>
      <div className="delivery-who">
        <strong>{d.customerName || 'Cliente'}</strong>{d.zone && <Badge tone="brand">{d.zone}</Badge>}
        {d.customerPhone && <a href={`tel:${d.customerPhone}`} className="btn btn-sm btn-ghost"><MdPhone /> {d.customerPhone}</a>}
      </div>
      <a className="delivery-address" href={mapUrl(d.address, city)} target="_blank" rel="noreferrer"><MdPlace /> <span>{d.address}{city ? <small className="muted"> · {city}</small> : null}</span></a>
      {d.note && <small className="muted">📝 {d.note}</small>}
      {payText(d) && <small className={d.mustPayFirst ? 'text-warn' : 'muted'}><b>{payText(d)}</b></small>}
      {d.items.length > 0 && <small className="muted delivery-items">{d.items.map((i) => `${i.quantity} ${i.name}`).join(' · ')}</small>}
      <div className="delivery-money">
        <div><span>{d.paid ? 'Pagado' : 'Cobrar al cliente'}</span><b className={d.paid ? '' : 'text-warn'}>{formatMoney(d.total)}</b></div>
        <div><span>Domicilio</span><b>{d.deliveryFee ? formatMoney(d.deliveryFee) : 'No se cobró'}</b></div>
        <div><span>Le toca</span><b>{formatMoney(d.share + (d.paid ? d.tip : 0))}</b>{d.tip > 0 && <small className="muted">con {formatMoney(d.tip)} de propina</small>}</div>
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        {!data.mine && (
          <select value={d.courier?.id ?? ''} onChange={(e) => e.target.value && onAction(d, { courierId: Number(e.target.value) })} aria-label={`Domiciliario de ${d.number}`} disabled={busy || (Boolean(d.courier) && d.deliveryStatus !== 'por_despachar')}>
            {!d.courier && <option value="" disabled>Elige el domiciliario</option>}
            {data.couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            {d.courier && !data.couriers.some((c) => c.id === d.courier.id) && <option value={d.courier.id}>{d.courier.name}</option>}
          </select>
        )}
        <span className="grow" />
        {act.undo && <button type="button" className="btn btn-sm btn-ghost" onClick={() => onAction(d, { status: act.undo })} disabled={busy} title="Deshacer"><MdUndo /></button>}
        <a href={mapUrl(d.address, city)} target="_blank" rel="noreferrer" className="btn btn-sm"><MdMap /> Ruta</a>
        {act.payFirst && <Link to={`/pedidos/${d.id}`} className="btn btn-sm" title="Se paga antes de enviar">Cobrar antes de enviar</Link>}
        {act.next && <button type="button" className="btn btn-sm btn-primary" onClick={() => onAction(d, { status: act.next.status })} disabled={busy}>{act.next.icon} {act.next.label}</button>}
        {act.blocked && <button type="button" className="btn btn-sm" disabled title={act.blocked}><MdDirectionsBike /> {isCourier(user) ? 'Salí con el pedido' : 'Salió con el pedido'}</button>}
      </div>
      {act.blocked && <small className="text-warn">{act.blocked}</small>}
      {act.waiting && <small className="muted">{act.waiting}</small>}
    </li>
  )
}

// ---------- Lista del día ----------
const DayTab = ({ onPickCourier }) => {
  const can = useCan()
  const [day, setDay] = useState(today())
  const [courier, setCourier] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [zone, setZone] = useState('')
  const load = useCallback(() => {
    api.get('/domicilios', { params: { dia: day, domiciliario: courier || undefined } }).then(({ data: d }) => { setData(d); setError('') }).catch((e) => setError(errorMessage(e)))
  }, [day, courier])
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [load])
  const { onAction, busy, toastNode } = useDeliveryAction(load)
  if (error) return <div className="alert bad">{error}</div>
  if (!data) return <div className="splash" style={{ minHeight: 200 }}><Spinner /></div>
  const t = data.totals
  // Zona de reparto del cliente: filtra la lista y arma la ruta solo con esa zona.
  const zones = [...new Set(data.deliveries.map((d) => d.zone).filter(Boolean))].sort()
  const shown = zone ? data.deliveries.filter((d) => d.zone === zone) : data.deliveries
  const active = shown.filter((d) => d.deliveryStatus !== 'entregado')
  const stops = active.map((d) => fullAddress(d.address, data.origin.city))
  const groups = [['por_despachar', 'Por despachar'], ['en_camino', 'En camino'], ['entregado', 'Entregados']]
  const listNode = (
    !data.deliveries.length ? <Card><Empty icon={<MdDeliveryDining />}>{data.mine ? 'No tienes domicilios asignados este día.' : 'No hay domicilios este día.'}</Empty></Card> : (
        <div className="delivery-cols">
          {groups.map(([k, label]) => {
            const list = shown.filter((d) => d.deliveryStatus === k)
            return (
              <section key={k}>
                <h4 className="label-sm">{label} <Badge tone={TONE[k]}>{list.length}</Badge></h4>
                {!list.length ? <small className="muted">Ninguno.</small> : <ul className="delivery-list">{list.map((d) => <DeliveryCard key={d.id} d={d} data={data} onAction={onAction} busy={busy} />)}</ul>}
              </section>
            )
          })}
        </div>
      )
  )
  return (
    <div className="stack">
      {toastNode}
      <div className="row wrap" style={{ gap: 10, alignItems: 'flex-end' }}>
        <Field label="Día" htmlFor="dd"><input id="dd" type="date" value={day} max={today()} onChange={(e) => setDay(e.target.value || today())} /></Field>
        {!data.mine && (
          <Field label="Domiciliario" htmlFor="dc"><select id="dc" value={courier} onChange={(e) => setCourier(e.target.value)}><option value="">Todos</option>{data.couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        )}
        {zones.length > 0 && (
          <Field label="Zona" htmlFor="dz"><select id="dz" value={zone} onChange={(e) => setZone(e.target.value)}><option value="">Todas</option>{zones.map((z) => <option key={z} value={z}>{z}</option>)}</select></Field>
        )}
        <span className="grow" />
        <button type="button" className="btn" onClick={load}><MdRefresh /> Actualizar</button>
        {stops.length > 0 && <a className="btn btn-primary" href={routeUrl(data.origin, stops)} target="_blank" rel="noreferrer"><MdMap /> Ruta con {stops.length > 10 ? 'las primeras 10' : `${stops.length}`} parada{stops.length === 1 ? '' : 's'}</a>}
      </div>
      {data.mine && listNode}
      <div className="kpis">
        <Kpi label={data.mine ? 'Mis domicilios' : 'Domicilios'} value={t.deliveries} note={`${t.delivered} entregados · ${t.onTheWay} en camino · ${t.pending} por despachar`} icon={MdDeliveryDining} tone="brand" />
        <Kpi label="Valor de domicilios cobrados" value={formatMoney(t.fees)} note={shareLabel(data.rule) + ' para el domiciliario'} />
        <Kpi label={data.mine ? 'Me toca hoy' : 'Les toca a los domiciliarios'} value={formatMoney(t.earned)} note={`${formatMoney(t.share)} domicilios + ${formatMoney(t.tips)} propinas`} icon={MdAccountBalanceWallet} tone="dark" />
        <Kpi label="Por cobrar a clientes" value={formatMoney(t.toCollect)} note="Pedidos aún sin pagar" tone={t.toCollect ? 'warn' : ''} />
      </div>
      {data.today && <FloatsCard couriers={data.couriers} canManage={can('cajero')} mine={data.mine} onChanged={load} />}
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
      {!data.mine && listNode}
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
  const can = useCan()
  const navigate = useNavigate()
  const [opening, setOpening] = useState(false)
  return (
    <div className="stack">
      <PageHead title="Domicilios" subtitle="Quién lleva cada pedido, la ruta, lo que se cobra y lo que le toca a cada domiciliario.">
        {can('mesero', 'cajero', 'host', 'bartender', 'barista') && <button type="button" className="btn btn-primary" onClick={() => setOpening(true)}><MdDeliveryDining /> Nuevo domicilio</button>}
      </PageHead>
      {opening && <OpenOrderModal type="domicilio" onClose={() => setOpening(false)} onOpened={(o) => navigate(`/pedidos/${o.id}`)} />}
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
  const load = useCallback(() => { api.get('/domicilios').then(({ data: d }) => setData(d)).catch(() => setData(false)) }, [])
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [load])
  const { onAction, busy, toastNode } = useDeliveryAction(load)
  if (!data) return null
  const t = data.totals
  // Primero los que ya van en camino (para marcarlos entregados), luego los que están por salir.
  const active = data.deliveries.filter((d) => d.deliveryStatus !== 'entregado').sort((a, b) => (a.deliveryStatus === 'en_camino' ? 0 : 1) - (b.deliveryStatus === 'en_camino' ? 0 : 1))
  return (<>
    <Card title="Mis domicilios por llevar" icon={<MdDeliveryDining />} subtitle={active.length ? `${t.onTheWay} en camino · ${t.pending} por despachar` : null} actions={<Link to="/domicilios" className="btn btn-sm">Ver todos mis domicilios</Link>}>
      {toastNode}
      {!active.length
        ? <Empty icon={<MdDeliveryDining />}>No tienes domicilios por llevar. Cuando te asignen uno, aparece aquí con el botón para salir y entregarlo.</Empty>
        : <ul className="delivery-list">{active.map((d) => <DeliveryCard key={d.id} d={d} data={data} onAction={onAction} busy={busy} />)}</ul>}
      <div className="usage-kpis" style={{ marginTop: 12 }}>
        <div><span>Entregados</span><strong>{t.delivered}</strong><small>de {t.deliveries} asignados</small></div>
        <div><span>Me toca hoy</span><strong>{formatMoney(t.earned)}</strong><small>{formatMoney(t.share)} domicilios + {formatMoney(t.tips)} propinas</small></div>
        <div><span>Cobrar a clientes</span><strong>{formatMoney(t.toCollect)}</strong><small>Pedidos sin pagar</small></div>
      </div>
    </Card>
    <FloatsCard couriers={[]} canManage={false} mine />
  </>)
}

// ---------- Bloque de domicilio dentro del pedido ----------
const STATUS_LABEL = { por_despachar: 'Por despachar', en_camino: 'En camino', entregado: 'Entregado' }
export const DeliveryBox = ({ order, canAssign, onChanged }) => {
  const [toast, toastNode] = useToast()
  const [couriers, setCouriers] = useState([])
  const [city, setCity] = useState('')
  const [busy, setBusy] = useState(false)
  const [payFirst, setPayFirst] = useState(true)
  useEffect(() => { api.get('/domicilios').then(({ data }) => { setCouriers(data.couriers || []); setCity(data.origin?.city || ''); setPayFirst(data.rule?.timing !== 'al_entregar') }).catch(() => {}) }, [])
  const { user } = useAuth()
  const st = order.deliveryStatus || 'por_despachar'
  const mustPayFirst = Boolean(order.deliveryPayMethod && order.deliveryPayMethod !== 'efectivo' && order.status === 'abierto' && payFirst)
  const flow = deliveryActions({ user, status: st, courier: order.courier, mustPayFirst, dispatchBlock: order.dispatchBlock })
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
          <Field label="Domiciliario" htmlFor="dbx"><select id="dbx" value={order.courier?.id ?? ''} disabled={busy || (Boolean(order.courier) && st !== 'por_despachar')} onChange={(e) => e.target.value && act(`/domicilios/${order.id}/asignar`, { courierId: Number(e.target.value) }, 'Domiciliario actualizado')}>
            {!order.courier && <option value="" disabled>Elige el domiciliario</option>}
            {couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            {order.courier && !couriers.some((c) => c.id === order.courier.id) && <option value={order.courier.id}>{order.courier.name}</option>}
          </select></Field>
        ) : <span>Domiciliario: <strong>{order.courier?.name || 'sin asignar'}</strong></span>}
        <div className={`alert ${order.status === 'cobrado' ? 'ok' : 'warn'}`} style={{ margin: 0 }}>{order.status === 'cobrado' ? `Pagado: ${formatMoney(order.paid || order.total)}.` : `Sin cobrar: ${formatMoney(order.total)}. ${order.deliveryPayMethod === 'efectivo' || !order.deliveryPayMethod ? 'Cóbralo en caja cuando el domiciliario traiga el dinero.' : 'Cóbralo en caja cuando llegue la transferencia.'}`}</div>
        {order.deliveryPayMethod && <small className={order.deliveryPayMethod !== 'efectivo' && order.status === 'abierto' && payFirst ? 'text-warn' : 'muted'}><b>{order.deliveryPayMethod === 'efectivo' ? `💵 Paga en efectivo al domiciliario${order.deliveryCashWith ? ` con ${formatMoney(order.deliveryCashWith)} · llevar ${formatMoney(Math.max(0, order.deliveryCashWith - order.total))} de cambio` : ''}` : `📲 Paga por ${PAY_LABEL[order.deliveryPayMethod]}${order.status !== 'abierto' ? '' : payFirst ? ' · cobrar antes de enviar' : ' · transfiere al llegar'}`}</b></small>}
        <div className="row wrap" style={{ gap: 8 }}>
          <a href={mapUrl(order.customerAddress, city)} target="_blank" rel="noreferrer" className="btn btn-sm"><MdMap /> Ruta</a>
          {flow.undo && <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => act(`/domicilios/${order.id}/estado`, { status: flow.undo }, 'Estado actualizado')} title="Deshacer"><MdUndo /></button>}
          {flow.next && <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => act(`/domicilios/${order.id}/estado`, { status: flow.next.status }, flow.next.status === 'entregado' ? 'Entregado' : 'En camino')}>{flow.next.icon} {flow.next.label}</button>}
          {flow.blocked && <button type="button" className="btn btn-sm" disabled title={flow.blocked}><MdDirectionsBike /> Salió</button>}
        </div>
        {flow.blocked && <small className="text-warn">{flow.blocked}</small>}
        {flow.waiting && <small className="muted">{flow.waiting}</small>}
      </div>
    </Card>
  )
}

export default DeliveriesPage
