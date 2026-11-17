import React, { useCallback, useEffect, useState } from 'react'
import { MdMenuBook, MdFilterAltOff, MdChevronLeft, MdChevronRight } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { Badge, Card, Empty, Field, PageHead, Spinner, useToast } from '../../components/ui'
import { formatDateTime } from '../../utils/format'
import { ROLE_LABELS } from '../../utils/nav'

const PAGE = 50
const TONE = { login: '', crear: 'ok', editar: 'brand', eliminar: 'bad', anular: 'bad' }
const EMPTY_FILTERS = { desde: '', hasta: '', usuario: '', entidad: '', accion: '' }
// Muestra el detalle de la acción en texto corto (sin datos pesados).
const detailText = (d) => (d && typeof d === 'object'
  ? Object.entries(d).filter(([, v]) => v !== null && v !== '' && typeof v !== 'object').map(([k, v]) => `${k}: ${v === true ? 'sí' : v === false ? 'no' : v}`).join(' · ')
  : '')

// Bitácora del sistema: quién hizo qué, cuándo y desde dónde, con filtros y paginación.
const LogbookPage = () => {
  const [rows, setRows] = useState(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [options, setOptions] = useState({ entities: [], actions: [] })
  const [users, setUsers] = useState([])
  const [toast, toastNode] = useToast()

  useEffect(() => {
    api.get('/bitacora/filtros').then(({ data }) => setOptions(data)).catch(() => {})
    api.get('/usuarios').then(({ data }) => setUsers(data)).catch(() => {})
  }, [])
  const load = useCallback(() => {
    setRows(null)
    const params = { ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), pagina: page, limit: PAGE }
    api.get('/bitacora', { params })
      .then((r) => { setRows(r.data); setTotal(Number(r.headers['x-total-count'] || r.data.length)) })
      .catch((e) => { setRows([]); toast(errorMessage(e), 'bad') })
  }, [filters, page, toast])
  useEffect(() => { load() }, [load])
  const set = (k) => (e) => { setPage(1); setFilters((f) => ({ ...f, [k]: e.target.value })) }
  const pages = Math.max(1, Math.ceil(total / PAGE))

  return (
    <div className="stack">
      <PageHead title="Bitácora" subtitle="Todo lo que pasa en el sistema: ingresos, cambios de configuración, usuarios, sucursales y, en las próximas etapas, pedidos, caja e inventario." />
      <Card>
        <div className="form-grid five">
          <Field label="Desde" htmlFor="f-d"><input id="f-d" type="date" value={filters.desde} onChange={set('desde')} /></Field>
          <Field label="Hasta" htmlFor="f-h"><input id="f-h" type="date" value={filters.hasta} onChange={set('hasta')} /></Field>
          <Field label="Usuario" htmlFor="f-u"><select id="f-u" value={filters.usuario} onChange={set('usuario')}><option value="">Todos</option>{users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select></Field>
          <Field label="Módulo" htmlFor="f-e"><select id="f-e" value={filters.entidad} onChange={set('entidad')}><option value="">Todos</option>{options.entities.map((e) => <option key={e} value={e}>{e}</option>)}</select></Field>
          <Field label="Acción" htmlFor="f-a"><select id="f-a" value={filters.accion} onChange={set('accion')}><option value="">Todas</option>{options.actions.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}</select></Field>
        </div>
        {Object.values(filters).some(Boolean) && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setPage(1); setFilters(EMPTY_FILTERS) }}><MdFilterAltOff /> Quitar filtros</button>}
      </Card>
      <Card flush>
        {!rows ? <div className="splash" style={{ minHeight: 200 }}><Spinner /></div>
          : !rows.length ? <Empty icon={<MdMenuBook />}>No hay movimientos con ese filtro.</Empty>
            : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Módulo</th><th className="hide-md">Detalle</th><th className="hide-sm">IP</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td><small>{formatDateTime(r.createdAt)}</small></td>
                        <td>{r.user ? <><strong>{r.user.fullName}</strong><br /><small>{ROLE_LABELS[r.user.role] || r.user.username}</small></> : <small>Sistema</small>}</td>
                        <td><Badge tone={TONE[r.action]}>{r.actionLabel}</Badge></td>
                        <td>{r.entity}{r.entityId && <small> #{r.entityId}</small>}</td>
                        <td className="hide-md"><small>{detailText(r.detail)}</small></td>
                        <td className="hide-sm"><small>{r.ip || '—'}</small></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
        <div className="pager">
          <small>{total.toLocaleString('es-CO')} movimientos</small>
          <button type="button" className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior"><MdChevronLeft /></button>
          <small>Página {page} de {pages}</small>
          <button type="button" className="btn btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Página siguiente"><MdChevronRight /></button>
        </div>
      </Card>
      {toastNode}
    </div>
  )
}

export default LogbookPage
