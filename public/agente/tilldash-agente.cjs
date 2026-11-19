#!/usr/bin/env node
// =====================================================================
// Agente de impresión de TillDash+ (TD-018)
// Corre en el computador de la caja y recibe los tiquetes del navegador para mandarlos a la impresora
// térmica sin abrir el cuadro de impresión:
//   · USB / instalada en el sistema: Windows (cola de impresión en modo RAW) y Mac/Linux (CUPS: lp -o raw).
//   · Por red (IP): directo al puerto 9100 de la impresora.
// Solo escucha en este computador (127.0.0.1) y solo acepta pedidos de TillDash+ (--origen).
// No necesita instalar paquetes: solo Node.js 16 o superior.
//   node tilldash-agente.cjs --origen https://mi-tilldash.vercel.app
// =====================================================================
const http = require('http')
const net = require('net')
const os = require('os')
const fs = require('fs')
const path = require('path')
const { execFile } = require('child_process')

const VERSION = '1.0.0'
const PORT = Number(process.env.TILLDASH_AGENTE_PUERTO) || 17321
const MAX_BODY = 2 * 1024 * 1024

const args = process.argv.slice(2)
const ORIGINS = new Set()
for (let i = 0; i < args.length; i++) if (args[i] === '--origen' && args[i + 1]) ORIGINS.add(args[++i].replace(/\/+$/, ''))
for (const o of String(process.env.TILLDASH_ORIGENES || '').split(',')) if (o.trim()) ORIGINS.add(o.trim().replace(/\/+$/, ''))
// Desarrollo local: cualquier puerto de localhost.
const allowed = (origin) => !!origin && (ORIGINS.has(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))

const isWin = process.platform === 'win32'
const log = (...a) => console.log(new Date().toLocaleTimeString(), ...a)

const run = (cmd, argv, opts = {}) => new Promise((resolve, reject) => {
  execFile(cmd, argv, { windowsHide: true, timeout: 20000, maxBuffer: 4 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
    if (err) return reject(new Error(String(stderr || err.message).trim()))
    resolve(String(stdout))
  })
})

// ---------- Impresoras instaladas ----------
const listPrinters = async () => {
  if (isWin) {
    const out = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      'Get-CimInstance Win32_Printer | Select-Object Name,Default,PortName | ConvertTo-Json -Compress'])
    if (!out.trim()) return []
    const list = [].concat(JSON.parse(out))
    return list.map((p) => ({ name: p.Name, default: !!p.Default, port: p.PortName || null }))
  }
  let def = null
  try { def = ((await run('lpstat', ['-d'])).match(/:\s*(.+)\s*$/m) || [])[1] || null } catch { /* sin predeterminada */ }
  let names = []
  try { names = (await run('lpstat', ['-e'])).split('\n').map((s) => s.trim()).filter(Boolean) } catch {
    names = (await run('lpstat', ['-a'])).split('\n').map((s) => s.split(' ')[0]).filter(Boolean)
  }
  return [...new Set(names)].map((name) => ({ name, default: name === def }))
}

