import { useEffect, useMemo, useState } from 'react'
import { adminApi } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'

function StatCard({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-900',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    rose: 'text-rose-700',
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tracking-tight ${tones[tone]}`}>{value}</p>
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    paid: { label: 'Berhasil', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    pending: { label: 'Menunggu', class: 'bg-amber-50 text-amber-700 border-amber-200' },
    expired: { label: 'Kadaluarsa', class: 'bg-slate-100 text-slate-600 border-slate-200' },
    failed: { label: 'Gagal', class: 'bg-rose-50 text-rose-700 border-rose-200' },
  }
  const current = map[status] || { label: status, class: 'bg-slate-100 text-slate-600 border-slate-200' }
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${current.class}`}>
      {current.label}
    </span>
  )
}

export default function AdminRevenue() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    Promise.all([adminApi.getStats(), adminApi.listTransactions()])
      .then(([statsRes, txRes]) => {
        setStats(statsRes)
        setTransactions(txRes.data || [])
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return transactions
    return transactions.filter((t) => t.payment_status === filter)
  }, [transactions, filter])

  if (user?.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">403 — Unauthorized</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    )
  }

  const formatRupiah = (val) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0)

  return (
    <section>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Pendapatan & Transaksi</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pantau seluruh pembayaran penerbitan undangan digital.
        </p>
      </header>

      {stats && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Pendapatan" value={formatRupiah(stats.total_revenue)} tone="emerald" />
          <StatCard label="Transaksi Berhasil" value={stats.paid_transactions} tone="emerald" />
          <StatCard label="Menunggu Pembayaran" value={stats.pending_transactions} tone="amber" />
          <StatCard
            label="Tingkat Konversi"
            value={
              stats.paid_transactions + stats.pending_transactions > 0
                ? `${Math.round(
                    (stats.paid_transactions / (stats.paid_transactions + stats.pending_transactions)) * 100,
                  )}%`
                : '0%'
            }
          />
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <div className="flex gap-2">
          {['all', 'paid', 'pending', 'expired'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filter === f ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f === 'all' ? 'Semua' : f === 'paid' ? 'Berhasil' : f === 'pending' ? 'Pending' : 'Kadaluarsa'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-base font-semibold text-slate-900">Belum ada transaksi</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Transaksi dari penerbitan undangan akan tercatat di sini.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {filtered.map((t) => {
            const brideData = t.invitation?.bride_data
            const groomName = brideData?.groom?.name || brideData?.groom?.nick || 'Mempelai'
            const brideName = brideData?.bride?.name || brideData?.bride?.nick || 'Mempelai'
            return (
              <li
                key={t.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 sm:flex sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{formatRupiah(t.amount)}</p>
                    <StatusBadge status={t.payment_status} />
                    <span className="text-xs text-slate-400">· Order #{t.order_id}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Undangan: {groomName} & {brideName} ({t.invitation?.slug})
                    {t.invitation?.user?.email && ` · Akun: ${t.invitation.user.email}`}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Dibuat: {new Date(t.created_at).toLocaleString('id-ID')}
                    {t.paid_at && ` · Dibayar: ${new Date(t.paid_at).toLocaleString('id-ID')}`}
                    {t.payment_type && ` · Metode: ${t.payment_type.toUpperCase()}`}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}