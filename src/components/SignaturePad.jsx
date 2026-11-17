import React, { useEffect, useRef, useState } from 'react'
import { MdDelete } from 'react-icons/md'

// Firma digital dibujada con el dedo, el lápiz o el mouse. Entrega un PNG transparente en data URL.
const SignaturePad = ({ value, onChange, height = 170 }) => {
  const canvas = useRef(null)
  const drawing = useRef(false)
  const last = useRef(null)
  const [empty, setEmpty] = useState(!value)

  useEffect(() => {
    const cv = canvas.current
    const ratio = window.devicePixelRatio || 1
    cv.width = cv.offsetWidth * ratio
    cv.height = height * ratio
    const ctx = cv.getContext('2d')
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1F2933'
    if (value) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, cv.offsetWidth, height)
      img.src = value
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const point = (e) => {
    const r = canvas.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const down = (e) => { e.preventDefault(); canvas.current.setPointerCapture(e.pointerId); drawing.current = true; last.current = point(e) }
  const move = (e) => {
    if (!drawing.current) return
    const p = point(e)
    const ctx = canvas.current.getContext('2d')
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke()
    last.current = p
    setEmpty(false)
  }
  const up = () => {
    if (!drawing.current) return
    drawing.current = false
    onChange(canvas.current.toDataURL('image/png'))
  }
  const clear = () => {
    const cv = canvas.current
    cv.getContext('2d').clearRect(0, 0, cv.width, cv.height)
    setEmpty(true)
    onChange(null)
  }

  return (
    <div className="signature">
      <canvas ref={canvas} style={{ height }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} aria-label="Área para firmar" />
      {empty && <span className="signature-hint">Firma aquí</span>}
      <button type="button" className="btn btn-sm btn-ghost" onClick={clear}><MdDelete /> Borrar</button>
    </div>
  )
}

export default SignaturePad
