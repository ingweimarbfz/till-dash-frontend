import React, { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MdAdd, MdEdit, MdPlace, MdWarehouse, MdStar } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { Badge, Card, Empty, Field, Modal, PageHead, Spinner, useToast } from '../../components/ui'

const SiteForm = ({ initial, onClose, onSaved }) => {
  const editing = Boolean(initial?.id)
  const [form, setForm] = useState({ name: '', city: '', address: '', phone: '', active: true, createWarehouse: true, ...initial })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('Escribe el nombre de la sucursal.')
    setSaving(true); setError('')
    try {
      const { data } = editing ? await api.put(`/sedes/${initial.id}`, form) : await api.post('/sedes', form)
      onSaved(data, editing)
    } catch (err) { setError(errorMessage(err)) } finally { setSaving(false) }
  }
  return (
    <Modal title={editing ? 'Editar sucursal' : 'Nueva sucursal'} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="site-form" className="btn btn-primary" disabled={saving}>{saving && <Spinner />} Guardar</button></>}>
      <form id="site-form" className="form-grid" onSubmit={submit} noValidate>
        <div className="span-2"><Field label="Nombre" htmlFor="s-name" required><input id="s-name" value={form.name} onChange={set('name')} placeholder="Sucursal Centro" /></Field></div>
        <Field label="Ciudad" htmlFor="s-city"><input id="s-city" data-only="letters" value={form.city || ''} onChange={set('city')} /></Field>
        <Field label="Teléfono" htmlFor="s-phone"><input id="s-phone" inputMode="numeric" maxLength={10} value={form.phone || ''} onChange={set('phone')} /></Field>
        <div className="span-2"><Field label="Dirección" htmlFor="s-addr"><input id="s-addr" value={form.address || ''} onChange={set('address')} /></Field></div>
        {!editing && <label className="check span-2"><input type="checkbox" checked={form.createWarehouse} onChange={set('createWarehouse')} /> Crear su bodega (Bodega {form.name || '…'})</label>}
        {!initial?.isMain && <label className="check span-2"><input type="checkbox" checked={form.active} onChange={set('active')} /> Sucursal activa</label>}
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>
  )
}

