<?php

namespace App\Http\Controllers;

use App\Models\Invitation;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PhotoController extends Controller
{
    use AuthorizesRequests;

    /**
     * Owner: upload satu foto undangan (multipart, field "photo").
     *
     * File disimpan di disk "public" pada folder gallery/<slug>/ dan URL
     * relatif hasilnya dipakai klien lewat template_config.gallery /
     * cover_photo (dipersist via PATCH undangan). Batas 2 MB mengikuti
     * upload_max_filesize php.ini runtime ini; klien memperkecil foto
     * (canvas resize) sebelum mengirim.
     */
    public function store(Request $request, Invitation $invitation): JsonResponse
    {
        $this->authorize('update', $invitation);

        $request->validate([
            'photo' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        $file = $request->file('photo');
        $extension = strtolower($file->guessExtension() ?: 'jpg');
        $path = $file->storeAs(
            "gallery/{$invitation->slug}",
            (string) Str::ulid().'.'.$extension,
            'public',
        );

        return response()->json(['data' => ['url' => '/storage/'.$path]], 201);
    }
}
