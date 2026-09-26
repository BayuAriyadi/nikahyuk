import { REVEAL_CLASSES, useReveal } from '../lib/useReveal.js'

/**
 * Pembungkus animasi "muncul saat discroll" untuk section halaman publik.
 * Varian diambil dari katalog template (klasik: naik, minimalis: membesar,
 * floral: meluncur samping). Kalau user memilih reduced-motion, useReveal
 * langsung mengembalikan shown=true sehingga tidak ada animasi sama sekali.
 */
export default function Reveal({ variant = 'up', delay = 0, children }) {
  const [ref, shown] = useReveal()
  const style = REVEAL_CLASSES[variant] ?? REVEAL_CLASSES.up

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`ny-reveal transition duration-700 ease-out ${shown ? style.shown : style.hidden}`}
    >
      {children}
    </div>
  )
}
