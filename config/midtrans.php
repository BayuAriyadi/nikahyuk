<?php

/*
|--------------------------------------------------------------------------
| Kredensial Midtrans
|--------------------------------------------------------------------------
|
| Isi hanya di .env — jangan pernah di-commit.
|
| Sandbox: MIDTRANS_IS_PRODUCTION=false dan semua key berawalan "SB-Mid-".
| Production: MIDTRANS_IS_PRODUCTION=true dan key dari dashboard produksi.
|
| Signature notifikasi diverifikasi dengan server_key (SHA512):
|   signature_key = sha512(order_id + status_code + gross_amount + server_key)
|
*/

return [
    'merchant_id' => env('MIDTRANS_MERCHANT_ID'),
    'client_key' => env('MIDTRANS_CLIENT_KEY'),
    'server_key' => env('MIDTRANS_SERVER_KEY'),

    'is_production' => (bool) env('MIDTRANS_IS_PRODUCTION', false),
    'is_sanitized' => true,
    'is_3ds' => true,

    // Opsional: override URL notifikasi per-request (berguna untuk lingkungan
    // lokal / tunnel karena URL di dashboard Midtrans tidak bisa dipakai).
    'notification_url' => env('MIDTRANS_NOTIFICATION_URL'),
];
