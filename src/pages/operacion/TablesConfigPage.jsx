import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MdAdd, MdEdit, MdQrCode2, MdTableRestaurant, MdPeople, MdArrowForward } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Badge, Card, Empty, Field, Modal, PageHead, Spinner, useToast } from '../../components/ui'
import { ADMIN } from './common'
import { QrModal } from './tableModals'

const SHAPE = { cuadrada: 'Cuadrada', redonda: 'Redonda', barra: 'Barra' }

// ---------- Configuración de zonas y mesas (administrador) ----------
const AreaForm = ({ initial, siteId, onClose, onSaved }) => {
  const [name, setName] = useState(initial?.name || '')
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0)
  const [active, setActive] = useState(initial?.active ?? true)
  const [error, setError] = useState('')
  const submit = async (e) => {
    e.preventDefault(); setError('')
    try {
      initial?.id ? await api.put(`/mesas/zonas/${initial.id}`, { name, sortOrder, active }) : await api.post('/mesas/zonas', { name, sortOrder, siteId })
      onSaved()
    } catch (err) { setError(errorMessage(err)) }
  }
  return (
    <Modal title={initial?.id ? 'Editar zona' : 'Nueva zona'} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="area-form" className="btn btn-primary">Guardar</button></>}>
      <form id="area-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="Nombre" htmlFor="an" required><input id="an" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Salón, Terraza, Segundo piso" autoFocus /></Field>
        <Field label="Orden" htmlFor="ao"><input id="ao" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} /></Field>
        {initial?.id && <label className="check span-2"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Activa</label>}
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>
  )
}

const TableForm = ({ initial, defaultArea, areas, siteId, onClose, onSaved }) => {
  const editing = Boolean(initial?.id)
  const [bulk, setBulk] = useState(!editing)
  const [f, setF] = useState({ name: '', count: '10', prefix: 'Mesa', seats: '4', shape: 'cuadrada', areaId: defaultArea ? String(defaultArea) : areas[0]?.id ? String(areas[0].id) : '', active: true, ...(initial ? { ...initial, seats: String(initial.seats), areaId: initial.areaId ? String(initial.areaId) : '' } : {}) })
  const [error, setError] = useState('')
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const submit = async (e) => {
    e.preventDefault(); setError('')
    try {
      if (editing) await api.put(`/mesas/${f.id}`, f)
      else await api.post('/mesas', bulk ? { ...f, name: undefined, siteId } : { ...f, count: undefined, siteId })
      onSaved(editing)
    } catch (err) { setError(errorMessage(err)) }
  }
  return (
    <Modal title={editing ? `Editar ${initial.name}` : 'Agregar mesas'} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="table-form" className="btn btn-primary">Guardar</button></>}>
      <form id="table-form" className="form-grid" onSubmit={submit} noValidate>
        {!editing && <div className="seg span-2"><button type="button" className={`btn btn-sm${bulk ? ' on' : ''}`} onClick={() => setBulk(true)}>Varias a la vez</button><button type="button" className={`btn btn-sm${!bulk ? ' on' : ''}`} onClick={() => setBulk(false)}>Una mesa</button></div>}
        {bulk && !editing ? <>
          <Field label="Cuántas" htmlFor="tc" required><input id="tc" type="number" min="1" max="60" value={f.count} onChange={set('count')} /></Field>
          <Field label="Nombre" htmlFor="tp" hint={`Quedan: ${f.prefix || 'Mesa'} 1, ${f.prefix || 'Mesa'} 2…`}><input id="tp" value={f.prefix} onChange={set('prefix')} /></Field>
        </> : <div className="span-2"><Field label="Nombre o número" htmlFor="tn" required><input id="tn" value={f.name} onChange={set('name')} placeholder="Ej. Mesa 12, Barra 3, VIP 1" autoFocus /></Field></div>}
        <Field label="Puestos" htmlFor="ts"><input id="ts" type="number" min="1" value={f.seats} onChange={set('seats')} /></Field>
        <Field label="Forma" htmlFor="tf"><select id="tf" value={f.shape} onChange={set('shape')}><option value="cuadrada">Cuadrada</option><option value="redonda">Redonda</option><option value="barra">Barra</option></select></Field>
        <div className="span-2"><Field label="Zona" htmlFor="ta"><select id="ta" value={f.areaId} onChange={set('areaId')}><option value="">Sin zona</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field></div>
        {editing && <label className="check span-2"><input type="checkbox" checked={f.active} onChange={set('active')} /> Activa</label>}
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>
  )
}

