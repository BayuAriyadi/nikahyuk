<?php

namespace App\Payments;

use App\Models\Invitation;
use App\Models\Transaction;
use Illuminate\Support\Carbon;

interface PaymentGateway
{
    /** Nama driver — ikut tersimpan di kolom transactions.gateway. */
    public function name(): string;

    /**
     * Buat tagihan QRIS di sisi gateway.
     *
     * @return array{
     *     gateway_txn_id: ?string,
     *     qr_string: ?string,
     *     qr_url: ?string,
     *     expires_at: ?Carbon,
     *     raw: array<string, mixed>
     * }
     */
    public function createQrisCharge(Transaction $transaction, Invitation $invitation): array;
}
