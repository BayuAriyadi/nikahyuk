/**
 * Pemetaan form undangan <-> payload API.
 *
 * Struktur JSONB yang dihasilkan harus cocok dengan whitelist backend
 * (app/Support/JsonbPayload.php). Key di luar daftar itu dibuang server, jadi
 * form tidak boleh mengirim key asing.
 *
 *   bride_data: { groom: { name, nick, father, mother, instagram, photo }, bride: {...} }
 *   event_data: { akad: {...}, resepsi: { date, time, venue, address, maps_url } }
 *   template_config: { gallery: [url], cover_photo, gift: { enabled, accounts[] } }
 *
 * Aturan server saat update (PATCH):
 * - JSONB di-deep-merge: key yang tidak dikirim tidak tersentuh.
 * - Kirim null (atau kosongkan input, yang jadi null di server) untuk
 *   MENGHAPUS sebuah field opsional.
 * - Kirim list kosong [] untuk mengosongkan gallery.
 *
 * Key error validasi 422 (dotted) dipetakan ke field form lewat
 * SERVER_ERROR_TO_FIELD + SERVER_ERROR_PREFIXES.
 */

// Katalog template undangan. `name` harus cocok dengan blok [data-template=...]
// di src/templates.css dan nilai `template_name` yang diterima backend.
//
// - reveal: varian animasi muncul-saat-discroll (lihat lib/useReveal.js)
// - order:  urutan section halaman tamu; tiap template menyusun ulang
//           section yang sama, jadi layout tidak cuma beda warna.
export const TEMPLATES = [
  {
    name: 'klasik',
    label: 'Klasik',
    description: 'Blush rose hangat dengan serif klasik.',
    swatch: ['#fdf2f8', '#fb7185', '#be123c'],
    reveal: 'up',
    order: ['mempelai', 'cerita', 'acara', 'countdown', 'galeri', 'hadiah', 'ucapan'],
  },
  {
    name: 'minimalis',
    label: 'Minimalis',
    description: 'Netral arang, rata kiri, bersih tanpa hiasan.',
    swatch: ['#f8fafc', '#94a3b8', '#334155'],
    reveal: 'zoom',
    order: ['mempelai', 'acara', 'countdown', 'galeri', 'cerita', 'hadiah', 'ucapan'],
  },
  {
    name: 'floral',
    label: 'Floral',
    description: 'Sage hijau lembut bernuansa taman.',
    swatch: ['#f0fdf4', '#86efac', '#15803d'],
    reveal: 'side',
    order: ['mempelai', 'galeri', 'cerita', 'acara', 'countdown', 'hadiah', 'ucapan'],
  },
  {
    name: 'ceria',
    label: 'Ceria',
    description: 'Krem hangat, tulisan tangan, coretan lucu.',
    swatch: ['#fbf6ec', '#c97b65', '#52181c'],
    reveal: 'zoom',
    order: ['mempelai', 'countdown', 'acara', 'galeri', 'cerita', 'hadiah', 'ucapan'],
  },
  {
    name: 'elegan',
    label: 'Elegan',
    description: 'Editorial sinematik: bingkai arch, cover gelap, animasi halus.',
    swatch: ['#f7f4ef', '#a89a86', '#2b2a27'],
    // Template ini tidak memakai susunan section generik: halamannya dirender
    // oleh components/templates/elegant/ElegantSections.jsx dengan animasi
    // GSAP (lihat lib/useInvitationMotion.js). `order` dipertahankan supaya
    // bentuk katalog seragam.
    motion: true,
    reveal: 'up',
    order: ['mempelai', 'acara', 'countdown', 'galeri', 'cerita', 'hadiah', 'ucapan'],
  },
]

export const DEFAULT_TEMPLATE_NAME = TEMPLATES[0].name

/** Data katalog untuk satu nama template; nama asing jatuh ke default. */
export function templateByName(name) {
  return TEMPLATES.find((template) => template.name === name) ?? TEMPLATES[0]
}

