/*
 * Penampil foto layar penuh (lightbox) yang dipakai bersama: galeri template
 * generik di PublicInvitation dan galeri template elegan. Keduanya butuh
 * perilaku yang sama — navigasi kiri/kanan, Esc menutup, geser di HP, dan
 * kunci scroll halaman selama terbuka.
 *
 * Dipakai dengan `index === -1` berarti tertutup, jadi pemanggil cukup
 * menyimpan satu angka di state.
 */
import { useEffect, useRef } from 'react'
import Icon from './Icon.jsx'

export default function Lightbox({ photos, index, onChange, onClose }) {
  const total = photos.length
  const touchStart = useRef(null)

  useEffect(() => {
    function handleKey(event) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') onChange((index + 1) % total)
      if (event.key === 'ArrowLeft') onChange((index - 1 + total) % total)
    }

    window.addEventListener('keydown', handleKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
    }
  }, [index, total, onChange, onClose])

  function handleTouchEnd(event) {
    if (touchStart.current === null) return
    const delta = event.changedTouches[0].clientX - touchStart.current
    touchStart.current = null
    if (Math.abs(delta) < 40) return
    onChange(delta < 0 ? (index + 1) % total : (index - 1 + total) % total)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Foto ${index + 1} dari ${total}`}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 px-4 py-5"
    >
      <div className="flex items-center justify-between text-white">
        <p className="text-sm text-white/85">
          {index + 1} / {total}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup galeri"
          className="rounded-full p-2 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <Icon name="close" className="h-5 w-5" />
        </button>
      </div>

      <div
        className="flex flex-1 items-center justify-center gap-2 sm:gap-4"
        onTouchStart={(event) => {
          touchStart.current = event.touches[0].clientX
        }}
        onTouchEnd={handleTouchEnd}
      >
        {total > 1 && (
          <button
            type="button"
            onClick={() => onChange((index - 1 + total) % total)}
            aria-label="Foto sebelumnya"
            className="shrink-0 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <Icon name="chevronLeft" className="h-5 w-5" />
          </button>
        )}
        <img
          src={photos[index]}
          alt={`Foto ${index + 1} dari ${total}`}
          className="max-h-[70vh] w-auto max-w-full rounded-2xl object-contain"
        />
        {total > 1 && (
          <button
            type="button"
            onClick={() => onChange((index + 1) % total)}
            aria-label="Foto berikutnya"
            className="shrink-0 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <Icon name="chevronRight" className="h-5 w-5" />
          </button>
        )}
      </div>

      <p className="text-center text-xs text-white/70">
        Tekan Esc untuk menutup, atau geser foto untuk pindah.
      </p>
    </div>
  )
}
