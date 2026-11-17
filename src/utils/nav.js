import {
  MdDashboard, MdManageAccounts, MdSettings, MdMenuBook, MdPerson, MdPlace, MdPalette,
  MdTableRestaurant, MdReceiptLong, MdPointOfSale, MdInventory2, MdCategory, MdLocalOffer, MdBarChart, MdAccountBalance, MdQrCode2, MdNotificationsActive, MdRestaurantMenu
} from 'react-icons/md'

export const ROLE_LABELS = { superadmin: 'Super administrador', admin: 'Administrador', empleado: 'Empleado', cliente: 'Cliente' }
export const POSITION_LABELS = { mesero: 'Mesero', cajero: 'Cajero', cocina: 'Cocina', bartender: 'Bartender', barista: 'Barista', domiciliario: 'Domiciliario', host: 'Anfitrión', bodega: 'Bodega' }
export const POSITIONS = Object.keys(POSITION_LABELS)

// Lo que llega en las próximas etapas se muestra deshabilitado con la etapa (soon).
const OPERATION = {
  title: 'Operación',
  items: [
    { to: '/mesas', label: 'Mesas', icon: MdTableRestaurant, soon: 'etapa 3' },
    { to: '/pedidos', label: 'Pedidos', icon: MdReceiptLong, soon: 'etapa 3' },
    { to: '/caja', label: 'Caja', icon: MdPointOfSale, soon: 'etapa 3' }
  ]
}
const CATALOG = {
  title: 'Catálogo e inventario',
  items: [
    { to: '/productos', label: 'Productos', icon: MdRestaurantMenu },
    { to: '/categorias', label: 'Categorías', icon: MdCategory },
    { to: '/inventario', label: 'Inventario', icon: MdInventory2 },
    { to: '/promociones', label: 'Promociones', icon: MdLocalOffer }
  ]
}
const adminNav = (owner) => [
  { title: 'General', items: [{ to: '/', label: 'Dashboard', icon: MdDashboard, end: true }] },
  OPERATION,
  CATALOG,
  {
    title: 'Administración',
    items: [
      { to: '/reportes', label: 'Reportes', icon: MdBarChart, soon: 'etapa 4' },
      { to: '/finanzas', label: 'Finanzas', icon: MdAccountBalance, soon: 'etapa 4' },
      { to: '/bitacora', label: 'Bitácora', icon: MdMenuBook },
      { to: '/sucursales', label: 'Sucursales y bodegas', icon: MdPlace },
      { to: '/usuarios', label: 'Usuarios', icon: MdManageAccounts },
      { to: '/notificaciones', label: 'Notificaciones', icon: MdNotificationsActive },
      { to: '/configuracion', label: 'Configuración', icon: MdSettings, end: true },
      ...(owner ? [{ to: '/configuracion/apariencia', label: 'Apariencia', icon: MdPalette }] : [])
    ]
  }
]

const NAV = {
  superadmin: adminNav(true),
  admin: adminNav(false),
  empleado: [
    { title: 'General', items: [{ to: '/', label: 'Mi turno', icon: MdDashboard, end: true }] },
    OPERATION,
    { title: 'Consulta', items: [{ to: '/productos', label: 'Productos', icon: MdRestaurantMenu }, { to: '/inventario', label: 'Inventario', icon: MdInventory2 }] }
  ],
  cliente: [
    { title: 'Mi mesa', items: [{ to: '/', label: 'Carta y pedido', icon: MdQrCode2, end: true }] }
  ]
}

export const ACCOUNT_NAV = [{ to: '/perfil', label: 'Mi perfil', icon: MdPerson }]

export const navFor = (role) => NAV[role] || []

// Título de la página actual para la barra superior.
export const titleFor = (role, pathname) => {
  for (const s of [...navFor(role), { title: 'Cuenta', items: ACCOUNT_NAV }]) {
    for (const i of s.items) {
      if (i.end ? pathname === i.to : pathname.startsWith(i.to)) return { section: s.title, title: i.label }
    }
  }
  return { section: '', title: '' }
}
