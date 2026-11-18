import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { MdAdd, MdEdit, MdDelete, MdSchedule, MdEvent, MdSell } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { Badge, Card, Empty, Field, Modal, Spinner } from '../../components/ui'
import { MoneyInput } from '../../components/forms'
import { formatDateTime, formatMoney } from '../../utils/format'
import { PALETTE } from './common'

// ---------- Promociones: emoji, etiqueta y color; vigencia por fechas, franja horaria (happy hour) y días ----------
export const PROMO_EMOJIS = ['🔥', '🍻', '🍹', '🍔', '🍕', '☕', '🎉', '⭐', '🎁', '⚡', '🌙', '☀️', '🖤', '🎄', '❤️', '💸']
export const WEEKDAYS = [[1, 'L'], [2, 'M'], [3, 'X'], [4, 'J'], [5, 'V'], [6, 'S'], [7, 'D']]
const DAY_NAMES = ['', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
export const promoValue = (p) => (p.type === 'porcentaje' ? `-${p.value} %` : `-${formatMoney(p.value)}`)
const STATUS_TONE = { vigente: 'ok', programada: 'brand', fuera_de_horario: 'warn', vencida: 'muted', inactiva: 'muted' }
const hour12 = (t) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'a. m.' : 'p. m.'}` }

// Chip de la promoción: emoji + TAG con su color.
export const PromoTag = ({ p, size = '' }) => (
  <span className={`promo-tag ${size}`} style={{ background: p.color || '#E4572E', color: '#fff' }}>
    {p.emoji && <span aria-hidden="true">{p.emoji}</span>}{p.tag || p.name}
  </span>
)

// Precio con promoción: precio final y el de lista tachado.
export const PromoPrice = ({ product, big = false }) => (
  product.promo ? (
    <span className={`promo-price${big ? ' big' : ''}`}>
      <strong>{formatMoney(product.finalPrice)}</strong>
      <s>{formatMoney(product.price)}</s>
    </span>
  ) : <span className={`promo-price${big ? ' big' : ''}`}><strong>{formatMoney(product.price)}</strong></span>
)

// Texto de vigencia: "Del 27/11 12:00 a. m. al 28/11 · 8 a. m. a 12 p. m. · vie y sáb".
export const whenText = (p) => {
  const parts = []
  if (p.startsAt && p.endsAt) parts.push(`Del ${formatDateTime(p.startsAt)} al ${formatDateTime(p.endsAt)}`)
  else if (p.startsAt) parts.push(`Desde ${formatDateTime(p.startsAt)}`)
  else if (p.endsAt) parts.push(`Hasta ${formatDateTime(p.endsAt)}`)
  if (p.timeFrom && p.timeTo) parts.push(`de ${hour12(p.timeFrom)} a ${hour12(p.timeTo)}`)
  if (p.weekdays?.length && p.weekdays.length < 7) parts.push(p.weekdays.map((d) => DAY_NAMES[d]).join(', '))
  return parts.length ? parts.join(' · ') : 'Siempre que esté activa'
}

// Cuenta regresiva corta: "2 d 4 h", "3 h 20 min".
export const timeLeft = (iso) => {
  const ms = new Date(iso) - Date.now()
  if (ms <= 0) return null
  const m = Math.floor(ms / 60000); const d = Math.floor(m / 1440); const h = Math.floor((m % 1440) / 60)
  return d ? `${d} d ${h} h` : h ? `${h} h ${m % 60} min` : `${m % 60} min`
}

// datetime-local en hora de Colombia ↔ ISO
const toLocal = (iso) => (iso ? new Date(new Date(iso).getTime() - 5 * 3600000).toISOString().slice(0, 16) : '')

const EMPTY = { name: '', tag: '', emoji: '🍻', color: '#E4572E', description: '', type: 'porcentaje', value: '', startsAt: '', endsAt: '', timeFrom: '', timeTo: '', weekdays: [], scope: 'todos', categoryIds: [], productIds: [], active: true }

const PromotionForm = ({ initial, categories, products, onClose, onSaved }) => {
  const editing = Boolean(initial?.id)
  const [f, setF] = useState(() => (editing ? { ...EMPTY, ...initial, startsAt: toLocal(initial.startsAt), endsAt: toLocal(initial.endsAt), timeFrom: initial.timeFrom || '', timeTo: initial.timeTo || '', description: initial.description || '', tag: initial.tag || '', emoji: initial.emoji || '' } : { ...EMPTY, ...(initial || {}) }))
  const [byHours, setByHours] = useState(Boolean(initial?.timeFrom || initial?.weekdays?.length))
  const [q, setQ] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }))
  const toggle = (k, id) => setF((x) => ({ ...x, [k]: x[k].includes(id) ? x[k].filter((v) => v !== id) : [...x[k], id] }))
  const quick = (from, to) => setF((x) => ({ ...x, startsAt: from, endsAt: to }))
  const submit = async (e) => {
    e.preventDefault(); setError('')
    const body = { ...f, value: Number(f.value), ...(byHours ? {} : { timeFrom: '', timeTo: '', weekdays: [] }) }
    setSaving(true)
    try { editing ? await api.put(`/promociones/${initial.id}`, body) : await api.post('/promociones', body); onSaved(editing) } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  const sample = products.find((p) => (f.scope === 'productos' ? f.productIds.includes(p.id) : f.scope === 'categorias' ? f.categoryIds.includes(p.categoryId) : true)) || { price: 20000 }
  const after = Number(f.value) > 0 ? Math.max(0, Math.round(f.type === 'porcentaje' ? sample.price * (1 - f.value / 100) : sample.price - f.value)) : null
  const year = new Date().getFullYear()
  const shownProducts = products.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <Modal size="lg" title={editing ? 'Editar promoción' : 'Nueva promoción'} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="promo-form" className="btn btn-primary" disabled={saving}>{saving && <Spinner />} Guardar</button></>}>
      <form id="promo-form" className="form-grid" onSubmit={submit} noValidate>
        <div className="span-2 promo-preview">
          <PromoTag p={{ ...f, tag: (f.tag || f.name || 'TAG').toUpperCase() }} size="lg" />
          <div><strong>{f.name || 'Nombre de la promoción'}</strong><small>{f.value ? `${promoValue({ ...f, value: Number(f.value) })} · ` : ''}{sample.name ? `${sample.name}: ` : 'Ejemplo: '}{after !== null ? <><s>{formatMoney(sample.price)}</s> → <b>{formatMoney(after)}</b></> : '—'}</small></div>
        </div>
        <Field label="Nombre" htmlFor="prn" required><input id="prn" value={f.name} onChange={set('name')} placeholder="Ej. Happy hour, 2x1 en cócteles" autoFocus /></Field>
        <Field label="Etiqueta" htmlFor="prt" hint="Se muestra en mayúsculas sobre el producto y en la carta"><input id="prt" value={f.tag} maxLength={24} onChange={set('tag')} placeholder="HAPPY HOUR" /></Field>
        <div className="span-2"><Field label="Emoji">
          <div className="emoji-pick">
            {PROMO_EMOJIS.map((em) => <button key={em} type="button" className={f.emoji === em ? 'on' : ''} onClick={() => setF((x) => ({ ...x, emoji: em }))} aria-label={`Emoji ${em}`}>{em}</button>)}
            <input className="emoji-free" value={f.emoji} onChange={set('emoji')} aria-label="Otro emoji" placeholder="Otro" />
          </div>
        </Field></div>
        <div className="span-2"><Field label="Color de la etiqueta">
          <div className="disc-colors">{PALETTE.map((c) => (
            <button key={c} type="button" className={f.color === c ? 'on' : ''} style={{ background: c }} aria-label={`Color ${c}`} aria-pressed={f.color === c} onClick={() => setF((x) => ({ ...x, color: c }))} />
          ))}</div>
        </Field></div>
        <Field label="Tipo de descuento" htmlFor="prty"><select id="prty" value={f.type} onChange={set('type')}><option value="porcentaje">Porcentaje (%)</option><option value="valor">Valor fijo por unidad ($)</option></select></Field>
        <Field label={f.type === 'porcentaje' ? 'Porcentaje' : 'Valor'} htmlFor="prv" required>{f.type === 'porcentaje' ? <input id="prv" inputMode="decimal" value={f.value} onChange={set('value')} placeholder="20" /> : <MoneyInput id="prv" value={f.value} onChange={set('value')} />}</Field>

        <div className="span-2 form-section"><MdEvent /> Vigencia por fechas <small className="muted">(vacío = sin límite)</small></div>
        <Field label="Empieza" htmlFor="prs"><input id="prs" type="datetime-local" value={f.startsAt} onChange={set('startsAt')} /></Field>
        <Field label="Termina" htmlFor="pre"><input id="pre" type="datetime-local" value={f.endsAt} onChange={set('endsAt')} /></Field>
        <div className="span-2 chip-list">
          <button type="button" className="btn btn-sm" onClick={() => quick(`${year}-12-24T18:00`, `${year}-12-26T00:00`)}>🎄 Navidad</button>
          <button type="button" className="btn btn-sm" onClick={() => quick(`${year}-12-31T18:00`, `${year + 1}-01-01T06:00`)}>🎆 Fin de año</button>
          <button type="button" className="btn btn-sm" onClick={() => quick(`${year}-11-27T00:00`, `${year}-11-28T00:00`)}>🖤 Black Friday</button>
          {(f.startsAt || f.endsAt) && <button type="button" className="btn btn-sm btn-ghost" onClick={() => quick('', '')}>Quitar fechas</button>}
        </div>

        <label className="check span-2 form-section"><input type="checkbox" checked={byHours} onChange={(e) => setByHours(e.target.checked)} /> <MdSchedule /> Solo en ciertas horas o días (happy hour, jueves de rumba, fines de semana)</label>
        {byHours && <>
          <Field label="Desde la hora" htmlFor="prtf"><input id="prtf" type="time" value={f.timeFrom} onChange={set('timeFrom')} /></Field>
          <Field label="Hasta la hora" htmlFor="prtt"><input id="prtt" type="time" value={f.timeTo} onChange={set('timeTo')} /></Field>
          <div className="span-2"><Field label="Días" hint="Sin días marcados aplica todos los días">
            <div className="day-pick">{WEEKDAYS.map(([d, l]) => <button key={d} type="button" className={f.weekdays.includes(d) ? 'on' : ''} onClick={() => toggle('weekdays', d)} aria-pressed={f.weekdays.includes(d)}>{l}</button>)}</div>
          </Field></div>
        </>}

        <div className="span-2 form-section"><MdSell /> Productos</div>
        <div className="span-2 seg seg-wrap">{[['todos', 'Toda la carta'], ['categorias', 'Por categoría'], ['productos', 'Productos específicos']].map(([k, l]) => <button key={k} type="button" className={`btn btn-sm${f.scope === k ? ' on' : ''}`} onClick={() => setF((x) => ({ ...x, scope: k }))}>{l}</button>)}</div>
        {f.scope === 'categorias' && <div className="span-2 check-list">{categories.map((c) => <label key={c.id} className="check"><input type="checkbox" checked={f.categoryIds.includes(c.id)} onChange={() => toggle('categoryIds', c.id)} /> {c.emoji} {c.name}</label>)}</div>}
        {f.scope === 'productos' && <div className="span-2 stack" style={{ gap: 8 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto" aria-label="Buscar producto" />
          <div className="check-list">{shownProducts.map((p) => <label key={p.id} className="check"><input type="checkbox" checked={f.productIds.includes(p.id)} onChange={() => toggle('productIds', p.id)} /> <span>{p.name} <small className="muted">· {formatMoney(p.price)}</small></span></label>)}</div>
          <small className="hint">{f.productIds.length} producto(s) elegido(s)</small>
        </div>}
        <div className="span-2"><Field label="Descripción" htmlFor="prd"><input id="prd" value={f.description} onChange={set('description')} placeholder="Condiciones o mensaje para el cliente" /></Field></div>
        {editing && <label className="check span-2"><input type="checkbox" checked={f.active} onChange={set('active')} /> Activa</label>}
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>
  )
}

export const PromotionsTab = ({ admin, categories, products, toast, onChanged }) => {
  const [rows, setRows] = useState(null)
  const [modal, setModal] = useState(null)
  const [filter, setFilter] = useState('todas')
  const load = useCallback(() => { api.get('/promociones').then(({ data }) => setRows(data)).catch(() => setRows([])) }, [])
  useEffect(() => { load() }, [load])
  // Desde el dashboard ("Crear promoción" en un producto que se vende poco): abre la promoción con el producto elegido.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const id = Number(q.get('producto'))
    if (!admin || !id) return
    const name = q.get('nombre') || ''
    setModal({ preset: { scope: 'productos', productIds: [id], name: name ? `Promo ${name}`.slice(0, 60) : '', tag: 'Promo', type: 'porcentaje', value: '15', description: name ? `Precio especial en ${name}` : '' } })
  }, [admin])
  const shown = useMemo(() => (rows || []).filter((p) => filter === 'todas' || (filter === 'vigentes' ? ['vigente', 'fuera_de_horario'].includes(p.status) : p.status === filter)), [rows, filter])
  const remove = async (p) => {
    if (!window.confirm(`¿Eliminar la promoción ${p.name}? Si solo quieres pausarla, edítala y desmárcala como activa.`)) return
    try { await api.delete(`/promociones/${p.id}`); toast('Promoción eliminada'); load(); onChanged() } catch (e) { toast(errorMessage(e), 'bad') }
  }
  const live = (rows || []).filter((p) => p.status === 'vigente').length
  return (
    <div className="stack">
      <div className="row-between">
        <div className="seg seg-wrap">{[['todas', 'Todas'], ['vigentes', 'Vigentes'], ['programada', 'Programadas'], ['vencida', 'Vencidas']].map(([k, l]) => <button key={k} type="button" className={`btn btn-sm${filter === k ? ' on' : ''}`} onClick={() => setFilter(k)}>{l}</button>)}</div>
        {admin && <button type="button" className="btn btn-primary" onClick={() => setModal({})}><MdAdd /> Promoción</button>}
      </div>
      {rows && live > 0 && <div className="alert ok">{live} promoción(es) aplicando ahora. El precio con promoción se ve en Productos y se usará al tomar pedidos (etapa 3).</div>}
      {!rows ? <div className="splash" style={{ minHeight: 140 }}><Spinner /></div> : !shown.length ? (
        <Card><Empty icon={<MdSell />}>{rows.length ? 'Ninguna promoción con ese filtro.' : 'Aún no hay promociones. Crea una como Happy hour y elige a qué productos aplica.'}</Empty></Card>
      ) : (
        <div className="promo-grid">{shown.map((p) => (
          <div key={p.id} className={`promo-card ${p.status}`} style={{ '--promo': p.color }}>
            <div className="row-between"><PromoTag p={p} /><Badge tone={STATUS_TONE[p.status]}>{p.statusLabel}</Badge></div>
            <div className="promo-value">{promoValue(p)}</div>
            <strong>{p.name}</strong>
            {p.description && <small className="muted">{p.description}</small>}
            <small><MdSchedule /> {whenText(p)}</small>
            {p.status === 'vigente' && p.endsAt && timeLeft(p.endsAt) && <small className="text-bad">⏳ Termina en {timeLeft(p.endsAt)}</small>}
            {p.status === 'programada' && p.startsAt && <small>🕒 Empieza en {timeLeft(p.startsAt)}</small>}
            <small><MdSell /> {p.scope === 'todos' ? 'Toda la carta' : p.scope === 'categorias' ? p.categories.join(', ') : `${p.products.length} producto(s): ${p.products.slice(0, 3).join(', ')}${p.products.length > 3 ? '…' : ''}`}</small>
            {admin && <div className="row-end">
              <button type="button" className="btn btn-sm" onClick={() => setModal(p)}><MdEdit /> Editar</button>
              {<button type="button" className="btn btn-sm btn-ghost text-bad" onClick={() => remove(p)} aria-label="Eliminar"><MdDelete /></button>}
            </div>}
          </div>
        ))}</div>
      )}
      {modal && <PromotionForm initial={modal.id ? modal : modal.preset || null} categories={(categories || []).filter((c) => c.active)} products={(products || []).filter((p) => p.active)}
        onClose={() => setModal(null)} onSaved={(e) => { setModal(null); toast(e ? 'Promoción actualizada' : 'Promoción creada'); load(); onChanged() }} />}
    </div>
  )
}
