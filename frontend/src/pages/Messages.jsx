import { useMemo, useState } from 'react'
import StatusBadge from '../components/guests/StatusBadge.jsx'
import { Alert } from '../components/form.jsx'
import { useGuests } from '../hooks/useGuests.js'
import { timeAgo } from '../lib/time.js'

/*
 * Dashboard "Buku Ucapan" (fase 3): semua ucapan tamu dari undangan milik user,
 * terbaru dulu. Hanya menampilkan tamu yang mengisi pesan.
 */

export default function Messages() {
  const { guests, loading, error } = useGuests()
  const [invitationSlug, setInvitationSlug] = useState('all')

  const withMessage = useMemo(() => guests.filter((guest) => guest.message), [guests])

  const options = useMemo(() => {
    const seen = new Map()
    for (const guest of withMessage) {
      const invitation = guest.invitation
      if (invitation?.slug && !seen.has(invitation.slug)) {
        seen.set(invitation.slug, invitation)
      }
    }
    return [...seen.values()]
  }, [withMessage])

  const filtered = useMemo(
    () =>
      invitationSlug === 'all'
        ? withMessage
        : withMessage.filter((guest) => guest.invitation?.slug === invitationSlug),
    [withMessage, invitationSlug],
  )

  return (
    <section>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Buku Ucapan</h1>
        <p className="mt-1 text-sm text-slate-500">
          Semua ucapan dan doa dari tamu undanganmu, terbaru di atas.
        </p>
      </header>

      {error && (
        <div className="mt-5">
          <Alert>{error.message}</Alert>
        </div>
      )}

      {!loading && !error && withMessage.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-base font-semibold text-slate-900">Belum ada ucapan</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Ucapan tamu muncul di sini begitu mereka mengisi buku tamu di halaman undanganmu.
          </p>
        </div>
      )}

      {!loading && withMessage.length > 0 && (
        <div className="mt-6">
          {options.length > 1 && (
            <label className="block max-w-xs">
              <span className="sr-only">Filter berdasarkan undangan</span>
              <select
                value={invitationSlug}
                onChange={(event) => setInvitationSlug(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              >
                <option value="all">Semua undangan</option>
                {options.map((invitation) => (
                  <option key={invitation.slug} value={invitation.slug}>
                    {invitation.groom} &amp; {invitation.bride}
                  </option>
                ))}
              </select>
            </label>
          )}

          <ul className="mt-4 space-y-3">
            {filtered.map((guest) => (
              <li key={guest.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{guest.name}</p>
                  <StatusBadge status={guest.rsvp_status} />
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
                  {guest.message}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {guest.invitation?.groom && guest.invitation?.bride
                    ? `Untuk ${guest.invitation.groom} & ${guest.invitation.bride} · `
                    : ''}
                  {timeAgo(guest.created_at)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
