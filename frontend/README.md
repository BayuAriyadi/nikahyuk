# nikahyuk Frontend

React 19 + Vite + Tailwind CSS 4. Berbicara ke API Laravel Sanctum di root proyek (`..`).

## Menjalankan (dev)

Butuh dua terminal.

**Terminal 1 (backend Laravel):**

```bash
export PATH=/opt/data/bin:/opt/data/opt:$PATH
cd /opt/data/projects/nikahyuk
php artisan serve --host=127.0.0.1 --port=8010
```

**Terminal 2 (frontend):**

```bash
export PATH=/opt/data/bin:/opt/data/opt:$PATH
cd /opt/data/projects/nikahyuk/frontend
npm run dev
```

Buka http://127.0.0.1:5173. Request ke `/api/*` di-proxy otomatis oleh Vite ke `http://127.0.0.1:8010` (lihat `vite.config.js`), jadi tidak ada urusan CORS saat dev.

## Struktur

- `src/lib/api.js`: klien fetch + penyimpanan token di localStorage (`nikahyuk.token`, `nikahyuk.user`); menyediakan `publicApi` (ambil undangan per slug + kirim RSVP) untuk halaman tamu dan `api.uploadPhoto` (unggah foto multipart, dipakai galeri maupun foto profil mempelai).
- `src/lib/invitationPayload.js`: validasi + rakit payload undangan (JSONB) dari form; juga memetakan data undangan dari `GET /api/invitations` kembali ke field form edit + menyusun payload update.
- `src/lib/image.js`: kompresi gambar di browser (canvas resize + re-encode) sebelum unggah, supaya aman dari `upload_max_filesize` 2 MB.
- `src/context/AuthContext.jsx`: state auth lewat `useAuth()` (`login`, `register`, `logout`); memvalidasi token tersimpan saat aplikasi dibuka.
- `src/context/ToastContext.jsx`: notifikasi kecil global lewat `useToast()` (`toast.success/error/info`).
- `src/components/ProtectedRoute.jsx`: guard `ProtectedRoute` (wajib login) dan `PublicOnlyRoute` (khusus halaman auth).
- `src/components/Modal.jsx`: modal aksesibel dipakai form & pembayaran.
- `src/layouts/DashboardLayout.jsx`: sidebar + area konten untuk halaman dalam `/dashboard`.
- `src/pages/Invitations.jsx`: halaman "Undangan Saya" (daftar, form, tombol Publish, konfirmasi Hapus).
- `src/pages/Guests.jsx`: halaman "Daftar Tamu" (rekap kehadiran, tambah/hapus tamu, tombol WA pribadi per tamu).
- `src/pages/Messages.jsx`: halaman "Buku Ucapan" (semua ucapan, filter per undangan).
- `src/hooks/useGuests.js`: fetch semua tamu milik user (dipakai Daftar Tamu, Buku Ucapan, dan kartu statistik Overview).
- `src/components/guests/StatusBadge.jsx`: badge status tamu (Hadir / Berhalangan / Belum konfirmasi).
- `src/lib/time.js`: format waktu relatif bahasa Indonesia ("2 jam yang lalu").
- `src/components/MusicPlayer.jsx`: pemutar musik latar halaman publik (mulai saat tombol "Buka Undangan" ditekan, tombol speaker bulat di kanan bawah).
- `src/pages/ForgotPassword.jsx`: halaman "Lupa Password" (minta tautan reset lewat email).
- `src/pages/ResetPassword.jsx`: halaman "Atur Ulang Password" (dibuka dari tautan di email, token sekali pakai).
- `src/pages/Landing.jsx`: landing page publik di route `/` (navbar, hero + CTA, kartu fitur, harga, FAQ, CTA akhir, footer).
- `src/pages/PublicInvitation.jsx`: halaman undangan publik di route `/{slug}` (cover + foto, profil mempelai dari `bride_data` termasuk foto bulat pria/wanita, detail akad/resepsi + countdown dari `event_data`, galeri foto + lightbox, bagian Kirim Hadiah, form RSVP, buku ucapan tamu).
- `src/fonts.css` + `public/fonts/`: font self-hosted (Playfair Display untuk heading, Plus Jakarta Sans untuk isi); tidak ada request ke Google Fonts saat runtime.
- `src/components/invitations/`: `InvitationCard.jsx` (kartu + thumbnail cover + jumlah foto + tombol Edit/Publish/Lihat), `InvitationFormModal.jsx` (buat undangan), `InvitationEditModal.jsx` (edit lengkap: template, mempelai + orang tua + foto profil, akad/resepsi terpisah, maps, kelola foto & cover, cerita, musik, rekening hadiah), `TemplatePicker.jsx` (pemilih template dengan contoh warna), `PublishModal.jsx` (QRIS + polling pembayaran).
- `src/templates.css`: palet warna + bentuk per template undangan (hook `[data-template=...]`, lihat bagian "Template undangan" di bawah).
- `src/components/Reveal.jsx` + `src/lib/useReveal.js`: animasi muncul-saat-scroll (`IntersectionObserver`) dan kilau kursor; semuanya mati saat `prefers-reduced-motion`.
- `src/hooks/useInvitations.js`: fetch daftar undangan (mendukung refresh senyap setelah pembayaran).

