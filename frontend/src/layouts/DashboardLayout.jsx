import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', end: true },
  { to: '/dashboard/undangan', label: 'Undangan Saya' },
  { to: '/dashboard/tamu', label: 'Daftar Tamu' },
  { to: '/dashboard/ucapan', label: 'Buku Ucapan' },
  {
    to: '/dashboard/admin',
    label: 'Superadmin',
    adminOnly: true,
    children: [
      { to: '/dashboard/admin/users', label: 'Pengguna' },
      { to: '/dashboard/admin/pendapatan', label: 'Pendapatan' },
    ],
  },
  { to: '/dashboard/pengaturan', label: 'Pengaturan' },
]

function navLinkClass({ isActive }) {
  return `block rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-rose-50 text-rose-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`
}

function NavItem({ item, user }) {
  const location = useLocation()
  const [expanded, setExpanded] = useState(() => {
    if (!item.children) return false
    return item.children.some((child) => location.pathname.startsWith(child.to))
  })

  if (item.adminOnly && user?.role !== 'admin') return null

  if (!item.children) {
    return (
      <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
        {item.label}
      </NavLink>
    )
  }

  const isActive = location.pathname.startsWith('/dashboard/admin')

  return (
    <div key={item.to}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
          isActive ? 'bg-rose-50 text-rose-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <span>{item.label}</span>
        <svg
          className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
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
      <div
        className={`overflow-hidden transition-all duration-200 ${
          expanded ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-slate-100 pl-3">
          {item.children.map((child) => (
            <NavLink key={child.to} to={child.to} className={navLinkClass}>
              {child.label}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Cangkang area dashboard: sidebar (desktop) / header + nav scroll (mobile),
 * plus <Outlet /> untuk halaman di dalamnya.
 */
export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600 text-sm font-bold text-white">
            n
          </span>
          <span className="text-base font-semibold tracking-tight text-slate-900">nikahyuk</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} item={item} user={user} />
          ))}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <p className="truncate text-sm font-medium text-slate-900">{user?.name}</p>
          <p className="truncate text-xs text-slate-500">{user?.email}</p>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
          >
            {loggingOut ? 'Keluar…' : 'Keluar'}
          </button>
        </div>
      </aside>

      <div className="lg:hidden">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600 text-xs font-bold text-white">
              n
            </span>
            <span className="text-sm font-semibold tracking-tight text-slate-900">nikahyuk</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
          >
            {loggingOut ? 'Keluar…' : 'Keluar'}
          </button>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV_ITEMS.map((item) => {
            if (item.adminOnly && user?.role !== 'admin') return null
            if (item.children) {
              return item.children.map((child) => (
                <NavLink
                  key={child.to}
                  to={child.to}
                  className={({ isActive }) =>
                    `whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      isActive ? 'bg-rose-50 text-rose-700' : 'text-slate-600'
                    }`
                  }
                >
                  {child.label}
                </NavLink>
              ))
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    isActive ? 'bg-rose-50 text-rose-700' : 'text-slate-600'
                  }`
                }
              >
                {item.label}
              </NavLink>
            )
          })}
        </nav>
      </div>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
