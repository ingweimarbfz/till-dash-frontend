import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MdSearch, MdInventory2, MdSwapVert, MdWarningAmber, MdWarehouse, MdLocalShipping, MdMoveToInbox, MdArrowForward, MdRemoveShoppingCart } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Badge, Card, Empty, Kpi, PageHead, Spinner, useToast } from '../../components/ui'
import { Tabs } from '../../components/forms'
import { formatDateTime, formatMoney } from '../../utils/format'
import { fmtQty, MovementModal, TransferModal, useWarehouses } from './common'
import { notifyStock } from '../../components/StockAlerts'
import { ExpiryTab } from './ExpiryTab'

const ADMIN = ['superadmin', 'admin']

// Bodega elegida dentro de la sucursal del encabezado (vacío = todas).
const WarehouseFilter = ({ warehouses, value, onChange }) => (
  <div className="place-filter">
    <MdWarehouse aria-hidden="true" />
    <select aria-label="Bodega" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Todas las bodegas</option>
      {(warehouses || []).map((w) => <option key={w.id} value={w.id}>{w.name}{w.isMain ? ' (principal)' : w.site ? ` · ${w.site}` : ''}</option>)}
    </select>
  </div>
)
const placeParams = (bodega) => (bodega ? { bodega, sede: undefined } : {})

