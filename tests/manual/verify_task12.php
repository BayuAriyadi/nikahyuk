<?php

/**
 * Statistik kunjungan undangan verification.
 *
 * Menguji lewat HTTP kernel asli:
 *  - GET publik /api/invitations/{slug} menaikkan visit_count + last_visited_at
 *  - kunjungan berulang dari IP sama dalam 30 menit dihitung SEKALI (dedupe
 *    per IP+slug lewat cache)
 *  - IP berbeda dihitung terpisah
 *  - undangan draft tidak dihitung (404, statistik tidak naik)
 *  - InvitationResource (dashboard) membawa visit_count + last_visited_at
 *  - counter naik atomic: N kunjungan = N (tidak ada lost update)
 *
 * Membersihkan fixture sendiri di awal (email %@uji.test), idempoten.
 */

use App\Models\Invitation;
use App\Models\User;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;
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

/**
 * @param  array<string, mixed>  $payload
 * @return array{0: int, 1: array<string, mixed>|null}
 */
function api(string $method, string $uri, array $payload = [], ?string $token = null, ?string $ip = null): array
{
    global $kernel, $app;

    $server = ['HTTP_ACCEPT' => 'application/json'];

    if ($token !== null) {
        $server['HTTP_AUTHORIZATION'] = 'Bearer '.$token;
    }

    if ($ip !== null) {
        $server['REMOTE_ADDR'] = $ip;
    }

    $request = Request::create($uri, $method, $payload, [], [], $server);

    if ($ip !== null) {
        $request->server->set('REMOTE_ADDR', $ip);
    }

    $response = $kernel->handle($request);

    $app['auth']->forgetGuards();

    return [$response->getStatusCode(), json_decode((string) $response->getContent(), true)];
}

function visitCounter(string $id): int
{
    return (int) DB::table('invitations')->where('id', $id)->value('visit_count');
}

echo "== Fixture cleanup (reruns) ==\n";

foreach (User::query()->where('email', 'like', '%@uji.test')->get() as $oldUser) {
    $oldUser->tokens()->delete();
}
Invitation::query()->whereHas('user', fn ($q) => $q->where('email', 'like', '%@uji.test'))->delete();
User::query()->where('email', 'like', '%@uji.test')->delete();

echo "== Fixtures ==\n";

$owner = User::create(['name' => 'Owner Stat', 'email' => 'owner-stat@uji.test', 'password' => 'secret-test-123']);
$token = $owner->createToken('verify-stat')->plainTextToken;

[, $body] = api('POST', '/api/invitations', [
    'template_name' => 'klasik',
    'slug' => 'uji-statistik',
    'bride_data' => ['groom' => ['name' => 'Damar Wibowo'], 'bride' => ['name' => 'Sinta Larasati']],
], $token);
$inv = $body['data'];
api('PATCH', '/api/invitations/'.$inv['id'], ['status' => 'published'], $token);

[$code, $body] = api('GET', '/api/invitations', [], $token);
$found = collect($body['data'])->firstWhere('slug', 'uji-statistik');
check('resource dashboard membawa visit_count awal 0', ($found['visit_count'] ?? null) === 0, $found['visit_count'] ?? null);
check('resource dashboard membawa last_visited_at null', array_key_exists('last_visited_at', $found ?? []) && ($found['last_visited_at'] ?? null) === null, $found['last_visited_at'] ?? null);

echo "== T1: kunjungan pertama dihitung ==\n";
[$code] = api('GET', '/api/invitations/uji-statistik', [], null, '203.0.113.10');
check('GET publik -> 200', $code === 200, $code);
check('visit_count jadi 1', visitCounter($inv['id']) === 1, visitCounter($inv['id']));

echo "== T2: refresh berulang dari IP sama tidak dihitung lagi ==\n";
api('GET', '/api/invitations/uji-statistik', [], null, '203.0.113.10');
api('GET', '/api/invitations/uji-statistik', [], null, '203.0.113.10');
check('3x buka dari IP sama tetap 1', visitCounter($inv['id']) === 1, visitCounter($inv['id']));

