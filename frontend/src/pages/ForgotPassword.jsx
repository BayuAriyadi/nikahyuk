import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout.jsx'
import { Alert, Field, SubmitButton } from '../components/form.jsx'
import { authApi } from '../lib/api.js'

/**
 * Halaman "Lupa Password": minta tautan reset lewat email.
 *
 * Setelah dikirim, balasan API selalu sama (email terdaftar atau bukan) supaya
 * tidak bisa dipakai menebak siapa yang punya akun; layar ini menampilkan
 * pesan itu apa adanya.
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState(null)
  const [sent, setSent] = useState(null)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)

    if (!email.trim()) {
      setFieldError('Email wajib diisi.')
      return
    }

    setSubmitting(true)
    try {
      const response = await authApi.forgotPassword({ email: email.trim() })
      setSent(response?.message ?? 'Kalau email itu terdaftar, kami sudah mengirim tautannya.')
    } catch (err) {
      const message = err.fieldError?.('email')
      if (message) {
        setFieldError(message)
      } else {
        setError(err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Lupa Password"
      subtitle="Masukkan email akunmu, kami kirim tautan untuk mengatur ulang password."
      footer={
        <>
          Ingat passwordmu?{' '}
          <Link to="/login" className="font-medium text-rose-600 hover:text-rose-700">
            Masuk di sini
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <div
            role="status"
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm leading-6 text-emerald-800"
          >
            {sent}
          </div>
          <p className="text-sm leading-6 text-slate-500">
            Tautan berlaku 60 menit. Tidak ketemu emailnya? Cek folder spam, atau ulangi
            permintaan sebentar lagi.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && <Alert>{error}</Alert>}

          <Field
            label="Email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setFieldError(null)
            }}
            error={fieldError}
            autoComplete="email"
            placeholder="nama@email.com"
          />

          <SubmitButton submitting={submitting}>
            {submitting ? 'Mengirim…' : 'Kirim tautan reset'}
          </SubmitButton>
        </form>
      )}
    </AuthLayout>
  )
}
