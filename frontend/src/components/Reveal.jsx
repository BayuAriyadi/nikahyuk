import { REVEAL_CLASSES, REVEAL_DURATION, useReveal } from '../lib/useReveal.js'

/**
 * Pembungkus animasi "muncul saat discroll" untuk section halaman publik.
 * Varian diambil dari katalog template (klasik: naik, minimalis: membesar,
 * floral: meluncur samping). Kalau user memilih reduced-motion, useReveal
 * langsung mengembalikan shown=true sehingga tidak ada animasi sama sekali.
 */
export default function Reveal({ variant = 'up', delay = 0, children }) {
  const [ref, shown] = useReveal()
  const style = REVEAL_CLASSES[variant] ?? REVEAL_CLASSES.up
  const duration = REVEAL_DURATION[variant] ?? REVEAL_DURATION.up

  // Durasi dibawa sendiri per varian: varian lambat (veil pakai blur,
  // bloom/lift jarak tempuh jauh) butuh waktu lebih supaya tidak menyentak.
  const styles = { transitionDuration: `${duration}ms` }
  if (delay) styles.transitionDelay = `${delay}ms`

  return (
    <div
      ref={ref}
      style={styles}
      className={`ny-reveal transition ease-out ${shown ? style.shown : style.hidden}`}
    >
      {children}
    </div>
  )
}
