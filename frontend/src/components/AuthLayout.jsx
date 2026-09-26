import { Link } from 'react-router-dom'

/**
 * Cangkang halaman auth: brand di atas, kartu form di tengah.
 */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-rose-50 via-slate-50 to-slate-100 px-4 py-12">
      <Link to="/" className="mb-8 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 text-lg font-semibold text-white">
          n
        </span>
        <span className="text-xl font-semibold tracking-tight text-slate-900">nikahyuk</span>
      </Link>

      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>

      {footer && <p className="mt-6 text-sm text-slate-500">{footer}</p>}
    </div>
  )
}
