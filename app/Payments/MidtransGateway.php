<?php

namespace App\Payments;

use App\Models\Invitation;
use App\Models\Transaction;
use Illuminate\Support\Carbon;
use Midtrans\Config;
use Midtrans\CoreApi;
use RuntimeException;

/**
 * Driver Midtrans — Core API `charge` dengan payment_type = qris.
 *
 * Mode sandbox: MIDTRANS_IS_PRODUCTION=false + server key berawalan
 * "SB-Mid-". Respons charge memuat actions[] dengan URL gambar QR
 * (name = "generate-qr-code") dan expiry_time (zona waktu Asia/Jakarta).
 */
final class MidtransGateway implements PaymentGateway
{
    public function __construct()
    {
        Config::$serverKey = (string) config('midtrans.server_key');
        Config::$isProduction = (bool) config('midtrans.is_production');
        Config::$isSanitized = (bool) config('midtrans.is_sanitized');
        Config::$is3ds = (bool) config('midtrans.is_3ds');

        if (config('midtrans.notification_url')) {
            Config::$overrideNotifUrl = (string) config('midtrans.notification_url');
        }
    }

    public function name(): string
    {
        return 'midtrans';
    }

    public function createQrisCharge(Transaction $transaction, Invitation $invitation): array
    {
        $response = (array) CoreApi::charge([
            'payment_type' => 'qris',
            'transaction_details' => [
                'order_id' => $transaction->order_id,
                'gross_amount' => (int) $transaction->amount,
            ],
        ]);

        $qrUrl = null;

        foreach ((array) ($response['actions'] ?? []) as $action) {
            if (($action['name'] ?? null) === 'generate-qr-code') {
                $qrUrl = isset($action['url']) ? (string) $action['url'] : null;

                break;
            }
        }

        if ($qrUrl === null) {
            throw new RuntimeException('Midtrans tidak mengembalikan URL QRIS (actions.generate-qr-code kosong).');
        }

        $expiresAt = isset($response['expiry_time'])
            ? Carbon::parse($response['expiry_time'], 'Asia/Jakarta')->utc()
            : now()->addMinutes((int) config('payment.qris_expiry_minutes', 15));

        return [
            'gateway_txn_id' => isset($response['transaction_id']) ? (string) $response['transaction_id'] : null,
            // Midtrans tidak mengirim QR string — gambar QR diambil dari qr_url.
            'qr_string' => null,
            'qr_url' => $qrUrl,
            'expires_at' => $expiresAt,
            'raw' => $response,
        ];
    }
}
