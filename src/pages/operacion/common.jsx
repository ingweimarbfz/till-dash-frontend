import React from 'react'
import { useAuth } from '../../context/AuthContext'

// ---------- Etapa 3: utilidades de mesas, pedidos y caja ----------
export const ADMIN = ['superadmin', 'admin']
export const ORDER_TYPES = { mesa: 'Mesa', llevar: 'Para llevar', domicilio: 'Domicilio', barra: 'Barra' }
export const ORDER_STATUS = { abierto: 'Abierto', cobrado: 'Cobrado', anulado: 'Anulado' }
export const ORDER_TONE = { abierto: 'warn', cobrado: 'ok', anulado: 'muted' }
export const ITEM_STATUS = { pendiente: 'Pendiente', preparando: 'Preparando', listo: 'Listo', entregado: 'Entregado', anulado: 'Anulado' }
export const ITEM_TONE = { pendiente: 'muted', preparando: 'warn', listo: 'ok', entregado: '', anulado: 'bad' }
export const AREA_LABEL = { cocina: 'Cocina', bar: 'Bar', barista: 'Barista', ninguna: 'Directo' }
export const PAY_METHODS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', nequi: 'Nequi', daviplata: 'Daviplata', cuenta_por_cobrar: 'Cuenta por cobrar', otro: 'Otro' }
export const TABLE_STATUS = { libre: 'Libre', ocupada: 'Ocupada', por_cobrar: 'Pidió la cuenta', por_liberar: 'Cobrada, por liberar' }

// Permisos por cargo, igual que el backend (src/ops.js).
export const useCan = () => {
  const { user } = useAuth()
  return (...positions) => ADMIN.includes(user.role) || (user.role === 'empleado' && positions.some((p) => (user.positions || []).includes(p)))
}

// "hace 5 min", "hace 1 h 20 min".
export const since = (d, now = Date.now()) => {
  const m = Math.max(0, Math.floor((now - new Date(d).getTime()) / 60000))
  if (m < 1) return 'ahora'
  if (m < 60) return `hace ${m} min`
  return `hace ${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`
}
export const minutes = (d, now = Date.now()) => Math.max(0, Math.floor((now - new Date(d).getTime()) / 60000))

// Sonido corto para avisos (llamados de mesa y comandas nuevas). El navegador solo lo deja sonar
// después de que el usuario haya tocado la página al menos una vez.
let audioCtx = null
export const beep = (times = 2) => {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)()
    for (let i = 0; i < times; i++) {
      const t = audioCtx.currentTime + i * 0.28
      const o = audioCtx.createOscillator(); const g = audioCtx.createGain()
      o.type = 'sine'; o.frequency.setValueAtTime(i % 2 ? 660 : 880, t)
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
      o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + 0.24)
    }
  } catch { /* sin audio */ }
}

export const Qty = ({ value }) => <>{Number(value).toLocaleString('es-CO', { maximumFractionDigits: 3 })}</>