// Configuración › Mesas y QR: zonas, mesas y el QR de cada una. La operación diaria vive en Mesas.
const TablesConfigPage = () => {
  const { user } = useAuth()
  const admin = ADMIN.includes(user.role)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [toast, toastNode] = useToast()
  const load = useCallback(() => api.get('/mesas', { params: { todas: 1 } }).then(({ data: d }) => { setData(d); setError('') }).catch((e) => setError(errorMessage(e))), [])
  useEffect(() => { load() }, [load])
  if (error && !data) return <Card><Empty icon={<MdTableRestaurant />}>{error}</Empty></Card>
  if (!data) return <div className="splash"><Spinner /></div>
  const groups = [...data.areas.map((a) => ({ key: a.id, area: a, tables: data.tables.filter((t) => t.areaId === a.id) })), { key: 'none', area: null, tables: data.tables.filter((t) => !t.areaId || !data.areas.some((a) => a.id === t.areaId)) }].filter((g) => g.area || g.tables.length)
  return (
    <div className="stack">
      <PageHead title="Mesas y QR" subtitle={`${data.site?.name || ''} · ${data.tables.filter((t) => t.active).length} mesas activas en ${data.areas.filter((a) => a.active).length} zonas`}>
        <Link to="/mesas" className="btn"><MdTableRestaurant /> Ir a Mesas</Link>
        <button type="button" className="btn" onClick={() => setModal({ area: {} })}><MdAdd /> Zona</button>
        <button type="button" className="btn btn-primary" onClick={() => setModal({ table: {} })}><MdAdd /> Mesas</button>
      </PageHead>
      {admin && !user.siteId && <small className="hint">Configuras la sucursal {data.site?.name}. Para otra, elígela arriba en el selector de sucursal.</small>}
      {!data.tables.length && !data.areas.length ? (
        <Card><Empty icon={<MdTableRestaurant />}>Crea primero las zonas (Salón, Terraza, Barra…) y luego agrega las mesas. Cada mesa trae su QR para la carta.
          <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 10 }}><button type="button" className="btn btn-sm" onClick={() => setModal({ area: {} })}><MdAdd /> Zona</button><button type="button" className="btn btn-sm btn-primary" onClick={() => setModal({ table: {} })}><MdAdd /> Mesas</button></div>
        </Empty></Card>
      ) : groups.map((g) => (
        <Card key={g.key} flush title={<>{g.area ? g.area.name : 'Sin zona'} {g.area && !g.area.active && <Badge tone="muted">Inactiva</Badge>}</>} subtitle={`${g.tables.length} mesa${g.tables.length === 1 ? '' : 's'}`}
          actions={g.area && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal({ area: g.area })}><MdEdit /> Editar zona</button>}>
          {!g.tables.length ? <Empty>Esta zona aún no tiene mesas. <button type="button" className="btn btn-sm" onClick={() => setModal({ table: { areaId: g.area?.id } })}><MdAdd /> Agregar</button></Empty> : (
            <div className="table-wrap"><table className="table hover">
              <thead><tr><th>Mesa</th><th className="hide-sm">Puestos</th><th className="hide-sm">Forma</th><th>Estado</th><th className="num">Acciones</th></tr></thead>
              <tbody>{g.tables.map((t) => (
                <tr key={t.id} className={t.active ? '' : 'muted'}>
                  <td><strong>{t.name}</strong></td>
                  <td className="hide-sm"><MdPeople style={{ verticalAlign: -2 }} /> {t.seats}</td>
                  <td className="hide-sm">{SHAPE[t.shape] || t.shape}</td>
                  <td>{!t.active ? <Badge tone="muted">Inactiva</Badge> : t.order ? <Badge tone="brand">En uso</Badge> : <Badge>Libre</Badge>}</td>
                  <td className="num"><div className="row-end" style={{ gap: 4 }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal({ qr: t })}><MdQrCode2 /> QR</button>
                    <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Editar ${t.name}`} onClick={() => setModal({ table: t })}><MdEdit /></button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
      ))}
      <small className="muted">La atención del día (abrir mesas, alias, traslados y cobro) se hace en <Link to="/mesas">Mesas <MdArrowForward style={{ verticalAlign: -2 }} /></Link></small>
      {modal?.area && <AreaForm initial={modal.area.id ? modal.area : null} siteId={data.site?.id} onClose={() => setModal(null)} onSaved={() => { setModal(null); toast('Zona guardada'); load() }} />}
      {modal?.table && <TableForm initial={modal.table.id ? modal.table : null} defaultArea={modal.table.areaId} areas={data.areas} siteId={data.site?.id} onClose={() => setModal(null)} onSaved={(e) => { setModal(null); toast(e ? 'Mesa actualizada' : 'Mesas creadas'); load() }} />}
      {modal?.qr && <QrModal table={modal.qr} admin={admin} onClose={() => setModal(null)} onRegenerated={(t) => { setModal({ qr: { ...modal.qr, qrToken: t.qrToken } }); toast('QR nuevo generado: imprímelo y cámbialo en la mesa'); load() }} />}
      {toastNode}
    </div>
  )
}

export default TablesConfigPage
