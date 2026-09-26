import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout.jsx'
import { Alert, Field, SubmitButton } from '../components/form.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState({ email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  function update(field) {
    return (event) => {
      const { value } = event.target
      setForm((prev) => ({ ...prev, [field]: value }))
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError(null)

    const errors = {}
    if (!form.email.trim()) errors.email = 'Email wajib diisi.'
    if (!form.password) errors.password = 'Password wajib diisi.'
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setSubmitting(true)
    try {
      await login({ email: form.email.trim(), password: form.password })
      navigate(location.state?.from ?? '/dashboard', { replace: true })
    } catch (error) {
      const emailError = error.fieldError?.('email')
      const passwordError = error.fieldError?.('password')
      setFieldErrors({ email: emailError, password: passwordError })
      if (!emailError && !passwordError) {
        setFormError(error.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Masuk"
      subtitle="Lanjutkan mengelola undanganmu."
      footer={
        <>
          Belum punya akun?{' '}
          <Link to="/register" className="font-medium text-rose-600 hover:text-rose-700">
            Daftar sekarang
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {formError && <Alert>{formError}</Alert>}

        <Field
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={update('email')}
          error={fieldErrors.email}
          autoComplete="email"
          placeholder="nama@email.com"
        />

        <Field
          label="Password"
          name="password"
          type="password"
          value={form.password}
          onChange={update('password')}
          error={fieldErrors.password}
          autoComplete="current-password"
          placeholder="••••••••"
        />

        <SubmitButton submitting={submitting}>{submitting ? 'Memproses…' : 'Masuk'}</SubmitButton>

        <p className="text-center text-sm">
          <Link to="/lupa-password" className="font-medium text-rose-600 hover:text-rose-700">
            Lupa password?
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
