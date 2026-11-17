import React, { useCallback, useEffect, useState } from 'react'
import { MdAdd, MdDelete, MdSend, MdSearch, MdCheckCircle } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { FaTelegramPlane } from 'react-icons/fa'
import { Badge, Card, Empty, Field, Modal, PageHead, Spinner, useToast } from '../../components/ui'
import { formatDateTime } from '../../utils/format'

// Conectar el bot: token de @BotFather.
const BotForm = ({ bot, onSaved, onCancel }) => {
  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const save = async (e) => {
    e.preventDefault(); setSaving(true); setError('')
    try { const { data } = await api.put('/notificaciones/bot', { token, enabled: true }); onSaved(data) } catch (er) { setError(errorMessage(er)); setSaving(false) }
  }
  return (
    <form className="stack" onSubmit={save}>
      <ol className="steps">
        <li>En Telegram abre <b>@BotFather</b> y envía <code>/newbot</code>.</li>
        <li>Ponle un nombre (por ejemplo <i>Avisos de mi bar</i>) y un usuario que termine en <code>bot</code>.</li>
        <li>Copia el token que te entrega y pégalo aquí.</li>
      </ol>
      <Field label="Token del bot" htmlFor="tg-token" required>
        <input id="tg-token" className="input" value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456789:AAH…" autoComplete="off" />
      </Field>
      {error && <div className="alert bad">{error}</div>}
      <div className="row-end">
        {onCancel && <button type="button" className="btn" onClick={onCancel}>Cancelar</button>}
        <button type="submit" className="btn btn-primary" disabled={saving || !token.trim()}>{saving && <Spinner />} {bot?.configured ? 'Cambiar bot' : 'Conectar bot'}</button>
      </div>
    </form>
  )
}

// Agregar un grupo a una sección: buscar los grupos donde está el bot y elegir la sucursal.
const ChannelModal = ({ section, sections, sites, bot, onClose, onSaved }) => {
  const [found, setFound] = useState(null)
  const [searching, setSearching] = useState(false)
  const [form, setForm] = useState({ section: section || 'inventario', chatId: '', title: '', siteId: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const search = async () => {
    setSearching(true); setError('')
    try {
      const { data } = await api.post('/notificaciones/buscar-grupos')
      setFound(data)
      if (data.length === 1) setForm((f) => ({ ...f, chatId: data[0].chatId, title: data[0].title }))
    } catch (e) { setError(errorMessage(e)) }
    setSearching(false)
  }
  const save = async () => {
    setSaving(true); setError('')
    try { await api.post('/notificaciones/canales', form); onSaved() } catch (e) { setError(errorMessage(e)); setSaving(false) }
  }
  return (
    <Modal title="Agregar grupo de Telegram" onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-primary" disabled={saving || !form.chatId} onClick={save}>{saving && <Spinner />} Agregar</button></>}>
      <div className="stack">
        <ol className="steps">
          <li>Crea un grupo en Telegram (por ejemplo <i>Inventario Sede Centro</i>) o usa uno que ya tengas.</li>
          <li>Agrega a <b>@{bot.username}</b> al grupo.</li>
          <li>Escribe cualquier mensaje en el grupo y toca <b>Buscar grupos</b>.</li>
        </ol>
        <button type="button" className="btn" onClick={search} disabled={searching}>{searching ? <Spinner /> : <MdSearch />} Buscar grupos</button>
        {found && !found.length && <div className="alert warn">No aparece ningún grupo. Revisa que el bot esté en el grupo y escribe un mensaje nuevo allí.</div>}
        {found?.length > 0 && (
          <div className="check-list">
            {found.map((g) => (
              <label key={g.chatId} className="check">
                <input type="radio" name="grp" checked={form.chatId === g.chatId} onChange={() => setForm((f) => ({ ...f, chatId: g.chatId, title: g.title }))} />
                <span>{g.title} <small className="muted">· {g.type === 'channel' ? 'canal' : 'grupo'}</small></span>
              </label>
            ))}
          </div>
        )}
        <div className="grid grid-2">
          <Field label="Sección" htmlFor="ch-sec">
            <select id="ch-sec" className="input" value={form.section} onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}>
              {sections.map((s) => <option key={s.key} value={s.key}>{s.label}{s.soon ? ' (próximamente)' : ''}</option>)}
            </select>
          </Field>
          <Field label="Sucursal" htmlFor="ch-site" hint="Un grupo de sucursal solo recibe los avisos de esa sucursal.">
            <select id="ch-site" className="input" value={form.siteId} onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value }))}>
              <option value="">Todas las sucursales</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        </div>
        <small className="hint">{sections.find((s) => s.key === form.section)?.hint}</small>
        {error && <div className="alert bad">{error}</div>}
      </div>
    </Modal>
  )
}

