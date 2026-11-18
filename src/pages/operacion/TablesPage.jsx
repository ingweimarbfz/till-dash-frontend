import React, { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  MdTableRestaurant, MdPeople, MdShoppingBag, MdSettings, MdCheck, MdRoomService, MdReceipt, MdDeliveryDining, MdLabel, MdSwapHoriz, MdAdd, MdLock, MdLockOpen, MdCleaningServices
} from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Badge, Card, Empty, PageHead, Spinner, useToast } from '../../components/ui'
import { formatMoney } from '../../utils/format'
import { ADMIN, since, TABLE_STATUS, useCan } from './common'
import { AliasModal, MoveModal, OpenOrderModal } from './tableModals'
import { OrderView } from './OrderPage'

export { OpenOrderModal } from './tableModals'

const POLL_MS = 15000
// En pantallas anchas (computador o tablet horizontal) el pedido se abre en un panel al costado de las mesas.
const WIDE = '(min-width: 1200px)'
const useWide = () => {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(WIDE).matches)
  useEffect(() => { const m = window.matchMedia?.(WIDE); if (!m) return undefined; const on = () => setWide(m.matches); m.addEventListener('change', on); return () => m.removeEventListener('change', on) }, [])
  return wide
}

// ---------- Tarjeta de mesa ----------
// Libre: toca para abrirla. Ocupada: toca para entrar al pedido; abajo, alias y traslado.
const TableCard = ({ t, seller, cashOpen, selected, onOpen, onAlias, onMove, onAttend }) => (
  <div className={`tbl tbl-${t.status}${t.calls.length ? ' calling' : ''}${!cashOpen && !t.order ? ' locked' : ''}${selected ? ' selected' : ''}`}>
    <button type="button" className="tbl-main" onClick={() => onOpen(t)} aria-label={`${t.name}: ${TABLE_STATUS[t.status]}${t.order?.alias ? `, ${t.order.alias}` : ''}`}>
      <span className="tbl-head"><strong>{t.name}</strong><small><MdPeople /> {t.order?.guests || t.seats}</small></span>
      {t.order?.alias && <span className="tbl-alias"><MdLabel /> {t.order.alias}</span>}
      {t.order ? <>
        <span className="tbl-total">{formatMoney(t.order.total)}</span>
        <small className="tbl-meta">{t.order.number} · {since(t.order.openedAt)}</small>
        <small className="tbl-meta">{t.order.waiter}{t.order.ready ? <b className="tbl-ready"> · {t.order.ready} listo{t.order.ready === 1 ? '' : 's'}</b> : ''}</small>
      </> : t.releasePending ? <>
        <small className="tbl-meta">Cobrada {since(t.releasePending.since)}</small>
        <span className="tbl-release"><MdCleaningServices /> Liberar mesa</span>
      </> : <span className="tbl-free">{cashOpen ? <><MdAdd /> Abrir mesa</> : <><MdLock /> Caja cerrada</>}</span>}
    </button>
    {t.calls.length > 0 && (
      <div className="tbl-calls">{t.calls.map((c) => (
        <button key={c.id} type="button" className="tbl-call" onClick={() => onAttend(c)} title="Marcar como atendido">
          {c.kind === 'cuenta' ? <MdReceipt /> : c.kind === 'pedido' ? <MdShoppingBag /> : <MdRoomService />} {c.kind === 'cuenta' ? 'Cuenta' : c.kind === 'pedido' ? 'Pedido' : 'Llama'} <MdCheck />
        </button>
      ))}</div>
    )}
    {t.order && seller && <div className="tbl-actions">
      <button type="button" className="tbl-act" onClick={() => onAlias(t)} title={t.order.alias ? 'Editar alias' : 'Poner alias'}><MdLabel /> Alias</button>
      <button type="button" className="tbl-act" onClick={() => onMove(t)} title="Trasladar a una mesa libre"><MdSwapHoriz /> Trasladar</button>
    </div>}
  </div>
)

