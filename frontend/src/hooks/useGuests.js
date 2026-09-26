import { useCallback, useEffect, useState } from 'react'
import { guestsApi } from '../lib/api.js'

/**
 * Ambil semua tamu dari undangan milik user yang login (GET /api/guests).
 * Dipakai halaman "Daftar Tamu", "Buku Ucapan", dan kartu statistik Overview.
 * Mengembalikan { guests, loading, error, reload }.
 */
export function useGuests() {
  const [guests, setGuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    setError(null)

    try {
      const payload = await guestsApi.list()
      setGuests(payload?.data ?? [])
    } catch (err) {
      if (!silent) setError(err)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { guests, loading, error, reload }
}
