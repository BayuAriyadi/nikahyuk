import { useMemo, useState } from 'react'
import Modal from '../components/Modal.jsx'
import StatusBadge from '../components/guests/StatusBadge.jsx'
import Icon from '../components/Icon.jsx'
import { Alert, Field } from '../components/form.jsx'
import { useGuests } from '../hooks/useGuests.js'
import { useInvitations } from '../hooks/useInvitations.js'
import { guestsApi } from '../lib/api.js'
import { invitationGuestUrl, whatsappGuestShareUrl } from '../lib/share.js'
import { timeAgo } from '../lib/time.js'

/*
 * Dashboard "Daftar Tamu" (fase 3): rekap kehadiran, tambah nama manual,
 * tombol WhatsApp pribadi per tamu (tautan ?to=Nama), dan hapus tamu.
 *
 * - Tamu yang RSVP sendiri lewat undangan otomatis masuk daftar ini.
 * - Yang ditambahkan manual mulai dari status "Belum konfirmasi".
 * - Rekap dihitung dari data yang sudah dimuat; tanpa request tambahan.
 */

function StatCard({ label, value, hint, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-900',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tracking-tight ${tones[tone] ?? tones.slate}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
    </div>
  )
}

function AddGuestModal({ invitations, onClose, onAdded }) {
  const [invitationId, setInvitationId] = useState(invitations[0]?.id ?? '')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!name.trim()) {
      setError(new Error('Nama tamu wajib diisi.'))
      return
    }

    setBusy(true)
    setError(null)

    try {
      await guestsApi.create({ invitation_id: invitationId, name: name.trim() })
      onAdded()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      title="Tambah tamu"
      subtitle="Simpan nama dulu, lalu kirim undangannya lewat WhatsApp."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {invitations.length > 1 && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Untuk undangan</span>
            <select
              value={invitationId}
              onChange={(event) => setInvitationId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
            >
              {invitations.map((invitation) => (
                <option key={invitation.id} value={invitation.id}>
                  {invitation.bride_data?.groom?.name ?? 'Tanpa nama'} &amp;{' '}
                  {invitation.bride_data?.bride?.name ?? 'Tanpa nama'}
                </option>
              ))}
            </select>
          </label>
        )}

        <Field
          label="Nama tamu"
          name="guest-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="cth: Bapak Hasan Saputra"
          error={error?.fieldError?.('name') ?? undefined}
        />

        {error && !error.fieldError?.('name') && <Alert>{error.message}</Alert>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
          >
            {busy ? 'Menyimpan...' : 'Simpan nama'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function Guests() {
  const { guests, loading, error, reload } = useGuests()
  const { invitations, loading: loadingInvitations } = useInvitations()
  const [addOpen, setAddOpen] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [query, setQuery] = useState('')

  const summary = useMemo(() => {
    const counts = { attending: 0, not_attending: 0, pending: 0 }
    for (const guest of guests) {
      counts[guest.rsvp_status] = (counts[guest.rsvp_status] ?? 0) + 1
    }
    return counts
  }, [guests])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return guests
    return guests.filter((guest) => guest.name.toLowerCase().includes(needle))
  }, [guests, query])

  async function handleDelete(guest) {
    setDeleting(guest.id)
    try {
      await guestsApi.remove(guest.id)
      reload({ silent: true })
    } finally {
      setDeleting(null)
    }
  }

  const publishedInvitations = invitations.filter((invitation) => invitation.status === 'published')

  return (
    <section>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Daftar Tamu</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tamu yang mengisi RSVP di undangan otomatis masuk ke sini. Yang kamu tambahkan manual
            belum konfirmasi sampai dia membuka undangannya.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          disabled={loadingInvitations || publishedInvitations.length === 0}
          className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          + Tambah tamu
        </button>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total tamu" value={loading ? '…' : guests.length} />
        <StatCard label="Hadir" value={loading ? '…' : summary.attending} tone="emerald" />
        <StatCard label="Berhalangan" value={loading ? '…' : summary.not_attending} />
        <StatCard label="Belum konfirmasi" value={loading ? '…' : summary.pending} tone="amber" />
      </div>

      {error && (
        <div className="mt-5">
          <Alert>{error.message}</Alert>
        </div>
      )}

      {!loading && !error && guests.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-base font-semibold text-slate-900">Belum ada tamu</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Tambah nama tamu dulu supaya bisa kamu kirimi tautan undangan pribadi lewat WhatsApp.
          </p>
        </div>
      )}

      {!loading && guests.length > 0 && (
        <div className="mt-6">
          <label className="block max-w-xs">
            <span className="sr-only">Cari nama tamu</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nama tamu..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
            />
          </label>

          {filtered.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Tidak ada tamu yang cocok dengan "{query}".</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {filtered.map((guest) => {
                const invitation = guest.invitation
                const groom = invitation?.groom ?? ''
                const bride = invitation?.bride ?? ''
                const url = invitationGuestUrl(invitation?.slug, guest.name)
                const canShare = invitation?.status === 'published'

                return (
                  <li
                    key={guest.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 sm:flex sm:items-center sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{guest.name}</p>
                        <StatusBadge status={guest.rsvp_status} />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {groom && bride ? `${groom} & ${bride} · ` : ''}
                        {guest.message ? `Ucapan: "${guest.message}" · ` : ''}
                        {timeAgo(guest.created_at)}
                      </p>
                    </div>

                    <div className="mt-3 flex shrink-0 items-center gap-2 sm:mt-0">
                      {canShare ? (
                        <a
                          href={whatsappGuestShareUrl({ url, groom, bride, guestName: guest.name })}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Kirim undangan pribadi ke ${guest.name} via WhatsApp`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          <Icon name="whatsapp" className="h-3.5 w-3.5" />
                          Kirim WA
                        </a>
                      ) : (
                        <span
                          title="Tautan undangan aktif setelah undangan terbit"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-500"
                        >
                          <Icon name="whatsapp" className="h-3.5 w-3.5" />
                          Kirim WA
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDelete(guest)}
                        disabled={deleting === guest.id}
                        title={`Hapus ${guest.name} dari daftar`}
                        className="rounded-lg px-2.5 py-2 text-xs font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
                      >
                        {deleting === guest.id ? 'Menghapus...' : 'Hapus'}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {addOpen && (
        <AddGuestModal
          invitations={publishedInvitations}
          onClose={() => setAddOpen(false)}
          onAdded={() => {
            setAddOpen(false)
            reload({ silent: true })
          }}
        />
      )}
    </section>
  )
}
