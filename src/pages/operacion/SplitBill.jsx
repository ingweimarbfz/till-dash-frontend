import React, { useEffect, useMemo, useState } from 'react'
import { MdAdd, MdClose, MdDelete, MdPersonAdd, MdPrint } from 'react-icons/md'
import { MoneyInput } from '../../components/forms'
import { formatMoney } from '../../utils/format'
import { PAY_METHODS } from './common'

// =====================================================================
// Dividir la cuenta (TD-014): reparte el total entre personas y cada una paga lo suyo.
// · Partes iguales: el total entre el número de personas.
// · Por valor: se escribe cuánto paga cada una; las que quedan vacías se reparten el resto por igual.
// · Por productos: cada unidad se asigna a una persona (o a varias, y se comparte); descuento,
//   propina y domicilio se reparten en proporción a lo que consumió cada una.
// =====================================================================
export const SPLIT_MODES = { iguales: 'Partes iguales', valor: 'Por valor', productos: 'Por productos' }
const MAX_UNITS = 20 // Por encima, la línea se reparte completa (no unidad por unidad).
const round = (v) => Math.round(Number(v) || 0)

// Reparte un total entero según pesos sin perder pesos por redondeo (igual que el backend).
export const apportion = (total, weights) => {
  const t = round(total)
  const w = weights.map((x) => Math.max(0, Number(x) || 0))
  if (!w.length) return []
  const sum = w.reduce((a, x) => a + x, 0)
  const base = sum > 0 ? w : w.map(() => 1)
  const bsum = sum > 0 ? sum : w.length
  const raw = base.map((x) => (t * x) / bsum)
  const out = raw.map(Math.floor)
  let rest = t - out.reduce((a, x) => a + x, 0)
  const order = raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1])
  for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) out[order[k][1]] += 1
  return out
}

let seq = 0
const newPerson = (n) => ({ key: ++seq, name: '', amount: '', pays: [{ method: 'efectivo', amount: '', received: '', reference: '' }] })
const nameOf = (p, n) => p.name.trim() || `Persona ${n + 1}`

// Unidades repartibles: una fila por unidad (cantidades enteras hasta MAX_UNITS) o la línea completa.
const unitsOf = (items) => items.flatMap((i) => {
  const whole = Number.isInteger(i.quantity) && i.quantity > 1 && i.quantity <= MAX_UNITS
  return whole
    ? Array.from({ length: i.quantity }, (_, u) => ({ key: `${i.id}:${u}`, item: i, qty: 1, label: `${i.name} ${u + 1}/${i.quantity}` }))
    : [{ key: `${i.id}:0`, item: i, qty: i.quantity, label: i.quantity === 1 ? i.name : `${i.quantity} ${i.name}` }]
})

