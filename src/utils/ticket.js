import { formatMoney } from './format'
import { printDoc } from './printer'

// Tiquetes de precuenta y de cobro. Se arman como bloques (ver utils/printer.js) y salen por la impresora
// configurada en este computador: el cuadro de impresión del navegador o la térmica por medio del agente (TD-018).

const now = () => new Date().toLocaleString('es-CO')

// Encabezado con los datos del establecimiento (los que estén diligenciados en Configuración).
const header = (settings) => [
  { type: 'title', text: settings.businessName || 'TillDash+' },
  ...(settings.nit ? [{ type: 'center', text: `NIT ${settings.nit}` }] : []),
  ...([settings.address, settings.city].filter(Boolean).length ? [{ type: 'center', text: [settings.address, settings.city].filter(Boolean).join(', ') }] : []),
  ...(settings.phone ? [{ type: 'center', text: `Tel. ${settings.phone}` }] : [])
]
const footer = (settings, extra = []) => [
  ...extra,
  ...(settings.receiptFooter ? [{ type: 'center', text: settings.receiptFooter }] : []),
  { type: 'center', text: 'Este documento no es una factura.' }
]
const where = (o) => [o.table || o.typeLabel || '', o.waiter?.name ? `Atiende: ${o.waiter.name}` : ''].filter(Boolean).join(' · ')

// Precuenta o tiquete de cobro. tip: valor de la propina (0 o null: el cliente no la quiso y no aparece).
// Con kind 'cuenta' y algún pago en efectivo, abre el cajón monedero si está activado en la impresora.
export const orderTicket = ({ o, settings, kind = 'precuenta', tip = 0, tipPct = null, discount = 0, total = null, payments = [], deliveryFee = null, cash = false }) => {
  const fee = deliveryFee ?? o.deliveryFee ?? 0
  const disc = discount || o.discountTotal || 0
  const grand = total ?? o.subtotal - disc + (tip || 0) + fee
  const items = (o.items || []).filter((i) => i.status !== 'anulado')
    .map((i) => ({ type: 'row', left: `${i.quantity} ${i.name}${i.courtesy ? ' (cortesía)' : ''}`, right: i.courtesy ? '$0' : formatMoney(i.total) }))
  const blocks = [
    ...header(settings),
    { type: 'hr' },
    { type: 'center', bold: true, text: `${kind === 'precuenta' ? 'PRECUENTA' : 'CUENTA PAGADA'} · ${o.number}` },
    ...(where(o) ? [{ type: 'center', text: where(o) }] : []),
    { type: 'center', text: now() },
    { type: 'hr' },
    ...items,
    { type: 'hr' },
    { type: 'row', left: 'Subtotal', right: formatMoney(o.subtotal) },
    ...(disc ? [{ type: 'row', left: 'Descuento', right: `−${formatMoney(disc)}` }] : []),
    ...(fee > 0 ? [{ type: 'row', left: 'Domicilio', right: formatMoney(fee) }] : []),
    ...(tip > 0 ? [{ type: 'row', left: `Propina${tipPct ? ` (${tipPct} %)` : ''}`, right: formatMoney(tip) }] : []),
    { type: 'row', big: true, left: tip > 0 ? 'Total con propina' : 'Total', right: formatMoney(grand) },
    ...payments.map((p) => ({ type: 'row', left: p.label, right: formatMoney(p.amount) })),
    ...(payments.some((p) => p.change > 0) ? [{ type: 'row', left: 'Cambio', right: formatMoney(payments.reduce((a, p) => a + (p.change || 0), 0)) }] : []),
    { type: 'hr' },
    ...footer(settings, tip > 0 ? [{ type: 'center', text: 'La propina es voluntaria y fue aceptada por el cliente.' }] : [])
  ]
  return printDoc({ title: `${kind === 'precuenta' ? 'Precuenta' : 'Cuenta'} ${o.number}`, blocks, drawer: kind === 'cuenta' && cash })
}

