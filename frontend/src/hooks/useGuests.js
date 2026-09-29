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

  // Muat awal: semua setState di sini berjalan asinkron (di dalam .then), jadi
  // tidak memicu render ganda saat effect. `reload` tetap dipakai untuk
  // refresh manual (setelah tambah/hapus tamu).
  useEffect(() => {
    let cancelled = false

    guestsApi
      .list()
      .then((payload) => {
        if (!cancelled) setGuests(payload?.data ?? [])
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

  return { guests, loading, error, reload }
}
