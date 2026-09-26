import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute, { PublicOnlyRoute } from './components/ProtectedRoute.jsx'
import DashboardLayout from './layouts/DashboardLayout.jsx'
import AdminUsers from './pages/AdminUsers.jsx'
import AdminRevenue from './pages/AdminRevenue.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import Guests from './pages/Guests.jsx'
import Invitations from './pages/Invitations.jsx'
import InvitationWizard from './pages/InvitationWizard.jsx'
import Login from './pages/Login.jsx'
import Landing from './pages/Landing.jsx'
import Messages from './pages/Messages.jsx'
import Overview from './pages/Overview.jsx'
import Placeholder from './pages/Placeholder.jsx'
import PublicInvitation from './pages/PublicInvitation.jsx'
import Register from './pages/Register.jsx'
import ResetPassword from './pages/ResetPassword.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

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
        <Route path="admin" element={<Navigate to="/dashboard/admin/users" replace />} />
        <Route path="admin/users" element={<AdminUsers />} />
        <Route path="admin/pendapatan" element={<AdminRevenue />} />
        <Route
          path="pengaturan"
          element={
            <Placeholder
              title="Pengaturan"
              copy="Pengaturan akun dan keamanan akan tersedia di sini."
            />
          }
        />
      </Route>

      {/* Undangan publik tamu: satu segmen path diperlakukan sebagai slug, contoh /anto-sumanto.
          Route static di atas (/login, /register, /dashboard) selalu menang atas pola dinamis ini. */}
      <Route path="/:slug" element={<PublicInvitation />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
