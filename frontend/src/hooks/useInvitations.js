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

  useEffect(() => {
    reload()
  }, [reload])

  return { invitations, loading, error, reload }
}