// Salón: mesas por zona con su estado, pedidos de mostrador y llamados de los clientes.
const TablesPage = () => {
  const { user } = useAuth()
  const admin = ADMIN.includes(user.role)
  const can = useCan()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [area, setArea] = useState('all')
  const [modal, setModal] = useState(null)
  const wide = useWide()
  // Panel lateral: { table, orderId } (pedido abierto) o { table, opening: true } (abrir una mesa libre).
  const [sel, setSel] = useState(null)
  const [toast, toastNode] = useToast()
  const load = useCallback(() => api.get('/mesas').then(({ data: d }) => { setData(d); setError('') }).catch((e) => setError(errorMessage(e))), [])
  useEffect(() => { load(); const t = setInterval(load, POLL_MS); const on = () => load(); window.addEventListener('td:calls', on); return () => { clearInterval(t); window.removeEventListener('td:calls', on) } }, [load])
  // Desde el buscador: /mesas?mesa=ID abre esa mesa.
  useEffect(() => {
    const id = Number(params.get('mesa'))
    if (!id || !data) return
    const t = data.tables.find((x) => x.id === id)
    setParams({}, { replace: true })
    if (t) open(t)
  }, [params, data]) // eslint-disable-line react-hooks/exhaustive-deps

  const seller = can('mesero', 'cajero', 'host', 'bartender', 'barista')
  const release = async (t) => {
    try { await api.post(`/mesas/${t.id}/liberar`); toast(`${t.name} quedó libre`); load() } catch (e) { toast(errorMessage(e), 'bad') }
  }
  const open = (t) => {
    if (t.order) return wide ? setSel({ table: t, orderId: t.order.id }) : navigate(`/pedidos/${t.order.id}`)
    if (t.releasePending) return release(t)
    if (!seller) return toast('Tu cargo no abre mesas', 'bad')
    if (!data.cashOpen) return toast('Primero hay que abrir la caja del día', 'bad')
    if (wide) return setSel({ table: t, opening: true })
    setModal({ open: t })
  }
  const openOrder = (orderId) => (wide ? setSel({ orderId }) : navigate(`/pedidos/${orderId}`))
  const opened = (o) => { if (wide) { setSel((x) => ({ table: x?.table, orderId: o.id })); setModal(null); load() } else navigate(`/pedidos/${o.id}`) }
  const attend = async (c) => { try { await api.post(`/llamados/${c.id}/atender`); toast('Llamado atendido'); load() } catch (e) { toast(errorMessage(e), 'bad') } }

  if (error && !data) return <Card><Empty icon={<MdTableRestaurant />}>{error}</Empty></Card>
  if (!data) return <div className="splash"><Spinner /></div>
  const areas = data.areas.filter((a) => a.active)
  const shown = data.tables.filter((t) => area === 'all' || (area === 'none' ? !t.areaId : t.areaId === Number(area)))
  const groups = area === 'all' && areas.length
    ? [...areas.map((a) => ({ key: a.id, title: a.name, area: a, tables: shown.filter((t) => t.areaId === a.id) })), { key: 'none', title: 'Sin zona', tables: shown.filter((t) => !t.areaId || !areas.some((a) => a.id === t.areaId)) }].filter((g) => g.tables.length)
    : [{ key: 'one', tables: shown }]
  const count = (s) => data.tables.filter((t) => t.status === s && t.active !== false).length
  const selectedId = sel?.table?.id ?? (sel?.orderId ? data.tables.find((t) => t.order?.id === sel.orderId)?.id : null)
  const panel = wide && sel
  return (
    <div className={`tables-split${panel ? ' with-panel' : ''}`}>
    <div className="stack tables-main">
      <PageHead title="Mesas" subtitle={`${data.site?.name || ''} · ${count('ocupada') + count('por_cobrar')} ocupadas de ${data.tables.filter((t) => t.active !== false).length}`}>
        <button type="button" className="btn" onClick={() => setModal({ counter: 'llevar' })} disabled={!data.cashOpen}><MdShoppingBag /> Para llevar</button>
        <button type="button" className="btn" onClick={() => setModal({ counter: 'domicilio' })} disabled={!data.cashOpen}><MdDeliveryDining /> Domicilio</button>
        {admin && <Link to="/configuracion/mesas" className="btn btn-icon" title="Configurar mesas y QR" aria-label="Configurar mesas y QR"><MdSettings /></Link>}
      </PageHead>
      {!data.cashOpen && (
        <div className="alert warn cash-gate"><MdLock /><div className="grow"><strong>La caja del día no está abierta.</strong> Mientras tanto no se pueden abrir mesas ni tomar pedidos para llevar o domicilio.</div>
          {can('cajero') ? <Link to="/caja" className="btn btn-sm btn-primary"><MdLockOpen /> Abrir caja</Link> : <small>Pídele al cajero que abra el turno.</small>}
        </div>
      )}
      {admin && !user.siteId && <small className="hint">Ves la sucursal {data.site?.name}. Para otra, elígela arriba en el selector de sucursal.</small>}
      <div className="row-between wrap" style={{ gap: 10 }}>
        <div className="chip-list">
          <button type="button" className={`pchip${area === 'all' ? ' on' : ''}`} onClick={() => setArea('all')}>Todas</button>
          {areas.map((a) => <button key={a.id} type="button" className={`pchip${area === String(a.id) ? ' on' : ''}`} onClick={() => setArea(String(a.id))}>{a.name}</button>)}
        </div>
        <div className="tbl-legend"><span className="lg libre" /> Libre {count('libre')}<span className="lg ocupada" /> Ocupada {count('ocupada')}<span className="lg por_cobrar" /> Cuenta {count('por_cobrar')}{count('por_liberar') > 0 && <><span className="lg por_liberar" /> Por liberar {count('por_liberar')}</>}</div>
      </div>
      {!data.tables.length ? (
        <Card><Empty icon={<MdTableRestaurant />}>{admin ? <>Aún no hay mesas en esta sucursal. Se crean en Configuración › Mesas y QR. <Link to="/configuracion/mesas" className="btn btn-sm btn-primary"><MdSettings /> Configurar mesas</Link></> : 'Aún no hay mesas en tu sucursal. Pide al administrador que las cree.'}</Empty></Card>
      ) : groups.map((g) => (
        <section key={g.key} className="stack" style={{ gap: 10 }}>
          {g.title && <div className="row-between"><h3 className="section-title">{g.title}</h3></div>}
          <div className="tbl-grid">{g.tables.map((t) => <TableCard key={t.id} t={t} seller={seller} cashOpen={data.cashOpen} selected={panel && selectedId === t.id} onOpen={open} onAlias={(x) => setModal({ alias: x })} onMove={(x) => setModal({ move: x })} onAttend={attend} />)}</div>
        </section>
      ))}
      {data.counter.length > 0 && (
        <Card title="Para llevar y domicilios" icon={<MdShoppingBag />} flush>
          <ul className="list padded">{data.counter.map((o) => (
            <li key={o.id} onClick={() => openOrder(o.id)} style={{ cursor: 'pointer' }} className={panel && sel.orderId === o.id ? 'on' : ''}>
              <span><strong>{o.number}</strong> <small>{o.customer || 'Sin nombre'} · {since(o.openedAt)}</small></span><Badge>{formatMoney(o.total)}</Badge>
            </li>
          ))}</ul>
        </Card>
      )}
      {modal?.open && <OpenOrderModal table={modal.open} siteId={data.site?.id} onClose={() => setModal(null)} onOpened={opened} />}
      {modal?.counter && <OpenOrderModal type={modal.counter} siteId={data.site?.id} onClose={() => setModal(null)} onOpened={opened} />}
      {modal?.alias && <AliasModal order={modal.alias.order} tableName={modal.alias.name} onClose={() => setModal(null)} onSaved={(o) => { setModal(null); toast(o.alias ? `Alias: ${o.alias}` : 'Alias quitado'); load() }} />}
      {modal?.move && <MoveModal order={{ ...modal.move.order, siteId: data.site?.id }} fromName={modal.move.name} onClose={() => setModal(null)} onMoved={(o, t) => { setModal(null); toast(`${modal.move.name} pasó a ${t.name}`); load() }} />}
      {toastNode}
    </div>
    {wide && (
      <aside className={`table-panel${sel ? ' on' : ''}`} aria-label="Pedido de la mesa">
        {sel?.orderId ? <OrderView key={sel.orderId} id={sel.orderId} embedded onClose={() => setSel(null)} onChanged={load} />
          : sel?.opening ? <OpenOrderModal key={sel.table.id} inline table={sel.table} siteId={data.site?.id} onClose={() => setSel(null)} onOpened={opened} />
            : <div className="table-panel-empty"><MdTableRestaurant /><strong>Toca una mesa</strong><small>Su pedido aparece aquí: agrega productos, envía la comanda y cobra sin salir del salón.</small></div>}
      </aside>
    )}
    </div>
  )
}

export default TablesPage
