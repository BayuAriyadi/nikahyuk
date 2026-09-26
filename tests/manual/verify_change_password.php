<?php

/**
 * Verifikasi endpoint ganti password (POST /api/change-password).
 *
 * Semua lewat HTTP nyata ke proses `php artisan serve`, seperti klien
 * sesungguhnya — bukan memanggil controller langsung.
 *
 * Jalankan: php tests/manual/verify_change_password.php
 */

require __DIR__.'/../../vendor/autoload.php';

$app = require_once __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;
use Illuminate\Support\Facades\Hash;

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

/** Panggilan HTTP ke API lokal. */
function http(string $method, string $path, ?string $token = null, ?array $body = null): array
{
    $url = 'http://127.0.0.1:8010'.$path;
    $headers = ['Accept: application/json'];

    if ($token) {
        $headers[] = 'Authorization: Bearer '.$token;
    }

    if ($body !== null) {
        $headers[] = 'Content-Type: application/json';
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);

    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }

    $raw = (string) curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return [$status, json_decode($raw, true) ?? []];
}

echo "== Setup ==\n";

$oldPassword = 'password123';
$newPassword = 'S4nd1Baru!Aman';

$email = 'ganti-pw-'.bin2hex(random_bytes(4)).'@uji.test';

$user = User::create([
    'name' => 'Uji Ganti PW',
    'email' => $email,
    'password' => Hash::make($oldPassword),
]);

// Token lewat login, seperti klien: supaya yang diuji benar-benar alur nyata.
[$loginStatus, $loginBody] = http('POST', '/api/login', null, [
    'email' => $email,
    'password' => $oldPassword,
]);
$token = $loginBody['token'] ?? null;
ok($loginStatus === 200 && is_string($token), 'login fixture -> 200 + token');

echo "== Penolakan ==\n";

[$status, $body] = http('POST', '/api/change-password', 'token-palsu', [
    'current_password' => $oldPassword,
    'password' => $newPassword,
    'password_confirmation' => $newPassword,
]);
ok($status === 401, "tanpa token sah -> 401 (dapat {$status})");

[$status, $body] = http('POST', '/api/change-password', $token, [
    'current_password' => 'salah-banget',
    'password' => $newPassword,
    'password_confirmation' => $newPassword,
]);
ok($status === 422, "password saat ini salah -> 422 (dapat {$status})");
ok(isset($body['errors']['current_password']), 'error di field current_password');
ok(
    User::query()->where('id', $user->id)->first() && Hash::check($oldPassword, $user->fresh()->password),
    'password lama tidak berubah saat gagal'
);

[$status] = http('POST', '/api/change-password', $token, [
    'current_password' => $oldPassword,
    'password' => 'pendek',
    'password_confirmation' => 'pendek',
]);
ok($status === 422, 'password baru kurang dari 8 -> 422');

[$status, $body] = http('POST', '/api/change-password', $token, [
    'current_password' => $oldPassword,
    'password' => $newPassword,
    'password_confirmation' => 'beda-12345',
]);
ok($status === 422 && isset($body['errors']['password']), 'konfirmasi tidak cocok -> 422');

[$status, $body] = http('POST', '/api/change-password', $token, [
    'current_password' => $oldPassword,
    'password' => $oldPassword,
    'password_confirmation' => $oldPassword,
]);
ok($status === 422, 'password baru sama dengan lama -> 422');

echo "== Ganti password berhasil ==\n";

// Token kedua untuk menguji bahwa sesi lain ikut dicabut.
$secondToken = $user->createToken('sesi-kedua')->plainTextToken;

[$status, $body] = http('POST', '/api/change-password', $token, [
    'current_password' => $oldPassword,
    'password' => $newPassword,
    'password_confirmation' => $newPassword,
]);
ok($status === 200, "ganti password -> 200 (dapat {$status})");

$fresh = $user->fresh();
ok(Hash::check($newPassword, $fresh->password), 'password tersimpan di DB');
ok(! Hash::check($oldPassword, $fresh->password), 'password lama tidak berlaku lagi');

echo "== Sesi lama dicabut ==\n";

[$status] = http('GET', '/api/user', $token);
ok($status === 401, "token dipakai request -> 401 (dapat {$status})");

[$status] = http('GET', '/api/user', $secondToken);
ok($status === 401, "sesi kedua juga mati -> 401 (dapat {$status})");

echo "== Bisa masuk dengan password baru ==\n";

[$status, $body] = http('POST', '/api/login', null, [
    'email' => $email,
    'password' => $newPassword,
]);
ok($status === 200 && ! empty($body['token']), 'login password baru -> 200 + token');

[$status] = http('POST', '/api/login', null, [
    'email' => $email,
    'password' => $oldPassword,
]);
ok($status === 422 || $status === 401, "login password lama ditolak (dapat {$status})");

echo "== Cleanup ==\n";

$fresh->tokens()->delete();
$fresh->delete();
ok(User::query()->where('id', $user->id)->doesntExist(), 'fixture user dihapus');

echo "\n== Hasil: {$passed} ok, {$failed} FAIL ==\n";

exit($failed === 0 ? 0 : 1);
