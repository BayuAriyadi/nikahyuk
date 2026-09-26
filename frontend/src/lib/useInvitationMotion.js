/*
 * Mesin animasi berbasis GSAP + ScrollTrigger untuk halaman undangan publik.
 *
 * Dipakai template yang minta animasi lebih kaya dari reveal bawaan
 * (IntersectionObserver di useReveal.js). Semua efek di sini:
 *   - hormat pada prefers-reduced-motion (langsung tampil, tanpa animasi),
 *   - memakai gsap.context + revert saat unmount, jadi tidak ada tween nyangkut,
 *   - animasi properti transform/opacity saja (tidak memicu layout ulang).
 *
 * Prinsip: kalau elemennya tidak ada, jangan bikin tween. Semua selector
 * di-scope ke root, jadi satu halaman boleh punya banyak undangan sekaligus
 * (pratinjau di modal, dll.) tanpa saling ganggu.
 */
import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

function reducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  )
}

/**
 * Cari elemen yang benar-benar menggulir konten ini.
 *
 * ScrollTrigger default-nya memantau scroll jendela. Di dalam modal /
 * pratinjau, konten digulir oleh <div> sendiri — tanpa `scroller` eksplisit,
 * ScrollTrigger menganggap elemen tak pernah masuk viewport dan elemen
 * hasil gsap.from() tertahan di keadaan awal (tak terlihat).
 */
function scrollerFor(el) {
  if (typeof window === 'undefined') return window
  let node = el.parentElement
  while (node && node !== document.body) {
    const style = getComputedStyle(node)
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) return node
    node = node.parentElement
  }
  return window
}

/**
 * Animasi elemen yang sama untuk semua template:
 *   [data-anim]         - nama efek (lihat EFEK di bawah)
 *   [data-anim-delay]   - detik tambahan (opsional)
 *   [data-anim-stagger] - jarak antar anak (opsional, untuk grup)
 *
 * Efek yang tersedia (semua mulai saat elemen masuk viewport):
 *   fade-up      naik + memudar
 *   fade-in      memudar saja
 *   rise         naik lebih jauh, sedikit membesar (kartu besar)
 *   frame        foto: mulai terskala 1.12 lalu mengecil (efek ken burns ringan)
 *   arch         foto ber-arch: tumbuh dari bawah, sudut atas terasa "dibuka"
 *   slide-left   dari kiri
 *   slide-right  dari kanan
 *   line         garis tipis: melebar dari 0 ke lebar aslinya
 *   chars        teks: huruf muncul satu-satu
 *   stagger      anak-anak elemen (li, kartu) muncul berurutan
 *   parallax     bergerak lambat saat halaman digulir (butuh data-anim-speed)
 */
export function useInvitationMotion(rootRef, { enabled = true } = {}) {
  useEffect(() => {
    const root = rootRef?.current
    if (!root || !enabled) return undefined
    if (reducedMotion()) return undefined

    const scroller = scrollerFor(root)
    // Opsi dasar tiap trigger: pantau dari 88% tinggi viewport, sekali saja.
    const at = (extra) => ({ scroller, once: true, trigger: root, ...extra })

    const ctx = gsap.context(() => {
      // --- Efek per elemen ---------------------------------------------------
      root.querySelectorAll('[data-anim]').forEach((el) => {
        const name = el.dataset.anim
        const delay = Number(el.dataset.animDelay || 0)
        const common = {
          duration: 0.9,
          delay,
          ease: 'power3.out',
          scrollTrigger: at({ trigger: el, start: 'top 88%' }),
        }

        switch (name) {
          case 'fade-up':
            gsap.from(el, { y: 34, opacity: 0, ...common })
            break
          case 'fade-in':
            gsap.from(el, { opacity: 0, duration: 1.1, delay, ease: 'power2.out',
              scrollTrigger: at({ trigger: el, start: 'top 88%' }) })
            break
          case 'rise':
            gsap.from(el, { y: 60, scale: 0.97, opacity: 0, duration: 1.1, delay, ease: 'power3.out',
              scrollTrigger: at({ trigger: el, start: 'top 85%' }) })
            break
          case 'arch':
            gsap.from(el, {
              scaleY: 0.86, y: 46, opacity: 0, transformOrigin: 'bottom center',
              duration: 1.15, delay, ease: 'power3.out',
              scrollTrigger: at({ trigger: el, start: 'top 86%' }),
            })
            break
          case 'frame':
            gsap.from(el, {
              scale: 1.12, opacity: 0.35, duration: 1.4, delay, ease: 'power2.out',
              scrollTrigger: at({ trigger: el, start: 'top 90%' }),
            })
            break
          case 'slide-left':
            gsap.from(el, { x: -60, opacity: 0, ...common })
            break
          case 'slide-right':
            gsap.from(el, { x: 60, opacity: 0, ...common })
            break
          case 'line':
            gsap.from(el, { scaleX: 0, transformOrigin: 'left center', duration: 1.1, delay,
              ease: 'power2.inOut', scrollTrigger: at({ trigger: el, start: 'top 92%' }) })
            break
          case 'chars': {
            // Bungkus tiap huruf dalam span, lalu munculkan berurutan. Teks
            // tetap utuh untuk pembaca layar karena aria-label disimpan.
            const text = el.textContent ?? ''
            if (!text.trim() || el.dataset.animDone === 'true') break
            el.setAttribute('aria-label', text)
            el.dataset.animDone = 'true'
            el.textContent = ''
            const frag = document.createDocumentFragment()
            for (const ch of text) {
              const span = document.createElement('span')
              span.textContent = ch === ' ' ? '\u00A0' : ch
              span.style.display = 'inline-block'
              span.setAttribute('aria-hidden', 'true')
              frag.append(span)
            }
            el.append(frag)
            gsap.from(el.children, {
              y: '0.5em', opacity: 0, rotateX: -40, stagger: 0.035, duration: 0.7, delay,
              ease: 'power3.out',
              scrollTrigger: at({ trigger: el, start: 'top 88%' }),
            })
            break
          }
          case 'stagger': {
            const kids = [...el.children]
            if (!kids.length) break
            gsap.from(kids, {
              y: 40, opacity: 0, duration: 0.85, delay, stagger: Number(el.dataset.animStagger || 0.09),
              ease: 'power3.out',
              scrollTrigger: at({ trigger: el, start: 'top 85%' }),
            })
            break
          }
          case 'parallax':
            gsap.to(el, {
              yPercent: Number(el.dataset.animSpeed || -12),
              ease: 'none',
              scrollTrigger: at({
                trigger: el.parentElement || el, start: 'top bottom', end: 'bottom top',
                scrub: true, once: false,
              }),
            })
            break
          default:
            break
        }
      })

      // --- Cover: panggung pembuka ------------------------------------------
      // Semua elemen ber-data-cover muncul berurutan sekali, tanpa ScrollTrigger.
      const coverBits = root.querySelectorAll('[data-cover]')
      if (coverBits.length) {
        gsap.from(coverBits, {
          y: 30, opacity: 0, duration: 1.1, stagger: 0.13, ease: 'power3.out',
        })
      }

      // --- Ornamen yang berdenyut --------------------------------------------
      root.querySelectorAll('[data-anim-loop]').forEach((el) => {
        gsap.to(el, {
          y: -6, duration: 2.4, repeat: -1, yoyo: true, ease: 'sine.inOut',
          delay: Number(el.dataset.animDelay || 0),
        })
      })
    }, root)

    return () => ctx.revert()
  }, [rootRef, enabled])
}

export default useInvitationMotion
