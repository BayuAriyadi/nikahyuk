# STATUS — nikahyuk

Dokumen orientasi untuk sesi kerja baru. Baca ini dulu sebelum menyentuh kode.
Terakhir diperbarui: 2026-09-26.

## Apa ini

SaaS undangan pernikahan digital. Backend Laravel 13 (API-only, Sanctum) + PostgreSQL 17
(JSONB), frontend React 19 + Vite 8 + Tailwind 4 (SPA, mobile-first). PRD di `nikahyuk.md`.

- Backend: `/opt/data/projects/nikahyuk`
- Frontend: `/opt/data/projects/nikahyuk/frontend` (root Vite; `npm run dev` dari sini)

## Menjalankan (lingkungan userland, tanpa root)

Tidak ada root, tidak ada systemd, tidak ada Docker CLI. Semua tool ada di userland:

```bash
export PATH=/opt/data/bin:/opt/data/opt:$PATH
```

- PHP 8.5 + Composer: `/opt/data/bin/php`, `/opt/data/bin/composer`
- PostgreSQL 17 portable: `/opt/data/opt/pgroot`, data `/opt/data/opt/pgdata`
  - start/stop: `/opt/data/bin/pg-start`, `/opt/data/bin/pg-stop`
  - psql: `psql -h /opt/data/cache/scratch/pgsock -U nikahyuk -d nikahyuk`
- Node 24 + npm 11: `/opt/data/bin/node`, `/opt/data/bin/npm`

Tiga proses dev:

```bash
# 1) API Laravel
cd /opt/data/projects/nikahyuk && php artisan serve --host=0.0.0.0 --port=8010

# 2) Frontend (dev, dengan HMR)
cd /opt/data/projects/nikahyuk/frontend && npm run dev -- --host 0.0.0.0 --port 5173

# 3) Frontend versi build produksi (yang dipublikasikan lewat tunnel)
cd /opt/data/projects/nikahyuk/frontend && npm run build && npm run preview -- --host 127.0.0.1 --port 4173
```

Vite mem-proxy `/api` dan `/storage` ke `127.0.0.1:8010` (lihat `frontend/vite.config.js`),
jadi tidak ada urusan CORS saat dev.

## Cara mengakses dari luar (tanpa Tailscale di sisi tamu)

Kontainer ini tidak punya port yang di-publish ke host, jadi akses keluar lewat dua jalur
yang keduanya jalan dari dalam kontainer:

1. **Tailscale Funnel (utama, URL tetap)**
   `https://7e07bbd09d70.tail099f48.ts.net` → `127.0.0.1:4173` (**build produksi**)
   - tailscaled: `/opt/data/tailscale/tailscale_1.102.4_amd64/tailscaled`
     `--tun=userspace-networking --statedir=/opt/data/tailscale/state --socket=/opt/data/tailscale/run/tailscaled.sock`
   - **Wajib `--statedir`, bukan `--state=<file>`**: tanpa itu sertifikat Funnel gagal
     terbit (`no TailscaleVarRoot`) dan nama `ts.net` tidak pernah punya record DNS.
   - Aktifkan: `tailscale --socket=<sock> funnel --bg 4173`
   - Kalau habis ganti target funnel, TLS bisa sempat gagal (`UNEXPECTED_EOF`) beberapa detik
     saat cert diterbitkan ulang; tunggu lalu coba lagi, jangan langsung simpulkan rusak.
2. **cloudflared quick tunnel (cadangan, URL acak tiap restart)**
   `/opt/data/bin/cloudflared tunnel --url http://127.0.0.1:4173 --http-host-header localhost:4173 --metrics 127.0.0.1:20242 --no-autoupdate`
   - hostname dibaca dari `curl -s http://127.0.0.1:20242/quicktunnel`

**Jangan publikasikan dev server Vite (5173).** Dev server mengirim ~53 modul terpisah
(~6,3 MB); lewat Tailscale `userspace-networking` (proxy TCP di userland, tiap koneksi mahal)
itu jadi **~90 detik** sampai halaman siap. Build produksi cuma 7 request / ~280 KB / ~5 detik.
Jadi yang di-expose adalah `vite preview` di 4173, yang menyajikan `frontend/dist`:

