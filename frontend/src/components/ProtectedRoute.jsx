import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-rose-500" />
    </div>
  )
}

/**
 * Hanya untuk user yang sudah login. Belum login → lempar ke /login
 * (halaman asal disimpan supaya bisa dibalikin setelah masuk).
 */
export default function ProtectedRoute({ children }) {
  const { user, ready } = useAuth()
  const location = useLocation()

  if (!ready) return <FullPageSpinner />

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}

/**
 * Kebalikannya: halaman login/register tidak ada gunanya kalau sudah login.
 */
export function PublicOnlyRoute({ children }) {
  const { user, ready } = useAuth()

  if (!ready) return <FullPageSpinner />

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
