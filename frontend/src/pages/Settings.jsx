import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Field, SubmitButton } from '../components/form.jsx'
import Icon from '../components/Icon.jsx'
import DeleteAccountModal from '../components/DeleteAccountModal.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useInvitations } from '../hooks/useInvitations.js'
import { authApi } from '../lib/api.js'

/*
 * Dashboard "Pengaturan": kartu ganti password.
 *
 * Server mencabut SEMUA token milik user begitu password berhasil diganti
 * (termasuk token yang dipakai request ini), jadi tidak ada jalan lain selain
 * mengakhiri sesi di sisi klien dan mengantar user ke halaman masuk. Kalau
 * tidak dilakukan, dashboard akan memanggil API dengan token mati dan
 * menampilkan error 401 bertubi-tubi.
 */

/** Penanda kekuatan password; cuma indikator, bukan aturan yang memblokir. */
function strengthOf(password) {
  if (!password) return { tier: 0, label: '' }
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Za-z]/.test(password) && /\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return { tier: 1, label: 'Lemah' }
  if (score === 2) return { tier: 2, label: 'Cukup' }
  if (score === 3) return { tier: 3, label: 'Baik' }
  return { tier: 4, label: 'Kuat' }
}

const TIER_CLASS = {
  1: 'bg-rose-500',
  2: 'bg-amber-500',
  3: 'bg-sky-500',
  4: 'bg-emerald-500',
}

const TIER_TEXT = {
  1: 'text-rose-700',
  2: 'text-amber-700',
  3: 'text-sky-700',
  4: 'text-emerald-700',
}

export default function Settings() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { invitations, loading: invitationsLoading } = useInvitations()

  const [deleteOpen, setDeleteOpen] = useState(false)

  const [form, setForm] = useState({
    current_password: '',
    password: '',
    password_confirmation: '',
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const strength = strengthOf(form.password)

  function update(field) {
    return (event) => {
      const value = event.target.value
      setForm((prev) => ({ ...prev, [field]: value }))
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
      setError(null)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)

    const errors = {}
    if (!form.current_password) errors.current_password = 'Password saat ini wajib diisi.'
    if (!form.password) errors.password = 'Password baru wajib diisi.'
    else if (form.password.length < 8) errors.password = 'Password baru minimal 8 karakter.'
    if (form.password !== form.password_confirmation) {
      errors.password_confirmation = 'Konfirmasi password baru tidak cocok.'
    }
    if (form.current_password && form.password === form.current_password) {
      errors.password = 'Password baru harus berbeda dari password saat ini.'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setSubmitting(true)
    try {
      await authApi.changePassword(form)
      setDone(true)
    } catch (err) {
      const fields = ['current_password', 'password', 'password_confirmation']
      let handled = false
      for (const field of fields) {
        const message = err.fieldError?.(field)
        if (message) {
          markFieldError(field, message)
          handled = true
        }
      }
      if (!handled) setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function markFieldError(field, message) {
    setFieldErrors((prev) => ({ ...prev, [field]: message }))
  }

  /**
   * Akun sudah dihapus server: token mati, dashboard tidak bisa dipakai lagi.
   * Bersihkan sesi lokal lalu keluar ke landing — bukan ke /login, karena
   * emailnya sudah tidak terdaftar.
   */
  async function handleAccountDeleted() {
    setDeleteOpen(false)
    try {
      await logout()
    } catch {
      // Token sudah tidak berlaku; sesi lokal tetap dibersihkan oleh logout().
    }
    navigate('/', { replace: true })
  }

  // Begitu berhasil: token sudah mati di server, bersihkan sesi lokal.
  //
  // Penanda sukses disimpan di sessionStorage, bukan router state: ProtectedRoute
  // akan mengarahkan ke /login dengan `state.from` sendiri dan menimpa state
  // yang kita kirim, jadi pesan berbasis state hilang di tengah jalan.
  useEffect(() => {
    if (!done) return
    sessionStorage.setItem('nikahyuk.passwordChanged', '1')
    const timer = setTimeout(async () => {
      await logout().catch(() => {})
      navigate('/login', { replace: true })
    }, 1600)
    return () => clearTimeout(timer)
  }, [done, logout, navigate])

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Pengaturan</h1>
        <p className="mt-1 text-sm text-slate-500">
          Keamanan akun dan data pribadi kamu.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <Icon name="link" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">Password</h2>
            <p className="text-xs text-slate-500">
              Ganti password secara berkala supaya akun tetap aman.
            </p>
          </div>
        </div>

        <div className="px-5 py-5">
          {done ? (
            <div
              role="status"
              className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5"
            >
              <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div className="text-sm leading-6 text-emerald-800">
                <p className="font-semibold">Password berhasil diganti.</p>
                <p>
                  Semua sesi lain sudah dikeluarkan. Kamu akan diarahkan ke halaman masuk untuk
                  masuk dengan password baru.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-md space-y-4" noValidate>
              {error && <Alert>{error}</Alert>}

              <Field
                label="Password saat ini"
                name="current_password"
                type="password"
                value={form.current_password}
                onChange={update('current_password')}
                error={fieldErrors.current_password}
                autoComplete="current-password"
                placeholder="Masukkan password yang dipakai sekarang"
              />

              <div>
                <Field
                  label="Password baru"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={update('password')}
                  error={fieldErrors.password}
                  autoComplete="new-password"
                  placeholder="Minimal 8 karakter"
                />
                {form.password && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex flex-1 gap-1">
                      {[1, 2, 3, 4].map((step) => (
                        <span
                          key={step}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            step <= strength.tier ? TIER_CLASS[strength.tier] : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                    <span className={`text-xs font-medium ${TIER_TEXT[strength.tier]}`}>
                      {strength.label}
                    </span>
                  </div>
                )}
              </div>

              <Field
                label="Ulangi password baru"
                name="password_confirmation"
                type="password"
                value={form.password_confirmation}
                onChange={update('password_confirmation')}
                error={fieldErrors.password_confirmation}
                autoComplete="new-password"
                placeholder="Sama persis dengan password baru"
              />

              <SubmitButton submitting={submitting} className="w-full sm:w-auto">
                {submitting ? 'Menyimpan...' : 'Ganti password'}
              </SubmitButton>

              <p className="text-xs leading-5 text-slate-500">
                Setelah diganti, semua perangkat yang sedang masuk akan dikeluarkan dan perlu masuk
                ulang dengan password baru.
              </p>
            </form>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-rose-200 bg-white">
        <div className="flex items-center gap-3 border-b border-rose-100 px-5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <Icon name="trash" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">Tutup akun</h2>
            <p className="text-xs text-slate-500">
              Hapus akun beserta semua undangan dan foto. Tidak bisa dibatalkan.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5">
          <p className="max-w-md text-sm leading-6 text-slate-600">
            Semua undangan{invitationsLoading ? '' : ` (${invitations.length})`}, tamu, ucapan, dan
            foto akan hilang permanen. Riwayat pembayaran tetap disimpan sebagai catatan keuangan.
          </p>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="shrink-0 rounded-lg border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            Tutup akun saya
          </button>
        </div>
      </div>

      {deleteOpen && (
        <DeleteAccountModal
          invitations={invitations}
          onClose={() => setDeleteOpen(false)}
          onDeleted={handleAccountDeleted}
        />
      )}
    </section>
  )
}