## Pembayaran QRIS & terbitnya undangan

Undangan baru selalu berstatus `draft`. Di halaman "Undangan Saya", tombol **Publish** pada kartu draft:

1. `POST /api/invitations/{slug}/checkout`: backend membuat tagihan QRIS (`order_id` berawalan `NKY-`) dan baris `transactions`.
2. `PublishModal` menampilkan QR (`qr_string` dirender lokal pakai paket `qrcode`; `qr_url` dari gateway dipakai bila ada), nominal, kode bayar, dan masa berlaku. Status dicek otomatis lewat `GET /api/transactions/{order_id}` tiap 3 detik.
3. Payment gateway memanggil webhook `POST /api/webhooks/midtrans` (di luar `auth:sanctum`, bebas CSRF, diverifikasi signature SHA512). Saat notifikasi berstatus lunas: baris `transactions.payment_status` jadi `paid` dan `invitations.status` otomatis berubah dari `draft` ke `published` (idempoten per `order_id`).

Mode simulasi lokal (driver `fake`, tanpa kredensial Midtrans asli). Perintah muncul langsung di modal:

```bash
php artisan payments:simulate NKY-................-.....
```

Untuk Sandbox Midtrans sungguhan: set `PAYMENT_DRIVER=midtrans` dan isi kredensial Sandbox di `.env` (lihat `config/payment.php` + `config/midtrans.php`). Webhook yang menunjuk ke `https://<domain>/api/webhooks/midtrans` bisa diatur otomatis lewat `Config::overrideNotifUrl`.

## Halaman undangan publik

Undangan berstatus `published` dibuka tamu di `/{slug}` (`src/pages/PublicInvitation.jsx`, mobile-first). Sumber data `GET /api/invitations/{slug}` (publik; undangan `draft` dibalas 404). Form RSVP mengirim `POST /api/invitations/{slug}/guests`: nama, ucapan (maks 500 karakter), konfirmasi hadir/tidak. Daftar ucapan tampil di bawah undangan; slug tak dikenal menampilkan pesan "Undangan tidak ditemukan".

## Edit undangan, foto, dan galeri

Tombol **Edit** pada kartu di "Undangan Saya" membuka `InvitationEditModal.jsx`: data kedua mempelai (termasuk nama orang tua, Instagram, dan foto profil), akad & resepsi sebagai acara terpisah (tanggal, waktu, tempat, alamat, link Google Maps), kelola foto, dan daftar rekening untuk bagian "Kirim Hadiah".