```bash
cd frontend && npm run build
npm run preview -- --host 127.0.0.1 --port 4173   # /api + /storage diproxy ke 8010
```

`vite preview` memakai blok `preview.proxy` yang sama dengan `server.proxy` (lihat
`vite.config.js`), dan `allowedHosts` juga berlaku untuknya. **Setiap habis mengubah frontend,
`npm run build` wajib dijalankan ulang** — kalau tidak, yang dilihat tamu masih build lama.
Watchdog mengurus build kalau `dist/` hilang, tapi tidak mendeteksi kode yang berubah.

Keduanya dijaga cron job `97d301249713` (tiap 15 menit) yang menjalankan
`/opt/data/scripts/tailscale-watchdog.sh`: pastikan `dist/` ada, `vite preview` 4173 hidup,
tailscaled + funnel ke 4173, cloudflared ke 4173, dan melaporkan URL baru ke chat kalau
cloudflared restart.

Catatan penting: DNS di dalam kontainer mengembalikan **fake-IP** (198.18.x.x). Dulu curl
dari dalam ke URL publik selalu gagal; sejak jaringan host berubah, fake-IP itu **dirutekan
dengan benar** dan `curl https://7e07bbd09d70.tail099f48.ts.net/` dari dalam kontainer balas
200. Jadi uji cepat dari dalam sah-sah saja — tapi kalau ragu, verifikasi dari luar lewat
`https://r.jina.ai/https://<nama>/...` (cache-nya agresif: pakai `?nocache=$RANDOM` atau
baca `index.html` mentah untuk memastikan hash asset yang sedang tayang).

`vite.config.js` memuat `server.allowedHosts: ['.trycloudflare.com', '.ts.net', '.pujin.my.id']`.
Tanpa itu Vite membalas 403 "Blocked request" untuk Host header tunnel.

## Data & akun

DB `nikahyuk` (PostgreSQL, user `nikahyuk`). Tabel: `users`, `invitations`, `guests`,
`transactions`, `payment_events`, `personal_access_tokens`.

Akun uji: `dewi.task8@example.com` (owner undangan fixture), `bayuariyadi9@gmail.com` (owner asli).
Password fixture ada di catatan sesi, **jangan hardcode di kode atau dokumen**.

Aturan yang berlaku: mock/fixture **wajib nama fiktif**; slug nyata milik user (`anto-sumanto`,
`andi-*`) dipakai regresi, jangan dihapus.

## Kontrak API (routes/api.php)

Publik:
- `GET  /api/invitations/{slug}` — undangan published; draft → 404. Menghitung kunjungan.
- `POST /api/invitations/{slug}/guests` — RSVP tamu (dedupe nama case-insensitive).
- `POST /api/webhooks/midtrans` — webhook gateway (verifikasi signature SHA512, idempoten).

Auth (Sanctum bearer):
- `POST /api/register`, `POST /api/login`, `POST /api/logout`, `GET /api/user`
- `POST /api/forgot-password`, `POST /api/reset-password`
- `POST /api/change-password` — ganti password sendiri, wajib `current_password`;
  berhasilnya mencabut **semua** token user (semua perangkat dikeluarkan)
- `DELETE /api/account` — tutup akun sendiri, wajib password + frasa konfirmasi
  persis `HAPUS AKUN SAYA`. Menghapus user, undangan, tamu, dan berkas foto.
  **Transaksi pembayaran sengaja dipertahankan** (lihat catatan di bawah).
- `GET|POST /api/invitations`, `DELETE /api/invitations/{id}` (owner-only)
- `GET|POST /api/guests`, `DELETE /api/guests/{id}`
- `POST /api/invitations/{id}/photos`, `POST /api/invitations/{id}/music`
- `POST /api/invitations/{slug}/checkout`, `GET /api/transactions/{order_id}`

Detail lengkap tiap fitur ada di `frontend/README.md` (bagian per fitur) dan
`README.md` root untuk backend. Baca itu sebelum mengubah perilaku.

## Data model yang mudah salah

