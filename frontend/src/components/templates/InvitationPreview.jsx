import { useMemo, useRef } from 'react'
import {
  Cover,
  CountdownSection,
  CoupleSection,
  EventsSection,
  GallerySection,
  GiftSection,
  StorySection,
} from '../../pages/PublicInvitation.jsx'
import { eventMainMoment } from '../../lib/invitationTime.js'
import { SAMPLE_PREVIEW } from '../../lib/samplePreview.js'
import { ElegantInvitation } from './elegant/ElegantSections.jsx'
import { DEFAULT_TEMPLATE_NAME, templateByName } from '../../lib/invitationPayload.js'
import { useInvitationMotion } from '../../lib/useInvitationMotion.js'

const DATE_FMT = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/**
 * Pratinjau undangan: halaman tamu yang sama, tapi tanpa buku ucapan, tanpa
 * musik, dan tanpa menghitung kunjungan. Dipakai di wizard "Buat Undangan"
 * (langkah pratinjau) dan galeri template di landing page.
 *
 * `data` memakai bentuk yang sama dengan API: { bride_data, event_data,
 * template_config, template_name }. Kalau kosong, dipakai contoh fiktif
 * (src/lib/samplePreview.js).
 */
export default function InvitationPreview({ data, className = '' }) {
  const source = data ?? SAMPLE_PREVIEW
  const template = templateByName(source?.template_name || DEFAULT_TEMPLATE_NAME)

  const groom = source?.bride_data?.groom ?? null
  const bride = source?.bride_data?.bride ?? null
  const gallery = useMemo(() => {
    const photos = source?.template_config?.gallery
    return Array.isArray(photos) ? photos.filter((url) => typeof url === 'string') : []
  }, [source])
  const coverPhoto = String(source?.template_config?.cover_photo || '') || gallery[0] || ''
  const mainMoment = useMemo(() => eventMainMoment(source?.event_data), [source])
  // Animasi GSAP juga jalan di pratinjau; scroller-nya div modal yang menggulir
  // (lihat scrollerFor di lib/useInvitationMotion.js).
  const motionRef = useRef(null)
  useInvitationMotion(motionRef, { enabled: Boolean(template.motion) })

  // Template elegan punya komposisi sendiri, sama seperti di halaman tamu.
  if (template.name === 'elegan') {
    return (
      <div
        ref={motionRef}
        className={`bg-white text-slate-700 ${className}`}
        data-template={template.name}
      >
        <ElegantInvitation
          groom={groom}
          bride={bride}
          eventData={source?.event_data}
          story={source?.bride_data?.story}
          gallery={gallery}
          gift={source?.template_config?.gift}
          coverPhoto={coverPhoto}
          mainMoment={mainMoment}
          coupleLayout={template.coupleLayout}
        />

        <footer className="px-5 pb-10">
          <p className="text-center text-xs text-slate-500">
            Pratinjau nikahyuk. Bagian ucapan dan doa muncul di undangan yang sudah terbit.
          </p>
        </footer>
      </div>
    )
  }

  // Section yang sama dengan halaman tamu, disusun ulang per template.
  // Buku ucapan tidak dirender: tamu belum ada, dan formnya butuh slug asli.
  const sections = {
    mempelai: <CoupleSection groom={groom} bride={bride} />,
    cerita: <StorySection story={source?.bride_data?.story} />,
    acara: <EventsSection eventData={source?.event_data} />,
    countdown: <CountdownSection target={mainMoment} />,
    galeri: <GallerySection photos={gallery} />,
    hadiah: <GiftSection gift={source?.template_config?.gift} />,
    ucapan: null,
  }

  return (
    <div className={`bg-white text-slate-700 ${className}`} data-template={template.name}>
      <Cover
        groom={groom}
        bride={bride}
        dateLabel={mainMoment ? DATE_FMT.format(mainMoment) : null}
        photo={coverPhoto}
      />

      <div className="space-y-14 py-14 sm:space-y-16">
        {template.order.map((key) => (
          <div key={key} className="ny-reveal">
            {sections[key]}
          </div>
        ))}
      </div>

      <footer className="px-5 pb-10">
        <p className="text-center text-xs text-slate-500">
          Pratinjau nikahyuk. Bagian ucapan dan doa muncul di undangan yang sudah terbit.
        </p>
      </footer>
    </div>
  )
}
