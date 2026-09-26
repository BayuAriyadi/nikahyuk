import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import InvitationCard from '../components/invitations/InvitationCard.jsx'
import InvitationEditModal from '../components/invitations/InvitationEditModal.jsx'
import PublishModal from '../components/invitations/PublishModal.jsx'
import Modal from '../components/Modal.jsx'
import { Alert } from '../components/form.jsx'
import { invitationsApi } from '../lib/api.js'
import { useInvitations } from '../hooks/useInvitations.js'

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5">
      <div className="h-4 w-40 rounded bg-slate-200" />
      <div className="mt-4 space-y-2">
        <div className="h-3 w-32 rounded bg-slate-100" />
        <div className="h-3 w-48 rounded bg-slate-100" />
        <div className="h-3 w-24 rounded bg-slate-100" />
      </div>
    </div>
  )
}

/** Konfirmasi hapus undangan: sebutkan apa saja yang ikut terhapus permanen. */
function DeleteInvitationModal({ invitation, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const groom = invitation?.bride_data?.groom?.name ?? 'Tanpa nama'
  const bride = invitation?.bride_data?.bride?.name ?? 'Tanpa nama'
  const isPublished = invitation?.status === 'published'

  async function handleDelete() {
    setBusy(true)
    setError(null)

    try {
      await invitationsApi.remove(invitation.id)
      onDeleted()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      title="Hapus undangan ini?"
      subtitle={`${groom} & ${bride} · /${invitation?.slug}`}
    >
      <p className="text-sm text-slate-600">
        Semua foto undangan ini{isPublished && ', daftar tamu, ucapan, dan riwayat pembayarannya'} akan
        dihapus permanen. Tindakan ini tidak bisa dibatalkan.
      </p>

      {error && (
        <div className="mt-4">
          <Alert>{error.message}</Alert>
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
        >
          {busy ? 'Menghapus...' : 'Hapus permanen'}
        </button>
      </div>
    </Modal>
  )
}

export default function Invitations() {
  const navigate = useNavigate()
  const { invitations, loading, error, reload } = useInvitations()
  const [publishTarget, setPublishTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  function handlePublished() {
    // Refresh diam-diam supaya badge status di kartu berubah jadi "Terbit".
    reload({ silent: true })
  }

  function handleUpdated() {
    // Data di kartu (nama, foto, tanggal) ikut berubah setelah edit.
    reload({ silent: true })
  }

  function handleDeleted() {
    setDeleteTarget(null)
    reload({ silent: true })
  }

  return (
    <section>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Undangan Saya</h1>
          <p className="mt-1 text-sm text-slate-500">Semua undangan milik akun kamu.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/dashboard/undangan/baru')}
          className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700"
        >
          + Buat Undangan Baru
        </button>
      </header>

      {error && (
        <div className="mt-6 space-y-3">
          <Alert>{error.message}</Alert>
          <button
            type="button"
            onClick={reload}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Coba lagi
          </button>
        </div>
      )}

      {loading && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!loading && !error && invitations.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-base font-semibold text-slate-900">Belum ada undangan</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Klik &quot;Buat Undangan Baru&quot; untuk membuat undangan pertamamu. Cukup isi nama
            kedua mempelai, tanggal, dan lokasi acara.
          </p>
          <button
            type="button"
            onClick={() => navigate('/dashboard/undangan/baru')}
            className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            Buat Undangan Baru
          </button>
        </div>
      )}

      {!loading && invitations.length > 0 && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {invitations.map((invitation) => (
            <InvitationCard
              key={invitation.id}
              invitation={invitation}
              onPublish={setPublishTarget}
              onEdit={setEditTarget}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {publishTarget && (
        <PublishModal
          invitation={publishTarget}
          onClose={() => setPublishTarget(null)}
          onPaid={handlePublished}
        />
      )}

      {editTarget && (
        <InvitationEditModal
          invitation={editTarget}
          onClose={() => setEditTarget(null)}
          onUpdated={handleUpdated}
        />
      )}

      {deleteTarget && (
        <DeleteInvitationModal
          invitation={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      )}
    </section>
  )
}
