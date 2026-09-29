import { useEffect, useRef, useState } from 'react'

/**
 * Reveal saat masuk viewport (animasi interaktif yang menghormati
 * prefers-reduced-motion). Dipakai lintas template dengan `variant`:
 *
 *   up     - naik + memudar (klasik)
 *   zoom   - membesar halus (minimalis)
 *   side   - meluncur dari samping (floral)
 *   fade   - memudar tanpa gerak (krem; tenang, cocok tipografi cetak)
 *   lift   - naik lebih jauh + memudar pelan (ceria)
 *   tilt   - miring sedikit lalu lurus, seperti kartu dibalik (galeri)
 *   bloom  - mengembang dari kecil + memudar, agak memantul (floral)
 *   veil   - kabur (blur) lalu tajam (elegan/krem)
 *   none   - tanpa animasi (kalau animasi dimatikan user)
 *
 * Return [ref, shown]; pasang ref di elemen yang ingin dianimasikan.
 */
export function useReveal({ threshold = 0.18, once = true } = {}) {
  const ref = useRef(null)
  const [shown, setShown] = useState(() => !supportsObserver())

  useEffect(() => {
    const node = ref.current
    if (!node || !supportsObserver() || reducedMotion()) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true)
            if (once) observer.unobserve(entry.target)
          } else if (!once) {
            setShown(false)
          }
        }
      },
      { threshold, rootMargin: '0px 0px -8% 0px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [threshold, once])

  return [ref, shown]
}

function supportsObserver() {
  return typeof window !== 'undefined' && 'IntersectionObserver' in window
}

function reducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  )
}

/** Kelas transisi siap-pakai per varian; dipasangkan dengan `shown`. */
export const REVEAL_CLASSES = {
  up: {
    hidden: 'translate-y-6 opacity-0',
    shown: 'translate-y-0 opacity-100',
  },
  zoom: {
    hidden: 'scale-[0.94] opacity-0',
    shown: 'scale-100 opacity-100',
  },
  side: {
    hidden: 'translate-x-5 opacity-0',
    shown: 'translate-x-0 opacity-100',
  },
  none: {
    hidden: '',
    shown: '',
  },
  // Varian tambahan: tiap template punya rasa gerak sendiri, bukan cuma
  // ganti warna. `blur` butuh `filter`, jadi transisinya dipanjangkan.
  fade: {
    hidden: 'opacity-0',
    shown: 'opacity-100',
  },
  lift: {
    hidden: 'translate-y-12 opacity-0',
    shown: 'translate-y-0 opacity-100',
  },
  tilt: {
    hidden: 'rotate-[-2.5deg] scale-[0.96] opacity-0',
    shown: 'rotate-0 scale-100 opacity-100',
  },
  bloom: {
    hidden: 'scale-[0.82] opacity-0',
    shown: 'scale-100 opacity-100',
  },
  veil: {
    hidden: 'blur-[10px] opacity-0',
    shown: 'blur-0 opacity-100',
  },
}

/**
 * Durasi transisi per varian (ms). Varian lambat (veil pakai blur, bloom/lift
 * jarak tempuh jauh) perlu waktu lebih supaya tidak terasa menyentak.
 */
export const REVEAL_DURATION = {
  veil: 900,
  bloom: 800,
  lift: 800,
  tilt: 700,
  zoom: 700,
  up: 700,
  side: 700,
  fade: 1000,
  none: 0,
}

/**
 * Kursor kilau lembut yang mengikuti pointer di desktop (template minimalis).
 * Nonaktif di layar sentuh dan saat reduced-motion, jadi tidak mengganggu.
 */
export function usePointerGlow() {
  const ref = useRef(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined

    const fine = window.matchMedia?.('(pointer: fine)').matches
    if (!fine || reducedMotion()) return undefined

    function handleMove(event) {
      const rect = node.getBoundingClientRect()
      node.style.setProperty('--glow-x', `${event.clientX - rect.left}px`)
      node.style.setProperty('--glow-y', `${event.clientY - rect.top}px`)
    }

    node.addEventListener('pointermove', handleMove)
    return () => node.removeEventListener('pointermove', handleMove)
  }, [])

  return ref
}
