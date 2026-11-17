import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SettingsProvider } from './context/SettingsContext'
import AppLayout from './layout/AppLayout'
import Login from './components/Login'
import { Spinner } from './components/ui'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const AppearancePage = lazy(() => import('./pages/AppearancePage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const SitesPage = lazy(() => import('./pages/sucursales/SitesPage'))
const LogbookPage = lazy(() => import('./pages/bitacora/LogbookPage'))
const ProductsPage = lazy(() => import('./pages/inventario/ProductsPage'))
const ProductDetail = lazy(() => import('./pages/inventario/ProductDetail'))
const CategoriesPage = lazy(() => import('./pages/inventario/CategoriesPage'))
const InventoryPage = lazy(() => import('./pages/inventario/InventoryPage'))
const PromotionsPage = lazy(() => import('./pages/inventario/PromotionsPage'))
const NotificationsPage = lazy(() => import('./pages/notificaciones/NotificationsPage'))
const TablesPage = lazy(() => import('./pages/operacion/TablesPage'))
const ReportsPage = lazy(() => import('./pages/reportes/ReportsPage'))
const IncidentsPage = lazy(() => import('./pages/operacion/IncidentsPage'))
const TablesConfigPage = lazy(() => import('./pages/operacion/TablesConfigPage'))
const OrdersPage = lazy(() => import('./pages/operacion/OrdersPage'))
const OrderPage = lazy(() => import('./pages/operacion/OrderPage'))
const KitchenPage = lazy(() => import('./pages/operacion/KitchenPage'))
const CashPage = lazy(() => import('./pages/caja/CashPage'))
const ReceivablesPage = lazy(() => import('./pages/caja/ReceivablesPage'))
const MenuPage = lazy(() => import('./pages/public/MenuPage'))

const OWNER = ['superadmin']
const ADMIN = ['superadmin', 'admin']
const STAFF = ['superadmin', 'admin', 'empleado']

const Splash = () => <div className="splash"><Spinner /></div>

// Protege una ruta: exige sesión y, si se indica, uno de los roles.
const Protected = ({ roles, children }) => {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Splash />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

const LoginRoute = () => {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  return user ? <Navigate to="/" replace /> : <Login />
}

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <SettingsProvider>
        <Suspense fallback={<Splash />}>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/carta/:token" element={<MenuPage />} />
            <Route element={<Protected><AppLayout /></Protected>}>
              <Route index element={<Dashboard />} />
              <Route path="perfil" element={<ProfilePage />} />
              <Route path="usuarios" element={<Protected roles={ADMIN}><UsersPage /></Protected>} />
              <Route path="sucursales" element={<Protected roles={ADMIN}><SitesPage /></Protected>} />
              <Route path="bitacora" element={<Protected roles={ADMIN}><LogbookPage /></Protected>} />
              <Route path="mesas" element={<Protected roles={STAFF}><TablesPage /></Protected>} />
              <Route path="pedidos" element={<Protected roles={STAFF}><OrdersPage /></Protected>} />
              <Route path="pedidos/:id" element={<Protected roles={STAFF}><OrderPage /></Protected>} />
              <Route path="comandas" element={<Protected roles={STAFF}><KitchenPage /></Protected>} />
              <Route path="caja" element={<Protected roles={STAFF}><CashPage /></Protected>} />
              <Route path="reportes" element={<Protected roles={ADMIN}><ReportsPage /></Protected>} />
              <Route path="incidentes" element={<Protected roles={STAFF}><IncidentsPage /></Protected>} />
              <Route path="cuentas-por-cobrar" element={<Protected roles={STAFF}><ReceivablesPage /></Protected>} />
              <Route path="productos" element={<Protected roles={STAFF}><ProductsPage /></Protected>} />
              <Route path="productos/:id" element={<Protected roles={STAFF}><ProductDetail /></Protected>} />
              <Route path="categorias" element={<Protected roles={ADMIN}><CategoriesPage /></Protected>} />
              <Route path="inventario" element={<Protected roles={STAFF}><InventoryPage /></Protected>} />
              <Route path="promociones" element={<Protected roles={ADMIN}><PromotionsPage /></Protected>} />
              <Route path="notificaciones" element={<Protected roles={ADMIN}><NotificationsPage /></Protected>} />
              <Route path="configuracion" element={<Protected roles={ADMIN}><SettingsPage /></Protected>} />
              <Route path="configuracion/mesas" element={<Protected roles={ADMIN}><TablesConfigPage /></Protected>} />
              <Route path="configuracion/apariencia" element={<Protected roles={OWNER}><AppearancePage /></Protected>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </SettingsProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
