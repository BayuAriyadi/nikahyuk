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
  Nama itu harus sama persis di empat tempat: katalog JS, blok `[data-template=...]` di
  `frontend/src/templates.css`, rule `in:` backend, dan `$catalog` di
  `tests/manual/verify_task13.php` (harness itu sengaja memeriksa katalog penuh).
- `invitations.visit_count` + `last_visited_at`: dihitung di `GET /api/invitations/{slug}`,
  dedupe 30 menit per IP+slug, increment atomic di SQL. Tidak ikut payload publik.
- JSONB di-whitelist lewat `app/Support/JsonbPayload.php`; field yang dikosongkan dikirim `null`
  supaya terhapus dari JSONB.

## Yang sudah selesai

Fase 1-4 PRD selesai, plus: hapus undangan, Cerita Kita (love story), statistik kunjungan,
multi-template penuh (klasik / minimalis / floral / ceria dengan layout + animasi berbeda), **galeri
template di landing page**, dan **wizard 5 langkah "Buat Undangan Baru"** (pilih template →
data mempelai → detail acara → foto & cerita → pratinjau & terbit/bayar).

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

1. **Mailer masih `log`** — tautan reset password hanya muncul di `storage/logs/laravel.log`.
   Untuk produksi: `MAIL_MAILER=smtp` + kredensial SMTP. Butuh keputusan/kredensial user.
   Terkait: `FRONTEND_URL` di `.env` masih `http://100.66.135.80:5173` (node Tailscale lama
   yang sudah offline) — ganti ke URL funnel/domain final supaya tautan reset tidak mati.
2. **Pembayaran masih driver `fake`** — `PAYMENT_DRIVER=fake` (simulasi lokal lewat
   `php artisan payments:simulate <order_id>`). Midtrans sandbox key sudah terisi di `.env`,
   tapi driver belum dipindah dan `MIDTRANS_WEBHOOK_SECRET` masih kosong. Untuk live: ganti
   driver + isi kredensial produksi + set webhook URL ke domain publik.
3. **Deploy produksi belum** — belum ada host/domain final. Opsional: subdomain
   `undangan.pujin.my.id` lewat Cloudflare Tunnel bernama (butuh 1 klik login Cloudflare dari user).
4. **URL akses** masih nama node Tailscale (`7e07bbd09d70.tail099f48.ts.net`), belum domain cantik.

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
photo_webp 17/17, admin_free_publish 20/20.

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
