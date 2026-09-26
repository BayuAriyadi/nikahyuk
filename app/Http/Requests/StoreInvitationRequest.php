<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreInvitationRequest extends FormRequest
{
    /**
     * Any authenticated user may create an invitation.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'slug' => [
                'nullable',
                'string',
                'max:60',
                'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('invitations', 'slug'),
            ],
            'template_name' => ['required', 'string', 'in:klasik,minimalis,floral,ceria,elegan'],

            // ----- template_config (JSONB) -----
            'template_config' => ['nullable', 'array'],
            'template_config.palette' => ['nullable', 'array'],
            'template_config.palette.primary' => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'template_config.palette.secondary' => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'template_config.palette.accent' => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'template_config.font' => ['nullable', 'array'],
            'template_config.font.heading' => ['nullable', 'string', 'max:50'],
            'template_config.font.body' => ['nullable', 'string', 'max:50'],
            'template_config.music_url' => ['nullable', 'string', 'max:500', 'regex:#^(https?://|/storage/music/)[A-Za-z0-9._/@:?&=%~-]*$#'],
            'template_config.music_enabled' => ['nullable', 'boolean'],
            'template_config.music_title' => ['nullable', 'string', 'max:100'],
            'template_config.gallery' => ['nullable', 'array', 'max:30'],
            'template_config.gallery.*' => ['string', 'max:255', 'regex:~^/storage/gallery/[A-Za-z0-9._/-]+$~'],
            'template_config.cover_photo' => ['nullable', 'string', 'max:255', 'regex:~^/storage/gallery/[A-Za-z0-9._/-]+$~'],
            'template_config.gift' => ['nullable', 'array'],
            'template_config.gift.enabled' => ['nullable', 'boolean'],
            'template_config.gift.accounts' => ['nullable', 'array', 'max:10'],
            'template_config.gift.accounts.*' => ['array'],
            'template_config.gift.accounts.*.bank' => ['required', 'string', 'max:50'],
            'template_config.gift.accounts.*.number' => ['required', 'string', 'max:50'],
            'template_config.gift.accounts.*.name' => ['required', 'string', 'max:100'],

            // ----- bride_data (JSONB) -----
            'bride_data' => ['required', 'array'],
            'bride_data.groom' => ['required', 'array'],
            'bride_data.groom.name' => ['required', 'string', 'max:100'],
            'bride_data.groom.nick' => ['nullable', 'string', 'max:50'],
            'bride_data.groom.father' => ['nullable', 'string', 'max:100'],
            'bride_data.groom.mother' => ['nullable', 'string', 'max:100'],
            'bride_data.groom.instagram' => ['nullable', 'string', 'max:50', 'regex:/^[A-Za-z0-9._]+$/'],
            'bride_data.groom.photo' => ['nullable', 'string', 'max:255', 'regex:~^/storage/gallery/[A-Za-z0-9._/-]+$~'],
            'bride_data.bride' => ['required', 'array'],
            'bride_data.bride.name' => ['required', 'string', 'max:100'],
            'bride_data.bride.nick' => ['nullable', 'string', 'max:50'],
            'bride_data.bride.father' => ['nullable', 'string', 'max:100'],
            'bride_data.bride.mother' => ['nullable', 'string', 'max:100'],
            'bride_data.bride.instagram' => ['nullable', 'string', 'max:50', 'regex:/^[A-Za-z0-9._]+$/'],
            'bride_data.bride.photo' => ['nullable', 'string', 'max:255', 'regex:~^/storage/gallery/[A-Za-z0-9._/-]+$~'],
            'bride_data.story' => ['nullable', 'array', 'max:20'],
            'bride_data.story.*' => ['array'],
            'bride_data.story.*.title' => ['required', 'string', 'max:100'],
            'bride_data.story.*.date' => ['nullable', 'string', 'max:50'],
            'bride_data.story.*.text' => ['required', 'string', 'max:1000'],

            // ----- event_data (JSONB) -----
            'event_data' => ['nullable', 'array'],
            'event_data.akad' => ['nullable', 'array'],
            'event_data.akad.date' => ['required_with:event_data.akad', 'date_format:Y-m-d'],
            'event_data.akad.time' => ['nullable', 'date_format:H:i'],
            'event_data.akad.venue' => ['required_with:event_data.akad', 'string', 'max:150'],
            'event_data.akad.address' => ['nullable', 'string', 'max:300'],
            'event_data.akad.maps_url' => ['nullable', 'url', 'max:500'],
            'event_data.resepsi' => ['nullable', 'array'],
            'event_data.resepsi.date' => ['required_with:event_data.resepsi', 'date_format:Y-m-d'],
            'event_data.resepsi.time' => ['nullable', 'date_format:H:i'],
            'event_data.resepsi.venue' => ['required_with:event_data.resepsi', 'string', 'max:150'],
            'event_data.resepsi.address' => ['nullable', 'string', 'max:300'],
            'event_data.resepsi.maps_url' => ['nullable', 'url', 'max:500'],
        ];
    }
}
