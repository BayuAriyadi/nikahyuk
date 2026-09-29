import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute, { PublicOnlyRoute } from './components/ProtectedRoute.jsx'
import DashboardLayout from './layouts/DashboardLayout.jsx'
import Landing from './pages/Landing.jsx'
import Templates from './pages/Templates.jsx'

// Halaman berat dimuat saat rutenya dibuka (code splitting). Landing page
// tetap statis: itu yang pertama dilihat pengunjung, tidak boleh menunggu
// chunk tambahan. PublicInvitation juga penting — halaman itu yang dibuka
// tamu dari HP, dan isinya hanya butuh sebagian kecil bundle utama.
const AdminUsers = lazy(() => import('./pages/AdminUsers.jsx'))
const AdminRevenue = lazy(() => import('./pages/AdminRevenue.jsx'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'))
const Guests = lazy(() => import('./pages/Guests.jsx'))
const Invitations = lazy(() => import('./pages/Invitations.jsx'))
const InvitationWizard = lazy(() => import('./pages/InvitationWizard.jsx'))
const Login = lazy(() => import('./pages/Login.jsx'))
const Messages = lazy(() => import('./pages/Messages.jsx'))
const Overview = lazy(() => import('./pages/Overview.jsx'))
const PublicInvitation = lazy(() => import('./pages/PublicInvitation.jsx'))
const Register = lazy(() => import('./pages/Register.jsx'))
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))
const Statistics = lazy(() => import('./pages/Statistics.jsx'))

/** Layar tunggu netral saat chunk halaman sedang diunduh. */
function RouteFallback() {
  return <div className="p-8 text-center text-sm text-slate-400">Memuat…</div>
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/template" element={<Templates />} />

        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnlyRoute>
              <Register />
            </PublicOnlyRoute>
          }
        />

        {/* Lupa password: terbuka untuk umum (tamu yang belum login pun boleh). */}
        <Route path="/lupa-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Overview />} />
          <Route path="undangan" element={<Invitations />} />
          {/* Wizard punya halaman sendiri supaya galeri template yang panjang
              tidak terjepit di dalam modal. */}
          <Route path="undangan/baru" element={<InvitationWizard />} />
          <Route path="tamu" element={<Guests />} />
          <Route path="ucapan" element={<Messages />} />
          <Route path="statistik" element={<Statistics />} />
          <Route path="admin" element={<Navigate to="/dashboard/admin/users" replace />} />
          <Route path="admin/users" element={<AdminUsers />} />
          <Route path="admin/pendapatan" element={<AdminRevenue />} />
          <Route path="pengaturan" element={<Settings />} />
        </Route>

        {/* Undangan publik tamu: satu segmen path diperlakukan sebagai slug, contoh /anto-sumanto.
            Route static di atas (/login, /register, /dashboard) selalu menang atas pola dinamis ini. */}
        <Route path="/:slug" element={<PublicInvitation />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
