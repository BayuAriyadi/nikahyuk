<?php

namespace App\Http\Controllers;

use App\Models\Invitation;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MusicController extends Controller
{
    use AuthorizesRequests;

    /**
     * Owner: upload satu berkas musik latar (multipart, field "music").
     *
     * File disimpan di disk "public" pada folder music/<slug>/ dan URL
     * relatif hasilnya dipakai klien lewat template_config.music_url
     * (dipersist via PATCH undangan). Batas 2 MB mengikuti upload_max_filesize
     * php.ini runtime ini; itu setara ± 2 menit MP3 128 kbps.
     */
    public function store(Request $request, Invitation $invitation): JsonResponse
    {
        $this->authorize('update', $invitation);

        $request->validate([
            'music' => ['required', 'file', 'mimes:mp3,mpeg,mpga,ogg,oga,wav,m4a,aac', 'max:2048'],
        ]);

        $file = $request->file('music');
        $extension = strtolower($file->guessExtension() ?: 'mp3');

        $path = $file->storeAs(
            "music/{$invitation->slug}",
            (string) Str::ulid().'.'.$extension,
            'public',
        );

        // Satu undangan satu lagu: buang berkas lain di folder ini, baik itu
        // lagu lama (sudah tersimpan) maupun unggahan beruntun yang belum
        // ditekan Simpan Perubahan. Dilakukan setelah berkas baru mendarat
        // supaya tidak ada momen tanpa lagu.
        foreach (Storage::disk('public')->files("music/{$invitation->slug}") as $existing) {
            if ($existing !== $path) {
                Storage::disk('public')->delete($existing);
            }
        }

        return response()->json(['data' => ['url' => '/storage/'.$path]], 201);
    }
}
