<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateInvitationRequest extends FormRequest
{
    /**
     * Any authenticated user may hit the endpoint; ownership is enforced by
     * InvitationPolicy in the controller.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Every field is optional; provided fields are still fully validated.
     * JSONB leaves are validated per key because updates deep-merge.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'slug' => [
                'sometimes',
                'string',
                'max:60',
                'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('invitations', 'slug')->ignore($this->route('invitation')),
            ],
            'template_name' => ['sometimes', 'string', 'in:klasik,minimalis,floral,ceria,elegan'],
            'status' => ['sometimes', 'string', 'in:draft,published'],

            // ----- template_config (JSONB) -----
            'template_config' => ['sometimes', 'nullable', 'array'],
            'template_config.palette' => ['sometimes', 'nullable', 'array'],
            'template_config.palette.primary' => ['sometimes', 'nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'template_config.palette.secondary' => ['sometimes', 'nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'template_config.palette.accent' => ['sometimes', 'nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'template_config.font' => ['sometimes', 'nullable', 'array'],
            'template_config.font.heading' => ['sometimes', 'nullable', 'string', 'max:50'],
            'template_config.font.body' => ['sometimes', 'nullable', 'string', 'max:50'],
            'template_config.music_url' => ['sometimes', 'nullable', 'string', 'max:500', 'regex:#^(https?://|/storage/music/)[A-Za-z0-9._/@:?&=%~-]*$#'],
            'template_config.music_enabled' => ['sometimes', 'nullable', 'boolean'],
            'template_config.music_title' => ['sometimes', 'nullable', 'string', 'max:100'],
            'template_config.gallery' => ['sometimes', 'array', 'max:30'],
            'template_config.gallery.*' => ['string', 'max:255', 'regex:~^/storage/gallery/[A-Za-z0-9._/-]+$~'],
            'template_config.cover_photo' => ['nullable', 'string', 'max:255', 'regex:~^/storage/gallery/[A-Za-z0-9._/-]+$~'],
            'template_config.gift' => ['sometimes', 'nullable', 'array'],
            'template_config.gift.enabled' => ['sometimes', 'nullable', 'boolean'],
            'template_config.gift.accounts' => ['sometimes', 'nullable', 'array', 'max:10'],
            'template_config.gift.accounts.*' => ['array'],
            'template_config.gift.accounts.*.bank' => ['required', 'string', 'max:50'],
            'template_config.gift.accounts.*.number' => ['required', 'string', 'max:50'],
            'template_config.gift.accounts.*.name' => ['required', 'string', 'max:100'],

            // ----- bride_data (JSONB) -----
            'bride_data' => ['sometimes', 'nullable', 'array'],
            'bride_data.groom' => ['sometimes', 'nullable', 'array'],
            'bride_data.groom.name' => ['sometimes', 'nullable', 'string', 'max:100'],
            'bride_data.groom.nick' => ['sometimes', 'nullable', 'string', 'max:50'],
            'bride_data.groom.father' => ['sometimes', 'nullable', 'string', 'max:100'],
            'bride_data.groom.mother' => ['sometimes', 'nullable', 'string', 'max:100'],
            'bride_data.groom.instagram' => ['sometimes', 'nullable', 'string', 'max:50', 'regex:/^[A-Za-z0-9._]+$/'],
            'bride_data.groom.photo' => ['sometimes', 'nullable', 'string', 'max:255', 'regex:~^/storage/gallery/[A-Za-z0-9._/-]+$~'],
            'bride_data.bride' => ['sometimes', 'nullable', 'array'],
            'bride_data.bride.name' => ['sometimes', 'nullable', 'string', 'max:100'],
            'bride_data.bride.nick' => ['sometimes', 'nullable', 'string', 'max:50'],
            'bride_data.bride.father' => ['sometimes', 'nullable', 'string', 'max:100'],
            'bride_data.bride.mother' => ['sometimes', 'nullable', 'string', 'max:100'],
            'bride_data.bride.instagram' => ['sometimes', 'nullable', 'string', 'max:50', 'regex:/^[A-Za-z0-9._]+$/'],
            'bride_data.bride.photo' => ['sometimes', 'nullable', 'string', 'max:255', 'regex:~^/storage/gallery/[A-Za-z0-9._/-]+$~'],
            'bride_data.story' => ['sometimes', 'nullable', 'array', 'max:20'],
            'bride_data.story.*' => ['array'],
            'bride_data.story.*.title' => ['required', 'string', 'max:100'],
            'bride_data.story.*.date' => ['nullable', 'string', 'max:50'],
            'bride_data.story.*.text' => ['required', 'string', 'max:1000'],

            // ----- event_data (JSONB) -----
            'event_data' => ['sometimes', 'nullable', 'array'],
            'event_data.akad' => ['sometimes', 'nullable', 'array'],
            'event_data.akad.date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'event_data.akad.time' => ['sometimes', 'nullable', 'date_format:H:i'],
            'event_data.akad.venue' => ['sometimes', 'nullable', 'string', 'max:150'],
            'event_data.akad.address' => ['sometimes', 'nullable', 'string', 'max:300'],
            'event_data.akad.maps_url' => ['sometimes', 'nullable', 'url', 'max:500'],
            'event_data.resepsi' => ['sometimes', 'nullable', 'array'],
            'event_data.resepsi.date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'event_data.resepsi.time' => ['sometimes', 'nullable', 'date_format:H:i'],
            'event_data.resepsi.venue' => ['sometimes', 'nullable', 'string', 'max:150'],
            'event_data.resepsi.address' => ['sometimes', 'nullable', 'string', 'max:300'],
            'event_data.resepsi.maps_url' => ['sometimes', 'nullable', 'url', 'max:500'],
        ];
    }
}
