import InvitationShare from './InvitationShare.jsx'
import { timeAgo } from '../../lib/time.js'

const STATUS_STYLES = {
  draft: 'border-amber-200 bg-amber-50 text-amber-700',
  published: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const shortDateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

/** 'YYYY-MM-DD' → '1 Desember 2026' (aman dari pergeseran zona waktu). */
function formatEventDate(value) {
  if (!value) return null

  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value

  return dateFormatter.format(new Date(Date.UTC(year, month - 1, day)))
}

export default function InvitationCard({ invitation, onPublish, onEdit, onDelete }) {
  const groom = invitation?.bride_data?.groom?.name ?? 'Tanpa nama'
  const bride = invitation?.bride_data?.bride?.name ?? 'Tanpa nama'
  const event = invitation?.event_data?.resepsi ?? invitation?.event_data?.akad ?? null
  const status = invitation?.status === 'published' ? 'published' : 'draft'
  const gallery = Array.isArray(invitation?.template_config?.gallery)
    ? invitation.template_config.gallery
    : []
  const cover = invitation?.template_config?.cover_photo || gallery[0] || ''

  const date = formatEventDate(event?.date)
  const createdAt = invitation?.created_at
    ? shortDateFormatter.format(new Date(invitation.created_at))
    : null

  return (
    <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">
          {groom} &amp; {bride}
        </h3>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}
        >
          {status === 'published' ? 'Terbit' : 'Draft'}
        </span>
      </div>

      {cover && (
        <img
          src={cover}
          alt="Foto cover undangan"
          loading="lazy"
          className="mt-3 h-28 w-full rounded-xl object-cover"
        />
      )}

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex gap-3">
          <dt className="w-20 shrink-0 text-slate-500">Tanggal</dt>
          <dd className="text-slate-700">
            {date ?? 'Belum diisi'}
            {date && event?.time ? `, ${event.time}` : ''}
          </dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-20 shrink-0 text-slate-500">Lokasi</dt>
          <dd className="text-slate-700">{event?.venue ?? 'Belum diisi'}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-20 shrink-0 text-slate-500">Foto</dt>
          <dd className="text-slate-700">
            {gallery.length > 0 ? `${gallery.length} foto galeri` : 'Belum ada foto'}
          </dd>
        </div>
        {status === 'published' && (
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 text-slate-500">Dilihat</dt>
            <dd className="text-slate-700">
              {invitation.visit_count > 0
                ? `${invitation.visit_count} kali`
                : 'Belum ada yang membuka'}
              {invitation.last_visited_at ? `, terakhir ${timeAgo(invitation.last_visited_at)}` : ''}
            </dd>
          </div>
        )}
      </dl>

      <InvitationShare
        slug={invitation?.slug}
        status={status}
        groom={groom}
        bride={bride}
      />

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <p className="text-xs text-slate-500">{createdAt ? `Dibuat ${createdAt}` : ''}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onDelete?.(invitation)}
            title="Hapus undangan ini"
            className="rounded-lg px-2.5 py-2 text-xs font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-700"
          >
            Hapus
          </button>
          <button
            type="button"
            onClick={() => onEdit?.(invitation)}
            title="Lengkapi data dan foto undangan"
            className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Edit
          </button>
          {status === 'draft' ? (
            <button
              type="button"
              onClick={() => onPublish?.(invitation)}
              title="Terbitkan undangan (bayar via QRIS)"
              className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-rose-700"
            >
              Publish
            </button>
          ) : (
            <a
              href={`/${invitation?.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Buka halaman undangan"
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              Lihat
            </a>
          )}
        </div>
      </div>
    </article>
  )
}