- `bride_data` (JSONB): `groom`/`bride` masing-masing `{name, nick, father, mother, instagram, photo}`,
  plus `story` = list `{title, date?, text}` (maks 10 editor / 20 server, isi 1000 char).
- `event_data` (JSONB): `akad` dan `resepsi` sebagai acara terpisah.
- `template_config` (JSONB): `gallery[]`, `cover_photo`, `gift.accounts[]`, `music_url`,
  `music_enabled`, `music_title`.
- `template_name` (kolom): `klasik` | `minimalis` | `floral` | `ceria`. Divalidasi `in:` di
  `Store`/`UpdateInvitationRequest`; katalog tunggal di `frontend/src/lib/invitationPayload.js` (`TEMPLATES`).
  - Nama itu harus sama persis di empat tempat: katalog JS, blok `[data-template=...]` di
    `frontend/src/templates.css`, rule `in:` backend, dan `$catalog` di
    `tests/manual/verify_task13.php` (harness itu sengaja memeriksa katalog penuh).
  - Template bukan sekadar ganti palet. Tiga sumbu pembeda, semuanya dari katalog:
    - `reveal` + `revealBySection`: varian animasi muncul-saat-discroll per section.
      Varian ada di `REVEAL_CLASSES`/`REVEAL_DURATION` (`lib/useReveal.js`):
      up, zoom, side, fade, lift, tilt, bloom, veil. Menambah varian = menambah
      dua entri di file itu, tidak ada komponen baru. **Semua varian wajib
      berakhir di keadaan tampak** (`opacity-100`) — varian yang mulai dari
      `opacity-0` bikin elemen hilang permanen saat `prefers-reduced-motion`.
    - `coupleLayout`: susunan dua kartu mempelai — `split` (klasik), `stack`
      (minimalis, rata kiri, foto jadi kolom), `circle` (floral, lingkaran
      besar), `tilted` (ceria, miring seperti tumpukan kertas), `print` (krem,
      dua kolom + garis vertikal, tanpa "&"). Atributnya menempel di
      `#mempelai[data-couple-layout]`, ditata di blok "Susunan kartu mempelai".
    - galeri & kartu acara: tiap template punya `aspect-ratio`, jumlah kolom,
      celah, radius, dan rotasi sendiri (klasik: polaroid; minimalis: kotak
      rapat 4px; floral: arch 2 kolom berseling 20px; ceria: sudut goyah miring;
      krem: kotak tegas). Jangan samakan tanpa alasan.
  - Animasi berjalan terus (bukan hanya saat discroll) ada di keyframes bersama
    `templates.css`: `ny-pulse-ring` (cincin tombol "Buka Undangan", class
    `.ny-cta-pulse`), `ny-breathe` (angka countdown, class `.ny-count-value`),
    `ny-underline` (garis bawah judul, class `.ny-anim-under`). Semua dimatikan
    di `@media (prefers-reduced-motion: reduce)`.
  - Utility Tailwind menang atas selector `[data-template=...]` biasa: `<main>`
    punya `bg-white` dan `[data-template='krem'] main` kalah cascade. Dua jalan
    yang terbukti: sebut utility-nya di selector (`main.bg-white`), atau timpa
    variabelnya (`--color-white`, karena `bg-white` = `var(--color-white)`).
    Hindari `!important`.
- `invitations.visit_count` + `last_visited_at`: dihitung di `GET /api/invitations/{slug}`,
  dedupe 30 menit per IP+slug, increment atomic di SQL. Tidak ikut payload publik.
- JSONB di-whitelist lewat `app/Support/JsonbPayload.php`; field yang dikosongkan dikirim `null`
  supaya terhapus dari JSONB.

## Hardening produksi

Aplikasi berjalan di `APP_ENV=production`, `APP_DEBUG=false`, dan
`SESSION_SECURE_COOKIE=true`. Sebelum diubah, `APP_DEBUG=true` membuat SETIAP
error mengembangkan field `file`, `exception`, dan `trace` ke publik — lengkap
dengan path absolut `/opt/data/projects/nikahyuk/vendor/...`. Itu peta gratis
tentang struktur server bagi siapa saja. Verifikasi: `verify_hardening.php`.

