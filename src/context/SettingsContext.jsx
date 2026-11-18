import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from './AuthContext'
import { applyTheme, DEFAULT_THEME } from '../utils/theme'

const DEFAULTS = { businessName: 'TillDash+', shortName: null, logoUrl: null, currency: 'COP', tipPercent: 10, ...DEFAULT_THEME }
// Rutas que no llevan la apariencia del establecimiento.
export const STANDARD_PATHS = /^\/(plataforma|precios)(\/|$)/
const SettingsContext = createContext({ settings: DEFAULTS, refresh: () => {} })

// Configuración del establecimiento (nombre, logo, colores, fuente, propina). Se carga cuando hay sesión
// y aplica la apariencia a toda la app.
export const SettingsProvider = ({ children }) => {
  const { user } = useAuth()
  const { pathname } = useLocation()
  // La plataforma de planes y la página de precios son de TillDash+: siempre con la apariencia de fábrica,
  // aunque en el mismo navegador haya una sesión de un establecimiento con su propia apariencia.
  const standard = STANDARD_PATHS.test(pathname)
  const [settings, setSettings] = useState(DEFAULTS)
  const refresh = useCallback(() => {
    if (!user) { setSettings(DEFAULTS); return }
    api.get('/configuracion').then(({ data }) => setSettings({ ...DEFAULTS, ...data })).catch(() => {})
  }, [user])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    if (standard) { applyTheme(DEFAULT_THEME); return }
    applyTheme(settings)
    document.title = settings.businessName && settings.businessName !== 'TillDash+' ? `${settings.businessName} · TillDash+` : 'TillDash+'
  }, [settings, standard])
  const value = useMemo(() => ({ settings, setSettings, refresh }), [settings, refresh])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export const useSettings = () => useContext(SettingsContext)
