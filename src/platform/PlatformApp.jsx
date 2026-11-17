import React, { useCallback, useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { MdDashboard, MdWorkspacePremium, MdTune, MdPublic, MdStorefront, MdInbox, MdLogout, MdMenu, MdPerson, MdLock, MdErrorOutline, MdOpenInNew } from 'react-icons/md'
import papi, { pltToken } from './api'
import { errorMessage } from '../api/client'
import { Spinner } from '../components/ui'
import { BrandLogo } from '../components/Logo'
import { SummaryPage, PlansPage, FeaturesPage, CountriesPage, OrgsPage, RequestsPage } from './pages'

const NAV = [
  { to: '/plataforma', label: 'Resumen', icon: MdDashboard, end: true, el: SummaryPage },
  { to: '/plataforma/planes', label: 'Planes y precios', icon: MdWorkspacePremium, el: PlansPage },
  { to: '/plataforma/establecimientos', label: 'Establecimientos', icon: MdStorefront, el: OrgsPage },
  { to: '/plataforma/solicitudes', label: 'Solicitudes', icon: MdInbox, el: RequestsPage },
  { to: '/plataforma/paises', label: 'Países y monedas', icon: MdPublic, el: CountriesPage },
  { to: '/plataforma/funcionalidades', label: 'Funcionalidades', icon: MdTune, el: FeaturesPage }
]

const PlatformLogin = ({ onIn }) => {
  const [f, setF] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      const { data } = await papi.post('/plataforma/login', { username: f.username.trim(), password: f.password })
      pltToken.set(data.token); onIn(data.user)
    } catch (err) { setError(errorMessage(err, 'No se pudo iniciar sesión')); setBusy(false) }
  }
  return (
    <div className="plt-login">
      <form className="login-card" onSubmit={submit} noValidate>
        <div className="login-brand"><BrandLogo size={38} /></div>
        <span className="plt-tag">Plataforma</span>
        <h1>Planes y establecimientos</h1>
        <p>Administra los planes, los precios por país y los establecimientos que usan TillDash+.</p>
        <div className="field">
          <label htmlFor="pu">Usuario</label>
          <div className="input-icon"><MdPerson /><input id="pu" autoFocus autoCapitalize="none" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} placeholder="tu.usuario" /></div>
        </div>
        <div className="field">
          <label htmlFor="pp">Contraseña</label>
          <div className="input-icon"><MdLock /><input id="pp" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="••••••••" /></div>
        </div>
        {error && <div className="alert bad" role="alert"><MdErrorOutline /> <span>{error}</span></div>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy && <Spinner />} Entrar a la plataforma</button>
        <small className="hint">Solo para el equipo de TillDash+. Los establecimientos entran por <a className="link-btn" href="/login">la app</a>.</small>
      </form>
    </div>
  )
}

const PlatformApp = () => {
  const [me, setMe] = useState(undefined)
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const logout = useCallback(() => { pltToken.clear(); setMe(null) }, [])
  useEffect(() => {
    if (!pltToken.get()) { setMe(null); return }
    papi.get('/plataforma/me').then(({ data }) => setMe(data)).catch(() => { pltToken.clear(); setMe(null) })
  }, [])
  useEffect(() => {
    window.addEventListener('td:plt-out', logout)
    return () => window.removeEventListener('td:plt-out', logout)
  }, [logout])
  useEffect(() => setOpen(false), [pathname])
  if (me === undefined) return <div className="splash"><Spinner /></div>
  if (!me) return <PlatformLogin onIn={setMe} />
  const cur = [...NAV].reverse().find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to))) || NAV[0]
  return (
    <div className="app plt">
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-brand"><BrandLogo size={32} onDark /></div>
        <div className="sidebar-org"><small>TillDash+</small><strong>Plataforma de planes</strong></div>
        <nav className="sidebar-nav" aria-label="Plataforma">
          <div className="nav-section">
            <div className="nav-section-title">Administración</div>
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}><n.icon /> <span className="nav-label">{n.label}</span></NavLink>
            ))}
          </div>
          <div className="nav-section">
            <div className="nav-section-title">Sitios</div>
            <a className="nav-link" href="/precios" target="_blank" rel="noreferrer"><MdOpenInNew /> <span className="nav-label">Página de precios</span></a>
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="avatar sm" aria-hidden="true">{(me.name || '?').slice(0, 1)}</span>
            <div className="sidebar-user-info"><strong>{me.name}</strong><span>Plataforma</span></div>
            <button type="button" className="btn btn-ghost btn-icon" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={logout}><MdLogout /></button>
          </div>
        </div>
      </aside>
      <div className={`backdrop${open ? ' show' : ''}`} onClick={() => setOpen(false)} />
      <div className="main">
        <div className="topbar-wrap">
          <header className="topbar">
            <button type="button" className="btn btn-ghost btn-icon menu-toggle" onClick={() => setOpen(true)} aria-label="Menú"><MdMenu /></button>
            <div className="topbar-title"><small>Plataforma TillDash+</small><strong>{cur.label}</strong></div>
          </header>
        </div>
        <main className="content">
          <Routes>
            {NAV.map((n) => <Route key={n.to} path={n.to.replace('/plataforma', '') || '/'} element={<n.el />} />)}
            <Route path="*" element={<Navigate to="/plataforma" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default PlatformApp