Dua hal yang wajib diingat soal mode produksi:
- **`.env` dibaca sekali lalu di-cache.** Mengubahnya tidak berlaku sebelum
  `php artisan config:clear`. Kalau perubahan konfigurasi tidak terasa, ini
  hampir selalu penyebabnya.
- **Token Sanctum di localStorage harus string polos**, bukan JSON. Menulis
  `JSON.stringify(token)` membuat `getToken()` mengirim Bearer `"re_..."`
  lengkap dengan tanda kutip, dan dashboard melempar kamu ke `/login` tanpa
  pesan error. Gejalanya mirip "auto-logout".

## Jebakan Vite preview: dist kedaluarsa

Pernah terjadi: `vite preview` terus menyajikan `dist` yang sudah dihapus
(setelah rebuild). Gejalanya **HALAMAN UNDANGAN PUBLIK TAMPIL KOSONG TOTAL** —
`#root` nol anak, tanpa satu pun error di konsol biasa, sementara:
- `GET /` tetap **200** (index.html lama masih dilayani)
- `GET /api/invitations/{slug}` tetap **200** dengan data lengkap
- halaman dashboard/landing tetap normal

Yang gagal cuma lazy import modul: browser melempar
`TypeError: Failed to fetch dynamically imported module: /assets/<chunk>.js`.
Cara melihatnya: pasang listener `error` **sebelum** pindah halaman, lalu
navigasi lewat `history.pushState` + `PopStateEvent` (reload penuh menghapus
listenernya). Port 4173 proxy aman; masalahnya murni preview memegang dist lama.

Penangkalnya ada di `server-health.sh`: skrip mengambil slug undangan published
(melalui `scripts/helpers/pick_published_slug.php`, karena `/api/invitations`
butuh token), mengekstrak nama chunk dari index.html yang dilayani, dan
memeriksa chunk itu benar-benar 200. Kode 200 di `/` saja terbukti tidak cukup.

Kalau ini terjadi lagi: restart `vite preview`, jangan cuma rebuild.

Catatan samping: helper di `scripts/helpers/` butuh path `../../projects/...`
(dari `/opt/data/scripts/helpers/` naik dua tingkat ke `/opt/data`), bukan
`../../../` yang berujung di `/`.

## Cadangan & pemulihan

`scripts/backup-nikahyuk.sh` berjalan tiap 03:00 (cron `1b8333f7f462`) dan
mencadangkan dua hal: `pg_dump` database, dan `storage/app/public` berisi foto
galeri + musik — berkas itu TIDAK ikut di dalam dump database, jadi kalau cuma
database yang dicadangkan, semua unggahan pengguna hilang. Retensi 7 hari.

Sandi database tidak ditulis di skrip maupun di environment proses (mudah
terlihat lewat `ps`); dipakai `~/.pgpass` berizin 600.

**Yang perlu kamu tahu soal pemulihan:** user aplikasi `nikahyuk` TIDAK punya
hak `CREATEDB` (hanya `postgres` yang superuser). Pembatasan ini membuat
pemulihan ke database baru tidak bisa dilakukan dari dalam aplikasi — harus
lewat superuser. `scripts/restore-nikahyuk.sh` disiapkan untuk itu: ia
memulihkan dulu ke database SEMENTARA, memverifikasi isinya tidak kosong, baru
menukar nama setelah kamu mengetik `YA`. Database lama tidak disentuh sebelum
verifikasi lolos.

Catatan tujuan cadangan: direktori default `/opt/data/backup` berada di volume
yang SAMA dengan sistem. Kalau volume itu rusak, cadangannya ikut rusak. Setelah
ada mount volume Proxmox terpisah, cukup set `NIKAHYUK_BACKUP_ROOT` ke sana —
skripnya membaca variabel itu dan tidak perlu diubah.

Catatan lingkungan: **cron Hermes bukan crond sistem**. `crontab -l` akan kosong
dan `pgrep cron` tidak menemukan apa-apa walau penjadwalan jalan; penjadwalannya
hidup di gateway Hermes. Jangan menyimpulkan "watchdog tidak pernah jalan" hanya
dari `crontab -l` yang kosong.

