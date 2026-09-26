import { useEffect, useMemo, useRef, useState } from 'react'
import { adminApi } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'

function StatCard({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-900',
    emerald: 'text-emerald-700',
    violet: 'text-violet-700',
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tracking-tight ${tones[tone]}`}>{value}</p>
    </div>
  )
}

/* Dropdown role dengan animasi open/close */
function RoleSelect({ currentRole, onChange, disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const options = [
    { value: 'user', label: 'User', color: 'bg-slate-100 text-slate-700' },
    { value: 'admin', label: 'Admin', color: 'bg-violet-100 text-violet-700' },
  ]
  const current = options.find((o) => o.value === currentRole) || options[0]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${current.color} hover:opacity-80 disabled:opacity-50`}
      >
        {current.label}
        <svg
          className={`h-3 w-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Dropdown panel */}
      <div
        className={`absolute right-0 z-10 mt-1 w-32 origin-top-right rounded-xl border border-slate-200 bg-white p-1 shadow-lg transition-all duration-200 ${
          open
            ? 'scale-100 opacity-100'
            : 'pointer-events-none scale-95 opacity-0'
        }`}
      >
        {options
          .filter((o) => o.value !== currentRole)
          .map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <span className={`inline-block h-2 w-2 rounded-full ${option.color}`} />
              {option.label}
            </button>
          ))}
      </div>
    </div>
  )
}

export default function AdminUsers() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    Promise.all([adminApi.listUsers(), adminApi.getStats()])
      .then(([usersRes, statsRes]) => {
        setUsers(usersRes.data || [])
        setStats(statsRes)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return users
    return users.filter(
      (u) => u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle),
    )
  }, [users, query])

  const handleRoleChange = async (userId, newRole) => {
    try {
      await adminApi.updateUser(userId, { role: newRole })
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)))
    } catch (err) {
      alert('Gagal ubah role: ' + (err.errors?.[0] || err.message))
    }
  }

  const handleDelete = async (userId) => {
    if (!confirm('Hapus user ini? Semua undangannya akan ikut terhapus.')) return
    setDeleting(userId)
    try {
      await adminApi.deleteUser(userId)
      setUsers((prev) => prev.filter((u) => u.id !== userId))
      setStats((prev) => (prev ? { ...prev, total_users: prev.total_users - 1 } : prev))
    } catch (err) {
      alert('Gagal hapus: ' + (err.errors?.[0] || err.message))
    } finally {
      setDeleting(null)
    }
  }

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

  return (
    <section>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Pengguna</h1>
        <p className="mt-1 text-sm text-slate-500">
          Kelola akun pengguna platform.
        </p>
      </header>

      {stats && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Users" value={stats.total_users} />
          <StatCard label="Admins" value={stats.total_admins} tone="violet" />
          <StatCard label="Regular Users" value={stats.total_users - stats.total_admins} tone="emerald" />
          <StatCard label="Active" value={stats.total_users - stats.total_admins} />
        </div>
      )}

      {!loading && users.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-base font-semibold text-slate-900">Belum ada pengguna</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Pengguna yang mendaftar akan muncul di sini.
          </p>
        </div>
      )}

      {!loading && users.length > 0 && (
        <div className="mt-6">
          <label className="block max-w-xs">
            <span className="sr-only">Cari pengguna</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama atau email…"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
            />
          </label>

          {filtered.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              Tidak ada pengguna yang cocok dengan "{query}".
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {filtered.map((u) => (
                <li
                  key={u.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 sm:flex sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{u.name}</p>
                      <RoleSelect
                        currentRole={u.role}
                        onChange={(role) => handleRoleChange(u.id, role)}
                        disabled={deleting === u.id || u.id === user?.id}
                      />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {u.email} · {new Date(u.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {u.id === user?.id && ' · Kamu'}
                    </p>
                  </div>

                  <div className="mt-3 shrink-0 sm:mt-0">
                    {u.id === user?.id ? (
                      <span className="inline-flex items-center rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-500">
                        Akun sendiri
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDelete(u.id)}
                        disabled={deleting === u.id}
                        title={`Hapus ${u.name}`}
                        className="rounded-lg px-2.5 py-2 text-xs font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
                      >
                        {deleting === u.id ? 'Menghapus…' : 'Hapus'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}