- Foto diunggah ke `POST /api/invitations/{id}/photos` (multipart, field `photo`, butuh token) dan disimpan di `storage/app/public/gallery/{slug}/` yang diakses publik lewat symlink `public/storage`. Server hanya menerima berkas gambar dan membatasi ukuran (2 MB); sebelum dikirim, gambar dikecilkan di browser oleh `src/lib/image.js`.
- Maksimal 30 foto per undangan, tersimpan di `template_config.gallery` (array URL). Satu foto ditandai sebagai cover (`template_config.cover_photo`, tombol bintang di modal); kalau kosong, foto pertama galeri dipakai sebagai cover.
- Foto profil mempelai (bulat, tampil di section **Kedua Mempelai**) disimpan di `bride_data.groom.photo` / `bride_data.bride.photo`. Unggahannya lewat endpoint yang sama, tapi tidak ikut hitungan 30 foto/galeri dan tidak muncul di grid galeri. Kalau kosong, halaman tamu menampilkan avatar inisial nama.
- Foto yang dihapus atau diganti ikut dibersihkan dari disk (prune mencakup galeri, cover, dan foto profil mempelai), dan field yang dikosongkan saat edit dihapus dari JSONB (dikirim `null`), jadi tamu tidak melihat field kosong.
- Halaman tamu menampilkan foto cover di bagian atas, foto bulat kedua mempelai di section **Kedua Mempelai**, section **Galeri Momen** (grid; klik foto untuk membuka lightbox: tombol panah/geser untuk pindah, Esc untuk menutup), dan section **Kirim Hadiah** (kartu rekening + tombol salin nomor).

## Bagikan tautan undangan

Kartu di "Undangan Saya" menampilkan tautan publik undangan (dibangun dari `window.location.origin` + slug di `src/lib/share.js`, jadi otomatis ikut host yang sedang dipakai: localhost, IP Tailscale, atau domain produksi). Undangan `draft` hanya menampilkan petunjuk, karena halaman tamunya memang belum hidup (404).

- **Salin tautan** memakai Clipboard API bila tersedia; di akses http biasa (mis. lewat IP Tailscale) otomatis fallback ke `execCommand` (`src/lib/clipboard.js`), dan kalau dua-duanya ditolak browser muncul petunjuk salin manual.
- **WhatsApp** membuka `https://wa.me/?text=...` dengan teks undangan siap kirim (sopan, tanpa asumsi agama).
- **Bagikan** hanya muncul di browser yang mendukung Web Share API (umumnya HP) dan membuka share sheet bawaan.
- Ikon garis dipakai bersama lewat `src/components/Icon.jsx` (dipindah dari `PublicInvitation.jsx` supaya tidak ada dua definisi).

## Menghapus undangan

Tombol **Hapus** di kartu "Undangan Saya" (di kiri tombol Edit) membuka konfirmasi berisi nama mempelai + slug, lalu memanggil `DELETE /api/invitations/{id}`. Owner-only: non-owner dibalas 403, tanpa token 401, undangan tak dikenal 404. Yang ikut terhapus permanen:

- Semua foto undangan di disk (`storage/app/public/gallery/{slug}/`), termasuk cover dan foto profil mempelai.
- Daftar tamu & ucapan beserta riwayat transaksi, lewat foreign key `cascadeOnDelete` di database.
- Baris undangan itu sendiri; halaman publiknya langsung 404 dan tidak muncul lagi di daftar.

Tidak ada undo; `draft` maupun `published` sama-sama bisa dihapus. Smoke test: `tests/manual/smoke_delete.sh` (happy path, 401/403/404, cascade, prune).

## Kelola tamu & pantau RSVP (fase 3)

Halaman **Daftar Tamu** (`/dashboard/tamu`) dan **Buku Ucapan** (`/dashboard/ucapan`) menarik data dari `GET /api/guests` (semua tamu dari undangan milik user, terbaru dulu, dengan ringkasan undangannya).

