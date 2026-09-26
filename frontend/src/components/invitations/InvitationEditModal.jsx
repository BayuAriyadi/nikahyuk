import { useRef, useState } from 'react'
import { useToast } from '../../context/ToastContext.jsx'
import { invitationsApi } from '../../lib/api.js'
import { preparePhoto } from '../../lib/image.js'
import {
  buildUpdatePayload,
  invitationToEditForm,
  mapServerErrors,
  validateEditForm,
} from '../../lib/invitationPayload.js'
import Modal from '../Modal.jsx'
import Icon from '../Icon.jsx'
import TemplatePicker from './TemplatePicker.jsx'
import { Alert, Field, SubmitButton, TextArea } from '../form.jsx'

const MAX_GALLERY = 30
const MAX_GIFT_ROWS = 3
const MAX_STORY_ROWS = 10

/**
 * Modal "Edit Undangan": melengkapi data mempelai (termasuk orang tua,
 * Instagram, dan foto profil), akad/resepsi terpisah (dengan link peta),
 * galeri foto + cover, cerita perjalanan cinta, musik latar, dan rekening
 * untuk bagian "Kirim Hadiah" di halaman tamu.
 *
 * Foto dikompres dulu di browser (lihat lib/image.js) karena php.ini server
 * membatasi 2 MB per file. Upload menghasilkan URL, lalu URL itu ikut tersimpan
 * saat tombol "Simpan Perubahan" ditekan (satu PATCH berisi seluruh form).
 */
