import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import api from '../api/client'

// TD-023: contadores del menú lateral. Se consultan cada 15 segundos, al cambiar de pantalla
// y cuando otra pantalla avisa con el evento "td:badges" (por ejemplo, al marcar una comanda).
const POLL_MS = 15000

export const BADGE_HINTS = {
  '/comandas': 'comandas nuevas por preparar',
  '/mesas': 'llamados de mesas sin atender',
  '/pedidos': 'cuentas pedidas por cobrar',
  '/domicilios': 'domicilios por despachar',
  '/caja': 'solicitudes de caja por revisar',
  '/incidentes': 'incidentes abiertos'
}

export const refreshMenuBadges = () => window.dispatchEvent(new Event('td:badges'))

export const useMenuBadges = (enabled, key) => {
  const [badges, setBadges] = useState({})
  const { pathname } = useLocation()
  const busy = useRef(false)
  const load = useCallback(() => {
    if (!enabled || busy.current || document.hidden) return
    busy.current = true
    api.get('/avisos/menu').then(({ data }) => setBadges(data || {})).catch(() => {}).finally(() => { busy.current = false })
  }, [enabled])
  useEffect(() => {
    if (!enabled) return undefined
    load()
    const t = setInterval(load, POLL_MS)
    const onVisible = () => { if (!document.hidden) load() }
    // Cualquier cambio (crear, cobrar, aprobar, atender…) vuelve a contar un momento después.
    let soon = null
    const hook = api.interceptors.response.use((r) => {
      if (r.config?.method && r.config.method !== 'get' && !String(r.config.url).startsWith('/avisos')) { clearTimeout(soon); soon = setTimeout(load, 800) }
      return r
    })
    window.addEventListener('td:badges', load)
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(t); clearTimeout(soon); api.interceptors.response.eject(hook); window.removeEventListener('td:badges', load); document.removeEventListener('visibilitychange', onVisible) }
  }, [enabled, load, key])
  // Al entrar o salir de una pantalla se vuelve a contar (lo atendido allí deja de contar).
  useEffect(() => { const t = setTimeout(load, 1500); return () => clearTimeout(t) }, [pathname, load])
  return badges
}

// Burbuja con el número; al subir el contador late un momento para llamar la atención.
export const NavBadge = ({ value }) => {
  const prev = useRef(value || 0)
  const [pulse, setPulse] = useState(false)
  useEffect(() => {
    if ((value || 0) > prev.current) { setPulse(true); const t = setTimeout(() => setPulse(false), 1200); prev.current = value; return () => clearTimeout(t) }
    prev.current = value || 0
    return undefined
  }, [value])
  if (!value) return null
  return <span className={`nav-badge${pulse ? ' pulse' : ''}`} aria-label={`${value} pendientes`}>{value > 99 ? '99+' : value}</span>
}