Alamat publik utama sekarang **https://nikahyuk.pujin.my.id** (tunnel Cloudflare
bernama `nikahyuk`, id `456e1338-…`, konfigurasi di
`/opt/data/home/.cloudflared/config.yml`). Tailscale funnel dan quick tunnel
masih hidup sebagai cadangan. Watchdog di `/opt/data/scripts/tailscale-watchdog.sh`
mengecek named tunnel lewat **HTTP dari internet**, bukan sekadar proses hidup:
proses hidup tapi domain 530 tetap memicu restart.

Saat menguji endpoint dari luar (Tailscale funnel atau Cloudflare), dua jebakan
ini bikin hasil tes palsu:
- **`GET /` dengan header `Accept: application/json` menjawab 404** dari Vite
  preview — halaman HTML cuma dikasih kalau klien minta `text/html`. Kalau tes
  otomatis dapat 404 di path root, itu salah tes, bukan salah aplikasi.
- Santum auth lewat proxy aman, tapi JWT Authorization **harus diuji dengan
  token dari DB berformat `plainTextToken`**, bukan kolom `token` (sudah
  ter-hash) — pakai token yang salah dapat 401 dan gampang disangka proxy
  membuang header.

## Yang sudah selesai

Fase 1-4 PRD selesai, plus: hapus undangan, Cerita Kita (love story), statistik kunjungan,
multi-template penuh (klasik / minimalis / floral / ceria / krem dengan layout + animasi berbeda), **statistik
kunjungan** (`pages/Statistics.jsx`, route `/dashboard/statistik`, entri
"Statistik" di sidebar), **galeri
template di landing page**, dan **wizard 5 langkah "Buat Undangan Baru"** (pilih template →
data mempelai → detail acara → foto & cerita → pratinjau & terbit/bayar).

Halaman statistik (`/dashboard/statistik`) tidak punya endpoint sendiri: semua
angka dihitung di klien dari `useInvitations()` + `useGuests()` yang sudah
dimuat dashboard lain. Menambah metrik = menambah hitungan di `Statistics.jsx`,
tidak perlu menyentuh backend. Dua aturan yang dipakai di sana:
- **Sorting butuh tie-break.** Beberapa undangan bisa punya `visit_count` sama;
  sort tanpa pengikat kedua membuat urutan tabel berubah-ubah antar render.
  Pengikatnya `slug` (unik), sama seperti jebakan `created_at` identik di
  harness.
- **`Route [login] not defined`: aplikasi ini API-only**, tidak punya route web
  `login`. Middleware `auth:sanctum` bawaan mengalihkan tamu ke route itu,
  gagal melempar `RouteNotFoundException`, dan SEMUA endpoint terproteksi
  menjawab **500, bukan 401**. Perbaikannya satu baris di `bootstrap/app.php`:
  `$middleware->redirectGuestsTo('/')`. Tanpa itu klien tidak bisa membedakan
  "belum login" dari "server rusak". Gejala yang muncul di log:
  `Symfony\...\RouteNotFoundException: Route [login] not defined`.
- **`storage/logs/laravel.log` bisa berpindah milik ke root** setelah menjalankan
  perintah composer/artisan sebagai root (mis. `composer require`). Laravel
  lalu gagal menulis log, dan setiap error menjelma "500 tanpa jejak" —
  padahal 500 itu hanyalah efek dari kegagalan mencatat error. Cek kepemilikan
  file dulu sebelum men-debug error 500 yang tidak berjejak.

- **Tabel lebar wajib `overflow-x-auto` di pembungkus dalam**, dengan
  `overflow-hidden` di pembungkus luar untuk memotong radius. Tanpa itu tabel
  memaksa halaman melebar di 390px (dan tes overflow horizontal gagal).

Detail dua yang terakhir ada di `frontend/README.md` bagian "Landing page", "Alur Buat
Undangan Baru", dan "Pratinjau undangan". Singkatnya:

