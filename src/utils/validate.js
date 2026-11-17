// Validaciones de los campos de texto en toda la app.
//
// 1. Mientras se escribe, cada campo solo acepta los caracteres que le corresponden:
//    · data-only="digits" o inputMode="numeric" o type="tel": solo números (documento, celular, kilometraje…).
//    · data-only="letters": letras con tildes y ñ, espacios, apóstrofo, punto y guion (nombres, apellidos, ciudad).
//    · data-only="nit": números y guion (NIT o documento fiscal).
//    · data-only="alnum": letras y números, sin espacios ni caracteres especiales (número de licencia).
//    · inputMode="decimal": números con una coma o un punto (tasas, galones).
//    · type="email": sin espacios.
// 2. Al enviar un formulario se revisa el correo y la longitud mínima (minLength) de cada campo lleno.
//    Si algo falla, se marca el campo con el mensaje del navegador y no se envía.

export const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i
export const NAME_RE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]{2,60}$/
export const PHONE_RE = /^[0-9]{7,10}$/
export const DOC_RE = /^[0-9]{5,15}$/
export const LICENSE_RE = /^[A-Za-z0-9]{3,20}$/
export const USERNAME_RE = /^[a-z0-9._-]{3,30}$/i

const FILTERS = {
  digits: (v) => v.replace(/\D/g, ''),
  letters: (v) => v.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]/g, ''),
  nit: (v) => v.replace(/[^0-9-]/g, ''),
  alnum: (v) => v.replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
  decimal: (v) => { const x = v.replace(/[^0-9.,]/g, ''); const i = x.search(/[.,]/); return i < 0 ? x : x.slice(0, i + 1) + x.slice(i + 1).replace(/[.,]/g, '') },
  email: (v) => v.replace(/\s/g, '')
}

const ruleOf = (el) => {
  if (!(el instanceof HTMLInputElement) || el.readOnly || el.disabled) return null
  if (el.dataset.only) return el.dataset.only
  if (el.closest('.input-prefix')) return null // campos de dinero: ya formatean solos
  if (el.type === 'email') return 'email'
  if (el.type === 'tel' || el.inputMode === 'numeric') return 'digits'
  if (el.inputMode === 'decimal') return 'decimal'
  return null
}

const onInput = (e) => {
  const el = e.target
  if (el instanceof HTMLInputElement) el.setCustomValidity('')
  const f = FILTERS[ruleOf(el)]
  if (!f) return
  const next = f(el.value)
  if (next !== el.value) el.value = next
}

const CHECKS = [
  (el) => el.type === 'email' && el.value && !EMAIL_RE.test(el.value) && 'Escribe un correo válido, por ejemplo nombre@correo.com',
  (el) => el.minLength > 0 && el.value && el.value.length < el.minLength && `Debe tener al menos ${el.minLength} caracteres`,
  (el) => el.dataset.only === 'letters' && el.value && el.value.trim().length < 2 && 'Escribe al menos 2 letras'
]

const onSubmit = (e) => {
  const form = e.target
  if (!(form instanceof HTMLFormElement)) return
  for (const el of form.querySelectorAll('input')) {
    if (el.disabled || el.readOnly) continue
    const msg = CHECKS.map((c) => c(el)).find(Boolean)
    if (msg) {
      e.preventDefault(); e.stopImmediatePropagation()
      el.setCustomValidity(msg); el.reportValidity(); el.focus()
      return
    }
  }
}

let installed = false
export const installInputGuards = () => {
  if (installed || typeof document === 'undefined') return
  installed = true
  // En captura: corre antes que React, así el valor ya llega limpio al onChange.
  document.addEventListener('input', onInput, true)
  document.addEventListener('submit', onSubmit, true)
}

// Errores de un formulario: { campo: [tipo, valor, obligatorio] } → lista de mensajes.
const LABELS = { doc: 'El documento', name: 'El nombre', phone: 'El celular', email: 'El correo', username: 'El usuario' }
export const formErrors = (fields) => {
  const out = []
  for (const [key, [type, raw, required]] of Object.entries(fields)) {
    const v = String(raw ?? '').trim()
    const label = key === 'lastName' ? 'Los apellidos' : LABELS[type]
    if (!v) { if (required) out.push(`${label} es obligatorio.`); continue }
    if (type === 'doc' && !DOC_RE.test(v)) out.push('El documento solo admite números (5 a 15).')
    if (type === 'name' && !NAME_RE.test(v)) out.push(`${label} solo admite letras.`)
    if (type === 'phone' && !PHONE_RE.test(v)) out.push('El celular debe tener de 7 a 10 números.')
    if (type === 'email' && !EMAIL_RE.test(v)) out.push('El correo no es válido.')
    if (type === 'username' && !USERNAME_RE.test(v)) out.push('El usuario solo admite letras, números, punto, guion y guion bajo (3 a 30).')
  }
  return out
}