export default function InvitationEditModal({ invitation, onClose, onUpdated }) {
  const toast = useToast()
  const [form, setForm] = useState(() => invitationToEditForm(invitation))
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploads, setUploads] = useState([])
  const [photoError, setPhotoError] = useState(null)
  const [photoTouched, setPhotoTouched] = useState(false)
  const [personUploads, setPersonUploads] = useState({ groomPhoto: false, bridePhoto: false })
  const [musicError, setMusicError] = useState(null)
  const [isUploadingMusic, setIsUploadingMusic] = useState(false)
  const fileInput = useRef(null)
  const groomPhotoInput = useRef(null)
  const bridePhotoInput = useRef(null)
  const musicInput = useRef(null)

  const gallery = form.gallery ?? []
  const isUploading =
    uploads.some((item) => item.status === 'uploading') ||
    personUploads.groomPhoto ||
    personUploads.bridePhoto
  const uploadFailed = uploads.some((item) => item.status === 'error')

  const coverPreview = form.coverPhoto || gallery[0] || ''

  function handleChange(field) {
    return (event) => {
      const { value } = event.target
      setForm((prev) => ({ ...prev, [field]: value }))
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  function handleToggle(field) {
    return (event) => {
      const { checked } = event.target
      setForm((prev) => ({ ...prev, [field]: checked }))
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  function setTemplate(name) {
    setForm((prev) => ({ ...prev, templateName: name }))
  }

  function updateGift(index, cell) {
    return (event) => {
      const { value } = event.target
      setForm((prev) => ({
        ...prev,
        gifts: prev.gifts.map((row, position) =>
          position === index ? { ...row, [cell]: value } : row,
        ),
      }))
      setFieldErrors((prev) => ({ ...prev, gifts: undefined }))
    }
  }

  function addGiftRow() {
    setForm((prev) =>
      prev.gifts.length >= MAX_GIFT_ROWS
        ? prev
        : { ...prev, gifts: [...prev.gifts, { bank: '', number: '', name: '' }] },
    )
  }

  function removeGiftRow(index) {
    setForm((prev) => ({
      ...prev,
      gifts: prev.gifts.filter((_, position) => position !== index),
    }))
  }

  function updateStory(index, cell) {
    return (event) => {
      const { value } = event.target
      setForm((prev) => ({
        ...prev,
        story: prev.story.map((row, position) =>
          position === index ? { ...row, [cell]: value } : row,
        ),
      }))
      setFieldErrors((prev) => ({ ...prev, story: undefined }))
    }
  }

  function addStoryRow() {
    setForm((prev) =>
      prev.story.length >= MAX_STORY_ROWS
        ? prev
        : { ...prev, story: [...prev.story, { title: '', date: '', text: '' }] },
    )
  }

  function removeStoryRow(index) {
    setForm((prev) => ({
      ...prev,
      story: prev.story.filter((_, position) => position !== index),
    }))
  }

  async function handleFiles(event) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) {
      return
    }

    setPhotoError(null)

    const remaining = MAX_GALLERY - gallery.length - uploads.length

    for (const [index, file] of files.entries()) {
      if (index >= remaining) {
        setPhotoError(`Maksimal ${MAX_GALLERY} foto per undangan.`)
        break
      }

      const id = `${Date.now()}-${index}-${file.name}`
      setUploads((prev) => [...prev, { id, name: file.name, status: 'uploading' }])

      try {
        const prepared = await preparePhoto(file)
        const response = await invitationsApi.uploadPhoto(invitation.id, prepared)
        const url = response?.data?.url

        if (!url) {
          throw new Error('Server tidak mengembalikan URL foto.')
        }

        setForm((prev) => ({ ...prev, gallery: [...(prev.gallery ?? []), url] }))
        setPhotoTouched(true)
        setUploads((prev) => prev.filter((item) => item.id !== id))
      } catch (error) {
        setUploads((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, status: 'error', message: error.message } : item,
          ),
        )
      }
    }
  }

  function setCover(url) {
    setForm((prev) => ({ ...prev, coverPhoto: prev.coverPhoto === url ? '' : url }))
    setPhotoTouched(true)
  }

  function removePhoto(url) {
    setForm((prev) => ({
      ...prev,
      gallery: (prev.gallery ?? []).filter((item) => item !== url),
      coverPhoto: prev.coverPhoto === url ? '' : prev.coverPhoto,
    }))
    setPhotoTouched(true)
  }

  function setPersonPhoto(side, url) {
    setForm((prev) => ({ ...prev, [side]: url }))
    setPhotoTouched(true)
    setFieldErrors((prev) => ({ ...prev, [side]: undefined }))
  }

  // Foto profil mempelai: satu file, langsung diunggah saat dipilih (pakai
  // jalur upload yang sama dengan galeri). Side = nama field form.
  async function handlePersonPhoto(side, event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setPhotoError(null)
    setPersonUploads((prev) => ({ ...prev, [side]: true }))

    try {
      const prepared = await preparePhoto(file)
      const response = await invitationsApi.uploadPhoto(invitation.id, prepared)
      const url = response?.data?.url

      if (!url) {
        throw new Error('Server tidak mengembalikan URL foto.')
      }

      setPersonPhoto(side, url)
    } catch (error) {
      const label = side === 'groomPhoto' ? 'mempelai pria' : 'mempelai wanita'
      setPhotoError(`Foto ${label} gagal diunggah: ${error.message}`)
    } finally {
      setPersonUploads((prev) => ({ ...prev, [side]: false }))
    }
  }

  function handleClose() {
    if (submitting || isUploading) {
      return
    }
    onClose()
  }

  // Musik: satu file, langsung diunggah saat dipilih (server menaruh di
  // folder music/<slug> dan menghapus berkas lama). URL ikut tersimpan saat
  // Simpan Perubahan ditekan.
  async function handleMusicFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      setMusicError('Berkas musik maksimal 2 MB. Kompres dulu atau pilih lagu yang lebih pendek.')
      return
    }

    setMusicError(null)
    setIsUploadingMusic(true)

    try {
      const response = await invitationsApi.uploadMusic(invitation.id, file)
      const url = response?.data?.url

      if (!url) {
        throw new Error('Server tidak mengembalikan URL musik.')
      }

      setForm((prev) => ({ ...prev, musicUrl: url }))
      toast.success('Musik tersimpan setelah kamu menekan Simpan Perubahan.')
    } catch (error) {
      setMusicError(`Musik gagal diunggah: ${error.message}`)
    } finally {
      setIsUploadingMusic(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError(null)

    const clientErrors = validateEditForm(form)
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors)
      toast.error('Masih ada isian yang belum lengkap.')
      return
    }

    setSubmitting(true)
    try {
      const updated = await invitationsApi.update(invitation.id, buildUpdatePayload(form))
      toast.success('Perubahan undangan tersimpan.')
      onUpdated?.(updated)
      onClose()
    } catch (error) {
      const { fieldErrors: mapped, leftovers } = mapServerErrors(error.errors)
      setFieldErrors(mapped)
      if (leftovers.length > 0) {
        setFormError(leftovers.join(' '))
      }
      toast.error(error.errors ? 'Validasi gagal. Periksa kembali isian form.' : error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={handleClose}
      size="xl"
      title="Edit Undangan"
      subtitle="Lengkapi data mempelai, akad, resepsi, dan foto supaya undangan terasa personal."
    >
      <form onSubmit={handleSubmit} noValidate className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
        <Section
          title="Template Undangan"
          description="Ganti tampilan halaman tamu: warna, bentuk kartu, dan susunan bagiannya ikut berubah."
        >
          <TemplatePicker value={form.templateName} onChange={setTemplate} />
        </Section>

        <Section title="Mempelai Pria">
          <PersonPhotoField
            label="mempelai pria"
            initial={initialOf(form.groomName || form.groomNick)}
            photo={form.groomPhoto}
            uploading={personUploads.groomPhoto}
            inputRef={groomPhotoInput}
            onPick={() => groomPhotoInput.current?.click()}
            onChange={(event) => handlePersonPhoto('groomPhoto', event)}
            onClear={() => setPersonPhoto('groomPhoto', '')}
            error={fieldErrors.groomPhoto}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Nama Lengkap"
              name="groomName"
              value={form.groomName}
              onChange={handleChange('groomName')}
              error={fieldErrors.groomName}
              placeholder="cth: Andi Pratama"
              autoComplete="off"
            />
            <Field
              label="Nama Panggilan"
              name="groomNick"
              value={form.groomNick}
              onChange={handleChange('groomNick')}
              error={fieldErrors.groomNick}
              placeholder="cth: Andi"
              autoComplete="off"
            />
            <Field
              label="Nama Ayah"
              name="groomFather"
              value={form.groomFather}
              onChange={handleChange('groomFather')}
              error={fieldErrors.groomFather}
              placeholder="cth: Bapak Pratama"
              autoComplete="off"
            />
            <Field
              label="Nama Ibu"
              name="groomMother"
              value={form.groomMother}
              onChange={handleChange('groomMother')}
              error={fieldErrors.groomMother}
              placeholder="cth: Ibu Lestari"
              autoComplete="off"
            />
          </div>
          <Field
            label="Instagram (opsional)"
            name="groomInstagram"
            value={form.groomInstagram}
            onChange={handleChange('groomInstagram')}
            error={fieldErrors.groomInstagram}
            placeholder="cth: andipratama"
            autoComplete="off"
          />
        </Section>

        <Section title="Mempelai Wanita">
          <PersonPhotoField
            label="mempelai wanita"
            initial={initialOf(form.brideName || form.brideNick)}
            photo={form.bridePhoto}
            uploading={personUploads.bridePhoto}
            inputRef={bridePhotoInput}
            onPick={() => bridePhotoInput.current?.click()}
            onChange={(event) => handlePersonPhoto('bridePhoto', event)}
            onClear={() => setPersonPhoto('bridePhoto', '')}
            error={fieldErrors.bridePhoto}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Nama Lengkap"
              name="brideName"
              value={form.brideName}
              onChange={handleChange('brideName')}
              error={fieldErrors.brideName}
              placeholder="cth: Sari Dewi"
              autoComplete="off"
            />
            <Field
              label="Nama Panggilan"
              name="brideNick"
              value={form.brideNick}
              onChange={handleChange('brideNick')}
              error={fieldErrors.brideNick}
              placeholder="cth: Sari"
              autoComplete="off"
            />
            <Field
              label="Nama Ayah"
              name="brideFather"
              value={form.brideFather}
              onChange={handleChange('brideFather')}
              error={fieldErrors.brideFather}
              placeholder="cth: Bapak Dewanto"
              autoComplete="off"
            />
            <Field
              label="Nama Ibu"
              name="brideMother"
              value={form.brideMother}
              onChange={handleChange('brideMother')}
              error={fieldErrors.brideMother}
              placeholder="cth: Ibu Ratna"
              autoComplete="off"
            />
          </div>
          <Field
            label="Instagram (opsional)"
            name="brideInstagram"
            value={form.brideInstagram}
            onChange={handleChange('brideInstagram')}
            error={fieldErrors.brideInstagram}
            placeholder="cth: saridewi"
            autoComplete="off"
          />
        </Section>

        <Section title="Akad Nikah" description="Kosongkan kalau undangan hanya memakai satu acara (resepsi).">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Tanggal"
              name="akadDate"
              type="date"
              value={form.akadDate}
              onChange={handleChange('akadDate')}
              error={fieldErrors.akadDate}
            />
            <Field
              label="Waktu"
              name="akadTime"
              type="time"
              value={form.akadTime}
              onChange={handleChange('akadTime')}
              error={fieldErrors.akadTime}
            />
          </div>
          <Field
            label="Tempat"
            name="akadVenue"
            value={form.akadVenue}
            onChange={handleChange('akadVenue')}
            error={fieldErrors.akadVenue}
            placeholder="cth: Masjid Al-Hikmah"
            autoComplete="off"
          />
          <TextArea
            label="Alamat"
            name="akadAddress"
            value={form.akadAddress}
            onChange={handleChange('akadAddress')}
            error={fieldErrors.akadAddress}
            rows={2}
            placeholder="cth: Jl. Melati No. 10, Bandung"
          />
          <Field
            label="Link Google Maps (opsional)"
            name="akadMaps"
            value={form.akadMaps}
            onChange={handleChange('akadMaps')}
            error={fieldErrors.akadMaps}
            placeholder="cth: https://maps.app.goo.gl/xxxx"
            autoComplete="off"
          />
        </Section>

        <Section title="Resepsi">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Tanggal"
              name="resepsiDate"
              type="date"
              value={form.resepsiDate}
              onChange={handleChange('resepsiDate')}
              error={fieldErrors.resepsiDate}
            />
            <Field
              label="Waktu"
              name="resepsiTime"
              type="time"
              value={form.resepsiTime}
              onChange={handleChange('resepsiTime')}
              error={fieldErrors.resepsiTime}
            />
          </div>
          <Field
            label="Tempat"
            name="resepsiVenue"
            value={form.resepsiVenue}
            onChange={handleChange('resepsiVenue')}
            error={fieldErrors.resepsiVenue}
            placeholder="cth: Gedung Graha Indah"
            autoComplete="off"
          />
          <TextArea
            label="Alamat"
            name="resepsiAddress"
            value={form.resepsiAddress}
            onChange={handleChange('resepsiAddress')}
            error={fieldErrors.resepsiAddress}
            rows={2}
            placeholder="cth: Jl. Anggrek No. 5, Bandung"
          />
          <Field
            label="Link Google Maps (opsional)"
            name="resepsiMaps"
            value={form.resepsiMaps}
            onChange={handleChange('resepsiMaps')}
            error={fieldErrors.resepsiMaps}
            placeholder="cth: https://maps.app.goo.gl/xxxx"
            autoComplete="off"
          />
        </Section>

        <Section
          title="Foto & Galeri"
          description={`Foto otomatis diperkecil sebelum diunggah. Maksimal ${MAX_GALLERY} foto, tampil sebagai galeri di halaman tamu.`}
        >
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={isUploading || gallery.length + uploads.length >= MAX_GALLERY}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ImageIcon />
              {isUploading ? 'Mengunggah…' : 'Tambah foto'}
            </button>
            <span className="text-xs text-slate-500">
              {gallery.length} dari {MAX_GALLERY} foto
            </span>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={handleFiles}
            />
          </div>

          {coverPreview && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <img
                src={coverPreview}
                alt="Pratinjau foto cover"
                className="h-16 w-16 rounded-lg object-cover"
              />
              <p className="text-xs text-slate-600">
                Foto ini dipakai sebagai cover halaman undangan. Klik ikon bintang di foto
                lain untuk menggantinya.
              </p>
            </div>
          )}

          {gallery.length > 0 && (
            <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {gallery.map((url, index) => {
                const isCover = form.coverPhoto === url
                return (
                  <li
                    key={url}
                    className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                  >
                    <img
                      src={url}
                      alt={`Foto galeri ${index + 1}`}
                      loading="lazy"
                      className="aspect-[4/5] w-full object-cover"
                    />
                    {isCover && (
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                        Cover
                      </span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-slate-900/65 p-1.5">
                      <button
                        type="button"
                        onClick={() => setCover(url)}
                        aria-label={isCover ? 'Lepas dari cover' : 'Jadikan cover'}
                        title={isCover ? 'Lepas dari cover' : 'Jadikan cover'}
                        className="rounded-md p-1 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      >
                        <StarIcon filled={isCover} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removePhoto(url)}
                        aria-label={`Hapus foto ${index + 1}`}
                        title="Hapus foto"
                        className="rounded-md p-1 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {uploads.length > 0 && (
            <ul className="space-y-1.5">
              {uploads.map((item) => (
                <li key={item.id} className="text-xs">
                  {item.status === 'uploading' ? (
                    <span className="inline-flex items-center gap-2 text-slate-600">
                      <span
                        className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-rose-600"
                        aria-hidden="true"
                      />
                      Mengunggah {item.name}…
                    </span>
                  ) : (
                    <span className="text-red-600">
                      {item.name} gagal diunggah: {item.message}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {photoError && <Alert>{photoError}</Alert>}
          {fieldErrors.gallery && <Alert>{fieldErrors.gallery}</Alert>}

          {photoTouched && !uploadFailed && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-800">
              Perubahan foto ikut tersimpan setelah kamu menekan Simpan Perubahan.
            </p>
          )}
        </Section>

        <Section
          title="Cerita Kita"
          description="Bagian perjalanan hubungan kalian, tampil di halaman tamu urut dari atas ke bawah. Kosongkan kalau tidak ingin ditampilkan."
        >
          <div className="space-y-3">
            {(form.story ?? []).map((row, index) => (
              <div key={index} className="space-y-3 rounded-xl border border-slate-200 p-3">
                <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                  <Field
                    label="Judul"
                    name={`story-title-${index}`}
                    value={row.title}
                    onChange={updateStory(index, 'title')}
                    placeholder="cth: Pertama Bertemu"
                    autoComplete="off"
                  />
                  <Field
                    label="Tanggal / waktu (opsional)"
                    name={`story-date-${index}`}
                    value={row.date}
                    onChange={updateStory(index, 'date')}
                    placeholder="cth: Maret 2019"
                    autoComplete="off"
                  />
                </div>
                <TextArea
                  label="Cerita"
                  name={`story-text-${index}`}
                  value={row.text}
                  onChange={updateStory(index, 'text')}
                  rows={3}
                  placeholder="Tulis momennya di sini, maksimal 1000 karakter."
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeStoryRow(index)}
                    aria-label={`Hapus cerita ${index + 1}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                  >
                    <TrashIcon />
                    Hapus
                  </button>
                </div>
              </div>
            ))}

            {fieldErrors.story && <Alert>{fieldErrors.story}</Alert>}

            {(form.story ?? []).length < MAX_STORY_ROWS && (
              <button
                type="button"
                onClick={addStoryRow}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                + Tambah cerita
              </button>
            )}
            {(form.story ?? []).length === 0 && (
              <p className="text-xs text-slate-500">
                Belum ada cerita. Tambahkan minimal satu kalau ingin bagian ini tampil.
              </p>
            )}
          </div>
        </Section>

        <Section
          title="Musik Latar"
          description="Lagu ini diputar otomatis saat tamu menekan Buka Undangan, dan bisa dimatikan lewat tombol speaker di kanan bawah."
        >
          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={form.musicEnabled}
              onChange={handleToggle('musicEnabled')}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-rose-600 focus:ring-2 focus:ring-rose-500"
            />
            <span className="text-sm text-slate-700">Putar musik di halaman undangan.</span>
          </label>

          {form.musicEnabled && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => musicInput.current?.click()}
                  disabled={isUploadingMusic}
                  className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Icon name="music" className="h-4 w-4" />
                  {isUploadingMusic ? 'Mengunggah…' : form.musicUrl ? 'Ganti musik' : 'Pilih musik'}
                </button>
                <input
                  ref={musicInput}
                  type="file"
                  accept="audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/mp4,audio/aac"
                  className="sr-only"
                  onChange={handleMusicFile}
                />
                <span className="text-xs text-slate-500">
                  MP3/OGG/WAV/M4A, maksimal 2 MB (± 2 menit).
                </span>
              </div>

              {form.musicUrl && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <audio src={form.musicUrl} controls className="h-9 w-full sm:w-72" />
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, musicUrl: '' }))}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  >
                    Hapus musik
                  </button>
                </div>
              )}

              <Field
                label="Judul lagu (opsional)"
                name="musicTitle"
                value={form.musicTitle}
                onChange={handleChange('musicTitle')}
                error={fieldErrors.music}
                placeholder="cth: Beautiful in White"
                autoComplete="off"
              />

              {musicError && <Alert>{musicError}</Alert>}
            </div>
          )}
        </Section>

        <Section title="Kirim Hadiah" description="Tampil di halaman tamu supaya yang ingin memberi hadiah bisa transfer.">
          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={form.giftEnabled}
              onChange={handleToggle('giftEnabled')}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-rose-600 focus:ring-2 focus:ring-rose-500"
            />
            <span className="text-sm text-slate-700">
              Tampilkan bagian Kirim Hadiah di halaman undangan.
            </span>
          </label>

          {form.giftEnabled && (
            <div className="space-y-3">
              {form.gifts.map((row, index) => (
                <div key={index} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-3">
                  <Field
                    label="Bank / E-Wallet"
                    name={`gift-bank-${index}`}
                    value={row.bank}
                    onChange={updateGift(index, 'bank')}
                    placeholder="cth: BCA"
                    autoComplete="off"
                  />
                  <Field
                    label="Nomor Rekening"
                    name={`gift-number-${index}`}
                    value={row.number}
                    onChange={updateGift(index, 'number')}
                    placeholder="cth: 1234567890"
                    autoComplete="off"
                  />
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Field
                        label="Atas Nama"
                        name={`gift-name-${index}`}
                        value={row.name}
                        onChange={updateGift(index, 'name')}
                        placeholder="cth: Andi Pratama"
                        autoComplete="off"
                      />
                    </div>
                    {form.gifts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeGiftRow(index)}
                        aria-label={`Hapus rekening ${index + 1}`}
                        className="mb-0.5 rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {fieldErrors.gifts && <Alert>{fieldErrors.gifts}</Alert>}
              {form.gifts.length < MAX_GIFT_ROWS && (
                <button
                  type="button"
                  onClick={addGiftRow}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  + Tambah rekening
                </button>
              )}
            </div>
          )}
        </Section>

        {formError && <Alert>{formError}</Alert>}

        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-100 bg-white pt-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting || isUploading}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
          >
            Batal
          </button>
          <SubmitButton submitting={submitting} disabled={isUploading} className="w-auto px-5">
            {submitting ? 'Menyimpan…' : 'Simpan Perubahan'}
          </SubmitButton>
        </div>
      </form>
    </Modal>
  )
}

function initialOf(value) {
  const text = String(value ?? '').trim()
  return text ? text[0].toUpperCase() : '?'
}

/**
 * Pemilih foto profil mempelai: pratinjau bulat + tombol pilih/ganti/hapus.
 * Foto diunggah lewat endpoint galeri yang sama (file masuk folder undangan),
 * tapi URL-nya disimpan di bride_data.<person>.photo, bukan daftar galeri.
 */
function PersonPhotoField({ label, initial, photo, uploading, inputRef, onPick, onChange, onClear, error }) {
  return (
    <div className="flex items-start gap-3.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      {photo ? (
        <img
          src={photo}
          alt={`Foto profil ${label}`}
          className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-rose-200"
        />
      ) : (
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-rose-50 font-display text-xl italic text-rose-600 ring-1 ring-rose-200/80">
          {initial}
        </span>
      )}
      <div className="min-w-0 space-y-1.5">
        <p className="text-xs text-slate-600">
          Foto profil {label} tampil bulat di bagian "Kedua Mempelai". Tidak ikut hitungan galeri.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onPick}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CameraIcon />
            {uploading ? 'Mengunggah…' : photo ? 'Ganti foto' : 'Pilih foto'}
          </button>
          {photo && (
            <button
              type="button"
              onClick={onClear}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Hapus
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={onChange}
        />
      </div>
    </div>
  )
}

function Section({ title, description, children }) {
  return (
    <section className="space-y-3 border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden="true">
      <rect x="2.75" y="3.75" width="14.5" height="12.5" rx="2.5" />
      <circle cx="7.25" cy="8" r="1.25" />
      <path d="M3.5 14.5l4-4 3 3 2.5-2.5 3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function StarIcon({ filled }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M10 3.5l1.9 3.9 4.3.6-3.1 3 .74 4.3L10 13.3l-3.84 2-.74-4.3 3.1-3-4.3-.6z"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden="true">
      <path d="M4.5 6.5h11M8 6.5V5a1 1 0 011-1h2a1 1 0 011 1v1.5M6 6.5l.7 8.1a1 1 0 001 .9h4.6a1 1 0 001-.9l.7-8.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M3.25 6.75A1.5 1.5 0 014.75 5.25h1.5l.8-1.35a1 1 0 01.85-.48h4.2a1 1 0 01.85.48l.8 1.35h1.5a1.5 1.5 0 011.5 1.5v7A1.5 1.5 0 0115.25 15.25h-10.5a1.5 1.5 0 01-1.5-1.5z" strokeLinejoin="round" />
      <circle cx="10" cy="10.25" r="3" />
    </svg>
  )
}
