<?php

namespace App\Support;

/**
 * Signature notifikasi Midtrans:
 *
 *   signature_key = sha512(order_id + status_code + gross_amount + server_key)
 *
 * Penting: gross_amount harus dipakai PERSIS seperti di payload (contoh
 * "49000.00") — jangan diformat ulang sebelum hashing, hash-nya tidak akan
 * cocok kalau formatnya berubah.
 */
final class MidtransSignature
{
    public static function make(string $orderId, string $statusCode, string $grossAmount, string $serverKey): string
    {
        return hash('sha512', $orderId.$statusCode.$grossAmount.$serverKey);
    }

    /**
     * Verifikasi signature_key di payload webhook. Return false kalau ada
     * field yang kurang atau server key belum dikonfigurasi.
     *
     * @param  array<string, mixed>  $payload
     */
    public static function verify(array $payload, ?string $serverKey): bool
    {
        if ($serverKey === null || $serverKey === '') {
            return false;
        }

        foreach (['order_id', 'status_code', 'gross_amount', 'signature_key'] as $key) {
            if (! isset($payload[$key]) || ! is_string($payload[$key]) || $payload[$key] === '') {
                return false;
            }
        }

        return hash_equals(
            self::make($payload['order_id'], $payload['status_code'], $payload['gross_amount'], $serverKey),
            $payload['signature_key'],
        );
    }
}
