import React, { useCallback, useEffect, useState } from 'react'
import { MdPrint, MdUsb, MdLan, MdWeb, MdSearch, MdDownload, MdContentCopy, MdCheckCircle, MdErrorOutline, MdReceiptLong, MdRefresh, MdPointOfSale } from 'react-icons/md'
import { useSettings } from '../context/SettingsContext'
import { Card, Field, PageHead, Spinner, useToast } from '../components/ui'
import { agentPrinters, agentStatus, getPrinterConfig, openDrawer, savePrinterConfig, usesAgent } from '../utils/printer'
import { testTicket } from '../utils/ticket'
import { downloadText, macScript, windowsScript } from '../utils/agentScripts'

const MODES = [
  ['navegador', 'Navegador', MdWeb, 'Abre el cuadro de impresión del sistema. Sirve con cualquier impresora instalada en Windows o Mac, sin instalar nada.'],
  ['usb', 'USB local (agente)', MdUsb, 'Imprime directo en la térmica conectada a este computador, sin cuadro de impresión.'],
  ['red', 'Por red (IP)', MdLan, 'Imprime directo en una térmica conectada al router (cable o wifi), sin cuadro de impresión.']
]
const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$|^[a-zA-Z0-9.-]+\.local$/

const MAC_CMD = 'bash ~/Downloads/tilldash-agente.command'

