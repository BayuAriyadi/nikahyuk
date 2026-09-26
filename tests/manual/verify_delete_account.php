<?php

/**
 * Verifikasi DELETE /api/account (tutup akun sendiri).
 *
 * Destruktif dan tidak bisa dibatalkan, semua lewat HTTP nyata dengan akun
 * fixture yang dibuat dan dihapus oleh skrip ini sendiri.
 *
 * Yang diuji:
 *   - konfirmasi ketik-ulang wajib persis ("HAPUS AKUN SAYA")
 *   - password salah -> akun TETAP ADA (ini yang paling penting)
 *   - hapus akun -> user, undangan, tamu, berkas hilang
 *   - **transaksi pembayaran TETAHAN** (rekap pendapatan tidak berubah mundur)
 *
 * Jalankan: php tests/manual/verify_delete_account.php
 */

require __DIR__.'/../../vendor/autoload.php';

$app = require_once __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Invitation;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

$passed = 0;
$failed = 0;

function ok(bool $condition, string $label): void
{
    global $passed, $failed;
    if ($condition) {
        $passed++;
        echo "  ok   - {$label}\n";
    } else {
        $failed++;
        echo "  FAIL - {$label}\n";
    }
}

function http(string $method, string $path, ?string $token = null, ?array $body = null): array
{
    $headers = ['Accept: application/json'];

    if ($token) {
        $headers[] = 'Authorization: Bearer '.$token;
    }

    if ($body !== null) {
        $headers[] = 'Content-Type: application/json';
    }

    $ch = curl_init('http://127.0.0.1:8010'.$path);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 60,
    ]);

    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }

    $raw = (string) curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return [$status, json_decode($raw, true) ?? []];
}

echo "== Setup: user + undangan + transaksi ==\n";

$password = 'password123';
$email = 'hapus-akun-'.bin2hex(random_bytes(4)).'@uji.test';

$user = User::create([
    'name' => 'Uji Hapus Akun',
    'email' => $email,
    'password' => Hash::make($password),
]);

$slug = 'hapus-akun-'.bin2hex(random_bytes(3));

$invitation = Invitation::create([
    'user_id' => $user->id,
    'slug' => $slug,
    'template_name' => 'klasik',
    'status' => 'published',
    'template_config' => [
        'cover_photo' => "/storage/gallery/{$slug}/cover.webp",
        'gallery' => ["/storage/gallery/{$slug}/foto1.webp"],
    ],
    'bride_data' => [
        'groom' => ['name' => 'Uji', 'photo' => "/storage/gallery/{$slug}/groom.webp"],
        'bride' => ['name' => 'Pasangan'],
    ],
]);

$invitation->guests()->create(['name' => 'Tamu Uji', 'rsvp_status' => 'attending', 'message' => 'Selamat!']);

// Berkas fisik di disk supaya bisa dibuktikan ikut terhapus.
//
// Folder galeri dimiliki root, jadi pembuatan berkas bisa dilakukan oleh proses
// HTTP (`php artisan serve` jalan sebagai root) lewat route dev sementara —
// route itu memang sengaja tidak disimpan di repo. Tanpa route itu, pemeriksaan
// pembersihan berkas dilewati, bukan gagal: inti penghapusan (DB) tetap diuji.
$galleryPath = "gallery/{$slug}";

$seedStatus = 0;
$seedError = '';
if (getenv('NIKAHYUK_SEED_GALLERY') === '1') {
    $ch = curl_init('http://127.0.0.1:8010/api/dev-seed-gallery-k4m9p1?slug='.urlencode($slug));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30]);
    curl_exec($ch);
    $seedStatus = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $seedError = curl_error($ch);
}

$filesSeeded = Storage::disk('public')->exists("{$galleryPath}/cover.webp");

if ($filesSeeded) {
    ok(true, "berkas fisik disiapkan (HTTP {$seedStatus} {$seedError})");
} else {
    echo "  skip - berkas fisik tidak tersedia (folder gallery root-owned);\n";
    echo "        jalankan dengan NIKAHYUK_SEED_GALLERY=1 + route dev untuk mengujinya\n";
}

// Transaksi: buktinya harus tetap ada setelah akun hilang.
$transaction = $invitation->transactions()->create([
    'order_id' => 'UJI-'.bin2hex(random_bytes(4)),
    'amount' => 49000,
    'payment_status' => 'paid',
    'paid_at' => now(),
]);

$invitationCount = Invitation::query()->count();
$transactionCount = DB_count_transactions();

function DB_count_transactions(): int
{
    // Tanpa model Transaction: tabel transaksi punya FK ke invitations yang
    // akan jadi NULL, hitung langsung lewat koneksi.
    return Illuminate\Support\Facades\DB::table('transactions')->count();
}

