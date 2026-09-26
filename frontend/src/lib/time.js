/*
 * Format waktu relatif berbahasa Indonesia ("2 jam yang lalu").
 * Dipakai halaman undangan publik dan dashboard (daftar tamu, buku ucapan).
 */
const REL_FMT = new Intl.RelativeTimeFormat('id-ID', { numeric: 'auto' })

export function timeAgo(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffSeconds = Math.round((then - Date.now()) / 1000)
  if (Math.abs(diffSeconds) < 45) return 'baru saja'
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds) {
      return REL_FMT.format(Math.round(diffSeconds / seconds), unit)
    }
  }
  return 'baru saja'
}
