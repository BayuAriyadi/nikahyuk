<?php

/**
 * Multi-template (Task 13) verification.
 *
 * Menguji lewat HTTP kernel asli:
 *  - katalog template (klasik/minimalis/floral) diterima POST & PATCH
 *  - nama template di luar katalog ditolak 422 (create dan update)
 *  - PATCH tanpa template_name tidak mengosongkan pilihan lama
 *  - non-owner tidak bisa mengganti template (403)
 *  - payload publik membawa template_name (dipakai halaman tamu)
 *
 * Membersihkan fixture sendiri di awal (email %@uji.test), idempoten.
 */

use App\Models\Invitation;
use App\Models\User;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

$base = '/opt/data/projects/nikahyuk';

require $base.'/vendor/autoload.php';

$app = require $base.'/bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

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
function api(string $method, string $uri, array $payload = [], ?string $token = null): array
{
    global $kernel, $app;

    $server = ['HTTP_ACCEPT' => 'application/json'];

    if ($token !== null) {
        $server['HTTP_AUTHORIZATION'] = 'Bearer '.$token;
    }

    $response = $kernel->handle(Request::create($uri, $method, $payload, [], [], $server));
    $app['auth']->forgetGuards();

    return [$response->getStatusCode(), json_decode((string) $response->getContent(), true)];
}

echo "== Fixture cleanup (reruns) ==\n";

foreach (User::query()->where('email', 'like', '%@uji.test')->get() as $oldUser) {
    $oldUser->tokens()->delete();
}
Invitation::query()->whereHas('user', fn ($q) => $q->where('email', 'like', '%@uji.test'))->delete();
User::query()->where('email', 'like', '%@uji.test')->delete();

echo "== Fixtures ==\n";

$owner = User::create(['name' => 'Owner Template', 'email' => 'owner-template@uji.test', 'password' => 'secret-test-123']);
$other = User::create(['name' => 'Other Template', 'email' => 'other-template@uji.test', 'password' => 'secret-test-123']);
$token = $owner->createToken('verify-t13')->plainTextToken;
$tokenOther = $other->createToken('verify-t13-other')->plainTextToken;

// Katalog ini harus sama dengan:
//   - TEMPLATES di frontend/src/lib/invitationPayload.js
//   - blok [data-template=...] di frontend/src/templates.css
//   - rule in: di Store/UpdateInvitationRequest.php
$catalog = ['klasik', 'minimalis', 'floral', 'ceria', 'elegan'];

echo "== T1: seluruh katalog diterima saat create ==\n";
$slugs = [];
foreach ($catalog as $name) {
    $slug = 'uji-template-'.$name;
    $slugs[] = $slug;
    [$code, $body] = api('POST', '/api/invitations', [
        'template_name' => $name,
        'slug' => $slug,
        'bride_data' => ['groom' => ['name' => 'Raka Pradana'], 'bride' => ['name' => 'Nadia Kusuma']],
    ], $token);
    check("POST template '$name' -> 201", $code === 201 && ($body['data']['template_name'] ?? null) === $name, [$code, $body['data']['template_name'] ?? null]);
}

check('setiap template katalog tersimpan di DB', count(array_unique(DB::table('invitations')->whereIn('slug', $slugs)->pluck('template_name')->all())) === count($catalog));

echo "== T2: nama template di luar katalog ditolak saat create ==\n";
[$code, $body] = api('POST', '/api/invitations', [
    'template_name' => 'template-asing',
    'slug' => 'uji-template-asing',
    'bride_data' => ['groom' => ['name' => 'Asing A'], 'bride' => ['name' => 'Asing B']],
], $token);
check('POST template asing -> 422 template_name', $code === 422 && isset($body['errors']['template_name']), [$code, array_keys($body['errors'] ?? [])]);
check('undangan asing tidak tercipta', DB::table('invitations')->where('slug', 'uji-template-asing')->doesntExist());

echo "== T3: nama template di luar katalog ditolak saat update ==\n";
$id = DB::table('invitations')->where('slug', $slugs[0])->value('id');

[$code, $body] = api('PATCH', '/api/invitations/'.$id, ['template_name' => 'template-asing'], $token);
check('PATCH template asing -> 422 template_name', $code === 422 && isset($body['errors']['template_name']), [$code, array_keys($body['errors'] ?? [])]);

[$code, $body] = api('PATCH', '/api/invitations/'.$id, ['template_name' => 'floral'], $token);
check('PATCH template sah -> 200 floral', $code === 200 && ($body['data']['template_name'] ?? null) === 'floral', [$code, $body['data']['template_name'] ?? null]);

echo "== T4: PATCH tanpa template_name tidak mengosongkan pilihan ==\n";
[$code, $body] = api('PATCH', '/api/invitations/'.$id, ['bride_data' => ['groom' => ['nick' => 'Raka']]], $token);
check('pilihan lama tetap floral', $code === 200 && ($body['data']['template_name'] ?? null) === 'floral', [$code, $body['data']['template_name'] ?? null]);

echo "== T5: hak akses ==\n";
[$code] = api('PATCH', '/api/invitations/'.$id, ['template_name' => 'minimalis'], $tokenOther);
check('non-owner ganti template -> 403', $code === 403, $code);
check('pilihan tetap floral setelah 403', DB::table('invitations')->where('id', $id)->value('template_name') === 'floral');

[$code] = api('PATCH', '/api/invitations/'.$id, ['template_name' => 'minimalis'], 'garbage-token');
check('token palsu -> 401', $code === 401, $code);

echo "== T6: payload publik membawa template_name ==\n";
api('PATCH', '/api/invitations/'.$id, ['status' => 'published'], $token);
[$code, $body] = api('GET', '/api/invitations/'.$slugs[0]);
check('GET publik -> 200', $code === 200, $code);
check('template_name ikut di payload publik', ($body['data']['template_name'] ?? null) === 'floral', $body['data']['template_name'] ?? null);

[$code, $body] = api('GET', '/api/invitations', [], $token);
$found = collect($body['data'] ?? [])->firstWhere('slug', $slugs[0]);
check('dashboard juga membawa template_name', ($found['template_name'] ?? null) === 'floral', $found['template_name'] ?? null);

echo "== T7: template bawaan halaman tamu ==\n";
// Frontend memakai TEMPLATES[0].name = 'klasik' kalau template_name asing/kosong.
[, $body] = api('POST', '/api/invitations', [
    'template_name' => 'klasik',
    'slug' => 'uji-template-default',
    'bride_data' => ['groom' => ['name' => 'Bawaan A'], 'bride' => ['name' => 'Bawaan B']],
], $token);
$slugs[] = 'uji-template-default';
check('template klasik diterima sebagai default', ($body['data']['template_name'] ?? null) === 'klasik', $body['data']['template_name'] ?? null);

echo "\n== SUMMARY: {$pass} passed, {$fail} failed ==\n";

// Bersihkan semua fixture.
Invitation::query()->whereIn('slug', $slugs)->get()->each->delete();
$owner->tokens()->delete();
$other->tokens()->delete();
Invitation::query()->whereHas('user', fn ($q) => $q->where('email', 'like', '%@uji.test'))->delete();
User::query()->where('email', 'like', '%@uji.test')->delete();

exit($fail === 0 ? 0 : 1);
