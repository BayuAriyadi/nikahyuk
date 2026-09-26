import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../context/ToastContext.jsx'
import { invitationsApi } from '../lib/api.js'
import { preparePhoto } from '../lib/image.js'
import {
  buildInvitationPayload,
  buildUpdatePayload,
  emptyInvitationForm,
  mapServerErrors,
  templateByName,
  validateCoupleForm,
  validateEditForm,
} from '../lib/invitationPayload.js'
import Icon from '../components/Icon.jsx'
import TemplateCard from '../components/templates/TemplateCard.jsx'
import { TEMPLATES } from '../lib/invitationPayload.js'
import TemplatePreviewModal from '../components/templates/TemplatePreviewModal.jsx'
import InvitationPreview from '../components/templates/InvitationPreview.jsx'
import PublishModal from '../components/invitations/PublishModal.jsx'
import { Alert, Field, SubmitButton, TextArea } from '../components/form.jsx'

const MAX_GALLERY = 30
const MAX_GIFT_ROWS = 3
const MAX_STORY_ROWS = 10

const STEP_TITLES = ['Pilih Template', 'Data Mempelai', 'Detail Acara', 'Foto & Cerita', 'Pratinjau & Terbit']

const MAX_MUSIC_BYTES = 2 * 1024 * 1024

/**
 * Wizard ini halaman (punya URL sendiri), jadi refresh atau tidak sengaja
 * menutup tab tidak boleh membuang isian. Progres disimpan di sessionStorage
 * (per tab, hilang saat tab ditutup) supaya tidak ada dua draft untuk
 * undangan yang sama.
 */
const DRAFT_KEY = 'nikahyuk.wizard.draft'

function loadSavedDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * Halaman wizard "Buat Undangan Baru" (/dashboard/undangan/baru): lima
 * langkah, yaitu memilih template, mengisi data mempelai, detail acara,
 * foto & cerita, lalu pratinjau dan terbit (bayar via QRIS).
 *
 * Sengaja berupa halaman, bukan modal: pilihan template tumbuh seiring
 * bertambahnya desain, dan galeri yang panjang lebih nyaman digulir di
 * halaman penuh. Halaman ini juga jadi tempat langkah-langkah berikutnya
 * (mis. banyak foto) tumbuh tanpa mentok tinggi modal.
 *
 * Draft baru dibuat di akhir langkah 2 (satu POST), lalu langkah 3-4
 * memperbaruinya dengan PATCH yang sama seperti modal Edit Undangan supaya
 * aturan "null menghapus field" tetap berlaku. Langkah foto baru bisa
 * menunggah setelah draft punya id.
 */
