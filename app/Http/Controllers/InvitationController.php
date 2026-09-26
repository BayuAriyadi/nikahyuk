<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreInvitationRequest;
use App\Http\Requests\UpdateInvitationRequest;
use App\Http\Resources\InvitationResource;
use App\Http\Resources\PublicInvitationResource;
use App\Models\Invitation;
use App\Support\JsonbPayload;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class InvitationController extends Controller
{
    use AuthorizesRequests;

    /**
     * Public: published invitation by slug, complete with guest book messages.
     *
     * Kunjungan dihitung di sini (bukan endpoint terpisah) supaya statistik
     * tidak bisa dinaikkan orang luar tanpa benar-benar membuka undangan.
     * Satu pengunjung dihitung sekali per 30 menit (cache key per IP+slug),
     * jadi refresh berulang dan reload tidak menggelembungkan angka.
     */
    public function show(string $slug): PublicInvitationResource
    {
        $invitation = Invitation::query()
            ->where('slug', $slug)
            ->where('status', 'published')
            ->with(['guests' => fn ($query) => $query->latest()->limit(200)])
            ->withCount('guests')
            ->firstOrFail();

        $this->recordVisit($invitation, request()->ip());

        return new PublicInvitationResource($invitation);
    }

    /**
     * Catat satu kunjungan unik (per IP per 30 menit) untuk undangan ini.
     */
    private function recordVisit(Invitation $invitation, ?string $ip): void
    {
        $key = 'visit:'.$invitation->id.':'.sha1((string) $ip);

        if (! Cache::add($key, true, now()->addMinutes(30))) {
            return;
        }

        // Increment atomic di level SQL: dua kunjungan bersamaan tetap
        // terhitung dua, tanpa race baca-lalu-tulis di PHP.
        $invitation->newQuery()
            ->whereKey($invitation->getKey())
            ->update([
                'visit_count' => DB::raw('visit_count + 1'),
                'last_visited_at' => now(),
            ]);

        // Resource dibentuk dari instance yang sudah dibaca sebelum increment;
        // samakan nilainya supaya pemilik yang membuka lewat dashboard pun
        // melihat angka terbaru.
        $invitation->forceFill([
            'visit_count' => $invitation->visit_count + 1,
            'last_visited_at' => now(),
        ]);
    }

    /**
     * Authenticated: list the current user's invitations (newest first).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $invitations = $request->user()
            ->invitations()
            ->latest()
            ->get();

        return InvitationResource::collection($invitations);
    }

    /**
     * Authenticated: create a new invitation (always starts as a draft).
     */
    public function store(StoreInvitationRequest $request): JsonResponse
    {
        $data = $request->validated();

        $invitation = $request->user()->invitations()->create([
            'slug' => $this->uniqueSlug($data['bride_data'], $data['slug'] ?? null),
            'template_name' => $data['template_name'],
            'template_config' => isset($data['template_config'])
                ? JsonbPayload::clean('template_config', $data['template_config'])
                : null,
            'bride_data' => JsonbPayload::clean('bride_data', $data['bride_data']),
            'event_data' => isset($data['event_data'])
                ? JsonbPayload::clean('event_data', $data['event_data'])
                : null,
            'status' => 'draft',
        ]);

        return (new InvitationResource($invitation))->response()->setStatusCode(201);
    }

    /**
     * Authenticated (owner): update an invitation.
     *
     * JSONB columns are deep-merged, so sending a single nested key never
     * wipes the rest of the column. Kirim sebuah key sebagai null untuk
     * menghapusnya (dipakai editor untuk mengosongkan field opsional).
     */
    public function update(UpdateInvitationRequest $request, Invitation $invitation): InvitationResource
    {
        $this->authorize('update', $invitation);

        $data = $request->validated();

        $oldPhotos = $this->photoUrls($invitation);

        $invitation->fill(Arr::only($data, ['slug', 'template_name', 'status']));

        foreach (['template_config', 'bride_data', 'event_data'] as $column) {
            if (! array_key_exists($column, $data)) {
                continue;
            }

            $invitation->{$column} = $data[$column] === null
                ? null
                : JsonbPayload::stripCleared(
                    JsonbPayload::merge(
                        (array) ($invitation->{$column} ?? []),
                        JsonbPayload::clean($column, $data[$column]),
                    ),
                    $data[$column],
                );
        }

        $invitation->save();

        $invitation = $invitation->fresh();
        $this->pruneRemovedPhotos($invitation, $oldPhotos);

        return new InvitationResource($invitation);
    }

    /**
     * Authenticated (owner): hapus undangan secara permanen.
     *
     * Foto di disk ikut dibuang; tamu, ucapan, dan transaksi terhapus lewat
     * foreign key cascade (lihat migration: cascadeOnDelete). Balasan 204.
     */
    public function destroy(Invitation $invitation): Response
    {
        $this->authorize('delete', $invitation);

        foreach ($this->photoUrls($invitation) as $url) {
            if (str_starts_with($url, '/storage/')) {
                Storage::disk('public')->delete(Str::after($url, '/storage/'));
            }
        }

        // Sapu sisa berkas di folder galeri dan musik milik undangan ini.
        Storage::disk('public')->deleteDirectory('gallery/'.$invitation->slug);
        Storage::disk('public')->deleteDirectory('music/'.$invitation->slug);

        $invitation->delete();

        return response()->noContent();
    }

    /**
     * Hapus file foto yang tidak lagi direferensikan undangan (dibuang dari
     * galeri, diganti sebagai cover, atau dilepas dari foto profil mempelai).
     * Hanya folder galeri milik undangan ini yang boleh tersentuh.
     */
    private function pruneRemovedPhotos(Invitation $invitation, array $oldPhotos): void
    {
        $keep = $this->photoUrls($invitation);

        $prefix = '/storage/gallery/'.$invitation->slug.'/';

        foreach (array_diff($oldPhotos, $keep) as $url) {
            if (! is_string($url) || ! str_starts_with($url, $prefix)) {
                continue;
            }

            Storage::disk('public')->delete(Str::after($url, '/storage/'));
        }
    }

    /**
     * Semua URL foto yang sedang dipakai undangan: galeri, cover, dan foto
     * profil kedua mempelai.
     *
     * @return list<string>
     */
    private function photoUrls(Invitation $invitation): array
    {
        $urls = array_merge(
            (array) data_get($invitation->template_config, 'gallery', []),
            [
                data_get($invitation->template_config, 'cover_photo'),
                data_get($invitation->bride_data, 'groom.photo'),
                data_get($invitation->bride_data, 'bride.photo'),
            ],
        );

        return array_values(array_filter($urls, fn ($url) => is_string($url) && $url !== ''));
    }

    /**
     * Build a unique slug; falls back to "<groom>-<bride>" from bride_data.
     */
    private function uniqueSlug(array $brideData, ?string $requested): string
    {
        $base = $requested ?? Str::slug(sprintf(
            '%s-%s',
            $brideData['groom']['nick'] ?? $brideData['groom']['name'],
            $brideData['bride']['nick'] ?? $brideData['bride']['name'],
        ));

        $base = $base !== '' ? $base : 'undangan';

        $slug = $base;
        $suffix = 2;

        while (Invitation::query()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$suffix++;

            if ($suffix > 100) {
                $slug = $base.'-'.Str::lower(Str::random(8));

                break;
            }
        }

        return $slug;
    }
}
