import { useState } from 'react'
import Modal from './Modal.jsx'
import Icon from './Icon.jsx'
import { Alert, SubmitButton } from './form.jsx'
import { authApi } from '../lib/api.js'

/*
 * Konfirmasi tutup akun.
 *
 * Tidak bisa dibatalkan, jadi ada tiga rintangan sebelum tombol menyala:
 *   1. melihat ringkasan apa saja yang ikut hilang,
 *   2. mengetik password saat ini,
 *   3. mengetik ulang frasa konfirmasi persis.
 *
 * Frasa konfirmasi divalidasi backend (`confirm` harus "HAPUS AKUN SAYA"),
 * jadi klien tidak pernah menjadi satu-satunya penjaga.
 */
const CONFIRM_PHRASE = 'HAPUS AKUN SAYA'

export default function DeleteAccountModal({ invitations = [], onClose, onDeleted }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const count = invitations.length
  const published = invitations.filter((item) => item.status === 'published').length
  const phraseMatched = confirm === CONFIRM_PHRASE
  const canSubmit = password.length > 0 && phraseMatched && !submitting

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)

    if (!password) {
      setErrors({ password: 'Masukkan password kamu untuk mengonfirmasi.' })
      return
    }
    if (!phraseMatched) {
      setErrors({ confirm: 'Teks konfirmasi belum cocok.' })
      return
    }

    setSubmitting(true)
    try {
      const result = await authApi.deleteAccount({ password, confirm })
      onDeleted?.(result)
    } catch (err) {
      const passwordError = err.fieldError?.('password')
      const confirmError = err.fieldError?.('confirm')
      if (passwordError || confirmError) {
        setErrors({ password: passwordError, confirm: confirmError })
      }
      // Pesan sisa (throttle 429, 401 token mati, dst.) ditampilkan di atas.
      setError(err.fieldError?.('password') || err.fieldError?.('confirm') ? null : err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={submitting ? undefined : onClose}
      title="Tutup akun"
      subtitle="Tindakan ini tidak bisa dibatalkan."
    >
      <div className="mt-4 space-y-4">
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5">
          <p className="flex items-center gap-2 text-sm font-semibold text-rose-800">
            <Icon name="trash" className="h-4 w-4" />
            Yang akan dihapus permanen
          </p>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-rose-800">
            <li>
              Akun dan profil kamu — serta akses masuk ke nikahyuk.
            </li>
            <li>
              <strong>{count}</strong> undangan{published > 0 ? ` (${published} sudah terbit)` : ''}{' '}
              beserta semua fotonya di penyimpanan.
            </li>
            <li>Daftar tamu, RSVP, dan buku ucapan.</li>
            <li>Semua sesi aktif di perangkat lain.</li>
          </ul>
          <p className="mt-2.5 text-xs leading-5 text-rose-700">
            Tautan undangan yang sudah dibagikan akan langsung mati.
          </p>
        </div>

        <p className="text-sm leading-6 text-slate-600">
          Riwayat pembayaran tetap disimpan sebagai catatan keuangan, tanpa data pribadi tamu.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && <Alert>{error}</Alert>}

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password kamu</span>
            <input
              type="password"
              name="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setErrors((prev) => ({ ...prev, password: undefined }))
                setError(null)
              }}
              autoComplete="current-password"
              placeholder="Masukkan password saat ini"
              className={`mt-1 w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 ${
                errors.password ? 'border-rose-400' : 'border-slate-300 focus:border-rose-500'
              }`}
            />
            {errors.password && <span className="mt-1 text-xs text-rose-600">{errors.password}</span>}
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Ketik <code className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold">{CONFIRM_PHRASE}</code>{' '}
              untuk mengonfirmasi
            </span>
            <input
              type="text"
              name="confirm"
              value={confirm}
              onChange={(event) => {
                setConfirm(event.target.value)
                setErrors((prev) => ({ ...prev, confirm: undefined }))
                setError(null)
              }}
              autoComplete="off"
              placeholder={CONFIRM_PHRASE}
              className={`mt-1 w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 ${
                errors.confirm ? 'border-rose-400' : 'border-slate-300 focus:border-rose-500'
              }`}
            />
            {errors.confirm && <span className="mt-1 text-xs text-rose-600">{errors.confirm}</span>}
          </label>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              Batal
            </button>
            <SubmitButton submitting={submitting} disabled={!canSubmit} className="sm:w-auto">
              {submitting ? 'Menghapus akun...' : 'Hapus akun saya'}
            </SubmitButton>
          </div>
        </form>
      </div>
    </Modal>
  )
}
