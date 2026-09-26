/*
 * Badge status tamu + labelnya, satu sumber untuk "Daftar Tamu" dan "Buku Ucapan".
 */
export const GUEST_STATUSES = {
  attending: 'Hadir',
  not_attending: 'Berhalangan',
  pending: 'Belum konfirmasi',
}

const STYLES = {
  attending: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  not_attending: 'border-slate-200 bg-slate-50 text-slate-500',
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
}

export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
        STYLES[status] ?? STYLES.pending
      }`}
    >
      {GUEST_STATUSES[status] ?? 'Belum konfirmasi'}
    </span>
  )
}
