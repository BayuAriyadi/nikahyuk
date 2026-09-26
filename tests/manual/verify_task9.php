<?php

/**
 * Fase 3 verification — Kelola Tamu & Pantau RSVP/Ucapan.
 *
 * Menguji lewat HTTP kernel asli:
 *  - GET/POST/DELETE /api/guests (daftar semua tamu owner, tambah manual, hapus)
 *  - dedupe RSVP publik by nama (manual + RSVP tidak dobel di rekap)
 *  - GuestResource menyertakan ringkasan undangan saat relasi dimuat
 *
 * Membersihkan fixture sendiri di awal (email %@uji.test), idempoten.
 */

use App\Models\Guest;
use App\Models\Invitation;
use App\Models\User;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

$base = '/opt/data/projects/nikahyuk';

require $base.'/vendor/autoload.php';

$app = require $base.'/bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

Cache::flush();

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

function api(string $method, string $uri, array $payload = [], ?string $token = null): array
{
    global $kernel, $app;

    $server = ['HTTP_ACCEPT' => 'application/json'];

    if ($token !== null) {
        $server['HTTP_AUTHORIZATION'] = 'Bearer '.$token;
    }

    $request = Request::create($uri, $method, $payload, [], [], $server);
    $response = $kernel->handle($request);

    $app['auth']->forgetGuards();

    return [$response->getStatusCode(), json_decode((string) $response->getContent(), true)];
}

echo "== Fixture cleanup (reruns) ==\n";

foreach (User::query()->where('email', 'like', '%@uji.test')->get() as $oldUser) {
    $oldUser->tokens()->delete();
}
Guest::query()->whereHas('invitation', fn ($q) => $q->whereHas('user', fn ($qq) => $qq->where('email', 'like', '%@uji.test')))->delete();
Invitation::query()->whereHas('user', fn ($q) => $q->where('email', 'like', '%@uji.test'))->delete();
User::query()->where('email', 'like', '%@uji.test')->delete();

echo "== Fixtures ==\n";

$ownerA = User::create(['name' => 'Owner A', 'email' => 'owner-a@uji.test', 'password' => 'secret-test-123']);
$ownerB = User::create(['name' => 'Owner B', 'email' => 'owner-b@uji.test', 'password' => 'secret-test-123']);
$tokenA = $ownerA->createToken('verify-a')->plainTextToken;
$tokenB = $ownerB->createToken('verify-b')->plainTextToken;

[, $body] = api('POST', '/api/invitations', [
    'template_name' => 'klasik',
    'bride_data' => ['groom' => ['name' => 'Andi Pratama', 'nick' => 'Andi'], 'bride' => ['name' => 'Sari Dewi', 'nick' => 'Sari']],
], $tokenA);
$invA = $body['data'];
api('PATCH', '/api/invitations/'.$invA['id'], ['status' => 'published'], $tokenA);

[, $body] = api('POST', '/api/invitations', [
    'template_name' => 'klasik',
    'bride_data' => ['groom' => ['name' => 'Raka Saputra'], 'bride' => ['name' => 'Nadia Prameswari']],
], $tokenB);
$invB = $body['data'];

echo "== T1: auth required for /api/guests ==\n";
[$code] = api('GET', '/api/guests');
check('GET /api/guests without token -> 401', $code === 401, $code);
[$code] = api('POST', '/api/guests', ['invitation_id' => $invA['id'], 'name' => 'X']);
check('POST /api/guests without token -> 401', $code === 401, $code);

echo "== T2: owner menambah tamu manual ==\n";
[$code, $body] = api('POST', '/api/guests', ['invitation_id' => $invA['id'], 'name' => '  Bapak Hasan  '], $tokenA);
$manual = $body['data'] ?? [];
check('POST /api/guests -> 201', $code === 201, $code);
check('name di-trim', ($manual['name'] ?? null) === 'Bapak Hasan', $manual['name'] ?? null);
check('status awal pending', ($manual['rsvp_status'] ?? null) === 'pending', $manual['rsvp_status'] ?? null);

[$code, $body] = api('POST', '/api/guests', ['invitation_id' => $invA['id'], 'name' => '   '], $tokenA);
check('nama kosong (spasi) -> 422', $code === 422 && isset($body['errors']['name']), [$code, array_keys($body['errors'] ?? [])]);

[$code, $body] = api('POST', '/api/guests', ['invitation_id' => 'bukan-uuid', 'name' => 'X'], $tokenA);
check('invitation_id bukan uuid -> 422', $code === 422 && isset($body['errors']['invitation_id']), [$code, array_keys($body['errors'] ?? [])]);

[$code] = api('POST', '/api/guests', ['invitation_id' => $invB['id'], 'name' => 'Nyelundup'], $tokenA);
check('tambah ke undangan orang lain -> 404', $code === 404, $code);

