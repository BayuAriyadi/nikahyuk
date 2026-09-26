import { useState } from 'react'
import Icon from '../Icon.jsx'
import { copyText } from '../../lib/clipboard.js'
import { invitationUrl, whatsappShareUrl, canNativeShare } from '../../lib/share.js'

/*
 * Blok "Tautan undangan" di kartu Undangan Saya.
 *
 * - Draft: tautan belum hidup (halaman publik 404), jadi hanya tampil petunjuk.
 * - Terbit: URL penuh yang bisa diklik + tombol Salin, WhatsApp, dan tombol
 *   Bagikan bawaan HP kalau browser mendukung Web Share API.
 * - Umpan balik salin memakai aria-live supaya pembaca layar ikut dengar.
 */
export default function InvitationShare({ slug, status, groom, bride }) {
  const [copyState, setCopyState] = useState('idle')
  const [supportNativeShare] = useState(canNativeShare)

  if (!slug) return null

  if (status !== 'published') {
    return (
      <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3.5 py-3 text-xs leading-5 text-slate-500">
        Tautan undangan aktif setelah undangan terbit. Klik{' '}
        <span className="font-semibold text-slate-700">Publish</span> dulu untuk membagikannya
        ke tamu.
      </p>
    )
  }

  const url = invitationUrl(slug)

  async function handleCopy() {
    try {
      await copyText(url)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
    window.setTimeout(() => setCopyState('idle'), 2500)
  }

  async function handleNativeShare() {
    try {
      await navigator.share({
        title: `Undangan ${groom} & ${bride}`,
        text: `Undangan pernikahan ${groom} & ${bride}`,
        url,
      })
    } catch {
      // Batal membagikan bukan error; biarkan tombol apa adanya.
    }
  }

  const copyLabels = { idle: 'Salin tautan', copied: 'Tautan tersalin', failed: 'Gagal menyalin' }

  return (
    <div className="mt-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <Icon name="link" className="h-3.5 w-3.5 text-slate-400" />
        Tautan undangan
      </p>
      <a
        href={`/${slug}`}
        target="_blank"
        rel="noopener noreferrer"
        title="Buka halaman undangan di tab baru"
        className="mt-1.5 block truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs leading-5 text-slate-600 underline-offset-2 transition hover:border-rose-200 hover:text-rose-700 hover:underline"
      >
        {url}
      </a>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          aria-live="polite"
          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          <Icon name={copyState === 'copied' ? 'check' : 'copy'} className="h-3.5 w-3.5" />
          {copyLabels[copyState]}
        </button>

        <a
          href={whatsappShareUrl({ url, groom, bride })}
          target="_blank"
          rel="noopener noreferrer"
          title="Buka WhatsApp dengan teks undangan siap kirim"
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <Icon name="whatsapp" className="h-3.5 w-3.5" />
          WhatsApp
        </a>

        {supportNativeShare && (
          <button
            type="button"
            onClick={handleNativeShare}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <Icon name="share" className="h-3.5 w-3.5" />
            Bagikan
          </button>
        )}
      </div>

      {copyState === 'failed' && (
        <p className="mt-2 text-xs leading-5 text-amber-700">
          Browser menolak menyalin otomatis. Tekan lama tautan di atas lalu pilih Salin.
        </p>
      )}
    </div>
  )
}
