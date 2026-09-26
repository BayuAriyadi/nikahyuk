<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InvitationResource extends JsonResource
{
    /**
     * Owner shape — everything the dashboard/editor needs.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'template_name' => $this->template_name,
            'template_config' => $this->template_config,
            'bride_data' => $this->bride_data,
            'event_data' => $this->event_data,
            'status' => $this->status,
            'visit_count' => (int) $this->visit_count,
            'last_visited_at' => $this->last_visited_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