ok(User::query()->where('id', $user->id)->exists(), 'user fixture ada');
ok(Invitation::query()->where('id', $invitation->id)->exists(), 'undangan fixture ada');
if ($filesSeeded) {
    ok(Storage::disk('public')->exists("{$galleryPath}/cover.webp"), 'berkas fisik terbaca di disk');
}
ok($transactionCount >= 1, "transaksi tercatat ({$transactionCount})");

[$loginStatus, $loginBody] = http('POST', '/api/login', null, [
    'email' => $email,
    'password' => $password,
]);
$token = $loginBody['token'] ?? null;
ok($loginStatus === 200 && is_string($token), 'login -> 200 + token');

echo "== Penolakan sebelum hapus ==\n";

[$status] = http('DELETE', '/api/account', 'token-palsu', [
    'password' => $password,
    'confirm' => 'HAPUS AKUN SAYA',
]);
ok($status === 401, "tanpa token sah -> 401 (dapat {$status})");

[$status, $body] = http('DELETE', '/api/account', $token, [
    'password' => $password,
    'confirm' => 'salah ketik',
]);
ok($status === 422, "konfirmasi salah -> 422 (dapat {$status})");
ok(isset($body['errors']['confirm']), 'error di field confirm');

[$status, $body] = http('DELETE', '/api/account', $token, [
    'password' => 'password-salah',
    'confirm' => 'HAPUS AKUN SAYA',
]);
ok($status === 422, "password salah -> 422 (dapat {$status})");
ok(isset($body['errors']['password']), 'error di field password');

// Yang paling penting: gagal konfirmasi tidak boleh menghapus apa pun.
ok(User::query()->where('id', $user->id)->exists(), 'AKUN MASIH ADA setelah ditolak');
ok(Invitation::query()->where('id', $invitation->id)->exists(), 'undangan masih ada setelah ditolak');
if ($filesSeeded) {
    ok(Storage::disk('public')->exists("{$galleryPath}/cover.webp"), 'berkas masih ada setelah ditolak');
}

echo "== Hapus akun berhasil ==\n";

[$status, $body] = http('DELETE', '/api/account', $token, [
    'password' => $password,
    'confirm' => 'HAPUS AKUN SAYA',
]);
ok($status === 200, "hapus akun -> 200 (dapat {$status})");
ok(($body['deleted']['invitations'] ?? 0) === 1, 'laporan: 1 undangan dihapus');

echo "== Data pribadi hilang ==\n";

ok(! User::query()->where('id', $user->id)->exists(), 'baris user hilang');
ok(! Invitation::query()->where('id', $invitation->id)->exists(), 'undangan hilang');
ok(
    Illuminate\Support\Facades\DB::table('guests')->where('invitation_id', $invitation->id)->count() === 0,
    'tamu hilang'
);
if ($filesSeeded) {
    ok(! Storage::disk('public')->exists("{$galleryPath}/cover.webp"), 'berkas cover terhapus dari disk');
    ok(! Storage::disk('public')->exists("{$galleryPath}/foto1.webp"), 'berkas galeri terhapus dari disk');
    ok(! Storage::disk('public')->exists("{$galleryPath}/groom.webp"), 'berkas mempelai terhapus dari disk');
    ok(! Storage::disk('public')->directoryExists($galleryPath), 'folder galeri ikut dibuang');
}

echo "== Transaksi TETAHAN (rekap tidak berubah mundur) ==\n";

$survivor = Illuminate\Support\Facades\DB::table('transactions')
    ->where('id', $transaction->id)
    ->first();

ok($survivor !== null, 'baris transaksi masih ada');
ok($survivor?->invitation_id === null, 'invitation_id dikosongkan (SET NULL), bukan hilang');
ok((int) $survivor?->amount === 49000, 'nilai transaksi utuh');
ok(DB_count_transactions() === $transactionCount, 'jumlah transaksi tidak berkurang');

echo "== Token sudah tidak berlaku ==\n";

[$status] = http('GET', '/api/user', $token);
ok($status === 401, "token mati -> 401 (dapat {$status})");

[$status] = http('POST', '/api/login', null, ['email' => $email, 'password' => $password]);
ok($status === 422 || $status === 401, "login email yang sudah dihapus ditolak (dapat {$status})");

echo "== Cleanup ==\n";

Illuminate\Support\Facades\DB::table('transactions')->where('id', $transaction->id)->delete();
ok(
    Illuminate\Support\Facades\DB::table('transactions')->where('id', $transaction->id)->doesntExist(),
    'transaksi fixture dibersihkan'
);

echo "\n== Hasil: {$passed} ok, {$failed} FAIL ==\n";

exit($failed === 0 ? 0 : 1);
