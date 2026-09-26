import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authApi, clearSession, getStoredUser, getToken, saveSession } from '../lib/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser())
  // Tanpa token tersimpan: tidak ada yang perlu divalidasi.
  const [ready, setReady] = useState(() => !getToken())

  // Validasi token tersimpan sekali saat app dibuka (token bisa kedaluwarsa
  // atau dicabut dari sisi server).
  useEffect(() => {
    if (!getToken()) return

    let cancelled = false

    authApi
      .me()
      .then((me) => {
        if (!cancelled) {
          saveSession(me, getToken())
          setUser(me)
        }
      })
      .catch((err) => {
        if (cancelled) return
        // Hanya buang sesi kalau server benar-benar menolak token (401/403).
        // Error jaringan (status 0, mis. server sedang restart atau request
        // terputus) TIDAK menghapus sesi, supaya user tidak tiba-tiba
        // merasa ter-logout padahal tokennya masih berlaku.
        if (err?.status === 401 || err?.status === 403) {
          clearSession()
          setUser(null)
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (credentials) => {
    const { user: me, token } = await authApi.login(credentials)
    saveSession(me, token)
    setUser(me)
    return me
  }, [])

  const register = useCallback(async (payload) => {
    const { user: me, token } = await authApi.register(payload)
    saveSession(me, token)
    setUser(me)
    return me
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // Token mungkin sudah kedaluwarsa - sesi lokal tetap dibersihkan.
    }
    clearSession()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, ready, login, register, logout }),
    [user, ready, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth harus dipakai di dalam <AuthProvider>.')
  }
  return ctx
}
