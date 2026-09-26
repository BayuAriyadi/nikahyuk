import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout.jsx'
import { Alert, Field, SubmitButton } from '../components/form.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
  })
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
    if (!form.name.trim()) errors.name = 'Nama wajib diisi.'
    if (!form.email.trim()) errors.email = 'Email wajib diisi.'
    if (!form.password) errors.password = 'Password wajib diisi.'
    else if (form.password.length < 8) errors.password = 'Password minimal 8 karakter.'
    if (form.password_confirmation !== form.password) {
      errors.password_confirmation = 'Konfirmasi password tidak cocok.'
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setSubmitting(true)
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        password_confirmation: form.password_confirmation,
      })
      navigate('/dashboard', { replace: true })
    } catch (error) {
      const nameError = error.fieldError?.('name')
      const emailError = error.fieldError?.('email')
      const passwordError = error.fieldError?.('password')
      setFieldErrors({
        name: nameError,
        email: emailError,
        password: passwordError,
        password_confirmation: error.fieldError?.('password_confirmation'),
      })
      if (!nameError && !emailError && !passwordError) {
        setFormError(error.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Buat akun"
      subtitle="Gratis. Bikin undangan digital pertamamu dalam hitungan menit."
      footer={
        <>
          Sudah punya akun?{' '}
          <Link to="/login" className="font-medium text-rose-600 hover:text-rose-700">
            Masuk
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {formError && <Alert>{formError}</Alert>}

        <Field
          label="Nama lengkap"
          name="name"
          value={form.name}
          onChange={update('name')}
          error={fieldErrors.name}
          autoComplete="name"
          placeholder="Nama kamu"
        />

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
          autoComplete="new-password"
          placeholder="Minimal 8 karakter"
        />

        <Field
          label="Konfirmasi password"
          name="password_confirmation"
          type="password"
          value={form.password_confirmation}
          onChange={update('password_confirmation')}
          error={fieldErrors.password_confirmation}
          autoComplete="new-password"
          placeholder="Ulangi password"
        />

        <SubmitButton submitting={submitting}>{submitting ? 'Memproses…' : 'Daftar'}</SubmitButton>
      </form>
    </AuthLayout>
  )
}
