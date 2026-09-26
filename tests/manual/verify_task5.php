<?php

/**
 * Task 5 harness — webhook & integrasi pembayaran QRIS:
 *   - POST /api/invitations/{slug}/checkout   (owner, buat tagihan QRIS)
 *   - GET  /api/transactions/{order_id}       (owner, polling status)
 *   - POST /webhooks/midtrans                 (server gateway, signature SHA512)
 *   - draft -> published setelah webhook settlement
 *
 * Mock data fiktif (Andi/Sari Dummy) — TIDAK memakai identitas asli.
 *
 * Run: php tests/manual/verify_task5.php   (dari root project)
 */

$base = dirname(__DIR__, 2);
require $base.'/vendor/autoload.php';

$app = require $base.'/bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();

use App\Models\Invitation;
use App\Models\PaymentEvent;
use App\Models\Transaction;
use App\Models\User;
use App\Support\MidtransSignature;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
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

/** Webhook: kirim body JSON asli (seperti server Midtrans), tanpa token. */
function webhook(array $payload): array
{
    global $kernel;

    $request = \Illuminate\Http\Request::create(
        '/api/webhooks/midtrans',
        'POST',
        [], [], [],
        ['HTTP_ACCEPT' => 'application/json', 'CONTENT_TYPE' => 'application/json'],
        json_encode($payload, JSON_UNESCAPED_SLASHES),
    );

    $response = $kernel->handle($request);
    app('auth')->forgetGuards();

    return [$response->getStatusCode(), json_decode($response->getContent(), true)];
}

function midtransPayload(string $orderId, string $status, string $gross = '49000.00', string $statusCode = '200', ?string $signatureOverride = null): array
{
    $serverKey = (string) config('midtrans.server_key');

    return [
        'transaction_id' => 'sim-'.bin2hex(random_bytes(8)),
        'order_id' => $orderId,
        'gross_amount' => $gross,
        'currency' => 'IDR',
        'payment_type' => 'qris',
        'status_code' => $statusCode,
        'transaction_status' => $status,
        'fraud_status' => 'accept',
        'transaction_time' => now()->format('Y-m-d H:i:s'),
        'signature_key' => $signatureOverride ?? MidtransSignature::make($orderId, $statusCode, $gross, $serverKey),
    ];
}

$suffix = bin2hex(random_bytes(4));
$emails = ["task5-a-{$suffix}@uji.test", "task5-b-{$suffix}@uji.test"];

$userA = User::create(['name' => 'Owner Lima A', 'email' => $emails[0], 'password' => Hash::make('password123')]);
$userB = User::create(['name' => 'Owner Lima B', 'email' => $emails[1], 'password' => Hash::make('password123')]);

$tokenA = $userA->createToken('task5-test')->plainTextToken;
$tokenB = $userB->createToken('task5-test')->plainTextToken;

$invitationPayload = [
    'template_name' => 'klasik',
    'bride_data' => [
        'groom' => ['name' => 'Andi Dummy'],
        'bride' => ['name' => 'Sari Dummy'],
    ],
    'event_data' => [
        'resepsi' => ['date' => '2026-12-05', 'venue' => 'Gedung Uji Lima'],
    ],
];

echo "== Setup: undangan milik user A (fiktif) ==\n";

[$status, $body] = json('POST', '/api/invitations', $invitationPayload, $tokenA);
$inv1 = $body['data'] ?? [];
$slug1 = $inv1['slug'] ?? null;
ok($status === 201 && $slug1 === 'andi-dummy-sari-dummy', "create undangan 1 -> 201 (slug {$slug1})");
ok(($inv1['status'] ?? null) === 'draft', 'status awal = draft');

echo "== Unit: MidtransSignature ==\n";

$sig = MidtransSignature::make('ORDER-1', '200', '49000.00', 'SB-Mid-server-TEST');
ok(hash_equals(hash('sha512', 'ORDER-120049000.00SB-Mid-server-TEST'), $sig), 'make() = sha512(order_id+status_code+gross_amount+server_key)');
ok(MidtransSignature::verify(
    ['order_id' => 'ORDER-1', 'status_code' => '200', 'gross_amount' => '49000.00', 'signature_key' => $sig],
    'SB-Mid-server-TEST',
), 'verify() menerima signature yang cocok');
ok(! MidtransSignature::verify(
    ['order_id' => 'ORDER-1', 'status_code' => '200', 'gross_amount' => '49000.01', 'signature_key' => $sig],
    'SB-Mid-server-TEST',
), 'verify() menolak gross_amount yang diubah');
ok(! MidtransSignature::verify([], 'SB-Mid-server-TEST'), 'verify() menolak payload kosong');
ok(! MidtransSignature::verify(
    ['order_id' => 'ORDER-1', 'status_code' => '200', 'gross_amount' => '49000.00', 'signature_key' => $sig],
    null,
), 'verify() menolak saat server key kosong');

