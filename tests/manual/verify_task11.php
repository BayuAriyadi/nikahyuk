<?php

/**
 * Cerita Kita (love story) verification.
 *
 * Menguji lewat HTTP kernel asli:
 *  - PATCH /api/invitations/{id} menyimpan bride_data.story (list of
 *    {title, date, text}) lewat whitelist JsonbPayload
 *  - story tampil utuh di payload publik (GET /api/invitations/{slug})
 *  - validasi: judul + isi wajib, maks 20 baris, teks maks 1000 char
 *  - list kosong [] mengosongkan cerita; key absen tidak menyentuh nilai lama
 *
 * Membersihkan fixture sendiri di awal (email %@uji.test), idempoten.
 */

use App\Models\Invitation;
use App\Models\User;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

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
Invitation::query()->whereHas('user', fn ($q) => $q->where('email', 'like', '%@uji.test'))->delete();
User::query()->where('email', 'like', '%@uji.test')->delete();

echo "== Fixtures ==\n";

$owner = User::create(['name' => 'Owner Story', 'email' => 'owner-story@uji.test', 'password' => 'secret-test-123']);
$token = $owner->createToken('verify-story')->plainTextToken;

[, $body] = api('POST', '/api/invitations', [
    'template_name' => 'klasik',
    'slug' => 'uji-cerita',
    'bride_data' => ['groom' => ['name' => 'Bagas Prakoso'], 'bride' => ['name' => 'Laras Ayu']],
], $token);
$inv = $body['data'];
api('PATCH', '/api/invitations/'.$inv['id'], ['status' => 'published'], $token);

echo "== T1: simpan cerita ==\n";
$story = [
    ['title' => 'Pertama Bertemu', 'date' => 'Maret 2019', 'text' => "Ketemu di kantin kampus.\nTidak sengaja duduk semeja."],
    ['title' => 'Lamaran', 'date' => 'Juni 2026', 'text' => 'Dilamar di depan keluarga besar.'],
];

[$code, $body] = api('PATCH', '/api/invitations/'.$inv['id'], ['bride_data' => ['story' => $story]], $token);
check('PATCH cerita -> 200', $code === 200, $code);
$saved = $body['data']['bride_data']['story'] ?? null;
check('cerita tersimpan 2 baris', is_array($saved) && count($saved) === 2, is_array($saved) ? count($saved) : $saved);
check('judul + tanggal + isi utuh', ($saved[0]['title'] ?? null) === 'Pertama Bertemu' && ($saved[0]['date'] ?? null) === 'Maret 2019' && str_contains($saved[0]['text'] ?? '', 'kantin'), $saved[0] ?? null);
check('baris kedua ikut tersimpan', ($saved[1]['title'] ?? null) === 'Lamaran', $saved[1] ?? null);

echo "== T2: cerita tampil di payload publik ==\n";
[$code, $body] = api('GET', '/api/invitations/'.$inv['slug']);
$public = $body['data']['bride_data']['story'] ?? null;
check('GET publik memuat cerita', is_array($public) && count($public) === 2, $public);
check('urutan dipertahankan', ($public[0]['title'] ?? null) === 'Pertama Bertemu' && ($public[1]['title'] ?? null) === 'Lamaran');

echo "== T3: data mempelai lain tidak tersentuh ==\n";
$groom = $body['data']['bride_data']['groom'] ?? [];
check('nama mempelai pria masih utuh', ($groom['name'] ?? null) === 'Bagas Prakoso', $groom);

echo "== T4: validasi cerita ==\n";
[$code, $body] = api('PATCH', '/api/invitations/'.$inv['id'], ['bride_data' => ['story' => [['title' => '', 'text' => 'ada isi']]]], $token);
check('judul kosong -> 422', $code === 422 && isset($body['errors']['bride_data.story.0.title']), [$code, array_keys($body['errors'] ?? [])]);

[$code, $body] = api('PATCH', '/api/invitations/'.$inv['id'], ['bride_data' => ['story' => [['title' => 'Ada', 'text' => '']]]], $token);
check('isi kosong -> 422', $code === 422 && isset($body['errors']['bride_data.story.0.text']), [$code, array_keys($body['errors'] ?? [])]);