- Wizard: `frontend/src/pages/InvitationWizard.jsx`, route `/dashboard/undangan/baru`
  (dulu modal, sekarang halaman penuh supaya galeri template tidak terjepit di kotak).
  Draft pertama dibuat di **akhir langkah 2** (nama belum ada di langkah 1); maju lagi =
  PATCH, bukan POST kedua. Jadi menutup halaman sebelum langkah 2 selesai tidak
  meninggalkan draft kosong. Progres disimpan di `sessionStorage` supaya refresh tidak
  mengulang dari langkah 1.
- Pratinjau dan galeri memakai ulang section halaman tamu yang di-ekspor dari
  `pages/PublicInvitation.jsx`, jadi tampilannya tidak bisa berbeda dari undangan asli.
- Export CSV daftar tamu (`lib/csv.js`, tombol "Ekspor CSV" di Daftar Tamu): mengikuti
  filter pencarian yang sedang aktif, BOM UTF-8 supaya Excel Windows tidak merusak karakter
  Indonesia, dan nilai berawalan `= + - @` dikutip (bisa jadi rumus berbahaya saat dibuka).
- Lightbox galeri jadi komponen bersama (`components/Lightbox.jsx`, tadinya cuma ada di
  PublicInvitation) dan kini terpasang juga di galeri template elegan.
- **Optimisasi foto (WebP + resize)**: klien (`frontend/src/lib/image.js`) mengecilkan sisi
  terpanjang ke 1600 px dan meng-encode WebP q0.82 di canvas sebelum upload (fallback JPEG
  q0.85 kalau canvas WebP tidak tersedia). Server (`PhotoController`) menyimpan ulang sebagai
  `.webp` q82 maks 1600 px sebagai jaring pengaman; WebP ≤1600 px dari klien disimpan apa
  adanya (tanpa re-encode). Foto lama sudah di-backfill (`tests/manual/backfill_webp.php`) —
  referensi di JSONB ikut diganti dan file asli dihapus kalau tidak lagi dirujuk. Harness itu
  butuh route dev sementara untuk jalan (folder gallery milik root); hapus route-nya sesudah selesai.

## Yang belum

Endpoint backend `PUT /api/invitations/{invitation}` **sudah ada** dan dipakai
wizard buat-undangan-baru (nama diisi di langkah 2, jadi langkah berikutnya
PATCH, bukan POST kedua).

1. ~~Mailer masih `log`~~ SELESAI — memakai Resend dengan pengirim
   `nikahyuk@pujin.my.id` (domain terverifikasi).
2. **Pembayaran masih driver `fake`** — `PAYMENT_DRIVER=fake` (simulasi lokal lewat
   `php artisan payments:simulate <order_id>`). Midtrans sandbox key sudah terisi di `.env`,
   tapi driver belum dipindah dan `MIDTRANS_WEBHOOK_SECRET` masih kosong. Untuk live: ganti
   driver + isi kredensial produksi + set webhook URL ke domain publik.
3. ~~Deploy produksi belum~~ SELESAI — https://nikahyuk.pujin.my.id lewat
   tunnel Cloudflare bernama `nikahyuk` (config di
   `/opt/data/home/.cloudflared/config.yml`), dijaga watchdog.
4. ~~URL akses masih node Tailscale~~ SELESAI — `FRONTEND_URL` sudah domain sendiri.

Catatan yang pernah salah berulang kali:
- "edit undangan belum ada" (padahal sudah lengkap),
- "template `elegan` belum ikut sistem layout" (padahal komposisinya memang
  disengaja berdiri sendiri).
Sebelum menyatakan sebuah fitur belum ada atau rusak, buka dulu di browser dan
bacalah komponennya — STATUS.md ini ikut kedaluwarsa dan tidak boleh dipercaya
mentah-mentah.

