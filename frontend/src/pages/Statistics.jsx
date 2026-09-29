import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '../components/form.jsx'
import Icon from '../components/Icon.jsx'
import { useGuests } from '../hooks/useGuests.js'
import { useInvitations } from '../hooks/useInvitations.js'
import { timeAgo } from '../lib/time.js'

/*
 * Dashboard "Statistik Kunjungan" (/dashboard/statistik).
 *
 * Data dihitung seluruhnya di klien dari dua sumber yang sudah dimuat
 * dashboard (daftar undangan + daftar tamu), jadi tidak ada endpoint baru.
 * Yang ditampilkan: total kunjungan, kunjungan per undangan, sebaran RSVP,
 * dan undangan paling ramai.
 */

function StatCard({ label, value, hint, icon, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-900',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    rose: 'text-rose-700',
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-500">{label}</p>
        {icon && <Icon name={icon} className="h-4 w-4 shrink-0 text-slate-400" />}
      </div>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${tones[tone] ?? tones.slate}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

/** Batang proporsi sederhana; lebar dalam persen dari nilai terbesar. */
function BarRow({ label, value, total, tone, icon }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0

  return (
    <li>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 text-slate-700">
          {icon && <Icon name={icon} className="h-3.5 w-3.5 text-slate-400" />}
          {label}
        </span>
        <span className="tabular-nums text-slate-500">
          {value} <span className="text-slate-400">({pct}%)</span>
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${total > 0 ? (value / total) * 100 : 0}%` }} />
      </div>
    </li>
  )
}

export default function Statistics() {
  const { invitations, loading: loadingInvitations, error: errorInvitations } = useInvitations()
  const { guests, loading: loadingGuests, error: errorGuests } = useGuests()

  const loading = loadingInvitations || loadingGuests
  const error = errorInvitations ?? errorGuests

  const rows = useMemo(() => {
    const byId = new Map()
    for (const invitation of invitations) {
      byId.set(invitation.id, {
        id: invitation.id,
        slug: invitation.slug,
        couple: [invitation.bride_data?.groom?.name, invitation.bride_data?.bride?.name]
          .filter(Boolean)
          .join(' & '),
        visits: invitation.visit_count ?? 0,
        lastVisitedAt: invitation.last_visited_at,
        status: invitation.status,
        guests: 0,
        attending: 0,
        notAttending: 0,
        pending: 0,
        messages: 0,
      })
    }

    for (const guest of guests) {
      const row = byId.get(guest.invitation?.id)
      if (!row) continue
      row.guests += 1
      if (guest.rsvp_status === 'attending') row.attending += 1
      else if (guest.rsvp_status === 'not_attending') row.notAttending += 1
      else row.pending += 1
      if (guest.message) row.messages += 1
    }

    return [...byId.values()]
  }, [invitations, guests])

  const totals = useMemo(() => {
    const sum = (key) => rows.reduce((acc, row) => acc + row[key], 0)
    const visits = sum('visits')
    const guestsCount = sum('guests')
    const published = rows.filter((row) => row.status === 'published').length
    const neverOpened = rows.filter((row) => row.status === 'published' && row.visits === 0).length
    const everVisited = rows.filter((row) => row.visits > 0)
    // Rata-rata hanya dihitung dari undangan yang pernah dibuka: undangan baru
    // yang belum disebar tidak boleh menarik rata-rata ke nol.
    const avgPerPublished = everVisited.length
      ? Math.round(visits / everVisited.length)
      : 0

    return {
      visits,
      guestsCount,
      published,
      neverOpened,
      avgPerPublished,
      attending: sum('attending'),
      notAttending: sum('notAttending'),
      pending: sum('pending'),
      messages: sum('messages'),
    }
  }, [rows])

  // Tie-break wajib: beberapa undangan bisa punya jumlah kunjungan sama, dan
  // sort tanpa pengikat urut jadi tidak menentu antar render. Urut kedua
  // memakai slug (unik) supaya daftar selalu stabil.
  const ranked = useMemo(
    () => [...rows].sort((a, b) => b.visits - a.visits || a.slug.localeCompare(b.slug)),
    [rows],
  )

  const confirmedRate = useMemo(() => {
    const responded = totals.attending + totals.notAttending
    return responded > 0 ? Math.round((totals.attending / responded) * 100) : 0
  }, [totals])

  return (
    <section>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Statistik</h1>
        <p className="mt-1 text-sm text-slate-500">
          Rekap kunjungan dan konfirmasi kehadiran dari semua undangan yang kamu kelola.
        </p>
      </header>

      {error && (
        <div className="mt-5">
          <Alert>{error.message}</Alert>
        </div>
      )}

      {loading && (
        <p className="mt-6 text-sm text-slate-500">Memuat statistik…</p>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-base font-semibold text-slate-900">Belum ada undangan</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Statistik muncul setelah kamu membuat undangan pertama. Mulai dari memilih template,
            lalu isi data kedua mempelai.
          </p>
          <Link
            to="/dashboard/undangan/baru"
            className="mt-4 inline-flex rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            Buat undangan pertama
          </Link>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total kunjungan"
              value={totals.visits}
              hint="Halaman undangan dibuka tamu"
              icon="link"
            />
            <StatCard
              label="Undangan terbit"
              value={totals.published}
              hint={
                totals.neverOpened > 0
                  ? `${totals.neverOpened} belum pernah dibuka`
                  : 'Semua sudah pernah dibuka'
              }
              icon="send"
            />
            <StatCard
              label="Rata-rata kunjungan"
              value={totals.avgPerPublished}
              hint="Per undangan yang pernah dibuka"
              icon="star"
            />
            <StatCard
              label="Total tamu"
              value={totals.guestsCount}
              hint={`${totals.messages} mengirim ucapan`}
              icon="heart"
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-900">Konfirmasi kehadiran</h2>
              <p className="mt-1 text-sm text-slate-500">
                {totals.guestsCount > 0
                  ? `${confirmedRate}% tamu yang merespons menyatakan hadir.`
                  : 'Belum ada tamu yang tercatat.'}
              </p>
              <ul className="mt-5 space-y-3">
                <BarRow
                  label="Hadir"
                  value={totals.attending}
                  total={totals.guestsCount}
                  tone="bg-emerald-500"
                  icon="check"
                />
                <BarRow
                  label="Berhalangan"
                  value={totals.notAttending}
                  total={totals.guestsCount}
                  tone="bg-slate-400"
                  icon="close"
                />
                <BarRow
                  label="Belum konfirmasi"
                  value={totals.pending}
                  total={totals.guestsCount}
                  tone="bg-amber-400"
                  icon="clock"
                />
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-900">Kunjungan per undangan</h2>
              <p className="mt-1 text-sm text-slate-500">Diurutkan dari yang paling sering dibuka.</p>
              <ul className="mt-5 space-y-3">
                {(() => {
                  const top = ranked[0]?.visits ?? 0
                  return ranked.map((row) => (
                    <BarRow
                      key={row.id}
                      label={row.couple || 'Tanpa nama'}
                      value={row.visits}
                      total={top}
                      tone="bg-rose-500"
                    />
                  ))
                })()}
              </ul>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {/* Di layar sempit tabel digulir horizontal di dalam pembungkusnya
                supaya tidak melebar keluar halaman; overflow hidden di
                pembungkus luar dipertahankan untuk memotong radius. */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
              <caption className="sr-only">Rincian kunjungan dan tamu per undangan</caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Undangan</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Kunjungan</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Hadir</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Ucapan</th>
                  <th scope="col" className="px-4 py-3 font-medium">Terakhir dibuka</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ranked.map((row) => (
                  <tr key={row.id} className="transition hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{row.couple || 'Tanpa nama'}</p>
                      <p className="text-xs text-slate-500">/{row.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{row.visits}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {row.attending}
                      <span className="text-slate-400"> / {row.guests}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{row.messages}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {row.lastVisitedAt ? timeAgo(row.lastVisitedAt) : 'Belum pernah'}
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Pengunjung yang sama dihitung sekali dalam 30 menit per undangan.
          </p>
        </>
      )}
    </section>
  )
}
