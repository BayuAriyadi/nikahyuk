<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PublicInvitationResource extends JsonResource
{
    /**
     * Public shape — deliberately excludes owner id, payment data and status.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'slug' => $this->slug,
            'template_name' => $this->template_name,
            'template_config' => $this->template_config,
            'bride_data' => $this->bride_data,
            'event_data' => $this->event_data,
            'guest_count' => $this->whenCounted('guests'),
            'guests' => GuestResource::collection($this->whenLoaded('guests')),
        ];
    }
}
