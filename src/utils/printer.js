// =====================================================================
// Impresión de tiquetes (TD-018)
// La impresora es de cada computador, así que su configuración se guarda en este navegador:
//   · navegador: abre el cuadro de impresión del sistema (cualquier impresora de Windows o Mac, sin instalar nada).
//   · usb:       directo a la impresora térmica instalada en el computador, por medio del agente local.
//   · red:       directo a la impresora térmica por IP (puerto 9100), también por medio del agente local
//                (el navegador no puede abrir conexiones a la red local por sí solo).
// Los tiquetes se describen como una lista de bloques y se pintan en HTML o en comandos ESC/POS.
// =====================================================================

export const AGENT_URL = 'http://127.0.0.1:17321'
const KEY = 'tilldash.impresora'

export const PRINTER_DEFAULTS = { mode: 'navegador', printer: '', ip: '', port: 9100, width: 80, copies: 1, autoPrint: false, openDrawer: false, cut: true, askBeforeCharge: true }

export const getPrinterConfig = () => {
  try { return { ...PRINTER_DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return { ...PRINTER_DEFAULTS } }
}
export const savePrinterConfig = (cfg) => {
  try { localStorage.setItem(KEY, JSON.stringify(cfg)) } catch { /* modo privado: queda solo en esta sesión */ }
}
export const usesAgent = (cfg = getPrinterConfig()) => cfg.mode === 'usb' || cfg.mode === 'red'

// ---------- Agente local ----------
const agentFetch = async (path, { method = 'GET', body, timeout = 4000 } = {}) => {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(`${AGENT_URL}${path}`, {
      method, signal: ctrl.signal, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || `El agente respondió ${res.status}`)
    return data
  } catch (e) {
    if (e.name === 'AbortError' || e instanceof TypeError) throw new Error('No se encontró el agente de impresión en este computador. Ábrelo o instálalo desde Impresora.')
    throw e
  } finally { clearTimeout(t) }
}
export const agentStatus = () => agentFetch('/estado', { timeout: 2500 })
export const agentPrinters = () => agentFetch('/impresoras', { timeout: 15000 }).then((d) => d.printers || [])

// ---------- ESC/POS ----------
// Página de códigos PC850 (ESC t 2): la que traen casi todas las térmicas y tiene las tildes y la ñ.
const CP850 = {
  'Ç': 0x80, 'ü': 0x81, 'é': 0x82, 'â': 0x83, 'ä': 0x84, 'à': 0x85, 'ç': 0x87, 'ê': 0x88, 'è': 0x8A, 'ï': 0x8B, 'î': 0x8C,
  'Ä': 0x8E, 'É': 0x90, 'ô': 0x93, 'ö': 0x94, 'ò': 0x95, 'û': 0x96, 'ù': 0x97, 'Ö': 0x99, 'Ü': 0x9A, 'á': 0xA0, 'í': 0xA1,
  'ó': 0xA2, 'ú': 0xA3, 'ñ': 0xA4, 'Ñ': 0xA5, 'ª': 0xA6, 'º': 0xA7, '¿': 0xA8, '¡': 0xAD, 'Á': 0xB5, 'Â': 0xB6, 'À': 0xB7,
  'Ê': 0xD2, 'È': 0xD4, 'Í': 0xD6, 'Î': 0xD7, 'Ó': 0xE0, 'Ô': 0xE2, 'Ò': 0xE3, 'Ú': 0xE9, 'Û': 0xEA, 'Ù': 0xEB, '°': 0xF8, '·': 0xFA
}
const SAME = { ' ': ' ', ' ': ' ', ' ': ' ', '−': '-', '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '…': '...', '€': 'EUR' }
// Texto a como lo verá la impresora (para medir y cortar las líneas con el mismo largo con que se imprimen).
const plain = (s) => [...String(s ?? '')].map((c) => SAME[c] ?? c).join('')
const encodeText = (s) => {
  const out = []
  for (const c of plain(s)) {
    const code = c.charCodeAt(0)
    if (code < 0x80) out.push(code === 9 ? 32 : code)
    else if (CP850[c] !== undefined) out.push(CP850[c])
    else {
      const base = c.normalize('NFD').replace(/[̀-ͯ]/g, '')
      out.push(...(base && base.charCodeAt(0) < 0x80 ? [...base].map((x) => x.charCodeAt(0)) : [0x3F]))
    }
  }
  return out
}

// Parte un texto en líneas de hasta n caracteres (por palabras; corta las palabras más largas que la línea).
export const wrap = (text, n) => {
  const lines = []
  for (const para of plain(text).split('\n')) {
    let cur = ''
    for (let word of para.split(/\s+/).filter(Boolean)) {
      while (word.length > n) { if (cur) { lines.push(cur); cur = '' } lines.push(word.slice(0, n)); word = word.slice(n) }
      if (!word) continue
      if (!cur) cur = word
      else if (cur.length + 1 + word.length <= n) cur += ` ${word}`
      else { lines.push(cur); cur = word }
    }
    lines.push(cur)
  }
  return lines
}

// Fila izquierda/derecha: el valor va a la derecha de la primera línea y el texto sigue debajo si no cabe.
export const rowLines = (left, right, cols) => {
  const r = plain(right)
  const room = Math.max(8, cols - r.length - 1)
  const parts = wrap(left, room)
  return parts.map((p, i) => (i === 0 ? p + ' '.repeat(Math.max(1, cols - p.length - r.length)) + r : p))
}

const ESC = 0x1B
const GS = 0x1D
export const COLUMNS = { 58: 32, 80: 48 }

export const toEscPos = (blocks, { width = 80, cut = true, drawer = false } = {}) => {
  const cols = COLUMNS[width] || 48
  const b = [ESC, 0x40, ESC, 0x74, 2]
  const align = (n) => b.push(ESC, 0x61, n)
  const bold = (on) => b.push(ESC, 0x45, on ? 1 : 0)
  const size = (n) => b.push(GS, 0x21, n)
  const text = (s) => { b.push(...encodeText(s)); b.push(0x0A) }
  const finish = () => { b.push(ESC, 0x64, 4); if (cut) b.push(GS, 0x56, 66, 0) }
  if (drawer) b.push(ESC, 0x70, 0, 25, 250)
  for (const k of blocks) {
    if (k.type === 'title') { align(1); bold(true); size(0x11); wrap(k.text, Math.floor(cols / 2)).forEach(text); size(0); bold(false) }
    else if (k.type === 'center') { align(1); if (k.bold) bold(true); wrap(k.text, cols).forEach(text); if (k.bold) bold(false) }
    else if (k.type === 'text') { align(0); wrap(k.text, cols).forEach(text) }
    else if (k.type === 'row') {
      align(0)
      if (k.big) { bold(true); size(0x01) }
      rowLines(k.left, k.right, cols).forEach(text)
      if (k.big) { size(0); bold(false) }
    } else if (k.type === 'hr') { align(0); text('-'.repeat(cols)) }
    else if (k.type === 'break') { finish(); b.push(ESC, 0x40, ESC, 0x74, 2) }
  }
  align(0)
  finish()
  return new Uint8Array(b)
}

const toBase64 = (bytes) => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

// ---------- HTML (cuadro de impresión del navegador) ----------
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const css = (width) => `
@page { size: ${width}mm auto; margin: 3mm; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #f2f2f2; }
body { font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-size: ${width === 58 ? 13 : 15}px; line-height: 1.35; color: #000; }
.tk { width: ${width - 6}mm; max-width: 100%; margin: 16px auto; background: #fff; padding: 5mm 4mm; box-shadow: 0 4px 18px rgba(0,0,0,.12); }
h3 { font-size: ${width === 58 ? 17 : 19}px; text-align: center; margin: 0 0 4px; }
p { text-align: center; margin: 3px 0; }
p.l { text-align: left; }
table { width: 100%; border-collapse: collapse; }
td { padding: 3px 0; vertical-align: top; }
td.r { text-align: right; white-space: nowrap; padding-left: 8px; }
hr { border: 0; border-top: 1px dashed #000; margin: 8px 0; }
tr.big td { font-size: ${width === 58 ? 16 : 18}px; font-weight: 700; }
.pb { page-break-before: always; margin-top: 18px; }
.bar { position: sticky; top: 0; display: flex; gap: 8px; justify-content: center; padding: 10px; background: #1F2933; }
.bar button { font: 600 15px system-ui, sans-serif; padding: 9px 18px; border-radius: 8px; border: 0; cursor: pointer; background: #E4572E; color: #fff; }
.bar button.sec { background: #fff; color: #1F2933; }
@media print { html, body { background: #fff; } .bar { display: none; } .tk { width: 100%; margin: 0; padding: 0; box-shadow: none; } }
`
export const toHtml = (blocks) => {
  let html = ''
  let rows = ''
  const flush = () => { if (rows) { html += `<table>${rows}</table>`; rows = '' } }
  for (const k of blocks) {
    if (k.type === 'row') { rows += `<tr class="${k.big ? 'big' : ''}"><td>${esc(k.left)}</td><td class="r">${esc(k.right)}</td></tr>`; continue }
    flush()
    if (k.type === 'title') html += `<h3>${esc(k.text)}</h3>`
    else if (k.type === 'center') html += `<p>${k.bold ? `<b>${esc(k.text)}</b>` : esc(k.text)}</p>`
    else if (k.type === 'text') html += `<p class="l">${esc(k.text)}</p>`
    else if (k.type === 'hr') html += '<hr/>'
    else if (k.type === 'break') html += '<div class="pb"></div>'
  }
  flush()
  return html
}

const browserPrint = ({ title, blocks, width }) => {
  const w = window.open('', '_blank', 'width=520,height=860')
  if (!w) return false
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css(width)}</style></head><body>
<div class="bar"><button onclick="window.print()">Imprimir</button><button class="sec" onclick="window.close()">Cerrar</button></div>
<div class="tk">${toHtml(blocks)}</div>
<script>window.onload=()=>{setTimeout(()=>window.print(),250)}<\/script></body></html>`)
  w.document.close()
  return true
}

// Avisos para toda la app (los muestra PrintNotices): impreso, o por qué no se pudo.
const notify = (detail) => window.dispatchEvent(new CustomEvent('tilldash:impresion', { detail }))

export const sendToAgent = (bytes, cfg = getPrinterConfig()) => agentFetch('/imprimir', {
  method: 'POST', timeout: 25000,
  body: { mode: cfg.mode, printer: cfg.printer || undefined, ip: cfg.ip, port: Number(cfg.port) || 9100, copies: Number(cfg.copies) || 1, data: toBase64(bytes) }
})

// Imprime un tiquete con la impresora de este computador.
// drawer: abre el cajón monedero (si está activado en la configuración); solo se usa al cobrar en efectivo.
// Devuelve una promesa con { ok, error? }; en modo navegador abre la ventana enseguida (sin esperar).
export const printDoc = ({ title, blocks, drawer = false, cfg = getPrinterConfig() }) => {
  const width = Number(cfg.width) === 58 ? 58 : 80
  if (!usesAgent(cfg)) {
    const ok = browserPrint({ title, blocks, width })
    if (!ok) notify({ ok: false, error: 'El navegador bloqueó la ventana del tiquete. Permite las ventanas emergentes para este sitio.' })
    return Promise.resolve({ ok })
  }
  const bytes = toEscPos(blocks, { width, cut: cfg.cut !== false, drawer: drawer && cfg.openDrawer })
  return sendToAgent(bytes, cfg)
    .then(() => { notify({ ok: true, message: `${title} enviado a la impresora` }); return { ok: true } })
    .catch((e) => { notify({ ok: false, error: e.message, fallback: { title, blocks, width } }); return { ok: false, error: e.message } })
}

// Si la térmica falla, el aviso ofrece imprimir por el navegador (desde un clic, para que no se bloquee la ventana).
export const printFallback = (fb) => browserPrint(fb)

export const openDrawer = (cfg = getPrinterConfig()) => sendToAgent(new Uint8Array([ESC, 0x40, ESC, 0x70, 0, 25, 250]), cfg)
