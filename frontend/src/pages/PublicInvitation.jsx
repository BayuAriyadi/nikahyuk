import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { publicApi } from '../lib/api.js'
import Icon from '../components/Icon.jsx'
import MusicPlayer from '../components/MusicPlayer.jsx'
import Reveal from '../components/Reveal.jsx'
import Lightbox from '../components/Lightbox.jsx'
import { copyText } from '../lib/clipboard.js'
import { timeAgo } from '../lib/time.js'
import { DEFAULT_TEMPLATE_NAME, templateByName } from '../lib/invitationPayload.js'
import { usePointerGlow } from '../lib/useReveal.js'
import { useInvitationMotion } from '../lib/useInvitationMotion.js'
import { ElegantInvitation } from '../components/templates/elegant/ElegantSections.jsx'

/*
 * Halaman undangan publik (route /:slug): muka produk yang dibuka tamu.
 *
 * Konten mengikuti kontrak API Task 2:
 *   GET  /api/invitations/{slug}         -> { slug, bride_data, event_data, template_config, guest_count, guests[] }
 *   template_config berisi gallery (array URL foto), cover_photo, dan gift
 *   (rekening untuk bagian Kirim Hadiah).
 *   POST /api/invitations/{slug}/guests  -> { name, rsvp_status: attending|not_attending, message? }
 * Draft / slug salah -> 404 dari backend, ditampilkan sebagai halaman khusus.
 *
 * Keputusan desain:
 * - Layout mobile-first satu kolom (max-w-lg): tamu hampir selalu membuka dari HP.
 * - Gaya "undangan cetak": frame tipis di cover, ornamen divider, serif italic
 *   (Playfair Display) untuk nama dan judul, plus Jakarta Sans untuk isi.
 * - "The Wedding Of" tetap uppercase renggang karena itu konvensi undangan
 *   Indonesia, bukan label template.
 * - Countdown dan badge kehadiran memakai blok warna datar (rose / emerald),
 *   bukan gradient ungu-biru, supaya senapas dengan brand nikahyuk.
 * - Semua teks pakai bahasa percakapan ("kamu"), tanpa klaim angka hiasan.
 */

const DATE_FMT = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const RSVP_OPTIONS = [
  { value: 'attending', label: 'Hadir' },
  { value: 'not_attending', label: 'Berhalangan' },
]

function nickOf(person) {
  return String(person?.nick || person?.name || '').trim()
}

function fullNameOf(person) {
  return String(person?.name || '').trim()
}

function initialOf(value) {
  return String(value || '?').trim().charAt(0).toUpperCase() || '?'
}

/** "2026-09-26" + "09:57" -> Date lokal; null kalau tidak bisa diparse. */
function parseEventMoment(ev) {
  if (!ev?.date) return null
  const time = String(ev.time || '00:00').slice(0, 5)
  const moment = new Date(`${ev.date}T${time}`)
  return Number.isNaN(moment.getTime()) ? null : moment
}

/** Momen acara paling awal (akad / resepsi) untuk tanggal cover dan countdown.
 * Diekspor supaya pratinjau (components/templates/InvitationPreview) memakai
 * perhitungan yang sama dengan halaman tamu. */
export function eventMainMoment(eventData) {
  const moments = [parseEventMoment(eventData?.akad), parseEventMoment(eventData?.resepsi)].filter(Boolean)
  if (moments.length === 0) return null
  return new Date(Math.min(...moments.map((moment) => moment.getTime())))
}

function mapsUrlFor(ev) {
  if (ev?.maps_url) return ev.maps_url
  const query = [ev?.venue, ev?.address].filter(Boolean).join(', ')
  if (!query) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

/** Hitung sisa waktu ke `target`, update tiap detik. null kalau target kosong. */
function useCountdown(target) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!target) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [target])

  if (!target) return null

  const diff = target.getTime() - now
  if (diff <= 0) {
    return { phase: -diff < 86400000 ? 'today' : 'past' }
  }

  const total = Math.floor(diff / 1000)
  return {
    phase: 'counting',
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  }
}

