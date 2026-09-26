import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import TemplatePreviewModal from '../components/templates/TemplatePreviewModal.jsx'
import { TemplateThumb } from '../components/templates/TemplateCard.jsx'
import { TEMPLATES } from '../lib/invitationPayload.js'

/**
 * Landing page publik (route "/").
 *
 * Design Read: halaman marketing SaaS undangan pernikahan untuk pasangan
 * Indonesia. Gaya hangat-klasik (serif + blush), dial ENERGY 2 / RHYTHM 2 /
 * MOTION 2.
 *
 * Alasan keputusan utama (dokumentasi untuk reviewer):
 * - Palet rose + putih + sentuhan amber tipis: mengikuti brief pemilik produk
 *   (tema wedding/romance, putih pink). Amber hanya muncul sebagai bokeh
 *   keemasan, nuansa undangan cetak.
 * - Playfair Display untuk headline: serif klasik yang akrab di undangan
 *   pernikahan. Plus Jakarta Sans untuk isi: sans modern rancangan Indonesia,
 *   mudah dibaca di layar kecil.
 * - Motif "&" dan hati diulang sebagai simbol pasangan (monogram "A & S" di
 *   mockup). Bokeh lembut dipakai sebagai suasana hero dan pita CTA, bukan
 *   sebagai latar seluruh halaman.
 * - Glass (backdrop-blur) hanya pada navbar, satu elemen, supaya navigasi
 *   tetap terbaca saat konten menggulir di bawahnya.
 * - Shadow bertingkat hanya pada aksi utama dan mockup HP: menandai
 *   prioritas visual, bukan dekorasi default.
 * - Mockup HP diberi label "Contoh tampilan" dan memuat tombol dummy
 *   non-fokus: memperlihatkan wujud produk apa adanya tanpa klaim palsu.
 * - Kartu fitur QRIS dibedakan (satu-satunya kartu terisi warna penuh):
 *   pembayaran QRIS dengan terbit otomatis adalah pembeda utama produk.
 * - FAQ hanya berisi pertanyaan nyata seputar harga, pembayaran, edit, dan
 *   cara sebar undangan.
 * - Ikon digambar khusus dan relevan langsung: cincin, QR, pensil, balon
 *   ucapan, kalender, globe. Tanpa ikon generik (sparkle/magic/lightning).
 * - Motion: satu animasi masuk di hero, float ambient lembut untuk bokeh dan
 *   hati, plus hover state. Fungsinya mengarahkan perhatian ke fokus utama,
 *   bukan mengisi halaman dengan animasi.
 */

const PRIMARY_BUTTON =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_-12px_rgba(190,18,60,0.55)] transition hover:bg-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:outline-none'

const SECONDARY_BUTTON =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:outline-none'

/* ------------------------------------------------------------------ */
/* Ikon (digambar khusus, stroke 1.6, relevan langsung dengan isi)     */
/* ------------------------------------------------------------------ */

function IconRings({ className = '' }) {
  // Cincin ganda: lambang pernikahan, kartu "Desain Premium".
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className={className} aria-hidden="true">
      <circle cx="9.2" cy="14.2" r="5.1" />
      <circle cx="14.8" cy="9.8" r="5.1" />
    </svg>
  )
}

function IconPencil({ className = '' }) {
  // Pensil: aksi mengedit undangan.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 20l4.2-1.2L20 7.1a2.1 2.1 0 0 0-2.9-2.9L5.2 15.8 4 20z" />
      <path d="M14.3 5.7l4 4" />
    </svg>
  )
}

function IconQr({ className = '' }) {
  // Kode QR: pembayaran QRIS.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <path d="M14 14h3v3h-3z" />
      <path d="M18 18h2v2h-2z" />
    </svg>
  )
}

