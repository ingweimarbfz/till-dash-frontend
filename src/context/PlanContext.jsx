import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api from '../api/client'
import { useAuth } from './AuthContext'
import { setMoneyFormat } from '../utils/format'

// Plan del establecimiento : qué módulos tiene y en qué país/moneda opera.
// features = null significa sin restricciones (establecimiento sin plan asignado).
const PlanContext = createContext({ features: null, has: () => true, plan: null, country: null, refresh: () => {} })

export const PlanProvider = ({ children }) => {
  const { user } = useAuth()
  const [state, setState] = useState({ loaded: false, features: null, plan: null, country: null })
  const refresh = useCallback(() => {
    if (!user) { setState({ loaded: true, features: null, plan: null, country: null }); return }
    api.get('/plan/modulos')
      .then(({ data }) => {
        if (data.country) setMoneyFormat(data.country.currency, data.country.locale)
        setState({ loaded: true, ...data })
      })
      .catch(() => setState({ loaded: true, features: null, plan: null, country: null }))
  }, [user])
  useEffect(() => { setState((s) => ({ ...s, loaded: false })); refresh() }, [refresh])
  const value = useMemo(() => ({
    ...state,
    has: (key) => !key || !state.features || state.features.includes(key),
    refresh
  }), [state, refresh])
  // Se espera el plan para que el menú y la moneda salgan bien desde el primer momento.
  if (user && !state.loaded) return <div className="splash"><span className="spinner" aria-hidden="true" /></div>
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>
}

export const usePlan = () => useContext(PlanContext)
