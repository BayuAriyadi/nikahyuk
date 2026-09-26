<?php

namespace App\Http\Controllers;

use App\Models\Invitation;
use GdImage;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class PhotoController extends Controller
{
    use AuthorizesRequests;

    /** Sisi terpanjang hasil resize (px) — cukup untuk layar HP/desktop. */
    private const MAX_DIMENSION = 1600;

    /** Kualitas WebP (0-100). 82 ≈ JPEG 88 secara visual, jauh lebih kecil. */
    private const WEBP_QUALITY = 82;

    /**
     * Owner: upload satu foto undangan (multipart, field "photo").
     *
     * Foto dinormalisasi ke WebP (maks 1600 px, kualitas 82) — hemat ~60-70%
     * bandwidth vs JPEG saat halaman undangan dibuka tamu. Klien modern
     * sudah mengirim WebP hasil canvas; file seperti itu disimpan apa adanya
     * (tanpa re-encode), sisanya dikonversi server sebagai jaring pengaman
     * untuk upload langsung ke API.
     *
     * File disimpan di disk "public" pada folder gallery/<slug>/ dan URL
     * relatifnya dipakai klien lewat template_config.gallery / cover_photo
     * (dipersist via PATCH undangan).
     */
    public function store(Request $request, Invitation $invitation): JsonResponse
    {
        $this->authorize('update', $invitation);

        $request->validate([
            'photo' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        $file = $request->file('photo');
        $path = "gallery/{$invitation->slug}/".Str::ulid().'.webp';

        // Klien modern sudah mengirim WebP ≤ 1600 px: simpan apa adanya —
        // menghindari kompresi ganda dan decode ulang yang tidak perlu.
        $probe = @getimagesize($file->getRealPath());

        if ($probe && ($probe['mime'] ?? null) === 'image/webp' && max($probe[0], $probe[1]) <= self::MAX_DIMENSION) {
            Storage::disk('public')->put($path, (string) file_get_contents($file->getRealPath()));

            return response()->json(['data' => ['url' => '/storage/'.$path]], 201);
        }

        $image = @imagecreatefromstring((string) file_get_contents($file->getRealPath()));

        if ($image === false) {
            return response()->json(['message' => 'Gambar tidak bisa dibaca.'], 422);
        }

        $image = $this->fitToMax($image, self::MAX_DIMENSION);

        // PNG palet / dengan alpha: pastikan alpha ikut tersimpan di WebP.
        if (! imageistruecolor($image)) {
            imagepalettetotruecolor($image);
        }
        imagealphablending($image, false);
        imagesavealpha($image, true);

        ob_start();
        imagewebp($image, null, self::WEBP_QUALITY);
        $bytes = (string) ob_get_clean();
        imagedestroy($image);

        Storage::disk('public')->put($path, $bytes);

        return response()->json(['data' => ['url' => '/storage/'.$path]], 201);
    }

    /** Perkecil gambar proporsional bila sisi terpanjang melebihi $max. */
    private function fitToMax(GdImage $image, int $max): GdImage
    {
        $width = imagesx($image);
        $height = imagesy($image);

        if (max($width, $height) <= $max) {
            return $image;
        }

        $scale = $max / max($width, $height);
        $resized = imagescale($image, (int) round($width * $scale), (int) round($height * $scale), IMG_BICUBIC);

        if ($resized === false) {
            return $image;
        }

        imagedestroy($image);

        return $resized;
    }
}
