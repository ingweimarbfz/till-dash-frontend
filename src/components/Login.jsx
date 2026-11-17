import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MdPerson, MdLock, MdVisibility, MdVisibilityOff, MdErrorOutline, MdTableRestaurant, MdPointOfSale, MdInventory2, MdInsights, MdAdminPanelSettings, MdBadge, MdArrowBack, MdCheckCircle, MdVerifiedUser } from 'react-icons/md'
import { useAuth } from '../context/AuthContext'
import { errorMessage } from '../api/client'
import { Spinner } from './ui'
import { BrandLogo } from './Logo'
import { BRAND, BRAND_TAGLINE } from '../utils/brand'

// Perfiles con los que se puede entrar cuando un usuario tiene varios.
const PROFILE_INFO = {
  superadmin: { icon: <MdVerifiedUser />, text: 'Todo el sistema, incluida la apariencia del sitio' },
  admin: { icon: <MdAdminPanelSettings />, text: 'Operación, usuarios, inventario y reportes' },
  empleado: { icon: <MdBadge />, text: 'Tu turno: mesas, pedidos y caja según tu cargo' }
}

const Login = () => {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ username: '', pass: '' })
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [choice, setChoice] = useState(null) // { profiles, name, picked }

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.username.trim() || !form.pass) { setError('Ingresa tu usuario y contraseña.'); return }
    if (choice && !choice.picked) { setError('Elige con qué perfil quieres entrar.'); return }
    setLoading(true)
    try {
      const r = await login(form.username.trim(), form.pass, choice?.picked)
      if (r?.chooseProfile) { setChoice({ profiles: r.profiles, name: r.name, picked: null }); return }
      navigate(choice ? '/' : location.state?.from?.pathname || '/', { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'No se pudo iniciar sesión.'))
      setChoice(null)
      setForm((f) => ({ ...f, pass: '' }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login">
      <section className="login-hero">
        <BrandLogo size={40} onDark />
        <div>
          <span className="login-tag">{BRAND_TAGLINE}</span>
          <h2>Tu operación al día, mesa a mesa.</h2>
          <p>Mesas, pedidos, caja, inventario y reportes de tu restaurante, bar o discoteca en un solo lugar, desde el computador, la tablet o el celular.</p>
          <div className="login-points">
            <div><MdTableRestaurant /><span><b>Mesas y pedidos</b> · abre, traslada y cobra mesas, con propina, promociones y cortesías.</span></div>
            <div><MdPointOfSale /><span><b>Caja y bóveda</b> · apertura con el valor que elijas, cierre de turno y cuentas por cobrar.</span></div>
            <div><MdInventory2 /><span><b>Inventario</b> · bodega principal y por sucursal, con alertas de stock bajo.</span></div>
            <div><MdInsights /><span><b>Dashboards y reportes</b> · ventas, productos, meseros, propinas y finanzas.</span></div>
          </div>
        </div>
        <div className="login-foot">© {new Date().getFullYear()} {BRAND} · Información protegida (Ley 1581 de 2012)</div>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={handleSubmit} noValidate>
          <div className="login-brand"><BrandLogo size={38} /></div>
          {choice ? (
            <>
              <h1>Hola, {choice.name}</h1>
              <p>Tienes varios perfiles. Elige con cuál quieres entrar.</p>
              <div className="profile-pick" role="radiogroup" aria-label="Perfil">
                {choice.profiles.map((p) => (
                  <label key={p.role} className={`profile-opt${choice.picked === p.role ? ' on' : ''}`}>
                    <input type="radio" name="profile" value={p.role} checked={choice.picked === p.role} onChange={() => { setChoice({ ...choice, picked: p.role }); setError('') }} />
                    <span className="profile-ico">{PROFILE_INFO[p.role]?.icon}</span>
                    <span className="profile-txt"><b>{p.label}</b><small>{PROFILE_INFO[p.role]?.text}</small></span>
                    {choice.picked === p.role && <MdCheckCircle className="profile-check" />}
                  </label>
                ))}
              </div>
            </>
          ) : (
            <>
            <h1>Iniciar sesión</h1>
            <p>Ingresa con el usuario que te asignó el administrador.</p>

            <div className="field">
              <label htmlFor="username">Usuario</label>
              <div className="input-icon">
                <MdPerson />
                <input id="username" name="username" autoComplete="username" autoFocus autoCapitalize="none" value={form.username} onChange={handleChange} placeholder="tu.usuario" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="pass">Contraseña</label>
              <div className="input-icon">
                <MdLock />
                <input id="pass" name="pass" type={showPass ? 'text' : 'password'} autoComplete="current-password" value={form.pass} onChange={handleChange} placeholder="••••••••" />
                <button type="button" className="btn btn-ghost btn-icon addon" onClick={() => setShowPass((s) => !s)} aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  {showPass ? <MdVisibilityOff /> : <MdVisibility />}
                </button>
              </div>
            </div>
            </>
          )}

          {error && <div className="alert bad" role="alert"><MdErrorOutline /> <span>{error}</span></div>}

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? <><Spinner /> Ingresando…</> : choice ? 'Entrar' : 'Ingresar'}
          </button>
          {choice && <button type="button" className="btn btn-ghost btn-block" onClick={() => { setChoice(null); setError(''); setForm((f) => ({ ...f, pass: '' })) }}><MdArrowBack /> Usar otro usuario</button>}
        </form>
      </section>
    </div>
  )
}

export default Login