/** Ornamen pemisah: garis tipis + belah ketupat kecil, dipakai konsisten. */
function Divider({ className = '' }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`} aria-hidden="true">
      <span className="h-px w-12 bg-rose-200" />
      <span className="h-1.5 w-1.5 rotate-45 rounded-[2px] bg-rose-300" />
      <span className="h-px w-12 bg-rose-200" />
    </div>
  )
}

function SectionTitle({ children, className = '' }) {
  return (
    <div className={`ny-title text-center ${className}`}>
      <h2 className="font-display text-3xl italic text-rose-900">{children}</h2>
      <Divider className="ny-divider mt-4" />
    </div>
  )
}

/**
 * Cover halaman tamu. `onOpen` opsional: tanpa itu tombol "Buka Undangan"
 * dirender sebagai elemen statis, dipakai pratinjau yang belum punya tamu.
 *
 * Section-section di bawah diekspor (CoupleSection dst.) supaya pratinjau
 * memakai markup yang benar-benar sama dengan halaman tamu.
 */
export function Cover({ groom, bride, dateLabel, photo, guestName = '', onOpen }) {
  const glowRef = usePointerGlow()

  return (
    <header
      ref={glowRef}
      data-has-photo={photo ? 'true' : 'false'}
      className="ny-cover relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-rose-50 via-white to-rose-50 px-6 py-16 text-center"
    >
      {photo ? (
        <>
          <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="ny-scrim absolute inset-0 bg-slate-900/65" aria-hidden="true" />
          <div className="ny-text-scrim pointer-events-none absolute inset-0" aria-hidden="true" />
          <div
            className="ny-frame pointer-events-none absolute inset-4 rounded-[2.5rem] border border-white/50 sm:inset-6"
            aria-hidden="true"
          />
        </>
      ) : (
        <>
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute -left-20 -top-16 h-64 w-64 rounded-full bg-rose-200/50 blur-3xl" />
            <div className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-rose-100/80 blur-3xl" />
          </div>
          <div
            className="ny-frame pointer-events-none absolute inset-4 rounded-[2.5rem] border border-rose-200/90 sm:inset-6"
            aria-hidden="true"
          />
        </>
      )}

      <div className="ny-cover-inner relative z-10 flex flex-col items-center">
        <p
          className={`text-[11px] font-semibold uppercase tracking-[0.32em] ${
            photo ? 'text-rose-100' : 'text-rose-700'
          }`}
        >
          The Wedding Of
        </p>
        {guestName && (
          <p
            className={`mt-5 rounded-full border px-4 py-1.5 text-xs font-medium ${
              photo
                ? 'border-white/40 bg-white/10 text-rose-50'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            Kepada Bapak/Ibu/Saudara/i {guestName}
          </p>
        )}
        <h1
          className={`mt-6 font-display text-5xl italic leading-tight sm:text-6xl ${
            photo ? 'text-white' : 'text-slate-800'
          }`}
        >
          {nickOf(groom)} <span className={photo ? 'text-rose-200' : 'text-rose-500'}>&</span>{' '}
          {nickOf(bride)}
        </h1>
        {dateLabel && (
          <p
            className={`mt-6 text-sm font-medium tracking-wide ${
              photo ? 'text-rose-50' : 'text-slate-600'
            }`}
          >
            {dateLabel}
          </p>
        )}
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="mt-12 inline-flex items-center gap-2 rounded-full bg-rose-600 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-600/25 transition hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
          >
            Buka Undangan
            <Icon name="chevronDown" className="h-4 w-4" />
          </button>
        ) : (
          <span className="mt-12 inline-flex items-center gap-2 rounded-full bg-rose-600 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-600/25">
            Buka Undangan
            <Icon name="chevronDown" className="h-4 w-4" />
          </span>
        )}
      </div>
    </header>
  )
}

