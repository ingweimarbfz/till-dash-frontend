import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  MdBarChart, MdDownload, MdAttachMoney, MdReceiptLong, MdPeople, MdVolunteerActivism, MdCardGiftcard, MdBlock, MdReportProblem, MdTrendingUp, MdRefresh, MdTimer
} from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { Badge, Card, Empty, Kpi, PageHead, Spinner } from '../../components/ui'
import { Tabs } from '../../components/forms'
import { Bars, Ranking, Share } from '../../components/charts'
import { formatDate, formatDateTime, formatMoney, minutesLabel } from '../../utils/format'

import { bogota, PRESETS, dayLabel, download } from '../../utils/range'
import CuadreTab from './CuadreTab'
import { usePlan } from '../../context/PlanContext'

const ExportBtn = ({ onClick }) => <button type="button" className="btn btn-sm" onClick={onClick}><MdDownload /> Excel</button>
const pct = (v) => (v === null || v === undefined ? '—' : `${String(v).replace('.', ',')} %`)

// ---------- Pestañas ----------
const Summary = ({ r }) => {
  const t = r.totals
  const many = r.byDay.length > 14
  return (
    <div className="stack">
      <div className="kpis">
        <Kpi label="Ventas" value={formatMoney(t.sales)} note={`${t.orders} pedidos · ticket ${formatMoney(t.avgTicket)}`} icon={MdAttachMoney} tone="brand" />
        <Kpi label="Utilidad bruta" value={formatMoney(t.grossMargin)} note={`Costo de lo vendido ${formatMoney(t.cost)}`} icon={MdTrendingUp} tone="dark" />
        <Kpi label="Propinas" value={formatMoney(t.tips)} note={`Pagadas ${formatMoney(t.tipsPaid)}`} />
        <Kpi label="Personas" value={t.guests || '—'} note={t.guests ? `${formatMoney(t.perGuest)} por persona` : 'Solo pedidos en mesa'} />
      </div>
      <div className="kpis">
        <Kpi label="Descuentos" value={formatMoney(t.discounts)} />
        <Kpi label="Cortesías" value={formatMoney(t.courtesies)} />
        <Kpi label="Anulaciones" value={formatMoney(t.voidedValue + t.voidedItemsValue)} note={`${t.voidedOrders} pedidos y ${t.voidedItems} productos`} tone={t.voidedOrders + t.voidedItems ? 'warn' : ''} />
        <Kpi label="Incidentes" value={formatMoney(t.incidentsCost)} note={`${t.incidents} reportados`} tone={t.incidents ? 'bad' : ''} />
      </div>
      <Card title="Ventas por día" icon={<MdBarChart />} subtitle={`${formatDate(r.range.from)} a ${formatDate(r.range.to)}`}>
        {!t.orders ? <Empty icon={<MdBarChart />}>No hubo ventas en este rango.</Empty> : <Bars data={r.byDay.map((d) => ({ label: dayLabel(d.date, many), title: formatDate(d.date), value: d.sales }))} ariaLabel="Ventas por día" />}
      </Card>
      <div className="grid grid-2">
        <Card title="Por forma de pago">{r.byMethod.length ? <Share rows={r.byMethod} value="amount" label="label" /> : <small className="muted">Sin cobros.</small>}</Card>
        <Card title="Por tipo de pedido">{r.byType.length ? <Share rows={r.byType} value="sales" label="label" /> : <small className="muted">Sin pedidos.</small>}</Card>
      </div>
      <div className="grid grid-2">
        <Card title="Horas pico"><Bars data={r.byHour.filter((h) => h.sales > 0 || (h.hour >= 10 && h.hour <= 23)).map((h) => ({ label: h.hour, title: `${h.hour}:00`, value: h.sales }))} height={150} ariaLabel="Ventas por hora" /></Card>
        <Card title="Días de la semana"><Bars data={[1, 2, 3, 4, 5, 6, 0].map((d) => r.byWeekday[d]).map((d) => ({ label: d.label.slice(0, 3), title: d.label, value: d.sales }))} height={150} ariaLabel="Ventas por día de la semana" /></Card>
      </div>
      {r.bySite.length > 1 && <Card title="Por sucursal"><Ranking rows={r.bySite} value="sales" label="site" note={(x) => `${x.orders} pedidos · propinas ${formatMoney(x.tips)}`} /></Card>}
    </div>
  )
}