export default function InvitationWizard() {
  const toast = useToast()
  const navigate = useNavigate()
  const saved = useRef(loadSavedDraft()).current
  const [step, setStep] = useState(saved?.step ?? 0)
  const [templateName, setTemplateName] = useState(
    () => saved?.templateName ?? emptyInvitationForm().templateName,
  )
  const [previewTemplate, setPreviewTemplate] = useState(null)
  const [form, setForm] = useState(() => ({
    ...emptyInvitationForm(),
    ...(saved?.form ?? {}),
  }))
  const [invitation, setInvitation] = useState(saved?.invitation ?? null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [uploads, setUploads] = useState([])
  const [personUploads, setPersonUploads] = useState({ groomPhoto: false, bridePhoto: false })
  const [uploadError, setUploadError] = useState(null)
  const [musicError, setMusicError] = useState(null)
  const [musicUploading, setMusicUploading] = useState(false)
  const galleryInput = useRef(null)
  const groomPhotoInput = useRef(null)
  const bridePhotoInput = useRef(null)
  const musicInput = useRef(null)

  const gallery = form.gallery ?? []
  const isUploading =
    uploads.some((item) => item.status === 'uploading') ||
    personUploads.groomPhoto ||
    personUploads.bridePhoto

  /** Kembali ke daftar undangan. Draft yang sudah dibuat tetap tersimpan. */
  function goToList() {
    clearSavedDraft()
    navigate('/dashboard/undangan')
  }

  /**
   * Simpan progres ke sessionStorage setiap kali berubah, supaya refresh di
   * tengah alur tidak mengulang dari langkah 1 (dan tidak membuat draft kedua).
   */
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ step, templateName, form, invitation }))
    } catch {
      // Kuota penuh / storage dimatikan: abaikan, ini hanya untuk kenyamanan.
    }
  }, [step, templateName, form, invitation])

  function clearSavedDraft() {
    try {
      sessionStorage.removeItem(DRAFT_KEY)
    } catch {
      // abaikan
    }
  }

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
    }
  }

  /** Terapkan perubahan form ke draft yang sudah ada (PATCH). */
  async function saveDraft(nextForm = form) {
    await invitationsApi.update(invitation.id, buildUpdatePayload(nextForm))
  }

  function applyErrors(error) {
    const { fieldErrors: mapped, leftovers } = mapServerErrors(error.errors)
    setFieldErrors(mapped)
    setFormError(leftovers.length > 0 ? leftovers.join(' ') : null)
    return mapped
  }

  /** Lanjut dari langkah Data Mempelai: draft pertama dibuat di sini (POST). */
  async function submitStepCouple() {
    setFieldErrors({})
    setFormError(null)
    const nextForm = { ...form, templateName }
    const errors = validateCoupleForm(nextForm)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      toast.error('Masih ada isian yang belum lengkap.')
      return
    }

    // Sudah ada draft (mis. user mundur lalu maju lagi): jangan buat dua kali.
    if (invitation) {
      await submitStepEdit(2, nextForm)
      return
    }

    setBusy(true)
    try {
      const created = await invitationsApi.create(buildInvitationPayload(nextForm))
      setForm(nextForm)
      setInvitation(created?.data ?? null)
      toast.success(`Undangan "${created?.data?.slug}" berhasil dibuat.`)
      setStep(2)
    } catch (error) {
      applyErrors(error)
      toast.error(error.errors ? 'Validasi gagal. Periksa kembali isian form.' : error.message)
    } finally {
      setBusy(false)
    }
  }

  /* ---------- langkah 3-5: simpan perubahan ke draft ---------- */

  async function submitStepEdit(nextStep, nextForm = form) {
    setFormError(null)
    const errors = validateEditForm(nextForm)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      toast.error(errors.story ?? errors.gifts ?? 'Periksa kembali isian form.')
      return false
    }

    setBusy(true)
    try {
      await saveDraft(nextForm)
      setStep(nextStep)
      return true
    } catch (error) {
      applyErrors(error)
      toast.error(error.errors ? 'Validasi gagal. Periksa kembali isian form.' : error.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  /** Undangan tanpa tanggal + tempat acara tidak bisa terbit: cover dan
   * countdown-nya akan kosong. Arahkan user kembali ke langkah Detail Acara. */
  function hasEventDetail() {
    return Boolean(
      (form.akadDate && form.akadVenue) || (form.resepsiDate && form.resepsiVenue),
    )
  }

  async function handlePublish() {
    if (!hasEventDetail()) {
      toast.error('Isi tanggal dan tempat minimal satu acara dulu ya.')
      setStep(2)
      return
    }

    if (await submitStepEdit(4)) {
      setPublishing(true)
    }
  }

  /* ---------- unggahan foto, musik ---------- */

  async function handleFiles(event) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0 || !invitation) return

    setUploadError(null)
    const room = MAX_GALLERY - gallery.length - uploads.filter((i) => i.status !== 'error').length

    for (const [index, file] of files.entries()) {
      if (index >= room) {
        setUploadError(`Maksimal ${MAX_GALLERY} foto per undangan.`)
        break
      }

      const id = `${Date.now()}-${index}-${file.name}`
      setUploads((prev) => [...prev, { id, name: file.name, status: 'uploading' }])

      try {
        const prepared = await preparePhoto(file)
        const response = await invitationsApi.uploadPhoto(invitation.id, prepared)
        const url = response?.data?.url
        if (!url) throw new Error('Server tidak mengembalikan URL foto.')

        setForm((prev) => ({ ...prev, gallery: [...(prev.gallery ?? []), url] }))
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

  async function handlePersonPhoto(side, event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !invitation) return

    setUploadError(null)
    setPersonUploads((prev) => ({ ...prev, [side]: true }))
    try {
      const prepared = await preparePhoto(file)
      const response = await invitationsApi.uploadPhoto(invitation.id, prepared)
      const url = response?.data?.url
      if (!url) throw new Error('Server tidak mengembalikan URL foto.')

      setForm((prev) => ({ ...prev, [side]: url }))
      setFieldErrors((prev) => ({ ...prev, [side]: undefined }))
    } catch (error) {
      const label = side === 'groomPhoto' ? 'mempelai pria' : 'mempelai wanita'
      setUploadError(`Foto ${label} gagal diunggah: ${error.message}`)
    } finally {
      setPersonUploads((prev) => ({ ...prev, [side]: false }))
    }
  }

  async function handleMusicFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !invitation) return

    if (file.size > MAX_MUSIC_BYTES) {
      setMusicError('Berkas musik maksimal 2 MB. Kompres dulu atau pilih lagu yang lebih pendek.')
      return
    }

    setMusicError(null)
    setMusicUploading(true)
    try {
      const response = await invitationsApi.uploadMusic(invitation.id, file)
      const url = response?.data?.url
      if (!url) throw new Error('Server tidak mengembalikan URL musik.')
      setForm((prev) => ({ ...prev, musicUrl: url }))
    } catch (error) {
      setMusicError(`Musik gagal diunggah: ${error.message}`)
    } finally {
      setMusicUploading(false)
    }
  }

  function setCover(url) {
    setForm((prev) => ({ ...prev, coverPhoto: prev.coverPhoto === url ? '' : url }))
  }

  function removePhoto(url) {
    setForm((prev) => ({
      ...prev,
      gallery: (prev.gallery ?? []).filter((item) => item !== url),
      coverPhoto: prev.coverPhoto === url ? '' : prev.coverPhoto,
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
    setForm((prev) => ({ ...prev, story: prev.story.filter((_, position) => position !== index) }))
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
    setForm((prev) => ({ ...prev, gifts: prev.gifts.filter((_, position) => position !== index) }))
  }

  /* ---------- render ---------- */

  return (
    <>
      <section>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Buat Undangan Baru</h1>
            <p className="mt-1 text-sm text-slate-500">
              Langkah {step + 1} dari {STEP_TITLES.length}: {STEP_TITLES[step]}
            </p>
          </div>
        </header>

        <StepBar step={step} />

        <div className="mt-4 space-y-4 pb-24">
          {step === 0 && (
            <>
              <p className="text-sm text-slate-600">
                Pilih tampilan undangan kalian. Warna, bentuk kartu, dan susunan bagiannya
                mengikuti template ini, dan masih bisa diganti kapan saja lewat Edit Undangan.
              </p>
              <div
                role="radiogroup"
                aria-label="Pilih template undangan"
                className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              >
                {TEMPLATES.map((template) => (
                  <TemplateCard
                    key={template.name}
                    template={template}
                    selected={templateName === template.name}
                    onSelect={() => setTemplateName(template.name)}
                    onPreview={() => setPreviewTemplate(template.name)}
                  />
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <p className="text-sm text-slate-600">
                Data mempelai dipakai di cover dan bagian kedua mempelai. Nama lengkap wajib,
                sisanya bisa dilengkapi di langkah berikutnya atau lewat Edit Undangan.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Nama Mempelai Pria"
                  name="groomName"
                  value={form.groomName}
                  onChange={handleChange('groomName')}
                  error={fieldErrors.groomName}
                  placeholder="cth: Andi Pratama"
                  autoComplete="off"
                />
                <Field
                  label="Nama Mempelai Wanita"
                  name="brideName"
                  value={form.brideName}
                  onChange={handleChange('brideName')}
                  error={fieldErrors.brideName}
                  placeholder="cth: Sari Dewi"
                  autoComplete="off"
                />
                <Field
                  label="Nama Panggilan Pria (opsional)"
                  name="groomNick"
                  value={form.groomNick}
                  onChange={handleChange('groomNick')}
                  error={fieldErrors.groomNick}
                  placeholder="cth: Andi"
                  autoComplete="off"
                />
                <Field
                  label="Nama Panggilan Wanita (opsional)"
                  name="brideNick"
                  value={form.brideNick}
                  onChange={handleChange('brideNick')}
                  error={fieldErrors.brideNick}
                  placeholder="cth: Sari"
                  autoComplete="off"
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm text-slate-600">
                Isi rangkaian acara. Kosongkan akad kalau hanya ada resepsi. Tanggal dan tempat
                akad wajib diisi kalau bagiannya dinyalakan.
              </p>
              <Section title="Akad Nikah">
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
              </Section>
            </>
          )}

          {step === 3 && (
            <>
              <Section
                title="Foto & Galeri"
                description={`Foto otomatis diperkecil sebelum diunggah (maksimal ${MAX_GALLERY} foto). Tandai satu foto sebagai cover.`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => galleryInput.current?.click()}
                    disabled={isUploading || gallery.length + uploads.length >= MAX_GALLERY}
                    className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Icon name="image" className="h-4 w-4" />
                    {isUploading ? 'Mengunggah…' : 'Tambah foto'}
                  </button>
                  <span className="text-xs text-slate-500">
                    {gallery.length} dari {MAX_GALLERY} foto
                  </span>
                  <input
                    ref={galleryInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="sr-only"
                    onChange={handleFiles}
                  />
                </div>

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
                              className="rounded-md p-1 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                            >
                              <Icon name="star" filled={isCover} className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removePhoto(url)}
                              aria-label={`Hapus foto ${index + 1}`}
                              className="rounded-md p-1 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                            >
                              <Icon name="trash" className="h-4 w-4" />
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

                <div className="grid gap-3 sm:grid-cols-2">
                  <PersonPhoto
                    label="Foto mempelai pria"
                    initial={initialOf(form.groomName || form.groomNick)}
                    photo={form.groomPhoto}
                    uploading={personUploads.groomPhoto}
                    inputRef={groomPhotoInput}
                    onChange={(event) => handlePersonPhoto('groomPhoto', event)}
                    onClear={() => setForm((prev) => ({ ...prev, groomPhoto: '' }))}
                  />
                  <PersonPhoto
                    label="Foto mempelai wanita"
                    initial={initialOf(form.brideName || form.brideNick)}
                    photo={form.bridePhoto}
                    uploading={personUploads.bridePhoto}
                    inputRef={bridePhotoInput}
                    onChange={(event) => handlePersonPhoto('bridePhoto', event)}
                    onClear={() => setForm((prev) => ({ ...prev, bridePhoto: '' }))}
                  />
                </div>

                {uploadError && <Alert>{uploadError}</Alert>}
                {fieldErrors.gallery && <Alert>{fieldErrors.gallery}</Alert>}
                {fieldErrors.groomPhoto && <Alert>{fieldErrors.groomPhoto}</Alert>}
                {fieldErrors.bridePhoto && <Alert>{fieldErrors.bridePhoto}</Alert>}
              </Section>

              <Section
                title="Cerita Kita"
                description="Timeline perjalanan hubungan kalian di halaman tamu. Kosongkan kalau tidak ingin ditampilkan."
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
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        >
                          <Icon name="trash" className="h-4 w-4" />
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
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      + Tambah cerita
                    </button>
                  )}
                </div>
              </Section>

              <Section
                title="Musik Latar"
                description="Lagu diputar saat tamu menekan Buka Undangan, dan bisa dimatikan lewat tombol speaker."
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
                        disabled={musicUploading}
                        className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Icon name="music" className="h-4 w-4" />
                        {musicUploading ? 'Mengunggah…' : form.musicUrl ? 'Ganti musik' : 'Pilih musik'}
                      </button>
                      <input
                        ref={musicInput}
                        type="file"
                        accept="audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/mp4,audio/aac"
                        className="sr-only"
                        onChange={handleMusicFile}
                      />
                      <span className="text-xs text-slate-500">MP3/OGG/WAV/M4A, maksimal 2 MB.</span>
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
            </>
          )}

          {step === 4 && (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <p className="font-semibold text-slate-800">
                  {form.groomName || 'Tanpa nama'} &amp; {form.brideName || 'Tanpa nama'}
                </p>
                <p className="mt-1 text-slate-600">
                  Template {templateByName(templateName).label} · {gallery.length} foto ·{' '}
                  {templateByName(templateName).description}
                </p>
                {invitation?.slug && (
                  <p className="mt-1 text-xs text-slate-500">
                    Alamat undangan nanti: /{invitation.slug} (aktif setelah pembayaran)
                  </p>
                )}
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="max-h-[70vh] overflow-y-auto">
                  <InvitationPreview
                    className="ny-preview"
                    data={{
                      template_name: templateName,
                      bride_data: {
                        groom: { name: form.groomName, nick: form.groomNick, photo: form.groomPhoto },
                        bride: { name: form.brideName, nick: form.brideNick, photo: form.bridePhoto },
                        story: (form.story ?? []).filter((row) => row.title && row.text),
                      },
                      event_data: {
                        akad: {
                          date: form.akadDate,
                          time: form.akadTime,
                          venue: form.akadVenue,
                          address: form.akadAddress,
                        },
                        resepsi: {
                          date: form.resepsiDate,
                          time: form.resepsiTime,
                          venue: form.resepsiVenue,
                          address: form.resepsiAddress,
                        },
                      },
                      template_config: {
                        gallery,
                        cover_photo: form.coverPhoto,
                        gift: {
                          enabled: form.giftEnabled,
                          accounts: (form.gifts ?? []).filter(
                            (row) => row.bank && row.number && row.name,
                          ),
                        },
                      },
                    }}
                  />
                </div>
              </div>

              <Section
                title="Kirim Hadiah"
                description="Opsional. Tampil di halaman tamu kalau dinyalakan."
              >
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
                      <div
                        key={index}
                        className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-3"
                      >
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
                              className="mb-0.5 rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                            >
                              <Icon name="trash" className="h-4 w-4" />
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
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        + Tambah rekening
                      </button>
                    )}
                  </div>
                )}
              </Section>
            </>
          )}

          {formError && <Alert>{formError}</Alert>}
        </div>

        <div className="sticky bottom-0 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 py-3 backdrop-blur">
          <button
            type="button"
            onClick={() => (step === 0 ? goToList() : setStep(step - 1))}
            disabled={busy || isUploading}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
          >
            {step === 0 ? 'Batal' : 'Kembali'}
          </button>

          <div className="flex items-center gap-3">
            {step === 3 && (
              <button
                type="button"
                onClick={async () => {
                  if (await submitStepEdit(3)) {
                    toast.success('Perubahan undangan tersimpan.')
                  }
                }}
                disabled={busy || isUploading}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Simpan perubahan
              </button>
            )}

            {step < 4 ? (
              <SubmitButton
                type="button"
                submitting={busy}
                className="w-auto px-5"
                onClick={
                  step === 0 ? () => setStep(1) : step === 1 ? submitStepCouple : () => submitStepEdit(step + 1)
                }
              >
                {step === 0 ? 'Pilih & Lanjut' : step === 3 ? 'Lanjut ke Pratinjau' : 'Lanjut'}
              </SubmitButton>
            ) : (
              <button
                type="button"
                onClick={handlePublish}
                disabled={busy || isUploading}
                className="rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                Terbitkan &amp; Bayar
              </button>
            )}
          </div>
        </div>
      </section>

      {previewTemplate && (
        <TemplatePreviewModal
          templateName={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
        />
      )}

      {publishing && invitation && (
        <PublishModal
          invitation={invitation}
          onClose={() => setPublishing(false)}
          onPaid={goToList}
        />
      )}
    </>
  )
}