function CoupleCard({ person, role }) {
  if (!person) return null
  const name = fullNameOf(person)
  const nick = nickOf(person)
  if (!name && !nick) return null

  const parents = [person.father, person.mother].filter(Boolean)
  const instagram = String(person.instagram || '').replace(/^@/, '').trim()
  const isGroom = role === 'groom'

  return (
    <div className="ny-card rounded-3xl border border-rose-100 bg-white p-8 text-center shadow-sm">
      {person.photo ? (
        <img
          src={person.photo}
          alt={isGroom ? 'Foto mempelai pria' : 'Foto mempelai wanita'}
          loading="lazy"
          className="mx-auto h-24 w-24 rounded-full object-cover shadow-sm ring-2 ring-rose-200"
        />
      ) : (
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 font-display text-2xl italic text-rose-600 ring-1 ring-rose-200/80">
          {initialOf(name || nick)}
        </div>
      )}
      <p className="mt-4 text-xs font-medium tracking-wide text-rose-700">
        {isGroom ? 'Mempelai Pria' : 'Mempelai Wanita'}
      </p>
      <h3 className="mt-1.5 font-display text-2xl text-slate-800">{name || nick}</h3>
      {nick && name && nick !== name && (
        <p className="mt-1 text-sm text-slate-500">akrab dipanggil {nick}</p>
      )}
      {parents.length > 0 && (
        <p className="mt-3 text-sm leading-6 text-slate-500">
          {isGroom ? 'Putra dari' : 'Putri dari'} {parents.join(' & ')}
        </p>
      )}
      {instagram && (
        <a
          href={`https://instagram.com/${encodeURIComponent(instagram)}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 transition hover:text-rose-700"
        >
          <Icon name="instagram" />
          @{instagram}
        </a>
      )}
    </div>
  )
}

export function CoupleSection({ groom, bride }) {
  if (!groom && !bride) return null
  return (
    <section id="mempelai" className="px-5">
      <SectionTitle>Kedua Mempelai</SectionTitle>
      <div className="mx-auto mt-6 flex max-w-lg flex-col gap-4">
        <CoupleCard person={groom} role="groom" />
        <p className="text-center font-display text-3xl italic text-rose-400" aria-hidden="true">
          &
        </p>
        <CoupleCard person={bride} role="bride" />
      </div>
    </section>
  )
}

function EventCard({ label, ev }) {
  if (!ev || (!ev.date && !ev.time && !ev.venue && !ev.address)) return null

  const moment = parseEventMoment(ev)
  const maps = mapsUrlFor(ev)

  return (
    <div className="ny-card rounded-3xl border border-rose-100 bg-white p-6 text-left shadow-sm sm:p-7">
      <p className="font-display text-xl italic text-rose-700">{label}</p>
      <div className="mt-4 space-y-3 text-sm text-slate-600">
        {moment && (
          <div className="flex items-start gap-2.5">
            <Icon name="calendar" className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <p>{DATE_FMT.format(moment)}</p>
          </div>
        )}
        {ev.time && (
          <div className="flex items-start gap-2.5">
            <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <p>Pukul {ev.time}</p>
          </div>
        )}
        {(ev.venue || ev.address) && (
          <div className="flex items-start gap-2.5">
            <Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <p>
              {ev.venue && <span className="font-semibold text-slate-800">{ev.venue}</span>}
              {ev.venue && ev.address && <br />}
              {ev.address && <span className="text-slate-500">{ev.address}</span>}
            </p>
          </div>
        )}
      </div>
      {maps && (
        <a
          href={maps}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
        >
          <Icon name="pin" className="h-3.5 w-3.5" />
          Lihat Lokasi
        </a>
      )}
    </div>
  )
}

export function EventsSection({ eventData }) {
  const akad = eventData?.akad ?? null
  const resepsi = eventData?.resepsi ?? null
  const cards = [
    akad ? { label: 'Akad Nikah', ev: akad } : null,
    resepsi ? { label: 'Resepsi', ev: resepsi } : null,
  ].filter(Boolean)

  if (cards.length === 0) return null

  return (
    <section id="acara" className="px-5">
      <SectionTitle>Rangkaian Acara</SectionTitle>
      <div className={`mx-auto mt-6 grid max-w-lg gap-4 ${cards.length === 2 ? 'sm:grid-cols-2' : ''}`}>
        {cards.map((card) => (
          <EventCard key={card.label} label={card.label} ev={card.ev} />
        ))}
      </div>
    </section>
  )
}

export function CountdownSection({ target }) {
  const countdown = useCountdown(target)
  if (!countdown) return null

  return (
    <section className="px-5">
      <div className="ny-countdown mx-auto max-w-lg rounded-3xl bg-gradient-to-br from-rose-700 to-rose-800 px-6 py-8 text-center text-white shadow-xl shadow-rose-900/10">
        {countdown.phase === 'counting' ? (
          <>
            <p className="text-xs font-medium tracking-wide text-rose-100">Menuju hari bahagia</p>
            <div className="mt-5 grid grid-cols-4 gap-2">
              {[
                ['Hari', countdown.days],
                ['Jam', countdown.hours],
                ['Menit', countdown.minutes],
                ['Detik', countdown.seconds],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-white/10 py-3">
                  <p className="font-display text-3xl tabular-nums">{String(value).padStart(2, '0')}</p>
                  <p className="mt-1 text-[10px] font-medium tracking-wide text-rose-100">{label}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="font-display text-2xl italic">
            {countdown.phase === 'today' ? 'Hari bahagia telah tiba' : 'Acara telah berlangsung'}
          </p>
        )}
      </div>
    </section>
  )
}

export function GallerySection({ photos }) {
  const [active, setActive] = useState(-1)
  if (photos.length === 0) return null

  return (
    <section id="galeri" className="px-5">
      <SectionTitle>Galeri Momen</SectionTitle>
      <ul className="ny-gallery mx-auto mt-6 grid max-w-lg grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((url, index) => (
          <li key={url}>
            <button
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Buka foto ${index + 1} dari ${photos.length}`}
              className="group block w-full overflow-hidden rounded-2xl border border-rose-100 bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
            >
              <img
                src={url}
                alt={`Momen ${index + 1}`}
                loading="lazy"
                className="aspect-[4/5] w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              />
            </button>
          </li>
        ))}
      </ul>

      {active >= 0 && (
        <Lightbox
          photos={photos}
          index={active}
          onChange={setActive}
          onClose={() => setActive(-1)}
        />
      )}
    </section>
  )
}

