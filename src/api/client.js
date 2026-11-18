import axios from 'axios'

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const TOKEN_KEY = 'td_token'

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } },
  set: (t) => { try { localStorage.setItem(TOKEN_KEY, t) } catch { /* sin almacenamiento */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY) } catch { /* sin almacenamiento */ } }
}

const api = axios.create({ baseURL: API_BASE, timeout: 30000 })

// Sucursal elegida por el administrador: se envía como ?sede= en todas las peticiones.
const SITE_KEY = 'td_sede'
let siteFilter = (() => { try { return Number(localStorage.getItem(SITE_KEY)) || null } catch { return null } })()
export const getSiteFilter = () => siteFilter
export const setSiteFilter = (id) => {
  siteFilter = Number(id) || null
  try { siteFilter ? localStorage.setItem(SITE_KEY, String(siteFilter)) : localStorage.removeItem(SITE_KEY) } catch { /* sin almacenamiento */ }
}

api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (siteFilter && !config.url.startsWith('/login') && !(config.params && 'sede' in config.params)) {
    config.params = { ...(config.params || {}), sede: siteFilter }
  }
  return config
})

// Si la sesión expira o el usuario fue desactivado, se avisa a la app para cerrar sesión.
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/login') && !error.config?.url?.startsWith('/carta')) {
      window.dispatchEvent(new CustomEvent('td:unauthorized'))
    }
    return Promise.reject(error)
  }
)

export const errorMessage = (error, fallback = 'Ocurrió un error. Intenta de nuevo.') =>
  error?.response?.data?.message || (error?.request && !error?.response ? 'No hay conexión con el servidor.' : fallback)

export default api
