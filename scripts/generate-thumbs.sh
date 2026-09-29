#!/usr/bin/env bash
# Satu perintah untuk memperbarui seluruh thumbnail galeri template.
#
#   scripts/generate-thumbs.sh
#
# Tahapannya:
#   1. Buka setiap undangan demo lewat Chromium-nya Hermes (proyek ini sengaja
#      TANPA playwright/puppeteer — menambahnya berarti +300MB dependensi untuk
#      alat yang dipakai sesekali), lalu simpan tangkapan layarnya.
#   2. Pangkas dan kompres PNG itu menjadi WebP 480x600 melalui GD.
#
# Kalau menambah template baru, daftarkan juga slug demo-nya di sini supaya
# thumbnail-nya ikut terbuat.
set -euo pipefail

BASE="${BASE_URL:-http://127.0.0.1:4173}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
THUMBS="$ROOT/frontend/public/thumbs"

TEMPLATES=(klasik minimalis floral ceria elegan)

echo "== tangkap layar dari $BASE =="
for t in "${TEMPLATES[@]}"; do
  slug="demo-$t"
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/$slug" || true)
  if [ "$code" != "200" ]; then
    echo "  LEWATI $t: /$slug tidak merespons (HTTP $code)"
  else
    echo "  siap $t -> /$slug"
  fi
done

echo
echo "Tangkapan layar diambil lewat perintah tempel browser Hermes:"
echo "  1. goto_url(\$BASE/demo-<template>) lalu wait_for_load()"
echo "  2. tunggu ~4 detik agar animasi reveal selesai; menyaring lebih awal"
echo "     menghasilkan kartu KOSONG karena elemen masih opacity 0"
echo "  3. gulir ke #mempelai, lalu capture_screenshot()"
echo "  4. salin hasilnya ke frontend/public/thumbs/<template>_raw.png"

echo
echo "== pangkas dan kompres =="
/opt/data/bin/php "$ROOT/scripts/crop-thumbs.php"

echo
echo "== bersihkan berkas mentah (jangan ikut ke build) =="
rm -f "$THUMBS"/*_raw.png

echo
echo "Selesai. Isi $THUMBS:"
ls -la "$THUMBS" | awk 'NR>3 {printf "  %-16s %6.1fKB\n", $9, $5/1024}'
