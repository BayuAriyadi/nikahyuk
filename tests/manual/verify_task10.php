<?php

/**
 * Fase 2 (musik latar) + Fase 4 (lupa password) verification.
 *
 * Menguji lewat HTTP kernel asli:
 *  - POST /api/invitations/{id}/music: owner-only, mime whitelist, batas 2 MB,
 *    berkas lama dibuang saat ganti musik, folder music/<slug>/ di disk
 *  - music_url/music_enabled/music_title tersimpan di template_config dan
 *    tampil di payload publik
 *  - POST /api/forgot-password: selalu balas 200 dengan pesan generik
 *    (email terdaftar atau tidak) supaya tidak bisa dipakai menebak akun
 *  - POST /api/reset-password: token dari broker, password minimal 8,
 *    sesudah reset semua token Sanctum lama mati dan login pakai password baru
 *
 * Membersihkan fixture sendiri di awal (email %@uji.test), idempoten.
 */

use App\Models\Invitation;
use App\Models\User;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Storage;

$base = '/opt/data/projects/nikahyuk';

require $base.'/vendor/autoload.php';

$app = require $base.'/bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

// storage/logs/laravel.log milik proses artisan user (root), tak bisa ditulis
// dari sini. Arahkan log harness ke berkas sendiri supaya jalur mailer "log"
// (dan pesan error) tetap terbaca.
$logPath = $base.'/storage/logs/verify_task10.log';
File::put($logPath, '');
config(['logging.channels.single.path' => $logPath]);
Log::forgetChannel('single');
Log::forgetChannel('stack');

Cache::flush();
Storage::disk('public')->deleteDirectory('music/uji-musik-'.date('Y'));

$pass = 0;
$fail = 0;

function check(string $label, bool $ok, mixed $detail = null): void
{
    global $pass, $fail;

    if ($ok) {
        $pass++;
        echo "  PASS  {$label}\n";
    } else {
        $fail++;
        echo "  FAIL  {$label}".($detail !== null ? '   ['.json_encode($detail, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE).']' : '')."\n";
    }
}

/**
 * @param  array<string, mixed>  $payload
 * @param  array<string, UploadedFile>  $files
 * @return array{0: int, 1: array<string, mixed>|null}
 */
function api(string $method, string $uri, array $payload = [], ?string $token = null, array $files = []): array
{
    global $kernel, $app;

    $server = ['HTTP_ACCEPT' => 'application/json'];

    if ($token !== null) {
        $server['HTTP_AUTHORIZATION'] = 'Bearer '.$token;
    }

    $request = Request::create($uri, $method, $payload, [], $files, $server);
    $response = $kernel->handle($request);

    $app['auth']->forgetGuards();

    return [$response->getStatusCode(), json_decode((string) $response->getContent(), true)];
}

function cleanupFixtures(): void
{
    foreach (User::query()->where('email', 'like', '%@uji.test')->get() as $user) {
        $user->tokens()->delete();
    }

    Invitation::query()->whereHas('user', fn ($q) => $q->where('email', 'like', '%@uji.test'))->delete();
    User::query()->where('email', 'like', '%@uji.test')->delete();
    DB::table('password_reset_tokens')->where('email', 'like', '%@uji.test')->delete();
}

echo "== Fixture cleanup (reruns) ==\n";
cleanupFixtures();

echo "== Fixtures ==\n";

$owner = User::create(['name' => 'Owner Uji', 'email' => 'owner-musik@uji.test', 'password' => 'PasswordLama123']);
$other = User::create(['name' => 'Owner Lain', 'email' => 'owner-lain@uji.test', 'password' => 'PasswordLama123']);
$token = $owner->createToken('verify-musik')->plainTextToken;
$tokenOther = $other->createToken('verify-lain')->plainTextToken;

[, $body] = api('POST', '/api/invitations', [
    'template_name' => 'klasik',
    'slug' => 'uji-musik-'.date('Y'),
    'bride_data' => ['groom' => ['name' => 'Bagas Prakoso'], 'bride' => ['name' => 'Laras Ayu']],
], $token);
$inv = $body['data'];
api('PATCH', '/api/invitations/'.$inv['id'], ['status' => 'published'], $token);

echo "== T1: upload musik owner-only ==\n";
[$code] = api('POST', '/api/invitations/'.$inv['id'].'/music', [], null, ['music' => UploadedFile::fake()->create('lagu.mp3', 100, 'audio/mpeg')]);
check('tanpa token -> 401', $code === 401, $code);

[$code] = api('POST', '/api/invitations/'.$inv['id'].'/music', [], $tokenOther, ['music' => UploadedFile::fake()->create('lagu.mp3', 100, 'audio/mpeg')]);
check('bukan pemilik -> 403', $code === 403, $code);