// Notificaciones por Telegram: bot del establecimiento, grupos por sección y sucursal, pruebas e historial.
const NotificationsPage = () => {
  const [data, setData] = useState(null)
  const [editingBot, setEditingBot] = useState(false)
  const [adding, setAdding] = useState(null)
  const [busy, setBusy] = useState('')
  const [toast, toastNode] = useToast()
  const load = useCallback(() => api.get('/notificaciones').then(({ data: d }) => setData(d)).catch((e) => toast(errorMessage(e), 'bad')), [toast])
  useEffect(() => { load() }, [load])
  if (!data) return <div className="splash"><Spinner /></div>
  const { bot, sections, sites, channels, log } = data

  const run = async (key, fn, ok) => {
    setBusy(key)
    try { await fn(); if (ok) toast(ok); await load() } catch (e) { toast(errorMessage(e), 'bad') }
    setBusy('')
  }

  return (
    <div className="stack">
      <PageHead title="Notificaciones" subtitle="Avisos por Telegram de stock bajo, entradas, bajas y traslados. Pedidos, caja y llamados de mesa se suman en la etapa 3." />

      <Card title="Bot de Telegram" icon={<FaTelegramPlane />}
        actions={bot.configured && !editingBot && <Badge tone={bot.enabled ? 'ok' : 'warn'}>{bot.enabled ? 'Enviando' : 'En pausa'}</Badge>}>
        {!bot.configured || editingBot ? <BotForm bot={bot} onCancel={bot.configured ? () => setEditingBot(false) : null} onSaved={() => { setEditingBot(false); toast('Bot conectado'); load() }} /> : (
          <div className="row-between wrap">
            <div className="tg-bot">
              <span className="tg-avatar"><FaTelegramPlane /></span>
              <div><strong>{bot.name}</strong><small>@{bot.username} · token {bot.token}</small></div>
            </div>
            <div className="row-end wrap">
              <label className="check"><input type="checkbox" checked={bot.enabled} disabled={busy === 'en'} onChange={(e) => run('en', () => api.put('/notificaciones/bot', { enabled: e.target.checked }), e.target.checked ? 'Notificaciones activadas' : 'Notificaciones en pausa')} /> Enviar avisos</label>
              <button type="button" className="btn btn-sm" onClick={() => setEditingBot(true)}>Cambiar token</button>
              <button type="button" className="btn btn-sm btn-ghost text-bad" onClick={() => run('off', () => api.delete('/notificaciones/bot'), 'Bot desconectado')}>Desconectar</button>
            </div>
          </div>
        )}
      </Card>

      {bot.configured && (
        <>
          <Card title="Grupos por sección" subtitle="Cada sección puede ir a uno o varios grupos. Usa un grupo por sucursal para que cada equipo vea solo lo suyo."
            actions={<button type="button" className="btn btn-primary btn-sm" onClick={() => setAdding('inventario')}><MdAdd /> Agregar grupo</button>}>
            <div className="tg-sections">
              {sections.map((s) => {
                const rows = channels.filter((c) => c.section === s.key)
                return (
                  <div key={s.key} className="tg-section">
                    <div className="row-between">
                      <div><strong>{s.label}</strong><small className="muted">{s.hint}</small></div>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(s.key)}><MdAdd /> Grupo</button>
                    </div>
                    {!rows.length ? <small className="muted">Sin grupos: esta sección no envía avisos.</small> : (
                      <ul className="tg-channels">
                        {rows.map((c) => (
                          <li key={c.id} className={c.enabled ? '' : 'off'}>
                            <span className="tg-ch-name"><FaTelegramPlane /> {c.title}<Badge tone={c.siteId ? 'brand' : ''}>{c.siteName}</Badge></span>
                            <span className="row-end">
                              <label className="check"><input type="checkbox" checked={c.enabled} onChange={(e) => run(`t${c.id}`, () => api.put(`/notificaciones/canales/${c.id}`, { enabled: e.target.checked }))} /> Activo</label>
                              <button type="button" className="btn btn-sm" disabled={busy === `p${c.id}`} onClick={() => run(`p${c.id}`, () => api.post(`/notificaciones/canales/${c.id}/prueba`), 'Mensaje de prueba enviado')}>{busy === `p${c.id}` ? <Spinner /> : <MdSend />} Probar</button>
                              <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Quitar" onClick={() => run(`d${c.id}`, () => api.delete(`/notificaciones/canales/${c.id}`), 'Grupo quitado')}><MdDelete /></button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>

          <Card title="Últimos envíos" flush>
            {!log.length ? <Empty icon={<MdSend />}>Aún no se ha enviado ningún aviso.</Empty> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Fecha</th><th>Sección</th><th>Grupo</th><th>Estado</th></tr></thead>
                  <tbody>
                    {log.map((l) => (
                      <tr key={l.id}>
                        <td>{formatDateTime(l.createdAt)}</td>
                        <td>{l.sectionLabel}{l.siteName && <small className="muted"> · {l.siteName}</small>}</td>
                        <td>{l.chatTitle}</td>
                        <td>{l.status === 'enviado' ? <Badge tone="ok"><MdCheckCircle /> Enviado</Badge> : <span title={l.detail}><Badge tone="bad">Error</Badge> <small className="muted">{l.detail}</small></span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {adding && <ChannelModal section={adding} sections={sections} sites={sites} bot={bot} onClose={() => setAdding(null)} onSaved={() => { setAdding(null); toast('Grupo agregado. Toca Probar para confirmar que llega.'); load() }} />}
      {toastNode}
    </div>
  )
}

export default NotificationsPage
