// Klien HTTP tipis untuk API nikahyuk (Laravel Sanctum, bearer token).
//
// Token disimpan di localStorage (sesuai permintaan). Catatan: localStorage
// bisa dibaca JavaScript lain kalau ada celah XSS - jangan simpan data yang
// lebih sensitif dari token ini, dan selalu render data API sebagai teks
// (React sudah aman secara default).

const TOKEN_KEY = 'nikahyuk.token'
const USER_KEY = 'nikahyuk.user'

// Default '/api' → lewat proxy Vite saat dev, same-origin saat produksi.
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY))
  } catch {
    return null
  }
}

export function saveSession(user, token) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export class ApiError extends Error {
  constructor(message, { status = 0, errors = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }

  /** Pesan error pertama untuk sebuah field (dari 422 Laravel), atau null. */
  fieldError(field) {
    return this.errors?.[field]?.[0] ?? null
  }
}

/**
 * Panggil API nikahyuk. Melempar ApiError kalau response bukan 2xx.
 *
 * @param {string} path    contoh: '/login', '/user'
 * @param {{method?: string, body?: object, auth?: boolean}} options
 */
export async function apiFetch(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { Accept: 'application/json' }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const token = auth ? getToken() : null
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Tidak bisa menghubungi server. Cek koneksi lalu coba lagi.')
  }

  if (response.status === 204) {
    return null
  }

  let payload = null
  try {
    payload = await response.json()
  } catch {
    // Response tanpa body JSON - pakai pesan default di bawah.
  }

  if (!response.ok) {
    throw new ApiError(payload?.message ?? `Permintaan gagal (${response.status}).`, {
      status: response.status,
      errors: payload?.errors ?? null,
    })
  }

  return payload
}

export const authApi = {
  register: (payload) => apiFetch('/register', { method: 'POST', body: payload, auth: false }),
  login: (payload) => apiFetch('/login', { method: 'POST', body: payload, auth: false }),
  logout: () => apiFetch('/logout', { method: 'POST' }),
  me: () => apiFetch('/user'),
  /** Minta tautan reset password (dibalas pesan netral, email terdaftar atau bukan). */
  forgotPassword: (payload) =>
    apiFetch('/forgot-password', { method: 'POST', body: payload, auth: false }),
  /** Simpan password baru dari tautan reset. */
  resetPassword: (payload) =>
    apiFetch('/reset-password', { method: 'POST', body: payload, auth: false }),
}

/**
 * Upload file foto (multipart/form-data). Tidak lewat apiFetch karena body
 * FormData: header Content-Type + boundary diatur browser sendiri. Server
 * membalas { data: { url } } berisi URL relatif /storage/...
 */
export async function uploadPhotoRequest(path, file, field = 'photo') {
  const headers = { Accept: 'application/json' }
  const token = getToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const body = new FormData()
  body.append(field, file)

  let response
  try {
    response = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body })
  } catch {
    throw new ApiError('Tidak bisa menghubungi server. Cek koneksi lalu coba lagi.')
  }

  let payload = null
  try {
    payload = await response.json()
  } catch {
    // Response tanpa body JSON.
  }

  if (!response.ok) {
    throw new ApiError(payload?.message ?? `Upload gagal (${response.status}).`, {
      status: response.status,
      errors: payload?.errors ?? null,
    })
  }

  return payload
}

export const invitationsApi = {
  /** Daftar undangan milik user yang sedang login. */
  list: () => apiFetch('/invitations'),
  /** Buat undangan baru (selalu mulai sebagai draft). */
  create: (payload) => apiFetch('/invitations', { method: 'POST', body: payload }),
  /** Perbarui undangan (owner). JSONB di-merge di server; kirim null untuk menghapus field. */
  update: (id, payload) =>
    apiFetch(`/invitations/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload }),
  /** Hapus undangan permanen (owner). Foto, tamu, dan transaksi ikut dibuang; server balas 204. */
  remove: (id) => apiFetch(`/invitations/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  /** Upload satu foto galeri. Server membalas { data: { url } }. */
  uploadPhoto: (id, file) =>
    uploadPhotoRequest(`/invitations/${encodeURIComponent(id)}/photos`, file),
  /** Upload musik latar (mp3/ogg/wav/m4a, maks 2 MB). Server membalas { data: { url } }. */
  uploadMusic: (id, file) =>
    uploadPhotoRequest(`/invitations/${encodeURIComponent(id)}/music`, file, 'music'),
}

export const transactionsApi = {
  /** Buat (atau ambil ulang) tagihan QRIS untuk undangan draft. */
  checkout: (slug) =>
    apiFetch(`/invitations/${encodeURIComponent(slug)}/checkout`, { method: 'POST' }),
  /** Status satu transaksi - dipakai untuk polling setelah scan QRIS. */
  show: (orderId) => apiFetch(`/transactions/${encodeURIComponent(orderId)}`),
}

export const guestsApi = {
  /** Semua tamu dari undangan milik user (dashboard fase 3). */
  list: () => apiFetch('/guests'),
  /** Tambah satu nama tamu manual (status awal "pending"). */
  create: (payload) => apiFetch('/guests', { method: 'POST', body: payload }),
  /** Hapus satu tamu dari daftar. Server balas 204. */
  remove: (id) => apiFetch(`/guests/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}

export const publicApi = {
  /** Konten undangan terbit untuk tamu (tanpa auth). Draft atau slug salah => 404. */
  invitation: (slug) => apiFetch(`/invitations/${encodeURIComponent(slug)}`, { auth: false }),
  /** Kirim RSVP + ucapan tamu (tanpa auth, rate limit 10 req/menit di server). */
  rsvp: (slug, payload) =>
    apiFetch(`/invitations/${encodeURIComponent(slug)}/guests`, {
      method: 'POST',
      body: payload,
      auth: false,
    }),
}

export const adminApi = {
  listUsers: () => apiFetch('/admin/users'),
  getStats: () => apiFetch('/admin/stats'),
  listTransactions: () => apiFetch('/admin/transactions'),
  updateUser: (id, payload) => apiFetch(`/admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload }),
  deleteUser: (id) => apiFetch(`/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}
