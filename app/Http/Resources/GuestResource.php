<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GuestResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'rsvp_status' => $this->rsvp_status,
            'message' => $this->message,
            'created_at' => $this->created_at?->toIso8601String(),
            'invitation' => $this->whenLoaded('invitation', fn () => [
                'id' => $this->invitation->id,
                'slug' => $this->invitation->slug,
                'status' => $this->invitation->status,
                'groom' => $this->invitation->bride_data['groom']['name'] ?? null,
                'bride' => $this->invitation->bride_data['bride']['name'] ?? null,
            ]),
        ];
    }
}
