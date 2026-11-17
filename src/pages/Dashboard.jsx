import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MdRoomService, MdReceipt, MdSoupKitchen, MdLockOpen, MdRequestQuote, MdLocalAtm, MdPeople, MdBadge, MdPlace, MdWarehouse, MdTimeline, MdRestaurantMenu, MdWarningAmber, MdRemoveShoppingCart, MdTableRestaurant, MdReceiptLong, MdPointOfSale, MdAttachMoney, MdInventory, MdNotificationsActive, MdMenuBook, MdQrCode2, MdTimer } from 'react-icons/md'
import api, { errorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { Badge, Card, Empty, Kpi, PageHead, Spinner } from '../components/ui'
import { formatDateTime, formatMoney, formatShort, minutesLabel } from '../utils/format'
import { since } from './operacion/common'
import { POSITION_LABELS } from '../utils/nav'

// Ventas por hora del día (barras simples).
const HourBars = ({ data }) => {
  const max = Math.max(1, ...data.map((d) => d.total))
  const hours = data.filter((d, i) => d.total > 0 || (d.hour >= 10 && d.hour <= 23) || i === 0)
  return (
    <div className="hour-bars" role="img" aria-label="Ventas por hora">
      {hours.map((d) => (
        <div key={d.hour} className="hour-bar" title={`${d.hour}:00 · ${formatMoney(d.total)}`}>
          <span style={{ height: `${Math.max(2, (d.total / max) * 100)}%` }} className={d.total ? '' : 'zero'} />
          <small>{d.hour}</small>
        </div>
      ))}
    </div>
  )
}
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches' }

// Dashboard por rol. Cada etapa le suma indicadores (pedidos, mesas, caja, ventas, stock, llamados).
const Dashboard = () => {
  const { user } = useAuth()
  const { settings } = useSettings()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api.get('/dashboard').then(({ data: d }) => setData(d)).catch((e) => setError(errorMessage(e))) }, [])

  if (error) return <div className="alert bad">{error}</div>
  if (!data) return <div className="splash" style={{ minHeight: 240 }}><Spinner /></div>

  if (data.role === 'superadmin' || data.role === 'admin') {
    const k = data.kpis
    return (
      <div className="stack">
        <PageHead title={`${greeting()}, ${user.name}`} subtitle={`Operación de hoy en ${settings.businessName}.`} />
        <div className="kpis">
          <Kpi label="Ventas de hoy" value={formatMoney(k.salesToday)} note={`${k.ordersToday} pedidos · ticket ${formatMoney(k.avgTicket)}`} icon={MdAttachMoney} tone="brand" />
          <Kpi label="Propinas de hoy" value={formatMoney(k.tipsToday)} icon={MdLocalAtm} />
          <Kpi label="Pedidos abiertos" value={k.openOrders} icon={MdReceiptLong} tone="dark" />
          <Kpi label="Mesas ocupadas" value={`${k.occupiedTables}/${k.tables}`} icon={MdTableRestaurant} />
          <Kpi label="Llamados de mesa" value={k.pendingCalls} icon={MdNotificationsActive} tone={k.pendingCalls ? 'warn' : ''} />
          <Kpi label="Cajas abiertas" value={k.openSessions} icon={MdPointOfSale} />
          <Kpi label="Por cobrar" value={formatMoney(k.receivables)} icon={MdRequestQuote} />
          <Kpi label="Stock bajo / agotados" value={`${k.lowStock} / ${k.outOfStock}`} icon={MdWarningAmber} tone={k.outOfStock ? 'bad' : k.lowStock ? 'warn' : ''} />
        </div>
        <div className="grid grid-2-1">
          <Card title="Ventas por hora" subtitle={`Hoy · descuentos ${formatMoney(k.discountsToday)} · cortesías ${formatMoney(k.courtesiesToday)}`} icon={<MdAttachMoney />}>
            {k.ordersToday ? <HourBars data={data.salesByHour} /> : <Empty icon={<MdAttachMoney />}>Aún no hay ventas hoy.</Empty>}
          </Card>
          <Card title="En este momento" flush>
            <ul className="list padded">
              {data.calls.map((c) => <li key={`c${c.id}`}><span>{c.kind === 'cuenta' ? <MdReceipt /> : <MdRoomService />} <strong>{c.table}</strong> <small>{c.kind === 'cuenta' ? 'pide la cuenta' : 'llama al mesero'}</small></span><small>{since(c.createdAt)}</small></li>)}
              {data.sessions.map((x) => <li key={`s${x.id}`}><span><MdLockOpen /> <strong>{x.register}</strong> <small>{x.number}{x.site ? ` · ${x.site}` : ''}</small></span><small>{since(x.openedAt)}</small></li>)}
              {!data.calls.length && !data.sessions.length && <li><small className="muted">Sin llamados ni cajas abiertas.</small></li>}
            </ul>
            <div className="row-end" style={{ padding: '0 16px 14px' }}><Link to="/mesas" className="btn btn-sm">Mesas</Link><Link to="/caja" className="btn btn-sm">Caja</Link></div>
          </Card>
        </div>
        {data.tableUsage && (
          <Card title="Uso de las mesas" subtitle="Últimos 30 días · cuánto dura una mesa ocupada y cuánto vende por hora" icon={<MdTimer />}
            actions={<Link to="/reportes?tab=mesas" className="btn btn-sm">Ver reporte</Link>}>
            {!data.tableUsage.turns ? <Empty icon={<MdTimer />}>Cuando se cobren pedidos en mesa verás aquí el tiempo promedio de cada una.</Empty> : (
              <div className="usage">
                <div className="usage-kpis">
                  <div><span>Tiempo promedio</span><strong>{minutesLabel(data.tableUsage.avgMinutes)}</strong><small>{data.tableUsage.turns} ocupaciones</small></div>
                  <div><span>Venta por hora de mesa</span><strong>{formatMoney(data.tableUsage.perHour)}</strong><small>Mitad de las mesas: menos de {minutesLabel(data.tableUsage.medianMinutes)}</small></div>
                </div>
                <div className="usage-best">
                  <span className="label-sm">Mejores puestos para reservar</span>
                  <ol>{data.tableUsage.best.map((t) => (
                    <li key={t.tableId}><strong>{t.name}</strong> <small className="muted">{t.area}</small><span className="grow" /><small>{minutesLabel(t.avgMinutes)}</small><b className="money">{formatMoney(t.perHour)}/h</b></li>
                  ))}</ol>
                </div>
              </div>
            )}
          </Card>
        )}
        {data.alerts?.length > 0 && (
          <Card title="Stock bajo y agotados" icon={<MdWarningAmber />} actions={<Link to="/inventario?tab=resumen" className="btn btn-sm">Ver inventario</Link>} flush>
            <ul className="list padded">
              {data.alerts.map((a) => (
                <li key={`${a.warehouseId}-${a.productId}`}>
                  <span><Link to={`/productos/${a.productId}`}><strong>{a.name}</strong></Link> <small>{a.warehouse.name}{a.warehouse.site ? ` · ${a.warehouse.site}` : ''}</small></span>
                  <Badge tone={a.out ? 'bad' : 'warn'}>{a.out ? 'Agotado' : `Quedan ${Number(a.stock).toLocaleString('es-CO')} ${a.unit}`}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <div className="grid grid-2-1">
          <Card title="Actividad reciente" icon={<MdMenuBook />} actions={<Link to="/bitacora" className="btn btn-sm">Ver bitácora</Link>} flush>
            {!data.recent.length ? <Empty icon={<MdTimeline />}>Aún no hay actividad.</Empty> : (
              <ul className="list padded">
                {data.recent.map((r) => <li key={r.id}><span><strong>{r.user || 'Sistema'}</strong> <small>{r.action} · {r.entity}</small></span><small>{formatDateTime(r.createdAt)}</small></li>)}
              </ul>
            )}
          </Card>
          <Card title="Tu establecimiento">
            <dl className="order-totals" style={{ margin: 0 }}>
              <div><dt><MdPeople /> Usuarios activos</dt><dd>{k.users}</dd></div>
              <div><dt><MdBadge /> Empleados</dt><dd>{k.employees}</dd></div>
              <div><dt><MdPlace /> Sucursales</dt><dd>{k.sites}</dd></div>
              <div><dt><MdWarehouse /> Bodegas</dt><dd>{k.warehouses}</dd></div>
              <div><dt><MdRestaurantMenu /> Productos activos</dt><dd>{k.products}</dd></div>
              <div><dt><MdTimeline /> Movimientos hoy</dt><dd>{k.activityToday}</dd></div>
            </dl>
          </Card>
        </div>
      </div>
    )
  }

  if (data.role === 'empleado') {
    const ek = data.kpis
    const pos = data.positions
    const sells = pos.some((p) => ['mesero', 'cajero', 'host', 'bartender', 'barista'].includes(p))
    const kitchen = pos.some((p) => ['cocina', 'bartender', 'barista'].includes(p))
    const cashier = pos.includes('cajero')
    return (
      <div className="stack">
        <PageHead title={`${greeting()}, ${user.name}`} subtitle={[data.site, data.positions.map((p) => POSITION_LABELS[p]).join(' · ')].filter(Boolean).join(' · ')} />
        <div className="kpis">
          {sells && <Kpi label="Mis ventas de hoy" value={formatMoney(ek.mySalesToday)} note={`${ek.myOrdersToday} pedidos cobrados`} icon={MdAttachMoney} tone="brand" />}
          {sells && <Kpi label="Mis propinas de hoy" value={formatMoney(ek.myTipsToday)} icon={MdLocalAtm} />}
          {sells && <Kpi label="Mis pedidos abiertos" value={ek.myOpenOrders} icon={MdReceiptLong} tone="dark" />}
          {sells && <Kpi label="Llamados de mesa" value={ek.pendingCalls} icon={MdNotificationsActive} tone={ek.pendingCalls ? 'warn' : ''} />}
          {kitchen && <Kpi label="Comandas por empezar" value={ek.kitchenPending} icon={MdSoupKitchen} tone={ek.kitchenPending ? 'warn' : 'brand'} />}
          {kitchen && <Kpi label="En preparación" value={ek.kitchenPreparing} icon={MdSoupKitchen} />}
          <Kpi label="Mis movimientos hoy" value={ek.myActivityToday} icon={MdTimeline} />
        </div>
        <div className="row wrap" style={{ gap: 10 }}>
          {sells && <Link to="/mesas" className="btn btn-primary"><MdTableRestaurant /> Ir a las mesas</Link>}
          {kitchen && <Link to="/comandas" className="btn btn-primary"><MdSoupKitchen /> Ver comandas</Link>}
          {cashier && <Link to="/caja" className="btn"><MdPointOfSale /> {data.session ? `Caja abierta: ${data.session.register} (${data.session.number})` : 'Abrir caja'}</Link>}
        </div>
      </div>
    )
  }

  return (
    <div className="stack">
      <PageHead title={`Bienvenido a ${settings.businessName}`} subtitle="Escanea el código QR de tu mesa para ver la carta y hacer tu pedido." />
      <Card><Empty icon={<MdQrCode2 />}>Escanea el QR de tu mesa con la cámara del celular.</Empty></Card>
    </div>
  )
}

export default Dashboard