echo "== POST /api/invitations/{slug}/checkout ==\n";

[$status] = json('POST', "/api/invitations/{$slug1}/checkout");
ok($status === 401, 'checkout tanpa token -> 401');

[$status] = json('POST', "/api/invitations/{$slug1}/checkout", [], $tokenB);
ok($status === 403, 'checkout oleh non-owner -> 403');

[$status, $body] = json('POST', "/api/invitations/{$slug1}/checkout", [], $tokenA);
$checkout1 = $body['data'] ?? [];
$order1 = $checkout1['order_id'] ?? null;
ok($status === 201, 'checkout owner -> 201');
ok(is_string($order1) && str_starts_with($order1, 'NKY-'), "order_id dibuat dengan prefix NKY- ({$order1})");
ok((int) ($checkout1['amount'] ?? 0) === 49000, 'amount = 49000 (config)');
ok(($checkout1['payment_status'] ?? null) === 'pending', 'payment_status awal = pending');
ok(($checkout1['payment_type'] ?? null) === 'qris', 'payment_type = qris');
ok(($checkout1['gateway'] ?? null) === 'fake', 'gateway = fake (driver simulasi lokal)');
ok(($checkout1['qr_string'] ?? null) === 'DUMMY-QRIS-'.$order1, 'qr_string dummy berisi order_id');
ok(! empty($checkout1['expires_at']), 'expires_at terisi');
ok(($checkout1['simulation_command'] ?? null) === 'php artisan payments:simulate '.$order1, 'simulation_command menunjuk command simulasi');

[$status, $body] = json('POST', "/api/invitations/{$slug1}/checkout", [], $tokenA);
ok($status === 200 && ($body['data']['order_id'] ?? null) === $order1, 'checkout ulang selama pending -> 200 order yang sama (tanpa tagihan dobel)');

ok(Transaction::query()->where('invitation_id', $inv1['id'])->count() === 1, 'hanya 1 baris transaksi untuk undangan 1');

echo "== GET /api/transactions/{order_id} ==\n";

[$status] = json('GET', "/api/transactions/{$order1}");
ok($status === 401, 'status transaksi tanpa token -> 401');

[$status] = json('GET', "/api/transactions/{$order1}", [], $tokenB);
ok($status === 403, 'status transaksi oleh non-owner -> 403');

[$status, $body] = json('GET', "/api/transactions/{$order1}", [], $tokenA);
ok($status === 200 && ($body['data']['payment_status'] ?? null) === 'pending', 'owner lihat status -> 200 pending');
ok(($body['data']['invitation']['slug'] ?? null) === $slug1, 'payload menyertakan slug undangan');

[$status] = json('GET', '/api/transactions/NKY-TIDAK-ADA', [], $tokenA);
ok($status === 404, 'order_id tak dikenal -> 404');

echo "== Webhook: signature & guard ==\n";

$bad = midtransPayload($order1, 'settlement', signatureOverride: str_repeat('x', 128));
[$status] = webhook($bad);
ok($status === 403, 'signature salah -> 403');

$badGross = midtransPayload($order1, 'settlement', gross: '99000.00', signatureOverride: MidtransSignature::make($order1, '200', '49000.00', (string) config('midtrans.server_key')));
[$status] = webhook($badGross);
ok($status === 403, 'gross_amount diubah -> 403');

[$status, $body] = json('GET', "/api/transactions/{$order1}", [], $tokenA);
ok(($body['data']['payment_status'] ?? null) === 'pending', 'setelah signature salah, transaksi tetap pending');
ok(Invitation::find($inv1['id'])->status === 'draft', 'setelah signature salah, undangan tetap draft');

$evt = PaymentEvent::query()->where('order_id', $order1)->latest('created_at')->first();
ok($evt !== null && $evt->signature_valid === false, 'percobaan signature salah tercatat di payment_events (audit)');
ok(is_string($evt->getRawOriginal('payload')), 'payload payment_events tersimpan sebagai jsonb');

[$status] = webhook(midtransPayload('NKY-TIDAK-DIKENAL-000', 'settlement'));
ok($status === 404, 'signature valid tapi order tidak dikenal -> 404');

echo "== Webhook: status pending / challenge / settlement ==\n";

[$status] = webhook(midtransPayload($order1, 'pending'));
ok($status === 200, 'webhook pending -> 200');
ok(Transaction::query()->where('order_id', $order1)->value('payment_status') === 'pending', 'pending tidak mengubah apa pun');

$payloadChallenge = midtransPayload($order1, 'capture');
$payloadChallenge['fraud_status'] = 'challenge';
$payloadChallenge['signature_key'] = MidtransSignature::make($order1, '200', '49000.00', (string) config('midtrans.server_key'));
[$status] = webhook($payloadChallenge);
ok($status === 200, 'capture + fraud challenge -> 200');
ok(Transaction::query()->where('order_id', $order1)->value('payment_status') === 'pending', 'capture challenge tidak menandai lunas');

