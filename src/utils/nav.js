import {
  MdDashboard, MdManageAccounts, MdSettings, MdMenuBook, MdPerson, MdPlace, MdPalette,
  MdTableRestaurant, MdReceiptLong, MdPointOfSale, MdInventory2, MdCategory, MdLocalOffer, MdBarChart, MdAccountBalance, MdQrCode2, MdNotificationsActive, MdRestaurantMenu,
  MdSoupKitchen, MdRequestQuote, MdReportProblem, MdLocalDining
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
    { to: '/carta', label: 'Carta', icon: MdLocalDining },
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
      { to: '/reportes', label: 'Reportes', icon: MdBarChart },
      { to: '/finanzas', label: 'Finanzas', icon: MdAccountBalance },
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
    { title: 'Consulta', items: [{ to: '/carta', label: 'Carta', icon: MdLocalDining }, { to: '/productos', label: 'Productos', icon: MdRestaurantMenu }, { to: '/inventario', label: 'Inventario', icon: MdInventory2 }] }
  ],
  cliente: [
    { title: 'Mi mesa', items: [{ to: '/', label: 'Carta y pedido', icon: MdQrCode2, end: true }] }
  ]
}

export const ACCOUNT_NAV = [{ to: '/perfil', label: 'Mi perfil', icon: MdPerson }]
const PLAN_NAV = { title: 'Cuenta', items: [{ to: '/mi-plan', label: 'Mi plan', icon: MdPerson }, { to: '/legal', label: 'Documentos legales', icon: MdPerson }] }

// Pantalla → módulo del plan que la habilita (lo que no aparece es del núcleo).
export const FEATURE_OF = {
  '/comandas': 'comandas', '/cuentas-por-cobrar': 'cuentas_por_cobrar', '/promociones': 'promociones', '/incidentes': 'incidentes',
  '/reportes': 'reportes', '/finanzas': 'finanzas', '/bitacora': 'bitacora', '/notificaciones': 'telegram', '/configuracion/apariencia': 'marca'
}

// Menú del usuario: por rol, por los módulos de su plan y, para el empleado, por sus cargos.
export const navFor = (role, positions = [], has = () => true) => (NAV[role] || []).map((s) => ({
  ...s,
  items: s.items.filter((i) => has(FEATURE_OF[i.to]) && (role !== 'empleado' || !i.positions || i.positions.some((p) => positions.includes(p))))
})).filter((s) => s.items.length)

// Título de la página actual para la barra superior.
export const titleFor = (role, pathname, positions = []) => {
  for (const s of [...navFor(role, positions), { title: 'Cuenta', items: ACCOUNT_NAV }, PLAN_NAV]) {
    for (const i of s.items) {
      if (i.end ? pathname === i.to : pathname.startsWith(i.to)) return { section: s.title, title: i.label }
    }
  }
  return { section: '', title: '' }
}
