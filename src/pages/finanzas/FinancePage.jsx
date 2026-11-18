import React, { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  MdAccountBalance, MdAdd, MdSwapHoriz, MdTrendingUp, MdTrendingDown, MdAttachMoney, MdPeople, MdRefresh, MdEdit, MdBlock, MdSavings, MdPointOfSale, MdReceiptLong, MdPayments
} from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { Badge, Card, Empty, Kpi, Modal, PageHead, Spinner, Field, useToast } from '../../components/ui'
import { MoneyInput, Tabs } from '../../components/forms'
import { Bars, Ranking, Share } from '../../components/charts'
import { useAuth } from '../../context/AuthContext'
import { formatDate, formatDateTime, formatMoney } from '../../utils/format'
import { bogota, PRESETS, download } from '../../utils/range'
import SupplierField from '../../components/SupplierField'

const NO_SITE = { sede: undefined }
const pct = (v) => (v === null || v === undefined ? '—' : `${String(v).replace('.', ',')} %`)
const signed = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatMoney(Math.abs(v))}`

// ---------- Filtro de fechas ----------
const useRange = (initial = 'mes') => {
  const presets = PRESETS()
  const [preset, setPreset] = useState(initial)
  const [range, setRange] = useState({ from: presets[initial][1], to: presets[initial][2] })
  const node = (
    <div className="report-filters">
      <div className="chip-list">{Object.entries(presets).map(([k, p]) => <button key={k} type="button" className={`pchip${preset === k ? ' on' : ''}`} onClick={() => { setPreset(k); setRange({ from: p[1], to: p[2] }) }}>{p[0]}</button>)}</div>
      <div className="row" style={{ gap: 6, alignItems: 'center' }}>
        <input type="date" value={range.from} max={range.to} onChange={(e) => { setPreset(''); setRange((x) => ({ ...x, from: e.target.value })) }} aria-label="Desde" />
        <span className="muted">a</span>
        <input type="date" value={range.to} min={range.from} max={bogota()} onChange={(e) => { setPreset(''); setRange((x) => ({ ...x, to: e.target.value })) }} aria-label="Hasta" />
      </div>
    </div>
  )
  return [range, node]
}

// ---------- Modales ----------
// Cuentas: el fondo principal (general o de cada sucursal) y sus subcuentas, agrupadas.
const fundLabel = (f) => (f.kind === 'subcuenta' ? `${f.name} (${f.parent})` : f.name)
const principals = (funds) => funds.filter((f) => f.kind !== 'subcuenta')
const FundSelect = ({ id, funds, value, onChange, label = 'Fondo', hint }) => {
  const groups = principals(funds).map((p) => ({ p, subs: funds.filter((x) => x.kind === 'subcuenta' && x.parentKey === p.key && x.active) }))
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {groups.map(({ p, subs }) => (subs.length ? (
          <optgroup key={p.key} label={p.name}>
            {funds.some((x) => x.key === p.key) && <option value={p.key}>{p.name} · cuenta principal · {formatMoney(p.balance)}</option>}
            {subs.map((x) => <option key={x.key} value={x.key}>↳ {x.name} · {formatMoney(x.balance)}</option>)}
          </optgroup>
        ) : <option key={p.key} value={p.key}>{p.name} · {formatMoney(p.balance)}</option>))}
      </select>
    </Field>
  )
}

const EntryModal = ({ funds, partners, initialFund = 'general', kinds, methods, onClose, onDone }) => {
  const [f, setF] = useState({ fund: initialFund, kind: 'capital', partnerId: '', amount: '', method: 'efectivo', receivedOn: bogota(), description: '' })
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v?.target ? v.target.value : v }))
  const submit = async (e) => {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      const { data } = await api.post('/finanzas/ingresos', { ...f, siteId: f.fund === 'general' ? null : Number(f.fund) }, { params: NO_SITE })
      onDone(data)
    } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  const active = partners.filter((p) => p.active)
  return (
    <Modal title="Ingresar dinero" onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="entry-form" className="btn btn-primary" disabled={saving}>{saving ? <Spinner /> : <MdAdd />} Ingresar</button></>}>
      <form id="entry-form" className="form-grid" onSubmit={submit} noValidate>
        <div className="span-2"><FundSelect id="ef" funds={funds} value={f.fund} onChange={set('fund')} label="¿A qué fondo entra?" hint="General: el dinero del negocio. Sucursal: de ahí sale la base para abrir sus cajas." /></div>
        <div className="span-2 chip-list">{Object.entries(kinds).map(([k, l]) => <button key={k} type="button" className={`pchip${f.kind === k ? ' on' : ''}`} onClick={() => set('kind')(k)}>{l}</button>)}</div>
        {f.kind === 'aporte_socio' && (
          <div className="span-2"><Field label="Socio" htmlFor="ep" required hint={active.length ? null : 'Primero crea los socios en la pestaña Socios.'}>
            <select id="ep" value={f.partnerId} onChange={set('partnerId')}><option value="">Elige el socio</option>{active.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </Field></div>
        )}
        <Field label="Valor" htmlFor="ea" required><MoneyInput id="ea" value={f.amount} onChange={set('amount')} autoFocus /></Field>
        <Field label="Forma" htmlFor="em"><select id="em" value={f.method} onChange={set('method')}>{Object.entries(methods).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Fecha" htmlFor="ed"><input id="ed" type="date" value={f.receivedOn} max={bogota()} onChange={set('receivedOn')} /></Field>
        <Field label="Concepto" htmlFor="ec"><input id="ec" value={f.description} onChange={set('description')} placeholder="Ej. base para la semana" /></Field>
        {f.kind === 'otro_ingreso' && <small className="muted span-2">Los otros ingresos (eventos, arriendo de espacio, patrocinios) suman a la utilidad. Aportes, capital y préstamos no.</small>}
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>
  )
}

const TransferModal = ({ funds, initial = {}, onClose, onDone }) => {
  const [f, setF] = useState({ from: initial.from || 'general', to: initial.to || funds.find((x) => x.key !== (initial.from || 'general') && x.active !== false)?.key || '', amount: '', note: '' })
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v?.target ? v.target.value : v }))
  const src = funds.find((x) => x.key === f.from)
  const submit = async (e) => {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      await api.post('/finanzas/traslados', { from: f.from, to: f.to, amount: f.amount, note: f.note }, { params: NO_SITE })
      onDone()
    } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  return (
    <Modal title="Trasladar dinero" onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="tr-form" className="btn btn-primary" disabled={saving}>{saving ? <Spinner /> : <MdSwapHoriz />} Trasladar</button></>}>
      <form id="tr-form" className="form-grid" onSubmit={submit} noValidate>
        <FundSelect id="tf" funds={funds} value={f.from} onChange={set('from')} label="Sale de" />
        <FundSelect id="tt" funds={funds.filter((x) => x.key !== f.from && x.active !== false)} value={f.to} onChange={set('to')} label="Entra a" />
        <Field label="Valor" htmlFor="ta" required hint={src ? `Disponible ${formatMoney(src.balance)}` : null}><MoneyInput id="ta" value={f.amount} onChange={set('amount')} autoFocus /></Field>
        <Field label="Nota" htmlFor="tn"><input id="tn" value={f.note} onChange={set('note')} placeholder="Ej. base del fin de semana" /></Field>
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>
  )
}

const ExpenseModal = ({ funds, partners, categories, sources, initial = {}, onClose, onDone }) => {
  const [f, setF] = useState({ category: '', description: '', supplierId: null, supplier: '', invoiceRef: '', amount: '', paidOn: bogota(), source: 'fondo', fund: 'general', sessionId: '', partnerId: '', ...initial })
  const sub = funds.find((x) => x.key === f.fund && x.kind === 'subcuenta')
  const [sessions, setSessions] = useState([])
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v?.target ? v.target.value : v }))
  useEffect(() => { api.get('/caja/turnos', { params: { estado: 'abierta', ...NO_SITE } }).then(({ data }) => setSessions(data)).catch(() => setSessions([])) }, [])
  const submit = async (e) => {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      const { data } = await api.post('/finanzas/gastos', { ...f, siteId: f.fund === 'general' || sub ? null : Number(f.fund) }, { params: NO_SITE })
      onDone(data)
    } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  return (
    <Modal title="Registrar gasto" size="lg" onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="exp-form" className="btn btn-primary" disabled={saving}>{saving ? <Spinner /> : <MdAdd />} Registrar</button></>}>
      <form id="exp-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="Categoría" htmlFor="xc" required><select id="xc" value={f.category} onChange={set('category')} autoFocus><option value="">Elige la categoría</option>{Object.entries(categories).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Valor" htmlFor="xa" required><MoneyInput id="xa" value={f.amount} onChange={set('amount')} /></Field>
        <div className="span-2"><Field label="Descripción" htmlFor="xd" required><input id="xd" value={f.description} onChange={set('description')} placeholder="Ej. arriendo de noviembre, recibo de energía" /></Field></div>
        <SupplierField id="xs" value={f} onChange={(v) => setF((x) => ({ ...x, ...v }))} allowFree />
        <Field label="Factura o soporte" htmlFor="xi"><input id="xi" value={f.invoiceRef} onChange={set('invoiceRef')} placeholder="N.º de factura" /></Field>
        <Field label="Fecha de pago" htmlFor="xp"><input id="xp" type="date" value={f.paidOn} max={bogota()} onChange={set('paidOn')} /></Field>
        <div />
        <div className="span-2">
          <span className="label-sm">¿Con qué se pagó?</span>
          <div className="chip-list" style={{ marginTop: 6 }}>{Object.entries(sources).map(([k, l]) => <button key={k} type="button" className={`pchip${f.source === k ? ' on' : ''}`} onClick={() => set('source')(k)}>{l}</button>)}</div>
        </div>
        {(f.source === 'fondo' || f.source === 'banco' || f.source === 'socio') && (
          <FundSelect id="xf" funds={f.source === 'fondo' ? funds.filter((x) => x.active !== false) : principals(funds)} value={f.source !== 'fondo' && sub ? sub.parentKey : f.fund} onChange={set('fund')} label={f.source === 'fondo' ? 'Sale de' : 'Gasto de'} hint={f.source === 'fondo' ? 'Cuenta principal o una subcuenta' : 'General o de una sucursal (para los reportes)'} />
        )}
        {f.source === 'caja' && (
          <Field label="Turno de caja abierto" htmlFor="xt" required hint={sessions.length ? 'Sale en efectivo de esa caja' : 'No hay cajas abiertas'}>
            <select id="xt" value={f.sessionId} onChange={set('sessionId')}><option value="">Elige el turno</option>{sessions.map((s) => <option key={s.id} value={s.id}>{s.register} · {s.number}{s.site ? ` · ${s.site}` : ''}</option>)}</select>
          </Field>
        )}
        {f.source === 'socio' && (
          <Field label="Socio que lo pagó" htmlFor="xso" required hint="Queda como aporte del socio">
            <select id="xso" value={f.partnerId} onChange={set('partnerId')}><option value="">Elige el socio</option>{partners.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </Field>
        )}
        {sub?.services?.length > 0 && f.source === 'fondo' && (
          <div className="span-2">
            <span className="label-sm">Servicios de {sub.name}</span>
            <div className="chip-list" style={{ marginTop: 6 }}>{sub.services.map((sv) => <button key={sv.name} type="button" className={`pchip${f.description === sv.name ? ' on' : ''}`} onClick={() => setF((x) => ({ ...x, description: sv.name, category: sv.category }))}>{sv.name}</button>)}</div>
          </div>
        )}
        {f.category === 'compras' && <small className="muted span-2">Las compras de inventario no restan dos veces: la utilidad ya descuenta el costo de lo vendido.</small>}
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>
  )
}

const PartnerModal = ({ partner, onClose, onDone }) => {
  const [f, setF] = useState({ name: partner?.name || '', document: partner?.document || '', phone: partner?.phone || '', email: partner?.email || '', sharePct: partner?.sharePct ?? '', note: partner?.note || '', active: partner?.active ?? true })
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const submit = async (e) => {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      const body = { ...f, sharePct: Number(String(f.sharePct).replace(',', '.')) }
      partner ? await api.put(`/finanzas/socios/${partner.id}`, body, { params: NO_SITE }) : await api.post('/finanzas/socios', body, { params: NO_SITE })
      onDone()
    } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  return (
    <Modal title={partner ? `Editar ${partner.name}` : 'Nuevo socio'} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="pt-form" className="btn btn-primary" disabled={saving}>{saving && <Spinner />} Guardar</button></>}>
      <form id="pt-form" className="form-grid" onSubmit={submit} noValidate>
        <div className="span-2"><Field label="Nombre" htmlFor="pn" required><input id="pn" value={f.name} onChange={set('name')} autoFocus /></Field></div>
        <Field label="Participación (%)" htmlFor="pp" required hint="Cuánto de la utilidad le corresponde"><input id="pp" inputMode="decimal" value={f.sharePct} onChange={set('sharePct')} placeholder="Ej. 50" /></Field>
        <Field label="Documento" htmlFor="pd"><input id="pd" value={f.document} onChange={set('document')} /></Field>
        <Field label="Celular" htmlFor="pc"><input id="pc" inputMode="tel" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Correo" htmlFor="pe"><input id="pe" type="email" value={f.email} onChange={set('email')} /></Field>
        <div className="span-2"><Field label="Nota" htmlFor="pno"><input id="pno" value={f.note} onChange={set('note')} /></Field></div>
        {partner && <label className="check span-2"><input type="checkbox" checked={f.active} onChange={set('active')} /> Socio activo</label>}
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>
  )
}

const WithdrawalModal = ({ funds, partners, kinds, methods, initial, onClose, onDone }) => {
  const [f, setF] = useState({ partnerId: initial?.partnerId || '', kind: initial?.kind || 'utilidad', amount: initial?.amount || '', fund: 'general', method: 'transferencia', paidOn: bogota(), note: '' })
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v?.target ? v.target.value : v }))
  const submit = async (e) => {
    e.preventDefault(); setError(''); setSaving(true)
    try { await api.post('/finanzas/socios/retiros', { ...f, siteId: f.fund === 'general' ? null : Number(f.fund) }, { params: NO_SITE }); onDone() } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  return (
    <Modal title="Pago a un socio" onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="wd-form" className="btn btn-primary" disabled={saving}>{saving ? <Spinner /> : <MdPayments />} Registrar</button></>}>
      <form id="wd-form" className="form-grid" onSubmit={submit} noValidate>
        <div className="span-2 chip-list">{Object.entries(kinds).map(([k, l]) => <button key={k} type="button" className={`pchip${f.kind === k ? ' on' : ''}`} onClick={() => set('kind')(k)}>{l}</button>)}</div>
        <Field label="Socio" htmlFor="wp" required><select id="wp" value={f.partnerId} onChange={set('partnerId')}><option value="">Elige el socio</option>{partners.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Valor" htmlFor="wa" required><MoneyInput id="wa" value={f.amount} onChange={set('amount')} /></Field>
        <FundSelect id="wf" funds={funds} value={f.fund} onChange={set('fund')} label="Sale del fondo" />
        <Field label="Forma" htmlFor="wm"><select id="wm" value={f.method} onChange={set('method')}>{Object.entries(methods).filter(([k]) => k !== 'tarjeta').map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Fecha" htmlFor="wd"><input id="wd" type="date" value={f.paidOn} max={bogota()} onChange={set('paidOn')} /></Field>
        <Field label="Nota" htmlFor="wn"><input id="wn" value={f.note} onChange={set('note')} /></Field>
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>
  )
}

const VoidModal = ({ doc, onClose, onDone }) => {
  const [reason, setReason] = useState(''); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setError(''); setSaving(true)
    try { await api.post('/finanzas/anular', { kind: doc.kind, id: doc.id, reason }, { params: NO_SITE }); onDone() } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  return (
    <Modal title={`Anular ${doc.number}`} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="void-form" className="btn btn-danger" disabled={saving}>{saving ? <Spinner /> : <MdBlock />} Anular</button></>}>
      <form id="void-form" className="stack" onSubmit={submit} noValidate>
        <p className="muted" style={{ margin: 0 }}>El valor de {formatMoney(doc.amount)} vuelve a su fondo (o a la caja si sigue abierta).</p>
        <Field label="Motivo" htmlFor="vr" required><input id="vr" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
        {error && <div className="alert bad">{error}</div>}
      </form>
    </Modal>
  )
}

// ---------- Pestañas ----------
const Statement = ({ s }) => {
  const rows = [
    ['Ventas (sin propinas)', s.sales, 'strong'],
    ['Costo de lo vendido', -s.cost],
    ['Utilidad bruta', s.gross, 'strong', pct(s.grossPct)],
    ['Gastos operativos', -s.opex],
    ['Pérdidas por incidentes', -s.losses],
    ['Otros ingresos', s.otherIncome],
    ['Utilidad neta', s.net, 'total', pct(s.netPct)]
  ]
  return (
    <dl className="statement">
      {rows.map(([l, v, cls, note]) => <div key={l} className={cls || ''}><dt>{l}{note && <small className="muted"> · {note}</small>}</dt><dd className={`money${v < 0 ? ' neg' : ''}`}>{cls ? formatMoney(v) : signed(v)}</dd></div>)}
    </dl>
  )
}

const Summary = ({ range, onPay }) => {
  const [r, setR] = useState(null); const [error, setError] = useState('')
  useEffect(() => { setError(''); api.get('/finanzas/resumen', { params: { desde: range.from, hasta: range.to } }).then(({ data }) => setR(data)).catch((e) => setError(errorMessage(e))) }, [range])
  if (error) return <div className="alert bad">{error}</div>
  if (!r) return <div className="splash" style={{ minHeight: 200 }}><Spinner /></div>
  const s = r.statement
  return (
    <div className="stack">
      <div className="kpis">
        <Kpi label="Ventas" value={formatMoney(s.sales)} icon={MdAttachMoney} tone="brand" note={`Propinas aparte: ${formatMoney(s.tips)}`} />
        <Kpi label="Utilidad bruta" value={formatMoney(s.gross)} note={`Margen ${pct(s.grossPct)}`} icon={MdTrendingUp} />
        <Kpi label="Gastos" value={formatMoney(s.opex)} note={s.purchases ? `Compras de inventario ${formatMoney(s.purchases)}` : 'Sin compras de inventario'} icon={MdTrendingDown} />
        <Kpi label="Utilidad neta" value={formatMoney(s.net)} note={`Margen ${pct(s.netPct)}`} icon={MdSavings} tone={s.net < 0 ? 'bad' : 'dark'} />
      </div>
      <div className="grid grid-2">
        <Card title="Estado de resultados" subtitle={`${formatDate(r.range.from)} a ${formatDate(r.range.to)}`} icon={<MdReceiptLong />}><Statement s={s} /></Card>
        <Card title="Gastos por categoría" icon={<MdTrendingDown />}>{r.expenseByCategory.length ? <Ranking rows={r.expenseByCategory} value="total" label="label" /> : <Empty icon={<MdTrendingDown />}>No hay gastos en este rango.</Empty>}</Card>
      </div>
      <Card title="Utilidad para los socios" icon={<MdPeople />} subtitle={s.net > 0 ? `Utilidad neta a repartir ${formatMoney(r.partners.distributable)}${r.partners.retained ? ` · queda en el negocio ${formatMoney(r.partners.retained)}` : ''}` : 'No hay utilidad para repartir en este rango'} flush>
        {!r.partners.rows.length ? <Empty icon={<MdPeople />}>Crea los socios en la pestaña Socios para ver cuánto le toca a cada uno.</Empty> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Socio</th><th className="num">Participación</th><th className="num">Le corresponde</th><th className="num">Ya pagado</th><th className="num">Pendiente</th><th className="num">Aportó</th><th /></tr></thead>
            <tbody>{r.partners.rows.map((p) => (
              <tr key={p.id}><td><strong>{p.name}</strong></td><td className="num">{pct(p.sharePct)}</td><td className="num money">{formatMoney(p.share)}</td><td className="num money">{formatMoney(p.paid)}</td>
                <td className="num money"><strong>{formatMoney(p.pending)}</strong></td><td className="num money">{formatMoney(p.contributed)}</td>
                <td className="num">{p.pending > 0 && <button type="button" className="btn btn-sm" onClick={() => onPay({ partnerId: p.id, kind: 'utilidad', amount: p.pending })}><MdPayments /> Pagar</button>}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
      <div className="grid grid-2">
        <Card title="Por mes" flush>
          {!r.byMonth.length ? <Empty>Sin movimientos.</Empty> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Mes</th><th className="num">Ventas</th><th className="num">Gastos</th><th className="num">Utilidad aprox.</th></tr></thead>
              <tbody>{r.byMonth.map((m) => <tr key={m.month}><td>{m.label}</td><td className="num money">{formatMoney(m.sales)}</td><td className="num money">{formatMoney(m.expenses)}</td><td className={`num money${m.profit < 0 ? ' neg' : ''}`}>{formatMoney(m.profit)}</td></tr>)}</tbody>
            </table></div>
          )}
        </Card>
        <Card title="Dinero que entró (no es venta)">{r.funding.length ? <Share rows={r.funding} value="total" label="label" /> : <small className="muted">Sin aportes, préstamos ni otros ingresos en este rango.</small>}</Card>
      </div>
      <small className="muted">La utilidad bruta usa el costo actual de cada producto. Las pérdidas por incidentes cobrados al responsable no restan.</small>
    </div>
  )
}

const FundCard = ({ f, on, onClick }) => (
  <button type="button" className={`fund-card${f.kind === 'subcuenta' ? ' sub' : ''}${on ? ' on' : ''}${f.active === false ? ' off' : ''}`} onClick={onClick}>
    <span className="fund-name">{f.kind === 'subcuenta' ? <MdSavings /> : f.siteId ? <MdPointOfSale /> : <MdAccountBalance />} {f.name}</span>
    <strong className="money">{formatMoney(f.balance)}</strong>
    <small className="muted">{f.kind === 'subcuenta' ? (f.active === false ? 'Inactiva' : f.purpose || `Subcuenta de ${f.parent}`) : f.siteId ? (f.inRegisters ? `Más ${formatMoney(f.inRegisters)} guardados en sus cajas` : 'Cuenta principal · base de sus cajas') : 'Cuenta principal del negocio'}</small>
  </button>
)

const Funds = ({ data, fundKey, setFund, owner, onEntry, onTransfer, onNewSub, onEditSub, onPayService }) => {
  const f = data.fund
  const isSub = f.kind === 'subcuenta'
  return (
    <div className="stack">
      {principals(data.funds).map((p) => {
        const subs = data.funds.filter((x) => x.kind === 'subcuenta' && x.parentKey === p.key)
        return (
          <div key={p.key} className="fund-group">
            <div className="fund-grid">
              <FundCard f={p} on={p.key === fundKey} onClick={() => setFund(p.key)} />
              {subs.map((x) => <FundCard key={x.key} f={x} on={x.key === fundKey} onClick={() => setFund(x.key)} />)}
              {owner && <button type="button" className="fund-card add" onClick={() => onNewSub(p.key)}><MdAdd /> Subcuenta en {p.name}</button>}
            </div>
          </div>
        )
      })}
      <Card title={`Movimientos · ${isSub ? `${f.name} (${f.parent})` : f.name}`} subtitle={`Saldo ${formatMoney(f.balance)}${isSub && f.purpose ? ` · ${f.purpose}` : ''}`} flush
        actions={<div className="card-actions">
          {isSub && owner && <button type="button" className="btn btn-sm" onClick={() => onEditSub(f)}><MdEdit /> Editar</button>}
          <button type="button" className="btn btn-sm" onClick={() => onTransfer(isSub ? { from: f.parentKey, to: f.key } : { from: f.key })}><MdSwapHoriz /> {isSub ? 'Recargar' : 'Trasladar'}</button>
          {isSub
            ? <button type="button" className="btn btn-sm btn-primary" onClick={() => onPayService(f)} disabled={f.active === false}><MdReceiptLong /> Pagar servicio</button>
            : <button type="button" className="btn btn-sm btn-primary" onClick={() => onEntry(f.key)}><MdAdd /> Ingresar dinero</button>}
        </div>}>
        {isSub && f.services?.length > 0 && <div className="fund-services">{f.services.map((sv) => <button key={sv.name} type="button" className="pchip" onClick={() => onPayService(f, sv)}>{sv.name}</button>)}</div>}
        {!data.movements.length ? <Empty icon={<MdAccountBalance />}>{isSub ? 'Recarga esta subcuenta desde su cuenta principal y paga desde aquí sus servicios.' : f.siteId ? 'Ingresa dinero a esta sucursal o trasládalo desde el fondo general. De aquí sale la base para abrir sus cajas.' : 'Ingresa el dinero del negocio: capital, aportes de socios o préstamos.'}</Empty> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Fecha</th><th>Movimiento</th><th>Concepto</th><th>Usuario</th><th className="num">Valor</th><th className="num">Saldo</th></tr></thead>
            <tbody>{data.movements.map((m) => (
              <tr key={m.id}><td><small>{formatDateTime(m.createdAt)}</small></td><td>{m.typeLabel}{m.ref && <small className="muted"> · {m.ref}</small>}</td><td>{m.note}</td><td><small>{m.user}</small></td>
                <td className={`num money${m.amount < 0 ? ' neg' : ' pos'}`}>{signed(m.amount)}</td><td className="num money">{formatMoney(m.balanceAfter)}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  )
}

// Subcuenta: nombre, a qué fondo pertenece, para qué es, servicios que paga y saldo inicial (sale de su cuenta principal).
const SubaccountModal = ({ funds, sub, categories, onClose, onDone }) => {
  const editing = Boolean(sub?.vaultId)
  const [f, setF] = useState({ name: sub?.name || '', siteId: sub?.parentKey || 'general', purpose: sub?.purpose || '', initialAmount: '', active: sub?.active ?? true, services: sub?.services?.length ? sub.services : [{ name: '', category: 'servicios' }] })
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v?.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v }))
  const setSv = (n, k) => (e) => setF((x) => ({ ...x, services: x.services.map((sv, j) => (j === n ? { ...sv, [k]: e.target.value } : sv)) }))
  const parent = funds.find((x) => x.key === f.siteId)
  const submit = async (e) => {
    e.preventDefault(); setError(''); setSaving(true)
    const body = { ...f, siteId: f.siteId === 'general' ? null : Number(f.siteId), services: f.services.filter((sv) => sv.name.trim()) }
    try {
      if (editing) { await api.put(`/finanzas/subcuentas/${sub.vaultId}`, body, { params: NO_SITE }); onDone('Subcuenta guardada') } else {
        const { data } = await api.post('/finanzas/subcuentas', body, { params: NO_SITE })
        onDone(data.warning || `Subcuenta ${f.name} creada`, data.key)
      }
    } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  return (
    <Modal title={editing ? `Subcuenta ${sub.name}` : 'Nueva subcuenta'} size="lg" onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="sub-form" className="btn btn-primary" disabled={saving}>{saving ? <Spinner /> : <MdSavings />} Guardar</button></>}>
      <form id="sub-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="Nombre" htmlFor="sbn" required><input id="sbn" value={f.name} onChange={set('name')} placeholder="Ej. Caja menor, Servicios, Publicidad" autoFocus /></Field>
        {editing ? <Field label="Pertenece a"><input value={sub.parent} disabled /></Field> : (
          <Field label="Pertenece a" htmlFor="sbs" hint="Su dinero sale de esta cuenta principal"><select id="sbs" value={f.siteId} onChange={set('siteId')}>{principals(funds).map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select></Field>
        )}
        <div className="span-2"><Field label="¿Para qué es?" htmlFor="sbp"><input id="sbp" value={f.purpose} onChange={set('purpose')} placeholder="Ej. pagos de servicios públicos y mantenimientos" /></Field></div>
        {!editing && <Field label="Saldo inicial" htmlFor="sbi" hint={parent ? `Se traslada desde ${parent.name} (disponible ${formatMoney(parent.balance)})` : null}><MoneyInput id="sbi" value={f.initialAmount} onChange={set('initialAmount')} /></Field>}
        {editing && <label className="check" style={{ alignSelf: 'end' }}><input type="checkbox" checked={f.active} onChange={set('active')} /> Activa</label>}
        <div className="span-2 stack" style={{ gap: 8 }}>
          <span className="label-sm">Servicios que se pagan desde aquí</span>
          {f.services.map((sv, n) => (
            <div key={n} className="row" style={{ gap: 8 }}>
              <input value={sv.name} onChange={setSv(n, 'name')} placeholder="Ej. Energía (luz), Mantenimiento de aires" aria-label="Servicio" style={{ flex: 2 }} />
              <select value={sv.category} onChange={setSv(n, 'category')} aria-label="Categoría" style={{ flex: 1 }}>{Object.entries(categories).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Quitar servicio" onClick={() => setF((x) => ({ ...x, services: x.services.filter((_, j) => j !== n) }))}><MdBlock /></button>
            </div>
          ))}
          <button type="button" className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setF((x) => ({ ...x, services: [...x.services, { name: '', category: 'servicios' }] }))}><MdAdd /> Servicio</button>
        </div>
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>
  )
}

// Tablero de cuentas: saldos, entradas y salidas, en qué se gasta cada subcuenta y gasto por mes.
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const Accounts = ({ range, rangeNode, version, onPick }) => {
  const [r, setR] = useState(null); const [error, setError] = useState('')
  useEffect(() => { api.get('/finanzas/cuentas', { params: { desde: range.from, hasta: range.to, ...NO_SITE } }).then(({ data }) => setR(data)).catch((e) => setError(errorMessage(e))) }, [range, version])
  if (error) return <div className="alert bad">{error}</div>
  if (!r) return <div className="stack">{rangeNode}<div className="splash" style={{ minHeight: 200 }}><Spinner /></div></div>
  const subs = r.accounts.filter((a) => a.kind === 'subcuenta')
  const monthly = r.months.map((m) => ({ label: `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`, value: r.accounts.reduce((s, a) => s + (a.monthly.find((x) => x.month === m)?.total || 0), 0) }))
  return (
    <div className="stack">
      {rangeNode}
      <div className="kpis">
        <Kpi label="Dinero en cuentas" value={formatMoney(r.totals.balance)} icon={MdAccountBalance} tone="dark" note={`${r.accounts.length} cuentas`} />
        <Kpi label="En subcuentas" value={formatMoney(r.totals.subaccounts)} icon={MdSavings} note={`${subs.length} subcuentas`} />
        <Kpi label="Pagado desde cuentas" value={formatMoney(r.totals.spent)} icon={MdTrendingDown} tone="brand" note="En el rango" />
        <Kpi label="Entradas a cuentas" value={formatMoney(r.totals.inflow)} icon={MdTrendingUp} note="Ingresos, traslados y cierres" />
      </div>
      <div className="grid grid-2">
        <Card title="Gasto por mes" subtitle="Pagos desde cuentas y subcuentas, últimos 6 meses"><Bars data={monthly} ariaLabel="Gasto por mes" /></Card>
        <Card title="¿En qué se va el dinero?" subtitle="Pagos por categoría en el rango">{r.byCategory.length ? <Share rows={r.byCategory} value="total" label="label" /> : <small className="muted">Sin pagos en este rango.</small>}</Card>
      </div>
      <Card title="Cuentas y subcuentas" subtitle="Toca una para ver sus movimientos" flush>
        <div className="table-wrap"><table className="table hover">
          <thead><tr><th>Cuenta</th><th className="num">Saldo</th><th className="num hide-sm">Entró</th><th className="num hide-sm">Salió</th><th className="num">Pagos</th><th className="hide-md">Principal gasto</th></tr></thead>
          <tbody>{r.accounts.map((a) => (
            <tr key={a.key} onClick={() => onPick(a.key)} style={{ cursor: 'pointer' }} className={a.kind === 'subcuenta' ? 'sub-row' : ''}>
              <td>{a.kind === 'subcuenta' ? <>↳ <strong>{a.name}</strong> <small className="muted">{a.parent}</small></> : <strong>{a.name}</strong>}{a.active === false && <Badge tone="muted">Inactiva</Badge>}</td>
              <td className="num money">{formatMoney(a.balance)}</td>
              <td className="num money hide-sm pos">{a.inflow ? `+${formatMoney(a.inflow)}` : '—'}</td>
              <td className="num money hide-sm neg">{a.outflow ? `−${formatMoney(a.outflow)}` : '—'}</td>
              <td className="num money">{formatMoney(a.spent)}</td>
              <td className="hide-md"><small>{a.byService[0] ? `${a.byService[0].label} · ${formatMoney(a.byService[0].total)}` : '—'}</small></td>
            </tr>
          ))}</tbody>
        </table></div>
      </Card>
      {subs.some((a) => a.byService.length) && (
        <div className="grid grid-3">
          {subs.filter((a) => a.byService.length).map((a) => (
            <Card key={a.key} title={a.name} subtitle={`${a.parent} · saldo ${formatMoney(a.balance)}`}><Ranking rows={a.byService} value="total" label="label" limit={6} /></Card>
          ))}
        </div>
      )}
    </div>
  )
}

const Expenses = ({ range, rangeNode, version, onNew, onVoid }) => {
  const [r, setR] = useState(null); const [cat, setCat] = useState(''); const [q, setQ] = useState(''); const [error, setError] = useState('')
  useEffect(() => { api.get('/finanzas/gastos', { params: { desde: range.from, hasta: range.to, categoria: cat || undefined, q: q || undefined } }).then(({ data }) => setR(data)).catch((e) => setError(errorMessage(e))) }, [range, cat, q, version])
  return (
    <div className="stack">
      {rangeNode}
      {error && <div className="alert bad">{error}</div>}
      {!r ? <Spinner /> : (
        <>
          <div className="kpis">
            <Kpi label="Gastos del rango" value={formatMoney(r.total)} icon={MdTrendingDown} tone="dark" note={`${r.rows.filter((x) => x.status === 'activo').length} registrados · incluye compras de inventario`} />
            {r.byCategory.slice(0, 3).map((c) => <Kpi key={c.key} label={c.label} value={formatMoney(c.total)} />)}
          </div>
          <Card title="Gastos" flush actions={<div className="card-actions">
            <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoría"><option value="">Todas las categorías</option>{Object.entries(r.categories).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" aria-label="Buscar gasto" />
            <button type="button" className="btn btn-sm" onClick={() => download(`gastos-${range.from}_a_${range.to}`, [['Número', 'number'], ['Fecha', 'paidOn'], ['Categoría', 'categoryLabel'], ['Descripción', 'description'], ['Proveedor', 'supplier'], ['Factura', 'invoiceRef'], ['Sucursal', 'site'], ['Pagado con', 'sourceLabel'], ['Valor', 'amount'], ['Estado', 'status']], r.rows)}>Excel</button>
            <button type="button" className="btn btn-sm btn-primary" onClick={onNew}><MdAdd /> Nuevo gasto</button>
          </div>}>
            {!r.rows.length ? <Empty icon={<MdTrendingDown />}>No hay gastos en este rango.</Empty> : (
              <div className="table-wrap"><table className="table">
                <thead><tr><th>Fecha</th><th>Gasto</th><th>Categoría</th><th>Pagado con</th><th className="num">Valor</th><th /></tr></thead>
                <tbody>{r.rows.map((x) => (
                  <tr key={x.id} className={x.status === 'anulado' ? 'voided' : ''}>
                    <td><small>{formatDate(x.paidOn)}</small></td>
                    <td><strong>{x.description}</strong><br /><small className="muted">{x.number}{x.supplier ? ` · ${x.supplier}` : ''}{x.invoiceRef ? ` · Fact. ${x.invoiceRef}` : ''} · {x.site}</small></td>
                    <td>{x.categoryLabel}</td>
                    <td><small>{x.sourceLabel}{x.session ? ` · ${x.session}` : ''}{x.partner ? ` · ${x.partner}` : ''}</small></td>
                    <td className="num money">{formatMoney(x.amount)}</td>
                    <td className="num">{x.status === 'anulado' ? <Badge tone="bad">Anulado</Badge> : <button type="button" className="btn btn-sm btn-ghost" onClick={() => onVoid({ kind: 'expense', ...x })} title="Anular"><MdBlock /></button>}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

const Entries = ({ range, rangeNode, version, onNew, onVoid }) => {
  const [r, setR] = useState(null); const [error, setError] = useState('')
  useEffect(() => { api.get('/finanzas/ingresos', { params: { desde: range.from, hasta: range.to, ...NO_SITE } }).then(({ data }) => setR(data)).catch((e) => setError(errorMessage(e))) }, [range, version])
  return (
    <div className="stack">
      {rangeNode}
      {error && <div className="alert bad">{error}</div>}
      <Card title="Ingresos de dinero" subtitle="Capital, aportes de socios, préstamos y otros ingresos que no son ventas" flush
        actions={<button type="button" className="btn btn-sm btn-primary" onClick={() => onNew('general')}><MdAdd /> Ingresar dinero</button>}>
        {!r ? <Spinner /> : !r.rows.length ? <Empty icon={<MdSavings />}>No hay ingresos de dinero en este rango.</Empty> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Fecha</th><th>Ingreso</th><th>Fondo</th><th>Forma</th><th className="num">Valor</th><th /></tr></thead>
            <tbody>{r.rows.map((x) => (
              <tr key={x.id} className={x.status === 'anulado' ? 'voided' : ''}>
                <td><small>{formatDate(x.receivedOn)}</small></td>
                <td><strong>{x.kindLabel}{x.partner ? ` · ${x.partner}` : ''}</strong><br /><small className="muted">{x.number}{x.description ? ` · ${x.description}` : ''}</small></td>
                <td>{x.fund}</td><td><small>{x.methodLabel}</small></td>
                <td className="num money">{formatMoney(x.amount)}</td>
                <td className="num">{x.status === 'anulado' ? <Badge tone="bad">Anulado</Badge> : <button type="button" className="btn btn-sm btn-ghost" onClick={() => onVoid({ kind: 'entry', ...x })} title="Anular"><MdBlock /></button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  )
}

const Partners = ({ data, onNew, onEdit, onPay, onVoid }) => (
  <div className="stack">
    <Card title="Socios" icon={<MdPeople />} subtitle={`Participación asignada ${pct(Math.round(data.shareTotal * 100) / 100)}${data.shareTotal < 100 ? ` · ${pct(Math.round((100 - data.shareTotal) * 100) / 100)} queda en el negocio` : ''}`} flush
      actions={<div className="card-actions"><button type="button" className="btn btn-sm" onClick={() => onPay(null)} disabled={!data.rows.some((p) => p.active)}><MdPayments /> Pago a socio</button><button type="button" className="btn btn-sm btn-primary" onClick={onNew}><MdAdd /> Nuevo socio</button></div>}>
      {!data.rows.length ? <Empty icon={<MdPeople />}>Agrega a los socios con su porcentaje de participación para repartir las utilidades.</Empty> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Socio</th><th className="num">Participación</th><th className="num">Aportó</th><th className="num">Retiró</th><th className="num">Capital</th><th className="num">Utilidades pagadas</th><th /></tr></thead>
          <tbody>{data.rows.map((p) => (
            <tr key={p.id} className={p.active ? '' : 'voided'}>
              <td><strong>{p.name}</strong>{!p.active && <> <Badge>Inactivo</Badge></>}<br /><small className="muted">{[p.document, p.phone, p.email].filter(Boolean).join(' · ')}</small></td>
              <td className="num">{pct(p.sharePct)}</td><td className="num money">{formatMoney(p.contributed)}</td><td className="num money">{formatMoney(p.withdrawn)}</td>
              <td className="num money"><strong>{formatMoney(p.capital)}</strong></td><td className="num money">{formatMoney(p.profitsPaid)}</td>
              <td className="num"><button type="button" className="btn btn-sm btn-ghost" onClick={() => onEdit(p)} aria-label={`Editar ${p.name}`}><MdEdit /></button></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </Card>
    <Card title="Pagos y retiros de socios" flush>
      {!data.withdrawals.length ? <Empty icon={<MdPayments />}>Aún no hay pagos de utilidades ni retiros.</Empty> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Fecha</th><th>Socio</th><th>Tipo</th><th>Fondo</th><th className="num">Valor</th><th /></tr></thead>
          <tbody>{data.withdrawals.map((w) => (
            <tr key={w.id} className={w.status === 'anulado' ? 'voided' : ''}>
              <td><small>{formatDate(w.paidOn)}</small></td><td><strong>{w.partner}</strong><br /><small className="muted">{w.number}{w.note ? ` · ${w.note}` : ''}</small></td>
              <td>{w.kindLabel}</td><td><small>{w.fund} · {w.methodLabel}</small></td><td className="num money">{formatMoney(w.amount)}</td>
              <td className="num">{w.status === 'anulado' ? <Badge tone="bad">Anulado</Badge> : <button type="button" className="btn btn-sm btn-ghost" onClick={() => onVoid({ kind: 'withdrawal', ...w })} title="Anular"><MdBlock /></button>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </Card>
  </div>
)

// ---------- Página ----------
const FinancePage = () => {
  const [params, setParams] = useSearchParams()
  const [tab, setTabState] = useState(params.get('tab') || 'resumen')
  const setTab = (t) => { setTabState(t); setParams(t === 'resumen' ? {} : { tab: t }, { replace: true }) }
  const [range, rangeNode] = useRange('mes')
  const [fundKey, setFund] = useState(params.get('fondo') || 'general')
  const [funds, setFunds] = useState(null)
  const [partners, setPartners] = useState(null)
  const [meta, setMeta] = useState({ categories: {}, sources: {} })
  const [modal, setModal] = useState(null)
  const [version, setVersion] = useState(0)
  const [error, setError] = useState('')
  const [toast, toastNode] = useToast()
  const { user } = useAuth()
  const owner = user.role === 'superadmin'

  const loadFunds = useCallback(() => api.get('/finanzas/fondos', { params: { fondo: fundKey, ...NO_SITE } }).then(({ data }) => setFunds(data)).catch((e) => setError(errorMessage(e))), [fundKey])
  const loadPartners = useCallback(() => api.get('/finanzas/socios', { params: NO_SITE }).then(({ data }) => setPartners(data)).catch((e) => setError(errorMessage(e))), [])
  useEffect(() => { loadFunds() }, [loadFunds])
  useEffect(() => { loadPartners() }, [loadPartners])
  useEffect(() => { api.get('/finanzas/gastos', { params: { desde: bogota(), hasta: bogota() } }).then(({ data }) => setMeta({ categories: data.categories, sources: data.sources })).catch(() => {}) }, [])
  const refresh = (msg) => { setModal(null); if (msg) toast(msg); setVersion((v) => v + 1); loadFunds(); loadPartners() }

  const ready = funds && partners
  return (
    <div className="stack">
      <PageHead title="Finanzas" subtitle="Fondos, gastos, aportes de socios y utilidades">
        <button type="button" className="btn btn-icon" onClick={() => refresh()} aria-label="Actualizar" title="Actualizar"><MdRefresh /></button>
        <button type="button" className="btn" onClick={() => setModal({ type: 'expense' })} disabled={!ready}><MdTrendingDown /> Gasto</button>
        <button type="button" className="btn btn-primary" onClick={() => setModal({ type: 'entry', fund: fundKey })} disabled={!ready}><MdAdd /> Ingresar dinero</button>
      </PageHead>
      {funds && (
        <div className="fund-strip">
          <span><MdAccountBalance /> Total en fondos <strong className="money">{formatMoney(funds.total)}</strong></span>
          {funds.funds.filter((f) => f.siteId && f.balance <= 0 && !f.inRegisters).length > 0 && (
            <span className="warn-text">{funds.funds.filter((f) => f.siteId && f.balance <= 0 && !f.inRegisters).map((f) => f.name).join(', ')} sin fondos: no podrán abrir caja.</span>
          )}
        </div>
      )}
      <Tabs value={tab} onChange={setTab} tabs={[['resumen', 'Resumen'], ['cuentas', 'Cuentas'], ['fondos', 'Fondos y subcuentas'], ['gastos', 'Gastos'], ['ingresos', 'Ingresos de dinero'], ['socios', 'Socios']]} />
      {error && <div className="alert bad">{error}</div>}
      {!ready ? <div className="splash" style={{ minHeight: 240 }}><Spinner /></div> : (
        <>
          {tab === 'resumen' && <div className="stack">{rangeNode}<Summary range={range} key={version} onPay={(initial) => setModal({ type: 'pay', initial })} /></div>}
          {tab === 'cuentas' && <Accounts range={range} rangeNode={rangeNode} version={version} onPick={(k) => { setFund(k); setTab('fondos') }} />}
          {tab === 'fondos' && <Funds data={funds} fundKey={fundKey} setFund={setFund} owner={owner} onEntry={(fund) => setModal({ type: 'entry', fund })} onTransfer={(initial) => setModal({ type: 'transfer', initial })}
            onNewSub={(parentKey) => setModal({ type: 'sub', sub: { parentKey } })} onEditSub={(sub) => setModal({ type: 'sub', sub })}
            onPayService={(sub, sv) => setModal({ type: 'expense', initial: { source: 'fondo', fund: sub.key, ...(sv ? { description: sv.name, category: sv.category } : {}) } })} />}
          {tab === 'gastos' && <Expenses range={range} rangeNode={rangeNode} version={version} onNew={() => setModal({ type: 'expense' })} onVoid={(doc) => setModal({ type: 'void', doc })} />}
          {tab === 'ingresos' && <Entries range={range} rangeNode={rangeNode} version={version} onNew={(fund) => setModal({ type: 'entry', fund })} onVoid={(doc) => setModal({ type: 'void', doc })} />}
          {tab === 'socios' && <Partners data={partners} onNew={() => setModal({ type: 'partner' })} onEdit={(p) => setModal({ type: 'partner', partner: p })} onPay={(initial) => setModal({ type: 'pay', initial })} onVoid={(doc) => setModal({ type: 'void', doc })} />}
        </>
      )}
      {modal?.type === 'entry' && <EntryModal funds={principals(funds.funds)} partners={partners.rows} initialFund={funds.funds.find((x) => x.key === modal.fund)?.kind === 'subcuenta' ? funds.funds.find((x) => x.key === modal.fund).parentKey : modal.fund} kinds={funds.entryKinds} methods={funds.methods} onClose={() => setModal(null)} onDone={(d) => refresh(`Ingreso ${d.number} registrado`)} />}
      {modal?.type === 'transfer' && <TransferModal funds={funds.funds} initial={modal.initial} onClose={() => setModal(null)} onDone={() => refresh('Traslado registrado')} />}
      {modal?.type === 'expense' && <ExpenseModal funds={funds.funds} partners={partners.rows} categories={meta.categories} sources={meta.sources} initial={modal.initial} onClose={() => setModal(null)} onDone={(d) => refresh(`Gasto ${d.number} registrado`)} />}
      {modal?.type === 'partner' && <PartnerModal partner={modal.partner} onClose={() => setModal(null)} onDone={() => refresh('Socio guardado')} />}
      {modal?.type === 'pay' && <WithdrawalModal funds={principals(funds.funds)} partners={partners.rows} kinds={partners.withdrawalKinds} methods={funds.methods} initial={modal.initial} onClose={() => setModal(null)} onDone={() => refresh('Pago registrado')} />}
      {modal?.type === 'sub' && <SubaccountModal funds={funds.funds} sub={modal.sub} categories={meta.categories} onClose={() => setModal(null)} onDone={(msg, key) => { if (key) setFund(key); refresh(msg) }} />}
      {modal?.type === 'void' && <VoidModal doc={modal.doc} onClose={() => setModal(null)} onDone={() => refresh(`${modal.doc.number} anulado`)} />}
      {toastNode}
    </div>
  )
}

export default FinancePage
