/*
 * Template "elegan": gaya editorial sinematik (referensi our-wedding.link).
 *
 * Beda dari tiga template lama, halaman ini TIDAK memakai section generik dari
 * PublicInvitation.jsx. Alasan: gaya ini butuh komposisi sendiri (cover gelap
 * full-bleed, arch frame, kolom foto+teks berselang-seling, panel gelap
 * penutup). Memaksakan markup generik akan jadi tumpukan override CSS.
 *
 * Yang tetap dibagi: data (bride_data/event_data/template_config), ikon,
 * lightbox, form ucapan, pemutar musik, dan mesin animasi GSAP.
 *
 * Semua animasi digerakkan atribut data-* (lihat useInvitationMotion.js),
 * jadi tidak perlu JSX tween di sini.
 */
import { useEffect, useMemo, useState } from 'react'
import Icon from '../../Icon.jsx'
import { copyText } from '../../../lib/clipboard.js'

const DATE_FMT = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
const DAY_FMT = new Intl.DateTimeFormat('id-ID', { weekday: 'long' })

export function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? '' : DATE_FMT.format(d)
}

export function formatDay(iso) {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? '' : DAY_FMT.format(d)
}

/** YYYY-MM-DD -> { day: '30', month: '11', year: '2026' } untuk tata letak bertitik. */
export function dateParts(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''))
  return m ? { year: m[1], month: m[2], day: m[3] } : null
}

function nickOr(person) {
  return String(person?.nick || person?.name || '').trim()
}

/**
 * Cover: foto gelap full-bleed + scrim, nama besar berjarak lebar, tombol
 * "open invitation" tipis. Semua elemen ber-data-cover muncul berurutan.
 */
export function ElegantCover({ groom, bride, akad, resepsi, coverPhoto, guestName, onOpen }) {
  const parts = dateParts(akad?.date || resepsi?.date)
  const g = nickOr(groom)
  const b = nickOr(bride)

  return (
    <header className="el-cover" data-has-photo={coverPhoto ? 'true' : 'false'}>
      {coverPhoto && <img src={coverPhoto} alt="" className="el-cover-img" />}
      <div className="el-cover-scrim" aria-hidden="true" />

      <div className="el-cover-inner">
        <p className="el-eyebrow" data-cover>
          Wedding Invitation
        </p>

        {guestName && (
          <p className="el-guest" data-cover>
            Kepada {guestName}
          </p>
        )}

        <h1 className="el-names" data-cover>
          <span>{g}</span>
          <em>&amp;</em>
          <span>{b}</span>
        </h1>

        <span className="el-rule" data-anim="line" aria-hidden="true" />

        {parts && (
          <p className="el-date" data-cover>
            {parts.day} . {parts.month} . {parts.year}
          </p>
        )}

        {onOpen && (
          <button type="button" onClick={onOpen} className="el-open" data-cover>
            open invitation
            <Icon name="chevron-down" className="el-open-icon" />
          </button>
        )}
      </div>
    </header>
  )
}