const Products = ({ r, file }) => (
  <div className="stack">
    <div className="grid grid-2">
      <Card title="Más vendidos (por ventas)"><Ranking rows={r.products} value="revenue" label="name" note={(p) => `${p.qty} vendidos${p.courtesyQty ? ` · ${p.courtesyQty} de cortesía` : ''}`} /></Card>
      <Card title="Por categoría"><Ranking rows={r.categories} value="revenue" label="name" note={(c) => `${c.qty} unidades · margen ${formatMoney(c.margin)}`} /></Card>
    </div>
    <Card title="Detalle de productos" flush actions={<ExportBtn onClick={() => download(`productos-${file}`, [['Producto', 'name'], ['Categoría', 'category'], ['Cantidad', 'qty'], ['Cortesías', 'courtesyQty'], ['Pedidos', 'orders'], ['Ventas', 'revenue'], ['Costo', 'cost'], ['Margen', 'margin'], ['Margen %', 'marginPct']], r.products)} />}>
      {!r.products.length ? <Empty>No se vendieron productos en este rango.</Empty> : (
        <div className="table-wrap"><table className="table hover">
          <thead><tr><th>Producto</th><th className="hide-sm">Categoría</th><th className="num">Cant.</th><th className="num">Ventas</th><th className="num hide-sm">Costo</th><th className="num">Margen</th></tr></thead>
          <tbody>{r.products.map((p) => (
            <tr key={p.productId || p.name}>
              <td>{p.productId ? <Link to={`/productos/${p.productId}`}>{p.name}</Link> : p.name}{p.courtesyQty > 0 && <small className="block muted">🎁 {p.courtesyQty} de cortesía</small>}</td>
              <td className="hide-sm">{p.emoji} {p.category}</td><td className="num">{p.qty}</td><td className="num money">{formatMoney(p.revenue)}</td>
              <td className="num money hide-sm">{formatMoney(p.cost)}</td><td className="num money">{formatMoney(p.margin)} <small className="muted block">{pct(p.marginPct)}</small></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </Card>
  </div>
)

const Waiters = ({ r, file }) => (
  <div className="stack">
    <Card title="Ventas por mesero" icon={<MdPeople />}><Ranking rows={r.waiters} value="sales" label="name" note={(w) => `${w.orders} pedidos · ticket ${formatMoney(w.avgTicket)} · ${pct(w.share)} de las ventas`} /></Card>
    <Card title="Detalle" flush actions={<ExportBtn onClick={() => download(`meseros-${file}`, [['Mesero', 'name'], ['Pedidos', 'orders'], ['Ventas', 'sales'], ['Ticket promedio', 'avgTicket'], ['Personas', 'guests'], ['Propinas generadas', 'tipsGenerated'], ['Propinas recibidas', 'tipsReceived'], ['Cortesías', 'courtesies'], ['Productos anulados', 'voids']], r.waiters)} />}>
      {!r.waiters.length ? <Empty>Sin ventas en este rango.</Empty> : (
        <div className="table-wrap"><table className="table hover">
          <thead><tr><th>Mesero</th><th className="num">Pedidos</th><th className="num">Ventas</th><th className="num hide-sm">Ticket</th><th className="num">Propinas generadas</th><th className="num">Recibidas</th><th className="num hide-md">Cortesías</th><th className="num hide-md">Anulados</th></tr></thead>
          <tbody>{r.waiters.map((w) => (
            <tr key={w.userId}><td><strong>{w.name}</strong></td><td className="num">{w.orders}</td><td className="num money">{formatMoney(w.sales)}</td><td className="num money hide-sm">{formatMoney(w.avgTicket)}</td>
              <td className="num money">{formatMoney(w.tipsGenerated)}</td><td className="num money">{formatMoney(w.tipsReceived)}</td><td className="num money hide-md">{formatMoney(w.courtesies)}</td><td className="num hide-md">{w.voids}</td></tr>
          ))}</tbody>
        </table></div>
      )}
    </Card>
  </div>
)

const Tips = ({ r, file }) => (
  <div className="stack">
    <div className="kpis">
      <Kpi label="Propinas de los clientes" value={formatMoney(r.tips.generated)} icon={MdVolunteerActivism} tone="brand" />
      <Kpi label="Pagadas a empleados" value={formatMoney(r.tips.paid)} note="En los cierres de caja" />
      <Kpi label="Sin repartir" value={formatMoney(r.tips.pending)} tone={r.tips.pending > 0 ? 'warn' : ''} note={r.tips.pending < 0 ? 'Se pagó más de lo recibido' : ''} />
    </div>
    <div className="grid grid-2">
      <Card title="Reparto por empleado">{r.tips.byEmployee.length ? <Ranking rows={r.tips.byEmployee} value="amount" label="name" note={(x) => `${x.times} pago${x.times === 1 ? '' : 's'}`} /> : <Empty>Aún no se han repartido propinas en los cierres de caja.</Empty>}</Card>
      <Card title="Pagos" flush actions={<ExportBtn onClick={() => download(`propinas-${file}`, [['Fecha', (x) => formatDateTime(x.at)], ['Empleado', 'name'], ['Turno', 'session'], ['Valor', 'amount']], r.tips.payouts)} />}>
        {!r.tips.payouts.length ? <Empty>Sin pagos.</Empty> : <ul className="list padded">{r.tips.payouts.map((t) => <li key={t.id}><span><strong>{t.name}</strong> <small>{t.session} · {formatDateTime(t.at)}</small></span><span className="money">{formatMoney(t.amount)}</span></li>)}</ul>}
      </Card>
    </div>
  </div>
)

const Losses = ({ r, file }) => (
  <div className="stack">
    <div className="grid grid-2">
      <Card title="Descuentos" icon={<MdAttachMoney />}>{r.discounts.length ? <Ranking rows={r.discounts} value="amount" label="name" note={(d) => `${d.orders} pedidos`} /> : <small className="muted">Sin descuentos.</small>}</Card>
      <Card title="Incidentes" icon={<MdReportProblem />} actions={<Link to="/incidentes" className="btn btn-sm btn-ghost">Ver todos</Link>}>{r.incidents.byType.length ? <Ranking rows={r.incidents.byType} value="cost" label="label" note={(i) => `${i.count} reportados`} /> : <small className="muted">Sin incidentes.</small>}</Card>
    </div>
    <Card title={`Cortesías (${r.courtesies.length})`} icon={<MdCardGiftcard />} flush actions={r.courtesies.length > 0 && <ExportBtn onClick={() => download(`cortesias-${file}`, [['Fecha', (x) => formatDateTime(x.at)], ['Pedido', 'order'], ['Producto', 'name'], ['Cantidad', 'quantity'], ['Valor', 'value'], ['Motivo', 'reason'], ['Autorizó', 'by']], r.courtesies)} />}>
      {!r.courtesies.length ? <Empty>Sin cortesías.</Empty> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Pedido</th><th>Producto</th><th className="hide-sm">Motivo</th><th className="hide-md">Autorizó</th><th className="num">Valor</th></tr></thead>
          <tbody>{r.courtesies.map((c) => <tr key={c.id}><td><Link to={`/pedidos/${c.orderId}`}>{c.order}</Link><small className="block muted">{formatDateTime(c.at)}</small></td><td>{c.quantity} × {c.name}</td><td className="hide-sm">{c.reason}</td><td className="hide-md">{c.by || '—'}</td><td className="num money">{formatMoney(c.value)}</td></tr>)}</tbody>
        </table></div>
      )}
    </Card>
    <Card title={`Anulaciones (${r.voids.orders.length + r.voids.items.length})`} icon={<MdBlock />} flush actions={(r.voids.orders.length + r.voids.items.length) > 0 && <ExportBtn onClick={() => download(`anulaciones-${file}`, [['Fecha', (x) => formatDateTime(x.at)], ['Pedido', (x) => x.order || x.number], ['Qué', (x) => (x.name ? `${x.quantity} × ${x.name}` : 'Pedido completo')], ['Valor', 'value'], ['Motivo', 'reason'], ['Quién', 'by']], [...r.voids.orders, ...r.voids.items])} />}>
      {!(r.voids.orders.length + r.voids.items.length) ? <Empty>Sin anulaciones.</Empty> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Pedido</th><th>Qué se anuló</th><th className="hide-sm">Motivo</th><th className="hide-md">Quién</th><th className="num">Valor</th></tr></thead>
          <tbody>
            {r.voids.orders.map((o) => <tr key={`o${o.id}`}><td>{o.number}<small className="block muted">{formatDateTime(o.at)}</small></td><td><Badge tone="bad">Pedido completo</Badge>{o.table && <small className="muted"> {o.table}</small>}</td><td className="hide-sm">{o.reason}</td><td className="hide-md">{o.by || '—'}</td><td className="num money">{formatMoney(o.value)}</td></tr>)}
            {r.voids.items.map((i) => <tr key={`i${i.id}`}><td><Link to={`/pedidos/${i.orderId}`}>{i.order}</Link><small className="block muted">{formatDateTime(i.at)}</small></td><td>{i.quantity} × {i.name}</td><td className="hide-sm">{i.reason}</td><td className="hide-md">{i.by || '—'}</td><td className="num money">{formatMoney(i.value)}</td></tr>)}
          </tbody>
        </table></div>
      )}
    </Card>
  </div>
)


const Tables = ({ r, file }) => {
  const t = r.tables
  return (
    <div className="stack">
      <div className="kpis">
        <Kpi label="Tiempo promedio en la mesa" value={minutesLabel(t.avgMinutes)} note={`La mitad de las mesas dura menos de ${minutesLabel(t.medianMinutes)}`} icon={MdTimer} tone="brand" />
        <Kpi label="Ocupaciones" value={t.turns} note={`${r.range.days} días`} />
        <Kpi label="Venta por hora de mesa" value={formatMoney(t.perHour)} note="Lo que deja una mesa en cada hora ocupada" tone="dark" />
      </div>
      <div className="grid grid-2">
        <Card title="Mesas que más rinden" subtitle="Venta por cada hora ocupada"><Ranking rows={t.rows} value="perHour" label="name" note={(x) => `${x.area} · ${x.turns} ocupaciones · ${minutesLabel(x.avgMinutes)} en promedio`} limit={8} /></Card>
        <Card title="Por zona" subtitle="Tiempo promedio y rendimiento">{t.areas.length ? <Ranking rows={t.areas} value="perHour" label="area" note={(a) => `${a.turns} ocupaciones · ${minutesLabel(a.avgMinutes)} en promedio · ventas ${formatMoney(a.sales)}`} /> : <small className="muted">Sin datos.</small>}</Card>
      </div>
      <Card title="Detalle por mesa" flush actions={<ExportBtn onClick={() => download(`mesas-${file}`, [['Mesa', 'name'], ['Zona', 'area'], ['Puestos', 'seats'], ['Ocupaciones', 'turns'], ['Minutos promedio', 'avgMinutes'], ['Horas ocupada', 'hours'], ['Personas promedio', 'avgGuests'], ['Ventas', 'sales'], ['Ticket promedio', 'avgTicket'], ['Venta por hora', 'perHour']], t.rows)} />}>
        {!t.rows.length ? <Empty icon={<MdTimer />}>Aún no hay mesas cobradas en este rango.</Empty> : (
          <div className="table-wrap"><table className="table hover">
            <thead><tr><th>Mesa</th><th className="num">Ocupaciones</th><th className="num">Tiempo promedio</th><th className="num hide-sm">Personas</th><th className="num hide-sm">Ticket</th><th className="num">Venta por hora</th></tr></thead>
            <tbody>{t.rows.map((x) => (
              <tr key={x.tableId}><td><strong>{x.name}</strong><small className="block muted">{x.area}{x.seats ? ` · ${x.seats} puestos` : ''}</small></td>
                <td className="num">{x.turns}</td><td className="num">{minutesLabel(x.avgMinutes)}</td><td className="num hide-sm">{x.avgGuests ?? '—'}</td>
                <td className="num money hide-sm">{formatMoney(x.avgTicket)}</td><td className="num money"><strong>{formatMoney(x.perHour)}</strong></td></tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
      <small className="muted">Una mesa ocupada cuenta desde que se abre hasta que se cobra. Las que quedaron abiertas más de 12 horas no entran en el promedio. Úsalo para decidir qué mesas ofrecer en reservas y cuánto tiempo darles.</small>
    </div>
  )
}

// Reportes: un rango de fechas y la sucursal elegida arriba (o todas).
const ReportsPage = () => {
  const { distributor } = usePlan()
  const presets = useMemo(PRESETS, [])
  const [preset, setPreset] = useState('d7')
  const [range, setRange] = useState({ from: presets.d7[1], to: presets.d7[2] })
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') || 'resumen')
  const [r, setR] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const load = useCallback(() => {
    setLoading(true); setError('')
    api.get('/reportes', { params: { desde: range.from, hasta: range.to } }).then(({ data }) => setR(data)).catch((e) => setError(errorMessage(e))).finally(() => setLoading(false))
  }, [range])
  useEffect(() => { if (tab !== 'cuadre') load() }, [load, tab === 'cuadre']) // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (k) => { setPreset(k); setRange({ from: presets[k][1], to: presets[k][2] }) }
  const file = `${range.from}_a_${range.to}`
  return (
    <div className="stack">
      <PageHead title="Reportes" subtitle={r ? `${r.site || 'Todas las sucursales'} · ${formatDate(r.range.from)} a ${formatDate(r.range.to)}` : 'Ventas, productos, meseros y propinas'}>
        {tab !== 'cuadre' && <button type="button" className="btn btn-icon" onClick={load} aria-label="Actualizar" title="Actualizar" disabled={loading}>{loading ? <Spinner /> : <MdRefresh />}</button>}
        {r && tab !== 'cuadre' && <button type="button" className="btn" onClick={() => download(`ventas-por-dia-${file}`, [['Fecha', 'date'], ['Pedidos', 'orders'], ['Personas', 'guests'], ['Ventas', 'sales'], ['Propinas', 'tips']], r.byDay)}><MdDownload /> Ventas por día</button>}
      </PageHead>
      {tab !== 'cuadre' && <div className="report-filters">
        <div className="chip-list">{Object.entries(presets).map(([k, p]) => <button key={k} type="button" className={`pchip${preset === k ? ' on' : ''}`} onClick={() => pick(k)}>{p[0]}</button>)}</div>
        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
          <input type="date" value={range.from} max={range.to} onChange={(e) => { setPreset(''); setRange((x) => ({ ...x, from: e.target.value })) }} aria-label="Desde" />
          <span className="muted">a</span>
          <input type="date" value={range.to} min={range.from} max={bogota()} onChange={(e) => { setPreset(''); setRange((x) => ({ ...x, to: e.target.value })) }} aria-label="Hasta" />
        </div>
      </div>}
      <Tabs value={tab} onChange={setTab} tabs={[['resumen', 'Resumen'], ['cuadre', 'Cuadre del día'], ['productos', 'Productos'], ['meseros', distributor ? 'Vendedores' : 'Meseros'], ...(distributor ? [] : [['mesas', 'Mesas']]), ['propinas', 'Propinas'], ['perdidas', 'Cortesías y anulaciones']]} />
      {tab === 'cuadre' ? <CuadreTab /> : error ? <div className="alert bad">{error}</div> : !r ? <div className="splash" style={{ minHeight: 240 }}><Spinner /></div> : (
        <div className={loading ? 'is-loading' : ''}>
          {tab === 'resumen' && <Summary r={r} />}
          {tab === 'productos' && <Products r={r} file={file} />}
          {tab === 'meseros' && <Waiters r={r} file={file} />}
          {tab === 'mesas' && !distributor && <Tables r={r} file={file} />}
          {tab === 'propinas' && <Tips r={r} file={file} />}
          {tab === 'perdidas' && <Losses r={r} file={file} />}
        </div>
      )}
      <small className="muted"><MdReceiptLong style={{ verticalAlign: -2 }} /> Las ventas no incluyen propinas. La utilidad bruta usa el costo actual de cada producto.</small>
    </div>
  )
}

export default ReportsPage
