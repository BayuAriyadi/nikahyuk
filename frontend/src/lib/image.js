/**
 * Siapkan foto untuk upload: perkecil ke maksimum 1600 px (sisi terpanjang)
 * lalu encode ulang sebagai WebP kualitas 0.82 (fallback JPEG 0.85 di
 * browser yang belum bisa encode WebP).
 *
 * Alasan: php.ini runtime server membatasi upload 2 MB per file. Foto kamera
 * HP biasanya 3-8 MB, jadi di-resize dulu di browser sebelum dikirim supaya
 * tidak kena 413/422. WebP menghemat ~30% lebih banyak dari JPEG di kualitas
 * visual setara — halaman undangan jadi lebih cepat dibuka tamu.
 * Server tetap menormalkan ke WebP sebagai jaring pengaman.
 */

const MAX_DIMENSION = 1600
const WEBP_QUALITY = 0.82
const JPEG_QUALITY = 0.85
const MAX_BYTES = 2 * 1024 * 1024

export async function preparePhoto(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('File bukan gambar. Pilih foto JPG, PNG, atau WEBP.')
  }

  const source = await loadBitmap(file)
  const sourceWidth = source.naturalWidth ?? source.width
  const sourceHeight = source.naturalHeight ?? source.height
  const scale = Math.min(1, MAX_DIMENSION / Math.max(sourceWidth, sourceHeight))
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  context.drawImage(source, 0, 0, width, height)
  if (typeof source.close === 'function') {
    source.close()
  }

  let blob = await canvasToBlob(canvas, 'image/webp', WEBP_QUALITY)
  if (blob.type !== 'image/webp') {
    // Browser lama: toBlob menjatuhkan ke PNG. Pakai JPEG yang jauh lebih kecil.
    blob = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY)
  }

  const extension = blob.type === 'image/webp' ? 'webp' : 'jpg'
  const output = new File([blob], renameTo(file.name, extension), { type: blob.type })
  if (output.size > MAX_BYTES) {
    throw new Error('Foto masih terlalu besar setelah diproses. Coba foto lain.')
  }

  return output
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('Gagal memproses gambar.'))),
      type,
      quality,
    )
  })
}

async function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file)
    } catch {
      // Fallback ke elemen <img> (mis. format yang tidak didukung bitmap).
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Gambar tidak bisa dibaca.'))
    }
    image.src = url
  })
}

function renameTo(name, extension) {
  const base = String(name || 'foto').replace(/\.[^.]+$/, '') || 'foto'
  return `${base}.${extension}`
}
