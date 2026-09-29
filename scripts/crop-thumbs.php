<?php

/**
 * Pangkas dan kompres hasil screenshot mentah menjadi thumbnail galeri.
 *
 *   php scripts/crop-thumbs.php
 *
 * Membaca  frontend/public/thumbs/<nama>_raw.png  (hasil tangkapan layar
 * peramban, ukuran penuh) lalu menulis <nama>.webp berukuran 480x640
 * (aspect 3:4, sama seperti kartu galeri di landing page).
 *
 * Kompresi WebP kualitas 82 mengikuti kebiasaan unggahan galeri di proyek ini:
 * PNG mentah ~40KB jadi ~8-15KB, sehingga enam thumbnail hanya menambah
 * sekitar 60KB pada ukuran build.
 *
 * Ekstensi GD dipakai karena tidak ada ImageMagick maupun PIL di dalam
 * kontainer, dan menambah dependensi baru tidak sebanding dengan manfaatnya
 * untuk alat yang dijalankan sesekali.
 */

$dir = __DIR__.'/../frontend/public/thumbs';
$templates = ['klasik', 'minimalis', 'floral', 'ceria', 'elegan'];

$lebar = 480;
$tinggi = 480;   // 1:1 persegi — grid rapi dan tidak menjulur seperti 3:4
$kualitas = 82;

$totalMentah = 0;
$totalHasil = 0;
$gagal = [];

foreach ($templates as $nama) {
    $src = "{$dir}/{$nama}_raw.png";
    $dst = "{$dir}/{$nama}.webp";

    if (! is_file($src)) {
        $gagal[] = "{$nama}: berkas mentah tidak ada";
        continue;
    }

    $img = @imagecreatefrompng($src);
    if ($img === false) {
        $gagal[] = "{$nama}: PNG tidak bisa dibaca";
        continue;
    }

    $w = imagesx($img);
    $h = imagesy($img);

    // Ambil bagian tengah-atas: di situlah mempelai dan judul berada.
    // Lebar penuh dipakai supaya latar template ikut terlihat.
    $potongH = (int) min($h, $w * ($tinggi / $lebar));
    $potongW = $w;

    // Mengambil dari judul section membuat kartu mempelai kedua kepotong:
    // kartunya tinggi (foto + nama + panggilan + orang tua). Jadi potongan
    // digeser ke bawah melewati judul, langsung ke badan kartu.
    $offsetY = (int) round($w * 0.16);
    if ($offsetY + $potongH > $h) {
        $offsetY = max(0, $h - $potongH);
    }

    $thumb = imagecreatetruecolor($lebar, $tinggi);
    // Latar putih lebih aman daripada hitam kalau PNG-nya ber-transparansi.
    imagefill($thumb, 0, 0, imagecolorallocate($thumb, 255, 255, 255));

    imagecopyresampled(
        $thumb, $img,
        0, 0,
        0, $offsetY,
        $lebar, $tinggi,
        $potongW, $potongH
    );

    if (! imagewebp($thumb, $dst, $kualitas)) {
        $gagal[] = "{$nama}: gagal menulis WebP";
        continue;
    }

    $sizeMentah = filesize($src);
    $sizeHasil = filesize($dst);
    $totalMentah += $sizeMentah;
    $totalHasil += $sizeHasil;

    printf(
        "  %-11s %5dx%-5d -> %5dx%-5d  %6.1fKB -> %5.1fKB\n",
        $nama, $w, $h, $lebar, $tinggi,
        $sizeMentah / 1024, $sizeHasil / 1024
    );

}

echo "\nTotal: ".round($totalMentah / 1024, 1)."KB -> ".round($totalHasil / 1024, 1)."KB\n";

if ($gagal !== []) {
    echo "\nGAGAL:\n - ".implode("\n - ", $gagal)."\n";
    exit(1);
}

echo "Thumbnail siap di {$dir}\n";