function CopyButton({ value }) {
  const [state, setState] = useState('idle')

  async function handleCopy() {
    try {
      await copyText(value)
      setState('copied')
    } catch {
      setState('failed')
    }
    window.setTimeout(() => setState('idle'), 2500)
  }

  const labels = { idle: 'Salin nomor', copied: 'Nomor tersalin', failed: 'Gagal menyalin' }
  const icons = { idle: 'copy', copied: 'check', failed: 'copy' }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-live="polite"
      className="mt-4 inline-flex items-center gap-2 rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
    >
      <Icon name={icons[state]} className="h-3.5 w-3.5" />
      {labels[state]}
    </button>
  )
}

export function GiftSection({ gift }) {
  const accounts = Array.isArray(gift?.accounts)
    ? gift.accounts.filter((account) => account?.bank && account?.number)
    : []

  if (!gift?.enabled || accounts.length === 0) return null

  return (
    <section id="hadiah" className="px-5">
      <SectionTitle>Kirim Hadiah</SectionTitle>
      <p className="mx-auto mt-5 max-w-lg text-center text-sm leading-6 text-slate-600">
        Doa restu kalian sudah sangat berarti. Kalau ingin memberi tanda kasih, hadiah bisa
        dikirim ke rekening berikut.
      </p>
      <ul className="mx-auto mt-6 grid max-w-lg gap-3">
        {accounts.map((account) => (
          <li
            key={`${account.bank}-${account.number}`}
            className="ny-card rounded-3xl border border-rose-100 bg-white p-5 text-center shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
              {account.bank}
            </p>
            <p className="mt-2 font-mono text-lg font-semibold text-slate-800">{account.number}</p>
            {account.name && <p className="mt-1 text-sm text-slate-600">a.n. {account.name}</p>}
            <CopyButton value={account.number} />
          </li>
        ))}
      </ul>
    </section>
  )
}