**Harness `verify_task2.php` MENINGGALKAN data uji.** Ia membuat
`owner-a@uji.test` / `owner-b@uji.test` (dan undangan `andi-sari*`) tanpa
membersihkannya di akhir. Jadi setiap kali harness ini dijalankan, jumlah user
dan undangan bertambah. Kalau tiba-tiba ada `owner-@uji.test` atau `andi-sari*`
di DB, itu sampah dari tes, BUKAN serangan dan bukan pengguna baru. Bersihkan
dengan menghapus user bersangkutan berikut undangannya. Itu KELIRU — fiturnya sudah
lengkap: `InvitationEditModal.jsx` (~983 baris) memanggil `invitationsApi.update()`
→ `PUT /api/invitations/{id}`, lengkap dengan validasi sisi klien
(`validateEditForm`) dan pemetaan error server (`mapServerErrors`). Sebelum
menyatakan sebuah fitur belum ada, greplah komponennya — jangan mengandalkan
ingatan.

Yang masih terbuka di sisi produk:
- ~~Template `elegan` belum mengikuti sistem layout baru~~ SELESAI — `coupleLayout` dan `revealBySection` sudah dipetakan di `invitationPayload.js`, `PublicInvitation.jsx`, dan `InvitationPreview.jsx`.
- **Dark mode belum ada** — ditunda sesuai permintaan.

## Verifikasi

Harness manual di `tests/manual/` (bukan PHPUnit), masing-masing mencetak `SUMMARY: N passed`:

```bash
cd /opt/data/projects/nikahyuk
for f in tests/manual/verify_task*.php; do php "$f" | tail -1; done
bash tests/manual/smoke_delete.sh | tail -1
php tests/manual/verify_task2.php && bash tests/manual/smoke_task2.sh | tail -1
```

Status terakhir semua hijau: task2 45/45, task3 24/24, task4 24/24, task5 63/63, task9 27/27,
task10 40/40, task11 20/20, task12 18/18, task13 16/16, smoke_delete 13/13, smoke_task2 13/13,
photo_webp 17/17, admin_free_publish 20/20, change_password 16/16, delete_account 30/30.

**Urutan penting**: `smoke_task2.sh` memakai `/opt/data/cache/scratch/task2_fixtures.json`
(token + id undangan) yang ditulis ulang oleh `verify_task2.php`. **Beberapa harness lain
(`verify_task9.php`, `verify_task3.php`) membersihkan semua user `%@uji.test` di awal/akhir
run** — itu termasuk fixture `owner-a@uji.test` milik task2, jadi undangan `andi-sari`
ikut terhapus. Jalankan `verify_task2.php` tepat sebelum `smoke_task2.sh`, bukan setelah loop penuh.
Kalau smoke gagal 401/404/500, itu fixture basi — bukan bug produk.

`tests/manual/cleanup_task2.php` membersihkan sisa fixture.

Frontend: `cd frontend && npm run lint` (oxlint) dan `npm run build`.
Build terakhir: ~450 kB JS / ~58,7 kB CSS.

Wizard & galeri diuji lewat browser sungguhan (bukan hanya build): pilih template → isi data →
unggah foto → jadikan cover → pratinjau → bayar QRIS simulasi (`php artisan payments:simulate
<order_id>`) → undangan terbit. Perubahan pada `InvitationPreview`/`TemplateCard` sebaiknya
diperiksa dengan mata di `/` (bagian `#template`) karena itu murni soal tampilan.

## Keputusan yang sudah dikunci

- **Transaksi pembayaran tidak pernah ikut terhapus.** Migrasi
  `2026_09_26_120000_retain_transactions_on_invitation_delete` mengubah FK
  `transactions.invitation_id` dari `ON DELETE CASCADE` menjadi `ON DELETE SET NULL`.
  Alasannya: catatan pembayaran adalah dokumen keuangan — rekap pendapatan admin tidak boleh
  berubah mundur hanya karena pemilik menutup akun atau menghapus undangan. Data pribadi hilang
  semua; yang tersisa di `transactions` hanya order_id/amount/status, tanpa identitas tamu.
- **Hapus undangan dan tutup akun berbagi satu jalur**: `app/Support/InvitationDestroyer.php`.
  Dulu `InvitationController::destroy` punya logikanya sendiri; kalau dua jalur berbeda, salah
  satunya bisa meninggalkan berkas foto yatim di `storage/app/public/gallery/`.