/** Cover: dua bingkai arch berisi foto mempelai, nama + orang tua di bawahnya. */
export function ElegantCouple({ groom, bride }) {
  const people = [groom, bride].filter(Boolean)
  if (!people.length) return null

  return (
    <section id="mempelai" className="el-section">
      <p className="el-kicker" data-anim="fade-up">
        The Bride &amp; Groom
      </p>
      <h2 className="el-h2" data-anim="fade-up" data-anim-delay="0.05">
        Our <em>Couple</em>
      </h2>

      <div className="el-couple">
        {people.map((person, index) => (
          <figure key={person.name || index} className="el-couple-card" data-anim="arch" data-anim-delay={String(index * 0.12)}>
            <div className="el-arch">
              {person.photo ? (
                <img src={person.photo} alt="" />
              ) : (
                <span className="el-arch-initial" aria-hidden="true">
                  {String(person.nick || person.name || '?').trim().charAt(0)}
                </span>
              )}
            </div>
            <figcaption>
              <h3>{person.name || person.nick}</h3>
              {person.nick && person.name && <p className="el-nick">({person.nick})</p>}
              {(person.father || person.mother) && (
                <p className="el-parents">
                  {index === 0 ? 'Putra dari' : 'Putri dari'}
                  <br />
                  {[person.father, person.mother].filter(Boolean).join(' & ')}
                </p>
              )}
              {person.instagram && (
                <a
                  className="el-ig"
                  href={`https://instagram.com/${encodeURIComponent(String(person.instagram).replace(/^@/, ''))}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon name="instagram" /> @{String(person.instagram).replace(/^@/, '')}
                </a>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

/**
 * Komposisi lengkap halaman undangan gaya elegan: cover gelap, mempelai
 * (dua arch), acara, hitung mundur, galeri masonry, cerita, hadiah, ucapan
 * (node dari pemanggil), lalu panel penutup.
 *
 * Dipakai dua tempat sekaligus — halaman tamu dan pratinjau wizard — supaya
 * tidak ada dua jalur render yang bisa berbeda hasil.
 */
export function ElegantInvitation({
  groom,
  bride,
  eventData,
  story,
  gallery,
  gift,
  coverPhoto,
  guestName = '',
  guestSection = null,
  mainMoment = null,
  onOpen,
}) {
  const photos = Array.isArray(gallery) ? gallery.filter(Boolean) : []
  const closingPhoto = photos.length > 1 ? photos[photos.length - 1] : coverPhoto

  return (
    <div className="el-root">
      <ElegantCover
        groom={groom}
        bride={bride}
        akad={eventData?.akad}
        resepsi={eventData?.resepsi}
        coverPhoto={coverPhoto}
        guestName={guestName}
        onOpen={onOpen}
      />

      <ElegantCouple groom={groom} bride={bride} />
      <ElegantEvents eventData={eventData} />
      <ElegantCountdown target={mainMoment ?? countdownTarget(eventData)} />
      <ElegantGallery photos={photos} />
      <ElegantStory story={story} />
      <ElegantGift gift={gift} />
      {guestSection}
      <ElegantClosing
        groom={groom}
        bride={bride}
        akad={eventData?.akad}
        resepsi={eventData?.resepsi}
        photo={closingPhoto}
      />
    </div>
  )
}

/** Date momen acara paling awal, dipakai hitung mundur. */
function countdownTarget(eventData) {
  const candidates = [eventData?.akad, eventData?.resepsi]
    .map((ev) => {
      if (!ev?.date) return null
      const moment = new Date(`${ev.date}T${String(ev.time || '00:00').slice(0, 5)}`)
      return Number.isNaN(moment.getTime()) ? null : moment
    })
    .filter(Boolean)

  if (!candidates.length) return null
  return new Date(Math.min(...candidates.map((d) => d.getTime())))
}

/**
 * Detail acara: dua blok berselang (akad/resepsi) dengan tanggal besar,
 * jam, tempat, dan tombol peta.
 */
export function ElegantEvents({ eventData }) {
  const events = [
    { key: 'akad', label: 'Akad Nikah', ev: eventData?.akad },
    { key: 'resepsi', label: 'Resepsi', ev: eventData?.resepsi },
  ].filter((item) => item.ev && (item.ev.date || item.ev.time || item.ev.venue))

  if (!events.length) return null

  return (
    <section id="acara" className="el-section el-events">
      <p className="el-kicker" data-anim="fade-up">
        Save the date
      </p>
      <h2 className="el-h2" data-anim="fade-up" data-anim-delay="0.05">
        When &amp; <em>Where</em>
      </h2>

      <div className="el-event-grid">
        {events.map(({ key, label, ev }, index) => {
          const parts = dateParts(ev.date)
          const maps = ev.maps_url || ''
          return (
            <article key={key} className="el-event" data-anim={index === 0 ? 'slide-left' : 'slide-right'}>
              <div className="el-event-date">
                {parts ? (
                  <>
                    <span className="el-event-day">{parts.day}</span>
                    <span className="el-event-my">
                      {parts.month} / {parts.year.slice(2)}
                    </span>
                  </>
                ) : (
                  <span className="el-event-day">—</span>
                )}
              </div>
              <div className="el-event-body">
                <h3>{label}</h3>
                {ev.date && (
                  <p className="el-event-line">
                    <Icon name="calendar" />
                    {formatDay(ev.date)}, {formatDate(ev.date)}
                  </p>
                )}
                {ev.time && (
                  <p className="el-event-line">
                    <Icon name="clock" />
                    {ev.time} WIB
                  </p>
                )}
                {ev.venue && <p className="el-event-venue">{ev.venue}</p>}
                {ev.address && <p className="el-event-addr">{ev.address}</p>}
                {maps && (
                  <a className="el-btn" href={maps} target="_blank" rel="noreferrer">
                    <Icon name="pin" /> Lihat Lokasi
                  </a>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

/**
 * Hitung mundur: angka bergaya editorial (garis pemisah titik), hitung tiap detik.
 */
export function ElegantCountdown({ target }) {
  const values = useCountdown(target)
  if (!target || !values) return null

  return (
    <section className="el-countdown" data-anim="rise">
      <p className="el-kicker el-on-dark">Counting down to forever</p>
      <div className="el-count-row">
        {values.map(([label, value]) => (
          <div key={label} className="el-count-cell">
            <span className="el-count-num">{String(value).padStart(2, '0')}</span>
            <span className="el-count-label">{label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function useCountdown(target) {
  const [now, setNow] = useState(() => Date.now())
  const ready = Boolean(target)
  useEffect(() => {
    if (!ready) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [ready])

  return useMemo(() => {
    if (!ready) return null
    const diff = Math.max(0, target.getTime() - now)
    const s = Math.floor(diff / 1000)
    return [
      ['days', Math.floor(s / 86400)],
      ['hours', Math.floor((s % 86400) / 3600)],
      ['minutes', Math.floor((s % 3600) / 60)],
      ['seconds', s % 60],
    ]
  }, [ready, target, now])
}

/**
 * Galeri: kolase bergaya masonry (kolom CSS) dengan bingkai arch untuk
 * foto tertentu, plus lightbox.
 */
export function ElegantGallery({ photos }) {
  const items = useMemo(() => (Array.isArray(photos) ? photos.filter(Boolean) : []), [photos])
  if (!items.length) return null

  // Foto ke-2, ke-5, dst. dibingkai arch supaya ritmenya tidak monoton.
  const arched = new Set(items.filter((_, i) => i % 3 === 1))

  return (
    <section id="galeri" className="el-section el-gallery-section">
      <p className="el-kicker" data-anim="fade-up">
        Gallery
      </p>
      <h2 className="el-h2" data-anim="fade-up" data-anim-delay="0.05">
        Our <em>Moments</em>
      </h2>

      {/* Cukup satu sumber animasi: stagger di container. Menambah data-anim
          pada anak membuat dua tween gsap.from() berebut elemen yang sama —
          yang kedua merekam opacity 0 (sisa tween parent) sebagai nilai akhir,
          sehingga foto berhenti transparan. */}
      <div className="el-masonry" data-anim="stagger" data-anim-stagger="0.08">
        {items.map((url, index) => (
          <figure key={url} className={arched.has(url) ? 'el-shot el-shot-arch' : 'el-shot'}>
            <img src={url} alt={`Momen ${index + 1}`} loading="lazy" />
          </figure>
        ))}
      </div>
    </section>
  )
}

/** Cerita: daftar entri dengan nomor besar dan foto opsional. */
export function ElegantStory({ story }) {
  const entries = Array.isArray(story) ? story.filter((e) => e && (e.title || e.text)) : []
  if (!entries.length) return null

  return (
    <section id="cerita" className="el-section el-story-section">
      <p className="el-kicker" data-anim="fade-up">
        Our Story
      </p>
      <h2 className="el-h2" data-anim="fade-up" data-anim-delay="0.05">
        How it <em>Begins</em>
      </h2>

      <ol className="el-story">
        {entries.map((entry, index) => (
          <li key={`${entry.title}-${index}`} data-anim="fade-up" data-anim-delay={String(index * 0.06)}>
            <span className="el-story-num" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div>
              {entry.date && <p className="el-story-date">{entry.date}</p>}
              <h3>{entry.title}</h3>
              <p className="el-story-text">{entry.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Hadiah: kartu rekening bergaya minimal dengan tombol salin. */
export function ElegantGift({ gift }) {
  const [copied, setCopied] = useState({})
  const accounts = Array.isArray(gift?.accounts) ? gift.accounts.filter((a) => a?.number) : []
  if (!gift?.enabled || !accounts.length) return null

  const handleCopy = async (number) => {
    const ok = await copyText(number)
    if (ok) {
      setCopied((prev) => ({ ...prev, [number]: true }))
      setTimeout(() => setCopied((prev) => ({ ...prev, [number]: false })), 2200)
    }
  }

  return (
    <section id="hadiah" className="el-section el-gift">
      <p className="el-kicker" data-anim="fade-up">
        Wedding Gift
      </p>
      <h2 className="el-h2" data-anim="fade-up" data-anim-delay="0.05">
        Send your <em>Love</em>
      </h2>
      <p className="el-lead" data-anim="fade-up" data-anim-delay="0.1">
        Doa restu kalian sudah sangat berarti. Kalau ingin memberi tanda kasih, hadiah bisa dikirim ke
        rekening berikut.
      </p>

      <div className="el-gift-list" data-anim="stagger">
        {accounts.map((acc) => (
          <article key={`${acc.bank}-${acc.number}`} className="el-gift-card">
            <p className="el-gift-bank">{acc.bank}</p>
            <p className="el-gift-number">{acc.number}</p>
            {acc.name && <p className="el-gift-name">a.n. {acc.name}</p>}
            <button
              type="button"
              className="el-btn el-btn-ghost"
              onClick={() => handleCopy(acc.number)}
            >
              <Icon name={copied[acc.number] ? 'check' : 'copy'} />
              {copied[acc.number] ? 'Nomor tersalin' : 'Salin nomor'}
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}

/** Penutup: foto gelap + panel teks, lalu tanda tangan nama & tanggal. */
export function ElegantClosing({ groom, bride, akad, resepsi, photo }) {
  const parts = dateParts(akad?.date || resepsi?.date)
  return (
    <footer className="el-closing">
      {photo && (
        <div className="el-closing-photo" data-anim="frame">
          <img src={photo} alt="" loading="lazy" />
        </div>
      )}
      <div className="el-closing-panel">
        <p data-anim="fade-up">
          Your presence would be an honor as we exchange vows and begin this journey together. Thank
          you for being part of our special day.
        </p>
        <p className="el-sign" data-anim="fade-up" data-anim-delay="0.1">
          <span>{nickOr(groom)}</span>
          <em>&amp;</em>
          <span>{nickOr(bride)}</span>
        </p>
        {parts && (
          <p className="el-closing-date" data-anim="fade-up" data-anim-delay="0.15">
            {parts.day} . {parts.month} . {parts.year}
          </p>
        )}
      </div>
    </footer>
  )
}
