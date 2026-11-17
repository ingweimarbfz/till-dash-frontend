# TillDash+ · Frontend

App web responsive (PC, tablet y celular) de TillDash+: mesas, pedidos, caja, inventario y reportes para
restaurantes, bares, markets, social bars y discotecas. React 18 + Vite + React Router (misma base que QuontUp360).

## Arranque local
```bash
cp .env.example .env    # VITE_API_URL apunta al backend (por defecto http://localhost:4000)
npm install
npm run dev             # http://localhost:3000
```

## Estructura
```
src/
  App.jsx               rutas y protección por rol
  api/client.js         axios con token, sucursal elegida y cierre de sesión al expirar
  context/              sesión (AuthContext) y configuración + apariencia del establecimiento (SettingsContext)
  layout/AppLayout.jsx  menú lateral, barra superior, buscador (Ctrl K) y selector de sucursal
  components/           ui (tarjetas, KPI, modal, toast), logo, login, buscador, firma digital
  pages/                dashboard por rol, usuarios, sucursales y bodegas, bitácora, configuración, apariencia, perfil
  utils/nav.js          menú de cada rol (superadmin, admin, empleado, cliente)
  utils/theme.js        aplica colores, fuente y modo claro/oscuro del establecimiento
  styles/               tokens de marca y sistema de diseño
docs/marca/             símbolo y guía de identidad
```

## Apariencia
El superadmin cambia colores (principal, secundario y acento), logo, ícono, fuente y modo claro/oscuro en
Configuración → Apariencia. Se aplican en vivo sobre las variables de `styles/tokens.css`.

## Despliegue
`vercel.json` lista para Vercel. Variable: `VITE_API_URL` con la URL del backend en Render.