- **Jangan taruh rute dev di dalam grup `auth:sanctum`.**Grup itu mengharuskan token; middleware
  autentikasi lalu memanggil `route('login')` yang tidak ada di API, dan hasilnya 500 membingungkan
  ("Route [login] not defined"), bukan 401. Letakkan rute sementara di luar grup.
- **`curl` di PHP CLI tidak mengirim permintaan sebelum `curl_exec()` dipanggil** — memanggil
  `curl_getinfo()` tanpa `curl_exec()` mengembalikan status 0 dengan `curl_error()` kosong, jadi
  terlihat seperti kegagalan jaringan padahal permintaannya tidak pernah dikirim.

## Jebakan yang sudah pernah menggigit

- **`storage/app/public/gallery` dimiliki root** (proses `php artisan serve` jalan sebagai root,
  shell kerja uid 10000): harness CLI tidak bisa menulis/menghapus foto di sana. Uji upload
  wajib lewat HTTP nyata (`verify_photo_webp.php` sudah begitu) atau lewat route dev sementara
  (dipakai `backfill_webp.php`). Jangan andalkan `php` CLI untuk operasi file di `gallery/`.
- **`upload_max_filesize=2M`** di php.ini userland: foto kamera besar langsung ke API gagal
  (422). Klien sudah resize sebelum upload, jadi jalur normal aman.
- **GSAP: jangan tumpuk `data-anim` pada anak di dalam `data-anim="stagger"`** — dua tween
  `gsap.from()` berebut elemen yang sama; yang kedua merekam keadaan sisa tween pertama
  (opacity 0) sebagai nilai akhir, jadi elemen berhenti tak terlihat. Kasus nyata: galeri
  template elegan tampil kosong (foto ada di DOM, opacity 0). Satu sumber animasi per elemen.
- **Vite blokir Host header tunnel** → 403; sudah ditangani `allowedHosts` di `vite.config.js`.
- **Tailscale Funnel butuh `--statedir`** (lihat bagian akses di atas).
- **DNS fake-IP di kontainer** → jangan simpulkan tunnel mati dari curl internal.
- **`img` + `inset` + `width:auto`** = pakai ukuran intrinsik dan meluber keluar layar
  (kasus arch template floral). Selalu set `width`/`height` eksplisit + `object-fit`.
- **Animasi reveal `translate-x-5`** bikin scrollbar horizontal di mobile; ditahan
  `overflow-x: clip` di `html` (pakai `clip`, bukan `hidden`, supaya `position: sticky` tetap jalan).
- **Kontras**: skala rose Tailwind bawaan gagal AA (`rose-300` ≈ 1,9:1 di putih). Nilai oklch
  disetel ulang per template di `templates.css`; jangan kembalikan ke nilai bawaan.
- **Musik tidak autoplay** — kebijakan browser; lagu mulai saat tamu menekan "Buka Undangan".
- **Harness task2**: `verify_task2.php` menguji penolakan `template_name` di luar katalog,
  jadi assertion ownership-nya memakai nilai valid (`minimalis`), bukan string sampah.
- **Proses milik user**: `php artisan serve` (PID root) yang dipakai `payments:simulate`
  jangan dimatikan.
- **Funnel pernah menunjuk dev server Vite** (5173) sehingga halaman terasa sangat lambat
  (~90 s). Sekarang funnel + cloudflared menunjuk `vite preview` 4173 (build `dist/`).
  Mengubah frontend tanpa `npm run build` = tamu masih melihat versi lama. Jangan
  `pkill -f "vite preview"` dari shell interaktif: polanya cocok dengan perintah itu sendiri
  dan sinyalnya balik ke shell Anda (SIGTERM).

## Konvensi kerja

- Bahasa percakapan dengan user: Indonesia, santai. Kode/komentar: Indonesia atau Inggris konsisten.
- Anti-slop: hindari em dash di teks UI; jangan klaim angka tanpa sumber; kontras WCAG AA
  (teks >= 4,5:1, grafik >= 3:1).
- Setelah mengubah backend, jalankan harness yang relevan; setelah mengubah frontend,
  jalankan `npm run lint` + `npm run build`.
