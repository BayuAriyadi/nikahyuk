<?php

/**
 * Task 4 harness — halaman "Undangan Saya":
 *   - GET  /api/invitations          (index, owner only)
 *   - POST /api/invitations          (payload ala form create)
 *
 * Run: php tests/manual/verify_task4.php   (dari root project)
 */

$base = dirname(__DIR__, 2);
require $base.'/vendor/autoload.php';

$app = require $base.'/bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();

use App\Models\Invitation;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;

$pass = 0;
$fail = 0;

function ok(bool $condition, string $label): void
{
    global $pass, $fail;

    if ($condition) {
        $pass++;
        echo "  ok   - {$label}\n";
    } else {
        $fail++;
        echo "  FAIL - {$label}\n";
    }
}

function json(string $method, string $uri, array $payload = [], ?string $token = null): array
{
    global $kernel;

    $server = ['HTTP_ACCEPT' => 'application/json'];

    if ($token) {
        $server['HTTP_AUTHORIZATION'] = 'Bearer '.$token;
    }

    $response = $kernel->handle(
        \Illuminate\Http\Request::create($uri, $method, $payload, [], [], $server),
    );

    app('auth')->forgetGuards();

    return [$response->getStatusCode(), json_decode($response->getContent(), true)];
}

$suffix = bin2hex(random_bytes(4));
$emails = ["task4-a-{$suffix}@uji.test", "task4-b-{$suffix}@uji.test"];

$userA = User::create(['name' => 'Owner A', 'email' => $emails[0], 'password' => Hash::make('password123')]);
$userB = User::create(['name' => 'Owner B', 'email' => $emails[1], 'password' => Hash::make('password123')]);

$tokenA = $userA->createToken('task4-test')->plainTextToken;
$tokenB = $userB->createToken('task4-test')->plainTextToken;

echo "== GET /api/invitations (index) ==\n";

[$status] = json('GET', '/api/invitations');
ok($status === 401, 'tanpa token -> 401');

[$status, $body] = json('GET', '/api/invitations', [], $tokenA);
ok($status === 200, 'dengan token -> 200');
ok(is_array($body['data'] ?? null) && count($body['data']) === 0, 'user baru -> data = []');

echo "== POST /api/invitations (payload form) ==\n";

$formPayload = [
    'template_name' => 'klasik',
    'bride_data' => [
        'groom' => ['name' => 'Andi Uji'],
        'bride' => ['name' => 'Sari Uji'],
    ],
    'event_data' => [
        'resepsi' => [
            'date' => '2026-12-01',
            'time' => '10:00',
            'venue' => 'Gedung Uji',
            'address' => 'Jl. Uji No. 1',
        ],
    ],
];

[$status, $body] = json('POST', '/api/invitations', $formPayload, $tokenA);
ok($status === 201, 'create -> 201');

$invitation = $body['data'] ?? [];
ok(($invitation['slug'] ?? null) === 'andi-uji-sari-uji', 'slug auto dari nama mempelai');
ok(($invitation['bride_data']['groom']['name'] ?? null) === 'Andi Uji', 'bride_data.groom.name tersimpan');
ok(($invitation['bride_data']['bride']['name'] ?? null) === 'Sari Uji', 'bride_data.bride.name tersimpan');
ok(($invitation['event_data']['resepsi']['date'] ?? null) === '2026-12-01', 'event_data.resepsi.date tersimpan');
ok(($invitation['event_data']['resepsi']['venue'] ?? null) === 'Gedung Uji', 'event_data.resepsi.venue tersimpan');
ok(($invitation['status'] ?? null) === 'draft', 'status mulai sebagai draft');

$dirty = $formPayload;
$dirty['bride_data']['groom']['hacker'] = 'x';
$dirty['event_data']['resepsi']['extra'] = 'y';

[$status, $body] = json('POST', '/api/invitations', $dirty, $tokenA);
ok($status === 201, 'create dengan key asing -> 201');
ok(! array_key_exists('hacker', $body['data']['bride_data']['groom'] ?? []), 'key asing di groom dibuang');
ok(! array_key_exists('extra', $body['data']['event_data']['resepsi'] ?? []), 'key asing di resepsi dibuang');

$rows = Invitation::query()->where('user_id', $userA->id)->orderBy('slug')->get();
ok($rows->count() === 2, 'dua undangan tersimpan di DB');
ok($rows->pluck('slug')->unique()->count() === 2, 'slug tetap unik (auto suffix)');

$raw = $rows->first()->getRawOriginal('bride_data');
ok(is_string($raw) && json_decode($raw, true)['groom']['name'] === 'Andi Uji', 'kolom bride_data benar-benar jsonb (raw string JSON)');

echo "== GET /api/invitations setelah create ==\n";

[$status, $body] = json('GET', '/api/invitations', [], $tokenA);
ok($status === 200 && count($body['data']) === 2, 'list berisi 2 undangan milik user A');
ok(isset($body['data'][0]['id'], $body['data'][0]['slug'], $body['data'][0]['status']), 'item list punya id, slug, status');

[$status, $body] = json('GET', '/api/invitations', [], $tokenB);
ok($status === 200 && count($body['data']) === 0, 'user B tidak melihat undangan user A');

echo "== Validasi 422 untuk form ==\n";

[$status, $body] = json('POST', '/api/invitations', [
    'template_name' => 'klasik',
    'bride_data' => ['groom' => [], 'bride' => ['name' => 'X']],
], $tokenA);
ok($status === 422, 'groom tanpa name -> 422');
ok(isset($body['errors']['bride_data.groom.name']), 'error key = bride_data.groom.name');

[$status, $body] = json('POST', '/api/invitations', [
    'template_name' => 'klasik',
    'bride_data' => ['groom' => ['name' => 'A'], 'bride' => ['name' => 'B']],
    'event_data' => ['resepsi' => ['date' => '01-12-2026', 'venue' => 'X']],
], $tokenA);
ok($status === 422, 'tanggal format salah -> 422');
ok(isset($body['errors']['event_data.resepsi.date']), 'error key = event_data.resepsi.date');

echo "== Cleanup ==\n";

Invitation::query()->whereIn('user_id', [$userA->id, $userB->id])->delete();
$userA->tokens()->delete();
$userB->tokens()->delete();
$userA->delete();
$userB->delete();

$left = User::query()->whereIn('email', $emails)->count();
ok($left === 0, 'fixture user terhapus');

Cache::flush();

echo "\n== SUMMARY: {$pass} passed, {$fail} failed ==\n";
exit($fail > 0 ? 1 : 0);