$tooLong = str_repeat('a', 1001);
[$code, $body] = api('PATCH', '/api/invitations/'.$inv['id'], ['bride_data' => ['story' => [['title' => 'Panjang', 'text' => $tooLong]]]], $token);
check('isi > 1000 char -> 422', $code === 422 && isset($body['errors']['bride_data.story.0.text']), [$code, array_keys($body['errors'] ?? [])]);

$many = [];
for ($i = 1; $i <= 21; $i++) {
    $many[] = ['title' => 'Bagian '.$i, 'text' => 'Isi bagian '.$i];
}
[$code, $body] = api('PATCH', '/api/invitations/'.$inv['id'], ['bride_data' => ['story' => $many]], $token);
check('lebih dari 20 baris -> 422', $code === 422 && isset($body['errors']['bride_data.story']), [$code, array_keys($body['errors'] ?? [])]);

echo "== T5: key tanggal opsional ==\n";
[$code, $body] = api('PATCH', '/api/invitations/'.$inv['id'], ['bride_data' => ['story' => [['title' => 'Tanpa Tanggal', 'text' => 'Tetap boleh.']]]], $token);
check('tanpa tanggal -> 200', $code === 200, $code);
check('tanggal kosong, tidak error', ($body['data']['bride_data']['story'][0]['title'] ?? null) === 'Tanpa Tanggal', $body['data']['bride_data']['story'][0] ?? null);

echo "== T6: daftar kosong mengosongkan cerita ==\n";
[$code, $body] = api('PATCH', '/api/invitations/'.$inv['id'], ['bride_data' => ['story' => []]], $token);
check('PATCH story [] -> 200', $code === 200, $code);
check('cerita jadi kosong', ($body['data']['bride_data']['story'] ?? null) === [], $body['data']['bride_data']['story'] ?? null);

[$code, $body] = api('GET', '/api/invitations/'.$inv['slug']);
check('payload publik ikut kosong', ($body['data']['bride_data']['story'] ?? null) === [], $body['data']['bride_data']['story'] ?? null);

echo "== T7: null menghapus key, key absen tidak menyentuh ==\n";
api('PATCH', '/api/invitations/'.$inv['id'], ['bride_data' => ['story' => $story]], $token);
[$code, $body] = api('PATCH', '/api/invitations/'.$inv['id'], ['bride_data' => ['story' => null]], $token);
check('story null -> key hilang', $code === 200 && ! array_key_exists('story', $body['data']['bride_data'] ?? []), $body['data']['bride_data'] ?? null);

api('PATCH', '/api/invitations/'.$inv['id'], ['bride_data' => ['story' => $story]], $token);
[$code, $body] = api('PATCH', '/api/invitations/'.$inv['id'], ['bride_data' => ['groom' => ['nick' => 'Bagas']]], $token);
check('PATCH tanpa key story -> cerita lama utuh', ($body['data']['bride_data']['story'][0]['title'] ?? null) === 'Pertama Bertemu', $body['data']['bride_data']['story'] ?? null);

echo "== T8: cerita juga divalidasi di route create ==\n";
[$code, $body] = api('POST', '/api/invitations', [
    'template_name' => 'klasik',
    'bride_data' => ['groom' => ['name' => 'X'], 'bride' => ['name' => 'Y'], 'story' => $story],
], $token);
check('POST dengan cerita valid -> 201 + tersimpan', $code === 201 && count($body['data']['bride_data']['story'] ?? []) === 2, [$code, $body['data']['bride_data']['story'] ?? null]);
$createdId = $body['data']['id'] ?? null;

[$code, $body] = api('POST', '/api/invitations', [
    'template_name' => 'klasik',
    'bride_data' => ['groom' => ['name' => 'X'], 'bride' => ['name' => 'Y'], 'story' => [['title' => '', 'text' => 'ada']]],
], $token);
check('POST dengan cerita cacat -> 422', $code === 422 && isset($body['errors']['bride_data.story.0.title']), [$code, array_keys($body['errors'] ?? [])]);

if ($createdId) {
    api('DELETE', '/api/invitations/'.$createdId, [], $token);
}

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