// Impresora de este computador (TD-018). Se guarda en el navegador: cada caja tiene la suya.
const PrinterPage = () => {
  const { settings } = useSettings()
  const [cfg, setCfg] = useState(getPrinterConfig)
  const [saved, setSaved] = useState(getPrinterConfig)
  const [agent, setAgent] = useState(null) // null: buscando · { ok, ... } · { error }
  const [printers, setPrinters] = useState(null)
  const [busy, setBusy] = useState('')
  const [toast, toastNode] = useToast()
  const set = (k) => (e) => setCfg((c) => ({ ...c, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }))
  const agentMode = usesAgent(cfg)
  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved)

  const check = useCallback(() => {
    setAgent(null)
    agentStatus().then((s) => setAgent(s)).catch((e) => setAgent({ error: e.message }))
  }, [])
  useEffect(() => { if (agentMode) check() }, [agentMode, check])

  const detect = async () => {
    setBusy('detect')
    try {
      const list = await agentPrinters()
      setPrinters(list); setAgent((a) => (a?.ok ? a : { ok: true }))
      if (!list.length) toast('El agente no encontró impresoras instaladas en este computador', 'bad')
      else if (!cfg.printer) setCfg((c) => ({ ...c, printer: (list.find((p) => p.default) || list[0]).name }))
    } catch (e) { toast(e.message, 'bad'); setAgent({ error: e.message }) } finally { setBusy('') }
  }

  const validate = () => {
    if (cfg.mode === 'red' && !IP_RE.test(String(cfg.ip).trim())) return 'Escribe la IP de la impresora, por ejemplo 192.168.1.100'
    if (cfg.mode === 'red' && !(Number(cfg.port) > 0 && Number(cfg.port) < 65536)) return 'El puerto no es válido (casi siempre es 9100)'
    return null
  }
  const save = (e) => {
    e?.preventDefault()
    const err = validate()
    if (err) return toast(err, 'bad')
    const clean = { ...cfg, ip: String(cfg.ip).trim(), port: Number(cfg.port) || 9100, width: Number(cfg.width) === 58 ? 58 : 80, copies: Math.min(3, Math.max(1, Number(cfg.copies) || 1)) }
    savePrinterConfig(clean); setCfg(clean); setSaved(clean)
    toast('Impresora guardada en este computador')
  }
  const test = async () => {
    const err = validate()
    if (err) return toast(err, 'bad')
    setBusy('test')
    await testTicket(settings, cfg)
    setBusy('')
  }
  const drawer = async () => {
    setBusy('drawer')
    try { await openDrawer(cfg); toast('Se envió la orden de abrir el cajón') } catch (e) { toast(e.message, 'bad') } finally { setBusy('') }
  }
  const copy = (text) => navigator.clipboard?.writeText(text).then(() => toast('Copiado'), () => {})

  const origin = window.location.origin
  return (
    <form className="stack" onSubmit={save} noValidate>
      <PageHead title="Impresora" subtitle="Cómo salen la precuenta y el tiquete de cobro en este computador. Cada computador guarda su propia impresora.">
        <button type="button" className="btn" onClick={test} disabled={!!busy}>{busy === 'test' ? <Spinner /> : <MdReceiptLong />} Imprimir prueba</button>
        <button type="submit" className="btn btn-primary" disabled={!dirty}>Guardar</button>
      </PageHead>

      <div className="grid grid-2-1">
        <Card title="Impresora térmica" icon={<MdPrint />}>
          <div className="seg seg-wrap printer-modes" role="radiogroup" aria-label="Forma de imprimir">
            {MODES.map(([k, label, Icon]) => (
              <button key={k} type="button" role="radio" aria-checked={cfg.mode === k} className={`btn${cfg.mode === k ? ' on' : ''}`} onClick={() => setCfg((c) => ({ ...c, mode: k }))}><Icon /> {label}</button>
            ))}
          </div>
          <p className="muted printer-mode-note">{MODES.find(([k]) => k === cfg.mode)[3]}</p>

          {agentMode && (
            <div className="printer-agent">
              <div className={`alert ${agent === null ? 'info' : agent.ok ? 'ok' : 'warn'}`}>
                {agent === null ? <Spinner /> : agent.ok ? <MdCheckCircle /> : <MdErrorOutline />}
                <span>
                  {agent === null && 'Buscando el agente de impresión en este computador…'}
                  {agent?.ok && <>Agente conectado{agent.version ? ` (versión ${agent.version}${agent.hostname ? ` en ${agent.hostname}` : ''})` : ''}.</>}
                  {agent?.error && <>Requiere el agente local corriendo en este computador. Instálalo con los pasos de abajo (una sola vez) y presiona <b>Volver a buscar</b>.</>}
                </span>
                <button type="button" className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={check}><MdRefresh /> Volver a buscar</button>
              </div>

              {cfg.mode === 'usb' && (
                <Field label="Impresora" htmlFor="pr" hint="La térmica debe estar instalada en el sistema (con su controlador o como impresora genérica). Vacío: la predeterminada.">
                  <div className="printer-pick">
                    {printers?.length ? (
                      <select id="pr" value={cfg.printer} onChange={set('printer')}>
                        <option value="">Predeterminada del sistema</option>
                        {printers.map((p) => <option key={p.name} value={p.name}>{p.name}{p.default ? ' (predeterminada)' : ''}</option>)}
                      </select>
                    ) : <input id="pr" value={cfg.printer} onChange={set('printer')} placeholder="Presiona Detectar impresoras" />}
                    <button type="button" className="btn" onClick={detect} disabled={busy === 'detect'}>{busy === 'detect' ? <Spinner /> : <MdSearch />} Detectar impresoras</button>
                  </div>
                </Field>
              )}

              {cfg.mode === 'red' && (
                <div className="form-grid">
                  <Field label="IP de la impresora" htmlFor="ip" required hint="Se ve en la hoja de autoprueba (apaga la impresora y préndela con el botón FEED oprimido).">
                    <input id="ip" value={cfg.ip} onChange={set('ip')} placeholder="192.168.1.100" inputMode="decimal" />
                  </Field>
                  <Field label="Puerto" htmlFor="port" hint="Casi siempre 9100.">
                    <input id="port" type="number" min="1" max="65535" value={cfg.port} onChange={set('port')} style={{ maxWidth: 140 }} />
                  </Field>
                </div>
              )}

              {!agent?.ok && (
                <div className="agent-install">
                  <div className="agent-os">
                    <h4>Windows</h4>
                    <ol>
                      <li>Descarga e instala <a href="https://nodejs.org/es/download" target="_blank" rel="noreferrer">Node.js</a> (versión LTS).</li>
                      <li>Descarga el instalador del agente.</li>
                      <li>Ábrelo con doble clic. Si Windows lo detiene: <b>Más información</b> → <b>Ejecutar de todas formas</b>.</li>
                    </ol>
                    <button type="button" className="btn" onClick={() => downloadText('tilldash-agente.bat', windowsScript(origin))}><MdDownload /> Descargar (.bat)</button>
                  </div>
                  <div className="agent-os">
                    <h4>Mac</h4>
                    <ol>
                      <li>Descarga e instala <a href="https://nodejs.org/es/download" target="_blank" rel="noreferrer">Node.js</a> (versión LTS).</li>
                      <li>Descarga el instalador del agente.</li>
                      <li>Abre la app <b>Terminal</b>, pega esto y presiona Enter:
                        <code className="agent-cmd">{MAC_CMD}<button type="button" className="btn btn-ghost btn-icon btn-sm" title="Copiar" aria-label="Copiar comando" onClick={() => copy(MAC_CMD)}><MdContentCopy /></button></code>
                      </li>
                    </ol>
                    <button type="button" className="btn" onClick={() => downloadText('tilldash-agente.command', macScript(origin))}><MdDownload /> Descargar (.command)</button>
                  </div>
                  <p className="muted agent-foot">El agente queda corriendo en segundo plano y arranca solo al encender el computador. Solo atiende a esta página ({origin}). Usa Chrome o Edge: la primera vez el navegador puede pedir permiso para acceder a dispositivos de la red local; acéptalo.</p>
                </div>
              )}
            </div>
          )}
        </Card>

        <div className="stack">
          <Card title="Tiquete" icon={<MdReceiptLong />}>
            <Field label="Ancho del papel" htmlFor="w">
              <div className="seg" id="w">
                {[80, 58].map((w) => <button key={w} type="button" className={`btn btn-sm${Number(cfg.width) === w ? ' on' : ''}`} onClick={() => setCfg((c) => ({ ...c, width: w }))}>{w} mm</button>)}
              </div>
            </Field>
            {agentMode && (
              <Field label="Copias del tiquete" htmlFor="cp">
                <select id="cp" value={cfg.copies} onChange={set('copies')} style={{ maxWidth: 140 }}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select>
              </Field>
            )}
            <div className="stack" style={{ gap: 8 }}>
              <label className="check"><input type="checkbox" checked={cfg.autoPrint} onChange={set('autoPrint')} /> Imprimir el tiquete automáticamente al cobrar</label>
              {agentMode && <label className="check"><input type="checkbox" checked={cfg.cut !== false} onChange={set('cut')} /> Cortar el papel al terminar</label>}
              {agentMode && <label className="check"><input type="checkbox" checked={cfg.openDrawer} onChange={set('openDrawer')} /> Abrir el cajón monedero al cobrar en efectivo</label>}
            </div>
            {cfg.autoPrint && !agentMode && <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>Con el navegador se abre el cuadro de impresión al terminar el cobro; para que salga sin preguntar usa el agente.</p>}
          </Card>
          {agentMode && cfg.openDrawer && (
            <Card title="Cajón monedero" icon={<MdPointOfSale />} subtitle="Conectado a la impresora con el cable RJ11.">
              <button type="button" className="btn btn-block" onClick={drawer} disabled={!!busy}>{busy === 'drawer' ? <Spinner /> : <MdPointOfSale />} Abrir el cajón ahora</button>
            </Card>
          )}
        </div>
      </div>
      {toastNode}
    </form>
  )
}

export default PrinterPage