- **Rekap kehadiran** dihitung di klien: Total tamu, Hadir, Berhalangan, Belum konfirmasi (badge warna di setiap baris).
- **Tambah tamu manual** (`POST /api/guests`) untuk menyiapkan nama sebelum kirim undangan; statusnya `pending` sampai tamu mengisi RSVP sendiri.
- **Kirim WA pribadi** per tamu: tautan `/{slug}?to=Nama+Tamu` yang menyapa tamunya by name di cover dan mengisi otomatis kolom nama di form RSVP. Tautan dibangun dari `window.location.origin` (lihat `src/lib/share.js`), jadi ikut host yang sedang dipakai.
- **Dedupe RSVP**: kalau tamu mengisi RSVP dengan nama yang sudah ada di daftar (beda kapital pun), baris lama yang diperbarui, bukan ditambah. Rekap tidak pernah dobel.
- **Hapus tamu** (`DELETE /api/guests/{id}`) untuk membersihkan daftar.
- **Buku Ucapan** menampilkan semua ucapan (hanya tamu yang mengisi pesan), dengan filter per undangan bila lebih dari satu.

Halaman undangan publik menyapa tamu di cover bila URL memuat `?to=` (`src/pages/PublicInvitation.jsx`), maksimal 100 karakter.

## Cerita Kita (love story)

Bagian **Cerita Kita** di halaman tamu: timeline vertikal entri `{judul, tanggal, isi}` (maksimal 10 baris di editor, 20 di server, isi 1000 karakter per entri). Tanggal opsional dan bebas format ("Maret 2019").

- Disimpan di `bride_data.story` (JSONB, tidak perlu migrasi), diwhitelist `JsonbPayload` + divalidasi di `Store`/`UpdateInvitationRequest`.
- Urutan tampil = urutan baris di editor. Daftar kosong `[]` atau `null` = bagian ini tidak dirender sama sekali di halaman tamu.
- Editor: **Edit undangan → Cerita Kita** (tambah/hapus baris, validasi klien "judul + isi wajib" sebelum kirim).

## Musik latar (fase 2)

Lagu dipilih dari **Edit undangan → Musik Latar**: satu berkas per undangan (MP3/OGG/WAV/M4A, maksimal 2 MB, ± 2 menit), diunggah ke `POST /api/invitations/{id}/music` dan disimpan di `storage/app/public/music/<slug>/`. Unggah baru otomatis membuang berkas lama, jadi tidak ada lagu yatim.

- Pengaturan tersimpan di `template_config`: `music_url`, `music_enabled`, `music_title`.
- Pemutar (`src/components/MusicPlayer.jsx`) **tidak autoplay saat halaman dibuka** (kebijakan browser). Lagu mulai saat tamu menekan **Buka Undangan** — itu interaksi pertama yang memberi izin audio. Tombol speaker bulat di kanan bawah menyala/memadamkan; posisinya menghormati `env(safe-area-inset-bottom)` untuk iPhone.
- Tombol speaker baru muncul setelah undangan dibuka, dan ikut hilang otomatis bila `music_enabled` dimatikan atau URL lagu kosong.
- `music_url` hanya menerima `https?://` atau `/storage/music/...` (regex di `Store`/`UpdateInvitationRequest`), jadi tidak bisa diisi `javascript:`.

## Lupa password (fase 4)

Alur: `/lupa-password` (minta tautan) → email → `/reset-password?token=...&email=...` (set password baru) → login ulang.

- API: `POST /api/forgot-password` (dibalas pesan netral, email terdaftar atau tidak, supaya tidak bisa dipakai menebak akun) dan `POST /api/reset-password` (token sekali pakai, `Password::min(8)`).
- Tautan di email diarahkan ke halaman SPA, bukan route web Laravel, karena app ini API-only (`ResetPassword::createUrlUsing` + notifikasi Indonesia di `app/Providers/AppServiceProvider.php`). Alamat frontend dari `FRONTEND_URL` di `.env`.
- Setelah password diganti, **semua token Sanctum lama dicabut** — sesi di perangkat lain langsung logout.

> Mailer project masih `log`: tautan reset muncul di `storage/logs/laravel.log`, belum terkirim ke email sungguhan. Untuk produksi, set `MAIL_MAILER=smtp` + kredensial SMTP di `.env`.

## Statistik kunjungan

Halaman publik yang dibuka tamu menaikkan `visit_count` + `last_visited_at` di baris undangan (kolom baru, migrasi `2026_09_25_100002`).

