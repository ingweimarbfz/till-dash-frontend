import {
  MdDashboard, MdManageAccounts, MdSettings, MdMenuBook, MdPerson, MdPlace, MdPalette,
  MdTableRestaurant, MdReceiptLong, MdPointOfSale, MdInventory2, MdCategory, MdLocalOffer, MdBarChart, MdAccountBalance, MdQrCode2, MdNotificationsActive, MdRestaurantMenu,
  MdSoupKitchen, MdRequestQuote, MdReportProblem
} from 'react-icons/md'

export const ROLE_LABELS = { superadmin: 'Super administrador', admin: 'Administrador', empleado: 'Empleado', cliente: 'Cliente' }
export const POSITION_LABELS = { mesero: 'Mesero', cajero: 'Cajero', cocina: 'Cocina', bartender: 'Bartender', barista: 'Barista', domiciliario: 'Domiciliario', host: 'Anfitrión', bodega: 'Bodega' }
export const POSITIONS = Object.keys(POSITION_LABELS)

// Lo que llega en las próximas etapas se muestra deshabilitado con la etapa (soon).
// positions: cargos del empleado que ven la opción (el administrador ve todas).
const SELLERS = ['mesero', 'cajero', 'host', 'bartender', 'barista']
const OPERATION = {
  title: 'Operación',
  items: [
    { to: '/mesas', label: 'Mesas', icon: MdTableRestaurant, positions: SELLERS },
    { to: '/pedidos', label: 'Pedidos', icon: MdReceiptLong, positions: SELLERS },
    { to: '/comandas', label: 'Comandas', icon: MdSoupKitchen, positions: ['cocina', 'bartender', 'barista'] },
    { to: '/caja', label: 'Caja', icon: MdPointOfSale, positions: ['cajero'] },
    { to: '/cuentas-por-cobrar', label: 'Cuentas por cobrar', icon: MdRequestQuote, positions: ['cajero'] },
    { to: '/incidentes', label: 'Incidentes', icon: MdReportProblem }
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
      { to: '/configuracion/mesas', label: 'Mesas y QR', icon: MdQrCode2 },
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

// Menú del usuario: por rol y, para el empleado, por sus cargos.
export const navFor = (role, positions = []) => (NAV[role] || []).map((s) => (role !== 'empleado' ? s : {
  ...s, items: s.items.filter((i) => !i.positions || i.positions.some((p) => positions.includes(p)))
})).filter((s) => s.items.length)

// Título de la página actual para la barra superior.
export const titleFor = (role, pathname, positions = []) => {
  for (const s of [...navFor(role, positions), { title: 'Cuenta', items: ACCOUNT_NAV }]) {
    for (const i of s.items) {
      if (i.end ? pathname === i.to : pathname.startsWith(i.to)) return { section: s.title, title: i.label }
    }
  }
  return { section: '', title: '' }
}