const WarehouseForm = ({ initial, sites, onClose, onSaved }) => {
  const editing = Boolean(initial?.id)
  const [form, setForm] = useState({ name: '', description: '', responsible: '', siteId: '', active: true, ...initial, siteId: initial?.siteId ?? '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('Escribe el nombre de la bodega.')
    if (!initial?.isMain && !form.siteId) return setError('Elige la sucursal de la bodega.')
    setSaving(true); setError('')
    try {
      const { data } = editing ? await api.put(`/bodegas/${initial.id}`, form) : await api.post('/bodegas', form)
      onSaved(data, editing)
    } catch (err) { setError(errorMessage(err)) } finally { setSaving(false) }
  }
  return (
    <Modal title={editing ? 'Editar bodega' : 'Nueva bodega'} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" form="wh-form" className="btn btn-primary" disabled={saving}>{saving && <Spinner />} Guardar</button></>}>
      <form id="wh-form" className="form-grid" onSubmit={submit} noValidate>
        <div className="span-2"><Field label="Nombre" htmlFor="w-name" required><input id="w-name" value={form.name} onChange={set('name')} placeholder="Bar de la terraza" /></Field></div>
        {initial?.isMain
          ? <div className="span-2"><small className="hint">La bodega principal es de todo el establecimiento y abastece a las sucursales.</small></div>
          : <Field label="Sucursal" htmlFor="w-site" required><select id="w-site" value={form.siteId} onChange={set('siteId')}><option value="">Elige…</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>}
        <Field label="Responsable" htmlFor="w-resp"><input id="w-resp" value={form.responsible || ''} onChange={set('responsible')} /></Field>
        <div className="span-2"><Field label="Descripción" htmlFor="w-desc"><textarea id="w-desc" rows={2} value={form.description || ''} onChange={set('description')} placeholder="Licores, cocina, desechables…" /></Field></div>
        {!initial?.isMain && <label className="check span-2"><input type="checkbox" checked={form.active} onChange={set('active')} /> Bodega activa</label>}
        {error && <div className="alert bad span-2">{error}</div>}
      </form>
    </Modal>
  )
}

// Sucursales del establecimiento con sus bodegas, y la bodega principal que abastece a todas.
const SitesPage = () => {
  const [sites, setSites] = useState(null)
  const [main, setMain] = useState(null)
  const [siteForm, setSiteForm] = useState(null)
  const [whForm, setWhForm] = useState(null)
  const [toast, toastNode] = useToast()
  const [params, setParams] = useSearchParams()

  const load = useCallback(() => {
    Promise.all([api.get('/sedes', { params: { sede: undefined } }), api.get('/bodegas', { params: { sede: undefined } })])
      .then(([s, w]) => { setSites(s.data); setMain(w.data.find((x) => x.isMain) || null) })
      .catch((e) => { setSites([]); toast(errorMessage(e), 'bad') })
  }, [toast])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (params.get('nueva')) { setSiteForm({}); setParams({}, { replace: true }) } }, [params, setParams])

  const saved = (msg) => () => { setSiteForm(null); setWhForm(null); toast(msg); load() }

  if (!sites) return <div className="splash" style={{ minHeight: 240 }}><Spinner /></div>
  const activeSites = sites.filter((s) => s.active)
  return (
    <div className="stack">
      <PageHead title="Sucursales y bodegas" subtitle="Cada sucursal tiene sus mesas, su caja y sus bodegas. La bodega principal abastece a todas.">
        <button type="button" className="btn" onClick={() => setWhForm({})}><MdWarehouse /> Nueva bodega</button>
        <button type="button" className="btn btn-primary" onClick={() => setSiteForm({})}><MdAdd /> Nueva sucursal</button>
      </PageHead>
      {main && (
        <Card title="Bodega principal" icon={<MdStar />} actions={<button type="button" className="btn btn-ghost btn-icon" aria-label="Editar bodega principal" onClick={() => setWhForm(main)}><MdEdit /></button>}>
          <div className="person"><span className="icon-bubble dark"><MdWarehouse /></span><div><strong>{main.name}</strong><small>{main.description || 'Abastece a todas las sucursales'}{main.responsible ? ` · ${main.responsible}` : ''}</small></div></div>
        </Card>
      )}
      {!sites.length ? <Card><Empty icon={<MdPlace />}>Aún no hay sucursales.</Empty></Card> : (
        <div className="grid grid-2">
          {sites.map((s) => (
            <Card key={s.id} title={s.name} icon={<MdPlace />} subtitle={[s.city, s.address, s.phone].filter(Boolean).join(' · ') || 'Sin datos de ubicación'}
              actions={<span className="badges">{s.isMain && <Badge tone="brand">Principal</Badge>}{!s.active && <Badge tone="muted">Inactiva</Badge>}<button type="button" className="btn btn-ghost btn-icon" aria-label={`Editar ${s.name}`} onClick={() => setSiteForm(s)}><MdEdit /></button></span>}>
              {!s.warehouses.filter((w) => !w.isMain).length ? <p className="muted" style={{ margin: 0 }}>Sin bodegas propias.</p> : (
                <ul className="list">
                  {s.warehouses.filter((w) => !w.isMain).map((w) => (
                    <li key={w.id}>
                      <span><MdWarehouse /> <strong>{w.name}</strong>{w.responsible && <small> · {w.responsible}</small>}{!w.active && <> <Badge tone="muted">Inactiva</Badge></>}</span>
                      <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Editar ${w.name}`} onClick={() => setWhForm(w)}><MdEdit /></button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => setWhForm({ siteId: s.id })}><MdAdd /> Bodega en {s.name}</button>
            </Card>
          ))}
        </div>
      )}
      {siteForm && <SiteForm initial={siteForm} onClose={() => setSiteForm(null)} onSaved={saved(siteForm.id ? 'Sucursal actualizada' : 'Sucursal creada')} />}
      {whForm && <WarehouseForm initial={whForm} sites={activeSites} onClose={() => setWhForm(null)} onSaved={saved(whForm.id ? 'Bodega actualizada' : 'Bodega creada')} />}
      {toastNode}
    </div>
  )
}

export default SitesPage
