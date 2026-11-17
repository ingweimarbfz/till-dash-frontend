import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api, { tokenStore } from '../api/client'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Al abrir la app se valida el token guardado.
  useEffect(() => {
    if (!tokenStore.get()) { setLoading(false); return }
    api.get('/auth/me')
      .then(({ data }) => setUser(data))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false))
  }, [])

  const logout = useCallback(() => { tokenStore.clear(); setUser(null) }, [])

  useEffect(() => {
    window.addEventListener('td:unauthorized', logout)
    return () => window.removeEventListener('td:unauthorized', logout)
  }, [logout])

  // si el usuario tiene varios perfiles y no eligió uno, devuelve { chooseProfile, profiles } sin iniciar sesión.
  const login = useCallback(async (username, password, profile) => {
    const { data } = await api.post('/login', { username, password, profile })
    if (data.chooseProfile) return data
    tokenStore.set(data.token)
    setUser(data.user)
    return data.user
  }, [])

  // Cambiar de perfil sin cerrar sesión: recarga la app en el inicio del nuevo perfil.
  const switchProfile = useCallback(async (role) => {
    const { data } = await api.post('/auth/perfil', { role })
    tokenStore.set(data.token)
    window.location.assign('/')
  }, [])

  const value = useMemo(() => ({ user, loading, login, logout, setUser, switchProfile }), [user, loading, login, logout, switchProfile])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
