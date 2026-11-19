import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { MdCheckCircle, MdError, MdClose } from 'react-icons/md'
import { printFallback } from '../utils/printer'

// Avisos de impresión para toda la app (TD-018): "enviado a la impresora" o por qué no salió el tiquete,
// con la opción de imprimirlo por el navegador mientras se arregla la térmica.
const PrintNotices = () => {
  const [n, setN] = useState(null)
  useEffect(() => {
    const on = (e) => setN({ ...e.detail, key: Date.now() })
    window.addEventListener('tilldash:impresion', on)
    return () => window.removeEventListener('tilldash:impresion', on)
  }, [])
  useEffect(() => {
    if (!n) return undefined
    const t = setTimeout(() => setN(null), n.ok ? 3000 : 12000)
    return () => clearTimeout(t)
  }, [n])
  if (!n) return null
  return createPortal(
    <div className={`toast print-notice ${n.ok ? 'ok' : 'bad'}`} role={n.ok ? 'status' : 'alert'} key={n.key}>
      {n.ok ? <MdCheckCircle /> : <MdError />}
      <span>
        {n.ok ? n.message : <>No se pudo imprimir: {n.error}</>}
        {!n.ok && (
          <span className="print-notice-actions">
            {n.fallback && <button type="button" onClick={() => { printFallback(n.fallback); setN(null) }}>Imprimir por el navegador</button>}
            <Link to="/impresora" onClick={() => setN(null)}>Revisar impresora</Link>
          </span>
        )}
      </span>
      {!n.ok && <button type="button" className="print-notice-x" aria-label="Cerrar" onClick={() => setN(null)}><MdClose /></button>}
    </div>,
    document.body
  )
}

export default PrintNotices
