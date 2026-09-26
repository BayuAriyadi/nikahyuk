import { useEffect, useState } from 'react'
import { adminApi } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function Admin() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([adminApi.listUsers(), adminApi.getStats()])
      .then(([usersRes, statsRes]) => {
        setUsers(usersRes.data || [])
        setStats(statsRes)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const toggleRole = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin'
    try {
      await adminApi.updateUser(userId, { role: newRole })
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      )
    } catch (err) {
      alert('Gagal ubah role: ' + (err.errors?.[0] || err.message))
    }
  }

  const deleteUser = async (userId) => {
    if (!confirm('Hapus user ini? Semua undangannya akan ikut terhapus.')) return
    try {
      await adminApi.deleteUser(userId)
      setUsers((prev) => prev.filter((u) => u.id !== userId))
    } catch (err) {
      alert('Gagal hapus user: ' + (err.errors?.[0] || err.message))
    }
  }

  if (user?.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">403 — Unauthorized</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-6 text-3xl font-bold">Admin Dashboard</h1>

      {stats && (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-gray-500">Total Users</p>
            <p className="text-2xl font-bold">{stats.total_users}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-gray-500">Admins</p>
            <p className="text-2xl font-bold">{stats.total_admins}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-gray-500">Regular Users</p>
            <p className="text-2xl font-bold">{stats.total_users - stats.total_admins}</p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border">
          <thead>
            <tr className="bg-gray-50">
              <th className="border p-2 text-left">Name</th>
              <th className="border p-2 text-left">Email</th>
              <th className="border p-2 text-left">Role</th>
              <th className="border p-2 text-left">Created</th>
              <th className="border p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="border p-2">{u.name}</td>
                <td className="border p-2">{u.email}</td>
                <td className="border p-2">
                  <span
                    className={`rounded px-2 py-1 text-xs font-semibold ${
                      u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="border p-2 text-sm text-gray-500">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="border p-2 text-center">
                  <button
                    onClick={() => toggleRole(u.id, u.role)}
                    className="mr-2 rounded bg-blue-500 px-3 py-1 text-xs text-white hover:bg-blue-600"
                  >
                    Toggle Role
                  </button>
                  <button
                    onClick={() => deleteUser(u.id)}
                    className="rounded bg-red-500 px-3 py-1 text-xs text-white hover:bg-red-600"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
