/*
 * Salin teks ke clipboard.
 *
 * Pakai Clipboard API kalau tersedia (butuh secure context: HTTPS atau localhost).
 * Kalau tidak, fallback ke textarea + execCommand supaya tetap jalan di akses http
 * biasa (mis. lewat IP Tailscale). Kalau keduanya gagal, lempar Error supaya
 * pemanggil bisa menampilkan umpan balik "gagal menyalin" alih-alih gagal senyap.
 */
export function copyText(value) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(value)
  }

  const area = document.createElement('textarea')
  area.value = value
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(area)
  return ok ? Promise.resolve() : Promise.reject(new Error('Gagal menyalin.'))
}
