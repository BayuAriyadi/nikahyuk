import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useGuests } from '../hooks/useGuests.js'
import { useInvitations } from '../hooks/useInvitations.js'

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export default function Overview() {
  const { user } = useAuth()
  const { invitations, loading, error } = useInvitations()
  const { guests, loading: loadingGuests } = useGuests()

  const firstName = user?.name?.split(' ')[0] ?? ''
  const invitationValue = loading ? '…' : error ? '…' : invitations.length
  const guestValue = loadingGuests ? '…' : guests.length
  const messageValue = loadingGuests ? '…' : guests.filter((guest) => guest.message).length
  const visitValue = loading
    ? '…'
    : invitations.reduce((total, invitation) => total + (invitation.visit_count ?? 0), 0)

  return (
    <section>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Halo, {firstName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Selamat datang di nikahyuk. Kelola undangan digital kamu dari sini.
        </p>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Undangan"
          value={invitationValue}
          hint={error ? 'Gagal memuat data' : 'Total undangan milik kamu'}
        />
        <StatCard label="Tamu" value={guestValue} hint="Termasuk yang belum konfirmasi" />
        <StatCard label="Ucapan" value={messageValue} hint="Ucapan yang masuk di buku tamu" />
        <StatCard
          label="Kunjungan"
          value={visitValue}
          hint="Halaman undangan dibuka tamu"
        />
      </div>

      {!loading && !error && invitations.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-base font-semibold text-slate-900">Belum ada undangan</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Mulai dengan membuat undangan pertama kamu. Cukup isi nama kedua mempelai, tanggal,
            dan lokasi acara.
          </p>
          <Link
            to="/dashboard/undangan/baru"
            className="mt-4 inline-flex rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            Buat undangan pertama
          </Link>
        </div>
      )}

      {!loading && !error && invitations.length > 0 && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-900">
            Kamu punya {invitations.length} undangan
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Terbaru: {invitations[0]?.bride_data?.groom?.name ?? 'Tanpa nama'} &amp;{' '}
            {invitations[0]?.bride_data?.bride?.name ?? 'Tanpa nama'}
          </p>
          <Link
            to="/dashboard/undangan"
            className="mt-3 inline-flex text-sm font-semibold text-rose-600 transition hover:text-rose-700"
          >
            Kelola undangan
          </Link>
        </div>
      )}
    </section>
  )
}