function IconHeartBubble({ className = '' }) {
  // Balon ucapan berisi hati: RSVP dan buku ucapan.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 11.8c0 3.5-3.6 6.4-8 6.4-1 0-1.9-.14-2.8-.4L5 20l1.1-3C5.4 15.7 4 13.9 4 11.8 4 8.3 7.6 5.4 12 5.4s8 2.9 8 6.4z" />
      <path d="M12 13.9c-1.3-.9-2.3-1.7-2.3-2.8a1.4 1.4 0 0 1 2.3-.9 1.4 1.4 0 0 1 2.3.9c0 1.1-1 1.9-2.3 2.8z" />
    </svg>
  )
}

function IconCalendar({ className = '' }) {
  // Kalender: detail tanggal acara.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="4" y="5.5" width="16" height="14" rx="2" />
      <path d="M4 10.5h16M8.5 3.8v3.4M15.5 3.8v3.4" />
      <circle cx="12" cy="14.8" r="1.2" />
    </svg>
  )
}

function IconGlobe({ className = '' }) {
  // Globe: undangan terbit sebagai link yang bisa dibuka dari mana saja.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16M12 4c2.4 2.2 3.7 5 3.7 8s-1.3 5.8-3.7 8c-2.4-2.2-3.7-5-3.7-8S9.6 6.2 12 4z" />
    </svg>
  )
}