[$status, $body] = webhook(midtransPayload($order1, 'settlement'));
ok($status === 200, 'webhook settlement -> 200');

$tx1 = Transaction::query()->where('order_id', $order1)->first();
ok($tx1->payment_status === 'paid', 'payment_status -> paid');
ok($tx1->paid_at !== null, 'paid_at terisi');

$inv1 = Invitation::find($inv1['id']);
ok($inv1->status === 'published', 'undangan 1: draft -> published');
ok(DB::table('invitations')->where('id', $inv1->id)->value('status') === 'published', 'status published benar-benar tersimpan di DB');

$paidAt = $tx1->paid_at->toDateTimeString();
[$status, $body] = webhook(midtransPayload($order1, 'settlement'));
$tx1->refresh();
ok($status === 200, 'webhook settlement diulang (retry Midtrans) -> 200');
ok($tx1->paid_at->toDateTimeString() === $paidAt, 'retry tidak mengubah paid_at (idempoten)');

echo "== Setelah published ==\n";

[$status, $body] = json('GET', "/api/invitations/{$slug1}");
ok($status === 200, 'undangan published bisa dibuka publik -> 200');
ok(($body['data']['slug'] ?? null) === $slug1, 'payload publik berisi slug undangan');
ok(! array_key_exists('status', $body['data'] ?? []), 'payload publik tetap menyembunyikan status/field owner');
ok(is_array($body['data']['guests'] ?? null), 'payload publik menyertakan guests');

[$status, $body] = json('POST', "/api/invitations/{$slug1}/checkout", [], $tokenA);
ok($status === 422, 'checkout pada undangan yang sudah terbit -> 422');

echo "== Undangan 2: expire / cancel / settlement kedua ==\n";

[$status, $body] = json('POST', '/api/invitations', $invitationPayload, $tokenA);
$inv2 = $body['data'] ?? [];
ok($status === 201, 'create undangan 2 -> 201');

[$status, $body] = json('POST', "/api/invitations/{$inv2['slug']}/checkout", [], $tokenA);
$order2 = $body['data']['order_id'] ?? null;
ok($status === 201 && $order2 !== $order1, 'checkout undangan 2 -> 201 order baru');

[$status] = webhook(midtransPayload($order2, 'expire'));
ok($status === 200, 'webhook expire -> 200');
ok(Transaction::query()->where('order_id', $order2)->value('payment_status') === 'expired', 'transaksi 2 -> expired');
ok(Invitation::find($inv2['id'])->status === 'draft', 'undangan 2 tetap draft setelah expire');

[$status, $body] = json('POST', "/api/invitations/{$inv2['slug']}/checkout", [], $tokenA);
$order3 = $body['data']['order_id'] ?? null;
ok($status === 201 && $order3 !== $order2, 'checkout ulang setelah expired -> order baru (201)');

[$status] = webhook(midtransPayload($order3, 'cancel'));
ok($status === 200, 'webhook cancel -> 200');
ok(Transaction::query()->where('order_id', $order3)->value('payment_status') === 'failed', 'transaksi 3 -> failed');

[$status, $body] = json('POST', "/api/invitations/{$inv2['slug']}/checkout", [], $tokenA);
$order4 = $body['data']['order_id'] ?? null;
ok($status === 201 && $order4 !== $order3, 'checkout lagi -> order keempat');

[$status] = webhook(midtransPayload($order4, 'settlement'));
ok($status === 200, 'webhook settlement order 4 -> 200');
ok(Transaction::query()->where('order_id', $order4)->value('payment_status') === 'paid', 'transaksi 4 -> paid');
ok(Invitation::find($inv2['id'])->status === 'published', 'undangan 2: draft -> published');

$orderIds = [$order1, $order2, $order3, $order4];
$events = PaymentEvent::query()->whereIn('order_id', $orderIds)->count();
ok($events >= 9, "payment_events mencatat semua notifikasi ({$events} baris)");

echo "== Cleanup ==\n";

Transaction::query()->whereIn('order_id', $orderIds)->delete();
PaymentEvent::query()->whereIn('order_id', $orderIds)->delete();
Invitation::query()->whereIn('user_id', [$userA->id, $userB->id])->delete();
$userA->tokens()->delete();
$userB->tokens()->delete();
$userA->delete();
$userB->delete();

ok(User::query()->whereIn('email', $emails)->count() === 0, 'fixture user terhapus');
ok(Invitation::query()->whereIn('slug', [$slug1, $inv2['slug'] ?? 'x'])->count() === 0, 'fixture undangan terhapus');

Cache::flush();

echo "\n== SUMMARY: {$pass} passed, {$fail} failed ==\n";
exit($fail > 0 ? 1 : 0);