// ---------- Impresión ----------
// Windows: la API de la cola de impresión (winspool) en modo RAW, para que los comandos ESC/POS lleguen tal cual.
const WIN_RAW = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public class TdRaw {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public class DOCINFO { public string pDocName; public string pOutputFile; public string pDataType; }
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr d);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool StartDocPrinter(IntPtr h, int l, DOCINFO di);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool WritePrinter(IntPtr h, byte[] b, int c, out int w);
  public static void Send(string printer, byte[] bytes) {
    IntPtr h; if (!OpenPrinter(printer, out h, IntPtr.Zero)) throw new Exception("No se encontró la impresora " + printer);
    try {
      DOCINFO di = new DOCINFO(); di.pDocName = "TillDash+"; di.pDataType = "RAW";
      if (!StartDocPrinter(h, 1, di)) throw new Exception("La impresora no aceptó el trabajo");
      StartPagePrinter(h); int w; bool ok = WritePrinter(h, bytes, bytes.Length, out w); EndPagePrinter(h); EndDocPrinter(h);
      if (!ok || w != bytes.Length) throw new Exception("No se pudo escribir en la impresora");
    } finally { ClosePrinter(h); }
  }
}
"@
[TdRaw]::Send($env:TD_PRINTER, [System.IO.File]::ReadAllBytes($env:TD_FILE))
`

const printLocal = async (printer, bytes, copies) => {
  const file = path.join(os.tmpdir(), `tilldash-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`)
  fs.writeFileSync(file, bytes)
  try {
    if (isWin) {
      const name = printer || (await listPrinters()).find((p) => p.default)?.name
      if (!name) throw new Error('No hay una impresora predeterminada en Windows')
      for (let c = 0; c < copies; c++) await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', WIN_RAW], { env: { ...process.env, TD_PRINTER: name, TD_FILE: file } })
    } else {
      await run('lp', [...(printer ? ['-d', printer] : []), '-o', 'raw', '-n', String(copies), '-t', 'TillDash+', file])
    }
  } finally { fs.unlink(file, () => {}) }
}

const printNetwork = (host, port, bytes, copies) => new Promise((resolve, reject) => {
  const socket = net.connect({ host, port })
  socket.setTimeout(7000)
  socket.on('connect', () => {
    for (let c = 0; c < copies; c++) socket.write(bytes)
    socket.end()
  })
  socket.on('timeout', () => { socket.destroy(); reject(new Error(`La impresora ${host}:${port} no respondió`)) })
  socket.on('error', (e) => reject(new Error(`No se pudo conectar a ${host}:${port} (${e.code || e.message})`)))
  socket.on('close', (hadError) => { if (!hadError) resolve() })
})

// ---------- Servidor local ----------
const send = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)) }

const server = http.createServer((req, res) => {
  const origin = req.headers.origin
  // Los encabezados van siempre para que el navegador pueda leer el motivo del rechazo.
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    // Chrome pide permiso explícito para que una página pública hable con un servicio de este computador.
    res.setHeader('Access-Control-Allow-Private-Network', 'true')
    res.setHeader('Access-Control-Max-Age', '600')
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
  if (origin && !allowed(origin)) return send(res, 403, { error: `El agente no acepta pedidos de ${origin}. Vuelve a descargarlo desde TillDash+ → Impresora.` })
  const url = new URL(req.url, 'http://127.0.0.1')

  if (req.method === 'GET' && url.pathname === '/estado') {
    return send(res, 200, { ok: true, agent: 'tilldash', version: VERSION, platform: process.platform, hostname: os.hostname() })
  }
  if (req.method === 'GET' && url.pathname === '/impresoras') {
    return listPrinters().then((printers) => send(res, 200, { printers }))
      .catch((e) => send(res, 500, { error: `No se pudieron listar las impresoras: ${e.message}` }))
  }
  if (req.method === 'POST' && url.pathname === '/imprimir') {
    let size = 0
    const chunks = []
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) req.destroy(); else chunks.push(c) })
    req.on('end', async () => {
      let b
      try { b = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return send(res, 400, { error: 'Pedido no válido' }) }
      const bytes = Buffer.from(String(b.data || ''), 'base64')
      if (!bytes.length) return send(res, 400, { error: 'El tiquete está vacío' })
      const copies = Math.min(5, Math.max(1, Number(b.copies) || 1))
      try {
        if (b.mode === 'red') {
          const host = String(b.ip || '').trim()
          if (!/^[\w.-]+$/.test(host)) return send(res, 400, { error: 'IP de la impresora no válida' })
          const port = Number(b.port) || 9100
          await printNetwork(host, port, bytes, copies)
          log(`Impreso en ${host}:${port} (${bytes.length} bytes${copies > 1 ? `, ${copies} copias` : ''})`)
        } else {
          await printLocal(b.printer ? String(b.printer) : null, bytes, copies)
          log(`Impreso en ${b.printer || 'la impresora predeterminada'} (${bytes.length} bytes${copies > 1 ? `, ${copies} copias` : ''})`)
        }
        send(res, 200, { ok: true })
      } catch (e) {
        log('Error al imprimir:', e.message)
        send(res, 500, { error: e.message })
      }
    })
    return undefined
  }
  send(res, 404, { error: 'No encontrado' })
})

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    http.get({ host: '127.0.0.1', port: PORT, path: '/estado', timeout: 2000 }, (r) => {
      let s = ''
      r.on('data', (c) => { s += c })
      r.on('end', () => {
        console.log(s.includes('tilldash') ? `El agente de TillDash+ ya está corriendo en este computador (puerto ${PORT}).` : `El puerto ${PORT} está ocupado por otro programa.`)
        process.exit(s.includes('tilldash') ? 0 : 1)
      })
    }).on('error', () => { console.log(`El puerto ${PORT} está ocupado por otro programa.`); process.exit(1) })
    return
  }
  console.error(e)
  process.exit(1)
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`TillDash+ · agente de impresión ${VERSION}`)
  console.log(`Escuchando en http://127.0.0.1:${PORT}`)
  console.log(`Acepta pedidos de: ${[...ORIGINS].join(', ') || '(solo localhost)'}`)
  console.log('Para detenerlo cierra esta ventana o presiona Ctrl+C.')
})
