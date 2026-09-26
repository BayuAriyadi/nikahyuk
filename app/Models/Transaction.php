<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'invitation_id',
    'order_id',
    'amount',
    'payment_status',
    'payment_link',
    'gateway',
    'payment_type',
    'gateway_txn_id',
    'qr_string',
    'qr_url',
    'expires_at',
    'paid_at',
])]
class Transaction extends Model
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
            'expires_at' => 'datetime',
            'paid_at' => 'datetime',
        ];
    }

    /**
     * The invitation this transaction belongs to.
     */
    public function invitation(): BelongsTo
    {
        return $this->belongsTo(Invitation::class);
    }

    public function isPaid(): bool
    {
        return $this->payment_status === 'paid';
    }
}
