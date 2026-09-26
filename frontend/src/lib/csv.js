/*
 * Ekspor daftar tamu ke CSV (buka di Excel / Google Sheets).
 *
 * Dua hal yang gampang salah dan sengaja ditangani di sini:
 *  - BOM UTF-8 di awal berkas: tanpa itu Excel Windows membaca karakter
 *    Indonesia ("Bapak/Ibu/Saudara/i", nama beraksen) jadi tanda tanya.
 *  - Awalan `=`, `+`, `-`, `@` pada nilai: Excel menafsirkannya sebagai
 *    rumus begitu berkas dibuka. Ucapan tamu seperti "=1+1" akan dieksekusi,
 *    jadi nilai yang diawali karakter itu dikutip dengan apostrof di depan.
 */
function escapeCell(value) {
  const text = value == null ? '' : String(value)
  // Nilai yang mirip rumus: amankan dengan apostrof (Excel menampilkannya apa adanya).
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** Buat isi CSV dari baris-baris (array of array). */
export function toCsv(rows) {
  return rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')
}

/**
 * Unduh berkas CSV di browser.
 *
 * @param {string} filename Nama berkas, sudah termasuk .csv.
 * @param {Array<Array>} rows Baris data; baris pertama biasanya header.
 */
export function downloadCsv(filename, rows) {
  // \uFEFF = BOM UTF-8, supaya Excel tidak salah baca karakter non-ASCII.
  const blob = new Blob([`\uFEFF${toCsv(rows)}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  // Revoke ditunda: Safari kadang belum selesai membaca blob saat object
  // URL langsung dicabut di tick yang sama.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