echo "== T2: unggah musik valid ==\n";
[$code, $body] = api('POST', '/api/invitations/'.$inv['id'].'/music', [], $token, ['music' => UploadedFile::fake()->create('lagu.mp3', 300, 'audio/mpeg')]);
$url1 = $body['data']['url'] ?? '';
check('upload -> 201', $code === 201, $code);
check('URL ada di /storage/music/<slug>/', (bool) preg_match('~^/storage/music/'.$inv['slug'].'/[A-Z0-9]+\.mp3$~i', $url1), $url1);
check('berkas benar-benar ada di disk', $url1 !== '' && Storage::disk('public')->exists(str_replace('/storage/', '', $url1)));

echo "== T3: ganti musik membuang berkas lama ==\n";
$oldPath = str_replace('/storage/', '', $url1);
[$code, $body] = api('POST', '/api/invitations/'.$inv['id'].'/music', [], $token, ['music' => UploadedFile::fake()->create('lagu2.mp3', 400, 'audio/mpeg')]);
$url2 = $body['data']['url'] ?? '';
check('upload kedua -> 201', $code === 201, $code);
check('URL berbeda dari yang lama', $url1 !== $url2, [$url1, $url2]);
check('berkas lama sudah dihapus', ! Storage::disk('public')->exists($oldPath));
check('berkas baru ada', $url2 !== '' && Storage::disk('public')->exists(str_replace('/storage/', '', $url2)));

echo "== T4: validasi berkas musik ==\n";
[$code, $body] = api('POST', '/api/invitations/'.$inv['id'].'/music', [], $token, ['music' => UploadedFile::fake()->create('dokumen.txt', 10, 'text/plain')]);
check('bukan audio -> 422', $code === 422 && isset($body['errors']['music']), [$code, array_keys($body['errors'] ?? [])]);

[$code, $body] = api('POST', '/api/invitations/'.$inv['id'].'/music', [], $token, ['music' => UploadedFile::fake()->create('besar.mp3', 3000, 'audio/mpeg')]);
check('di atas 2 MB -> 422', $code === 422 && isset($body['errors']['music']), [$code, array_keys($body['errors'] ?? [])]);

[$code, $body] = api('POST', '/api/invitations/'.$inv['id'].'/music', [], $token, []);
check('tanpa berkas -> 422', $code === 422 && isset($body['errors']['music']), [$code, array_keys($body['errors'] ?? [])]);

echo "== T5: simpan pengaturan musik + tampil di payload publik ==\n";
[$code, $body] = api('PATCH', '/api/invitations/'.$inv['id'], [
    'template_config' => [
        'music_url' => $url2,
        'music_enabled' => true,
        'music_title' => 'Lagu Uji',
    ],
], $token);
check('PATCH musik -> 200', $code === 200, $code);
check('music_url tersimpan', ($body['data']['template_config']['music_url'] ?? null) === $url2, $body['data']['template_config']['music_url'] ?? null);
check('music_enabled tersimpan', ($body['data']['template_config']['music_enabled'] ?? null) === true);
check('music_title tersimpan', ($body['data']['template_config']['music_title'] ?? null) === 'Lagu Uji');

[$code, $body] = api('GET', '/api/invitations/'.$inv['slug']);
check('payload publik memuat music_url', ($body['data']['template_config']['music_url'] ?? null) === $url2);

[$code, $body] = api('PATCH', '/api/invitations/'.$inv['id'], ['template_config' => ['music_url' => 'javascript:alert(1)']], $token);
check('skema URL musik asing -> 422', $code === 422 && isset($body['errors']['template_config.music_url']), [$code, array_keys($body['errors'] ?? [])]);

echo "== T6: lupa password, pesan generik ==\n";
[$code, $body] = api('POST', '/api/forgot-password', ['email' => 'owner-musik@uji.test']);
check('email terdaftar -> 200', $code === 200, $code);
$pesanTerdaftar = $body['message'] ?? '';
check('pesan generik (tidak menyebut email ada)', str_contains($pesanTerdaftar, 'Kalau email itu terdaftar'), $pesanTerdaftar);

[$code, $body] = api('POST', '/api/forgot-password', ['email' => 'tidak-ada@uji.test']);
check('email tak terdaftar -> 200 (tidak bocor)', $code === 200, $code);
check('pesan sama persis dengan yang terdaftar', ($body['message'] ?? null) === $pesanTerdaftar, $body['message'] ?? null);

[$code, $body] = api('POST', '/api/forgot-password', ['email' => 'bukan-email']);
check('email ngawur -> 422', $code === 422 && isset($body['errors']['email']), [$code, array_keys($body['errors'] ?? [])]);

