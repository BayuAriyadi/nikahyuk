<?php

/**
 * Task 2 verification — exercises the real HTTP kernel of the nikahyuk app:
 * routing, middleware, Sanctum auth, FormRequest validation, JSONB
 * whitelisting/merging, resources and policies, end to end.
 *
 * Leaves fixtures behind (published invitation "andi-sari" + guests) for a
 * separate curl smoke test; run cleanup_task2.php afterwards.
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

// Fresh rate-limiter state: a rerun must never inherit throttle counters
// left behind by an earlier run (they share one bucket per route+IP).
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

    // Reset resolved guards so the next simulated request starts clean.
    $app['auth']->forgetGuards();

    return [$response->getStatusCode(), json_decode((string) $response->getContent(), true)];
}

echo "== Fixture cleanup (reruns) ==\n";

$oldUsers = User::query()->where('email', 'like', '%@uji.test')->get();
foreach ($oldUsers as $oldUser) {
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

$full = [
    'template_name' => 'floral',
    'template_config' => [
        'palette' => ['primary' => '#8B5E3C', 'secondary' => '#F5EFE6'],
        'font' => ['heading' => 'Playfair Display', 'body' => 'Inter'],
        'music_url' => 'https://example.com/song.mp3',
        'music_enabled' => true,
        'gift' => ['enabled' => true, 'accounts' => [
            ['bank' => 'BCA', 'number' => '1234567890', 'name' => 'Andi Pratama'],
        ]],
        'evil_key' => 'must-be-dropped',
    ],
    'bride_data' => [
        'groom' => ['name' => 'Andi Pratama', 'nick' => 'Andi', 'father' => 'Bapak Slamet', 'mother' => 'Ibu Sri', 'instagram' => 'andi.a', 'hack' => 'drop-me'],
        'bride' => ['name' => 'Sari Dewi', 'nick' => 'Sari'],
    ],
    'event_data' => [
        'akad' => ['date' => '2026-12-01', 'time' => '09:00', 'venue' => 'Masjid Agung', 'maps_url' => 'https://maps.app.goo.gl/abc'],
        'resepsi' => ['date' => '2026-12-01', 'time' => '11:00', 'venue' => 'Gedung A'],
    ],
];

echo "== T1: auth required for create ==\n";
[$code] = api('POST', '/api/invitations', $full);
check('POST /api/invitations without token -> 401', $code === 401, $code);

echo "== T2: create invitation (valid, JSONB junk keys injected) ==\n";
[$code, $body] = api('POST', '/api/invitations', $full, $tokenA);
$inv1 = $body['data'] ?? [];
check('create -> 201', $code === 201, $code);
check('slug auto-generated from nicknames = andi-sari', ($inv1['slug'] ?? null) === 'andi-sari', $inv1['slug'] ?? null);
check('status starts as draft', ($inv1['status'] ?? null) === 'draft');
check('evil_key dropped from template_config', ! array_key_exists('evil_key', $inv1['template_config'] ?? []));
check('hack key dropped from bride_data.groom', ! array_key_exists('hack', $inv1['bride_data']['groom'] ?? []));
check('jsonb content intact (palette + gift account)', ($inv1['template_config']['palette']['primary'] ?? null) === '#8B5E3C' && ($inv1['template_config']['gift']['accounts'][0]['bank'] ?? null) === 'BCA');
check('bride_data roundtrip', ($inv1['bride_data']['groom']['name'] ?? null) === 'Andi Pratama' && ($inv1['bride_data']['bride']['name'] ?? null) === 'Sari Dewi');
check('uuid primary key returned', is_string($inv1['id'] ?? null) && strlen($inv1['id']) === 36);

$row = DB::table('invitations')->where('id', $inv1['id'])->first();
check('DB jsonb column contains no junk keys', $row !== null && ! str_contains($row->bride_data, 'hack') && ! str_contains($row->template_config, 'evil_key'));

echo "== T3: slug uniqueness when names collide ==\n";
[$code, $body] = api('POST', '/api/invitations', $full, $tokenA);
$inv2 = $body['data'] ?? [];
check('second create -> 201 with suffixed slug andi-sari-2', $code === 201 && ($inv2['slug'] ?? null) === 'andi-sari-2', [$code, $inv2['slug'] ?? null]);

echo "== T4: JSONB validation rejects bad payloads (422 + field errors) ==\n";
$bad = $full;
$bad['template_config']['palette']['primary'] = 'red';
[$code, $body] = api('POST', '/api/invitations', $bad, $tokenA);
check('invalid hex color -> 422 template_config.palette.primary', $code === 422 && isset($body['errors']['template_config.palette.primary']), [$code, array_keys($body['errors'] ?? [])]);

$bad = $full;
unset($bad['bride_data']['bride']['name']);
[$code, $body] = api('POST', '/api/invitations', $bad, $tokenA);
check('missing bride name -> 422 bride_data.bride.name', $code === 422 && isset($body['errors']['bride_data.bride.name']), [$code, array_keys($body['errors'] ?? [])]);

$bad = $full;
unset($bad['event_data']['akad']['date']);
[$code, $body] = api('POST', '/api/invitations', $bad, $tokenA);
check('akad present without date -> 422 event_data.akad.date', $code === 422 && isset($body['errors']['event_data.akad.date']), [$code, array_keys($body['errors'] ?? [])]);

$bad = $full;
$bad['event_data']['akad']['date'] = '2026-13-45';
[$code, $body] = api('POST', '/api/invitations', $bad, $tokenA);
check('impossible date 2026-13-45 -> 422', $code === 422 && isset($body['errors']['event_data.akad.date']), [$code, array_keys($body['errors'] ?? [])]);

$bad = $full;
$bad['event_data']['akad']['maps_url'] = 'not-a-url';
[$code, $body] = api('POST', '/api/invitations', $bad, $tokenA);
check('invalid maps_url -> 422', $code === 422 && isset($body['errors']['event_data.akad.maps_url']), [$code, array_keys($body['errors'] ?? [])]);

echo "== T5: update as owner — deep merge, no wipe ==\n";
[$code, $body] = api('PATCH', '/api/invitations/'.$inv1['id'], [
    'status' => 'published',
    'template_config' => ['palette' => ['accent' => '#C9A227'], 'junk_key' => 'nope'],
    'event_data' => ['resepsi' => ['venue' => 'Gedung Baru', 'address' => 'Jl. Baru No. 2']],
], $tokenA);
$upd = $body['data'] ?? [];
check('PATCH -> 200', $code === 200, $code);
check('merge: resepsi.venue updated', ($upd['event_data']['resepsi']['venue'] ?? null) === 'Gedung Baru');
check('merge: resepsi.date/time kept (not wiped)', ($upd['event_data']['resepsi']['date'] ?? null) === '2026-12-01' && ($upd['event_data']['resepsi']['time'] ?? null) === '11:00');
check('merge: akad branch untouched', ($upd['event_data']['akad']['venue'] ?? null) === 'Masjid Agung');
check('merge: palette.primary kept + accent added', ($upd['template_config']['palette']['primary'] ?? null) === '#8B5E3C' && ($upd['template_config']['palette']['accent'] ?? null) === '#C9A227');
check('merge: font/gift kept', ($upd['template_config']['font']['heading'] ?? null) === 'Playfair Display' && ($upd['template_config']['gift']['accounts'][0]['number'] ?? null) === '1234567890');
check('junk_key dropped on update', ! array_key_exists('junk_key', $upd['template_config'] ?? []));
check('status now published', ($upd['status'] ?? null) === 'published');

[$code, $body] = api('PATCH', '/api/invitations/'.$inv1['id'], ['bride_data' => ['groom' => ['instagram' => 'bad handle!']]], $tokenA);
check('invalid leaf on update -> 422 bride_data.groom.instagram', $code === 422 && isset($body['errors']['bride_data.groom.instagram']), [$code, array_keys($body['errors'] ?? [])]);

echo "== T6: authorization ==\n";
[$code] = api('PATCH', '/api/invitations/'.$inv1['id'], ['template_name' => 'minimalis'], $tokenB);
check('non-owner PATCH -> 403', $code === 403, $code);
[$code] = api('PATCH', '/api/invitations/'.$inv1['id'], ['template_name' => 'minimalis'], 'garbage-token');
check('garbage token -> 401', $code === 401, $code);
[$code, $body] = api('PATCH', '/api/invitations/'.$inv1['id'], ['template_name' => 'template-asing'], $tokenA);
check('unknown template_name -> 422', $code === 422 && isset($body['errors']['template_name']), [$code, array_keys($body['errors'] ?? [])]);

echo "== T7: public GET by slug ==\n";
[$code, $body] = api('GET', '/api/invitations/andi-sari');
$pub = $body['data'] ?? [];
check('GET /api/invitations/andi-sari -> 200', $code === 200, $code);
check('public payload carries bride_data + event_data', ($pub['bride_data']['groom']['name'] ?? null) === 'Andi Pratama' && ($pub['event_data']['resepsi']['venue'] ?? null) === 'Gedung Baru');
check('guest_count 0 and empty guest list', ($pub['guest_count'] ?? null) === 0 && ($pub['guests'] ?? null) === []);
$flat = json_encode($pub);
check('public payload does not leak owner internals', ! str_contains($flat, 'user_id') && ! str_contains($flat, 'owner-a@uji.test') && ! str_contains($flat, 'password'));

echo "== T8/T9: drafts are invisible to the public ==\n";
[$code] = api('GET', '/api/invitations/andi-sari-2');
check('GET draft slug -> 404', $code === 404, $code);
[$code] = api('POST', '/api/invitations/andi-sari-2/guests', ['name' => 'Tamu', 'rsvp_status' => 'attending']);
check('POST guest to draft slug -> 404', $code === 404, $code);

echo "== T10: guest RSVP + ucapan (public, sanitized) ==\n";
Carbon::setTestNow('2020-01-01 10:00:00');
[$code, $body] = api('POST', '/api/invitations/andi-sari/guests', [
    'name' => 'Tamu Satu ',
    'rsvp_status' => 'attending',
    'message' => 'Selamat ya! <script>alert(1)</script> semoga langgeng',
]);
$g1 = $body['data'] ?? [];
check('guest submit -> 201', $code === 201, $code);
check('name trimmed', ($g1['name'] ?? null) === 'Tamu Satu', $g1['name'] ?? null);
check('message stored with tags stripped', isset($g1['message']) && ! str_contains($g1['message'], '<script>') && str_contains($g1['message'], 'alert(1)'), $g1['message'] ?? null);
check('rsvp_status stored', ($g1['rsvp_status'] ?? null) === 'attending');

echo "== T11: guest validation ==\n";
[$code, $body] = api('POST', '/api/invitations/andi-sari/guests', ['name' => 'Tamu', 'rsvp_status' => 'maybe']);
check('rsvp_status maybe -> 422', $code === 422 && isset($body['errors']['rsvp_status']), [$code, array_keys($body['errors'] ?? [])]);
[$code, $body] = api('POST', '/api/invitations/andi-sari/guests', ['rsvp_status' => 'attending']);
check('missing name -> 422', $code === 422 && isset($body['errors']['name']), [$code, array_keys($body['errors'] ?? [])]);
[$code, $body] = api('POST', '/api/invitations/andi-sari/guests', ['name' => 'Tamu', 'rsvp_status' => 'attending', 'message' => str_repeat('a', 600)]);
check('message over 500 chars -> 422', $code === 422 && isset($body['errors']['message']), [$code, array_keys($body['errors'] ?? [])]);

Carbon::setTestNow('2020-01-01 10:05:00');
[$code, $body] = api('POST', '/api/invitations/andi-sari/guests', ['name' => 'Tamu Dua', 'rsvp_status' => 'not_attending']);
$g2 = $body['data'] ?? [];
check('guest without message -> 201, message null', $code === 201 && array_key_exists('message', $g2) && $g2['message'] === null, [$code, $g2['message'] ?? 'missing']);
Carbon::setTestNow();

echo "== T13: public GET now returns the guest book ==\n";
[$code, $body] = api('GET', '/api/invitations/andi-sari');
$pub = $body['data'] ?? [];
check('guest_count == 2', ($pub['guest_count'] ?? null) === 2, $pub['guest_count'] ?? null);
check('guests listed latest-first', count($pub['guests'] ?? []) === 2 && ($pub['guests'][0]['name'] ?? null) === 'Tamu Dua', array_map(fn ($g) => $g['name'] ?? null, $pub['guests'] ?? []));

echo "== T14: /api/user with token ==\n";
[$code, $body] = api('GET', '/api/user', [], $tokenA);
check('GET /api/user -> 200 owner-a', $code === 200 && ($body['email'] ?? null) === 'owner-a@uji.test', [$code, $body['email'] ?? null]);

file_put_contents('/opt/data/cache/scratch/task2_fixtures.json', json_encode([
    'token_a' => $tokenA,
    'inv1_id' => $inv1['id'],
    'slug_published' => 'andi-sari',
    'slug_draft' => 'andi-sari-2',
], JSON_PRETTY_PRINT));

Cache::flush();

echo "\n== SUMMARY: {$pass} passed, {$fail} failed ==\n";
exit($fail === 0 ? 0 : 1);
