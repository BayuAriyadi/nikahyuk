import { useEffect, useRef, useState } from 'react'

/**
 * Reveal saat masuk viewport (animasi interaktif yang menghormati
 * prefers-reduced-motion). Dipakai lintas template dengan `variant`:
 *
 *   up    - naik + memudar (default, dipakai template klasik)
 *   zoom  - membesar halus (minimalis)
 *   side  - meluncur dari kiri/kanan bergantian (floral)
 *   none  - tanpa animasi (kalau animasi dimatikan user)
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
