import { DEFAULT_TEMPLATE_NAME } from './invitationPayload.js'

/**
 * Data contoh fiktif untuk pratinjau undangan (wizard + galeri template).
 * Dipisah dari komponen supaya file komponen hanya mengekspor komponen
 * (aturan Fast Refresh).
 *
 * Foto contoh dari public/samples/ (domain publik / CC dari Wikimedia
 * Commons, lihat docs/STATUS.md) supaya pratinjau tiap template tampil
 * dengan foto nyata, bukan kotak kosong.
 */
export const SAMPLE_PREVIEW = {
  template_name: DEFAULT_TEMPLATE_NAME,
  bride_data: {
    groom: {
      name: 'Andi Pratama',
      nick: 'Andi',
      father: 'Bapak Pratama',
      mother: 'Ibu Lestari',
      instagram: 'andipratama',
    },
    bride: {
      name: 'Sari Dewi',
      nick: 'Sari',
      father: 'Bapak Dewanto',
      mother: 'Ibu Ratna',
      instagram: 'saridewi',
    },
    story: [
      {
        title: 'Pertama Bertemu',
        date: 'Maret 2019',
        text: 'Kami dipertemukan di sebuah acara kampus, berawal dari obrolan ringan soal tugas kuliah.',
      },
      {
        title: 'Mulai Menjalin',
        date: 'Agustus 2020',
        text: 'Setelah setahun saling mengenal, kami memutuskan untuk menjalani hubungan ini bersama.',
      },
    ],
  },
  event_data: {
    akad: {
      date: '2026-12-10',
      time: '08:00',
      venue: 'Masjid Al-Hikmah',
      address: 'Jl. Melati No. 10, Bandung',
    },
    resepsi: {
      date: '2026-12-10',
      time: '11:00',
      venue: 'Gedung Graha Indah',
      address: 'Jl. Anggrek No. 5, Bandung',
    },
  },
  template_config: {
    cover_photo: '/samples/a5-dress-back.jpg',
    gallery: [
      '/samples/a1-bouquet-roses.jpg',
      '/samples/a3-bouquet-calla.jpg',
      '/samples/a9-table.jpg',
      '/samples/a7-rings.jpg',
      '/samples/a2-bouquet-white.jpg',
      '/samples/a6-dress-valentino.jpg',
    ],
    gift: {
      enabled: true,
      accounts: [{ bank: 'BCA', number: '1234567890', name: 'Andi Pratama' }],
    },
  },
}