- Dihitung di `GET /api/invitations/{slug}` itu sendiri, bukan endpoint terpisah, supaya angka tidak bisa digelembungkan tanpa benar-benar membuka undangan.
- **Satu pengunjung = satu hitungan per 30 menit** (cache key per IP+slug). Refresh berulang dan reload tidak menaikkan angka.
- Increment atomic di level SQL (`visit_count + 1`) — dua kunjungan bersamaan tetap terhitung dua.
- Undangan draft tidak dihitung (404 sebelum baris apa pun tersentuh).
- Tampil di **Dashboard** (kartu "Kunjungan", total semua undangan) dan di kartu undangan (baris "Dilihat: N kali, terakhir <waktu relatif>"), hanya untuk undangan terbit.
- `visit_count`/`last_visited_at` **tidak** ikut di payload publik (`PublicInvitationResource` tidak memuatnya).

## Landing page

`src/pages/Landing.jsx` (route `/`): navbar, hero + CTA, **galeri template**, kartu fitur, harga, FAQ, CTA akhir, footer.

- **Galeri template** (`#template`, `TemplateGallery`): empat kartu thumbnail seragam (`TemplateThumb`), klik kartu membuka `TemplatePreviewModal` berisi contoh satu halaman penuh dengan data fiktif (bisa digulir). Tombol "Buat undangan baru" mengantar ke register/dashboard.
- Thumbnail memakai palet template asli lewat `data-template` di `TemplateCard.jsx`, jadi kartu selalu sewarna dengan halaman tamunya. Minimalis sengaja digambar sebagai kotak bergaris (bukan isian warna) supaya terbaca sebagai gaya, bukan gambar gagal muat.

## Alur "Buat Undangan Baru" (halaman wizard 5 langkah)

`src/pages/InvitationWizard.jsx`, route `/dashboard/undangan/baru` (di dalam
`DashboardLayout`). Dulu sebuah modal, dipindah jadi halaman penuh supaya galeri template
yang bertambah panjang tidak terjepit di dalam kotak. Langkahnya:

1. **Pilih Template** — kartu + tombol "Lihat contoh" (pratinjau penuh). Belum menyentuh API.
2. **Data Mempelai** — dua nama lengkap wajib (validasi klien `validateCoupleForm`). Di akhir langkah ini draft pertama dibuat (`POST /api/invitations`, hanya `template_name` + `bride_data`). Kalau user mundur lalu maju lagi, yang jalan PATCH, bukan POST kedua.
3. **Detail Acara** — akad & resepsi, disimpan lewat `PATCH` (`buildUpdatePayload`), jadi aturan "string kosong = hapus field" tetap berlaku.
4. **Foto & Cerita** — unggah galeri/foto profil/musik baru bisa jalan di sini karena draft sudah punya id. Tombol "Simpan perubahan" menyimpan tanpa pindah langkah.
5. **Pratinjau & Terbit** — pratinjau memakai data asli (`InvitationPreview`), pilihan Kirim Hadiah, lalu "Terbitkan & Bayar" → `PublishModal` (QRIS + polling). Tanpa tanggal + tempat minimal satu acara, tombolnya mengembalikan user ke langkah 3.

Progres wizard disimpan di `sessionStorage` (`nikahyuk.wizard.draft`) setiap langkah berubah,
jadi refresh di tengah alur tidak mengulang dari langkah 1 dan tidak membuat draft kedua di
server. Kuncinya dibersihkan saat user menekan Batal atau selesai membayar. Tab baru =
alur baru (sessionStorage per tab).

Tombol masuk ke halaman ini: "+ Buat Undangan Baru" dan CTA daftar kosong di
`pages/Invitations.jsx`, serta "Buat undangan pertama" di `pages/Overview.jsx`.

## Pratinjau undangan (`components/templates/`)

