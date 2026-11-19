import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { MdAdd, MdEdit, MdSearch, MdManageAccounts } from 'react-icons/md'
import { useSearchParams } from 'react-router-dom'
import api, { errorMessage, getSiteFilter } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Avatar, Badge, Card, Empty, Field, Modal, PageHead, Spinner, useToast } from '../components/ui'
import { PhotoInput, MoneyInput } from '../components/forms'
import { ROLE_LABELS, POSITIONS, positionLabel } from '../utils/nav'
import { usePlan } from '../context/PlanContext'
import { formatDateTime, formatMoney } from '../utils/format'
import { formErrors } from '../utils/validate'
import { CourierFields, EMPTY_COURIER, courierForm, courierBody, vehicleErrors } from './operacion/courierFields'

const EMPTY = { identification: '', name: '', lastName: '', username: '', email: '', phone: '', kind: 'empleado', alsoAdmin: false, alsoEmployee: false, positions: [], password: '', resetPassword: false, active: true, siteId: '', avatarUrl: null, payMode: 'ninguno', hourRate: '', overtimeRate: '', salary: '', payPeriod: 'quincenal', canManagePay: false, courierPay: 'domicilios', ...EMPTY_COURIER }
const ROLE_TONE = { superadmin: 'dark', admin: 'brand', empleado: 'warn', cliente: '' }

// Tipo de usuario del formulario → perfiles. Un admin puede ser también empleado (p. ej. cajero) y
// un empleado puede tener además el perfil de admin. El cliente no combina perfiles.
const KINDS = [['superadmin', 'Super administrador'], ['admin', 'Administrador'], ['empleado', 'Empleado'], ['cliente', 'Cliente']]
const fromUser = (u) => {
  const all = [u.primaryRole || u.role, ...(u.extraRoles || [])]
  const kind = u.primaryRole || u.role
  return { kind, alsoAdmin: kind === 'empleado' && all.includes('admin'), alsoEmployee: kind !== 'empleado' && all.includes('empleado') }
}
const profilesOf = (f) => {
  if (f.kind === 'cliente') return ['cliente']
  const set = [f.kind]
  if (f.alsoAdmin && f.kind === 'empleado') set.unshift('admin')
  if (f.alsoEmployee && f.kind !== 'empleado') set.push('empleado')
  return set
}