function IconCheck({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

function IconChevron({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function Heart({ className = '' }) {
  // Hati kecil dekoratif, hanya hiasan suasana (aria-hidden).
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 20.6s-6.8-4.2-8.9-8.4A5.1 5.1 0 0 1 12 6.5a5.1 5.1 0 0 1 8.9 5.7c-2.1 4.2-8.9 8.4-8.9 8.4z" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Blok halaman                                                        */
/* ------------------------------------------------------------------ */

function BrandMark({ compact = false }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 font-display text-lg text-white">
        n
      </span>
      {!compact && <span className="text-lg font-semibold tracking-tight text-slate-900">nikahyuk</span>}
    </span>
  )
}

function Navbar({ ctaTo, ctaLabel, user }) {
  return (
    <header className="sticky top-0 z-40 border-b border-rose-100/80 bg-white/85 backdrop-blur">
      <nav aria-label="Navigasi utama" className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          to="/"
          className="rounded-lg focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:outline-none"
          aria-label="nikahyuk, kembali ke beranda"
        >
          <BrandMark />
        </Link>

        <div className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
          <a href="#template" className="rounded transition hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:outline-none">
            Template
          </a>
          <a href="#fitur" className="rounded transition hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:outline-none">
            Fitur
          </a>
          <a href="#harga" className="rounded transition hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:outline-none">
            Harga
          </a>
          <a href="#faq" className="rounded transition hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:outline-none">
            FAQ
          </a>
        </div>

        <div className="flex items-center gap-3">
          {!user && (
            <Link
              to="/login"
              className="hidden rounded text-sm font-semibold text-slate-700 transition hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:outline-none sm:block"
            >
              Masuk
            </Link>
          )}
          <Link
            to={ctaTo}
            className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {ctaLabel}
          </Link>
        </div>
      </nav>
    </header>
  )
}

function PhoneMock() {
  // Mockup produk dengan konten contoh yang diberi label; bukan kontrol nyata.
  return (
    <div className="relative mx-auto w-64 sm:w-72">
      <div aria-hidden="true" className="absolute -left-9 top-10 hidden sm:block">
        <Heart className="h-5 w-5 -rotate-12 text-rose-300 animate-float-slow" />
      </div>
      <div aria-hidden="true" className="absolute -right-2 -top-6 hidden sm:block">
        <Heart className="h-4 w-4 rotate-12 text-rose-200 animate-float" />
      </div>

      <div className="relative rounded-[2.75rem] border border-rose-100 bg-white p-3 shadow-2xl shadow-rose-900/10">
        <div className="relative overflow-hidden rounded-[2.1rem] bg-gradient-to-b from-rose-50 via-white to-rose-50 px-6 pb-10 pt-12 text-center">
          <div aria-hidden="true" className="absolute left-1/2 top-4 h-1.5 w-14 -translate-x-1/2 rounded-full bg-rose-100" />

          <p className="text-[10px] font-semibold tracking-[0.24em] text-rose-700 uppercase">The Wedding Of</p>
          <p className="mt-3 font-display text-3xl text-slate-900">
            Andi <span className="text-rose-500">&amp;</span> Sari
          </p>
          <p className="mt-2 text-sm text-slate-500">Minggu, 10 Desember 2026</p>
          <div aria-hidden="true" className="mx-auto mt-4 h-px w-16 bg-rose-200" />
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Dengan penuh sukacita, kami mengundang Bapak/Ibu/Saudara untuk hadir di hari bahagia kami.
          </p>

          <div className="mt-5 space-y-2">
            <span className="block rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white">Konfirmasi Kehadiran</span>
            <span className="block rounded-xl border border-rose-200 px-4 py-2.5 text-xs font-semibold text-rose-700">Kirim Ucapan</span>
          </div>
        </div>
      </div>

      <div className="absolute -right-5 top-12 w-40 rounded-2xl border border-rose-100 bg-white p-3 shadow-lg shadow-rose-900/10 sm:-right-10">
        <div className="flex items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
            <IconQr className="h-4.5 w-4.5" />
          </span>
          <div>
            <p className="text-xs font-semibold text-slate-900">Terbayar via QRIS</p>
            <p className="mt-0.5 text-[11px] leading-4 text-slate-500">Undangan terbit otomatis</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Hero({ ctaTo, ctaLabel, user }) {
  return (
    <section className="relative overflow-hidden">
      {/* Bokeh lembut: suasana romantis dan penanda area fokus hero. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 right-[-12%] h-80 w-80 rounded-full bg-rose-100/70 blur-3xl" />
        <div className="absolute top-44 left-[-14%] h-72 w-72 rounded-full bg-amber-50 blur-3xl" />
        <Heart className="absolute top-24 left-[7%] h-4 w-4 text-rose-300 animate-float" />
        <Heart className="absolute top-14 right-[16%] h-3 w-3 text-rose-200 animate-float-slow" />
        <Heart className="absolute bottom-14 left-[44%] h-3.5 w-3.5 text-rose-300/90 animate-float [animation-delay:1.2s]" />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pt-20 lg:pb-28">
        <div className="animate-fade-in-up">
          <h1 className="font-display text-4xl leading-[1.12] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Undangan pernikahan digital yang seindah <span className="text-rose-700 italic">hari bahagiamu</span>.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
            Tulis nama, tanggal, dan detail acara dalam satu halaman. Bagikan linknya ke semua tamu,
            terima RSVP dan doa, lalu biarkan undangan terbit otomatis begitu pembayaran QRIS selesai.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link to={ctaTo} className={PRIMARY_BUTTON}>
              {ctaLabel}
            </Link>
            <a href="#fitur" className={SECONDARY_BUTTON}>
              Lihat Fitur
            </a>
          </div>

          <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-600">
            {['Sekali bayar Rp 49.000', 'Bayar lewat QRIS', 'Terbit otomatis setelah lunas'].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <IconCheck className="h-4 w-4 shrink-0 text-rose-600" />
                {item}
              </li>
            ))}
          </ul>

          {user && (
            <p className="mt-6 text-sm text-slate-500">
              Kamu sudah masuk sebagai <span className="font-semibold text-slate-700">{user.name}</span>.
            </p>
          )}
        </div>

        <div className="animate-fade-in-up [animation-delay:150ms]">
          <PhoneMock />
          <p className="mt-5 text-center text-xs text-slate-500">Contoh tampilan undangan di HP tamu.</p>
        </div>
      </div>
    </section>
  )
}

const FEATURES = [
  {
    icon: IconRings,
    title: 'Desain Premium',
    desc: 'Tata letak khas undangan cetak: tipografi serif, pembatas elegan, dan susunan yang rapi di layar kecil maupun besar.',
  },
  {
    icon: IconQr,
    title: 'Terintegrasi QRIS',
    desc: 'Bayar dari e-wallet atau mobile banking apa pun yang mendukung QRIS. Setelah pembayaran terkonfirmasi, undangan langsung terbit tanpa menunggu.',
    featured: true,
  },
  {
    icon: IconPencil,
    title: 'Mudah Diedit',
    desc: 'Ubah nama, jadwal, atau detail acara kapan saja dari dashboard. Perubahan tampil di link yang sama tanpa perlu sebar ulang.',
  },
  {
    icon: IconHeartBubble,
    title: 'RSVP & Buku Ucapan',
    desc: 'Tamu mengonfirmasi kehadiran dan mengirim doa langsung dari undangan, cukup lewat browser tanpa install aplikasi.',
  },
  {
    icon: IconCalendar,
    title: 'Detail Acara Rapi',
    desc: 'Rangkaian acara, tanggal, dan lokasi tersusun jelas, dari akad sampai resepsi, sehingga tamu tidak perlu bertanya lagi.',
  },
  {
    icon: IconGlobe,
    title: 'Terbit Jadi Link',
    desc: 'Setiap undangan punya alamat unik milik kalian sendiri, siap dibagikan lewat WhatsApp, Instagram, atau grup keluarga.',
  },
]

function Features() {
  return (
    <section id="fitur" className="scroll-mt-24 bg-white py-20 lg:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl tracking-tight text-slate-900 sm:text-4xl">
            Semua yang diperlukan untuk hari istimewa
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Dirakit supaya persiapan undangan tidak menyita waktu di tengah kesibukan menjelang hari-H.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc, featured }) => (
            <article
              key={title}
              className={
                featured
                  ? 'rounded-2xl bg-rose-600 p-6 text-white sm:col-span-2 lg:col-span-1'
                  : 'rounded-2xl border border-rose-100 bg-white p-6 transition hover:border-rose-200 hover:bg-rose-50/40'
              }
            >
              <span
                className={
                  featured
                    ? 'flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white'
                    : 'flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600'
                }
              >
                <Icon className="h-5 w-5" />
              </span>
              <h3 className={featured ? 'mt-4 text-base font-semibold text-white' : 'mt-4 text-base font-semibold text-slate-900'}>
                {title}
              </h3>
              <p className={featured ? 'mt-2 text-sm leading-6 text-white' : 'mt-2 text-sm leading-6 text-slate-600'}>{desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

const PRICING_INCLUDES = [
  'Undangan online dengan link pribadi, aktif tanpa batas waktu',
  'RSVP dan buku ucapan untuk seluruh tamu',
  'Detail acara lengkap: tanggal, rangkaian acara, dan lokasi',
  'Edit kapan saja lewat dashboard',
  'Terbit otomatis begitu pembayaran QRIS terkonfirmasi',
]

const PAYMENT_FLOW = [
  'Buat undangan, lalu tekan tombol Publish.',
  'Scan QRIS dan bayar dari e-wallet atau mobile banking pilihan kalian.',
  'Pembayaran terverifikasi, status undangan berubah jadi Terbit, dan link siap dibagikan.',
]

function Pricing({ ctaTo, ctaLabel }) {
  return (
    <section id="harga" className="scroll-mt-24 bg-rose-50/60 py-20 lg:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-start">
          <div>
            <h2 className="font-display text-3xl tracking-tight text-slate-900 sm:text-4xl">Satu paket, sekali bayar</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">Tanpa langganan bulanan, tanpa biaya tersembunyi.</p>

            <div className="mt-8 rounded-3xl border border-rose-100 bg-white p-8 shadow-lg shadow-rose-900/5">
              <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-700">
                <IconQr className="h-3.5 w-3.5" />
                Bayar Otomatis via QRIS
              </span>

              <p className="mt-6 flex items-baseline gap-2">
                <span className="font-display text-5xl tracking-tight text-slate-900">Rp 49.000</span>
                <span className="text-sm text-slate-500">sekali bayar</span>
              </p>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                Termasuk seluruh fitur di halaman ini. Tidak ada biaya tambahan saat hari-H.
              </p>

              <Link to={ctaTo} className={`${PRIMARY_BUTTON} mt-7 w-full`}>
                {ctaLabel}
              </Link>
              <p className="mt-3 text-center text-xs text-slate-500">
                Pembayaran dan penerbitan undangan terverifikasi otomatis oleh sistem, tanpa konfirmasi manual.
              </p>
            </div>
          </div>

          <div className="lg:pt-16">
            <h3 className="text-sm font-semibold tracking-wide text-rose-700 uppercase">Yang kalian dapatkan</h3>
            <ul className="mt-5 space-y-3.5">
              {PRICING_INCLUDES.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                  <IconCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-rose-600" />
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-9 rounded-2xl border border-rose-100 bg-white p-6">
              <h3 className="text-sm font-semibold text-slate-900">Setelah menekan Publish</h3>
              <ol className="mt-4 space-y-4">
                {PAYMENT_FLOW.map((step, index) => (
                  <li key={step} className="flex gap-3.5 text-sm leading-6 text-slate-600">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-semibold text-rose-700">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const FAQ_ITEMS = [
  {
    q: 'Berapa lama undangan aktif setelah dibayar?',
    a: 'Tanpa batas waktu. Sekali bayar Rp 49.000, link undangan kalian tetap bisa dibuka kapan pun, termasuk setelah acara selesai.',
  },
  {
    q: 'Metode pembayaran apa saja yang didukung?',
    a: 'Pembayaran lewat QRIS, jadi bisa dibayar dari GoPay, OVO, DANA, ShopeePay, atau aplikasi mobile banking apa pun yang mendukung QRIS.',
  },
  {
    q: 'Bisa diedit setelah undangan terbit?',
    a: 'Bisa. Semua bagian undangan dapat diubah kapan saja lewat dashboard, dan perubahan langsung tampil di link yang sudah kalian bagikan.',
  },
  {
    q: 'Bagaimana cara membagikan undangan ke tamu?',
    a: 'Setiap undangan punya alamat unik milik kalian. Salin linknya dari dashboard, lalu sebarkan lewat WhatsApp, Instagram, atau grup keluarga.',
  },
]

function Faq() {
  return (
    <section id="faq" className="scroll-mt-24 bg-white py-20 lg:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="text-center font-display text-3xl tracking-tight text-slate-900 sm:text-4xl">Pertanyaan yang sering muncul</h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-base leading-7 text-slate-600">
          Kalau masih ada yang mengganjal, bagian ini biasanya menjawabnya.
        </p>

        <div className="mt-10 divide-y divide-rose-100 rounded-3xl border border-rose-100 bg-white px-6 sm:px-8">
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg text-sm font-semibold text-slate-900 transition hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                {item.q}
                <IconChevron className="h-4 w-4 shrink-0 text-rose-500 transition group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCta({ ctaTo, ctaLabel }) {
  return (
    <section className="bg-white px-4 pb-20 sm:px-6 lg:pb-24">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-rose-600 to-rose-700 px-6 py-16 text-center sm:px-12">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <Heart className="absolute top-8 left-[12%] h-5 w-5 text-white/15 animate-float-slow" />
          <Heart className="absolute right-[14%] bottom-10 h-4 w-4 text-white/15 animate-float" />
          <Heart className="absolute top-1/2 left-[78%] h-3 w-3 text-white/10 animate-float [animation-delay:0.8s]" />
        </div>

        <h2 className="relative font-display text-3xl tracking-tight text-white sm:text-4xl">Siap menyebar kabar bahagia?</h2>
        <p className="relative mx-auto mt-4 max-w-xl text-base leading-7 text-white">
          Buat undangan kalian hari ini. Begitu pembayaran QRIS selesai, link undangan siap dibagikan ke semua tamu.
        </p>
        <div className="relative mt-8 flex justify-center">
          <Link
            to={ctaTo}
            className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-rose-700 focus-visible:outline-none"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  )
}

function Footer({ ctaTo, user }) {
  return (
    <footer className="border-t border-rose-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <BrandMark />
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Undangan pernikahan digital dengan pembayaran QRIS. Sekali bayar, terbit otomatis, siap dibagikan.
          </p>
        </div>

        <nav aria-label="Navigasi footer" className="flex flex-wrap gap-x-7 gap-y-2.5 text-sm text-slate-600">
          <a href="#template" className="transition hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:outline-none rounded">
            Template
          </a>
          <a href="#fitur" className="transition hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:outline-none rounded">
            Fitur
          </a>
          <a href="#harga" className="transition hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:outline-none rounded">
            Harga
          </a>
          <a href="#faq" className="transition hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:outline-none rounded">
            FAQ
          </a>
          {user ? (
            <Link to="/dashboard" className="transition hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:outline-none rounded">
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="transition hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:outline-none rounded">
                Masuk
              </Link>
              <Link to={ctaTo} className="transition hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:outline-none rounded">
                Daftar
              </Link>
            </>
          )}
        </nav>
      </div>

      <p className="border-t border-rose-50 py-4 text-center text-xs text-slate-500">
        © 2026 nikahyuk. Dibuat untuk pasangan yang sedang berbahagia.
      </p>
    </footer>
  )
}

/**
 * Galeri template: thumbnail tiap template dalam kartu seragam, klik untuk
 * pratinjau penuh. Gaya sengaja tenang (putih, garis tipis, tanpa badge
 * berwarna) supaya undangannya sendiri yang jadi fokus, bukan halamannya.
 */
function TemplateGallery({ onPreview }) {
  return (
    <section id="template" className="scroll-mt-24 bg-rose-50/40 py-20 lg:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.22em] text-rose-700 uppercase">
            Galeri Desain
          </p>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-slate-900 sm:text-4xl">
            Pilih tampilan yang paling kalian suka
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Lima desain dengan warna, bentuk, dan susunan bagian yang berbeda. Buka contohnya untuk
            melihat seluruh halaman undangan, dan ganti kapan saja tanpa biaya tambahan.
          </p>
        </div>

        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((template) => (
            <li key={template.name} className="group">
              <button
                type="button"
                onClick={() => onPreview(template.name)}
                aria-label={`Lihat contoh template ${template.label}`}
                className="block w-full overflow-hidden rounded-2xl border border-rose-100 bg-white p-2.5 text-left shadow-sm transition hover:-translate-y-1 hover:border-rose-200 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
              >
                <TemplateThumb
                  template={template}
                  className="aspect-[4/5] w-full rounded-xl ring-1 ring-rose-100/80"
                />
                <span className="block px-1.5 pt-3 pb-1">
                  <span className="block font-display text-lg text-slate-900">{template.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {template.description}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-sm text-slate-500">
          Semua desain memakai fitur yang sama: RSVP, buku ucapan, galeri foto, cerita, dan kirim
          hadiah.
        </p>
      </div>
    </section>
  )
}

export default function Landing() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [previewTemplate, setPreviewTemplate] = useState(null)
  const ctaTo = user ? '/dashboard' : '/register'
  const ctaLabel = user ? 'Buka Dashboard' : 'Buat Undangan Sekarang'

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800">
      <Navbar ctaTo={ctaTo} ctaLabel={user ? 'Dashboard' : 'Buat Undangan'} user={user} />
      <main>
        <Hero ctaTo={ctaTo} ctaLabel={ctaLabel} user={user} />
        <TemplateGallery onPreview={setPreviewTemplate} />
        <Features />
        <Pricing ctaTo={ctaTo} ctaLabel={ctaLabel} />
        <Faq />
        <FinalCta ctaTo={ctaTo} ctaLabel={ctaLabel} />
      </main>
      <Footer ctaTo={ctaTo} user={user} />

      {previewTemplate && (
        <TemplatePreviewModal
          templateName={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onUse={() => {
            setPreviewTemplate(null)
            // Template dipilih di langkah pertama wizard; di sini cukup
            // diantar ke halaman yang punya tombolnya (register kalau belum
            // punya akun, daftar undangan kalau sudah).
            navigate(ctaTo)
          }}
        />
      )}
    </div>
  )
}
