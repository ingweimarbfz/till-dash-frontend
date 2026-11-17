import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  MdLocalOffer, MdStar, MdFavorite, MdCardGiftcard, MdHandshake, MdCake, MdEmojiEvents, MdLocalFireDepartment, MdPercent, MdPerson,
  MdSportsBar, MdCelebration, MdAdd, MdDelete, MdMoveToInbox, MdLocalShipping, MdWarehouse
} from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { Field, Modal, Spinner } from '../../components/ui'
import { MoneyInput } from '../../components/forms'
import { formatMoney } from '../../utils/format'

// ---------- Unidades y cantidades ----------
export const UNITS = { und: 'Unidad', porcion: 'Porción', botella: 'Botella', g: 'Gramos', kg: 'Kilos', ml: 'Mililitros', l: 'Litros' }
export const UNIT_SHORT = { und: 'und', porcion: 'porc.', botella: 'bot.', g: 'g', kg: 'kg', ml: 'ml', l: 'l' }
export const fmtQty = (v, unit) => `${Number(v || 0).toLocaleString('es-CO', { maximumFractionDigits: 3 })}${unit ? ` ${UNIT_SHORT[unit] || unit}` : ''}`
export const AREAS = { cocina: 'Cocina', bar: 'Bar', barista: 'Barista', ninguna: 'Sin preparación' }

// ---------- Colores de categorías, descuentos y promociones ----------
export const PALETTE = ['#E4572E', '#F2A541', '#1F2933', '#2E7D32', '#0E7490', '#7C3AED', '#DB2777', '#B45309', '#475569']

// ---------- Descuentos: ícono y color para reconocerlos de un vistazo ----------
export const DISCOUNT_ICONS = {
  tag: MdLocalOffer, star: MdStar, heart: MdFavorite, gift: MdCardGiftcard, handshake: MdHandshake, cake: MdCake,
  trophy: MdEmojiEvents, fire: MdLocalFireDepartment, percent: MdPercent, user: MdPerson, beer: MdSportsBar, party: MdCelebration
}
export const discountValue = (d) => (d.type === 'porcentaje' ? `${d.value} %` : formatMoney(d.value))
export const DiscountIcon = ({ d, size = 36 }) => {
  const I = DISCOUNT_ICONS[d.icon] || MdLocalOffer
  return <span className="icon-bubble" style={{ background: `${d.color}22`, color: d.color, width: size, height: size, fontSize: size * 0.5 }}><I /></span>
}

// ---------- Bodegas ----------
// La bodega principal es de todo el establecimiento; las demás, de su sucursal.
export const useWarehouses = () => {
  const [sites, setSites] = useState(null)
  const [warehouses, setWarehouses] = useState(null)
  const reload = useCallback(() => {
    api.get('/sedes', { params: { sede: undefined } }).then(({ data }) => setSites(data)).catch(() => setSites([]))
    api.get('/inventario/bodegas', { params: { sede: undefined } }).then(({ data }) => setWarehouses(data)).catch(() => setWarehouses([]))
  }, [])
  useEffect(() => { reload() }, [reload])
  const main = useMemo(() => (warehouses || []).find((w) => w.isMain) || null, [warehouses])
  return { sites, warehouses, main, reload }
}

export const WarehouseOptions = ({ sites, warehouses, exclude }) => {
  const list = (warehouses || []).filter((w) => w.active && w.id !== Number(exclude))
  const main = list.filter((w) => w.isMain)
  return (
    <>
      {main.length > 0 && <optgroup label="Establecimiento">{main.map((w) => <option key={w.id} value={w.id}>{w.name} (principal)</option>)}</optgroup>}
      {(sites || []).map((s) => {
        const ws = list.filter((w) => !w.isMain && w.siteId === s.id)
        return ws.length ? <optgroup key={s.id} label={s.name}>{ws.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</optgroup> : null
      })}
    </>
  )
}

// Productos agrupados por categoría.
export const ProductOptions = ({ products, stockOf }) => {
  const groups = {}
  for (const p of products) (groups[p.category || 'Sin categoría'] ||= []).push(p)
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([cat, ps]) => (
    <optgroup key={cat} label={cat}>{ps.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` · ${p.sku}` : ''}{stockOf ? ` (hay ${fmtQty(stockOf(p), p.unit)})` : ''}</option>)}</optgroup>
  ))
}

const stockIn = (p, warehouseId) => p.byWarehouse?.find((w) => w.warehouseId === Number(warehouseId))?.stock ?? 0