const UserForm = ({ initial, onClose, onSaved }) => {
  const { distributor } = usePlan()
  const { user: me } = useAuth()
  const editing = Boolean(initial?.id)
  const [form, setForm] = useState(editing
    ? { ...EMPTY, ...initial, ...fromUser(initial), siteId: initial.siteId ?? '', password: '', email: initial.email || '', phone: initial.phone || '', positions: initial.positions || [], payMode: initial.payMode || 'ninguno', hourRate: initial.hourRate || '', overtimeRate: initial.overtimeRate || '', salary: initial.salary || '', payPeriod: initial.payPeriod || 'quincenal', canManagePay: initial.role === 'admin' && Boolean(initial.canManagePay), courierPay: initial.courierPay || 'domicilios', ...courierForm(initial) }
    : { ...EMPTY, siteId: getSiteFilter() || '' })
  const [sites, setSites] = useState([])
  useEffect(() => { api.get('/sedes', { params: { activas: 1, sede: undefined } }).then(({ data }) => setSites(data)).catch(() => {}) }, [])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const togglePos = (p) => setForm((f) => ({ ...f, positions: f.positions.includes(p) ? f.positions.filter((x) => x !== p) : [...f.positions, p] }))
  const profiles = profilesOf(form)
  const isEmployee = profiles.includes('empleado')
  const isCourier = isEmployee && form.positions.includes('domiciliario')
  // TD-026: el domiciliario externo solo cobra por domicilios: sin jornada, turno ni nómina.
  const external = isCourier && Boolean(form.courierExternal)
  // Forma de pago y permiso de pagos (TD-021): solo superadmin o admin con el permiso.
  const canPay = Boolean(me.canManagePay)
  const kinds = KINDS.filter(([k]) => k !== 'superadmin' || me.role === 'superadmin')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const errs = formErrors({ identification: ['doc', form.identification, true], name: ['name', form.name, true], lastName: ['name', form.lastName], username: ['username', form.username, true], phone: ['phone', form.phone], email: ['email', form.email] })
    if (isEmployee && !form.positions.length) errs.push('Elige al menos un cargo (vendedor o mesero, cajero, domiciliario…).')
    if (form.password && form.password.length < 8) errs.push('La contraseña debe tener al menos 8 caracteres.')
    if (canPay && isEmployee && !external && form.payMode === 'turno' && !(Number(form.hourRate) > 0)) errs.push('Escribe el valor de la hora para pagarle por turnos.')
    if (canPay && isCourier && !external && form.courierPay === 'jornada' && form.payMode === 'ninguno') errs.push('Al domiciliario por jornada elígele pago por turno o por nómina.')
    if (canPay && isEmployee && !external && form.payMode === 'nomina' && !(Number(form.salary) > 0)) errs.push('Escribe el salario de la quincena o del mes.')
    if (isCourier) errs.push(...vehicleErrors(form))
    if (errs.length) return setError(errs.join(' '))
    setSaving(true)
    try {
      const { kind, alsoAdmin, alsoEmployee, payMode, hourRate, overtimeRate, salary, payPeriod, canManagePay, courierPay, courierFloat, courierExternal, vehicleType, vehicleHasPlate, vehiclePlate, ...rest } = form
      const body = { ...rest, role: profiles[0], profiles, positions: isEmployee ? form.positions : [], ...(isCourier ? courierBody(form) : {}) }
      if (canPay) Object.assign(body, { payMode: isEmployee && !external ? payMode : 'ninguno', hourRate: Number(hourRate) || 0, overtimeRate: Number(overtimeRate) || 0, salary: Number(salary) || 0, payPeriod, courierPay: isCourier && !external ? courierPay : 'domicilios' })
      if (me.role === 'superadmin') body.canManagePay = profiles[0] === 'admin' && canManagePay
      const { data } = editing ? await api.put(`/usuarios/${initial.id}`, body) : await api.post('/usuarios', body)
      onSaved(data, editing)
    } catch (err) {
      setError(errorMessage(err))
    } finally { setSaving(false) }
  }

  return (
    <Modal size="lg" title={editing ? 'Editar usuario' : 'Nuevo usuario'} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="user-form" className="btn btn-primary" disabled={saving}>{saving ? <Spinner /> : null} Guardar</button></>}>
      <form id="user-form" onSubmit={submit} className="form-grid" noValidate>
        <div className="span-2 photo-row">
          <Field label="Foto"><PhotoInput value={form.avatarUrl} capture="user" label="Tomar o subir foto" onChange={(v) => setForm((f) => ({ ...f, avatarUrl: v }))} /></Field>
        </div>
        <Field label="Tipo de usuario" htmlFor="kind" required>
          <select id="kind" value={form.kind} onChange={set('kind')}>
            {kinds.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Sucursal" htmlFor="siteId" hint="Donde trabaja. Los administradores ven todas">
          <select id="siteId" value={form.siteId} onChange={set('siteId')}><option value="">Sin sucursal</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}{s.city ? ` · ${s.city}` : ''}</option>)}</select>
        </Field>
        {form.kind !== 'cliente' && (
          <div className="span-2 profile-checks">
            <span className="profile-checks-title">Otros perfiles de este usuario</span>
            {form.kind === 'empleado'
              ? <label className={`check-card${form.alsoAdmin ? ' on' : ''}`}><input type="checkbox" checked={form.alsoAdmin} onChange={set('alsoAdmin')} /><span><b>También administrador</b><small>Puede entrar como administrador de la operación</small></span></label>
              : <label className={`check-card${form.alsoEmployee ? ' on' : ''}`}><input type="checkbox" checked={form.alsoEmployee} onChange={set('alsoEmployee')} /><span><b>También empleado</b><small>Por ejemplo, el dueño que atiende la caja</small></span></label>}
            {profiles.length > 1 && <small className="hint">Entra con el mismo usuario y contraseña, y al iniciar sesión elige el perfil.</small>}
          </div>
        )}
        {isEmployee && (
          <div className="span-2 profile-checks">
            <span className="profile-checks-title">Cargos <span className="req">*</span></span>
            <div className="chips" style={{ gridColumn: '1 / -1' }}>
              {POSITIONS.map((p) => <button key={p} type="button" className={`btn btn-sm${form.positions.includes(p) ? ' on' : ''}`} onClick={() => togglePos(p)} aria-pressed={form.positions.includes(p)}>{positionLabel(p, distributor)}</button>)}
            </div>
          </div>
        )}
        {isCourier && (
          <div className="span-2 profile-checks">
            <CourierFields form={form} setForm={setForm} idPrefix="uf" />
          </div>
        )}
        {me.role === 'superadmin' && profiles[0] === 'admin' && (
          <label className="check span-2">
            <input type="checkbox" checked={form.canManagePay} onChange={set('canManagePay')} />
            <span>Puede ver y gestionar los pagos al personal<small className="block muted">Forma de pago y valores de cada empleado, turnos, domicilios pendientes y nómina. Las propinas no dependen de este permiso.</small></span>
          </label>
        )}
        {canPay && external && (
          <div className="span-2 profile-checks pay-config">
            <span className="profile-checks-title">¿Cómo se le paga?</span>
            <small className="hint" style={{ gridColumn: '1 / -1' }}>Por ser externo, solo se le paga por domicilios: su parte del valor de cada uno, con el porcentaje de Configuración → Domicilios. No tiene pago por jornada, turno ni nómina.</small>
          </div>
        )}
        {canPay && isEmployee && !external && (
          <div className="span-2 profile-checks pay-config">
            {isCourier && <>
              <span className="profile-checks-title">Como domiciliario, ¿cómo se le paga?</span>
              <div className="seg seg-wrap" style={{ gridColumn: '1 / -1' }}>
                {[['domicilios', 'Por domicilios'], ['jornada', 'Por jornada, como empleado']].map(([k, l]) => (
                  <button key={k} type="button" className={`btn btn-sm${form.courierPay === k ? ' on' : ''}`} onClick={() => setForm((f) => ({ ...f, courierPay: k, payMode: k === 'jornada' && f.payMode === 'ninguno' ? 'turno' : f.payMode }))} aria-pressed={form.courierPay === k}>{l}</button>
                ))}
              </div>
              <small className="hint" style={{ gridColumn: '1 / -1' }}>{form.courierPay === 'jornada' ? 'No recibe parte del valor de los domicilios: ese dinero queda para el negocio. Se le paga por turno o nómina, como abajo.' : 'Recibe su parte del valor de cada domicilio, con el porcentaje de Configuración → Domicilios. Además puede tener pago por turno o nómina.'}</small>
            </>}
            <span className="profile-checks-title">{isCourier ? 'Pago por turno o nómina' : '¿Cómo se le paga?'}</span>
            <div className="seg seg-wrap" style={{ gridColumn: '1 / -1' }}>
              {[['turno', 'Por turno'], ['nomina', 'Nómina'], ['ninguno', 'No se le paga aquí']].map(([k, l]) => (
                <button key={k} type="button" className={`btn btn-sm${form.payMode === k ? ' on' : ''}`} onClick={() => setForm((f) => ({ ...f, payMode: k }))} aria-pressed={form.payMode === k}>{l}</button>
              ))}
            </div>
            {form.payMode === 'turno' && <>
              <Field label="Valor de la hora" htmlFor="hourRate" required hint={`Al cerrar el turno: horas × valor de la hora${Number(form.hourRate) > 0 ? ` (8 h = ${formatMoney(8 * Number(form.hourRate))})` : ''}. También se puede pagar un valor fijo.`}>
                <MoneyInput id="hourRate" value={form.hourRate} onChange={(v) => setForm((f) => ({ ...f, hourRate: v }))} />
              </Field>
              <Field label="Valor de la hora extra" htmlFor="overtimeRate" hint="Si lo dejas vacío, la hora extra se paga como la normal.">
                <MoneyInput id="overtimeRate" value={form.overtimeRate} onChange={(v) => setForm((f) => ({ ...f, overtimeRate: v }))} />
              </Field>
            </>}
            {form.payMode === 'nomina' && <>
              <Field label="Se le paga cada" htmlFor="payPeriod">
                <select id="payPeriod" value={form.payPeriod} onChange={set('payPeriod')}><option value="quincenal">Quincena</option><option value="mensual">Mes</option></select>
              </Field>
              <Field label={form.payPeriod === 'quincenal' ? 'Salario de la quincena' : 'Salario del mes'} htmlFor="salary" required hint="Se paga en Pagos al personal → Nómina al final del periodo.">
                <MoneyInput id="salary" value={form.salary} onChange={(v) => setForm((f) => ({ ...f, salary: v }))} />
              </Field>
            </>}
            {form.payMode === 'ninguno' && <small className="hint" style={{ gridColumn: '1 / -1' }}>Sin pagos de turno ni nómina desde TillDash+ (por ejemplo, un socio). Las propinas y lo de sus domicilios sí se le pagan.</small>}
          </div>
        )}
        <Field label="Identificación" htmlFor="identification" required>
          <input id="identification" minLength={5} maxLength={15} value={form.identification} onChange={set('identification')} inputMode="numeric" placeholder="1065123456" />
        </Field>
        <Field label="Usuario" htmlFor="username" required hint="Con este nombre inicia sesión">
          <input id="username" value={form.username} onChange={set('username')} autoCapitalize="none" placeholder="nombre.apellido" />
        </Field>
        <Field label="Nombres" htmlFor="name" required><input id="name" data-only="letters" value={form.name} onChange={set('name')} /></Field>
        <Field label="Apellidos" htmlFor="lastName"><input id="lastName" data-only="letters" value={form.lastName} onChange={set('lastName')} /></Field>
        <Field label="Celular" htmlFor="phone"><input id="phone" value={form.phone || ''} onChange={set('phone')} inputMode="numeric" maxLength={10} placeholder="3001234567" /></Field>
        <Field label="Correo" htmlFor="email"><input id="email" type="email" value={form.email || ''} onChange={set('email')} placeholder="nombre@correo.com" /></Field>
        <Field label={editing ? 'Nueva contraseña' : 'Contraseña'} htmlFor="password" hint={editing ? 'Déjala vacía para no cambiarla' : 'Si la dejas vacía, es el número de identificación'}>
          <input id="password" type="password" value={form.password} onChange={set('password')} autoComplete="new-password" disabled={form.resetPassword} />
        </Field>
        <div className="hide-sm" />
        {editing && <label className="check span-2"><input type="checkbox" checked={form.resetPassword} onChange={set('resetPassword')} /> Volver la contraseña al número de identificación</label>}
        <label className="check span-2"><input type="checkbox" checked={form.active} onChange={set('active')} /> Usuario activo</label>
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>
  )
}

