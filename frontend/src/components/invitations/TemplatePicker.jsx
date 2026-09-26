import { TEMPLATES } from '../../lib/invitationPayload.js'

/**
 * Pemilih template undangan: kartu radio berisi contoh warna template.
 * Dipakai bersama oleh modal "Buat Undangan Baru" dan "Edit Undangan"
 * supaya pilihannya tidak pernah berbeda antar form.
 */
export default function TemplatePicker({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Template undangan" className="grid gap-2.5 sm:grid-cols-3">
      {TEMPLATES.map((template) => {
        const selected = value === template.name
        return (
          <button
            key={template.name}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(template.name)}
            className={`rounded-xl border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 ${
              selected
                ? 'border-rose-500 bg-rose-50 ring-1 ring-rose-500'
                : 'border-slate-200 bg-white hover:border-rose-300 hover:bg-rose-50/50'
            }`}
          >
            <span className="flex gap-1" aria-hidden="true">
              {template.swatch.map((color) => (
                <span
                  key={color}
                  className="h-4 w-4 rounded-full ring-1 ring-slate-900/10"
                  style={{ backgroundColor: color }}
                />
              ))}
            </span>
            <span className="mt-2 block text-sm font-semibold text-slate-800">
              {template.label}
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-slate-500">
              {template.description}
            </span>
          </button>
        )
      })}
    </div>
  )
}
