import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout.jsx'
import { Alert, Field, SubmitButton } from '../components/form.jsx'
import { authApi } from '../lib/api.js'

/**
 * Halaman "Reset Password": dibuka dari tautan di email.
 *
 * Token + email dibaca dari query string (dibuat backend saat mengirim
 * notifikasi; lihat AppServiceProvider). Setelah password tersimpan, semua
 * token sesi lama dicabut server, jadi user diminta masuk ulang.
 */
export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const token = searchParams.get('token') ?? ''
  const email = searchParams.get('email') ?? ''

  const [form, setForm] = useState({ password: '', password_confirmation: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const linkIncomplete = !token || !email

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)

    const errors = {}
    if (!form.password) errors.password = 'Password baru wajib diisi.'
    if (form.password.length > 0 && form.password.length < 8) {
      errors.password = 'Password minimal 8 karakter.'
    }
    if (form.password !== form.password_confirmation) {
      errors.password_confirmation = 'Konfirmasi password tidak cocok.'
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setSubmitting(true)
    try {
      await authApi.resetPassword({
        token,
        email,
        password: form.password,
        password_confirmation: form.password_confirmation,
      })
      setDone(true)
    } catch (err) {
      const passwordError =
        err.fieldError?.('password') ?? err.fieldError?.('password_confirmation')
      if (err.fieldError?.('email') || err.fieldError?.('token')) {
        setError(
          err.fieldError?.('token') ??
            'Tautan reset sudah tidak berlaku atau sudah dipakai. Minta tautan baru.',
        )
      } else if (passwordError) {
        setFieldErrors({ password: passwordError })
      } else {
        setError(err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (linkIncomplete) {
    return (
      <AuthLayout
        title="Tautan tidak lengkap"
        subtitle="Tautan reset harus dibuka persis dari email yang kami kirim."
        footer={
          <Link to="/lupa-password" className="font-medium text-rose-600 hover:text-rose-700">
            Minta tautan baru
          </Link>
        }
      >
        <p className="text-sm leading-6 text-slate-500">
          Cek kembali email dari nikahyuk, lalu klik tombol <em>Atur Ulang Password</em> di
          dalamnya. Kalau tautannya sudah kedaluwarsa, minta yang baru.
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Atur Ulang Password"
      subtitle={email ? `Untuk akun ${email}.` : undefined}
      footer={
        <Link to="/login" className="font-medium text-rose-600 hover:text-rose-700">
          Kembali ke halaman masuk
        </Link>
      }
    >
      {done ? (
        <div className="space-y-5">
          <div
            role="status"
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm leading-6 text-emerald-800"
          >
            Password berhasil diganti. Semua sesi lain sudah dikeluarkan, jadi kamu perlu masuk
            ulang dengan password baru.
          </div>
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="w-full rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
          >
            Masuk sekarang
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && <Alert>{error}</Alert>}

          <Field
            label="Password baru"
            name="password"
            type="password"
            value={form.password}
            onChange={(event) => {
              setForm((prev) => ({ ...prev, password: event.target.value }))
              setFieldErrors((prev) => ({ ...prev, password: undefined }))
            }}
            error={fieldErrors.password}
            autoComplete="new-password"
            placeholder="Minimal 8 karakter"
          />

          <Field
            label="Ulangi password baru"
            name="password_confirmation"
            type="password"
            value={form.password_confirmation}
            onChange={(event) => {
              setForm((prev) => ({ ...prev, password_confirmation: event.target.value }))
              setFieldErrors((prev) => ({ ...prev, password_confirmation: undefined }))
            }}
            error={fieldErrors.password_confirmation}
            autoComplete="new-password"
            placeholder="Ketik ulang password baru"
          />

          <SubmitButton submitting={submitting}>
            {submitting ? 'Menyimpan…' : 'Simpan password baru'}
          </SubmitButton>
        </form>
      )}
    </AuthLayout>
  )
}
