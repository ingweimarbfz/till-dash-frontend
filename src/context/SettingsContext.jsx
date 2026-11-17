import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api from '../api/client'
import { useAuth } from './AuthContext'
import { applyTheme, DEFAULT_THEME } from '../utils/theme'

const DEFAULTS = { businessName: 'TillDash+', shortName: null, logoUrl: null, currency: 'COP', tipPercent: 10, ...DEFAULT_THEME }
const SettingsContext = createContext({ settings: DEFAULTS, refresh: () => {} })

// Configuración del establecimiento (nombre, logo, colores, fuente, propina). Se carga cuando hay sesión
// y aplica la apariencia a toda la app.
export const SettingsProvider = ({ children }) => {
  const { user } = useAuth()
  const [settings, setSettings] = useState(DEFAULTS)
  const refresh = useCallback(() => {
    if (!user) { setSettings(DEFAULTS); return }
    api.get('/configuracion').then(({ data }) => setSettings({ ...DEFAULTS, ...data })).catch(() => {})
  }, [user])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    applyTheme(settings)
    document.title = settings.businessName && settings.businessName !== 'TillDash+' ? `${settings.businessName} · TillDash+` : 'TillDash+'
  }, [settings])
  const value = useMemo(() => ({ settings, setSettings, refresh }), [settings, refresh])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export const useSettings = () => useContext(SettingsContext)
