import { useCallback, useEffect, useState } from 'react'
import { invitationsApi } from '../lib/api.js'

/**
 * Ambil daftar undangan milik user yang login (GET /api/invitations).
 * Mengembalikan { invitations, loading, error, reload }.
 */
export function useInvitations() {
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    setError(null)

    try {
      const payload = await invitationsApi.list()
      setInvitations(payload?.data ?? [])
    } catch (err) {
      // Refresh diam-diam tidak boleh menghapus daftar yang sudah tampil
      // (mis. sesaat setelah pembayaran sukses).
      if (!silent) setError(err)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  // Muat awal: semua setState di sini berjalan asinkron (di dalam .then), jadi
  // tidak memicu render ganda saat effect. `reload` tetap dipakai untuk
  // refresh manual (setelah bayar/edit/hapus, termasuk mode senyap).
  useEffect(() => {
    let cancelled = false

    invitationsApi
      .list()
      .then((payload) => {
        if (!cancelled) setInvitations(payload?.data ?? [])
      })
      .catch((err) => {
        if (!cancelled) setError(err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { invitations, loading, error, reload }
}
