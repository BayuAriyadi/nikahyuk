/*
 * Bantu fitur bagikan undangan.
 *
 * Tautan dibangun dari window.location.origin apa adanya, jadi otomatis ikut host
 * yang sedang dipakai pengunjung (localhost saat dev, IP Tailscale, atau domain
 * produksi nanti) tanpa konfigurasi tambahan.
 */

/** URL publik undangan, contoh: http://100.66.135.80:5173/anto-sumanto */
export function invitationUrl(slug) {
  if (typeof window === 'undefined' || !slug) return ''
  return `${window.location.origin}/${slug}`
}

/** Teks pembuka khas undangan WA: sopan, singkat, tanpa asumsi agama. */
export function invitationShareMessage({ url, groom, bride }) {
  return [
    'Tanpa mengurangi rasa hormat, kami mengundang Bapak/Ibu/Saudara/i untuk hadir di pernikahan kami:',
    `${groom} & ${bride}`,
    '',
    `Berikut link undangan kami: ${url}`,
  ].join('\n')
}

/** Link wa.me dengan teks terisi; tamu tinggal pilih kontak tujuan. */
export function whatsappShareUrl(params) {
  return `https://wa.me/?text=${encodeURIComponent(invitationShareMessage(params))}`
}

/** Tautan undangan personal: halaman menyapa tamu dengan namanya (dipakai "Daftar Tamu"). */
export function invitationGuestUrl(slug, guestName) {
  if (typeof window === 'undefined' || !slug) return ''
  const base = `${window.location.origin}/${slug}`
  return guestName ? `${base}?to=${encodeURIComponent(guestName)}` : base
}

/** Teks WA per tamu: menyapa by name dan memakai tautan personal. */
export function whatsappGuestShareUrl({ url, groom, bride, guestName }) {
  const text = [
    `Kepada Bapak/Ibu/Saudara/i ${guestName},`,
    'tanpa mengurangi rasa hormat, kami mengundang Anda untuk hadir di pernikahan kami:',
    `${groom} & ${bride}`,
    '',
    `Berikut link undangan kami: ${url}`,
  ].join('\n')

  // Tanpa nomor tujuan: WhatsApp membuka daftar kontak dan pemilik memilih sendiri.
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

/** Web Share API (share sheet bawaan HP). Tidak tersedia di semua browser. */
export function canNativeShare() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}
