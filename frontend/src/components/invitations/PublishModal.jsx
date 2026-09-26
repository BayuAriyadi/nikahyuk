import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import Modal from '../Modal.jsx'
import { Alert } from '../form.jsx'
import { transactionsApi } from '../../lib/api.js'
import { useToast } from '../../context/ToastContext.jsx'

const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const expiryFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Jakarta',
})

/**
 * Modal "Terbitkan Undangan":
 * - membuka transaksi QRIS lewat POST /api/invitations/{slug}/checkout
 * - menampilkan QR (qr_string dirender lokal; qr_url dipakai kalau gateway
 *   mengirim gambar - mis. Midtrans)
 * - polling GET /api/transactions/{order_id} tiap 3 detik sampai lunas
 * - begitu lunas: toast + refresh daftar undangan (status jadi Terbit)
 */
export default function PublishModal({ invitation, onClose, onPaid }) {
  const toast = useToast()
  const [checkout, setCheckout] = useState(null)
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const paidNotified = useRef(false)

  const slug = invitation?.slug ?? null
  const orderId = checkout?.order_id ?? null
  const paymentStatus = checkout?.payment_status ?? null
  const paid = paymentStatus === 'paid'
  const finished = paymentStatus === 'expired' || paymentStatus === 'failed'

  // Saat modal tampil (atau "Coba lagi"): minta / ambil ulang tagihan QRIS.
  useEffect(() => {
    if (!slug) return undefined

    let cancelled = false

    ;(async () => {
      try {
        const payload = await transactionsApi.checkout(slug)
        if (!cancelled) setCheckout(payload?.data ?? null)
      } catch (err) {
        if (!cancelled) setError(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [slug, attempt])

  function retryCheckout() {
    setCheckout(null)
    setQrDataUrl(null)
    setError(null)
    setLoading(true)
    setAttempt((value) => value + 1)
  }

  // QR string → gambar, dirender lokal (tidak menembak layanan eksternal).
  useEffect(() => {
    const qrString = checkout?.qr_string
    if (!qrString) return undefined

    let cancelled = false
    QRCode.toDataURL(qrString, { width: 280, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null)
      })

    return () => {
      cancelled = true
    }
  }, [checkout?.qr_string])

  // Polling status tiap 3 detik sampai lunas / modal ditutup.
  useEffect(() => {
    if (!orderId || paid) return undefined

    const timer = window.setInterval(async () => {
      try {
        const payload = await transactionsApi.show(orderId)
        setCheckout(payload?.data ?? null)
      } catch {
        // Gangguan sesaat - biarkan polling jalan terus.
      }
    }, 3000)

    return () => window.clearInterval(timer)
  }, [orderId, paid])

  // Begitu lunas: toast sekali + refresh daftar undangan di belakang modal.
  useEffect(() => {
    if (paid && !paidNotified.current) {
      paidNotified.current = true
      toast.success('Pembayaran diterima. Undangan kamu sudah terbit!')
      onPaid?.()
    }
  }, [paid, onPaid, toast])

  return (
    <Modal
      open
      onClose={onClose}
      title="Terbitkan Undangan"
      subtitle={slug ? `Undangan "${slug}" aktif otomatis setelah pembayaran QRIS diterima.` : undefined}
    >
      {loading && <p className="text-sm text-slate-500">Menyiapkan tagihan QRIS…</p>}

      {!loading && error && (
        <div className="space-y-3">
          <Alert>{error.message}</Alert>
          <button
            type="button"
            onClick={retryCheckout}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Coba lagi
          </button>
        </div>
      )}

      {!loading && !error && checkout && (
        <div className="space-y-4">
          {!paid && !finished && (
            <>
              <p className="text-sm text-slate-600">
                Scan QRIS ini pakai aplikasi e-wallet / m-banking apa pun. Setelah pembayaran
                diterima, undangan otomatis terbit.
              </p>

              <div className="flex justify-center">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Kode QRIS"
                    className="h-64 w-64 rounded-xl border border-slate-200 bg-white p-2"
                  />
                ) : checkout.qr_url ? (
                  <img
                    src={checkout.qr_url}
                    alt="Kode QRIS"
                    className="h-64 w-64 rounded-xl border border-slate-200 bg-white p-2"
                  />
                ) : (
                  <p className="text-sm text-slate-500">QR belum tersedia dari gateway.</p>
                )}
              </div>

              <dl className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Nominal</dt>
                  <dd className="font-semibold text-slate-900">
                    {rupiah.format(Number(checkout.amount ?? 0))}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Kode bayar</dt>
                  <dd className="truncate font-mono text-xs leading-5 text-slate-700">
                    {checkout.order_id}
                  </dd>
                </div>
                {checkout.expires_at && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Berlaku sampai</dt>
                    <dd className="text-slate-700">
                      {expiryFormatter.format(new Date(checkout.expires_at))} WIB
                    </dd>
                  </div>
                )}
              </dl>

              {checkout.simulation_command && (
                <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                  <p className="font-semibold">Mode simulasi lokal</p>
                  <p className="mt-1">
                    Belum pakai kredensial Midtrans asli? Jalankan perintah ini untuk
                    mensimulasikan pembayaran:
                  </p>
                  <code className="mt-1 block overflow-x-auto rounded bg-white/70 px-2 py-1 font-mono">
                    {checkout.simulation_command}
                  </code>
                </div>
              )}

              <p className="flex items-center gap-2 text-xs text-slate-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" aria-hidden="true" />
                Menunggu pembayaran. Status dicek otomatis tiap 3 detik.
              </p>
            </>
          )}

          {finished && (
            <div className="space-y-3">
              <Alert>
                {paymentStatus === 'expired'
                  ? 'Tagihan kedaluwarsa sebelum dibayar. Buat tagihan baru untuk melanjutkan.'
                  : 'Pembayaran gagal / dibatalkan. Buat tagihan baru untuk mencoba lagi.'}
              </Alert>
              <button
                type="button"
                onClick={retryCheckout}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
              >
                Buat tagihan baru
              </button>
            </div>
          )}

          {paid && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <p className="font-semibold">Pembayaran diterima.</p>
              <p className="mt-1">
                Undangan kamu sudah berstatus Terbit dan bisa dibagikan ke tamu.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          {paid ? 'Selesai' : 'Tutup'}
        </button>
      </div>
    </Modal>
  )
}
