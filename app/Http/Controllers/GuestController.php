<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreGuestRequest;
use App\Http\Resources\GuestResource;
use App\Models\Guest;
use App\Models\Invitation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;

class GuestController extends Controller
{
    /**
     * Authenticated: semua tamu dari undangan milik user
     * (dashboard "Daftar Tamu" & "Buku Ucapan", fase 3).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $guests = Guest::query()
            ->whereHas('invitation', fn ($query) => $query->where('user_id', $request->user()->id))
            ->with('invitation')
            ->latest()
            ->get();

        return GuestResource::collection($guests);
    }

    /**
     * Public: a guest submits an RSVP + message on a published invitation.
     *
     * Kalau nama ini sudah ada di daftar tamu undangan tersebut (ditambahkan
     * pemiliknya lewat dashboard, mis. untuk dikirimi tautan WhatsApp pribadi),
     * baris itu yang diperbarui, supaya rekap kehadiran tidak dobel.
     */
    public function store(StoreGuestRequest $request, string $slug): JsonResponse
    {
        $invitation = Invitation::query()
            ->where('slug', $slug)
            ->where('status', 'published')
            ->firstOrFail();

        $data = $request->validated();

        $guest = $invitation->guests()
            ->whereRaw('lower(name) = lower(?)', [$data['name']])
            ->first();

        if ($guest) {
            $guest->rsvp_status = $data['rsvp_status'];

            if (! empty($data['message'])) {
                $guest->message = $data['message'];
            }

            $guest->save();
        } else {
            $guest = $invitation->guests()->create($data);
        }

        return (new GuestResource($guest))->response()->setStatusCode(201);
    }

    /**
     * Authenticated (owner): tambah satu nama ke daftar tamu undangan sendiri.
     * Tamu yang ditambahkan manual mulai dari status "pending".
     */
    public function storeOwned(Request $request): JsonResponse
    {
        $data = $request->validate([
            'invitation_id' => ['required', 'uuid'],
            'name' => ['required', 'string', 'max:100'],
        ]);

        $invitation = $request->user()->invitations()->findOrFail($data['invitation_id']);

        $name = trim(strip_tags($data['name']));

        if ($name === '') {
            throw ValidationException::withMessages(['name' => 'Nama tamu tidak boleh kosong.']);
        }

        $guest = $invitation->guests()->create([
            'name' => $name,
            'rsvp_status' => 'pending',
        ]);

        return (new GuestResource($guest))->response()->setStatusCode(201);
    }

    /**
     * Authenticated (owner): hapus satu tamu dari daftar.
     */
    public function destroy(Request $request, Guest $guest): Response
    {
        abort_unless($guest->invitation->user_id === $request->user()->id, 403);

        $guest->delete();

        return response()->noContent();
    }
}
