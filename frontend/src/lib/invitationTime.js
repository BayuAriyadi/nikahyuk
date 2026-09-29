/*
 * Perhitungan waktu acara untuk halaman tamu DAN pratinjau template.
 * Dipisah ke lib supaya halaman (PublicInvitation) tidak mengekspor
 * fungsi non-komponen — aturan Fast Refresh.
 */

/** "2026-09-26" + "09:57" -> Date lokal; null kalau tidak bisa diparse. */
export function parseEventMoment(ev) {
  if (!ev?.date) return null
  const time = String(ev.time || '00:00').slice(0, 5)
  const moment = new Date(`${ev.date}T${time}`)
  return Number.isNaN(moment.getTime()) ? null : moment
}

/**
 * Momen acara paling awal (akad / resepsi) untuk tanggal cover dan countdown.
 * Pratinjau (components/templates/InvitationPreview) memakai perhitungan yang
 * sama dengan halaman tamu.
 */
export function eventMainMoment(eventData) {
  const moments = [parseEventMoment(eventData?.akad), parseEventMoment(eventData?.resepsi)].filter(Boolean)
  if (moments.length === 0) return null
  return new Date(Math.min(...moments.map((moment) => moment.getTime())))
}