// onChange recibe { persons: [{ name, amount, items?, pays }], paid, error } cada vez que cambia algo.
const SplitBill = ({ order, total, onChange }) => {
  const [mode, setMode] = useState('iguales')
  const [persons, setPersons] = useState(() => [newPerson(0), newPerson(1)])
  const [assign, setAssign] = useState({}) // unidad → [key de persona]
  const live = useMemo(() => (order.items || []).filter((i) => i.status !== 'anulado'), [order.items])
  const units = useMemo(() => unitsOf(live), [live])

  // Consumo de cada persona en modo productos y qué unidades faltan por asignar.
  const byItems = useMemo(() => {
    const cons = persons.map(() => 0)
    const items = persons.map(() => new Map())
    let missing = 0
    for (const u of units) {
      const who = (assign[u.key] || []).map((k) => persons.findIndex((p) => p.key === k)).filter((n) => n >= 0)
      if (!who.length) { missing++; continue }
      for (const n of who) {
        const q = u.qty / who.length
        items[n].set(u.item.id, (items[n].get(u.item.id) || 0) + q)
        if (!u.item.courtesy) cons[n] += q * u.item.unitPrice
      }
    }
    return { cons, items: items.map((m) => [...m].map(([itemId, quantity]) => ({ itemId, quantity: Math.round(quantity * 10000) / 10000 }))), missing }
  }, [units, assign, persons])

  // Parte de cada persona según el modo.
  const amounts = useMemo(() => {
    if (mode === 'iguales') return apportion(total, persons.map(() => 1))
    if (mode === 'productos') return byItems.missing ? persons.map((_, n) => round(byItems.cons[n])) : apportion(total, byItems.cons)
    const typed = persons.map((p) => (p.amount === '' ? null : round(p.amount)))
    const empty = typed.filter((x) => x === null).length
    const rest = Math.max(0, total - typed.reduce((a, x) => a + (x || 0), 0))
    const shares = apportion(rest, Array(empty).fill(1))
    let k = 0
    return typed.map((x) => (x === null ? shares[k++] : x))
  }, [mode, total, persons, byItems])

  // El primer pago de cada persona sigue su parte mientras tenga una sola forma de pago.
  useEffect(() => {
    setPersons((list) => (list.some((p, n) => p.pays.length === 1 && round(p.pays[0].amount) !== amounts[n])
      ? list.map((p, n) => (p.pays.length === 1 && round(p.pays[0].amount) !== amounts[n] ? { ...p, pays: [{ ...p.pays[0], amount: amounts[n] }] } : p))
      : list))
  }, [amounts])

  const assigned = amounts.reduce((a, x) => a + x, 0)
  const paidOf = (p) => p.pays.reduce((a, x) => a + round(x.amount), 0)
  const paid = persons.reduce((a, p) => a + paidOf(p), 0)

  useEffect(() => {
    let error = null
    if (mode === 'productos' && byItems.missing) error = `Faltan ${byItems.missing} producto${byItems.missing === 1 ? '' : 's'} por asignar a una persona.`
    else if (assigned !== total) error = assigned < total ? `Faltan ${formatMoney(total - assigned)} por repartir entre las personas.` : `Las partes superan el total en ${formatMoney(assigned - total)}.`
    else {
      const n = persons.findIndex((p, i) => !(amounts[i] > 0))
      if (n >= 0) error = `${nameOf(persons[n], n)} no tiene nada que pagar: quítala del reparto.`
      else {
        const m = persons.findIndex((p, i) => paidOf(p) !== amounts[i])
        if (m >= 0) error = `Los pagos de ${nameOf(persons[m], m)} no suman su parte (${formatMoney(amounts[m])}).`
      }
    }
    onChange({
      mode, paid, error,
      persons: persons.map((p, n) => ({ name: nameOf(p, n), amount: amounts[n], items: mode === 'productos' ? byItems.items[n] : undefined, consumption: mode === 'productos' ? round(byItems.cons[n]) : undefined, pays: p.pays }))
    })
  }, [mode, persons, amounts, byItems, assigned, total, paid]) // eslint-disable-line react-hooks/exhaustive-deps

  const setPerson = (n, patch) => setPersons((list) => list.map((p, j) => (j === n ? { ...p, ...patch } : p)))
  const setPay = (n, k, f) => (v) => setPerson(n, { pays: persons[n].pays.map((x, j) => (j === k ? { ...x, [f]: v?.target ? v.target.value : v } : x)) })
  const addPay = (n) => setPerson(n, { pays: [...persons[n].pays, { method: 'tarjeta', amount: Math.max(0, amounts[n] - paidOf(persons[n])), received: '', reference: '' }] })
  const addPerson = () => persons.length < 20 && setPersons([...persons, newPerson(persons.length)])
  const removePerson = (n) => {
    const key = persons[n].key
    setPersons(persons.filter((_, j) => j !== n))
    setAssign((a) => Object.fromEntries(Object.entries(a).map(([u, ks]) => [u, ks.filter((k) => k !== key)])))
  }
  const toggle = (u, key) => setAssign((a) => {
    const cur = a[u] || []
    return { ...a, [u]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] }
  })
  const allTo = (u) => setAssign((a) => ({ ...a, [u]: (a[u] || []).length === persons.length ? [] : persons.map((p) => p.key) }))
  // Asigna a una persona todo lo que falta (atajo para "lo demás es de Juan").
  const restTo = (key) => setAssign((a) => Object.fromEntries(units.map((u) => [u.key, (a[u.key] || []).length ? a[u.key] : [key]])))

  return (
    <div className="split stack" style={{ gap: 12 }}>
      <div className="seg seg-wrap" role="tablist" aria-label="Cómo dividir">
        {Object.entries(SPLIT_MODES).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={mode === k} className={`btn btn-sm${mode === k ? ' on' : ''}`} onClick={() => setMode(k)}>{l}</button>)}
      </div>
      <small className="muted">
        {mode === 'iguales' && `El total se divide en ${persons.length} partes iguales.`}
        {mode === 'valor' && 'Escribe cuánto paga cada persona. Las que dejes vacías se reparten por igual lo que falta.'}
        {mode === 'productos' && 'Toca el nombre de quién consumió cada producto. Si tocas varios, se comparte por partes iguales. Descuento, propina y domicilio se reparten según lo que consumió cada uno.'}
      </small>

      {mode === 'productos' && (
        <div className="split-items">
          {units.map((u) => {
            const who = assign[u.key] || []
            return (
              <div key={u.key} className={`split-unit${who.length ? '' : ' missing'}`}>
                <span className="split-unit-name"><span>{u.label}{u.item.courtesy && <em> · cortesía</em>}</span><small>{u.item.courtesy ? '$0' : formatMoney(u.qty * u.item.unitPrice)}</small></span>
                <span className="chip-list">
                  {persons.map((p, n) => <button key={p.key} type="button" className={`pchip sm${who.includes(p.key) ? ' on' : ''}`} aria-pressed={who.includes(p.key)} onClick={() => toggle(u.key, p.key)}>{nameOf(p, n)}</button>)}
                  <button type="button" className={`pchip sm${who.length === persons.length ? ' on' : ''}`} onClick={() => allTo(u.key)}>Todos</button>
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div className="split-persons">
        {persons.map((p, n) => {
          const change = p.pays.filter((x) => x.method === 'efectivo').reduce((a, x) => a + Math.max(0, round(x.received) - round(x.amount)), 0)
          const left = amounts[n] - paidOf(p)
          return (
            <div key={p.key} className="split-person">
              <header>
                <input className="split-name" value={p.name} placeholder={`Persona ${n + 1}`} aria-label={`Nombre de la persona ${n + 1}`} maxLength={40} onChange={(e) => setPerson(n, { name: e.target.value })} />
                {mode === 'valor'
                  ? <div style={{ width: 150 }}><MoneyInput value={p.amount} placeholder={(amounts[n] || 0).toLocaleString('es-CO')} onChange={(v) => setPerson(n, { amount: v })} aria-label={`Parte de ${nameOf(p, n)}`} /></div>
                  : <strong className="money">{formatMoney(amounts[n])}</strong>}
                {persons.length > 2 && <button type="button" className="btn btn-ghost btn-icon" aria-label={`Quitar a ${nameOf(p, n)}`} onClick={() => removePerson(n)}><MdClose /></button>}
              </header>
              {mode === 'productos' && (
                <small className="muted">
                  Consumo {formatMoney(byItems.cons[n])}
                  {byItems.missing > 0 && <> · <button type="button" className="link-btn split-link" onClick={() => restTo(p.key)}>Asignarle lo que falta</button></>}
                </small>
              )}
              {p.pays.map((x, k) => (
                <div key={k} className="pay-row">
                  <select value={x.method} onChange={setPay(n, k, 'method')} aria-label={`Forma de pago de ${nameOf(p, n)}`}>{Object.entries(PAY_METHODS).map(([m, l]) => <option key={m} value={m}>{l}</option>)}</select>
                  <MoneyInput value={x.amount} onChange={setPay(n, k, 'amount')} aria-label="Valor" />
                  {x.method === 'efectivo'
                    ? <MoneyInput value={x.received} onChange={setPay(n, k, 'received')} placeholder="Recibido" aria-label="Efectivo recibido" />
                    : x.method === 'cuenta_por_cobrar' ? <span /> : <input value={x.reference} onChange={setPay(n, k, 'reference')} placeholder="Referencia" aria-label="Referencia" />}
                  {p.pays.length > 1 ? <button type="button" className="btn btn-ghost btn-icon" aria-label="Quitar pago" onClick={() => setPerson(n, { pays: p.pays.filter((_, j) => j !== k) })}><MdDelete /></button> : <span />}
                </div>
              ))}
              <footer>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => addPay(n)}><MdAdd /> Otra forma de pago</button>
                {left !== 0 && <span className="badge bad">{left > 0 ? `Faltan ${formatMoney(left)}` : `Sobran ${formatMoney(-left)}`}</span>}
                {change > 0 && <span className="badge split-change">Cambio {formatMoney(change)}</span>}
              </footer>
            </div>
          )
        })}
      </div>
      <button type="button" className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={addPerson} disabled={persons.length >= 20}><MdPersonAdd /> Agregar persona</button>
    </div>
  )
}

export const SplitPrintButton = ({ onPrint, disabled }) => (
  <button type="button" className="btn" onClick={onPrint} disabled={disabled}><MdPrint /> Cuentas por persona</button>
)

export default SplitBill
