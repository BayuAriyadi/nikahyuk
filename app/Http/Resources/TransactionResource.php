<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TransactionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'order_id' => $this->order_id,
            'amount' => (int) $this->amount,
            'payment_status' => $this->payment_status,
            'payment_type' => $this->payment_type,
            'gateway' => $this->gateway,
            'qr_string' => $this->qr_string,
            'qr_url' => $this->qr_url,
            'expires_at' => $this->expires_at,
            'paid_at' => $this->paid_at,
            'created_at' => $this->created_at,
            'invitation' => [
                'slug' => $this->invitation?->slug,
                'status' => $this->invitation?->status,
            ],
            // Petunjuk simulasi lokal — hanya muncul saat driver 'fake' aktif.
            'simulation_command' => config('payment.driver') === 'fake'
                ? 'php artisan payments:simulate '.$this->order_id
                : null,
        ];
    }
}
