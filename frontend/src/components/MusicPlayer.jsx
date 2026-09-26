import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'

/*
 * Pemutar musik latar undangan.
 *
 * Kebijakan autoplay browser: audio tidak boleh berbunyi sebelum ada interaksi
 * pengguna. Karena itu pemutar ini TIDAK mencoba play sendiri saat halaman
 * dimuat; ia menunggu `started` menjadi true (dipicu tombol "Buka Undangan"
 * di cover) lalu memutar lagu. Tombol speaker di kanan bawah jadi saklar
 * on/off, dan tetap tampil supaya tamu bisa mematikan musiknya.
 *
 * Kalau browser menolak play() (mis. iOS Low Power Mode), state balik ke
 * "paused" tanpa error di layar; tamu tinggal tekan tombol speaker.
 */
export default function MusicPlayer({ src, title, started }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (audio.paused) {
      audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    } else {
      audio.pause()
      setPlaying(false)
    }
  }, [])

  // Mulai saat tamu membuka undangan (interaksi pertama = izin autoplay).
  useEffect(() => {
    if (!started || !src) return
    const audio = audioRef.current
    if (!audio || !audio.paused) return

    audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
  }, [started, src])

  if (!src) return null

  return (
    <>
      {/* Audio selalu ter-mount supaya play() saat "Buka Undangan" tidak
          menunggu elemen baru; tombolnya baru muncul setelah undangan dibuka
          (sebelum itu tampilannya app cover, tidak ada yang bisa dimatikan). */}
      <audio ref={audioRef} src={src} loop preload="none" />

      {started && (
        <>
          {playing && (
            <span
              aria-hidden="true"
              className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-30 h-11 w-11 animate-ping rounded-full bg-rose-400/25"
            />
          )}
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? 'Matikan musik' : 'Nyalakan musik'}
            title={title ? `${playing ? 'Matikan' : 'Putar'} musik: ${title}` : undefined}
            className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-rose-200 bg-white/95 text-rose-700 shadow-lg shadow-rose-900/10 backdrop-blur transition hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
          >
            <Icon name={playing ? 'volume' : 'volumeOff'} className="h-5 w-5" />
            <span className="sr-only">{playing ? 'Musik menyala' : 'Musik mati'}</span>
          </button>
        </>
      )}
    </>
  )
}
