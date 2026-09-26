import { DEFAULT_TEMPLATE_NAME } from '../../lib/invitationPayload.js'

/**
 * Thumbnail mini sebuah template: potongan cover + tiga kotak galeri, memakai
 * palet asli template lewat atribut `data-template` (lihat src/templates.css),
 * jadi warna di kartu selalu sama dengan halaman tamunya.
 */
const THUMB_SHAPES = {
  klasik: {
    root: 'items-center text-center',
    name: 'font-display text-lg italic',
    photo: 'rounded-2xl bg-rose-200/80',
    tile: 'rounded-lg bg-rose-300/70',
  },
  minimalis: {
    root: 'items-start text-left',
    name: 'font-sans text-base font-semibold tracking-tight',
    // Minimalis memakai garis, bukan isian: foto dan kartu digambar sebagai
    // kotak bergaris supaya terlihat sebagai gaya, bukan gambar gagal muat.
    photo: 'rounded-none border border-rose-300 bg-white',
    tile: 'rounded-none border border-rose-300 bg-white',
  },
  floral: {
    root: 'items-center text-center',
    name: 'font-display text-lg italic',
    photo: 'rounded-t-[999px] rounded-b-xl bg-rose-200/80',
    tile: 'rounded-full bg-rose-300/70',
  },
  ceria: {
    root: 'items-center text-center',
    // Tulisan tangan + garis tinta putus-putus: bentuk "coretan" dikenali
    // dari thumbnail, gaya titiknya di templates.css (.ny-thumb-hand).
    name: 'ny-thumb-hand text-lg',
    photo: 'rounded-2xl border-2 border-dashed border-rose-300 bg-white',
    tile: 'rounded-full bg-rose-200/80',
  },
  elegan: {
    root: 'items-center text-center',
    // Serif editorial + bingkai arch: bentuk khas template ini dikenali dari
    // thumbnail (gaya tulisannya di elegant.css, .ny-thumb-serif).
    name: 'ny-thumb-serif text-base uppercase',
    photo: 'rounded-t-[999px] rounded-b-sm border border-rose-300 bg-rose-100/80',
    tile: 'border border-rose-200 bg-rose-50',
  },
}

export function TemplateThumb({ template, className = '' }) {
  const shape = THUMB_SHAPES[template.name] ?? THUMB_SHAPES[DEFAULT_TEMPLATE_NAME]

  return (
    <div
      data-template={template.name}
      className={`flex flex-col justify-end gap-2 overflow-hidden bg-gradient-to-b from-rose-50 via-white to-rose-100 px-4 py-4 ${shape.root} ${className}`}
    >
      <span aria-hidden="true" className={`h-16 w-full ${shape.photo}`} />
      <p className="text-[9px] font-semibold tracking-[0.28em] text-rose-700 uppercase">
        The Wedding Of
      </p>
      <p className={`text-slate-800 ${shape.name}`}>
        Andi <span className="text-rose-500">&amp;</span> Sari
      </p>
      <p className="text-[10px] text-slate-500">10 Desember 2026</p>
      <span aria-hidden="true" className="flex w-full gap-1.5 pt-1">
        {[0, 1, 2].map((index) => (
          <span key={index} className={`h-7 flex-1 ${shape.tile}`} />
        ))}
      </span>
    </div>
  )
}

/**
 * Kartu template yang bisa dipilih (langkah 1 wizard). Klik badan kartu =
 * pilih; tombol "Lihat contoh" membuka pratinjau yang bisa digulir.
 */
export default function TemplateCard({ template, selected, onSelect, onPreview }) {
  return (
    <div
      className={`flex flex-col rounded-2xl border p-3 transition ${
        selected
          ? 'border-rose-500 bg-rose-50/60 ring-1 ring-rose-500'
          : 'border-slate-200 bg-white hover:border-rose-300'
      }`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onSelect}
        className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
      >
        <TemplateThumb template={template} className="aspect-[4/5] w-full rounded-xl" />
        <span className="mt-3 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-900">{template.label}</span>
          <span className="flex gap-1" aria-hidden="true">
            {template.swatch.map((color) => (
              <span
                key={color}
                className="h-3.5 w-3.5 rounded-full ring-1 ring-slate-900/10"
                style={{ backgroundColor: color }}
              />
            ))}
          </span>
        </span>
        <span className="mt-1 block text-left text-xs leading-5 text-slate-500">
          {template.description}
        </span>
      </button>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-3">
        <button
          type="button"
          onClick={onPreview}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          Lihat contoh
        </button>
        {selected && (
          <span className="whitespace-nowrap text-xs font-semibold text-rose-700">
            Template terpilih
          </span>
        )}
      </div>
    </div>
  )
}
