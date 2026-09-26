<?php

/**
 * Backfill sekali jalan: konversi foto gallery lama (jpg/png) ke WebP
 * (maks 1600 px, kualitas 82) + ganti referensinya di kolom JSON undangan
 * (template_config, bride_data, event_data).
 *
 * File asli hanya dihapus kalau sudah TIDAK ADA lagi referensinya di DB.
 *
 * Run: php tests/manual/backfill_webp.php   (dari root project)
 */

$base = dirname(__DIR__, 2);

// Dipanggil dari CLI: bootstrap sendiri. Dipanggil dari route (proses php
// serve yang jalan sebagai root): Laravel sudah boot, langsung pakai.
if (PHP_SAPI === 'cli') {
    require $base.'/vendor/autoload.php';

    $app = require $base.'/bootstrap/app.php';
    $kernel = $app->make(\Illuminate\Contracts\Http\Kernel::class);
    $kernel->bootstrap();
}

use App\Models\Invitation;
use Illuminate\Support\Facades\Storage;

$MAX_DIMENSION = 1600;
$QUALITY = 82;

function convertToWebp(string $absPath, string $targetAbsPath, int $maxDimension, int $quality): bool
{
    $image = @imagecreatefromstring((string) file_get_contents($absPath));
    if ($image === false) {
        echo "  SKIP (tidak terbaca): {$absPath}\n";

        return false;
    }

    $width = imagesx($image);
    $height = imagesy($image);

    if (max($width, $height) > $maxDimension) {
        $scale = $maxDimension / max($width, $height);
        $resized = imagescale($image, max(1, (int) round($width * $scale)), max(1, (int) round($height * $scale)), IMG_BICUBIC);
        if ($resized !== false) {
            imagedestroy($image);
            $image = $resized;
        }
    }

    if (! imageistruecolor($image)) {
        imagepalettetotruecolor($image);
    }
    imagealphablending($image, false);
    imagesavealpha($image, true);

    ob_start();
    imagewebp($image, null, $quality);
    $bytes = (string) ob_get_clean();
    imagedestroy($image);

    file_put_contents($targetAbsPath, $bytes);

    return true;
}

$galleryRoot = storage_path('app/public/gallery');
$files = glob($galleryRoot.'/*/*.{jpg,jpeg,JPG,JPEG,png,PNG}', GLOB_BRACE) ?: [];

echo "== Konversi ".count($files)." file ===\n";

/** @var array<string,string> peta '/storage/...jpg' => '/storage/...webp' */
$map = [];
$savedBytes = 0;

foreach ($files as $absPath) {
    $relative = substr($absPath, strlen(storage_path('app/public')));          // /gallery/<slug>/<file>.jpg
    $targetRelative = preg_replace('/\.(jpe?g|png)$/i', '.webp', $relative);   // /gallery/<slug>/<file>.webp
    $targetAbs = storage_path('app/public').$targetRelative;

    if (file_exists($targetAbs)) {
        echo "  ada webp: {$relative} (lewati)\n";
        $map['/storage'.$relative] = '/storage'.$targetRelative;

        continue;
    }

    if (! convertToWebp($absPath, $targetAbs, $MAX_DIMENSION, $QUALITY)) {
        continue;
    }

    $oldSize = filesize($absPath);
    $newSize = filesize($targetAbs);
    $savedBytes += max(0, $oldSize - $newSize);

    $map['/storage'.$relative] = '/storage'.$targetRelative;
    printf("  %s: %.0f KB -> %.0f KB\n", basename($absPath), $oldSize / 1024, $newSize / 1024);
}

echo "== Update referensi JSON di tabel invitations ==\n";

$columns = ['template_config', 'bride_data', 'event_data'];
$updated = 0;

foreach (Invitation::query()->get() as $invitation) {
    $changed = false;

    foreach ($columns as $column) {
        $value = $invitation->{$column};
        if ($value === null) {
            continue;
        }

        $json = json_encode($value, JSON_UNESCAPED_SLASHES);
        $patched = str_replace(array_keys($map), array_values($map), $json);

        if ($patched !== $json) {
            $invitation->{$column} = json_decode($patched, true);
            $changed = true;
        }
    }

    if ($changed) {
        $invitation->save();
        $updated++;
        echo "  updated: {$invitation->slug}\n";
    }
}

echo "== Hapus file asli yang sudah tak direferensikan ==\n";

// Blob semua kolom JSON undangan (JSON_UNESCAPED_SLASHES supaya /storage/...
// utuh) — cek referensi di PHP, tidak lewat SQL cast yang rawan beda dialek.
$referencedBlob = '';
foreach (Invitation::query()->get() as $invitation) {
    foreach ($columns as $column) {
        $referencedBlob .= json_encode($invitation->{$column}, JSON_UNESCAPED_SLASHES).' ';
    }
}

$deleted = 0;

foreach ($files as $absPath) {
    $relative = substr($absPath, strlen(storage_path('app/public')));
    $url = '/storage'.$relative;
    $webpAbs = preg_replace('/\.(jpe?g|png)$/i', '.webp', $absPath);

    if (! file_exists($webpAbs)) {
        echo "  webp belum ada, skip hapus: {$url}\n";

        continue;
    }

    if (str_contains($referencedBlob, $url)) {
        echo "  MASIH DIPAKAI, tidak dihapus: {$url}\n";

        continue;
    }

    unlink($absPath);
    $deleted++;
}

printf("\n== Selesai: %d undangan diupdate, %d file asli dihapus, hemat %.0f KB ==\n", $updated, $deleted, $savedBytes / 1024);
