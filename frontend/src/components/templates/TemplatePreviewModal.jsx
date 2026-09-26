import Modal from '../Modal.jsx'
import InvitationPreview, { SAMPLE_PREVIEW } from './InvitationPreview.jsx'
import { templateByName } from '../../lib/invitationPayload.js'

/**
 * Pratinjau satu template memakai data contoh fiktif. Isi undangan bisa
 * digulir di dalam modal, sama seperti halaman tamu di HP.
 *
 * `onUse` opsional: kalau diisi, muncul tombol "Pakai template ini"
 * (dipakai di galeri landing page).
 */
export default function TemplatePreviewModal({ templateName, onClose, onUse }) {
  const template = templateByName(templateName)

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`Contoh template ${template.label}`}
      subtitle="Isi contohnya fiktif. Gulir untuk melihat seluruh halaman undangan."
    >
      <div className="max-h-[65vh] overflow-y-auto rounded-2xl border border-slate-200">
        <InvitationPreview
          className="ny-preview"
          data={{ ...SAMPLE_PREVIEW, template_name: template.name }}
        />
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Tutup
        </button>
        {onUse && (
          <button
            type="button"
            onClick={() => onUse(template.name)}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            Buat undangan baru
          </button>
        )}
      </div>
    </Modal>
  )
}