echo "== T3: RSVP publik menyatu dengan tamu manual (dedupe by nama) ==\n";
Carbon::setTestNow('2020-01-01 10:00:00');
[$code, $body] = api('POST', '/api/invitations/'.$invA['slug'].'/guests', [
    'name' => 'bapak hasan',
    'rsvp_status' => 'attending',
    'message' => 'Insya Allah hadir.',
]);
check('RSVP nama sama (beda kapital) -> 201', $code === 201, $code);
check('baris lama yang diperbarui, bukan baris baru', ($body['data']['id'] ?? null) === $manual['id'], [$body['data']['id'] ?? null, $manual['id']]);
check('status jadi attending', ($body['data']['rsvp_status'] ?? null) === 'attending');

$count = Guest::query()->where('invitation_id', $invA['id'])->count();
check('tidak ada dobel: total tamu undangan A tetap 1', $count === 1, $count);

[$code, $body] = api('POST', '/api/invitations/'.$invA['slug'].'/guests', [
    'name' => 'Rina Melati',
    'rsvp_status' => 'not_attending',
    'message' => 'Maaf belum bisa hadir.',
]);
check('RSVP nama baru -> 201 baris baru', $code === 201);
$count = Guest::query()->where('invitation_id', $invA['id'])->count();
check('total tamu undangan A jadi 2', $count === 2, $count);
Carbon::setTestNow();

echo "== T4: daftar tamu lintas undangan (dashboard) ==\n";
[$code, $body] = api('GET', '/api/guests', [], $tokenA);
$list = $body['data'] ?? [];
$hasan = collect($list)->firstWhere('name', 'Bapak Hasan');
$rina = collect($list)->firstWhere('name', 'Rina Melati');
check('GET /api/guests -> 200', $code === 200, $code);
check('hanya tamu milik owner A (2 baris)', count($list) === 2, count($list));
check('urutan created_at desc (Bapak Hasan 2026 sebelum Rina 2020)', ($list[0]['name'] ?? null) === 'Bapak Hasan', array_map(fn ($g) => $g['name'], $list));
check('ringkasan undangan ikut (slug)', ($hasan['invitation']['slug'] ?? null) === $invA['slug'], $hasan['invitation'] ?? null);
check('ringkasan undangan ikut (nama mempelai)', ($hasan['invitation']['groom'] ?? null) === 'Andi Pratama' && ($hasan['invitation']['bride'] ?? null) === 'Sari Dewi');

[$code, $body] = api('GET', '/api/guests', [], $tokenB);
check('owner B tidak melihat tamu owner A', ($body['data'] ?? null) === [], $body['data'] ?? null);

echo "== T5: hapus tamu ==\n";
$rinaId = $rina['id'];
[$code] = api('DELETE', '/api/guests/'.$rinaId, [], $tokenB);
check('hapus oleh bukan owner -> 403', $code === 403, $code);
[$code] = api('DELETE', '/api/guests/'.$rinaId, [], $tokenA);
check('hapus oleh owner -> 204', $code === 204, $code);
$still = Guest::query()->find($rinaId);
check('baris tamu benar-benar hilang', $still === null);
[$code] = api('DELETE', '/api/guests/'.$rinaId, [], $tokenA);
check('hapus ulang -> 404', $code === 404, $code);

[$code, $body] = api('GET', '/api/guests', [], $tokenA);
check('sisa 1 tamu (Bapak Hasan, attending)', count($body['data'] ?? []) === 1 && ($body['data'][0]['name'] ?? null) === 'Bapak Hasan' && ($body['data'][0]['rsvp_status'] ?? null) === 'attending', $body['data'] ?? null);

echo "== T6: halaman publik tetap memuat buku ucapan ==\n";
[$code, $body] = api('GET', '/api/invitations/'.$invA['slug']);
check('GET publik -> 200, guest_count 1', $code === 200 && ($body['data']['guest_count'] ?? null) === 1, [$code, $body['data']['guest_count'] ?? null]);
check('ucapan tampil di payload publik', ($body['data']['guests'][0]['message'] ?? null) === 'Insya Allah hadir.', $body['data']['guests'][0]['message'] ?? null);

Check_cleanup();

function Check_cleanup(): void
{
    echo "== Cleanup fixture ==\n";

    foreach (User::query()->where('email', 'like', '%@uji.test')->get() as $user) {
        $user->tokens()->delete();
    }
    Guest::query()->whereHas('invitation', fn ($q) => $q->whereHas('user', fn ($qq) => $qq->where('email', 'like', '%@uji.test')))->delete();
    Invitation::query()->whereHas('user', fn ($q) => $q->where('email', 'like', '%@uji.test'))->delete();
    User::query()->where('email', 'like', '%@uji.test')->delete();

    echo "  fixture dibersihkan\n";
}

Cache::flush();

echo "\n== SUMMARY: {$pass} passed, {$fail} failed ==\n";
exit($fail === 0 ? 0 : 1);
