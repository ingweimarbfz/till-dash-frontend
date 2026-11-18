import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MdReceiptLong, MdSearch, MdShoppingBag, MdDeliveryDining } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { Badge, Card, Empty, PageHead, Spinner } from '../../components/ui'
import { Tabs } from '../../components/forms'
import { formatDateTime, formatMoney } from '../../utils/format'
import { ORDER_STATUS, ORDER_TONE, since } from './common'
import { OpenOrderModal } from './tableModals'
import { usePlan } from '../../context/PlanContext'

const todayBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())

// Pedidos: los abiertos para atender y el historial del día (o la fecha elegida).
const OrdersPage = () => {
  const navigate = useNavigate()
  const { has, distributor } = usePlan()
  const [tab, setTab] = useState('abierto')
  const [date, setDate] = useState(todayBogota())
  const [q, setQ] = useState('')
  const [mine, setMine] = useState(false)
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [params] = useSearchParams()
  const [modal, setModal] = useState(['llevar', 'domicilio'].includes(params.get('nuevo')) ? params.get('nuevo') : null)
  const load = useCallback(() => {
    const params = { estado: tab === 'todos' ? undefined : tab, fecha: tab === 'abierto' ? undefined : date, q: q || undefined, mios: mine ? 1 : undefined }
    api.get('/pedidos', { params }).then(({ data }) => { setRows(data); setError('') }).catch((e) => setError(errorMessage(e)))
  }, [tab, date, q, mine])
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])
  useEffect(() => { if (tab !== 'abierto') return undefined; const t = setInterval(load, 20000); return () => clearInterval(t) }, [load, tab])
  const total = (rows || []).filter((o) => o.status === 'cobrado').reduce((a, o) => a + o.total, 0)
  return (
    <div className="stack">
      <PageHead title="Pedidos" subtitle="Cada pedido lleva su consecutivo por sucursal. Toca uno para agregar productos, cobrarlo o ver el detalle.">
        <button type="button" className={`btn${distributor && !has('domicilios') ? ' btn-primary' : ''}`} onClick={() => setModal('llevar')}><MdShoppingBag /> {distributor ? 'Venta en mostrador' : 'Para llevar'}</button>
        {has('domicilios') && <button type="button" className={`btn${distributor ? ' btn-primary' : ''}`} onClick={() => setModal('domicilio')}><MdDeliveryDining /> Domicilio</button>}
      </PageHead>
      <Tabs value={tab} onChange={setTab} tabs={[['abierto', 'Abiertos'], ['cobrado', 'Cobrados'], ['anulado', 'Anulados'], ['todos', 'Todos']]} />
      <Card flush>
        <div className="toolbar">
          <div className="input-icon grow"><MdSearch /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Número o cliente" aria-label="Buscar pedido" /></div>
          {tab !== 'abierto' && <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Fecha" style={{ maxWidth: 170 }} />}
          <label className="check"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Solo los míos</label>
        </div>
        {error ? <div className="alert bad" style={{ margin: 16 }}>{error}</div> : !rows ? <div className="splash" style={{ minHeight: 160 }}><Spinner /></div> : !rows.length ? (
          <Empty icon={<MdReceiptLong />}>{tab === 'abierto' ? 'No hay pedidos abiertos.' : 'No hay pedidos con ese filtro.'}</Empty>
        ) : (
          <div className="table-wrap"><table className="table hover">
            <thead><tr><th>Pedido</th><th>{distributor ? 'Tipo y cliente' : 'Mesa o tipo'}</th><th className="hide-sm">{distributor ? 'Vendedor' : 'Mesero'}</th><th className="hide-md">Abierto</th><th className="num">Productos</th><th className="num">Total</th><th>Estado</th></tr></thead>
            <tbody>{rows.map((o) => (
              <tr key={o.id} onClick={() => navigate(`/pedidos/${o.id}`)} style={{ cursor: 'pointer' }}>
                <td><strong>{o.number}</strong>{o.site && <small className="block muted">{o.site}</small>}</td>
                <td>{o.table || (distributor && o.type === 'llevar' ? 'Mostrador' : o.typeLabel)}{(o.alias || o.customerName) && <small className="block muted">{[o.alias, o.customerName].filter(Boolean).join(' · ')}</small>}</td>
                <td className="hide-sm">{o.waiter?.name || '—'}</td>
                <td className="hide-md"><small>{o.status === 'abierto' ? since(o.openedAt) : formatDateTime(o.openedAt)}</small></td>
                <td className="num">{o.itemCount}</td>
                <td className="num money"><strong>{formatMoney(o.total)}</strong></td>
                <td><Badge tone={ORDER_TONE[o.status]}>{ORDER_STATUS[o.status]}</Badge>{o.billRequestedAt && o.status === 'abierto' && <Badge tone="warn">Cuenta</Badge>}</td>
              </tr>
            ))}</tbody>
            {tab === 'cobrado' && <tfoot><tr><td colSpan={5}>{rows.length} pedidos cobrados</td><td className="num money"><strong>{formatMoney(total)}</strong></td><td /></tr></tfoot>}
          </table></div>
        )}
      </Card>
      {modal && <OpenOrderModal type={modal} onClose={() => setModal(null)} onOpened={(o) => navigate(`/pedidos/${o.id}`)} />}
    </div>
  )
}

export default OrdersPage