const UsersPage = () => {
  const { distributor } = usePlan()
  const { user: me } = useAuth()
  const [users, setUsers] = useState(null)
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('')
  const [position, setPosition] = useState('')
  const [editing, setEditing] = useState(null)
  const [toast, toastNode] = useToast()
  const [params, setParams] = useSearchParams()
  // Desde el buscador: ?nuevo=1 abre el formulario y ?id= abre ese usuario.
  useEffect(() => {
    if (params.get('nuevo')) { setEditing({}); setParams({}, { replace: true }) }
    const id = Number(params.get('id'))
    if (id && users) { const u = users.find((x) => x.id === id); if (u) setEditing(u); setParams({}, { replace: true }) }
  }, [params, users, setParams])

  const load = useCallback(() => {
    api.get('/usuarios').then(({ data }) => setUsers(data)).catch((e) => { setUsers([]); toast(errorMessage(e), 'bad') })
  }, [toast])
  useEffect(() => { load() }, [load])

  const shown = useMemo(() => (users || []).filter((u) => (!role || (u.profiles || [u.role]).includes(role)) &&
    (!position || (u.positions || []).includes(position)) &&
    (!query || `${u.fullName} ${u.username} ${u.identification}`.toLowerCase().includes(query.toLowerCase()))), [users, query, role, position])

  const onSaved = (u, wasEditing) => {
    setUsers((list) => (wasEditing ? list.map((x) => (x.id === u.id ? u : x)) : [...list, u]))
    setEditing(null)
    toast(wasEditing ? 'Usuario actualizado' : 'Usuario creado')
  }
  const canEdit = (u) => me.role === 'superadmin' || u.role !== 'superadmin'

  return (
    <div className="stack">
      <PageHead title="Usuarios" subtitle="Administradores, meseros, cajeros, cocina y demás personal con acceso al sistema.">
        <button type="button" className="btn btn-primary" onClick={() => setEditing({})}><MdAdd /> Nuevo usuario</button>
      </PageHead>
      <Card flush>
        <div className="toolbar">
          <div className="input-icon grow"><MdSearch /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, usuario o identificación" /></div>
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filtrar por rol">
            <option value="">Todos los roles</option>
            {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={position} onChange={(e) => setPosition(e.target.value)} aria-label="Filtrar por cargo">
            <option value="">Todos los cargos</option>
            {POSITIONS.map((p) => <option key={p} value={p}>{positionLabel(p, distributor)}</option>)}
          </select>
        </div>
        {!users ? <div className="splash" style={{ minHeight: 200 }}><Spinner /></div>
          : !shown.length ? <Empty icon={<MdManageAccounts />}>No hay usuarios con ese filtro.</Empty>
            : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Usuario</th><th>Perfil y cargos</th><th className="hide-sm">Contacto</th><th className="hide-md">Último ingreso</th><th>Estado</th><th /></tr></thead>
                  <tbody>
                    {shown.map((u) => (
                      <tr key={u.id}>
                        <td><div className="person"><Avatar user={u} size="sm" /><div><strong>{u.fullName}</strong><small>{u.username} · {u.identification}</small></div></div></td>
                        <td>
                          <span className="badges">{(u.profiles || [u.role]).map((r) => <Badge key={r} tone={ROLE_TONE[r]}>{ROLE_LABELS[r]}</Badge>)}</span>
                          {!!u.positions?.length && <><br /><small>{u.positions.map((p) => positionLabel(p, distributor)).join(', ')}</small></>}
                          {u.role === 'admin' && u.canManagePay && <><br /><small className="muted">Gestiona los pagos al personal</small></>}
                          {u.courierPay === 'jornada' && (u.positions || []).includes('domiciliario') && <><br /><small className="muted">Domiciliario por jornada</small></>}
                          {(u.positions || []).includes('domiciliario') && <><br /><small className="muted">{[u.courierExternal ? 'Externo' : null, u.courierFloat === 'propia' ? 'Base propia' : 'Base de la empresa', u.vehicle].filter(Boolean).join(' · ')}</small></>}
                          {u.payMode === 'turno' && <><br /><small className="muted">Por turno · {formatMoney(u.hourRate)} la hora{u.overtimeRate ? ` · ${formatMoney(u.overtimeRate)} la extra` : ''}</small></>}
                          {u.payMode === 'nomina' && <><br /><small className="muted">Nómina {u.payPeriod === 'quincenal' ? 'quincenal' : 'mensual'} · {formatMoney(u.salary)}</small></>}
                          {u.site && <><br /><small>{u.site.name}</small></>}
                        </td>
                        <td className="hide-sm"><small>{u.phone || '—'}<br />{u.email || ''}</small></td>
                        <td className="hide-md"><small>{formatDateTime(u.lastLoginAt)}</small></td>
                        <td>{u.active ? <Badge tone="ok">Activo</Badge> : <Badge tone="muted">Inactivo</Badge>}</td>
                        <td className="right">{canEdit(u) && <button type="button" className="btn btn-ghost btn-icon" onClick={() => setEditing(u)} aria-label={`Editar ${u.fullName}`}><MdEdit /></button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
      </Card>
      {editing && <UserForm initial={editing} onClose={() => setEditing(null)} onSaved={onSaved} />}
      {toastNode}
    </div>
  )
}

export default UsersPage