/** Label template untuk ditampilkan; nama asing jatuh ke label default. */
export function templateLabel(name) {
  return templateByName(name).label
}

export function emptyInvitationForm() {
  return {
    templateName: DEFAULT_TEMPLATE_NAME,
    groomName: '',
    groomNick: '',
    groomFather: '',
    groomMother: '',
    groomInstagram: '',
    groomPhoto: '',
    brideName: '',
    brideNick: '',
    brideFather: '',
    brideMother: '',
    brideInstagram: '',
    bridePhoto: '',
    akadDate: '',
    akadTime: '',
    akadVenue: '',
    akadAddress: '',
    akadMaps: '',
    resepsiDate: '',
    resepsiTime: '',
    resepsiVenue: '',
    resepsiAddress: '',
    resepsiMaps: '',
    giftEnabled: false,
    gifts: [{ bank: '', number: '', name: '' }],
    story: [],
    gallery: [],
    coverPhoto: '',
    musicUrl: '',
    musicEnabled: false,
    musicTitle: '',
  }
}

// Key error API (dotted) -> nama field di form.
const SERVER_ERROR_TO_FIELD = {
  'bride_data.groom.name': 'groomName',
  'bride_data.groom.nick': 'groomNick',
  'bride_data.groom.father': 'groomFather',
  'bride_data.groom.mother': 'groomMother',
  'bride_data.groom.instagram': 'groomInstagram',
  'bride_data.groom.photo': 'groomPhoto',
  'bride_data.bride.name': 'brideName',
  'bride_data.bride.nick': 'brideNick',
  'bride_data.bride.father': 'brideFather',
  'bride_data.bride.mother': 'brideMother',
  'bride_data.bride.instagram': 'brideInstagram',
  'bride_data.bride.photo': 'bridePhoto',
  'event_data.akad.date': 'akadDate',
  'event_data.akad.time': 'akadTime',
  'event_data.akad.venue': 'akadVenue',
  'event_data.akad.address': 'akadAddress',
  'event_data.akad.maps_url': 'akadMaps',
  'event_data.resepsi.date': 'eventDate',
  'event_data.resepsi.time': 'eventTime',
  'event_data.resepsi.venue': 'eventVenue',
  'event_data.resepsi.address': 'eventAddress',
  'event_data.resepsi.maps_url': 'resepsiMaps',
}

// Error dengan index (mis. template_config.gallery.0) dipetakan by prefix.
const SERVER_ERROR_PREFIXES = [
  ['template_config.gallery', 'gallery'],
  ['template_config.cover_photo', 'coverPhoto'],
  ['template_config.gift', 'gifts'],
  ['template_config.music', 'music'],
  ['bride_data.story', 'story'],
]

function text(value) {
  return String(value ?? '').trim()
}

function normalizeInstagram(value) {
  return text(value).replace(/^@+/, '')
}

/**
 * Validasi klien langkah "Data Mempelai": cuma dua nama lengkap yang wajib.
 * Tanggal dan lokasi acara divalidasi di langkahnya sendiri sebelum terbit
 * (lihat hasEventDetail di pages/InvitationWizard.jsx), supaya wizard tidak
 * menahan user di langkah yang belum menampilkan field itu.
 */
export function validateCoupleForm(form) {
  const errors = {}

  if (!text(form.groomName)) errors.groomName = 'Nama mempelai pria wajib diisi.'
  if (!text(form.brideName)) errors.brideName = 'Nama mempelai wanita wajib diisi.'

  return errors
}

