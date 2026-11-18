import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MdCheckCircle, MdWarningAmber, MdHourglassTop, MdPrint, MdRefresh, MdPointOfSale, MdAccountBalance, MdDownload, MdChevronLeft, MdChevronRight } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { Badge, Card, Empty, Kpi, Spinner } from '../../components/ui'
import { formatDate, formatDateTime, formatMoney, minutesLabel } from '../../utils/format'
import { bogota, shift, download } from '../../utils/range'

const money = (v) => (v === null || v === undefined ? '—' : formatMoney(v))
const timeOf = (d) => (d ? new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }).format(new Date(d)) : '—')

// Cuadre del día: lo que había en la caja general, las bases, lo vendido por forma de pago, los gastos,
// las propinas, el arqueo de cada turno y unas verificaciones para saber si las cuentas cuadran.
const CuadreTab = () => {
  const [day, setDay] = useState(bogota())
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const load = useCallback(() => {
    setLoading(true); setError('')
    api.get('/reportes/cuadre', { params: { fecha: day } }).then(({ data }) => setD(data)).catch((e) => setError(errorMessage(e))).finally(() => setLoading(false))
  }, [day])
  useEffect(() => { load() }, [load])
  const today = bogota()
  const t = d?.totals
  return (
    <div className="stack cuadre">
      <div className="report-filters no-print">
        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
          <button type="button" className="btn btn-icon" aria-label="Día anterior" onClick={() => setDay((x) => shift(x, -1))}><MdChevronLeft /></button>
          <input type="date" value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="Día" />
          <button type="button" className="btn btn-icon" aria-label="Día siguiente" disabled={day >= today} onClick={() => setDay((x) => shift(x, 1))}><MdChevronRight /></button>
          {day !== today && <button type="button" className="btn btn-sm" onClick={() => setDay(today)}>Hoy</button>}
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="btn btn-icon" onClick={load} aria-label="Actualizar" disabled={loading}>{loading ? <Spinner /> : <MdRefresh />}</button>
          {d && <button type="button" className="btn" onClick={() => download(`cuadre-${day}`, [['Turno', 'number'], ['Caja', 'register'], ['Abrió', 'openedAt'], ['Cerró', 'closedAt'], ['Minutos', 'minutes'], ['Base', 'opening'], ['Ventas', 'sales'], ['Efectivo', 'cashSales'], ['Gastos', 'expenses'], ['Propinas', 'tips'], ['Propinas pagadas', 'tipsPaid'], ['Esperado', 'expected'], ['Contado', 'counted'], ['Diferencia', 'difference'], ['A la bóveda', 'toVault'], ['Base siguiente', 'nextFloat']], d.shifts)}><MdDownload /> CSV</button>}
          {d && <button type="button" className="btn" onClick={() => window.print()}><MdPrint /> Imprimir</button>}
        </div>
      </div>
      {error ? <div className="alert bad">{error}</div> : !d ? <div className="splash" style={{ minHeight: 240 }}><Spinner /></div> : (
        <div className={`stack${loading ? ' is-loading' : ''}`}>
          <div className={`cuadre-verdict ${d.balanced ? 'ok' : 'warn'}`}>
            {d.balanced ? <MdCheckCircle /> : <MdWarningAmber />}
            <div>
              <strong>{d.balanced ? 'Las cuentas cuadran' : 'Hay diferencias por revisar'}</strong>
              <small>{formatDate(d.day)}{d.site ? ` · ${d.site}` : ' · todas las sucursales'} · {t.shifts} turno{t.shifts === 1 ? '' : 's'}{t.openShifts ? ` (${t.openShifts} abierto${t.openShifts === 1 ? '' : 's'})` : ''} · generado {formatDateTime(d.generatedAt)}</small>
            </div>
          </div>

          <div className="kpis">
            <Kpi label="Vendido" value={formatMoney(d.sold.net)} note={`${d.sold.orders} pedidos · sin propinas`} tone="brand" icon={MdPointOfSale} />
            <Kpi label="Bases de apertura" value={formatMoney(t.opening)} note={`${t.shifts} turno${t.shifts === 1 ? '' : 's'}`} />
            <Kpi label="Gastos del día" value={formatMoney(t.expenses)} note={`Caja ${formatMoney(t.expensesCash)} · fondos ${formatMoney(t.expensesFunds)}`} />
            <Kpi label="Propinas" value={formatMoney(t.tips)} note={`Pagadas ${formatMoney(t.tipsPaid)}`} />
            <Kpi label="Diferencia de arqueo" value={formatMoney(t.difference)} tone={t.difference === 0 ? '' : t.difference > 0 ? 'warn' : 'bad'} note={`Contado ${formatMoney(t.counted)}`} />
          </div>

          <div className="grid grid-2">
            <Card title="Así se movió el dinero" icon={<MdPointOfSale />}>
              <dl className="order-totals" style={{ margin: 0 }}>
                <div><dt>Bases de apertura (efectivo)</dt><dd>{money(t.opening)}</dd></div>
                {d.byMethod.map((m) => <div key={m.method}><dt>Cobrado en {m.label.toLowerCase()}</dt><dd>{money(m.amount)}</dd></div>)}
                {!d.byMethod.length && <div><dt>Cobros</dt><dd>{money(0)}</dd></div>}
                <div className="total"><dt>Total cobrado</dt><dd>{money(t.sales)}</dd></div>
                {t.income > 0 && <div><dt>Otros ingresos a caja</dt><dd>{money(t.income)}</dd></div>}
                <div><dt>Gastos pagados con la caja</dt><dd>−{money(t.shiftExpenses)}</dd></div>
                <div><dt>Propinas pagadas al personal</dt><dd>−{money(t.tipsPaid)}</dd></div>
                <div className="total"><dt>Efectivo esperado en caja</dt><dd>{money(t.expected)}</dd></div>
                <div><dt>Efectivo contado</dt><dd>{money(t.counted)}</dd></div>
                <div><dt>Pasó a la bóveda</dt><dd>{money(t.toVault)}</dd></div>
                <div><dt>Quedó de base para el siguiente turno</dt><dd>{money(t.nextFloat)}</dd></div>
              </dl>
            </Card>
            <Card title="Lo vendido" subtitle="Pedidos cobrados en el día">
              <dl className="order-totals" style={{ margin: 0 }}>
                <div><dt>Valor de lo pedido</dt><dd>{money(d.sold.gross)}</dd></div>
                {d.sold.courtesies > 0 && <div><dt>Cortesías</dt><dd>−{money(d.sold.courtesies)}</dd></div>}
                {d.sold.discounts > 0 && <div><dt>Descuentos</dt><dd>−{money(d.sold.discounts)}</dd></div>}
                <div className="total"><dt>Venta neta</dt><dd>{money(d.sold.net)}</dd></div>
                <div><dt>Propinas</dt><dd>{money(d.sold.tips)}</dd></div>
                <div className="total"><dt>Total cobrado a clientes</dt><dd>{money(d.sold.charged)}</dd></div>
              </dl>
            </Card>
          </div>

          <Card title="Verificaciones" subtitle="Si algo no cuadra, aquí ves dónde mirar">
            <ul className="cuadre-checks">{d.checks.map((c) => (
              <li key={c.key} className={c.pending ? 'pending' : c.ok ? 'ok' : 'bad'}>
                {c.pending ? <MdHourglassTop /> : c.ok ? <MdCheckCircle /> : <MdWarningAmber />}
                <div><strong>{c.title}</strong><small>{c.detail.replace(/(-?\d+)/g, (n) => formatMoney(Number(n)))}</small>{c.hint && <small className="muted">{c.hint}</small>}</div>
              </li>
            ))}</ul>
          </Card>

          <Card title="Turnos de caja del día" icon={<MdPointOfSale />} flush>
            {!d.shifts.length ? <Empty icon={<MdPointOfSale />}>No hubo turnos de caja este día.</Empty> : (
              <div className="table-wrap"><table className="table">
                <thead><tr><th>Turno</th><th className="hide-sm">Horario</th><th className="num">Base</th><th className="num">Cobrado</th><th className="num hide-md">Gastos</th><th className="num hide-md">Propinas</th><th className="num">Esperado</th><th className="num">Contado</th><th className="num">Diferencia</th></tr></thead>
                <tbody>{d.shifts.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.number}</strong> {s.status === 'abierta' && <Badge tone="ok">Abierto</Badge>}{s.reopened > 0 && <Badge tone="warn">Reabierto</Badge>}<small className="block muted">{s.register}{s.site ? ` · ${s.site}` : ''}</small>
                      <small className="block muted">{s.byMethod.map((m) => `${m.label} ${formatMoney(m.amount)}`).join(' · ') || 'Sin cobros'}</small></td>
                    <td className="hide-sm"><small>{timeOf(s.openedAt)} – {s.closedAt ? timeOf(s.closedAt) : 'abierto'}</small><small className="block muted">{minutesLabel(s.minutes)}</small></td>
                    <td className="num money">{money(s.opening)}</td>
                    <td className="num money">{money(s.sales)}</td>
                    <td className="num money hide-md">{money(s.expenses)}</td>
                    <td className="num money hide-md">{money(s.tips)}<small className="block muted">pagadas {money(s.tipsPaid)}</small></td>
                    <td className="num money">{money(s.expected)}</td>
                    <td className="num money">{money(s.counted)}</td>
                    <td className={`num money ${s.difference < 0 ? 'text-bad' : s.difference > 0 ? 'text-warn' : ''}`}>{money(s.difference)}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </Card>

          <div className="grid grid-2">
            <Card title="Caja general y fondos" subtitle="Saldo al empezar y al terminar el día" icon={<MdAccountBalance />} actions={<Link to="/finanzas?tab=fondos" className="btn btn-sm no-print">Ver fondos</Link>}>
              {!d.funds.length ? <Empty icon={<MdAccountBalance />}>Sin fondos con movimientos.</Empty> : (
                <div className="stack" style={{ gap: 12 }}>{d.funds.map((f) => (
                  <div key={f.id} className="fund-day">
                    <div className="row-between"><strong>{f.name}</strong><small className="muted">Ahora {formatMoney(f.now)}</small></div>
                    <dl className="order-totals" style={{ margin: 0 }}>
                      <div><dt>Al empezar el día</dt><dd>{money(f.start)}</dd></div>
                      {f.movements.map((m) => <div key={m.type}><dt>{m.label}</dt><dd className={m.amount < 0 ? 'text-bad' : ''}>{money(m.amount)}</dd></div>)}
                      <div className="total"><dt>Al terminar el día</dt><dd>{money(f.end)}</dd></div>
                    </dl>
                  </div>
                ))}</div>
              )}
            </Card>
            <Card title="Gastos del día" flush>
              {!d.expenses.length ? <Empty>Sin gastos este día.</Empty> : (
                <ul className="list padded">{d.expenses.map((e) => (
                  <li key={e.id}><span><strong>{e.number}</strong> {e.description}<small className="block muted">{e.source === 'caja' ? 'Con la caja' : e.source === 'fondo' ? 'Con fondos' : 'Otro medio'}{e.supplier ? ` · ${e.supplier}` : ''} · {timeOf(e.createdAt)}</small></span><span className="money">{formatMoney(e.amount)}</span></li>
                ))}</ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

export default CuadreTab
