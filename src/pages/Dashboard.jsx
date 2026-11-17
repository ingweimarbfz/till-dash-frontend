import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MdPeople, MdBadge, MdPlace, MdWarehouse, MdTimeline, MdTableRestaurant, MdReceiptLong, MdPointOfSale, MdAttachMoney, MdInventory, MdNotificationsActive, MdMenuBook, MdQrCode2 } from 'react-icons/md'
import api, { errorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { Badge, Card, Empty, Kpi, PageHead, Spinner } from '../components/ui'
import { formatDateTime } from '../utils/format'
import { POSITION_LABELS } from '../utils/nav'

const UPCOMING_ICON = { 'Pedidos por atender': MdReceiptLong, 'Mesas abiertas': MdTableRestaurant, 'Caja del turno': MdPointOfSale, 'Ventas del día': MdAttachMoney, 'Stock bajo': MdInventory, 'Llamados de mesa': MdNotificationsActive }
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
          <Kpi label="Usuarios activos" value={k.users} icon={MdPeople} tone="brand" />
          <Kpi label="Empleados" value={k.employees} icon={MdBadge} />
          <Kpi label="Sucursales" value={k.sites} icon={MdPlace} />
          <Kpi label="Bodegas" value={k.warehouses} icon={MdWarehouse} />
          <Kpi label="Movimientos hoy" value={k.activityToday} icon={MdTimeline} tone="dark" />
        </div>
        <div className="grid grid-2-1">
          <Card title="Actividad reciente" icon={<MdMenuBook />} actions={<Link to="/bitacora" className="btn btn-sm">Ver bitácora</Link>} flush>
            {!data.recent.length ? <Empty icon={<MdTimeline />}>Aún no hay actividad.</Empty> : (
              <ul className="list padded">
                {data.recent.map((r) => <li key={r.id}><span><strong>{r.user || 'Sistema'}</strong> <small>{r.action} · {r.entity}</small></span><small>{formatDateTime(r.createdAt)}</small></li>)}
              </ul>
            )}
          </Card>
          <Card title="Muy pronto en tu dashboard" subtitle="Llegan con las próximas etapas.">
            <ul className="list">
              {data.upcoming.map((u) => { const Icon = UPCOMING_ICON[u] || MdTimeline; return <li key={u}><span><Icon /> {u}</span><Badge tone="muted">Pronto</Badge></li> })}
            </ul>
          </Card>
        </div>
      </div>
    )
  }

  if (data.role === 'empleado') {
    return (
      <div className="stack">
        <PageHead title={`${greeting()}, ${user.name}`} subtitle={[data.site, data.positions.map((p) => POSITION_LABELS[p]).join(' · ')].filter(Boolean).join(' · ')} />
        <div className="kpis">
          <Kpi label="Mis movimientos hoy" value={data.kpis.myActivityToday} icon={MdTimeline} tone="brand" />
        </div>
        <Card title="Tu turno" subtitle="Aquí verás tus mesas, los pedidos por atender y los llamados de los clientes cuando se habilite la operación (etapa 3).">
          <Empty icon={<MdTableRestaurant />}>Todavía no hay mesas configuradas.</Empty>
        </Card>
      </div>
    )
  }

  return (
    <div className="stack">
      <PageHead title={`Bienvenido a ${settings.businessName}`} subtitle="Escanea el código QR de tu mesa para ver la carta y hacer tu pedido." />
      <Card><Empty icon={<MdQrCode2 />}>La carta por QR llega en la etapa 3.</Empty></Card>
    </div>
  )
}

export default Dashboard
