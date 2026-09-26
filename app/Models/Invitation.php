<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'user_id',
    'slug',
    'template_name',
    'template_config',
    'bride_data',
    'event_data',
    'status',
])]
class Invitation extends Model
{
    use HasFactory, HasUuids;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'template_config' => 'array',
            'bride_data' => 'array',
            'event_data' => 'array',
            'last_visited_at' => 'datetime',
        ];
    }

    /**
     * The user who owns this invitation.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Guest list of this invitation.
     */
    public function guests(): HasMany
    {
        return $this->hasMany(Guest::class);
    }

    /**
     * Payment transactions of this invitation.
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }
}