export function StorySection({ story }) {
  const entries = Array.isArray(story)
    ? story.filter((entry) => entry?.title && entry?.text)
    : []

  if (entries.length === 0) return null

  return (
    <section id="cerita" className="px-5">
      <SectionTitle>Cerita Kita</SectionTitle>
      <ol className="ny-story mx-auto mt-8 max-w-lg space-y-6">
        {entries.map((entry, index) => (
          <li key={`${entry.title}-${index}`} className="relative border-l-2 border-rose-100 pl-6">
            <span
              aria-hidden="true"
              className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-rose-300"
            />
            {entry.date && (
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                {entry.date}
              </p>
            )}
            <h3 className="mt-1 font-display text-xl text-slate-800">{entry.title}</h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{entry.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

function RsvpForm({ slug, prefillName, onSent }) {
  const [form, setForm] = useState({ name: prefillName ?? '', rsvp: '', message: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [thanks, setThanks] = useState(null)

  function update(field) {
    return (event) => {
      const { value } = event.target
      setForm((prev) => ({ ...prev, [field]: value }))
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setThanks(null)

    const nextErrors = {}
    if (!form.name.trim()) nextErrors.name = 'Nama wajib diisi.'
    if (!form.rsvp) nextErrors.rsvp = 'Pilih konfirmasi kehadiran dulu ya.'
    if (form.message.trim().length > 500) nextErrors.message = 'Ucapan maksimal 500 karakter.'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setSubmitting(true)
    try {
      const body = { name: form.name.trim(), rsvp_status: form.rsvp }
      if (form.message.trim()) body.message = form.message.trim()

      await publicApi.rsvp(slug, body)
      setThanks(form.name.trim())
      setForm({ name: '', rsvp: '', message: '' })
      onSent?.()
    } catch (error) {
      if (error.status === 422) {
        setErrors({
          name: error.fieldError('name') ?? undefined,
          rsvp: error.fieldError('rsvp_status') ?? undefined,
          message: error.fieldError('message') ?? undefined,
        })
      } else if (error.status === 404) {
        setErrors({ form: 'Undangan ini belum menerbitkan buku ucapan.' })
      } else {
        setErrors({ form: error.message })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = (hasError) =>
    `w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:ring-2 ${
      hasError
        ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
        : 'border-rose-200 focus:border-rose-500 focus:ring-rose-500/20'
    }`

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="ny-card mx-auto mt-6 max-w-lg rounded-3xl border border-rose-100 bg-white p-6 shadow-sm sm:p-7"
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Nama kamu</span>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={update('name')}
            maxLength={100}
            autoComplete="name"
            placeholder="cth: Rina Melati"
            className={inputClass(Boolean(errors.name))}
          />
          {errors.name && <span className="mt-1 block text-sm text-red-600">{errors.name}</span>}
        </label>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Konfirmasi kehadiran</span>
          <div role="radiogroup" aria-label="Konfirmasi kehadiran" className="grid grid-cols-2 gap-2">
            {RSVP_OPTIONS.map((option) => {
              const selected = form.rsvp === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setForm((prev) => ({ ...prev, rsvp: option.value }))
                    setErrors((prev) => ({ ...prev, rsvp: undefined }))
                  }}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                    selected
                      ? 'border-rose-600 bg-rose-600 text-white'
                      : 'border-rose-200 bg-white text-slate-600 hover:border-rose-300 hover:text-rose-700'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
          {errors.rsvp && <span className="mt-1 block text-sm text-red-600">{errors.rsvp}</span>}
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Ucapan & doa</span>
          <textarea
            name="message"
            value={form.message}
            onChange={update('message')}
            rows={4}
            maxLength={500}
            className={`${inputClass(Boolean(errors.message))} resize-y`}
            placeholder="Tulis ucapan dan doa terbaikmu untuk kedua mempelai"
          />
          <span className="mt-1 flex items-start justify-between gap-3">
            <span className="text-sm text-red-600">{errors.message || ''}</span>
            <span className="shrink-0 text-xs text-slate-500">{form.message.trim().length}/500</span>
          </span>
        </label>
      </div>

      {errors.form && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {errors.form}
        </div>
      )}

      {thanks && (
        <div
          className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          Terima kasih, {thanks}. Ucapanmu sudah tersimpan.
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-rose-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
        ) : (
          <Icon name="send" className="h-4 w-4" />
        )}
        {submitting ? 'Mengirim...' : 'Kirim Ucapan'}
      </button>
    </form>
  )
}

function GuestItem({ guest }) {
  const attending = guest.rsvp_status === 'attending'
  return (
    <li className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-semibold text-slate-800">{guest.name}</p>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
            attending
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-slate-200 bg-slate-50 text-slate-500'
          }`}
        >
          {attending ? 'Hadir' : 'Berhalangan'}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-slate-500">{timeAgo(guest.created_at)}</p>
      {guest.message && <p className="mt-2 text-sm leading-6 text-slate-600">{guest.message}</p>}
    </li>
  )
}

function GuestSection({ slug, guests, guestCount, prefillName, onSent }) {
  return (
    <section id="ucapan" className="px-5">
      <SectionTitle>Ucapan & Doa</SectionTitle>

      <RsvpForm slug={slug} prefillName={prefillName} onSent={onSent} />

      {guests.length > 0 ? (
        <div className="mx-auto mt-8 max-w-lg">
          <p className="text-center text-xs text-slate-500">
            {guestCount ?? guests.length} tamu sudah mengisi
          </p>
          <ul className="mt-4 space-y-3">
            {guests.map((guest) => (
              <GuestItem key={guest.id} guest={guest} />
            ))}
          </ul>
        </div>
      ) : (
        <p className="mx-auto mt-8 max-w-lg text-center text-sm text-slate-500">
          Belum ada ucapan. Jadilah yang pertama.
        </p>
      )}
    </section>
  )
}

function CenteredNote({ title, copy, spinner = false, onRetry, homeLink = false }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 bg-white px-6 text-center">
      {spinner && (
        <span
          className="h-8 w-8 animate-spin rounded-full border-2 border-rose-200 border-t-rose-600"
          aria-hidden="true"
        />
      )}
      <h1 className="font-display text-2xl italic text-slate-800">{title}</h1>
      {copy && <p className="max-w-sm text-sm leading-6 text-slate-500">{copy}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-full bg-rose-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
        >
          Coba lagi
        </button>
      )}
      {homeLink && (
        <Link
          to="/"
          className="mt-2 rounded-full border border-rose-200 px-6 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
        >
          Kembali ke Beranda
        </Link>
      )}
    </main>
  )
}

export default function PublicInvitation() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const guestName = (searchParams.get('to') ?? '').trim().slice(0, 100)
  const [status, setStatus] = useState('loading')
  const [data, setData] = useState(null)
  const [attempt, setAttempt] = useState(0)
  // Musik baru boleh berbunyi setelah tamu menekan "Buka Undangan".
  const [opened, setOpened] = useState(false)

  useEffect(() => {
    let active = true
    setStatus('loading')

    publicApi
      .invitation(slug)
      .then((payload) => {
        if (!active) return
        setData(payload?.data ?? null)
        setStatus('ready')
      })
      .catch((error) => {
        if (!active) return
        setStatus(error?.status === 404 ? 'notfound' : 'error')
      })

    return () => {
      active = false
    }
  }, [slug, attempt])

  const groom = data?.bride_data?.groom ?? null
  const bride = data?.bride_data?.bride ?? null
  const guests = data?.guests ?? []
  const guestCount = data?.guest_count ?? guests.length
  const mainMoment = useMemo(() => eventMainMoment(data?.event_data), [data])
  const gallery = useMemo(
    () =>
      Array.isArray(data?.template_config?.gallery)
        ? data.template_config.gallery.filter((url) => typeof url === 'string')
        : [],
    [data],
  )
  const coverPhoto = String(data?.template_config?.cover_photo || '') || gallery[0] || ''
  const musicUrl = data?.template_config?.music_enabled
    ? String(data?.template_config?.music_url || '')
    : ''
  const musicTitle = String(data?.template_config?.music_title || '')

  // Animasi kaya (GSAP) — hook dipanggil unconditional sebelum early return.
  // Template tanpa flag motion tetap aman (hook disabled lewat flag internal).
  const motionRef = useRef(null)
  const template = templateByName(data?.template_name || DEFAULT_TEMPLATE_NAME)
  useInvitationMotion(motionRef, { enabled: Boolean(template.motion) })

  useEffect(() => {
    if (!data) return undefined
    const names = [nickOf(groom), nickOf(bride)].filter(Boolean).join(' & ')
    const previous = document.title
    document.title = names ? `${names} | Undangan Pernikahan` : 'Undangan Pernikahan'
    return () => {
      document.title = previous
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  async function refreshGuests() {
    try {
      const payload = await publicApi.invitation(slug)
      setData(payload?.data ?? null)
    } catch {
      // Daftar ucapan akan ikut ter-refresh saat halaman dibuka ulang.
    }
  }

  if (status === 'loading') {
    return <CenteredNote title="Memuat undangan..." spinner />
  }

  if (status === 'notfound') {
    return (
      <CenteredNote
        title="Undangan tidak ditemukan"
        copy="Link mungkin salah ketik, atau undangannya belum diterbitkan oleh pemiliknya."
        homeLink
      />
    )
  }

  if (status === 'error') {
    return (
      <CenteredNote
        title="Tidak bisa memuat undangan"
        copy="Periksa koneksi internetmu, lalu coba lagi."
        onRetry={() => setAttempt((value) => value + 1)}
      />
    )
  }

  const reveal = template.reveal

  // Section yang sama, disusun ulang per template (lihat order di katalog).
  const sections = {
    mempelai: <CoupleSection groom={groom} bride={bride} />,
    cerita: <StorySection story={data?.bride_data?.story} />,
    acara: <EventsSection eventData={data?.event_data} />,
    countdown: <CountdownSection target={mainMoment} />,
    galeri: <GallerySection photos={gallery} />,
    hadiah: <GiftSection gift={data?.template_config?.gift} />,
    ucapan: (
      <GuestSection
        slug={slug}
        guests={guests}
        guestCount={guestCount}
        prefillName={guestName}
        onSent={refreshGuests}
      />
    ),
  }

  // Halaman versi template elegan memakai komposisi sendiri (cover gelap,
  // arch, masonry, panel penutup) dari ElegantSections.jsx; section buku
  // ucapan tetap komponen yang sama dengan template lain.
  const body =
    template.name === 'elegan' ? (
      <ElegantInvitation
        groom={groom}
        bride={bride}
        eventData={data?.event_data}
        story={data?.bride_data?.story}
        gallery={gallery}
        gift={data?.template_config?.gift}
        coverPhoto={coverPhoto}
        guestName={guestName}
        mainMoment={mainMoment}
        guestSection={<div className="el-guest">{sections.ucapan}</div>}
        onOpen={() => {
          setOpened(true)
          document.getElementById('mempelai')?.scrollIntoView({ behavior: 'smooth' })
        }}
      />
    ) : (
      <>
        <Cover
          groom={groom}
          bride={bride}
          dateLabel={mainMoment ? DATE_FMT.format(mainMoment) : null}
          photo={coverPhoto}
          guestName={guestName}
          onOpen={() => {
            setOpened(true)
            document.getElementById('mempelai')?.scrollIntoView({ behavior: 'smooth' })
          }}
        />

        <div className="space-y-14 py-14 sm:space-y-16">
          {template.order.map((key, index) => (
            <Reveal key={key} variant={reveal} delay={index === 0 ? 0 : 60}>
              {sections[key]}
            </Reveal>
          ))}
        </div>
      </>
    )

  return (
    <main
      ref={motionRef}
      className="bg-white text-slate-700"
      data-template={template.name}
    >
      <MusicPlayer src={musicUrl} title={musicTitle} started={opened} />

      {body}

      <footer className="px-5 pb-10">
        <Divider />
        <p className="mt-4 text-center text-xs text-slate-500">
          Dibuat dengan <span className="text-rose-400">&hearts;</span> di{' '}
          <Link to="/" className="font-medium text-rose-700 transition hover:text-rose-800">
            nikahyuk
          </Link>
        </p>
      </footer>
    </main>
  )
}