function StepBar({ step }) {
  return (
    <ol className="mb-4 flex items-center gap-2" aria-label="Langkah pembuatan undangan">
      {STEP_TITLES.map((title, index) => {
        const done = index < step
        const active = index === step
        return (
          <li key={title} className="flex flex-1 flex-col gap-1.5">
            <span
              aria-hidden="true"
              className={`h-1 rounded-full ${
                done ? 'bg-rose-400' : active ? 'bg-rose-600' : 'bg-slate-200'
              }`}
            />
            <span
              className={`hidden text-[11px] leading-4 font-medium sm:block ${
                active ? 'text-rose-700' : 'text-slate-500'
              }`}
            >
              {title}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function Section({ title, description, children }) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 p-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function PersonPhoto({ label, initial, photo, uploading, inputRef, onChange, onClear }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      {photo ? (
        <img
          src={photo}
          alt={label}
          className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-rose-200"
        />
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-rose-50 font-display text-lg italic text-rose-600 ring-1 ring-rose-200/80">
          {initial}
        </span>
      )}
      <div className="min-w-0 space-y-1.5">
        <p className="text-xs text-slate-600">{label} tampil bulat di bagian Kedua Mempelai.</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:opacity-60"
          >
            <Icon name="image" className="h-3.5 w-3.5" />
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

function initialOf(value) {
  const text = String(value ?? '').trim()
  return text ? text[0].toUpperCase() : '?'
}
