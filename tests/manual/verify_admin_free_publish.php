<?php

/**
 * Verifikasi fitur: akun admin menerbitkan undangan TANPA QRIS.
 *
 *   - non-admin : checkout -> 201, tagihan QRIS normal (regresi)
 *   - admin     : checkout -> 200 {published:true, free:true}, status undangan
 *                 langsung "published", TANPA baris transaksi (rekap pendapatan
 *                 tetap berisi uang asli)
 *   - admin     : checkout ulang undangan yang sudah terbit -> 422
 *   - admin     : checkout undangan MILIK ORANG LAIN -> 403 (policy owner-only,
 *                 admin tidak bisa menerbitkan gratis undangan user lain)
 *
 * Mock data fiktif — TIDAK memakai identitas asli.
 * Run: php tests/manual/verify_admin_free_publish.php   (dari root project)
 */

$base = dirname(__DIR__, 2);
require $base.'/vendor/autoload.php';

$app = require $base.'/bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();

use App\Models\Invitation;
use App\Models\Transaction;
use App\Models\User;
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

$userR = User::create([
    'name' => 'Reguler Uji',
    'email' => "afp-reg-{$suffix}@uji.test",
    'password' => Hash::make('password123'),
]);
$userA = User::create([
    'name' => 'Admin Uji',
    'email' => "afp-adm-{$suffix}@uji.test",
    'password' => Hash::make('password123'),
]);
$userA->forceFill(['role' => 'admin'])->save();

$tokenR = $userR->createToken('afp-test')->plainTextToken;
$tokenA = $userA->createToken('afp-test')->plainTextToken;

function invitationPayload(string $suffixGroom): array
{
    return [
        'template_name' => 'klasik',
        'bride_data' => [
            'groom' => ['name' => $suffixGroom],
            'bride' => ['name' => 'Sari Dummy'],
        ],
        'event_data' => [
            'resepsi' => ['date' => '2026-12-12', 'venue' => 'Gedung Uji Admin'],
        ],
    ];
}

echo "== Setup ==\n";
ok($userA->fresh()->role === 'admin', 'user admin fixture ber-role admin');

echo "== Regresi: non-admin tetap lewat QRIS ==\n";

[$status, $body] = json('POST', '/api/invitations', invitationPayload("Raka Dummy {$suffix}"), $tokenR);
$invR = $body['data'] ?? [];
$slugR = $invR['slug'] ?? null;
ok($status === 201 && $slugR, "create undangan reguler -> 201 ({$slugR})");

[$status, $body] = json('POST', "/api/invitations/{$slugR}/checkout", [], $tokenR);
ok($status === 201, 'reguler checkout -> 201 (tagihan QRIS dibuat)');
ok(($body['data']['payment_status'] ?? null) === 'pending', 'reguler: payment_status = pending');
ok((int) ($body['data']['amount'] ?? 0) === 49000, 'reguler: amount = 49000');
ok(! isset($body['data']['published']), 'reguler: response TIDAK ber-flag published');

$invRModel = Invitation::query()->where('slug', $slugR)->first();
ok(Transaction::query()->where('invitation_id', $invRModel->id)->count() === 1, 'reguler: 1 baris transaksi tercatat');
ok($invRModel->status === 'draft', 'reguler: status masih draft (belum bayar)');

echo "== Admin: terbit gratis tanpa QRIS ==\n";

[$status, $body] = json('POST', '/api/invitations', invitationPayload("Bayu Dummy {$suffix}"), $tokenA);
$invA = $body['data'] ?? [];
$slugA = $invA['slug'] ?? null;
ok($status === 201 && $slugA, "create undangan admin -> 201 ({$slugA})");
ok(($invA['status'] ?? null) === 'draft', 'admin: status awal = draft');

[$status, $body] = json('POST', "/api/invitations/{$slugA}/checkout", [], $tokenA);
ok($status === 200, 'admin checkout -> 200 (bukan 201, tanpa tagihan)');
ok(($body['data']['published'] ?? null) === true, 'admin: response published = true');
ok(($body['data']['free'] ?? null) === true, 'admin: response free = true');
ok(($body['data']['slug'] ?? null) === $slugA, 'admin: slug dikembalikan');

$invAModel = Invitation::query()->where('slug', $slugA)->first();
ok($invAModel->status === 'published', 'admin: undangan langsung berstatus published');
ok(Transaction::query()->where('invitation_id', $invAModel->id)->count() === 0, 'admin: TANPA baris transaksi (rekap pendapatan bersih)');

[$status, $body] = json('POST', "/api/invitations/{$slugA}/checkout", [], $tokenA);
ok($status === 422, 'admin: checkout ulang undangan terbit -> 422');

echo "== Batas: admin bukan pemilik ==\n";

[$status] = json('POST', "/api/invitations/{$slugR}/checkout", [], $tokenA);
ok($status === 403, 'admin checkout undangan user lain -> 403 (policy owner-only)');
ok($invRModel->fresh()->status === 'draft', 'undangan user lain tetap draft (tidak diterbitkan diam-diam)');

echo "== Cleanup fixture ==\n";

Transaction::query()->whereIn('invitation_id', [$invRModel->id, $invAModel->id])->delete();
$invAModel->delete();
$invRModel->delete();
$userR->tokens()->delete();
$userA->tokens()->delete();
$userR->delete();
$userA->delete();
ok(Invitation::query()->where('slug', $slugR)->doesntExist() && Invitation::query()->where('slug', $slugA)->doesntExist(), 'fixture undangan terhapus');

echo "\n== Hasil: {$pass} ok, {$fail} FAIL ==\n";
exit($fail === 0 ? 0 : 1);
