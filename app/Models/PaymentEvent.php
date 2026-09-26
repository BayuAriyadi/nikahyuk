<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Log mentah setiap notifikasi/webhook pembayaran yang masuk — dipakai untuk
 * audit dan debugging (termasuk percobaan dengan signature tidak valid).
 */
#[Fillable(['gateway', 'order_id', 'transaction_status', 'signature_valid', 'payload'])]
class PaymentEvent extends Model
{
    use HasUuids;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'signature_valid' => 'boolean',
            'payload' => 'array',
        ];
    }
}
