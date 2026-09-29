import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'

import { TemplatePhoto } from '../components/templates/TemplateCard.jsx'
import { TEMPLATES } from '../lib/invitationPayload.js'

// Sama seperti landing: pratinjau utuh dimuat hanya saat tamu menekan
// "Lihat contoh", sehingga halaman katalog tidak memuat seluruh tamplah tamu.
const TemplatePreviewModal = lazy(
  () => import('../components/templates/TemplatePreviewModal.jsx'),
)

/**
 * Katalog lengkap template.
 *
 * Landing page hanya menampilkan tiga desian unggulan; sisanya ada di sini
 * supaya landing tetap ringan walaupun jumlah template terus bertambah.
 */
export default function TemplatesPage() {
  const [preview, setPreview] = useState(null)

  return (
    <main className="bg-cream-50 min-h-screen py-16 sm:py-20">
      {preview && (
        <Suspense fallback={null}>
          <TemplatePreviewModal
            templateName={preview}
            onClose={() => setPreview(null)}
          />
        </Suspense>
      )}

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <nav className="text-sm text-slate-500">
          <Link to="/" className="transition hover:text-rose-700">
            Beranda
          </Link>
          <span className="px-2 text-slate-300">/</span>
          <span className="text-slate-900">Desain Template</span>
        </nav>

        <div className="mt-6 max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.24em] text-rose-600 uppercase">
            Galeri Desain
          </p>
          <h1 className="mt-3 font-display text-3xl text-slate-900 sm:text-4xl">
            Semua template undangan
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Berikut {TEMPLATES.length} desain yang tersedia. Setiap contoh diambil
            langsung dari halaman undangan aslinya, jadi yang kamu lihat persis
            seperti yang akan diterima tamu.
          </p>
        </div>

        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((template) => (
            <li key={template.name} className="group">
              <button
                type="button"
                onClick={() => setPreview(template.name)}
                aria-label={`Lihat contoh template ${template.label}`}
                className="block w-full overflow-hidden rounded-2xl border border-rose-100 bg-white p-2.5 text-left shadow-sm transition hover:-translate-y-1 hover:border-rose-200 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
              >
                <TemplatePhoto
                  template={template}
                  className="aspect-[4/5] w-full rounded-xl ring-1 ring-rose-100/80"
                />
                <span className="block px-1.5 pt-3 pb-1">
                  <span className="block font-display text-lg text-slate-900">
                    {template.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {template.description}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-14 rounded-2xl border border-rose-100 bg-white p-6 sm:p-8">
          <h2 className="font-display text-2xl text-slate-900">
            Semua desain, fitur yang sama
          </h2>
          <p className="mt-3 text-base leading-7 text-slate-600">
            RSVP, buku ucapan, galeri foto, cerita, kirim hadiah, dan tautan
            WhatsApp ada di setiap template. Ganti desain kapan saja tanpa biaya
            tambahan.
          </p>
          <Link
            to="/register"
            className="mt-6 inline-flex items-center rounded-xl bg-rose-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
          >
            Buat undangan sekarang
            <span aria-hidden="true" className="ml-1.5">
              &rarr;
            </span>
          </Link>
        </div>
      </div>
    </main>
  )
}
