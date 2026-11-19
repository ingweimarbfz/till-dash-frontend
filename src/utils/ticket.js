import { formatMoney } from './format'

// Tiquetes térmicos (80 mm). La ventana se abre grande y el tiquete se imprime al ancho del rollo,
// con letra legible; en una impresora normal sale centrado y a buen tamaño.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const CSS = `
@page { size: 80mm auto; margin: 3mm; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #f2f2f2; }
body { font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-size: 15px; line-height: 1.35; color: #000; }
.tk { width: 74mm; max-width: 100%; margin: 16px auto; background: #fff; padding: 5mm 4mm; box-shadow: 0 4px 18px rgba(0,0,0,.12); }
h3 { font-size: 19px; text-align: center; margin: 0 0 4px; }
p { text-align: center; margin: 3px 0; }
table { width: 100%; border-collapse: collapse; }
td { padding: 3px 0; vertical-align: top; }
td.r { text-align: right; white-space: nowrap; padding-left: 8px; }
hr { border: 0; border-top: 1px dashed #000; margin: 8px 0; }
.big td { font-size: 18px; font-weight: 700; }
.bar { position: sticky; top: 0; display: flex; gap: 8px; justify-content: center; padding: 10px; background: #1F2933; }
.bar button { font: 600 15px system-ui, sans-serif; padding: 9px 18px; border-radius: 8px; border: 0; cursor: pointer; background: #E4572E; color: #fff; }
.bar button.sec { background: #fff; color: #1F2933; }
@media print { html, body { background: #fff; } .bar { display: none; } .tk { width: 100%; margin: 0; padding: 0; box-shadow: none; } }
`
export const printTicket = ({ title, body }) => {
  const w = window.open('', '_blank', 'width=520,height=860')
  if (!w) return false
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>
<div class="bar"><button onclick="window.print()">Imprimir</button><button class="sec" onclick="window.close()">Cerrar</button></div>
<div class="tk">${body}</div>
<script>window.onload=()=>{setTimeout(()=>window.print(),250)}<\/script></body></html>`)
  w.document.close()
  return true
}

const line = (l, r, cls = '') => `<tr class="${cls}"><td>${l}</td><td class="r">${r}</td></tr>`

// Precuenta o tiquete de cobro. tip: valor de la propina (0 o null: el cliente no la quiso y no aparece).
export const orderTicket = ({ o, settings, kind = 'precuenta', tip = 0, tipPct = null, discount = 0, total = null, payments = [], deliveryFee = null }) => {
  const fee = deliveryFee ?? o.deliveryFee ?? 0
  const items = (o.items || []).filter((i) => i.status !== 'anulado')
    .map((i) => line(`${i.quantity} ${esc(i.name)}${i.courtesy ? ' (cortesía)' : ''}`, i.courtesy ? '$0' : formatMoney(i.total))).join('')
  const base = o.subtotal - (discount || o.discountTotal || 0)
  const grand = total ?? base + (tip || 0) + fee
  const head = kind === 'precuenta' ? 'PRECUENTA' : 'CUENTA PAGADA'
  const body = `<h3>${esc(settings.businessName)}</h3><p>${head} · ${esc(o.number)}</p><p>${esc(o.table || o.typeLabel || '')} · ${new Date().toLocaleString('es-CO')}</p><hr/>
<table>${items}</table><hr/><table>
${line('Subtotal', formatMoney(o.subtotal))}
${(discount || o.discountTotal) ? line('Descuento', `−${formatMoney(discount || o.discountTotal)}`) : ''}
${fee > 0 ? line('Domicilio', formatMoney(fee)) : ''}
${tip > 0 ? line(`Propina${tipPct ? ` (${tipPct} %)` : ''}`, formatMoney(tip)) : ''}
${line(tip > 0 ? 'Total con propina' : 'Total', formatMoney(grand), 'big')}
${payments.map((p) => line(esc(p.label), formatMoney(p.amount))).join('')}
</table><hr/>
${tip > 0 ? '<p>La propina es voluntaria y fue aceptada por el cliente.</p>' : ''}
${settings.receiptFooter ? `<p>${esc(settings.receiptFooter)}</p>` : ''}<p>Este documento no es una factura.</p>`
  return printTicket({ title: `${kind === 'precuenta' ? 'Precuenta' : 'Cuenta'} ${o.number}`, body })
}

// Cuenta dividida (TD-014): un tiquete por persona con su parte (y sus productos si se dividió por productos).
// persons: [{ name, amount, items?: [{ itemId, quantity }], consumption?, pays?: [{ method, amount }] }]
export const splitTickets = ({ o, settings, persons, mode, kind = 'precuenta', tip = 0, payLabels = {} }) => {
  const byId = new Map((o.items || []).map((i) => [i.id, i]))
  // Cantidades compartidas: 1/2, 1/3, 2/3… (o con coma decimal si no es una fracción sencilla).
  const qty = (q) => {
    if (Number.isInteger(q)) return q
    for (let d = 2; d <= 12; d++) if (Math.abs(q * d - Math.round(q * d)) < 0.01) return `${Math.round(q * d)}/${d}`
    return Number(q).toFixed(2).replace(/\.?0+$/, '').replace('.', ',')
  }
  const head = kind === 'precuenta' ? 'PRECUENTA' : 'CUENTA PAGADA'
  const body = persons.map((p, n) => {
    const items = mode === 'productos' ? (p.items || []).map((a) => {
      const i = byId.get(a.itemId)
      return i ? line(`${qty(a.quantity)} ${esc(i.name)}${i.courtesy ? ' (cortesía)' : ''}`, i.courtesy ? '$0' : formatMoney(Math.round(a.quantity * i.unitPrice))) : ''
    }).join('') : ''
    const pays = kind === 'precuenta' ? '' : (p.pays || []).map((x) => line(esc(payLabels[x.method] || x.method), formatMoney(Math.round(Number(x.amount) || 0)))).join('')
    return `<div style="${n ? 'page-break-before: always; margin-top: 18px;' : ''}"><h3>${esc(settings.businessName)}</h3><p>${head} · ${esc(o.number)}</p>
<p>${esc(o.table || o.typeLabel || '')} · ${new Date().toLocaleString('es-CO')}</p><p><b>${esc(p.name)}</b> · ${n + 1} de ${persons.length}</p><hr/>
${items ? `<table>${items}</table><hr/>` : `<p>Cuenta total ${formatMoney(persons.reduce((a, x) => a + x.amount, 0))} dividida ${mode === 'iguales' ? `en ${persons.length} partes iguales` : 'por valor'}</p><hr/>`}
<table>${mode === 'productos' && p.consumption !== undefined && p.consumption !== p.amount ? line('Su consumo', formatMoney(p.consumption)) : ''}
${line(tip > 0 ? 'A pagar (incluye propina)' : 'A pagar', formatMoney(p.amount), 'big')}${pays}</table><hr/>
${settings.receiptFooter ? `<p>${esc(settings.receiptFooter)}</p>` : ''}<p>Este documento no es una factura.</p></div>`
  }).join('')
  return printTicket({ title: `Cuenta dividida ${o.number}`, body })
}