/** Validasi klien form "Edit Undangan". Semua isian opsional, kecuali 2 nama. */
export function validateEditForm(form) {
  const errors = {}

  if (!text(form.groomName)) errors.groomName = 'Nama mempelai pria wajib diisi.'
  if (!text(form.brideName)) errors.brideName = 'Nama mempelai wanita wajib diisi.'

  for (const [field, label] of [
    ['akadMaps', 'akad'],
    ['resepsiMaps', 'resepsi'],
  ]) {
    const value = text(form[field])
    if (value && !/^https?:\/\//i.test(value)) {
      errors[field] = `Link peta ${label} harus diawali http:// atau https://`
    }
  }

  const rows = (form.gifts ?? []).map((row) => [text(row.bank), text(row.number), text(row.name)])
  const partial = rows.some((cells) => cells.some(Boolean) && !cells.every(Boolean))

  if (partial) {
    errors.gifts = 'Lengkapi bank, nomor rekening, dan atas nama di setiap baris hadiah.'
  } else if (form.giftEnabled && !rows.some((cells) => cells.every(Boolean))) {
    errors.gifts = 'Isi minimal satu rekening kalau bagian kirim hadiah diaktifkan.'
  }

  const storyRows = (form.story ?? []).map((row) => [text(row.title), text(row.date), text(row.text)])
  const storyPartial = storyRows.some(
    (cells) => cells.some(Boolean) && !(cells[0] && cells[2]),
  )

  if (storyPartial) {
    errors.story = 'Setiap cerita butuh judul dan isi. Tanggal boleh dikosongkan.'
  } else if ((form.story ?? []).some((row) => text(row.text).length > 1000)) {
    errors.story = 'Isi cerita maksimal 1000 karakter per bagian.'
  }

  return errors
}

/** Bangun payload JSONB dari state form "Buat Undangan". */
export function buildInvitationPayload(form) {
  const brideData = {
    groom: { name: form.groomName.trim() },
    bride: { name: form.brideName.trim() },
  }

  // Nama panggilan ikut kalau diisi: cover halaman tamu memakai `nick`
  // kalau ada, jadi jangan sampai hilang saat draft pertama dibuat.
  if (text(form.groomNick)) brideData.groom.nick = text(form.groomNick)
  if (text(form.brideNick)) brideData.bride.nick = text(form.brideNick)

  // Draft pertama sengaja hanya berisi identitas: tanggal dan acara diisi di
  // langkah Detail Acara lewat PATCH (buildUpdatePayload), jadi tidak ada
  // dua jalur yang bisa berbeda hasilnya.
  return {
    template_name: templateByName(form.templateName).name,
    bride_data: brideData,
  }
}

/** Isi state form "Edit Undangan" dari data undangan API (owner shape). */
export function invitationToEditForm(invitation) {
  const groom = invitation?.bride_data?.groom ?? {}
  const bride = invitation?.bride_data?.bride ?? {}
  const akad = invitation?.event_data?.akad ?? {}
  const resepsi = invitation?.event_data?.resepsi ?? {}
  const config = invitation?.template_config ?? {}
  const gift = config.gift ?? {}

  const accounts = Array.isArray(gift.accounts)
    ? gift.accounts.map((account) => ({
        bank: text(account?.bank),
        number: text(account?.number),
        name: text(account?.name),
      }))
    : []

  const story = Array.isArray(invitation?.bride_data?.story)
    ? invitation.bride_data.story.map((entry) => ({
        title: text(entry?.title),
        date: text(entry?.date),
        text: text(entry?.text),
      }))
    : []

  return {
    templateName: templateByName(invitation?.template_name).name,
    groomName: text(groom.name),
    groomNick: text(groom.nick),
    groomFather: text(groom.father),
    groomMother: text(groom.mother),
    groomInstagram: text(groom.instagram),
    groomPhoto: text(groom.photo),
    brideName: text(bride.name),
    brideNick: text(bride.nick),
    brideFather: text(bride.father),
    brideMother: text(bride.mother),
    brideInstagram: text(bride.instagram),
    bridePhoto: text(bride.photo),
    akadDate: text(akad.date),
    akadTime: text(akad.time),
    akadVenue: text(akad.venue),
    akadAddress: text(akad.address),
    akadMaps: text(akad.maps_url),
    resepsiDate: text(resepsi.date),
    resepsiTime: text(resepsi.time),
    resepsiVenue: text(resepsi.venue),
    resepsiAddress: text(resepsi.address),
    resepsiMaps: text(resepsi.maps_url),
    giftEnabled: Boolean(gift.enabled),
    gifts: accounts.length > 0 ? accounts : [{ bank: '', number: '', name: '' }],
    story,
    gallery: Array.isArray(config.gallery)
      ? config.gallery.filter((url) => typeof url === 'string')
      : [],
    coverPhoto: text(config.cover_photo),
    musicUrl: text(config.music_url),
    musicEnabled: Boolean(config.music_enabled),
    musicTitle: text(config.music_title),
  }
}

