<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Driver payment gateway
    |--------------------------------------------------------------------------
    |
    | 'fake'     — gateway simulasi lokal, tidak menembak jaringan sama sekali.
    |              Dipakai untuk menguji alur checkout → webhook → publish
    |              tanpa kredensial Midtrans asli.
    | 'midtrans' — Core API Midtrans (QRIS), arahkan ke Sandbox dulu dengan
    |              MIDTRANS_IS_PRODUCTION=false + server key berawalan "SB-Mid-".
    |
    */

    'driver' => env('PAYMENT_DRIVER', 'fake'),

    // Harga satu undangan (Rupiah, integer — batas Midtrans aman).
    'amount' => (int) env('PAYMENT_AMOUNT', 49000),

    'currency' => 'IDR',

    // Umur tagihan QRIS (menit). Dipakai driver fake & jadi fallback kalau
    // gateway tidak mengirim expiry_time.
    'qris_expiry_minutes' => (int) env('PAYMENT_QRIS_EXPIRY_MINUTES', 15),
];