echo "== T3: IP berbeda dihitung terpisah ==\n";
api('GET', '/api/invitations/uji-statistik', [], null, '203.0.113.11');
api('GET', '/api/invitations/uji-statistik', [], null, '203.0.113.12');
check('3 IP berbeda -> 3 kunjungan', visitCounter($inv['id']) === 3, visitCounter($inv['id']));

[$code, $body] = api('GET', '/api/invitations', [], $token);
$found = collect($body['data'])->firstWhere('slug', 'uji-statistik');
check('resource dashboard ikut naik jadi 3', ($found['visit_count'] ?? null) === 3, $found['visit_count'] ?? null);
check('last_visited_at terisi', ! empty($found['last_visited_at']), $found['last_visited_at'] ?? null);

echo "== T4: undangan draft tidak dihitung ==\n";
[, $body] = api('POST', '/api/invitations', [
    'template_name' => 'klasik',
    'slug' => 'uji-statistik-draft',
    'bride_data' => ['groom' => ['name' => 'Draft A'], 'bride' => ['name' => 'Draft B']],
], $token);
$draft = $body['data'];
[$code] = api('GET', '/api/invitations/uji-statistik-draft', [], null, '203.0.113.99');
check('undangan draft -> 404', $code === 404, $code);
check('statistik draft tetap 0', visitCounter($draft['id']) === 0, visitCounter($draft['id']));

echo "== T5: slug tidak ada tidak menyentuh apa pun ==\n";
[$code] = api('GET', '/api/invitations/tidak-ada-undangan', [], null, '203.0.113.99');
check('slug asing -> 404', $code === 404, $code);
check('undangan lain tetap 3', visitCounter($inv['id']) === 3, visitCounter($inv['id']));

echo "== T6: dedupe per undangan, bukan global ==\n";
[, $body] = api('POST', '/api/invitations', [
    'template_name' => 'klasik',
    'slug' => 'uji-statistik-2',
    'bride_data' => ['groom' => ['name' => 'Kedua A'], 'bride' => ['name' => 'Kedua B']],
], $token);
$inv2 = $body['data'];
api('PATCH', '/api/invitations/'.$inv2['id'], ['status' => 'published'], $token);

api('GET', '/api/invitations/uji-statistik-2', [], null, '203.0.113.10');
check('IP sama, undangan lain tetap dihitung', visitCounter($inv2['id']) === 1, visitCounter($inv2['id']));
check('undangan pertama tidak ikut naik', visitCounter($inv['id']) === 3, visitCounter($inv['id']));

echo "== T7: cache kedaluwarsa -> kunjungan berikutnya dihitung lagi ==\n";
Cache::flush();
api('GET', '/api/invitations/uji-statistik', [], null, '203.0.113.10');
check('setelah cache bersih, IP sama dihitung lagi (4)', visitCounter($inv['id']) === 4, visitCounter($inv['id']));

echo "== T8: increment atomic (10 kunjungan = +10) ==\n";
$before = visitCounter($inv['id']);
for ($i = 0; $i < 10; $i++) {
    Cache::forget('visit:'.$inv['id'].':'.sha1('198.51.100.'.$i));
    api('GET', '/api/invitations/uji-statistik', [], null, '198.51.100.'.$i);
}
check('10 pengunjung unik -> tepat +10', visitCounter($inv['id']) === $before + 10, [visitCounter($inv['id']), $before]);

echo "== T9: payload publik tidak membocorkan kolom statistik ==\n";
[$code, $body] = api('GET', '/api/invitations/uji-statistik', [], null, '198.51.100.200');
check('payload publik tanpa visit_count', ! array_key_exists('visit_count', $body['data'] ?? []), array_keys($body['data'] ?? []));
check('payload publik tanpa last_visited_at', ! array_key_exists('last_visited_at', $body['data'] ?? []));

echo "== Cleanup fixture ==\n";
foreach (User::query()->where('email', 'like', '%@uji.test')->get() as $user) {
    $user->tokens()->delete();
}
Invitation::query()->whereHas('user', fn ($q) => $q->where('email', 'like', '%@uji.test'))->delete();
User::query()->where('email', 'like', '%@uji.test')->delete();

echo "  fixture dibersihkan\n";

Cache::flush();

echo "\n== SUMMARY: {$pass} passed, {$fail} failed ==\n";
exit($fail === 0 ? 0 : 1);
