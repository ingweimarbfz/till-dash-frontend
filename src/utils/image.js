// Reduce una imagen del usuario (foto o logo) y la devuelve como data URL JPEG/PNG.
export const fileToDataUrl = (file, { max = 512, type = 'image/jpeg', quality = 0.85 } = {}) =>
  new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) { reject(new Error('El archivo debe ser una imagen')); return }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Imagen no válida'))
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height) }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL(type, quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