- `InvitationPreview.jsx`: merender halaman tamu yang sama tanpa buku ucapan, musik, dan penghitung kunjungan. Section-nya diimpor dari `pages/PublicInvitation.jsx` (`Cover`, `CoupleSection`, `EventsSection`, `CountdownSection`, `GallerySection`, `StorySection`, `GiftSection`, `eventMainMoment`) supaya pratinjau tidak pernah berbeda dari halaman asli. Tanpa prop `data`, dipakai `SAMPLE_PREVIEW` (pasangan fiktif).
- Kelas `ny-preview` mengecilkan cover (yang aslinya `min-h-svh`) supaya pas digulir di dalam modal; diatur di `src/templates.css`.
- `TemplatePreviewModal.jsx`: modal pratinjau satu template; di landing, tombolnya mengantar ke register/dashboard.

## Template undangan (klasik / minimalis / floral / ceria)

Tiap undangan menyimpan `template_name` (kolom di tabel `invitations`). Pemilik memilihnya di modal **Buat Undangan Baru** dan **Edit Undangan** (`components/invitations/TemplatePicker.jsx`); halaman tamu merendernya sesuai pilihan.

Katalog tunggal ada di `src/lib/invitationPayload.js` (`TEMPLATES`). Satu entri berisi:

- `name` — harus sama persis dengan nilai `template_name` yang diterima backend (`in:` di `StoreInvitationRequest`/`UpdateInvitationRequest`), blok `[data-template=...]` di `src/templates.css`, dan nama di katalog.
- `swatch` — tiga warna contoh di kartu pemilih.
- `reveal` — varian animasi muncul-saat-scroll (`up`/`zoom`/`side`, lihat `src/lib/useReveal.js`).
- `order` — **urutan section** halaman tamu. Tiap template menyusun ulang section yang sama, jadi layout tidak cuma beda warna.

Cara kerja:

- **Warna**: Tailwind 4 mengemit utility sebagai `var(--color-rose-700)`, jadi satu blok `[data-template='x'] { --color-rose-*: ... }` mengganti seluruh palet halaman publik tanpa menyentuh satu pun markup.
- **Bentuk**: elemen struktural ditandai hook `ny-*` (`ny-card`, `ny-title`, `ny-cover`, `ny-frame`, `ny-countdown`, `ny-gallery`, `ny-story`, `ny-divider`). `templates.css` mengubah radius/penjajaran/border per template dari hook yang sama. Blok ini sengaja **di luar `@layer`** supaya boleh menimpa utility Tailwind.
- **Animasi**: `components/Reveal.jsx` membungkus tiap section; `useReveal` memasang `IntersectionObserver` dan langsung `shown=true` bila pengguna memilih `prefers-reduced-motion`. `usePointerGlow` menambah kilau mengikuti kursor di template minimalis (hanya desktop berpointer presisi).
- **Kontras**: nilai oklch tiap palet disetel ulang dari skala Tailwind bawaan supaya lolos WCAG AA (grafik >= 3:1, teks >= 4,5:1). Skala bawaan gagal di beberapa tingkat (`rose-300` = 1,9-2,4:1 di putih).

Menambah template baru: tambah entri di `TEMPLATES`, blok `[data-template='...']` di `templates.css`, dan nama di rule `in:` kedua FormRequest (plus `$catalog` di `tests/manual/verify_task13.php`, yang menguji katalog penuh). Backend menolak nama di luar katalog dengan 422.

Catatan template **ceria**: palet krem-marun + tulisan tangan (`Caveat`) + judul bulat (`Baloo 2`), keduanya self-hosted di `public/fonts/`. Ornamen (tangkai, untaian mutiara, coretan bawah judul, bintik) digambar sebagai mask SVG data-URI di custom property, jadi satu blok CSS menangani semua bentuk tanpa komponen React baru dan warnanya ikut palet. Nama di cover memakai `clamp()` supaya nama panjang membungkus rapi di layar 390px, bukan melimpah keluar bingkai.

## Build produksi

```bash
npm run build
```

Hasil di `dist/`. Untuk deploy, set `VITE_API_BASE_URL` ke origin API (mis. `https://api.nikahyuk.id`) agar frontend tidak bergantung pada proxy dev.

## Catatan keamanan

Token Sanctum disimpan di localStorage (keputusan Task 3). localStorage bisa dibaca script lain bila ada celah XSS; untuk produksi pertimbangkan pindah ke cookie `httpOnly` dengan mode SPA Sanctum.