echo "== T7: alamat tautan reset mengarah ke frontend ==\n";
$resetToken = Password::broker()->createToken($owner);
[$code, $body] = api('POST', '/api/forgot-password', ['email' => 'owner-musik@uji.test']);
check('minta ulang tautan -> 200', $code === 200, $code);

$logged = null;
$notif = null;
$count = 0;

if (is_file($logPath)) {
    $logged = File::get($logPath);
    $count = substr_count((string) $logged, 'reset-password?');
}

check('log memuat tautan reset-password', $count > 0, $count);
check('tautan memuat token + email', (bool) preg_match('~/reset-password\?token=[A-Za-z0-9]+&(amp;)?email=owner-musik%40uji\.test~', (string) $logged));
check('tautan tidak menunjuk ke /api', ! str_contains((string) $logged, '/api/reset-password'));

echo "== T8: reset password mengganti password + mencabut sesi lama ==\n";
$tokenBaru = Password::broker()->createToken($owner);

[$code, $body] = api('POST', '/api/reset-password', [
    'token' => $tokenBaru,
    'email' => 'owner-musik@uji.test',
    'password' => 'PasswordBaru456',
    'password_confirmation' => 'PasswordBaru456',
], $token);
check('reset -> 200', $code === 200, [$code, $body]);

$owner->refresh();
check('password tersimpan (hash cocok)', Hash::check('PasswordBaru456', $owner->password));
check('token Sanctum lama dicabut', $owner->tokens()->count() === 0, $owner->tokens()->count());

[$code, $body] = api('POST', '/api/login', ['email' => 'owner-musik@uji.test', 'password' => 'PasswordBaru456']);
check('login dengan password baru -> 200', $code === 200 && isset($body['token']), $code);

[$code, $body] = api('POST', '/api/login', ['email' => 'owner-musik@uji.test', 'password' => 'PasswordLama123']);
check('password lama tidak berlaku -> 422 (pesan sama seperti login biasa)', $code === 422 && isset($body['errors']['email']), $code);

echo "== T9: validasi reset password ==\n";
[$code, $body] = api('POST', '/api/reset-password', ['email' => 'owner-musik@uji.test', 'password' => 'PasswordBaru789', 'password_confirmation' => 'PasswordBaru789', 'token' => 'token-palsu']);
check('token palsu -> 422', $code === 422 && isset($body['errors']['email']), [$code, array_keys($body['errors'] ?? [])]);

$tokenSekali = Password::broker()->createToken($owner);
[$code, $body] = api('POST', '/api/reset-password', [
    'token' => $tokenSekali,
    'email' => 'owner-musik@uji.test',
    'password' => 'Pendek1',
    'password_confirmation' => 'Pendek1',
]);
check('password < 8 karakter -> 422', $code === 422 && isset($body['errors']['password']), [$code, array_keys($body['errors'] ?? [])]);

[$code, $body] = api('POST', '/api/reset-password', [
    'token' => $tokenSekali,
    'email' => 'owner-musik@uji.test',
    'password' => 'BedaSekali123',
    'password_confirmation' => 'BedaSekali999',
]);
check('konfirmasi tidak cocok -> 422', $code === 422 && isset($body['errors']['password']), [$code, array_keys($body['errors'] ?? [])]);

$tokenSekali2 = Password::broker()->createToken($owner);
[$code] = api('POST', '/api/reset-password', [
    'token' => $tokenSekali2,
    'email' => 'owner-musik@uji.test',
    'password' => 'DipakaiSekali9',
    'password_confirmation' => 'DipakaiSekali9',
]);
check('pakai token sekali -> 200', $code === 200, $code);

[$code] = api('POST', '/api/reset-password', [
    'token' => $tokenSekali2,
    'email' => 'owner-musik@uji.test',
    'password' => 'DipakaiDuaKali9',
    'password_confirmation' => 'DipakaiDuaKali9',
]);
check('token yang sama dipakai lagi -> 422', $code === 422, $code);

echo "== T10: musik ikut terhapus saat undangan dihapus ==\n";
$owner->tokens()->delete();
$tokenOwner = $owner->createToken('verify-final')->plainTextToken;
check('berkas musik ada sebelum hapus', Storage::disk('public')->exists(str_replace('/storage/', '', $url2)));

[$code] = api('DELETE', '/api/invitations/'.$inv['id'], [], $tokenOwner);
check('DELETE undangan -> 204', $code === 204, $code);
check('folder musik undangan ikut terhapus', ! Storage::disk('public')->exists('music/'.$inv['slug']));

echo "== Cleanup fixture ==\n";
cleanupFixtures();
Storage::disk('public')->deleteDirectory('music/uji-musik-'.date('Y'));
echo "  fixture dibersihkan\n";

Cache::flush();

echo "\n== SUMMARY: {$pass} passed, {$fail} failed ==\n";
exit($fail === 0 ? 0 : 1);