// ---------- Entrada, ajuste o baja de varios productos en una bodega ----------
const MOVE_TITLES = { entrada: 'Entrada (compra)', ajuste: 'Ajuste (+ o −)', baja: 'Baja (daño, pérdida o vencimiento)' }
export const MovementModal = ({ products, sites, warehouses, defaults = {}, onClose, onSaved }) => {
  const [f, setF] = useState({ type: 'entrada', warehouseId: '', supplier: '', invoice: '', note: '', ...defaults })
  const [items, setItems] = useState([])
  const [pick, setPick] = useState(defaults.productId ? String(defaults.productId) : '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  // Desde el botón de un producto, la ventana trabaja solo con ese producto.
  const single = Boolean(defaults.productId)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }))
  const tracked = products.filter((p) => p.active && p.trackStock)
  const available = tracked.filter((p) => !items.some((i) => i.product.id === p.id))
  const add = (id = pick) => {
    const p = products.find((x) => x.id === Number(id))
    if (!p) return
    setItems((list) => (list.some((x) => x.product.id === p.id) ? list : [...list, { product: p, quantity: '', unitCost: p.cost, pack: false, boxes: '', perBox: '', boxCost: '' }])); setPick('')
  }
  useEffect(() => { if (defaults.productId) add(defaults.productId) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const setItem = (n, k) => (v) => setItems((list) => list.map((x, j) => (j === n ? { ...x, [k]: v?.target ? v.target.value : v } : x)))
  // Compra por caja o canasta: unidades = cajas × unidades por caja; costo unitario = costo de la caja ÷ unidades por caja.
  const boxed = f.type === 'entrada'
  const real = (i) => (boxed && i.pack
    ? { quantity: Number(i.boxes) * Number(i.perBox), unitCost: Number(i.perBox) > 0 && i.boxCost !== '' ? Math.round((Number(i.boxCost) / Number(i.perBox)) * 100) / 100 : null }
    : { quantity: Number(i.quantity), unitCost: i.unitCost })
  const submit = async (e) => {
    e.preventDefault(); setError('')
    if (!f.warehouseId) return setError('Selecciona la bodega.')
    if (!items.length) return setError('Agrega al menos un producto.')
    const badBox = items.find((i) => boxed && i.pack && !(Number(i.boxes) > 0 && Number(i.perBox) > 0 && Number.isInteger(Number(i.perBox))))
    if (badBox) return setError(`Escribe cuántas cajas y cuántas unidades trae cada caja de ${badBox.product.name}.`)
    const bad = items.find((i) => { const q = real(i).quantity; return !(q !== 0 && Number.isFinite(q)) || (f.type !== 'ajuste' && q < 0) })
    if (bad) return setError(`Revisa la cantidad de ${bad.product.name}.`)
    if (f.type !== 'entrada' && !f.note.trim()) return setError('Escribe el motivo.')
    setSaving(true)
    try {
      const { data } = await api.post('/inventario/movimientos', { ...f, items: items.map((i) => ({ productId: i.product.id, quantity: real(i).quantity, unitCost: f.type === 'entrada' ? real(i).unitCost : undefined })) })
      const w = warehouses.find((x) => x.id === Number(f.warehouseId))
      onSaved(`${MOVE_TITLES[f.type].split(' ')[0]} ${data.ref} registrada en ${w?.name}`, data.alerts)
    } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  return (
    <Modal size="xl" title={single ? `Inventario · ${items[0]?.product.name || ''}` : 'Entrada, ajuste o baja'} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="move-form" className="btn btn-primary" disabled={saving}>{saving ? <Spinner /> : <MdMoveToInbox />} Registrar</button></>}>
      <form id="move-form" className="stack" style={{ gap: 14 }} onSubmit={submit} noValidate>
        <div className="seg seg-wrap">{Object.entries(MOVE_TITLES).map(([k, l]) => <button key={k} type="button" className={`btn btn-sm${f.type === k ? ' on' : ''}`} onClick={() => setF((x) => ({ ...x, type: k }))}>{l}</button>)}</div>
        <div className="form-grid">
          <Field label="Bodega" htmlFor="mw" required><select id="mw" value={f.warehouseId} onChange={set('warehouseId')}><option value="">Selecciona…</option><WarehouseOptions sites={sites} warehouses={warehouses} /></select></Field>
          {f.type === 'entrada' ? <Field label="Proveedor" htmlFor="ms"><input id="ms" value={f.supplier} onChange={set('supplier')} /></Field> : <span />}
        </div>
        {!single && <div className="item-row">
          <select aria-label="Producto" value={pick} onChange={(e) => { setPick(e.target.value); add(e.target.value) }} style={{ flex: 1 }}>
            <option value="">{available.length ? 'Agregar producto…' : tracked.length ? 'Ya agregaste todos' : 'No hay productos con inventario'}</option>
            <ProductOptions products={available} />
          </select>
        </div>}
        {items.length > 0 && (
          <div className="mv-items">{items.map((i, n) => {
            const u = UNIT_SHORT[i.product.unit]
            const r = real(i)
            return (
              <div key={i.product.id} className="mv-item">
                <div className="mv-head">
                  <div className="grow"><strong>{i.product.name}</strong><small className="block muted">{[i.product.category, f.warehouseId ? `En bodega: ${fmtQty(stockIn(i.product, f.warehouseId), i.product.unit)}` : null].filter(Boolean).join(' · ')}</small></div>
                  {boxed && <div className="seg" role="group" aria-label={`Presentación de ${i.product.name}`}>
                    <button type="button" className={`btn btn-sm${!i.pack ? ' on' : ''}`} onClick={() => setItem(n, 'pack')(false)}>Por unidad</button>
                    <button type="button" className={`btn btn-sm${i.pack ? ' on' : ''}`} onClick={() => setItem(n, 'pack')(true)}>Por caja o canasta</button>
                  </div>}
                  {!single && <button type="button" className="btn btn-ghost btn-icon" aria-label={`Quitar ${i.product.name}`} onClick={() => setItems(items.filter((_, j) => j !== n))}><MdDelete /></button>}
                </div>
                {boxed && i.pack ? (
                  <div className="mv-fields four">
                    <Field label="Cajas" htmlFor={`bx${n}`}><input id={`bx${n}`} type="number" min="1" step="1" inputMode="numeric" value={i.boxes} onChange={setItem(n, 'boxes')} /></Field>
                    <Field label={`${({ und: 'Unidades', porcion: 'Porciones', botella: 'Botellas', g: 'Gramos', kg: 'Kilos', ml: 'Mililitros', l: 'Litros' })[i.product.unit] || 'Unidades'} por caja`} htmlFor={`pb${n}`}><input id={`pb${n}`} type="number" min="1" step="1" inputMode="numeric" value={i.perBox} onChange={setItem(n, 'perBox')} /></Field>
                    <Field label="Costo de cada caja" htmlFor={`bc${n}`}><MoneyInput id={`bc${n}`} value={i.boxCost} onChange={setItem(n, 'boxCost')} /></Field>
                    <div className={`mv-result${r.quantity > 0 && r.unitCost !== null ? ' ready' : ''}`}>
                      {r.quantity > 0 ? <>
                        <span>Entran <b>{fmtQty(r.quantity, i.product.unit)}</b></span>
                        <span>{r.unitCost !== null ? <>a <b>{formatMoney(r.unitCost)}</b> c/u</> : 'Falta el costo de la caja'}</span>
                        {r.unitCost !== null && <small>Total {formatMoney(Number(i.boxes) * Number(i.boxCost))}</small>}
                      </> : <small>Escribe las cajas y cuántas {u} trae cada una</small>}
                    </div>
                  </div>
                ) : (
                  <div className={`mv-fields${boxed ? ' three' : ' one'}`}>
                    <Field label={f.type === 'ajuste' ? `Cantidad (+ suma, − resta) en ${u}` : `Cantidad en ${u}`} htmlFor={`q${n}`}><input id={`q${n}`} type="number" step="any" inputMode="decimal" value={i.quantity} onChange={setItem(n, 'quantity')} /></Field>
                    {boxed && <Field label={`Costo por ${u}`} htmlFor={`uc${n}`}><MoneyInput id={`uc${n}`} value={i.unitCost} onChange={setItem(n, 'unitCost')} /></Field>}
                    {boxed && <div className={`mv-result${Number(i.quantity) > 0 ? ' ready' : ''}`}>{Number(i.quantity) > 0 ? <><span>Entran <b>{fmtQty(Number(i.quantity), i.product.unit)}</b></span><small>Total {formatMoney(Number(i.quantity) * Number(i.unitCost || 0))}</small></> : <small>Escribe la cantidad</small>}</div>}
                  </div>
                )}
              </div>
            )
          })}</div>
        )}
        <div className="form-grid">
          {f.type === 'entrada' && <Field label="N.º de factura" htmlFor="mi"><input id="mi" value={f.invoice} onChange={set('invoice')} /></Field>}
          <div className={f.type === 'entrada' ? '' : 'span-2'}><Field label={f.type === 'entrada' ? 'Nota' : 'Motivo'} htmlFor="mn" required={f.type !== 'entrada'}><input id="mn" value={f.note} onChange={set('note')} placeholder={f.type === 'baja' ? 'Ej. botella rota, producto vencido' : f.type === 'ajuste' ? 'Ej. conteo físico del cierre' : ''} /></Field></div>
        </div>
        {f.type === 'ajuste' && <small className="hint">Usa números negativos para restar y positivos para sumar.</small>}
        {error && <div className="alert bad">{error}</div>}
      </form>
    </Modal>
  )
}

// ---------- Traslado entre bodegas ----------
export const TransferModal = ({ products, sites, warehouses, defaults = {}, onClose, onSaved }) => {
  const [from, setFrom] = useState(defaults.fromWarehouseId || '')
  const [to, setTo] = useState('')
  const [note, setNote] = useState('')
  const [items, setItems] = useState([])
  const [pick, setPick] = useState('')
  const [qty, setQty] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const inFrom = (p) => stockIn(p, from)
  const available = products.filter((p) => p.active && p.trackStock && inFrom(p) > 0 && !items.some((i) => i.product.id === p.id))
  const add = () => {
    const p = products.find((x) => x.id === Number(pick))
    if (!p) return
    setItems([...items, { product: p, quantity: qty || 1 }]); setPick(''); setQty('')
  }
  const submit = async () => {
    setError('')
    if (!from || !to) return setError('Selecciona la bodega de origen y la de destino.')
    if (!items.length) return setError('Agrega al menos un producto.')
    const bad = items.find((i) => !(Number(i.quantity) > 0) || Number(i.quantity) > inFrom(i.product))
    if (bad) return setError(`Revisa la cantidad de ${bad.product.name} (disponible ${fmtQty(inFrom(bad.product), bad.product.unit)}).`)
    setSaving(true)
    try {
      const { data } = await api.post('/inventario/traslados', { fromWarehouseId: Number(from), toWarehouseId: Number(to), note, items: items.map((i) => ({ productId: i.product.id, quantity: Number(i.quantity) })) })
      onSaved(`Traslado ${data.ref} registrado`, data.alerts)
    } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  return (
    <Modal size="lg" title="Traslado entre bodegas" onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? <Spinner /> : <MdLocalShipping />} Registrar traslado</button></>}>
      <div className="stack" style={{ gap: 14 }}>
        <div className="form-grid">
          <Field label="Desde" htmlFor="tf" required><select id="tf" value={from} onChange={(e) => { setFrom(e.target.value); setItems([]) }}><option value="">Bodega de origen…</option><WarehouseOptions sites={sites} warehouses={warehouses} /></select></Field>
          <Field label="Hacia" htmlFor="tt" required><select id="tt" value={to} onChange={(e) => setTo(e.target.value)}><option value="">Bodega de destino…</option><WarehouseOptions sites={sites} warehouses={warehouses} exclude={from} /></select></Field>
        </div>
        {from && (
          <div className="item-row">
            <select aria-label="Producto" value={pick} onChange={(e) => setPick(e.target.value)} style={{ flex: 1 }}>
              <option value="">{available.length ? 'Agregar producto…' : 'No hay más productos con existencias en esta bodega'}</option>
              <ProductOptions products={available} stockOf={inFrom} />
            </select>
            <input aria-label="Cantidad" type="number" step="any" min="0" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Cant." style={{ width: 90 }} />
            <button type="button" className="btn" onClick={add} disabled={!pick}><MdAdd /> Agregar</button>
          </div>
        )}
        {items.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Producto</th><th className="num">Disponible</th><th className="num">Cantidad</th><th /></tr></thead>
              <tbody>{items.map((i, n) => (
                <tr key={i.product.id}>
                  <td><strong>{i.product.name}</strong><small className="block">{i.product.category}</small></td>
                  <td className="num">{fmtQty(inFrom(i.product), i.product.unit)}</td>
                  <td className="num"><input type="number" step="any" min="0" max={inFrom(i.product)} value={i.quantity} onChange={(e) => setItems(items.map((x, j) => (j === n ? { ...x, quantity: e.target.value } : x)))} style={{ width: 90, textAlign: 'right' }} aria-label="Cantidad" /></td>
                  <td className="right"><button type="button" className="btn btn-ghost btn-icon" aria-label="Quitar" onClick={() => setItems(items.filter((_, j) => j !== n))}><MdDelete /></button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <Field label="Nota" htmlFor="tn"><input id="tn" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motivo o quién recibe" /></Field>
        {error && <div className="alert bad">{error}</div>}
      </div>
    </Modal>
  )
}

export const WarehouseIcon = MdWarehouse
