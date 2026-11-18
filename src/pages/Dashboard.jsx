import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MdRoomService, MdReceipt, MdSoupKitchen, MdLockOpen, MdRequestQuote, MdLocalAtm, MdPeople, MdBadge, MdPlace, MdWarehouse, MdTimeline, MdRestaurantMenu, MdWarningAmber, MdRemoveShoppingCart, MdTableRestaurant, MdReceiptLong, MdPointOfSale, MdAttachMoney, MdInventory, MdNotificationsActive, MdMenuBook, MdQrCode2, MdTimer, MdAccountBalance, MdPanTool, MdReportProblem, MdTrendingDown, MdCheckCircle, MdHourglassTop, MdShoppingCart, MdStar, MdEmojiEvents, MdLocalOffer, MdTrendingUp, MdFactCheck, MdDeliveryDining, MdStorefront } from 'react-icons/md'
import api, { errorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { Badge, Card, Empty, Kpi, PageHead, Spinner } from '../components/ui'
import { formatDateTime, formatMoney, formatShort, minutesLabel } from '../utils/format'
import { since } from './operacion/common'
import { positionLabel } from '../utils/nav'
import { usePlan } from '../context/PlanContext'
import { CourierHome } from './operacion/DeliveriesPage'

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
// Duración de un turno en vivo (se actualiza cada minuto).
const useNow = (ms = 60000) => { const [n, setN] = useState(Date.now()); useEffect(() => { const t = setInterval(() => setN(Date.now()), ms); return () => clearInterval(t) }, [ms]); return n }
const ProductRow = ({ p, rank, low }) => (
  <li className="mix-row">
    <span className="mix-rank">{rank}</span>
    <div className="grow"><strong>{p.emoji} {p.name}</strong><small className="block muted">{p.category} · {formatMoney(p.price)}</small></div>
    <div className="mix-num"><b>{p.qty ? p.qty.toLocaleString('es-CO') : 'Sin ventas'}</b>{p.qty > 0 && <small>{formatMoney(p.revenue)}</small>}</div>
    {low && <Link to={`/promociones?producto=${p.id}&nombre=${encodeURIComponent(p.name)}`} className="btn btn-sm btn-icon" title="Crear una promoción para este producto" aria-label={`Crear promoción para ${p.name}`}><MdLocalOffer /></Link>}
  </li>
)
const ShiftsAndProducts = ({ data }) => {
  const now = useNow()
  const sh = data.shifts
  const mix = data.productMix
  if (!sh && !mix) return null
  return (
    <div className="grid dash-mix">
      <Card title="Turnos de caja" subtitle="Desde que se abre la caja hasta que se cierra" icon={<MdTimer />} actions={<Link to="/reportes?tab=cuadre" className="btn btn-sm"><MdFactCheck /> Cuadre del día</Link>}>
        <div className="stack" style={{ gap: 10 }}>
          {data.sessions.map((x) => (
            <div key={x.id} className="shift-live">
              <span className="dot-live" aria-hidden="true" />
              <div className="grow"><strong>{x.register}</strong> <small className="muted">{x.number}</small><small className="block muted">Abrió {formatDateTime(x.openedAt)}</small></div>
              <b>{minutesLabel(Math.max(0, Math.round((now - new Date(x.openedAt)) / 60000)))}</b>
            </div>
          ))}
          {!data.sessions.length && <small className="muted">No hay turnos abiertos ahora.</small>}
          {sh && sh.closed > 0 && <>
            <div className="usage-kpis">
              <div><span>Turno promedio</span><strong>{minutesLabel(sh.avgMinutes)}</strong><small>{sh.closed} turnos en 30 días</small></div>
              <div><span>Más largo</span><strong>{minutesLabel(sh.maxMinutes)}</strong><small>Más corto {minutesLabel(sh.minMinutes)}</small></div>
            </div>
            <ul className="list">{sh.recent.slice(0, 4).map((r) => (
              <li key={r.id}><span><strong>{r.number}</strong> <small className="muted">{r.register} · {formatDateTime(r.openedAt)}</small></span><small>{minutesLabel(r.minutes)}</small></li>
            ))}</ul>
          </>}
        </div>
      </Card>
      {mix && <>
        <Card title="Lo que más se vende" subtitle={`Últimos ${mix.days} días · por cantidad`} icon={<MdTrendingUp />} actions={<Link to="/reportes?tab=productos" className="btn btn-sm">Ver reporte</Link>}>
          {!mix.top.length ? <Empty icon={<MdTrendingUp />}>Cuando se cobren pedidos verás aquí los productos estrella.</Empty> : (
            <ol className="mix-list">{mix.top.map((p, i) => <ProductRow key={p.id} p={p} rank={i + 1} />)}</ol>
          )}
          {mix.top.length > 0 && <small className="hint">💡 Mantén siempre en stock los primeros y úsalos de gancho en combos.</small>}
        </Card>
        <Card title="Lo que menos se vende" subtitle={mix.unsold ? `${mix.unsold} producto${mix.unsold === 1 ? '' : 's'} de la carta sin ventas en ${mix.days} días` : `Últimos ${mix.days} días · productos de la carta`} icon={<MdTrendingDown />}>
          {!mix.bottom.length ? <Empty icon={<MdTrendingDown />}>Sin productos en la carta todavía.</Empty> : (
            <ol className="mix-list">{mix.bottom.map((p, i) => <ProductRow key={p.id} p={p} rank={i + 1} low />)}</ol>
          )}
          {mix.bottom.length > 0 && <small className="hint">💡 Dales una promoción por horario (happy hour), destácalos en la carta o pídele al mesero que los sugiera. Si siguen sin venderse, considera sacarlos.</small>}
        </Card>
      </>}
    </div>
  )
}
// Tiempos de preparación: de lo que pasa por cocina, bar o barista.
const AREA_LABEL = { cocina: '🍳 Cocina', bar: '🍸 Bar', barista: '☕ Barista' }
const prepLabel = (m) => (m === null || m === undefined ? '—' : m < 1 ? `${Math.max(1, Math.round(m * 60))} s` : minutesLabel(m))
const PrepRow = ({ p, rank, max, slow }) => (
  <li className="mix-row">
    <span className="mix-rank">{rank}</span>
    <div className="grow">
      <strong>{p.name}</strong>
      <small className="block muted">{AREA_LABEL[p.area] || p.area} · {p.count} {p.count === 1 ? 'vez' : 'veces'}{p.avgPrepMinutes !== null ? ` · preparación ${prepLabel(p.avgPrepMinutes)}` : ''}</small>
      <span className="prep-bar" aria-hidden="true"><span className={slow ? 'slow' : ''} style={{ width: `${Math.max(3, (p.avgMinutes / max) * 100)}%` }} /></span>
    </div>
    <div className="mix-num"><b>{prepLabel(p.avgMinutes)}</b>{p.count > 1 && <small>máx. {prepLabel(p.maxMinutes)}</small>}</div>
  </li>
)
const PrepTimes = ({ t }) => {
  if (!t) return null
  const max = Math.max(1, ...t.slowest.map((p) => p.avgMinutes))
  return (
    <Card title="Tiempos de preparación" subtitle={`Últimos ${t.days} días · desde que se pide hasta que queda listo en cocina, bar o barista`} icon={<MdHourglassTop />}>
      {!t.count ? <Empty icon={<MdHourglassTop />}>Cuando cocina, bar o barista marquen los productos como listos verás aquí cuánto se demora cada uno.</Empty> : (
        <div className="prep-grid">
          <div className="stack" style={{ gap: 12 }}>
            <div className="usage-kpis">
              <div><span>Promedio por producto</span><strong>{prepLabel(t.avgMinutes)}</strong><small>{t.count} preparados · {t.products} productos</small></div>
              <div><span>La mitad sale en menos de</span><strong>{prepLabel(t.medianMinutes)}</strong><small>El más largo tardó {prepLabel(t.maxMinutes)}</small></div>
            </div>
            {(t.avgWaitMinutes !== null || t.avgPrepMinutes !== null) && (
              <div className="usage-kpis">
                <div><span>Espera en cola</span><strong>{prepLabel(t.avgWaitMinutes)}</strong><small>Hasta que lo empiezan</small></div>
                <div><span>Preparación</span><strong>{prepLabel(t.avgPrepMinutes)}</strong><small>Desde que lo empiezan</small></div>
              </div>
            )}
            <div>
              <span className="label-sm">Por área</span>
              <ul className="list">{t.areas.map((a) => (
                <li key={a.area}><span><strong>{AREA_LABEL[a.area] || a.area}</strong> <small className="muted">{a.count} preparados</small></span><b>{prepLabel(a.avgMinutes)}</b></li>
              ))}</ul>
            </div>
          </div>
          <div>
            <span className="label-sm"><MdTrendingUp /> Los más demorados</span>
            <ol className="mix-list">{t.slowest.map((p, i) => <PrepRow key={`s${p.id ?? p.name}`} p={p} rank={i + 1} max={max} slow />)}</ol>
          </div>
          <div>
            <span className="label-sm"><MdTrendingDown /> Los más rápidos</span>
            <ol className="mix-list">{t.fastest.map((p, i) => <PrepRow key={`f${p.id ?? p.name}`} p={p} rank={i + 1} max={max} />)}</ol>
          </div>
        </div>
      )}
      {t.count > 0 && <small className="hint">💡 {t.minCount > 1 ? `Solo se comparan productos preparados al menos ${t.minCount} veces. ` : ''}Si un producto tarda mucho en cola y poco en preparación, falta personal o se pide junto con otros; si tarda en preparación, revisa la receta o deja parte adelantada (mise en place).</small>}
    </Card>
  )
}
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches' }

// Dashboard por rol. Cada etapa le suma indicadores (pedidos, mesas, caja, ventas, stock, llamados).
const Dashboard = () => {
  const { user } = useAuth()
  const { settings } = useSettings()
  const { distributor, has } = usePlan()
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
          {!distributor && <Kpi label="Mesas ocupadas" value={`${k.occupiedTables}/${k.tables}`} icon={MdTableRestaurant} />}
          {!distributor && has('carta_qr') && <Kpi label="Llamados de mesa" value={k.pendingCalls} icon={MdNotificationsActive} tone={k.pendingCalls ? 'warn' : ''} />}
          {has('domicilios') && (distributor || k.deliveriesPending + k.deliveriesOnTheWay > 0) && <Link to="/domicilios" className="kpi-link"><Kpi label="Domicilios por despachar" value={k.deliveriesPending ?? 0} note={`${k.deliveriesOnTheWay ?? 0} en camino`} icon={MdDeliveryDining} tone={k.deliveriesPending ? 'warn' : ''} /></Link>}
          <Kpi label="Cajas abiertas" value={k.openSessions} icon={MdPointOfSale} />
          <Kpi label="Por cobrar" value={formatMoney(k.receivables)} icon={MdRequestQuote} />
          <Kpi label="Stock bajo / agotados" value={`${k.lowStock} / ${k.outOfStock}`} icon={MdWarningAmber} tone={k.outOfStock ? 'bad' : k.lowStock ? 'warn' : ''} />
        </div>
        {data.money && (
          <div className="kpis">
            <Link to="/finanzas?tab=fondos" className="kpi-link"><Kpi label="Dinero en fondos" value={formatMoney(data.money.funds)} icon={MdAccountBalance} note="General y sucursales" /></Link>
            <Link to="/finanzas?tab=gastos" className="kpi-link"><Kpi label="Gastos del mes" value={formatMoney(data.money.expensesMonth)} icon={MdTrendingDown} /></Link>
            <Link to="/caja?tab=solicitudes" className="kpi-link"><Kpi label="Solicitudes de caja" value={data.money.requests.length} icon={MdPanTool} tone={data.money.requests.length ? 'warn' : ''} note={data.money.requests.length ? 'Esperan tu aprobación' : 'Sin pendientes'} /></Link>
            <Link to="/incidentes" className="kpi-link"><Kpi label="Incidentes abiertos" value={data.money.openIncidents} icon={MdReportProblem} tone={data.money.openIncidents ? 'bad' : ''} /></Link>
          </div>
        )}
        {data.money?.requests.length > 0 && (
          <div className="alert warn row-between">
            <span><MdPanTool style={{ verticalAlign: -3 }} /> {data.money.requests.map((r) => `${r.register} pide ${formatMoney(r.amount)} (${r.reason})`).join(' · ')}</span>
            <Link to="/caja?tab=solicitudes" className="btn btn-sm">Revisar</Link>
          </div>
        )}
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
            <div className="row-end" style={{ padding: '0 16px 14px' }}>{distributor ? <Link to="/domicilios" className="btn btn-sm">Domicilios</Link> : <Link to="/mesas" className="btn btn-sm">Mesas</Link>}<Link to="/caja" className="btn btn-sm">Caja</Link></div>
          </Card>
        </div>
        <ShiftsAndProducts data={data} />
        <PrepTimes t={data.prepTimes} />
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
        {data.staffRanking && (
          <Card title="Mejor servicio" subtitle={data.staffRanking.count ? `Calificaciones de los clientes por QR · últimos 30 días · promedio ${data.staffRanking.avg} ★ (${data.staffRanking.count})` : 'Calificaciones de los clientes por QR · últimos 30 días'} icon={<MdStar />}>
            {!data.staffRanking.rows.length ? <Empty icon={<MdStar />}>Cuando los clientes califiquen el servicio desde el QR de su mesa, verás aquí al mejor empleado.</Empty> : (
              <ol className="staff-rank">{data.staffRanking.rows.map((x, i) => (
                <li key={x.id} className={i === 0 ? 'top' : ''}>
                  <span className="pos">{i === 0 ? <MdEmojiEvents /> : i + 1}</span>
                  <span className="who"><strong>{x.name}</strong><small>{x.count} calificaciones · {x.five} de 5 ★</small></span>
                  <span className="stars" aria-label={`${x.avg} de 5 estrellas`}>{'★'.repeat(Math.round(x.avg))}<em>{'★'.repeat(5 - Math.round(x.avg))}</em></span>
                  <b>{String(x.avg).replace('.', ',')}</b>
                </li>
              ))}</ol>
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
        <PageHead title={`${greeting()}, ${user.name}`} subtitle={[data.site, data.positions.map((p) => positionLabel(p, distributor)).join(' · ')].filter(Boolean).join(' · ')} />
        {pos.includes('domiciliario') && <CourierHome />}
        <div className="kpis">
          {sells && <Kpi label="Mis ventas de hoy" value={formatMoney(ek.mySalesToday)} note={`${ek.myOrdersToday} pedidos cobrados`} icon={MdAttachMoney} tone="brand" />}
          {sells && <Kpi label="Mis propinas de hoy" value={formatMoney(ek.myTipsToday)} icon={MdLocalAtm} />}
          {sells && <Kpi label="Mis pedidos abiertos" value={ek.myOpenOrders} icon={MdReceiptLong} tone="dark" />}
          {sells && !distributor && <Kpi label="Llamados de mesa" value={ek.pendingCalls} icon={MdNotificationsActive} tone={ek.pendingCalls ? 'warn' : ''} />}
          {kitchen && <Kpi label="Comandas por empezar" value={ek.kitchenPending} icon={MdSoupKitchen} tone={ek.kitchenPending ? 'warn' : 'brand'} />}
          {kitchen && <Kpi label="En preparación" value={ek.kitchenPreparing} icon={MdSoupKitchen} />}
          <Kpi label="Mis movimientos hoy" value={ek.myActivityToday} icon={MdTimeline} />
        </div>
        <div className="row wrap" style={{ gap: 10 }}>
          {sells && !distributor && <Link to="/mesas" className="btn btn-primary"><MdTableRestaurant /> Ir a las mesas</Link>}
          {sells && distributor && <Link to="/domicilios" className="btn btn-primary"><MdDeliveryDining /> Ir a los domicilios</Link>}
          {sells && distributor && has('clientes') && <Link to="/clientes" className="btn"><MdStorefront /> Clientes</Link>}
          {kitchen && <Link to="/comandas" className="btn btn-primary"><MdSoupKitchen /> Ver comandas</Link>}
          {cashier && <Link to="/caja" className="btn"><MdPointOfSale /> {data.session ? `Caja abierta: ${data.session.register} (${data.session.number})` : 'Abrir caja'}</Link>}
        </div>
        <div className="grid grid-2">
          {sells && (
            <Card title={distributor ? 'Mis pedidos abiertos' : 'Mis mesas y pedidos'} icon={<MdTableRestaurant />} subtitle={data.myTables?.length ? `${data.myTables.length} abiertos` : null} flush>
              {!data.myTables?.length ? <Empty icon={<MdTableRestaurant />}>No tienes pedidos abiertos.</Empty> : (
                <ul className="list padded">{data.myTables.map((t) => (
                  <li key={t.id}>
                    <span><Link to={`/pedidos/${t.id}`}><strong>{t.name}</strong></Link>{t.alias && <small> · {t.alias}</small>} <small>{t.number} · hace {minutesLabel(t.minutes)}{t.guests ? ` · ${t.guests} pers.` : ''}</small></span>
                    <span className="row" style={{ gap: 6 }}>
                      {t.ready > 0 && <Badge tone="ok"><MdCheckCircle /> {t.ready} listo{t.ready === 1 ? '' : 's'}</Badge>}
                      {t.cooking > 0 && <Badge><MdHourglassTop /> {t.cooking}</Badge>}
                      {t.billRequested && <Badge tone="warn">Pide cuenta</Badge>}
                      <b className="money">{formatMoney(t.total)}</b>
                    </span>
                  </li>
                ))}</ul>
              )}
            </Card>
          )}
          {cashier && data.shift && (
            <Card title="Mi turno de caja" icon={<MdPointOfSale />} subtitle={`${data.session.register} · ${data.session.number}`} actions={<Link to="/caja" className="btn btn-sm">Ir a caja</Link>}>
              <dl className="order-totals" style={{ margin: 0 }}>
                <div><dt>Ventas del turno</dt><dd>{formatMoney(data.shift.sales)} <small className="muted">({data.shift.orders})</small></dd></div>
                <div><dt>Propinas</dt><dd>{formatMoney(data.shift.tips)}</dd></div>
                <div><dt><MdShoppingCart /> Gastos del turno</dt><dd>−{formatMoney(data.shift.expenses)}</dd></div>
                <div className="total"><dt>Efectivo esperado</dt><dd>{formatMoney(data.shift.expectedCash)}</dd></div>
              </dl>
              {data.shift.requests.length > 0 && <ul className="list" style={{ marginTop: 10 }}>{data.shift.requests.map((r) => <li key={r.number}><span><MdPanTool /> {r.number}</span><span className="row" style={{ gap: 6 }}><Badge tone={r.status === 'aprobada' ? 'ok' : r.status === 'rechazada' ? 'bad' : 'warn'}>{r.status}</Badge><b className="money">{formatMoney(r.amount)}</b></span></li>)}</ul>}
            </Card>
          )}
          {kitchen && (
            <Card title="Comandas" icon={<MdSoupKitchen />}>
              {!ek.kitchenPending && !ek.kitchenPreparing ? <Empty icon={<MdSoupKitchen />}>Todo al día.</Empty> : (
                <dl className="order-totals" style={{ margin: 0 }}>
                  <div><dt>Por empezar</dt><dd>{ek.kitchenPending}</dd></div>
                  <div><dt>En preparación</dt><dd>{ek.kitchenPreparing}</dd></div>
                  {data.kitchenOldest !== null && data.kitchenOldest !== undefined && <div className="total"><dt>La más antigua espera</dt><dd className={data.kitchenOldest >= 20 ? 'text-bad' : ''}>{minutesLabel(data.kitchenOldest)}</dd></div>}
                </dl>
              )}
            </Card>
          )}
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
