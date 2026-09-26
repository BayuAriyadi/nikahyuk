<?php

namespace App\Payments;

use App\Models\Invitation;
use App\Models\Transaction;
use Illuminate\Support\Str;

/**
 * Gateway simulasi untuk pengembangan lokal / homelab.
 *
 * Tidak menembak jaringan sama sekali: QR string-nya palsu (berawalan
 * "DUMMY-QRIS-") supaya alur checkout → webhook → publish bisa diuji
 * ujung-ke-ujung tanpa kredensial Midtrans asli.
 *
 * Webhook tetap diverifikasi dengan signature SHA512 memakai
 * MIDTRANS_SERVER_KEY dari .env (nilai dummy juga cukup) — jadi jalur
 * verifikasinya identik dengan produksi.
 */
final class FakeQrisGateway implements PaymentGateway
{
    public function name(): string
    {
        return 'fake';
    }

    public function createQrisCharge(Transaction $transaction, Invitation $invitation): array
    {
        return [
            'gateway_txn_id' => 'sim-'.Str::lower((string) Str::ulid()),
            'qr_string' => 'DUMMY-QRIS-'.$transaction->order_id,
            'qr_url' => null,
            'expires_at' => now()->addMinutes((int) config('payment.qris_expiry_minutes', 15)),
            'raw' => [
                'simulated' => true,
                'note' => 'Payload QRIS dummy — hanya untuk simulasi lokal.',
            ],
        ];
    }
}