// ---------------------------------------------------------------- Resumen
const SummaryTab = ({ bodega, warehouses, go }) => {
  const [s, setS] = useState(null)
  const [low, setLow] = useState(null)
  useEffect(() => {
    setS(null)
    api.get('/inventario/resumen', { params: placeParams(bodega) }).then(({ data }) => setS(data)).catch(() => setS({}))
    api.get('/inventario/alertas', { params: placeParams(bodega) }).then(({ data }) => setLow(data)).catch(() => setLow([]))
  }, [bodega])
  const whs = (warehouses || []).filter((w) => !bodega || w.id === Number(bodega))
  if (!s) return <div className="splash" style={{ minHeight: 200 }}><Spinner /></div>
  return (
    <>
      <div className="kpis">
        <Kpi label="Productos activos" value={s.products ?? 0} note={`${s.withStock ?? 0} con existencias`} icon={MdInventory2} />
        <Kpi label="Valor al costo" value={formatMoney(s.costValue)} tone="dark" />
        <Kpi label="Valor de venta" value={formatMoney(s.saleValue)} tone="brand" note={s.saleValue ? `Margen ${formatMoney(s.saleValue - s.costValue)}` : null} />
        <Kpi label="Stock bajo" value={s.lowStock ?? 0} tone={s.lowStock ? 'warn' : ''} icon={MdWarningAmber} />
        <Kpi label="Agotados" value={s.outOfStock ?? 0} tone={s.outOfStock ? 'bad' : ''} icon={MdRemoveShoppingCart} />
      </div>
      <div className="grid grid-2">
        <Card flush title="Productos con stock bajo o agotados" subtitle="En el mínimo o por debajo, en cada bodega" icon={<MdWarningAmber />}>
          {!low ? <div className="splash" style={{ minHeight: 100 }}><Spinner /></div> : !low.length ? <Empty>Todo el stock está sobre el mínimo.</Empty> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Producto</th><th>Bodega</th><th className="num">Hay</th><th className="num">Mínimo</th></tr></thead>
              <tbody>{low.map((r) => (
                <tr key={`${r.warehouseId}-${r.productId}`}><td><strong>{r.name}</strong></td><td>{r.warehouse.name}<small className="block">{r.warehouse.isMain ? 'Principal' : r.warehouse.site}</small></td>
                  <td className="num"><Badge tone={r.out ? 'bad' : 'warn'}>{fmtQty(r.stock, r.unit)}</Badge></td><td className="num">{fmtQty(r.minStock)}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
        <Card flush title="Bodegas" subtitle={`${whs.length} en el lugar elegido`} icon={<MdWarehouse />}>
          {!whs.length ? <Empty icon={<MdWarehouse />}>Sin bodegas.</Empty> : (
            <ul className="wh-list">
              {whs.map((w) => (
                <li key={w.id}>
                  <span className="icon-bubble dark"><MdWarehouse /></span>
                  <div className="grow"><strong>{w.name}</strong> {w.isMain && <Badge tone="dark">Principal</Badge>} {!w.active && <Badge tone="muted">Inactiva</Badge>}<small>{w.site || 'Todo el establecimiento'} · {w.products} producto{w.products === 1 ? '' : 's'} · {formatMoney(w.saleValue)}</small></div>
                  <button type="button" className="btn btn-ghost btn-icon" aria-label={`Ver existencias de ${w.name}`} title="Ver existencias" onClick={() => go('existencias', String(w.id))}><MdArrowForward /></button>
                </li>
              ))}
            </ul>
          )}
          {(s.byCategory || []).length > 0 && (
            <div className="cat-bars">
              <small className="muted">Valor de venta por categoría</small>
              {s.byCategory.map((c) => <div key={c.name} className="cat-bar"><span>{c.name}</span><i style={{ width: `${Math.max(4, (c.value / s.byCategory[0].value) * 100)}%` }} /><b>{formatMoney(c.value)}</b></div>)}
            </div>
          )}
        </Card>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- Existencias por bodega
const StockTab = ({ bodega }) => {
  const navigate = useNavigate()
  const [rows, setRows] = useState(null)
  const [q, setQ] = useState('')
  const [only, setOnly] = useState('')
  useEffect(() => {
    setRows(null)
    api.get('/inventario/existencias', { params: { ...placeParams(bodega), todos: 1 } }).then(({ data }) => setRows(data)).catch(() => setRows([]))
  }, [bodega])
  const shown = useMemo(() => (rows || []).filter((r) => (only === 'bajo' ? r.low : only === 'con' ? r.stock > 0 : true) && (!q || `${r.name} ${r.sku || ''}`.toLowerCase().includes(q.toLowerCase()))), [rows, q, only])
  const total = shown.reduce((a, r) => ({ cost: a.cost + r.costValue, value: a.value + r.saleValue }), { cost: 0, value: 0 })
  return (
    <Card flush>
      <div className="toolbar">
        <div className="input-icon grow"><MdSearch /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o código" /></div>
        <select value={only} onChange={(e) => setOnly(e.target.value)} aria-label="Mostrar"><option value="">Todo</option><option value="con">Con existencias</option><option value="bajo">Stock bajo o agotado</option></select>
      </div>
      {!rows ? <div className="splash" style={{ minHeight: 160 }}><Spinner /></div>
        : !shown.length ? <Empty icon={<MdInventory2 />}>{rows.length ? 'Ningún producto coincide.' : 'No hay existencias en el lugar elegido. Registra una entrada.'}</Empty> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Producto</th><th>Bodega</th><th className="num">Existencias</th><th className="num hide-sm">Mínimo</th><th className="num hide-sm">Valor costo</th><th className="num hide-sm">Valor venta</th></tr></thead>
            <tbody>{shown.map((r) => (
              <tr key={`${r.warehouseId}-${r.productId}`}>
                <td><button type="button" className="link-btn" onClick={() => navigate(`/productos/${r.productId}`)}><strong>{r.categoryEmoji} {r.name}</strong></button><small className="block">{[r.sku, r.category].filter(Boolean).join(' · ') || '—'}</small></td>
                <td>{r.warehouse} {r.isMain && <Badge tone="dark">Principal</Badge>}<small className="block">{r.site}</small></td>
                <td className="num">{r.low ? <Badge tone={r.stock > 0 ? 'warn' : 'bad'}>{fmtQty(r.stock, r.unit)}</Badge> : <strong>{fmtQty(r.stock, r.unit)}</strong>}</td>
                <td className="num hide-sm">{fmtQty(r.minStock)}</td>
                <td className="num money hide-sm">{formatMoney(r.costValue)}</td>
                <td className="num money hide-sm">{formatMoney(r.saleValue)}</td>
              </tr>
            ))}</tbody>
            <tfoot><tr><td colSpan={4}><strong>Total</strong></td><td className="num money hide-sm"><strong>{formatMoney(total.cost)}</strong></td><td className="num money hide-sm"><strong>{formatMoney(total.value)}</strong></td></tr></tfoot>
          </table></div>
        )}
    </Card>
  )
}

// ---------------------------------------------------------------- Movimientos
const MOVE_TONES = { entrada: 'ok', traslado_entrada: 'ok', traslado_salida: 'dark', venta: 'brand', devolucion: 'brand', ajuste: 'warn', baja: 'bad' }
const MOVE_TYPES = [['', 'Todos los tipos'], ['entrada', 'Entradas'], ['ajuste', 'Ajustes'], ['baja', 'Bajas'], ['traslado_salida', 'Traslados enviados'], ['traslado_entrada', 'Traslados recibidos'], ['venta', 'Ventas'], ['devolucion', 'Devoluciones']]
const MovementsTab = ({ bodega, version }) => {
  const [rows, setRows] = useState(null)
  const [type, setType] = useState('')
  useEffect(() => {
    setRows(null)
    api.get('/inventario/movimientos', { params: { ...placeParams(bodega), tipo: type || undefined } }).then(({ data }) => setRows(data)).catch(() => setRows([]))
  }, [bodega, type, version])
  return (
    <Card flush>
      <div className="toolbar"><select value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo">{MOVE_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      {!rows ? <div className="splash" style={{ minHeight: 160 }}><Spinner /></div>
        : !rows.length ? <Empty icon={<MdSwapVert />}>Sin movimientos en el lugar elegido.</Empty> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th className="hide-sm">Bodega</th><th className="num">Cant.</th><th className="num hide-sm">Quedó</th><th className="hide-md">Detalle</th></tr></thead>
            <tbody>{rows.map((m) => (
              <tr key={m.id}>
                <td><small>{formatDateTime(m.createdAt)}</small></td>
                <td><strong>{m.product?.name}</strong></td>
                <td><Badge tone={MOVE_TONES[m.type]}>{m.typeLabel}</Badge>{m.ref && <small className="block">{m.ref}</small>}</td>
                <td className="hide-sm">{m.warehouse?.name}</td>
                <td className={`num ${m.quantity > 0 ? 'text-ok' : 'text-bad'}`}><strong>{m.quantity > 0 ? '+' : ''}{fmtQty(m.quantity, m.product?.unit)}</strong></td>
                <td className="num hide-sm">{m.stockAfter === null ? '—' : fmtQty(m.stockAfter)}</td>
                <td className="hide-md"><small>{[m.expiresOn && `Vence ${m.expiresOn.split('-').reverse().join('/')}`, m.note, m.user].filter(Boolean).join(' · ') || '—'}</small></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
    </Card>
  )
}

// ---------------------------------------------------------------- Traslados
const TransfersTab = ({ bodega, version }) => {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    setRows(null)
    api.get('/inventario/traslados', { params: placeParams(bodega) }).then(({ data }) => setRows(data)).catch(() => setRows([]))
  }, [bodega, version])
  if (!rows) return <div className="splash" style={{ minHeight: 160 }}><Spinner /></div>
  if (!rows.length) return <Card><Empty icon={<MdLocalShipping />}>Aún no hay traslados. Usa “Traslado” para pasar productos de la bodega principal a una sucursal.</Empty></Card>
  return (
    <Card flush>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Traslado</th><th>De → a</th><th>Productos</th><th className="hide-md">Detalle</th></tr></thead>
        <tbody>{rows.map((t) => (
          <tr key={t.ref}>
            <td><strong>{t.ref}</strong><small className="block">{formatDateTime(t.createdAt)}</small></td>
            <td>{t.from?.name} <MdArrowForward style={{ verticalAlign: -2 }} /> {t.to?.name}</td>
            <td><small>{t.items.map((i) => `${i.product?.name}: ${fmtQty(i.quantity, i.product?.unit)}`).join(' · ')}</small></td>
            <td className="hide-md"><small>{[t.note, t.user].filter(Boolean).join(' · ') || '—'}</small></td>
          </tr>
        ))}</tbody>
      </table></div>
    </Card>
  )
}

// ---------------------------------------------------------------- Página
const TABS = [['resumen', 'Resumen'], ['existencias', 'Existencias'], ['vencimientos', 'Vencimientos'], ['movimientos', 'Movimientos'], ['traslados', 'Traslados']]

const InventoryPage = () => {
  const { user } = useAuth()
  const admin = ADMIN.includes(user.role)
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'resumen'
  const setTab = (t) => setParams({ tab: t }, { replace: true })
  const [bodega, setBodega] = useState('')
  const [products, setProducts] = useState(null)
  const [modal, setModal] = useState(null)
  const [version, setVersion] = useState(0)
  const [toast, toastNode] = useToast()
  const { sites, warehouses, main, reload } = useWarehouses()
  // Bodegas del filtro: las de la sucursal del encabezado (o todas) y siempre la principal.
  const [scoped, setScoped] = useState(null)
  useEffect(() => { api.get('/inventario/bodegas').then(({ data }) => setScoped(data)).catch(() => setScoped([])) }, [version])
  const filterList = useMemo(() => {
    const list = scoped || []
    return main && !list.some((w) => w.id === main.id) ? [main, ...list] : list
  }, [scoped, main])
  const loadProducts = useCallback(() => { api.get('/inventario/productos', { params: { sede: undefined } }).then(({ data }) => setProducts(data)).catch((e) => { setProducts([]); toast(errorMessage(e), 'bad') }) }, [toast])
  useEffect(() => { if (admin) loadProducts() }, [admin, loadProducts])
  const changed = (msg, alerts) => { setModal(null); toast(msg); notifyStock(alerts); loadProducts(); reload(); setVersion((v) => v + 1) }
  const go = (t, b) => { setBodega(b || ''); setTab(t) }

  return (
    <div className="stack">
      <PageHead title="Inventario" subtitle="Existencias de la bodega principal y de las bodegas de cada sucursal, con entradas, ajustes, bajas y traslados.">
        {admin && <>
          <button type="button" className="btn" disabled={!products} onClick={() => setModal('move')}><MdMoveToInbox /> Entrada, ajuste o baja</button>
          <button type="button" className="btn btn-primary" disabled={!products} onClick={() => setModal('transfer')}><MdLocalShipping /> Traslado</button>
        </>}
      </PageHead>
      <div className="inv-bar">
        <Tabs value={tab} onChange={setTab} tabs={TABS} />
        <WarehouseFilter warehouses={filterList} value={bodega} onChange={setBodega} />
      </div>
      {tab === 'resumen' && <SummaryTab key={version} bodega={bodega} warehouses={filterList} go={go} />}
      {tab === 'existencias' && <StockTab key={version} bodega={bodega} />}
      {tab === 'vencimientos' && <ExpiryTab bodega={bodega} admin={admin} version={version}
        onBaja={(r) => setModal({ baja: { type: 'baja', warehouseId: String(r.warehouse.id), productId: r.product.id, lotId: r.id, quantity: r.quantity, note: `Producto vencido (lote del ${r.expiresOn.split('-').reverse().join('/')})` } })} />}
      {tab === 'movimientos' && <MovementsTab bodega={bodega} version={version} />}
      {tab === 'traslados' && <TransfersTab bodega={bodega} version={version} />}

      {modal === 'move' && <MovementModal products={products} sites={sites} warehouses={warehouses} defaults={{ warehouseId: bodega || (main ? String(main.id) : '') }} onClose={() => setModal(null)} onSaved={changed} />}
      {modal?.baja && products && <MovementModal products={products} sites={sites} warehouses={warehouses} defaults={modal.baja} onClose={() => setModal(null)} onSaved={changed} />}
      {modal === 'transfer' && <TransferModal products={products} sites={sites} warehouses={warehouses} defaults={{ fromWarehouseId: bodega || (main ? String(main.id) : '') }} onClose={() => setModal(null)} onSaved={changed} />}
      {toastNode}
    </div>
  )
}

export default InventoryPage
