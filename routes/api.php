<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\GuestController;
use App\Http\Controllers\InvitationController;
use App\Http\Controllers\MusicController;
use App\Http\Controllers\PaymentWebhookController;
use App\Http\Controllers\PhotoController;
use App\Http\Controllers\TransactionController;
use App\Http\Middleware\EnsureIsAdmin;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Auth — register / login (public, rate limited), logout (token required)
|--------------------------------------------------------------------------
|
| Setiap throttle memakai prefix berbeda (param ke-3) supaya bucket rate
| limit tiap route terpisah. Di Laravel 13 signature guest = sha1(domain|ip),
| jadi tanpa prefix semua route berbagi satu counter yang sama.
|
*/

Route::post('/register', [AuthController::class, 'register'])
    ->middleware('throttle:10,1,register');

Route::post('/login', [AuthController::class, 'login'])
    ->middleware('throttle:10,1,login');

// Lupa password: minta tautan reset (email) dan simpan password baru.
// Throttle ketat supaya tidak bisa dipakai spam email / brute force token.
Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])
    ->middleware('throttle:5,1,forgot-password');

Route::post('/reset-password', [AuthController::class, 'resetPassword'])
    ->middleware('throttle:10,1,reset-password');

/*
|--------------------------------------------------------------------------
| Public endpoints
|--------------------------------------------------------------------------
*/

// Full invitation (content + guest book) for a published slug.
Route::get('/invitations/{slug}', [InvitationController::class, 'show']);

// Guest RSVP + message. Public, rate limited (10 req/min per client).
Route::post('/invitations/{slug}/guests', [GuestController::class, 'store'])
    ->middleware('throttle:10,1,guest-rsvp');

/*
|--------------------------------------------------------------------------
| Payment webhook (dipanggil server payment gateway, BUKAN user)
|--------------------------------------------------------------------------
|
| - Di luar auth:sanctum: yang memanggil adalah server Midtrans.
| - Aman dari CSRF: middleware ValidateCsrfToken hanya aktif di grup "web",
|   route ini ada di routes/api.php.
| - Autentikasi payload lewat signature SHA512 (lihat MidtransSignature).
| - Throttle bucket sendiri supaya tidak berebut kuota dengan route lain.
|
*/

Route::post('/webhooks/midtrans', [PaymentWebhookController::class, 'midtrans'])
    ->middleware('throttle:120,1,payment-webhook');

/*
|--------------------------------------------------------------------------
| Authenticated endpoints (Sanctum bearer token)
|--------------------------------------------------------------------------
*/

Route::middleware('auth:sanctum')->group(function () {
    // Current user — sanity check for the frontend.
    Route::get('/user', fn (Request $request) => $request->user());

    // Revoke the token used for this request.
    Route::post('/logout', [AuthController::class, 'logout']);

    // Ganti password sendiri (wajib password saat ini). Throttle ketat: ini
    // endpoint empuk untuk brute-force password jika tidak dibatasi.
    Route::post('/change-password', [AuthController::class, 'changePassword'])
        ->middleware('throttle:10,1,change-password');

    // Tutup akun sendiri: hapus permanen user + undangan + berkas. Throttle
    // ketat karena endpoint ini tidak bisa dibatalkan (bukan sekadar lambat).
    Route::delete('/account', [AuthController::class, 'destroyAccount'])
        ->middleware('throttle:5,1,destroy-account');

    // Owner: list own invitations — halaman "Undangan Saya".
    Route::get('/invitations', [InvitationController::class, 'index']);

    // Owner: create / update invitations.
    Route::post('/invitations', [InvitationController::class, 'store']);
    Route::match(['put', 'patch'], '/invitations/{invitation}', [InvitationController::class, 'update']);

    // Owner: hapus undangan permanen (foto, tamu, dan transaksi ikut dibuang).
    Route::delete('/invitations/{invitation}', [InvitationController::class, 'destroy']);

    // Owner: kelola tamu (fase 3) — daftar semua tamu, tambah manual, hapus.
    Route::get('/guests', [GuestController::class, 'index']);
    Route::post('/guests', [GuestController::class, 'storeOwned']);
    Route::delete('/guests/{guest}', [GuestController::class, 'destroy']);

    // Owner: upload satu foto undangan (multipart, field "photo").
    Route::post('/invitations/{invitation}/photos', [PhotoController::class, 'store'])
        ->middleware('throttle:30,1,photo-upload');

    // Owner: upload musik latar undangan (multipart, field "music", maks 2 MB).
    Route::post('/invitations/{invitation}/music', [MusicController::class, 'store'])
        ->middleware('throttle:10,1,music-upload');

    // Owner: buat tagihan QRIS untuk undangan draft (tombol "Terbitkan").
    Route::post('/invitations/{slug}/checkout', [TransactionController::class, 'store'])
        ->middleware('throttle:20,1,checkout');

    // Owner: status transaksi — dipakai UI untuk polling setelah scan QRIS.
    Route::get('/transactions/{transaction:order_id}', [TransactionController::class, 'show'])
        ->middleware('throttle:240,1,tx-status');

    // Superadmin Routes
    Route::prefix('admin')->middleware(EnsureIsAdmin::class)->group(function () {
        Route::get('/users', [AdminController::class, 'users']);
        Route::patch('/users/{user}', [AdminController::class, 'update']);
        Route::delete('/users/{user}', [AdminController::class, 'destroy']);
        Route::get('/stats', [AdminController::class, 'stats']);
        Route::get('/transactions', [AdminController::class, 'transactions']);
        Route::get('/revenue-series', [AdminController::class, 'revenueSeries']);
    });
});