/**
 * Bangun payload PATCH dari state form "Edit Undangan".
 *
 * Semua field yang dikelola form selalu ikut terkirim: string kosong menjadi
 * null di server dan berarti "hapus field ini". Field yang tidak dikelola
 * form (mis. palette, music) tidak dikirim supaya tidak tersentuh.
 */
export function buildUpdatePayload(form) {
  const person = ({ name, nick, father, mother, instagram, photo }) => ({
    name: text(name),
    nick: text(nick),
    father: text(father),
    mother: text(mother),
    instagram: normalizeInstagram(instagram),
    photo: text(photo) || null,
  })

  const branch = ({ date, time, venue, address, maps }) => ({
    date: text(date),
    time: text(time),
    venue: text(venue),
    address: text(address),
    maps_url: text(maps),
  })

  return {
    template_name: templateByName(form.templateName).name,
    bride_data: {
      groom: person({
        name: form.groomName,
        nick: form.groomNick,
        father: form.groomFather,
        mother: form.groomMother,
        instagram: form.groomInstagram,
        photo: form.groomPhoto,
      }),
      bride: person({
        name: form.brideName,
        nick: form.brideNick,
        father: form.brideFather,
        mother: form.brideMother,
        instagram: form.brideInstagram,
        photo: form.bridePhoto,
      }),
      story: (form.story ?? [])
        .map((row) => ({
          title: text(row.title),
          date: text(row.date),
          text: text(row.text),
        }))
        .filter((row) => row.title && row.text),
    },
    event_data: {
      akad: branch({
        date: form.akadDate,
        time: form.akadTime,
        venue: form.akadVenue,
        address: form.akadAddress,
        maps: form.akadMaps,
      }),
      resepsi: branch({
        date: form.resepsiDate,
        time: form.resepsiTime,
        venue: form.resepsiVenue,
        address: form.resepsiAddress,
        maps: form.resepsiMaps,
      }),
    },
    template_config: {
      gallery: (form.gallery ?? [])
        .map((item) => (typeof item === 'string' ? item : item?.url))
        .filter(Boolean),
      cover_photo: text(form.coverPhoto) || null,
      music_url: text(form.musicUrl) || null,
      music_enabled: Boolean(form.musicEnabled),
      music_title: text(form.musicTitle) || null,
      gift: {
        enabled: Boolean(form.giftEnabled),
        accounts: (form.gifts ?? [])
          .map((row) => ({
            bank: text(row.bank),
            number: text(row.number),
            name: text(row.name),
          }))
          .filter((row) => row.bank && row.number && row.name),
      },
    },
  }
}

/** Ubah error 422 dari API (key dotted) -> peta nama-field form + sisa pesan. */
export function mapServerErrors(serverErrors) {
  const fieldErrors = {}
  const leftovers = []

  for (const [key, messages] of Object.entries(serverErrors ?? {})) {
    const message = Array.isArray(messages) ? messages[0] : String(messages)

    let field = SERVER_ERROR_TO_FIELD[key]
    if (!field) {
      const match = SERVER_ERROR_PREFIXES.find(([prefix]) => key.startsWith(prefix))
      field = match?.[1]
    }

    if (field) {
      if (!fieldErrors[field]) fieldErrors[field] = message
    } else {
      leftovers.push(message)
    }
  }

  return { fieldErrors, leftovers }
}