// Cuenta dividida (TD-014): un tiquete por persona con su parte (y sus productos si se dividió por productos).
// persons: [{ name, amount, items?: [{ itemId, quantity }], consumption?, pays?: [{ method, amount }] }]
export const splitTickets = ({ o, settings, persons, mode, kind = 'precuenta', tip = 0, payLabels = {}, cash = false }) => {
  const byId = new Map((o.items || []).map((i) => [i.id, i]))
  // Cantidades compartidas: 1/2, 1/3, 2/3… (o con coma decimal si no es una fracción sencilla).
  const qty = (q) => {
    if (Number.isInteger(q)) return q
    for (let d = 2; d <= 12; d++) if (Math.abs(q * d - Math.round(q * d)) < 0.01) return `${Math.round(q * d)}/${d}`
    return Number(q).toFixed(2).replace(/\.?0+$/, '').replace('.', ',')
  }
  const head = kind === 'precuenta' ? 'PRECUENTA' : 'CUENTA PAGADA'
  const all = persons.reduce((a, x) => a + x.amount, 0)
  const blocks = persons.flatMap((p, n) => {
    const items = mode === 'productos' ? (p.items || []).map((a) => {
      const i = byId.get(a.itemId)
      return i ? { type: 'row', left: `${qty(a.quantity)} ${i.name}${i.courtesy ? ' (cortesía)' : ''}`, right: i.courtesy ? '$0' : formatMoney(Math.round(a.quantity * i.unitPrice)) } : null
    }).filter(Boolean) : []
    const pays = kind === 'precuenta' ? [] : (p.pays || []).map((x) => ({ type: 'row', left: payLabels[x.method] || x.method, right: formatMoney(Math.round(Number(x.amount) || 0)) }))
    return [
      ...(n ? [{ type: 'break' }] : []),
      ...header(settings),
      { type: 'hr' },
      { type: 'center', bold: true, text: `${head} · ${o.number}` },
      ...(where(o) ? [{ type: 'center', text: where(o) }] : []),
      { type: 'center', text: now() },
      { type: 'center', bold: true, text: `${p.name} · ${n + 1} de ${persons.length}` },
      { type: 'hr' },
      ...(items.length ? items : [{ type: 'center', text: `Cuenta total ${formatMoney(all)} dividida ${mode === 'iguales' ? `en ${persons.length} partes iguales` : 'por valor'}` }]),
      { type: 'hr' },
      ...(mode === 'productos' && p.consumption !== undefined && p.consumption !== p.amount ? [{ type: 'row', left: 'Su consumo', right: formatMoney(p.consumption) }] : []),
      { type: 'row', big: true, left: tip > 0 ? 'A pagar (incluye propina)' : 'A pagar', right: formatMoney(p.amount) },
      ...pays,
      { type: 'hr' },
      ...footer(settings)
    ]
  })
  return printDoc({ title: `Cuenta dividida ${o.number}`, blocks, drawer: kind === 'cuenta' && cash })
}

// Tiquete de prueba para la pantalla de la impresora.
export const testTicket = (settings, cfg) => printDoc({
  title: 'Prueba de impresión',
  cfg,
  blocks: [
    ...header(settings),
    { type: 'hr' },
    { type: 'center', bold: true, text: 'PRUEBA DE IMPRESIÓN' },
    { type: 'center', text: now() },
    { type: 'hr' },
    { type: 'row', left: '2 Limonada de coco', right: formatMoney(18000) },
    { type: 'row', left: '1 Hamburguesa doble con queso y tocineta artesanal', right: formatMoney(32000) },
    { type: 'row', left: '1 Postre (cortesía)', right: '$0' },
    { type: 'hr' },
    { type: 'row', big: true, left: 'Total', right: formatMoney(50000) },
    { type: 'hr' },
    { type: 'center', text: 'Tildes y eñes: áéíóú ÁÉÍÓÚ ñÑ ¿¡ °' },
    { type: 'center', text: `Papel de ${Number(cfg?.width) === 58 ? 58 : 80} mm` }
  ]
})
